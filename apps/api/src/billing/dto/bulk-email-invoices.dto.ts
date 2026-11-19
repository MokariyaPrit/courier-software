import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  IsNumberString,
} from 'class-validator';

export class BulkEmailInvoicesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsNumberString({}, { each: true })
  @Type(() => String)
  ids: string[];

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  message?: string;
}
