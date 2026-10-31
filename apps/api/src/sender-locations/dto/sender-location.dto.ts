import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class SyncSenderLocationSelectionDto {
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  cityIds: string[];

  @IsOptional()
  @IsUUID()
  defaultCityId?: string | null;
}

export class SetDefaultSenderLocationDto {
  @IsUUID()
  cityId: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isDefault?: boolean;
}
