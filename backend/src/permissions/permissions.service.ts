import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { GrantPermissionDto } from './dto/grant-permission.dto';
import { ResourcePermission } from '@prisma/client';

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Grant access to one or more sheets / workbooks by email or phone.
   * This is the core Admin power requested.
   */
  async grantAccess(dto: GrantPermissionDto, actor: AuthUser) {
    if (!dto.email && !dto.phone) {
      throw new BadRequestException('Either email or phone is required');
    }

    if ((!dto.workbookIds || dto.workbookIds.length === 0) &&
        (!dto.sheetIds || dto.sheetIds.length === 0)) {
      throw new BadRequestException('At least one workbookId or sheetId is required');
    }

    // Resolve target user (create if not exists)
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
          // password can be set later via invite / magic link
        },
      });
    }

    const results: any[] = [];

    // Grant workbook-level permissions
    if (dto.workbookIds?.length) {
      for (const workbookId of dto.workbookIds) {
        const workbook = await this.prisma.workbook.findUnique({
          where: { id: workbookId },
        });
        if (!workbook) throw new NotFoundException(`Workbook ${workbookId} not found`);

        await this.assertCanManage(workbook.organizationId, actor);

        // Ensure user is at least a member of the org
        await this.ensureOrgMembership(workbook.organizationId, targetUser.id, actor.id);

        const perm = await this.prisma.workbookPermission.upsert({
          where: {
            workbookId_userId: {
              workbookId,
              userId: targetUser.id,
            },
          },
          create: {
            organizationId: workbook.organizationId,
            workbookId,
            userId: targetUser.id,
            permission: (dto.permission as ResourcePermission) || 'VIEWER',
            grantedById: actor.id,
            expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
          },
          update: {
            permission: (dto.permission as ResourcePermission) || 'VIEWER',
            expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
            grantedById: actor.id,
          },
        });

        await this.prisma.auditLog.create({
          data: {
            organizationId: workbook.organizationId,
            actorId: actor.id,
            action: 'PERMISSION_GRANTED',
            resourceType: 'workbook_permission',
            resourceId: perm.id,
            after: {
              userId: targetUser.id,
              email: targetUser.email,
              phone: targetUser.phone,
              workbookId,
              permission: perm.permission,
              expiresAt: perm.expiresAt,
            },
          },
        });

        results.push({ type: 'workbook', id: workbookId, permission: perm });
      }
    }

    // Grant sheet-level permissions
    if (dto.sheetIds?.length) {
      for (const sheetId of dto.sheetIds) {
        const sheet = await this.prisma.sheet.findUnique({
          where: { id: sheetId },
        });
        if (!sheet) throw new NotFoundException(`Sheet ${sheetId} not found`);

        await this.assertCanManage(sheet.organizationId, actor);

        await this.ensureOrgMembership(sheet.organizationId, targetUser.id, actor.id);

        const perm = await this.prisma.sheetPermission.upsert({
          where: {
            sheetId_userId: {
              sheetId,
              userId: targetUser.id,
            },
          },
          create: {
            organizationId: sheet.organizationId,
            sheetId,
            userId: targetUser.id,
            permission: (dto.permission as ResourcePermission) || 'VIEWER',
            grantedById: actor.id,
            expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
          },
          update: {
            permission: (dto.permission as ResourcePermission) || 'VIEWER',
            expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
            grantedById: actor.id,
          },
        });

        await this.prisma.auditLog.create({
          data: {
            organizationId: sheet.organizationId,
            actorId: actor.id,
            action: 'PERMISSION_GRANTED',
            resourceType: 'sheet_permission',
            resourceId: perm.id,
            after: {
              userId: targetUser.id,
              email: targetUser.email,
              phone: targetUser.phone,
              sheetId,
              permission: perm.permission,
              expiresAt: perm.expiresAt,
            },
          },
        });

        results.push({ type: 'sheet', id: sheetId, permission: perm });
      }
    }

    return {
      user: {
        id: targetUser.id,
        email: targetUser.email,
        phone: targetUser.phone,
        name: targetUser.name,
      },
      granted: results,
    };
  }

  /**
   * Revoke access from a user on specific resources
   */
  async revokeAccess(
    params: {
      userId: string;
      workbookIds?: string[];
      sheetIds?: string[];
    },
    actor: AuthUser,
  ) {
    const results: any[] = [];

    if (params.workbookIds?.length) {
      for (const workbookId of params.workbookIds) {
        const workbook = await this.prisma.workbook.findUnique({
          where: { id: workbookId },
        });
        if (!workbook) continue;

        await this.assertCanManage(workbook.organizationId, actor);

        const deleted = await this.prisma.workbookPermission.deleteMany({
          where: { workbookId, userId: params.userId },
        });

        if (deleted.count > 0) {
          await this.prisma.auditLog.create({
            data: {
              organizationId: workbook.organizationId,
              actorId: actor.id,
              action: 'PERMISSION_REVOKED',
              resourceType: 'workbook_permission',
              resourceId: workbookId,
              before: { userId: params.userId, workbookId },
            },
          });
          results.push({ type: 'workbook', id: workbookId, revoked: true });
        }
      }
    }

    if (params.sheetIds?.length) {
      for (const sheetId of params.sheetIds) {
        const sheet = await this.prisma.sheet.findUnique({
          where: { id: sheetId },
        });
        if (!sheet) continue;

        await this.assertCanManage(sheet.organizationId, actor);

        const deleted = await this.prisma.sheetPermission.deleteMany({
          where: { sheetId, userId: params.userId },
        });

        if (deleted.count > 0) {
          await this.prisma.auditLog.create({
            data: {
              organizationId: sheet.organizationId,
              actorId: actor.id,
              action: 'PERMISSION_REVOKED',
              resourceType: 'sheet_permission',
              resourceId: sheetId,
              before: { userId: params.userId, sheetId },
            },
          });
          results.push({ type: 'sheet', id: sheetId, revoked: true });
        }
      }
    }

    return { revoked: results };
  }

  /**
   * List all permissions for a workbook (Admin view)
   */
  async listWorkbookPermissions(workbookId: string, actor: AuthUser) {
    const workbook = await this.prisma.workbook.findUnique({
      where: { id: workbookId },
    });
    if (!workbook) throw new NotFoundException('Workbook not found');

    await this.assertCanManage(workbook.organizationId, actor);

    return this.prisma.workbookPermission.findMany({
      where: { workbookId },
      include: {
        user: {
          select: { id: true, name: true, email: true, phone: true },
        },
      },
    });
  }

  /**
   * List all permissions for a sheet
   */
  async listSheetPermissions(sheetId: string, actor: AuthUser) {
    const sheet = await this.prisma.sheet.findUnique({
      where: { id: sheetId },
    });
    if (!sheet) throw new NotFoundException('Sheet not found');

    await this.assertCanManage(sheet.organizationId, actor);

    return this.prisma.sheetPermission.findMany({
      where: { sheetId },
      include: {
        user: {
          select: { id: true, name: true, email: true, phone: true },
        },
      },
    });
  }

  // ---------- helpers ----------

  private async assertCanManage(orgId: string, actor: AuthUser) {
    if (actor.isPlatformAdmin) return;

    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: orgId,
          userId: actor.id,
        },
      },
    });

    if (!membership || membership.role !== 'ORG_ADMIN') {
      throw new ForbiddenException('Only organization admins can manage permissions');
    }
  }

  private async ensureOrgMembership(orgId: string, userId: string, invitedById: string) {
    const existing = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: { organizationId: orgId, userId },
      },
    });

    if (!existing) {
      await this.prisma.organizationMember.create({
        data: {
          organizationId: orgId,
          userId,
          role: 'MEMBER',
          invitedById,
        },
      });
    }
  }
}
