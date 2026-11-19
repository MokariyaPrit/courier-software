import { Body, Controller, ParseArrayPipe, Post, UseGuards } from '@nestjs/common';
import { Role } from '@courier/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { GeneratePresignedUrlItemDto } from './dto/generate-presigned-url.dto';
import { R2StorageService } from './r2.service';

@Controller('storage')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.BRANCH_MANAGER)
export class StorageController {
  constructor(private readonly storage: R2StorageService) {}

  @Post('generate-presigned-urls')
  generatePresignedUrls(
    @Body(
      new ParseArrayPipe({
        items: GeneratePresignedUrlItemDto,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    items: GeneratePresignedUrlItemDto[],
    @CurrentUser() user: AuthUser,
  ) {
    return this.storage.createPresignedUploadUrls(items, user.id);
  }
}
