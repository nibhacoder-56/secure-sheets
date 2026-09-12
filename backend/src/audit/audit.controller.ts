import {
  Controller,
  Get,
  Query,
  Param,
  UseGuards,
} from '@nestjs/common';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { AuditAction } from '@prisma/client';

@Controller('audit')
@UseGuards(JwtAuthGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  /**
   * Get organization-wide audit logs (Admin)
   * Query params: action, resourceType, resourceId, actorId, from, to, limit, offset
   */
  @Get('organizations/:orgId')
  getOrgLogs(
    @Param('orgId') orgId: string,
    @CurrentUser() user: AuthUser,
    @Query('action') action?: AuditAction,
    @Query('resourceType') resourceType?: string,
    @Query('resourceId') resourceId?: string,
    @Query('actorId') actorId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.auditService.getOrgLogs(orgId, user, {
      action,
      resourceType,
      resourceId,
      actorId,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });
  }

  /**
   * Full history of a sheet
   */
  @Get('sheets/:sheetId')
  getSheetHistory(
    @Param('sheetId') sheetId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.auditService.getSheetHistory(sheetId, user);
  }

  /**
   * History of a specific cell (e.g. A1)
   */
  @Get('sheets/:sheetId/cells/:cellRef')
  getCellHistory(
    @Param('sheetId') sheetId: string,
    @Param('cellRef') cellRef: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.auditService.getCellHistory(sheetId, cellRef, user);
  }
}
