import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@courier/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  SetDefaultSenderLocationDto,
  SyncSenderLocationSelectionDto,
} from './dto/sender-location.dto';
import { SenderLocationsService } from './sender-locations.service';

@Controller('sender-locations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.BRANCH_MANAGER)
export class SenderLocationsController {
  constructor(private readonly service: SenderLocationsService) {}

  @Get('board')
  board(@CurrentUser() user: AuthUser) {
    return this.service.getSelectionBoard(user);
  }

  @Get('booking-options')
  bookingOptions(@CurrentUser() user: AuthUser) {
    return this.service.listForBooking(user);
  }

  @Put('selection')
  sync(
    @Body() dto: SyncSenderLocationSelectionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.syncSelection(dto, user);
  }

  @Put('default')
  setDefault(
    @Body() dto: SetDefaultSenderLocationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.setDefault(dto, user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.findOne(id, user);
  }
}
