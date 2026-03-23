import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Avaliacao } from './avaliacao.entity';
import { Paciente } from '../pacientes/paciente.entity';
import { User } from '../users/user.entity';
import { AvaliacoesService } from './avaliacoes.service';
import { AvaliacoesController } from './avaliacoes.controller';
import { RolesGuard } from '../auth/roles.guard';
import { RealtimeModule } from '../realtime/realtime.module';
import { ObservabilityModule } from '../observability/observability.module';

@Module({
  imports: [TypeOrmModule.forFeature([Avaliacao, Paciente, User]), RealtimeModule, ObservabilityModule],
  providers: [AvaliacoesService, RolesGuard],
  controllers: [AvaliacoesController],
  exports: [AvaliacoesService]
})
export class AvaliacoesModule {}
