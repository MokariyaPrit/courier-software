import { Role } from '@courier/shared';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  fullName?: string;

  @IsOptional()
  @IsString()
  phone?: string | null;

  @IsOptional()
  @IsEmail()
  infoEmail?: string | null;

  @IsOptional()
  @IsString()
  address?: string | null;

  @IsOptional()
  @IsString()
  city?: string | null;

  @IsOptional()
  @IsString()
  state?: string | null;

  @IsOptional()
  @IsString()
  pincode?: string | null;

  @IsOptional()
  @IsString()
  companyName?: string | null;

  @IsOptional()
  @IsString()
  gstin?: string | null;

  @IsOptional()
  @IsString()
  notes?: string | null;

  @IsOptional()
  @IsBoolean()
  infoIsActive?: boolean;
}
