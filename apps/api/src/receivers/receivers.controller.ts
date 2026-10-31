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
import { IsOptional, IsString } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateReceiverDto, UpdateReceiverDto } from './dto/receiver.dto';
import { ReceiversService } from './receivers.service';

class ReceiverQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  search?: string;
}

@Controller('receivers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.BRANCH_MANAGER)
export class ReceiversController {
  constructor(private readonly receiversService: ReceiversService) {}

  @Post()
  create(@Body() dto: CreateReceiverDto, @CurrentUser() user: AuthUser) {
    return this.receiversService.create(dto, user);
  }

  @Post('find-or-create')
  findOrCreate(
    @Body() dto: CreateReceiverDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.receiversService.findOrCreate(dto, user);
  }

  @Get()
  findAll(@Query() query: ReceiverQueryDto, @CurrentUser() user: AuthUser) {
    return this.receiversService.findAll(query, user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.receiversService.findOne(id, user);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateReceiverDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.receiversService.update(id, dto, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.receiversService.remove(id, user);
  }
}
