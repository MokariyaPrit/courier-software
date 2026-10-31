import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { City } from '../entities/city.entity';
import { State } from '../entities/state.entity';
import { StatesController } from './states.controller';
import { StatesService } from './states.service';

@Module({
  imports: [TypeOrmModule.forFeature([State, City])],
  controllers: [StatesController],
  providers: [StatesService],
  exports: [StatesService],
})
export class StatesModule {}
