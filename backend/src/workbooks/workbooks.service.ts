import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { CreateWorkbookDto } from './dto/create-workbook.dto';
import { CreateSheetDto } from './dto/create-sheet.dto';

@Injectable()
export class WorkbooksService {
  constructor(private readonly prisma: PrismaService) {}

  async createWorkbook(orgId: string, dto: CreateWorkbookDto, user: AuthUser) {
    this.assertOrgAccess(orgId, user);

    const workbook = await this.prisma.workbook.create({
      data: {
        organizationId: orgId,
        name: dto.name,
        description: dto.description,
        createdById: user.id,
        sheets: {
          create: {
            name: 'Sheet1',
            organizationId: orgId,
            createdById: user.id,
            orderIndex: 0,
          },
        },
      },
      include: { sheets: true },
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId: orgId,
        actorId: user.id,
        action: 'WORKBOOK_CREATED',
        resourceType: 'workbook',
        resourceId: workbook.id,
        after: { name: workbook.name },
      },
    });

    return workbook;
  }

  async listWorkbooks(orgId: string, user: AuthUser) {
    this.assertOrgAccess(orgId, user);

    // Org admins see everything. Others see only workbooks they have permission on
    // or sheets they have permission on (simplified for now: org members see all)
    return this.prisma.workbook.findMany({
      where: {
        organizationId: orgId,
        isArchived: false,
      },
      include: {
        sheets: {
          where: { isArchived: false },
          orderBy: { orderIndex: 'asc' },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getWorkbook(workbookId: string, user: AuthUser) {
    const workbook = await this.prisma.workbook.findUnique({
      where: { id: workbookId },
      include: {
        sheets: {
          where: { isArchived: false },
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    if (!workbook) throw new NotFoundException('Workbook not found');
    this.assertOrgAccess(workbook.organizationId, user);

    return workbook;
  }

  async createSheet(workbookId: string, dto: CreateSheetDto, user: AuthUser) {
    const workbook = await this.prisma.workbook.findUnique({
      where: { id: workbookId },
    });
    if (!workbook) throw new NotFoundException('Workbook not found');
    this.assertOrgAccess(workbook.organizationId, user);

    const maxOrder = await this.prisma.sheet.aggregate({
      where: { workbookId },
      _max: { orderIndex: true },
    });

    const sheet = await this.prisma.sheet.create({
      data: {
        workbookId,
        organizationId: workbook.organizationId,
        name: dto.name,
        createdById: user.id,
        orderIndex: (maxOrder._max.orderIndex ?? -1) + 1,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId: workbook.organizationId,
        actorId: user.id,
        action: 'SHEET_CREATED',
        resourceType: 'sheet',
        resourceId: sheet.id,
        after: { name: sheet.name, workbookId },
      },
    });

    return sheet;
  }

  async deleteSheet(sheetId: string, user: AuthUser) {
    const sheet = await this.prisma.sheet.findUnique({
      where: { id: sheetId },
    });
    if (!sheet) throw new NotFoundException('Sheet not found');
    this.assertOrgAccess(sheet.organizationId, user);

    await this.prisma.sheet.update({
      where: { id: sheetId },
      data: { isArchived: true },
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId: sheet.organizationId,
        actorId: user.id,
        action: 'SHEET_DELETED',
        resourceType: 'sheet',
        resourceId: sheetId,
        before: { name: sheet.name },
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
}
