import { Type } from 'class-transformer';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class GstReportQueryDto {
  @IsDateString()
  dateFrom: string;

  @IsDateString()
  dateTo: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;
}
