import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { AnalyticsRelatoriosExtraController } from './analytics-relatorios-extra.controller';
import { AnalyticsPerfilService } from './analytics-perfil.service';
import { AnalyticsProducaoService } from './analytics-producao.service';
import { User } from '../users/user.entity';
import { Paciente } from '../pacientes/paciente.entity';
import { Avaliacao } from '../avaliacoes/avaliacao.entity';
import { Agendamento } from '../agendamentos/agendamento.entity';
import { Projeto } from '../projetos/projeto.entity';
import { ProjetoIdeia } from '../projetos/projeto-ideia.entity';
import { ProjetoProducao } from '../projetos/projeto-producao.entity';
import { Tarefa } from '../tarefas/tarefa.entity';
import { Conteudo } from '../conteudos/conteudo.entity';
import { ObservabilityModule } from '../observability/observability.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Paciente,
      Avaliacao,
      Agendamento,
      Projeto,
      ProjetoIdeia,
      ProjetoProducao,
      Tarefa,
      Conteudo
    ]),
    ObservabilityModule
  ],
  controllers: [AnalyticsController, AnalyticsRelatoriosExtraController],
  providers: [AnalyticsService, AnalyticsPerfilService, AnalyticsProducaoService],
  exports: [AnalyticsService]
})
export class AnalyticsModule {}
