import {
  Body,
  Controller,
  Get,
  Inject,
  Put,
  UseGuards,
  forwardRef,
} from '@nestjs/common';
import { Role } from '@courier/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { QuotationTemplatesService } from '../quotations/quotation-templates.service';
import { SyncRateColumnSelectionDto } from './dto/rate-column.dto';
import { RateColumnsService } from './rate-columns.service';

@Controller('rate-columns')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.BRANCH_MANAGER)
export class RateColumnsController {
  constructor(
    private readonly service: RateColumnsService,
    @Inject(forwardRef(() => QuotationTemplatesService))
    private readonly quotationTemplates: QuotationTemplatesService,
  ) {}

  @Get('board')
  board(@CurrentUser() user: AuthUser) {
    return this.service.getSelectionBoard(user);
  }

  @Put('selection')
  async sync(
    @Body() dto: SyncRateColumnSelectionDto,
    @CurrentUser() user: AuthUser,
  ) {
    const board = await this.service.syncSelection(dto, user);
    await this.quotationTemplates.syncCashColumnsForUser(user);
    return board;
  }
}
