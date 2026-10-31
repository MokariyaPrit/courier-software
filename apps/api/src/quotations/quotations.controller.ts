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
import {
  CreateQuotationDto,
  IssueQuotationDto,
  UpdateQuotationDto,
} from './dto/quotation.dto';
import { QuotationsService } from './quotations.service';

class QuotationQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  search?: string;
}

@Controller('quotations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.BRANCH_MANAGER)
export class QuotationsController {
  constructor(private readonly quotationsService: QuotationsService) {}

  @Post()
  create(@Body() dto: CreateQuotationDto, @CurrentUser() user: AuthUser) {
    return this.quotationsService.create(dto, user);
  }

  @Get()
  findAll(@Query() query: QuotationQueryDto, @CurrentUser() user: AuthUser) {
    return this.quotationsService.findAll(query, user);
  }

  @Get(':id/document')
  document(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.quotationsService.document(id, user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.quotationsService.findOne(id, user);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateQuotationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.quotationsService.update(id, dto, user);
  }

  @Post(':id/issue')
  issue(
    @Param('id') id: string,
    @Body() dto: IssueQuotationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.quotationsService.issue(id, dto, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.quotationsService.remove(id, user);
  }
}
