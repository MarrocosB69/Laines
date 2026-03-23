import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tarefa } from './tarefa.entity';
import { TarefasService } from './tarefas.service';
import { TarefasController } from './tarefas.controller';
import { RolesGuard } from '../auth/roles.guard';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [TypeOrmModule.forFeature([Tarefa]), RealtimeModule],
  providers: [TarefasService, RolesGuard],
  controllers: [TarefasController],
  exports: [TarefasService]
})
export class TarefasModule {}
