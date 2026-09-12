import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { AuditAction } from '@prisma/client';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Query audit logs for an organization (Admin view)
   */
  async getOrgLogs(
    orgId: string,
    user: AuthUser,
    options: {
      action?: AuditAction;
      resourceType?: string;
      resourceId?: string;
      actorId?: string;
      from?: Date;
      to?: Date;
      limit?: number;
      offset?: number;
    } = {},
  ) {
    await this.assertOrgAccess(orgId, user);

    const where: any = {
      organizationId: orgId,
    };

    if (options.action) where.action = options.action;
    if (options.resourceType) where.resourceType = options.resourceType;
    if (options.resourceId) where.resourceId = options.resourceId;
    if (options.actorId) where.actorId = options.actorId;
    if (options.from || options.to) {
      where.createdAt = {};
      if (options.from) where.createdAt.gte = options.from;
      if (options.to) where.createdAt.lte = options.to;
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          actor: {
            select: { id: true, name: true, email: true, phone: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: options.limit ?? 50,
        skip: options.offset ?? 0,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { total, logs };
  }

  /**
   * Get history of a specific sheet (all changes)
   */
  async getSheetHistory(sheetId: string, user: AuthUser) {
    const sheet = await this.prisma.sheet.findUnique({
      where: { id: sheetId },
    });
    if (!sheet) throw new NotFoundException('Sheet not found');

    await this.assertOrgAccess(sheet.organizationId, user);

    const logs = await this.prisma.auditLog.findMany({
      where: {
        organizationId: sheet.organizationId,
        OR: [
          { resourceType: 'sheet', resourceId: sheetId },
          { resourceType: 'cell', resourceId: { startsWith: sheetId } },
        ],
      },
      include: {
        actor: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return logs;
  }

  /**
   * Get cell-level history (who changed A1, etc.)
   */
  async getCellHistory(
    sheetId: string,
    cellRef: string,
    user: AuthUser,
  ) {
    const sheet = await this.prisma.sheet.findUnique({
      where: { id: sheetId },
    });
    if (!sheet) throw new NotFoundException('Sheet not found');

    await this.assertOrgAccess(sheet.organizationId, user);

    return this.prisma.cellHistory.findMany({
      where: {
        sheetId,
        cellRef: cellRef.toUpperCase(),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  /**
   * Record a cell change (called from real-time layer later)
   */
  async recordCellChange(params: {
    organizationId: string;
    sheetId: string;
    cellRef: string;
    oldValue: any;
    newValue: any;
    oldFormat?: any;
    newFormat?: any;
    changedById: string;
  }) {
    await this.prisma.cellHistory.create({
      data: {
        organizationId: params.organizationId,
        sheetId: params.sheetId,
        cellRef: params.cellRef.toUpperCase(),
        oldValue: params.oldValue,
        newValue: params.newValue,
        oldFormat: params.oldFormat,
        newFormat: params.newFormat,
        changedById: params.changedById,
      },
    });

    // Also write a summary to the main audit log
    await this.prisma.auditLog.create({
      data: {
        organizationId: params.organizationId,
        actorId: params.changedById,
        action: 'CELL_UPDATED',
        resourceType: 'cell',
        resourceId: `${params.sheetId}:${params.cellRef}`,
        before: { value: params.oldValue },
        after: { value: params.newValue },
      },
    });
  }

  private async assertOrgAccess(orgId: string, user: AuthUser) {
    if (user.isPlatformAdmin) return;
    if (!user.orgIds.includes(orgId)) {
      throw new ForbiddenException('No access to this organization');
    }
  }
}
