import { ConsignmentStatus } from '@courier/shared';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateStatusDto {
  @IsEnum(ConsignmentStatus)
  status: ConsignmentStatus;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}
