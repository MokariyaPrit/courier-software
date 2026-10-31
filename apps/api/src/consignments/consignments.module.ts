import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConsignmentCharge } from '../entities/consignment-charge.entity';
import { Consignment } from '../entities/consignment.entity';
import { TrackingEvent } from '../entities/tracking-event.entity';
import { ConsignmentsController } from './consignments.controller';
import { ConsignmentsService } from './consignments.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Consignment, ConsignmentCharge, TrackingEvent]),
  ],
  controllers: [ConsignmentsController],
  providers: [ConsignmentsService],
  exports: [ConsignmentsService],
})
export class ConsignmentsModule {}
