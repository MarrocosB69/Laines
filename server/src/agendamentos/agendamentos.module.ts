import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Agendamento } from './agendamento.entity';
import { Paciente } from '../pacientes/paciente.entity';
import { User } from '../users/user.entity';
import { AgendamentosService } from './agendamentos.service';
import { AgendamentosController } from './agendamentos.controller';
import { RolesGuard } from '../auth/roles.guard';
import { RealtimeModule } from '../realtime/realtime.module';
import { ObservabilityModule } from '../observability/observability.module';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Agendamento, Paciente, User]),
    RealtimeModule,
    ObservabilityModule,
    NotificacoesModule,
  ],
  providers: [AgendamentosService, RolesGuard],
  controllers: [AgendamentosController],
  exports: [AgendamentosService]
})
export class AgendamentosModule {}
