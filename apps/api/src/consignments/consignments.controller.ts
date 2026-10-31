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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ConsignmentsService } from './consignments.service';
import {
  ConsignmentQueryDto,
  CreateConsignmentDto,
} from './dto/consignment.dto';

@Controller('consignments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.BRANCH_MANAGER)
export class ConsignmentsController {
  constructor(private readonly consignmentsService: ConsignmentsService) {}

  @Get('dashboard/counts')
  dashboard() {
    return this.consignmentsService.dashboardCounts();
  }

  @Post()
  create(@Body() dto: CreateConsignmentDto, @CurrentUser() user: AuthUser) {
    return this.consignmentsService.create(dto, user);
  }

  @Get()
  findAll(@Query() query: ConsignmentQueryDto) {
    return this.consignmentsService.findAll(query);
  }

  @Get('awb/:awb')
  findByAwb(@Param('awb') awb: string) {
    return this.consignmentsService.findByAwb(awb);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.consignmentsService.findOne(id);
  }
}
