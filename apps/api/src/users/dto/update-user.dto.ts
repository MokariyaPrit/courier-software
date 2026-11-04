import { Role } from '@courier/shared';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { BookingTabConfigDto } from './booking-tab-config.dto';

export class UpdateUserDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** Blank / omitted = keep existing password */
  @IsOptional()
  @ValidateIf((_, value) => value !== undefined && value !== null && value !== '')
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
  panNumber?: string | null;

  @IsOptional()
  @IsString()
  bankName?: string | null;

  @IsOptional()
  @IsString()
  bankAccountNo?: string | null;

  @IsOptional()
  @IsString()
  bankIfsc?: string | null;

  @IsOptional()
  @IsString()
  upiId?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sgstPercent?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cgstPercent?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  igstPercent?: number;

  @IsOptional()
  @IsString()
  notes?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => BookingTabConfigDto)
  bookingTabConfig?: BookingTabConfigDto | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  termsAndConditions?: string[] | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  insurancePercent?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  paymentDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  volumetricDivisor?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  ewayBillThreshold?: number;

  @IsOptional()
  @IsBoolean()
  infoIsActive?: boolean;

  /** Last day account may log in (YYYY-MM-DD). Null clears expiry. Admin only. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== '')
  @IsDateString()
  expiredOn?: string | null;

  /** Blank host clears all SMTP settings */
  @IsOptional()
  @IsString()
  smtpHost?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  smtpPort?: number | null;

  @IsOptional()
  @IsBoolean()
  smtpSecure?: boolean;

  @IsOptional()
  @IsString()
  smtpUser?: string | null;

  /** Blank / omitted = keep existing password */
  @IsOptional()
  @IsString()
  smtpPassword?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== '')
  @IsEmail()
  smtpFromEmail?: string | null;
}
