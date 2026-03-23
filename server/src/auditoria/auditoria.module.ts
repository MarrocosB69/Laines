import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Auditoria } from './auditoria.entity';
import { AuditoriaService } from './auditoria.service';
import { AuditoriaController } from './auditoria.controller';
import { RolesGuard } from '../auth/roles.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Auditoria])],
  providers: [AuditoriaService, RolesGuard],
  controllers: [AuditoriaController],
  exports: [AuditoriaService]
})
export class AuditoriaModule {}
