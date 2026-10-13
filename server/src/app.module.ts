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
import { SettingsModule } from './settings/settings.module';
import { MetsModule } from './mets/mets.module';
import { TacoModule } from './taco/taco.module';
import { PlanosAlimentaresModule } from './planos-alimentares/planos-alimentares.module';
import { PublicModule } from './public/public.module';
import { MailModule } from './mail/mail.module';
import { AvaliacaoImagemModule } from './avaliacao-imagem/avaliacao-imagem.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['server/.env', '.env'],
      load: [configuration]
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const nodeEnv = String(config.get('nodeEnv') || process.env.NODE_ENV || 'development');
        const dbSync = Boolean(config.get('db.sync'));
        if (nodeEnv === 'production' && dbSync) {
          throw new Error('BLOQUEADO: DB_SYNC=true nao e permitido em producao. Use migrations para alterar o schema.');
        }

        return {
          type: 'postgres',
          host: config.get('db.host'),
          port: config.get('db.port'),
          username: config.get('db.user'),
          password: config.get('db.password'),
          database: config.get('db.name'),
          migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
          migrationsRun: config.get('db.migrationsRun'),
          autoLoadEntities: true,
          synchronize: dbSync,
          logging: config.get('db.logging'),
          extra: {
            max: config.get('db.poolMax'),
            min: config.get('db.poolMin'),
            idleTimeoutMillis: config.get('db.poolIdleTimeoutMs'),
            connectionTimeoutMillis: config.get('db.poolConnectionTimeoutMs')
          }
        };
      }
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
    SettingsModule,
    MetsModule,
    TacoModule,
    PlanosAlimentaresModule,
    ObservabilityModule,
    AnalyticsModule,
    PublicModule,
    MailModule,
    AvaliacaoImagemModule
  ],
  controllers: [AppController],
  providers: [AppService]
})
export class AppModule {}
