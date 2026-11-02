import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invoice } from '../entities/invoice.entity';
import { User } from '../entities/user.entity';
import { GstReportsController } from './gst-reports.controller';
import { GstReportsService } from './gst-reports.service';

@Module({
  imports: [TypeOrmModule.forFeature([Invoice, User])],
  controllers: [GstReportsController],
  providers: [GstReportsService],
})
export class GstReportsModule {}
