import { IsBoolean, IsOptional, IsString, IsUUID, Length } from 'class-validator';

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
  @IsUUID()
  serviceBranchId?: string;

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
  @IsUUID()
  serviceBranchId?: string | null;

  @IsOptional()
  @IsBoolean()
  isServiceable?: boolean;
}
