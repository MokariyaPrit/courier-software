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
  courierCompanyId?: string;

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

  /** Document number — stored as AWB (unique) */
  @IsString()
  @MinLength(1)
  awb: string;

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
  @Min(0)
  cgst?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sgst?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  igst?: number;

  @IsOptional()
  @IsEnum(ServiceType)
  serviceType?: ServiceType;

  @IsOptional()
  @IsString()
  remarks?: string;

  /** Price amount — stored as FREIGHT charge row */
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChargeDto)
  charges?: ChargeDto[];
}

export class UpdateConsignmentDto {
  @IsOptional()
  @IsEnum(BookingType)
  bookingType?: BookingType;

  @IsOptional()
  @IsEnum(ServiceType)
  serviceType?: ServiceType;

  @IsOptional()
  @IsDateString()
  bookingDate?: string;

  /** Document number — stored as AWB (unique) */
  @IsOptional()
  @IsString()
  @MinLength(1)
  awb?: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsUUID()
  courierCompanyId?: string | null;

  @IsOptional()
  @IsUUID()
  quotationId?: string | null;

  @IsOptional()
  @IsUUID()
  senderLocationId?: string | null;

  @IsOptional()
  @IsUUID()
  receiverId?: string | null;

  @IsOptional()
  @IsString()
  rateSectionId?: string | null;

  @IsOptional()
  @IsString()
  rateColumnId?: string | null;

  @IsOptional()
  @IsString()
  partyName?: string | null;

  @IsOptional()
  @IsString()
  partyPhone?: string | null;

  @IsOptional()
  @IsString()
  partyAddress?: string | null;

  @IsOptional()
  @IsString()
  partyCity?: string | null;

  @IsOptional()
  @IsString()
  partyState?: string | null;

  @IsOptional()
  @IsString()
  partyPincode?: string | null;

  @IsOptional()
  @IsString()
  partyGstin?: string | null;

  @IsOptional()
  @IsString()
  partyEmail?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(2)
  senderName?: string;

  @IsOptional()
  @IsString()
  senderPhone?: string | null;

  @IsOptional()
  @IsString()
  senderAddress?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(2)
  receiverName?: string;

  @IsOptional()
  @IsString()
  receiverPhone?: string | null;

  @IsOptional()
  @IsString()
  receiverAddress?: string | null;

  @IsOptional()
  @IsString()
  receiverCity?: string | null;

  @IsOptional()
  @IsString()
  receiverState?: string | null;

  @IsOptional()
  @IsString()
  receiverPincode?: string | null;

  @IsOptional()
  @IsUUID()
  receiverCityId?: string | null;

  @IsOptional()
  @IsUUID()
  receiverStateId?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  weightKg?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cgst?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sgst?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  igst?: number;

  @IsOptional()
  @IsString()
  remarks?: string | null;

  /** Price amount — stored as FREIGHT charge row */
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

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

  @IsOptional()
  @IsUUID()
  customerId?: string;

  /** Exact/partial party name filter for cash bookings */
  @IsOptional()
  @IsString()
  partyName?: string;

  /** Inclusive booking date range start (YYYY-MM-DD) */
  @IsOptional()
  @IsString()
  dateFrom?: string;

  /** Inclusive booking date range end (YYYY-MM-DD) */
  @IsOptional()
  @IsString()
  dateTo?: string;

  /** When true, only consignments created by the current user */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  mine?: boolean;
}
