import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';

export class GenerateInvoicesDto {
  @IsDateString()
  billDate: string;

  @IsDateString()
  dateFrom: string;

  @IsDateString()
  dateTo: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  customerIds: string[];

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
}
