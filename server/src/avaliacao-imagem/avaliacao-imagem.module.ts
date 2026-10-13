import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Avaliacao } from '../avaliacoes/avaliacao.entity';
import { Paciente } from '../pacientes/paciente.entity';
import { User } from '../users/user.entity';
import { AvaliacoesModule } from '../avaliacoes/avaliacoes.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { AvaliacaoImagemCaptura } from './avaliacao-imagem-captura.entity';
import { AvaliacaoImagemProcessamento } from './avaliacao-imagem-processamento.entity';
import { AvaliacaoImagemController } from './avaliacao-imagem.controller';
import { AvaliacaoImagemService } from './avaliacao-imagem.service';
import { AvaliacaoImagemStorageService } from './avaliacao-imagem-storage.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Avaliacao, AvaliacaoImagemCaptura, AvaliacaoImagemProcessamento, Paciente, User]),
    AvaliacoesModule,
    AuditoriaModule,
  ],
  controllers: [AvaliacaoImagemController],
  providers: [AvaliacaoImagemService, AvaliacaoImagemStorageService],
})
export class AvaliacaoImagemModule {}
