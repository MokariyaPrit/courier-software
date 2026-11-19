import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsOptional,
  IsNumberString,
} from 'class-validator';

export class SyncSenderLocationSelectionDto {
  @IsArray()
  @ArrayUnique()
  @IsNumberString({}, { each: true })
  cityIds: string[];

  @IsOptional()
  @IsNumberString()
  defaultCityId?: string | null;
}

export class SetDefaultSenderLocationDto {
  @IsNumberString()
  cityId: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isDefault?: boolean;
}
