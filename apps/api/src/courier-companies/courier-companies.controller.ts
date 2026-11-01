import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@courier/shared';
import {
  CurrentUser,
  type AuthUser,
} from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CourierCompaniesService } from './courier-companies.service';
import {
  CourierCompanyQueryDto,
  CreateCourierCompanyDto,
  UpdateCourierCompanyDto,
  UpdateCourierCompanyPrefDto,
} from './dto/courier-company.dto';

@Controller('courier-companies')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.BRANCH_MANAGER)
export class CourierCompaniesController {
  constructor(private readonly service: CourierCompaniesService) {}

  @Post()
  create(
    @Body() dto: CreateCourierCompanyDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.create(dto, user);
  }

  @Get()
  findAll(
    @Query() query: CourierCompanyQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.findAll(query, user);
  }

  @Put(':id/my-prefs')
  updateMyPrefs(
    @Param('id') id: string,
    @Body() dto: UpdateCourierCompanyPrefDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.updateMyPrefs(id, dto, user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.findOne(id, user);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCourierCompanyDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.remove(id, user);
  }
}
