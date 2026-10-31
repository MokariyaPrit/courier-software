import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Pincode } from '../entities/pincode.entity';
import { PincodesController } from './pincodes.controller';
import { PincodesService } from './pincodes.service';

@Module({
  imports: [TypeOrmModule.forFeature([Pincode])],
  controllers: [PincodesController],
  providers: [PincodesService],
  exports: [PincodesService],
})
export class PincodesModule {}
