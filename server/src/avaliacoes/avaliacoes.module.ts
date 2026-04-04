import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Avaliacao } from './avaliacao.entity';
import { AvaliacaoSessao } from './avaliacao-sessao.entity';
import { Paciente } from '../pacientes/paciente.entity';
import { User } from '../users/user.entity';
import { AvaliacoesService } from './avaliacoes.service';
import { AvaliacoesController } from './avaliacoes.controller';
import { RolesGuard } from '../auth/roles.guard';
import { RealtimeModule } from '../realtime/realtime.module';
import { ObservabilityModule } from '../observability/observability.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Avaliacao, AvaliacaoSessao, Paciente, User]),
    RealtimeModule,
    ObservabilityModule,
    AuditoriaModule
  ],
  providers: [AvaliacoesService, RolesGuard],
  controllers: [AvaliacoesController],
  exports: [AvaliacoesService]
})
export class AvaliacoesModule {}
