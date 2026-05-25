import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesGuard } from '../auth/roles.guard';
import { Avaliacao } from '../avaliacoes/avaliacao.entity';
import { Paciente } from '../pacientes/paciente.entity';
import { PlanoAlimentarController } from './plano-alimentar.controller';
import { PlanoAlimentar } from './plano-alimentar.entity';
import { PlanoAlimentarService } from './plano-alimentar.service';

@Module({
  imports: [TypeOrmModule.forFeature([PlanoAlimentar, Paciente, Avaliacao])],
  controllers: [PlanoAlimentarController],
  providers: [PlanoAlimentarService, RolesGuard],
  exports: [PlanoAlimentarService, TypeOrmModule]
})
export class PlanosAlimentaresModule {}
