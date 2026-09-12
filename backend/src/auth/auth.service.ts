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
}
