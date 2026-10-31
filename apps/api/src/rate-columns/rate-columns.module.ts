import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { City } from '../entities/city.entity';
import { State } from '../entities/state.entity';
import { UserRateCity } from '../entities/user-rate-city.entity';
import { QuotationsModule } from '../quotations/quotations.module';
import { RateColumnsController } from './rate-columns.controller';
import { RateColumnsService } from './rate-columns.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserRateCity, City, State]),
    forwardRef(() => QuotationsModule),
  ],
  controllers: [RateColumnsController],
  providers: [RateColumnsService],
  exports: [RateColumnsService],
})
export class RateColumnsModule {}
