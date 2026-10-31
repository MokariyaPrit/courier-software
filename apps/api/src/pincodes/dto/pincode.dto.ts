import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

export class CreatePincodeDto {
  @IsString()
  @Length(4, 10)
  code: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsBoolean()
  isServiceable?: boolean;
}

export class UpdatePincodeDto {
  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsBoolean()
  isServiceable?: boolean;
}
