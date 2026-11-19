import { Type } from 'class-transformer';
import { IsDateString, IsOptional, IsNumberString } from 'class-validator';

export class GstReportQueryDto {
  @IsDateString()
  dateFrom: string;

  @IsDateString()
  dateTo: string;

  @IsOptional()
  @IsNumberString()
  customerId?: string;
}
