import { Role } from '@courier/shared';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @MinLength(2)
  fullName: string;

  @IsEnum(Role)
  role: Role;

  @ValidateIf((o: CreateUserDto) => o.role === Role.BRANCH_MANAGER)
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  optionalBranchId?: string;
}
