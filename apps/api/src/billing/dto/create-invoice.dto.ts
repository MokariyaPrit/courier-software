import { IsArray, IsOptional, IsString, IsUUID, ArrayMinSize } from 'class-validator';

export class CreateInvoiceDto {
  @IsUUID()
  customerId: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  consignmentIds: string[];

  @IsOptional()
  @IsString()
  notes?: string;
}
