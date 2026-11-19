import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@courier/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AnjaniBillsService } from './anjani-bills.service';
import {
  AnjaniBillQueryDto,
  UpsertAnjaniBillDto,
} from './dto/anjani-bill.dto';

@Controller('anjani-bills')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.BRANCH_MANAGER)
export class AnjaniBillsController {
  constructor(private readonly service: AnjaniBillsService) {}

  @Get()
  findAll(
    @Query() query: AnjaniBillQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.findAll(query, user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.findOne(id, user);
  }

  @Post()
  create(@Body() dto: UpsertAnjaniBillDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpsertAnjaniBillDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.remove(id, user);
  }
}
