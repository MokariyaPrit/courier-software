import {
  BookingType,
  ChargeType,
  ServiceType,
} from '@courier/shared';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

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
  @IsEnum(BookingType)
  bookingType?: BookingType;

  @ValidateIf((o: CreateConsignmentDto) => o.bookingType === BookingType.ACCOUNT)
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsUUID()
  quotationId?: string;

  @IsOptional()
  @IsUUID()
  senderLocationId?: string;

  @IsOptional()
  @IsUUID()
  receiverId?: string;

  @IsOptional()
  @IsString()
  rateSectionId?: string;

  @IsOptional()
  @IsString()
  rateColumnId?: string;

  @IsOptional()
  @IsDateString()
  bookingDate?: string;

  /** Cash walk-in party (not a Customer record) */
  @ValidateIf((o: CreateConsignmentDto) => o.bookingType === BookingType.CASH)
  @IsString()
  @MinLength(2)
  partyName?: string;

  @IsOptional()
  @IsString()
  partyPhone?: string;

  @IsOptional()
  @IsString()
  partyAddress?: string;

  @IsOptional()
  @IsString()
  partyCity?: string;

  @IsOptional()
  @IsString()
  partyState?: string;

  @IsOptional()
  @IsString()
  partyPincode?: string;

  @IsOptional()
  @IsString()
  partyGstin?: string;

  @IsOptional()
  @IsString()
  partyEmail?: string;

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
  receiverState?: string;

  @IsOptional()
  @IsString()
  receiverPincode?: string;

  @IsOptional()
  @IsUUID()
  receiverCityId?: string;

  @IsOptional()
  @IsUUID()
  receiverStateId?: string;

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

export class ConsignmentQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsEnum(BookingType)
  bookingType?: BookingType;

  @IsOptional()
  @IsUUID()
  receiverId?: string;

  /** When true, only consignments created by the current user */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  mine?: boolean;
}
