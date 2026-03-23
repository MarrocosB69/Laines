import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Projeto } from './projeto.entity';
import { ProjetosService } from './projetos.service';
import { ProjetosController } from './projetos.controller';
import { RolesGuard } from '../auth/roles.guard';
import { RealtimeModule } from '../realtime/realtime.module';
import { Paciente } from '../pacientes/paciente.entity';
import { User } from '../users/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Projeto, Paciente, User]), RealtimeModule],
  providers: [ProjetosService, RolesGuard],
  controllers: [ProjetosController],
  exports: [ProjetosService]
})
export class ProjetosModule {}
