import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { City } from '../entities/city.entity';
import { SenderLocation } from '../entities/sender-location.entity';
import { State } from '../entities/state.entity';
import { SenderLocationsController } from './sender-locations.controller';
import { SenderLocationsService } from './sender-locations.service';

@Module({
  imports: [TypeOrmModule.forFeature([SenderLocation, City, State])],
  controllers: [SenderLocationsController],
  providers: [SenderLocationsService],
  exports: [SenderLocationsService],
})
export class SenderLocationsModule {}
