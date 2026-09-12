import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conteudo } from './conteudo.entity';
import { ConteudosService } from './conteudos.service';
import { ConteudosController } from './conteudos.controller';
import { RolesGuard } from '../auth/roles.guard';
import { RealtimeModule } from '../realtime/realtime.module';
import { ConteudoUploadGuard } from './conteudo-upload.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Conteudo]), RealtimeModule],
  providers: [ConteudosService, RolesGuard, ConteudoUploadGuard],
  controllers: [ConteudosController],
  exports: [ConteudosService]
})
export class ConteudosModule {}
