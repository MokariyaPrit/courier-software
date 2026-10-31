import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@courier/shared';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UpdateStatusDto } from './dto/update-status.dto';
import { TrackingService } from './tracking.service';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.BRANCH_MANAGER)
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  @Patch('consignments/:id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.trackingService.updateStatus(id, dto, user);
  }

  @Get('consignments/:id/timeline')
  timeline(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.trackingService.timeline(id, user);
  }

  @Get('delivery/ofd')
  ofdList(@CurrentUser() user: AuthUser) {
    return this.trackingService.ofdList(user);
  }
}
