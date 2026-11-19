import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Consignment } from '../entities/consignment.entity';
import { InvoiceConsignment } from '../entities/invoice-consignment.entity';
import { ConsignmentsController } from './consignments.controller';
import { ConsignmentsService } from './consignments.service';

@Module({
  imports: [TypeOrmModule.forFeature([Consignment, InvoiceConsignment])],
  controllers: [ConsignmentsController],
  providers: [ConsignmentsService],
  exports: [ConsignmentsService],
})
export class ConsignmentsModule {}
