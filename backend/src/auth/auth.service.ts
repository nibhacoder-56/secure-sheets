import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    if (!dto.email && !dto.phone) {
      throw new BadRequestException('Email or phone is required');
    }

    if (dto.email) {
      const existing = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });
      if (existing) throw new ConflictException('Email already registered');
    }

    if (dto.phone) {
      const existing = await this.prisma.user.findUnique({
        where: { phone: dto.phone },
      });
      if (existing) throw new ConflictException('Phone already registered');
    }

    const passwordHash = dto.password
      ? await bcrypt.hash(dto.password, 12)
      : null;

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        phone: dto.phone,
        name: dto.name,
        passwordHash,
      },
    });

    // Create audit log
    await this.prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'USER_REGISTER',
        resourceType: 'user',
        resourceId: user.id,
        after: { email: user.email, phone: user.phone },
      },
    });

    return this.issueTokens(user.id, user.email, user.globalRole);
  }

  async login(dto: LoginDto, meta: { ip?: string; userAgent?: string }) {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          dto.email ? { email: dto.email } : undefined,
          dto.phone ? { phone: dto.phone } : undefined,
        ].filter(Boolean) as any,
      },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is disabled');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'USER_LOGIN',
        resourceType: 'user',
        resourceId: user.id,
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
      },
    });

    return this.issueTokens(user.id, user.email, user.globalRole, meta);
  }

  private async issueTokens(
    userId: string,
    email: string | null | undefined,
    globalRole: string,
    meta?: { ip?: string; userAgent?: string },
  ) {
    const payload = {
      sub: userId,
      email,
      globalRole,
    };

    const accessToken = await this.jwt.signAsync(payload);

    // Refresh token
    const refreshToken = randomBytes(64).toString('hex');
    const refreshTokenHash = createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    const expiresInDays = parseInt(
      this.config.get('JWT_REFRESH_EXPIRES_DAYS', '30'),
      10,
    );
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    await this.prisma.session.create({
      data: {
        userId,
        refreshTokenHash,
        expiresAt,
        ipAddress: meta?.ip,
        userAgent: meta?.userAgent,
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.config.get('JWT_ACCESS_EXPIRES_IN', '15m'),
    };
  }

  async refresh(refreshToken: string) {
    const hash = createHash('sha256').update(refreshToken).digest('hex');

    const session = await this.prisma.session.findFirst({
      where: {
        refreshTokenHash: hash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!session || !session.user.isActive) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Rotate refresh token
    await this.prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(
      session.user.id,
      session.user.email,
      session.user.globalRole,
    );
  }

  async logout(refreshToken: string, userId: string) {
    const hash = createHash('sha256').update(refreshToken).digest('hex');

    await this.prisma.session.updateMany({
      where: {
        userId,
        refreshTokenHash: hash,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: userId,
        action: 'USER_LOGOUT',
        resourceType: 'user',
        resourceId: userId,
      },
    });

    return { success: true };
  }

  async revokeAllSessions(userId: string) {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: userId,
        action: 'SESSION_REVOKE',
        resourceType: 'user',
        resourceId: userId,
        metadata: { scope: 'all' },
      },
    });
  }

  async forgotPassword(email: string) {
    if (!email) {
      return { message: 'If the email exists, a reset token has been generated.' };
    }

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Do not reveal whether the email exists
      return { message: 'If the email exists, a reset token has been generated.' };
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour validity

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    // In production you would send an email here.
    // For now we return the token so you can test the flow.
    return {
      message: 'Password reset token generated. Use it within 1 hour.',
      resetToken: token, // remove this in real production with email
    };
  }

  async resetPassword(token: string, newPassword: string) {
    if (!token || !newPassword || newPassword.length < 8) {
      throw new BadRequestException('Invalid token or password (min 8 characters)');
    }

    const record = await this.prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await this.prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    });

    await this.prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });

    // Revoke all existing sessions
    await this.prisma.session.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: record.userId,
        action: 'PASSWORD_CHANGE',
        resourceType: 'user',
        resourceId: record.userId,
      },
    });

    return { message: 'Password has been reset successfully. Please login.' };
  }
}
