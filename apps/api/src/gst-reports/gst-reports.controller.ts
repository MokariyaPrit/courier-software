import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Role } from '@courier/shared';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { GstReportQueryDto } from './dto/gst-report-query.dto';
import { GstReportsService } from './gst-reports.service';

@Controller('gst-reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.BRANCH_MANAGER)
export class GstReportsController {
  constructor(private readonly gstReportsService: GstReportsService) {}

  /** CA GST data — invoice-wise + customer summary for returns / IT filing */
  @Get('ca')
  caReport(@Query() query: GstReportQueryDto, @CurrentUser() user: AuthUser) {
    return this.gstReportsService.caGstReport(query, user);
  }
}
