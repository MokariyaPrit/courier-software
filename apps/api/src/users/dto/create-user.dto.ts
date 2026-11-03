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
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsEnum(Role)
  role: Role;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsString()
  @MinLength(2)
  fullName: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  pincode?: string;

  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsString()
  gstin?: string;

  @IsOptional()
  @IsString()
  panNumber?: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  bankAccountNo?: string;

  @IsOptional()
  @IsString()
  bankIfsc?: string;

  @IsOptional()
  @IsString()
  upiId?: string;

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
  notes?: string;

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

  /** Last day account may log in (YYYY-MM-DD). Null/omit = no expiry. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== '')
  @IsDateString()
  expiredOn?: string | null;
}
