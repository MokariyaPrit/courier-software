import {
  IsBoolean,
  IsOptional,
  IsString,
  MinLength,
  IsNumberString,
} from 'class-validator';

export class CreateCityDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsNumberString()
  stateId: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCityDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsNumberString()
  stateId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
