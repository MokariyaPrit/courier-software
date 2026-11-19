import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
  IsNumberString,
} from 'class-validator';
import {
  RateColumnDto,
  RateRowDto,
  RateSectionDto,
} from './quotation-template.dto';

export class CreateQuotationDto {
  @IsNumberString()
  customerId: string;

  @IsOptional()
  @IsNumberString()
  templateId?: string;

  @IsOptional()
  @IsDateString()
  quotationDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateQuotationDto {
  @IsOptional()
  @IsDateString()
  quotationDate?: string;

  @IsOptional()
  @IsString()
  notes?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RateColumnDto)
  columns?: RateColumnDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RateSectionDto)
  sections?: RateSectionDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RateRowDto)
  rows?: RateRowDto[];
}

export class IssueQuotationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  quotationCode?: string;
}
