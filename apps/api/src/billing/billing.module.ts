import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Consignment } from '../entities/consignment.entity';
import { Customer } from '../entities/customer.entity';
import { Invoice } from '../entities/invoice.entity';
import { User } from '../entities/user.entity';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';

@Module({
  imports: [TypeOrmModule.forFeature([Invoice, Customer, Consignment, User])],
  controllers: [BillingController],
  providers: [BillingService],
})
export class BillingModule {}
