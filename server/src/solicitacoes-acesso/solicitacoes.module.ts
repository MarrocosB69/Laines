import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SolicitacaoAcesso } from './solicitacao-acesso.entity';
import { SolicitacoesService } from './solicitacoes.service';
import { SolicitacoesController } from './solicitacoes.controller';
import { RolesGuard } from '../auth/roles.guard';
import { RealtimeModule } from '../realtime/realtime.module';
import { UsersModule } from '../users/users.module';
import { NotificacoesModule } from '../notificacoes/notificacoes.module';

@Module({
  imports: [TypeOrmModule.forFeature([SolicitacaoAcesso]), RealtimeModule, UsersModule, NotificacoesModule],
  providers: [SolicitacoesService, RolesGuard],
  controllers: [SolicitacoesController],
  exports: [SolicitacoesService]
})
export class SolicitacoesModule {}
