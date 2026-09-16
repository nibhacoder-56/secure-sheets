import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/decorators/current-user.decorator';

interface JwtPayload {
  sub: string;
  email?: string;
  globalRole: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        phone: true,
        globalRole: true,
        isActive: true,
        memberships: {
          select: { organizationId: true, role: true },
        },
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    const orgIds = user.memberships.map((m) => m.organizationId);
    const orgRoles: Record<string, string> = {};
    for (const m of user.memberships) {
      orgRoles[m.organizationId] = m.role;
    }
    const isPlatformAdmin = user.globalRole === 'PLATFORM_SUPER_ADMIN';

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      globalRole: user.globalRole,
      orgIds,
      orgRoles,
      isPlatformAdmin,
    };
  }
}
