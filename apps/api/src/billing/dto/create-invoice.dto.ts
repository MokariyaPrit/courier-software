import { IsArray, IsOptional, IsString, ArrayMinSize, IsNumberString } from 'class-validator';

export class CreateInvoiceDto {
  @IsNumberString()
  customerId: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsNumberString({}, { each: true })
  consignmentIds: string[];

  @IsOptional()
  @IsString()
  notes?: string;
}
