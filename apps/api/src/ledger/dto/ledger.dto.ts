import {
  InvoicePaymentStatus,
  LedgerTxnType,
  PaymentMode,
} from '@courier/shared';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
  IsNumberString,
} from 'class-validator';

export class LedgerCustomerQueryDto {
  @IsOptional()
  @IsString()
  search?: string;
}

export class LedgerDetailQueryDto {
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsEnum(LedgerTxnType)
  type?: LedgerTxnType;

  @IsOptional()
  @IsEnum(InvoicePaymentStatus)
  paymentStatus?: InvoicePaymentStatus;
}

export class PaymentAllocationInputDto {
  @IsNumberString()
  invoiceId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;
}

export class CreatePaymentDto {
  @IsNumberString()
  customerId: string;

  @IsDateString()
  paymentDate: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsEnum(PaymentMode)
  mode: PaymentMode;

  @IsOptional()
  @IsString()
  referenceNo?: string | null;

  @IsOptional()
  @IsString()
  notes?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentAllocationInputDto)
  @ArrayMinSize(0)
  allocations?: PaymentAllocationInputDto[];
}
