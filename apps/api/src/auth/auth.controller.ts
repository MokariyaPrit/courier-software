import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { MailService } from '../mail/mail.service';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UploadLogoDto } from './dto/upload-logo.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly mailService: MailService,
  ) {}

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('login')
  login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.login(dto, res);
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    this.authService.clearAuthCookies(res);
    return { ok: true };
  }

  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Post('refresh')
  refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.refresh(req.cookies?.refresh_token, res);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.authService.me(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  updateProfile(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('profile/logo')
  uploadLogo(@CurrentUser() user: AuthUser, @Body() dto: UploadLogoDto) {
    return this.authService.uploadLogo(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('profile/logo')
  removeLogo(@CurrentUser() user: AuthUser) {
    return this.authService.removeLogo(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('profile/smtp/test')
  testSmtp(@CurrentUser() user: AuthUser) {
    return this.mailService.sendSmtpTest(user.id);
  }
}
