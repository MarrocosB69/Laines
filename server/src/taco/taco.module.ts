import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesGuard } from '../auth/roles.guard';
import { TacoController } from './taco.controller';
import { TacoFood } from './taco.entity';
import { TacoService } from './taco.service';

@Module({
  imports: [TypeOrmModule.forFeature([TacoFood])],
  controllers: [TacoController],
  providers: [TacoService, RolesGuard],
  exports: [TacoService, TypeOrmModule]
})
export class TacoModule {}
