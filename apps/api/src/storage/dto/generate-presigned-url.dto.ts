import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class GeneratePresignedUrlItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  filename!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  contentType!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  fileSize!: number;
}
