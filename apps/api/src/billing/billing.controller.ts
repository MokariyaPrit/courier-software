import {
  Body,
  Controller,
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

@Controller('billing')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.BRANCH_MANAGER)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post('invoices')
  create(@Body() dto: CreateInvoiceDto, @CurrentUser() user: AuthUser) {
    return this.billingService.create(dto, user);
  }

  @Get('invoices')
  findAll(@Query() query: PaginationDto) {
    return this.billingService.findAll(query);
  }

  @Get('invoices/:id')
  findOne(@Param('id') id: string) {
    return this.billingService.findOne(id);
  }

  @Get('customers/:customerId/statement')
  statement(@Param('customerId') customerId: string) {
    return this.billingService.customerStatement(customerId);
  }
}
