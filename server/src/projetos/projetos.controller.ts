import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  NotFoundException,
  ParseUUIDPipe,
  Param,
  Patch,
  Post,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { createReadStream } from 'fs';
import { extname } from 'path';
import type { Response } from 'express';
import { ProjetosService } from './projetos.service';
import { CriarProjetoDto } from './dto/criar-projeto.dto';
import { AtualizarProjetoDto } from './dto/atualizar-projeto.dto';
import { CriarProducaoPesquisaDto } from './dto/criar-producao-pesquisa.dto';
import { AtualizarProducaoPesquisaDto } from './dto/atualizar-producao-pesquisa.dto';
import { CriarIdeiaProjetoDto } from './dto/criar-ideia-projeto.dto';
import { AtualizarIdeiaProjetoDto } from './dto/atualizar-ideia-projeto.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/access-control';
import { MAX_PRODUCTION_BYTES, ProductionUpload } from './producao-upload';

const ALLOWED_RESEARCH_UPLOAD_EXT = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.ppt',
  '.pptx',
  '.xls',
  '.xlsx',
  '.png',
  '.jpg',
  '.jpeg'
]);

@Controller('projetos')
export class ProjetosController {
  constructor(private readonly projetosService: ProjetosService) {}

  @Get('public')
  findPublic() {
    return this.projetosService.findPublic();
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@Req() req: { user: AuthenticatedUser }) {
    return this.projetosService.findAll(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('producoes')
  findProducoes(@Req() req: { user: AuthenticatedUser }) {
    return this.projetosService.findProducoes(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('producoes')
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    fileFilter: (_req, file, cb) => {
      const ext = extname(file.originalname || '').toLowerCase();
      if (!ALLOWED_RESEARCH_UPLOAD_EXT.has(ext)) {
        cb(new HttpException('Formato de arquivo nao permitido.', HttpStatus.BAD_REQUEST), false);
        return;
      }
      cb(null, true);
    },
    limits: {
      fileSize: MAX_PRODUCTION_BYTES
    }
  }))
  createProducao(
    @Req() req: { user: AuthenticatedUser },
    @Body() dto: CriarProducaoPesquisaDto,
    @UploadedFile() file: ProductionUpload | undefined
  ) {
    return this.projetosService.createProducao(dto, file, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('producoes/:id')
  updateProducao(
    @Req() req: { user: AuthenticatedUser },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AtualizarProducaoPesquisaDto
  ) {
    return this.projetosService.updateProducao(id, dto, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('producoes/:id/arquivo/:filename')
  async downloadProducaoArquivo(
    @Req() req: { user: AuthenticatedUser },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('filename') filename: string,
    @Res({ passthrough: true }) response: Response
  ) {
    const attachment = await this.projetosService.resolveProducaoAttachmentDownload(id, filename, req.user);
    response.setHeader('Content-Type', 'application/octet-stream');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(attachment.originalName)}`
    );
    return new StreamableFile(createReadStream(attachment.absolutePath));
  }

  @UseGuards(JwtAuthGuard)
  @Delete('producoes/:id')
  removeProducao(
    @Req() req: { user: AuthenticatedUser },
    @Param('id', new ParseUUIDPipe()) id: string
  ) {
    return this.projetosService.removeProducao(id, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('ideias')
  findIdeias(@Req() req: { user: AuthenticatedUser }) {
    return this.projetosService.findIdeias(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('ideias')
  createIdeia(
    @Req() req: { user: AuthenticatedUser },
    @Body() dto: CriarIdeiaProjetoDto
  ) {
    return this.projetosService.createIdeia(dto, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('ideias/:id/interesse')
  demonstrarInteresseIdeia(
    @Req() req: { user: AuthenticatedUser },
    @Param('id', new ParseUUIDPipe()) id: string
  ) {
    return this.projetosService.setIdeiaInteresse(id, true, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('ideias/:id/interesse')
  removerInteresseIdeia(
    @Req() req: { user: AuthenticatedUser },
    @Param('id', new ParseUUIDPipe()) id: string
  ) {
    return this.projetosService.setIdeiaInteresse(id, false, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('ideias/:id')
  updateIdeia(
    @Req() req: { user: AuthenticatedUser },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AtualizarIdeiaProjetoDto
  ) {
    return this.projetosService.updateIdeia(id, dto, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('ideias/:id')
  removeIdeia(
    @Req() req: { user: AuthenticatedUser },
    @Param('id', new ParseUUIDPipe()) id: string
  ) {
    return this.projetosService.removeIdeia(id, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findOne(
    @Req() req: { user: AuthenticatedUser },
    @Param('id', new ParseUUIDPipe()) id: string
  ) {
    const projeto = await this.projetosService.findById(id, req.user);
    if (!projeto) {
      throw new NotFoundException('Projeto nao encontrado.');
    }
    return projeto;
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Req() req: { user: AuthenticatedUser }, @Body() dto: CriarProjetoDto) {
    return this.projetosService.create(dto, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @Req() req: { user: AuthenticatedUser },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AtualizarProjetoDto
  ) {
    return this.projetosService.update(id, dto, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Req() req: { user: AuthenticatedUser }, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.projetosService.remove(id, req.user);
  }
}
