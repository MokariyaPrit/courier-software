import { ConsignmentStatus } from '@courier/shared';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateStatusDto {
  @IsEnum(ConsignmentStatus)
  status: ConsignmentStatus;

  @IsOptional()
  @IsString()
  locationLabel?: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}
