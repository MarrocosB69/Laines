import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { memoryStorage } from 'multer';
import { createReadStream, existsSync } from 'fs';
import { ConteudosService } from './conteudos.service';
import { CriarConteudoDto } from './dto/criar-conteudo.dto';
import { AtualizarConteudoDto } from './dto/atualizar-conteudo.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/access-control';

import { ConteudoUploadGuard } from './conteudo-upload.guard';
import { CONTEUDO_MAX_BYTES } from './conteudo-upload';

@Controller('conteudos')
export class ConteudosController {
  constructor(private readonly conteudosService: ConteudosService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(
    @Req() req: { user: AuthenticatedUser },
    @Query('categoria') categoria?: string,
    @Query('status') status?: string
  ) {
    return this.conteudosService.findAll({ categoria, status }, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Req() req: { user: AuthenticatedUser }, @Body() dto: CriarConteudoDto) {
    return this.conteudosService.create(dto, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @Req() req: { user: AuthenticatedUser },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AtualizarConteudoDto
  ) {
    return this.conteudosService.update(id, dto, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Req() req: { user: AuthenticatedUser }, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.conteudosService.remove(id, req.user);
  }

  @UseGuards(JwtAuthGuard, ConteudoUploadGuard)
  @Post(':id/arquivo')
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: CONTEUDO_MAX_BYTES, files: 1, fields: 0, parts: 2 }
  }))
  async uploadArquivo(
    @Req() req: { user: AuthenticatedUser },
    @Param('id', new ParseUUIDPipe()) id: string,
    @UploadedFile() file: { originalname: string; mimetype: string; buffer: Buffer } | undefined
  ) {
    if (!file) throw new HttpException('Nenhum arquivo enviado.', HttpStatus.BAD_REQUEST);
    return this.conteudosService.anexarArquivo(id, file, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/arquivo')
  async downloadArquivo(
    @Req() req: { user: AuthenticatedUser },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Res({ passthrough: true }) res: Response
  ) {
    const { fullPath, nome, mime } = await this.conteudosService.getArquivoInfo(id, req.user);
    if (!existsSync(fullPath)) throw new NotFoundException('Arquivo nao encontrado no servidor.');
    res.set({
      'Content-Type': mime,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(nome)}`
    });
    return new StreamableFile(createReadStream(fullPath));
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/arquivo')
  removeArquivo(@Req() req: { user: AuthenticatedUser }, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.conteudosService.removerArquivo(id, req.user);
  }
}
