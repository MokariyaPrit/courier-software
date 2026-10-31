import { ChargeType, ServiceType } from '@courier/shared';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

class ChargeDto {
  @IsEnum(ChargeType)
  type: ChargeType;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateConsignmentDto {
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsString()
  @MinLength(2)
  senderName: string;

  @IsOptional()
  @IsString()
  senderPhone?: string;

  @IsOptional()
  @IsString()
  senderAddress?: string;

  @IsString()
  @MinLength(2)
  receiverName: string;

  @IsOptional()
  @IsString()
  receiverPhone?: string;

  @IsOptional()
  @IsString()
  receiverAddress?: string;

  @IsOptional()
  @IsString()
  receiverCity?: string;

  @IsOptional()
  @IsString()
  receiverPincode?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  weightKg?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  pieces?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  codAmount?: number;

  @IsOptional()
  @IsEnum(ServiceType)
  serviceType?: ServiceType;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChargeDto)
  charges?: ChargeDto[];
}

export class ConsignmentQueryDto {
  @IsOptional()
  @Type(() => Number)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  pageSize = 20;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
