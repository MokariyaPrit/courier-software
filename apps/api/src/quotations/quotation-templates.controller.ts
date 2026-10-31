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
import { RateTemplateKind, Role } from '@courier/shared';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  CreateQuotationTemplateDto,
  UpdateQuotationTemplateDto,
} from './dto/quotation-template.dto';
import { QuotationTemplatesService } from './quotation-templates.service';

class TemplateQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(RateTemplateKind)
  kind?: RateTemplateKind;
}

@Controller('quotation-templates')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.BRANCH_MANAGER)
export class QuotationTemplatesController {
  constructor(private readonly templatesService: QuotationTemplatesService) {}

  @Post()
  create(
    @Body() dto: CreateQuotationTemplateDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.templatesService.create(dto, user);
  }

  @Get('cash/mine')
  cashMine(@CurrentUser() user: AuthUser) {
    return this.templatesService.getOrCreateCashTemplate(user);
  }

  @Get()
  findAll(@Query() query: TemplateQueryDto, @CurrentUser() user: AuthUser) {
    return this.templatesService.findAll(query, user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.templatesService.findOne(id, user);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateQuotationTemplateDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.templatesService.update(id, dto, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.templatesService.remove(id, user);
  }
}
