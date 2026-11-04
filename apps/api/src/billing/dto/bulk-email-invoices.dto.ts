import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class BulkEmailInvoicesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  @Type(() => String)
  ids: string[];

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  message?: string;
}
