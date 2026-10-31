import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsUUID } from 'class-validator';

export class SyncRateColumnSelectionDto {
  @IsArray()
  @IsUUID('4', { each: true })
  cityIds: string[];
}
