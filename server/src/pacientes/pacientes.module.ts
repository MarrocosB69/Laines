import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Paciente } from './paciente.entity';
import { User } from '../users/user.entity';
import { Avaliacao } from '../avaliacoes/avaliacao.entity';
import { AvaliacaoSessao } from '../avaliacoes/avaliacao-sessao.entity';
import { PacientesService } from './pacientes.service';
import { PacientesController } from './pacientes.controller';
import { RolesGuard } from '../auth/roles.guard';
import { RealtimeModule } from '../realtime/realtime.module';
import { ObservabilityModule } from '../observability/observability.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [TypeOrmModule.forFeature([Paciente, User, Avaliacao, AvaliacaoSessao]), RealtimeModule, ObservabilityModule, UsersModule],
  providers: [PacientesService, RolesGuard],
  controllers: [PacientesController],
  exports: [PacientesService]
})
export class PacientesModule {}
