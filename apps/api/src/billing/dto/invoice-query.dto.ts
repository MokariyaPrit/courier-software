import { IsOptional, IsString, Matches } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export class InvoiceQueryDto extends PaginationDto {
  /** Filter by bill date from (inclusive, YYYY-MM-DD) */
  @IsOptional()
  @IsString()
  @Matches(ISO_DATE, { message: 'dateFrom must be YYYY-MM-DD' })
  dateFrom?: string;

  /** Filter by bill date to (inclusive, YYYY-MM-DD) */
  @IsOptional()
  @IsString()
  @Matches(ISO_DATE, { message: 'dateTo must be YYYY-MM-DD' })
  dateTo?: string;
}
