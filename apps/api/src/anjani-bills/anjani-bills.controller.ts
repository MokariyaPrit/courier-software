import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Role } from '@courier/shared';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AnjaniBillsService } from './anjani-bills.service';
import {
  AnjaniBillQueryDto,
  UpsertAnjaniBillDto,
} from './dto/anjani-bill.dto';

type UploadFields = {
  sourcePdf?: Express.Multer.File[];
  headerImage?: Express.Multer.File[];
  editedPdf?: Express.Multer.File[];
};

function resolveDto(body: Record<string, unknown>): UpsertAnjaniBillDto {
  if (typeof body?.payload === 'string' && body.payload.trim()) {
    try {
      return JSON.parse(body.payload) as UpsertAnjaniBillDto;
    } catch {
      return {};
    }
  }
  const { payload: _p, ...rest } = body || {};
  return rest as UpsertAnjaniBillDto;
}

const uploadInterceptor = FileFieldsInterceptor(
  [
    { name: 'sourcePdf', maxCount: 1 },
    { name: 'headerImage', maxCount: 1 },
    { name: 'editedPdf', maxCount: 1 },
  ],
  {
    storage: memoryStorage(),
    limits: { fileSize: 80 * 1024 * 1024 },
  },
);

@Controller('anjani-bills')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.BRANCH_MANAGER)
export class AnjaniBillsController {
  constructor(private readonly service: AnjaniBillsService) {}

  @Get()
  findAll(
    @Query() query: AnjaniBillQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.findAll(query, user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.findOne(id, user);
  }

  @Post()
  @UseInterceptors(uploadInterceptor)
  create(
    @Body() body: Record<string, unknown>,
    @UploadedFiles() files: UploadFields,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.create(resolveDto(body), user, {
      sourcePdf: files?.sourcePdf?.[0],
      headerImage: files?.headerImage?.[0],
      editedPdf: files?.editedPdf?.[0],
    });
  }

  @Patch(':id')
  @UseInterceptors(uploadInterceptor)
  update(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @UploadedFiles() files: UploadFields,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.update(id, resolveDto(body), user, {
      sourcePdf: files?.sourcePdf?.[0],
      headerImage: files?.headerImage?.[0],
      editedPdf: files?.editedPdf?.[0],
    });
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.remove(id, user);
  }
}
