import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration from './config/configuration';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { RealtimeModule } from './realtime/realtime.module';
import { ProjetosModule } from './projetos/projetos.module';
import { PacientesModule } from './pacientes/pacientes.module';
import { AvaliacoesModule } from './avaliacoes/avaliacoes.module';
import { AgendamentosModule } from './agendamentos/agendamentos.module';
import { SolicitacoesModule } from './solicitacoes-acesso/solicitacoes.module';
import { AuditoriaModule } from './auditoria/auditoria.module';
import { NotificacoesModule } from './notificacoes/notificacoes.module';
import { TarefasModule } from './tarefas/tarefas.module';
import { ConteudosModule } from './conteudos/conteudos.module';
import { ObservabilityModule } from './observability/observability.module';
import { AnalyticsModule } from './analytics/analytics.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration]
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('db.host'),
        port: config.get('db.port'),
        username: config.get('db.user'),
        password: config.get('db.password'),
        database: config.get('db.name'),
        migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
        migrationsRun: config.get('db.migrationsRun'),
        autoLoadEntities: true,
        synchronize: config.get('db.sync'),
        logging: config.get('db.logging'),
        extra: {
          max: config.get('db.poolMax'),
          min: config.get('db.poolMin'),
          idleTimeoutMillis: config.get('db.poolIdleTimeoutMs'),
          connectionTimeoutMillis: config.get('db.poolConnectionTimeoutMs')
        }
      })
    }),
    UsersModule,
    AuthModule,
    RealtimeModule,
    ProjetosModule,
    PacientesModule,
    AvaliacoesModule,
    AgendamentosModule,
    SolicitacoesModule,
    AuditoriaModule,
    NotificacoesModule,
    TarefasModule,
    ConteudosModule,
    ObservabilityModule,
    AnalyticsModule
  ],
  controllers: [AppController],
  providers: [AppService]
})
export class AppModule {}
