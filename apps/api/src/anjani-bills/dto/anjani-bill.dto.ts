import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class AnjaniBillRowDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsString()
  docNo?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  party?: string;

  @IsOptional()
  @IsString()
  center?: string;

  @IsOptional()
  @IsString()
  weight?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  amount?: string;
}

export class AnjaniBillQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  search?: string;
}

export class UpsertAnjaniBillDto {
  @IsOptional()
  @IsString()
  billNo?: string | null;

  @IsOptional()
  @IsString()
  billDate?: string | null;

  @IsOptional()
  @IsString()
  billPeriod?: string | null;

  @IsOptional()
  @IsString()
  hsn?: string | null;

  @IsOptional()
  @IsString()
  customerName?: string | null;

  @IsOptional()
  @IsString()
  address1?: string | null;

  @IsOptional()
  @IsString()
  address2?: string | null;

  @IsOptional()
  @IsString()
  customerGst?: string | null;

  @IsOptional()
  @IsString()
  customerCode?: string | null;

  @IsOptional()
  @IsString()
  customerPan?: string | null;

  @IsOptional()
  @IsString()
  bankName?: string | null;

  @IsOptional()
  @IsString()
  accountNo?: string | null;

  @IsOptional()
  @IsString()
  ifsc?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnjaniBillRowDto)
  rows?: AnjaniBillRowDto[];

  @IsOptional()
  @IsString()
  fuel?: string | null;

  @IsOptional()
  @IsString()
  gross?: string | null;

  @IsOptional()
  @IsString()
  sub?: string | null;

  @IsOptional()
  @IsString()
  sgst?: string | null;

  @IsOptional()
  @IsString()
  cgst?: string | null;

  @IsOptional()
  @IsString()
  igst?: string | null;

  @IsOptional()
  @IsString()
  bill?: string | null;

  @IsOptional()
  @IsString()
  words?: string | null;

  @IsOptional()
  @IsObject()
  layoutJson?: Record<string, unknown> | null;

  @IsOptional()
  @IsString()
  sourcePdfFileName?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sourcePdfBytes?: number | null;

  @IsOptional()
  @IsString()
  editedPdfFileName?: string | null;
}
