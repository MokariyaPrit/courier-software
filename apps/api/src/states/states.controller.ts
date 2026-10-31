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
import { Role } from '@courier/shared';
import { IsOptional, IsString } from 'class-validator';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateStateDto, UpdateStateDto } from './dto/state.dto';
import { StatesService } from './states.service';

class StateQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  search?: string;
}

@Controller('states')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StatesController {
  constructor(private readonly statesService: StatesService) {}

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateStateDto) {
    return this.statesService.create(dto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.BRANCH_MANAGER)
  findAll(@Query() query: StateQueryDto) {
    return this.statesService.findAll(query);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.BRANCH_MANAGER)
  findOne(@Param('id') id: string) {
    return this.statesService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateStateDto) {
    return this.statesService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string) {
    return this.statesService.remove(id);
  }
}
