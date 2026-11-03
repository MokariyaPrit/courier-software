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
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  CreatePaymentDto,
  LedgerCustomerQueryDto,
  LedgerDetailQueryDto,
} from './dto/ledger.dto';
import { LedgerService } from './ledger.service';

@Controller('ledger')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.BRANCH_MANAGER)
export class LedgerController {
  constructor(private readonly ledgerService: LedgerService) {}

  @Get('customers')
  listCustomers(
    @Query() query: LedgerCustomerQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ledgerService.listCustomers(query, user);
  }

  @Get('customers/:customerId')
  customerLedger(
    @Param('customerId') customerId: string,
    @Query() query: LedgerDetailQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ledgerService.customerLedger(customerId, query, user);
  }

  @Get('customers/:customerId/statement')
  statement(
    @Param('customerId') customerId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ledgerService.statement(customerId, user);
  }

  @Post('payments')
  createPayment(
    @Body() dto: CreatePaymentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ledgerService.createPayment(dto, user);
  }

  @Delete('payments/:id')
  removePayment(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.ledgerService.removePayment(id, user);
  }
}
