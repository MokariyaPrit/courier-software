import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import type { Response } from 'express';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtPayload } from './jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly usersService: UsersService,
  ) {}

  private cookieOptions() {
    const secure = this.config.get<string>('COOKIE_SECURE') === 'true';
    return {
      httpOnly: true,
      secure,
      sameSite: 'lax' as const,
      path: '/',
    };
  }

  private signAccess(user: User) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    return this.jwt.sign(payload, {
      secret: this.config.getOrThrow('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get('JWT_ACCESS_EXPIRES', '15m') as `${number}m`,
    });
  }

  private signRefresh(user: User) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    return this.jwt.sign(payload, {
      secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get('JWT_REFRESH_EXPIRES', '7d') as `${number}d`,
    });
  }

  setAuthCookies(res: Response, user: User) {
    const access = this.signAccess(user);
    const refresh = this.signRefresh(user);
    const base = this.cookieOptions();
    res.cookie('access_token', access, { ...base, maxAge: 15 * 60 * 1000 });
    res.cookie('refresh_token', refresh, {
      ...base,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  clearAuthCookies(res: Response) {
    const base = this.cookieOptions();
    res.clearCookie('access_token', base);
    res.clearCookie('refresh_token', base);
  }

  sanitize(user: User) {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      fullName: user.userInfo?.fullName ?? user.email,
      userInfo: user.userInfo ?? null,
    };
  }

  async login(dto: LoginDto, res: Response) {
    const user = await this.usersRepo.findOne({
      where: { email: dto.email.toLowerCase() },
      relations: ['userInfo'],
    });
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!user.isActive) {
      throw new ForbiddenException(
        'Your account is inactive. Please contact the administrator.',
      );
    }
    this.setAuthCookies(res, user);
    return this.sanitize(user);
  }

  async refresh(refreshToken: string | undefined, res: Response) {
    if (!refreshToken) {
      throw new UnauthorizedException('Missing refresh token');
    }
    try {
      const payload = this.jwt.verify<JwtPayload>(refreshToken, {
        secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
      });
      const user = await this.usersRepo.findOne({
        where: { id: payload.sub },
        relations: ['userInfo'],
      });
      if (!user || !user.isActive) {
        throw new UnauthorizedException('Invalid session');
      }
      this.setAuthCookies(res, user);
      return this.sanitize(user);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async me(userId: string) {
    const user = await this.usersRepo.findOne({
      where: { id: userId },
      relations: ['userInfo'],
    });
    if (!user) {
      throw new UnauthorizedException();
    }
    return this.sanitize(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    await this.usersService.update(userId, {
      fullName: dto.fullName,
      email: dto.email,
      phone: dto.phone,
      address: dto.address,
      city: dto.city,
      state: dto.state,
      pincode: dto.pincode,
      companyName: dto.companyName,
      gstin: dto.gstin,
      notes: dto.notes,
    });
    return this.me(userId);
  }
}
