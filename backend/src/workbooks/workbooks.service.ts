import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser, isHrOrAdmin } from '../common/decorators/current-user.decorator';
import { CreateWorkbookDto } from './dto/create-workbook.dto';
import { CreateSheetDto } from './dto/create-sheet.dto';
import * as bcrypt from 'bcrypt';

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

    const workbooks = await this.prisma.workbook.findMany({
      where: {
        organizationId: orgId,
        isArchived: false,
      },
      include: {
        sheets: {
          where: { isArchived: false },
          orderBy: { orderIndex: 'asc' },
          include: {
            permissions: {
              where: { userId: user.id },
              select: { id: true, permission: true },
            },
          },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // HR / Org Admin see all sheets. Staff only see sheets explicitly shared with them
    // or sheets they created, and sheets that are NOT password-protected (open sheets).
    if (isHrOrAdmin(user, orgId)) {
      return workbooks;
    }

    // Staff filtering
    return workbooks
      .map((wb) => {
        const visibleSheets = wb.sheets.filter((s: any) => {
          const hasExplicitPermission = s.permissions && s.permissions.length > 0;
          const isCreator = s.createdById === user.id;
          const isOpen = !s.passwordHash;
          return hasExplicitPermission || isCreator || isOpen;
        });
        // Hide passwordHash from client
        const safeSheets = visibleSheets.map(({ passwordHash, permissions, ...rest }: any) => rest);
        return { ...wb, sheets: safeSheets };
      })
      .filter((wb) => wb.sheets.length > 0 || wb.createdById === user.id);
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

  async setSheetPassword(sheetId: string, password: string | null, user: AuthUser) {
    const sheet = await this.prisma.sheet.findUnique({ where: { id: sheetId } });
    if (!sheet) throw new NotFoundException('Sheet not found');
    this.assertOrgAccess(sheet.organizationId, user);

    const passwordHash = password ? await bcrypt.hash(password, 10) : null;

    await this.prisma.sheet.update({
      where: { id: sheetId },
      data: { passwordHash },
    });

    return { success: true, passwordProtected: !!password };
  }

  async verifySheetPassword(sheetId: string, password: string, user?: AuthUser) {
    const sheet = await this.prisma.sheet.findUnique({ where: { id: sheetId } });
    if (!sheet) throw new NotFoundException('Sheet not found');

    // HR / Org Admin always pass without password
    if (user && isHrOrAdmin(user, sheet.organizationId)) {
      return { valid: true, passwordProtected: !!sheet.passwordHash, bypassedByHr: true };
    }

    if (!sheet.passwordHash) {
      return { valid: true, passwordProtected: false };
    }

    const valid = await bcrypt.compare(password || '', sheet.passwordHash);
    return { valid, passwordProtected: true };
  }

  async getSheetInfo(sheetId: string, user: AuthUser) {
    const sheet = await this.prisma.sheet.findUnique({
      where: { id: sheetId },
      select: {
        id: true,
        name: true,
        organizationId: true,
        workbookId: true,
        passwordHash: true,
        createdById: true,
      },
    });
    if (!sheet) throw new NotFoundException('Sheet not found');
    this.assertOrgAccess(sheet.organizationId, user);

    const hrBypass = isHrOrAdmin(user, sheet.organizationId);

    // Staff: check explicit permission if sheet is protected
    if (!hrBypass && sheet.passwordHash) {
      const perm = await this.prisma.sheetPermission.findUnique({
        where: {
          sheetId_userId: { sheetId, userId: user.id },
        },
      });
      const isCreator = sheet.createdById === user.id;
      if (!perm && !isCreator) {
        throw new ForbiddenException('You do not have access to this protected sheet');
      }
    }

    return {
      id: sheet.id,
      name: sheet.name,
      workbookId: sheet.workbookId,
      // HR never needs to enter password
      passwordProtected: hrBypass ? false : !!sheet.passwordHash,
      isHrAccess: hrBypass,
    };
  }
}

