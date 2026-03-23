import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notificacao } from './notificacao.entity';
import { NotificacoesService } from './notificacoes.service';
import { NotificacoesController } from './notificacoes.controller';
import { RolesGuard } from '../auth/roles.guard';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [TypeOrmModule.forFeature([Notificacao]), RealtimeModule],
  providers: [NotificacoesService, RolesGuard],
  controllers: [NotificacoesController],
  exports: [NotificacoesService]
})
export class NotificacoesModule {}
