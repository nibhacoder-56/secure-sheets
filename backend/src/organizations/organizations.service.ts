import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { AddMemberDto } from './dto/add-member.dto';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateOrganizationDto, user: AuthUser) {
    // Any logged-in user can create an organization
    const existing = await this.prisma.organization.findUnique({
      where: { slug: dto.slug },
    });
    if (existing) throw new ConflictException('Slug already taken');

    const org = await this.prisma.organization.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        members: {
          create: {
            userId: user.id,
            role: 'ORG_ADMIN',
          },
        },
      },
      include: { members: true },
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId: org.id,
        actorId: user.id,
        action: 'ORG_CREATED',
        resourceType: 'organization',
        resourceId: org.id,
        after: { name: org.name, slug: org.slug },
      },
    });

    return org;
  }

  async findAllForUser(user: AuthUser) {
    if (user.isPlatformAdmin) {
      return this.prisma.organization.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
      });
    }

    return this.prisma.organization.findMany({
      where: {
        isActive: true,
        members: { some: { userId: user.id } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(orgId: string, user: AuthUser) {
    this.assertOrgAccess(orgId, user);

    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, phone: true },
            },
          },
        },
      },
    });

    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async addMember(orgId: string, dto: AddMemberDto, user: AuthUser) {
    await this.assertOrgAdmin(orgId, user);

    let targetUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          dto.email ? { email: dto.email } : undefined,
          dto.phone ? { phone: dto.phone } : undefined,
        ].filter(Boolean) as any,
      },
    });

    if (!targetUser) {
      targetUser = await this.prisma.user.create({
        data: {
          email: dto.email,
          phone: dto.phone,
          name: dto.name || null,
        },
      });
    }

    const existing = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: orgId,
          userId: targetUser.id,
        },
      },
    });

    if (existing) {
      throw new ConflictException('User is already a member of this organization');
    }

    const member = await this.prisma.organizationMember.create({
      data: {
        organizationId: orgId,
        userId: targetUser.id,
        role: dto.role || 'MEMBER',
        invitedById: user.id,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, phone: true },
        },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId: orgId,
        actorId: user.id,
        action: 'MEMBER_ADDED',
        resourceType: 'organization_member',
        resourceId: member.id,
        after: {
          userId: targetUser.id,
          email: targetUser.email,
          phone: targetUser.phone,
          role: member.role,
        },
      },
    });

    return member;
  }

  async removeMember(orgId: string, memberUserId: string, user: AuthUser) {
    await this.assertOrgAdmin(orgId, user);

    const member = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: orgId,
          userId: memberUserId,
        },
      },
    });

    if (!member) throw new NotFoundException('Member not found');

    await this.prisma.organizationMember.delete({
      where: { id: member.id },
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId: orgId,
        actorId: user.id,
        action: 'MEMBER_REMOVED',
        resourceType: 'organization_member',
        resourceId: member.id,
        before: { userId: memberUserId, role: member.role },
      },
    });

    return { success: true };
  }

  private assertOrgAccess(orgId: string, user: AuthUser) {
    if (user.isPlatformAdmin) return;
    if (!user.orgIds.includes(orgId)) {
      throw new ForbiddenException('No access to this organization');
    }
  }

  private async assertOrgAdmin(orgId: string, user: AuthUser) {
    if (user.isPlatformAdmin) return;

    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: orgId,
          userId: user.id,
        },
      },
    });

    if (!membership || membership.role !== 'ORG_ADMIN') {
      throw new ForbiddenException('Only organization admins can perform this action');
    }
  }
}
