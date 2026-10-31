import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Customer } from '../entities/customer.entity';
import { Quotation } from '../entities/quotation.entity';
import { QuotationRateRow } from '../entities/quotation-rate-row.entity';
import { QuotationRateTemplate } from '../entities/quotation-rate-template.entity';
import { User } from '../entities/user.entity';
import { QuotationTemplatesController } from './quotation-templates.controller';
import { QuotationTemplatesService } from './quotation-templates.service';
import { QuotationsController } from './quotations.controller';
import { QuotationsService } from './quotations.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      QuotationRateTemplate,
      QuotationRateRow,
      Quotation,
      Customer,
      User,
    ]),
  ],
  controllers: [QuotationTemplatesController, QuotationsController],
  providers: [QuotationTemplatesService, QuotationsService],
  exports: [QuotationTemplatesService, QuotationsService],
})
export class QuotationsModule {}
