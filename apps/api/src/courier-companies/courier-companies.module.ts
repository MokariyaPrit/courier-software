import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CourierCompany } from '../entities/courier-company.entity';
import { UserCourierCompanyPref } from '../entities/user-courier-company-pref.entity';
import { CourierCompaniesController } from './courier-companies.controller';
import { CourierCompaniesService } from './courier-companies.service';

@Module({
  imports: [TypeOrmModule.forFeature([CourierCompany, UserCourierCompanyPref])],
  controllers: [CourierCompaniesController],
  providers: [CourierCompaniesService],
  exports: [CourierCompaniesService],
})
export class CourierCompaniesModule {}
