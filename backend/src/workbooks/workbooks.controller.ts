import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { WorkbooksService } from './workbooks.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { CreateWorkbookDto } from './dto/create-workbook.dto';
import { CreateSheetDto } from './dto/create-sheet.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class WorkbooksController {
  constructor(private readonly workbooksService: WorkbooksService) {}

  @Post('organizations/:orgId/workbooks')
  createWorkbook(
    @Param('orgId') orgId: string,
    @Body() dto: CreateWorkbookDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.workbooksService.createWorkbook(orgId, dto, user);
  }

  @Get('organizations/:orgId/workbooks')
  listWorkbooks(
    @Param('orgId') orgId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.workbooksService.listWorkbooks(orgId, user);
  }

  @Get('workbooks/:id')
  getWorkbook(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.workbooksService.getWorkbook(id, user);
  }

  @Post('workbooks/:id/sheets')
  createSheet(
    @Param('id') workbookId: string,
    @Body() dto: CreateSheetDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.workbooksService.createSheet(workbookId, dto, user);
  }

  @Delete('sheets/:id')
  deleteSheet(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.workbooksService.deleteSheet(id, user);
  }

  @Get('sheets/:id/info')
  getSheetInfo(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.workbooksService.getSheetInfo(id, user);
  }

  @Post('sheets/:id/password')
  setSheetPassword(
    @Param('id') id: string,
    @Body('password') password: string | null,
    @CurrentUser() user: AuthUser,
  ) {
    return this.workbooksService.setSheetPassword(id, password, user);
  }

  @Post('sheets/:id/verify-password')
  verifySheetPassword(
    @Param('id') id: string,
    @Body('password') password: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.workbooksService.verifySheetPassword(id, password, user);
  }
}

