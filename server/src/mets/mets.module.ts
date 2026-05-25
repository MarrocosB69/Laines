import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MetsController } from './mets.controller';
import { Met } from './mets.entity';
import { MetsService } from './mets.service';

@Module({
  imports: [TypeOrmModule.forFeature([Met])],
  controllers: [MetsController],
  providers: [MetsService],
  exports: [MetsService, TypeOrmModule]
})
export class MetsModule {}
