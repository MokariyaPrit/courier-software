import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@courier/shared';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { BillingService } from './billing.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { GenerateInvoicesDto } from './dto/generate-invoices.dto';

@Controller('billing')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.BRANCH_MANAGER)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post('invoices/generate')
  generate(@Body() dto: GenerateInvoicesDto, @CurrentUser() user: AuthUser) {
    return this.billingService.generate(dto, user);
  }

  @Post('invoices')
  create(@Body() dto: CreateInvoiceDto, @CurrentUser() user: AuthUser) {
    return this.billingService.create(dto, user);
  }

  @Get('invoices')
  findAll(@Query() query: PaginationDto, @CurrentUser() user: AuthUser) {
    return this.billingService.findAll(query, user);
  }

  @Get('invoices/:id/document')
  document(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.billingService.findDocument(id, user);
  }

  @Get('invoices/:id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.billingService.findOne(id, user);
  }

  @Delete('invoices/:id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.billingService.remove(id, user);
  }

  @Get('customers/:customerId/statement')
  statement(
    @Param('customerId') customerId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.billingService.customerStatement(customerId, user);
  }
}
