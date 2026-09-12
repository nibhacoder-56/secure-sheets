import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { GrantPermissionDto } from './dto/grant-permission.dto';

@Controller('permissions')
@UseGuards(JwtAuthGuard)
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  /**
   * Admin grants access to one or more workbooks/sheets
   * by email or phone number.
   */
  @Post('grant')
  grant(@Body() dto: GrantPermissionDto, @CurrentUser() user: AuthUser) {
    return this.permissionsService.grantAccess(dto, user);
  }

  /**
   * Revoke access
   */
  @Post('revoke')
  revoke(
    @Body()
    body: {
      userId: string;
      workbookIds?: string[];
      sheetIds?: string[];
    },
    @CurrentUser() user: AuthUser,
  ) {
    return this.permissionsService.revokeAccess(body, user);
  }

  @Get('workbooks/:workbookId')
  listWorkbookPermissions(
    @Param('workbookId') workbookId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.permissionsService.listWorkbookPermissions(workbookId, user);
  }

  @Get('sheets/:sheetId')
  listSheetPermissions(
    @Param('sheetId') sheetId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.permissionsService.listSheetPermissions(sheetId, user);
  }
}
