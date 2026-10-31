import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@courier/shared';
import { IsOptional, IsString } from 'class-validator';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreatePincodeDto, UpdatePincodeDto } from './dto/pincode.dto';
import { PincodesService } from './pincodes.service';

class PincodeQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  search?: string;
}

@Controller('pincodes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PincodesController {
  constructor(private readonly pincodesService: PincodesService) {}

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() dto: CreatePincodeDto) {
    return this.pincodesService.create(dto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.BRANCH_MANAGER)
  findAll(@Query() query: PincodeQueryDto) {
    return this.pincodesService.findAll(query);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.BRANCH_MANAGER)
  findOne(@Param('id') id: string) {
    return this.pincodesService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdatePincodeDto) {
    return this.pincodesService.update(id, dto);
  }
}
