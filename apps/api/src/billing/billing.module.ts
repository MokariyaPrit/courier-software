import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Consignment } from '../entities/consignment.entity';
import { Customer } from '../entities/customer.entity';
import { Invoice } from '../entities/invoice.entity';
import { InvoiceConsignment } from '../entities/invoice-consignment.entity';
import { User } from '../entities/user.entity';
import { MailModule } from '../mail/mail.module';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Invoice,
      InvoiceConsignment,
      Customer,
      Consignment,
      User,
    ]),
    MailModule,
  ],
  controllers: [BillingController],
  providers: [BillingService],
})
export class BillingModule {}
