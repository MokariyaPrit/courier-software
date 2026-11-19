import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UploadLogoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  tempKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  fileLabel?: string;
}
