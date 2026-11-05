import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnjaniBill } from '../entities/anjani-bill.entity';
import { AnjaniBillsController } from './anjani-bills.controller';
import { AnjaniBillsService } from './anjani-bills.service';

@Module({
  imports: [TypeOrmModule.forFeature([AnjaniBill])],
  controllers: [AnjaniBillsController],
  providers: [AnjaniBillsService],
  exports: [AnjaniBillsService],
})
export class AnjaniBillsModule {}
