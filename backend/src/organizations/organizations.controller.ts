import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { AddMemberDto } from './dto/add-member.dto';

@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationsController {
  constructor(private readonly orgsService: OrganizationsService) {}

  @Post()
  create(@Body() dto: CreateOrganizationDto, @CurrentUser() user: AuthUser) {
    return this.orgsService.create(dto, user);
  }

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.orgsService.findAllForUser(user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.orgsService.findOne(id, user);
  }

  @Post(':id/members')
  addMember(
    @Param('id') id: string,
    @Body() dto: AddMemberDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.orgsService.addMember(id, dto, user);
  }

  @Delete(':id/members/:userId')
  removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.orgsService.removeMember(id, userId, user);
  }
}
