import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesGuard } from '../auth/roles.guard';
import { Avaliacao } from '../avaliacoes/avaliacao.entity';
import { Paciente } from '../pacientes/paciente.entity';
import { User } from '../users/user.entity';
import { TacoFood } from '../taco/taco.entity';
import { PlanoAlimentarController } from './plano-alimentar.controller';
import { PlanoAlimentar } from './plano-alimentar.entity';
import { PlanoAlimentarService } from './plano-alimentar.service';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';

@Module({
  imports: [AuditoriaModule, NotificacoesModule, TypeOrmModule.forFeature([PlanoAlimentar, Paciente, Avaliacao, User, TacoFood])],
  controllers: [PlanoAlimentarController],
  providers: [PlanoAlimentarService, RolesGuard],
  exports: [PlanoAlimentarService, TypeOrmModule]
})
export class PlanosAlimentaresModule {}
