import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Paciente } from '../pacientes/paciente.entity';
import { User } from '../users/user.entity';
import { Avaliacao } from '../avaliacoes/avaliacao.entity';
import { PublicService } from './public.service';
import { PublicController } from './public.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Paciente, User, Avaliacao])],
  providers: [PublicService],
  controllers: [PublicController]
})
export class PublicModule {}
