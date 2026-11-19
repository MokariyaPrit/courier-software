import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsNumberString } from 'class-validator';

export class SyncRateColumnSelectionDto {
  @IsArray()
  @IsNumberString({}, { each: true })
  cityIds: string[];
}
