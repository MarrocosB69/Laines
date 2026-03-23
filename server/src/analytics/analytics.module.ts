import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { User } from '../users/user.entity';
import { Paciente } from '../pacientes/paciente.entity';
import { Avaliacao } from '../avaliacoes/avaliacao.entity';
import { Agendamento } from '../agendamentos/agendamento.entity';
import { Projeto } from '../projetos/projeto.entity';
import { ObservabilityModule } from '../observability/observability.module';

@Module({
  imports: [TypeOrmModule.forFeature([User, Paciente, Avaliacao, Agendamento, Projeto]), ObservabilityModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService]
})
export class AnalyticsModule {}
