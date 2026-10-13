import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tarefa } from './tarefa.entity';
import { TarefaEvento } from './tarefa-evento.entity';
import { TarefasService } from './tarefas.service';
import { TarefasController } from './tarefas.controller';
import { TarefasReportService } from './tarefas-report.service';
import { TarefasReportController } from './tarefas-report.controller';
import { RolesGuard } from '../auth/roles.guard';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [TypeOrmModule.forFeature([Tarefa, TarefaEvento]), RealtimeModule],
  providers: [TarefasService, TarefasReportService, RolesGuard],
  controllers: [TarefasController, TarefasReportController],
  exports: [TarefasService]
})
export class TarefasModule {}
