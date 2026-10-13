import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/access-control';
import { AvaliacaoImagemService } from './avaliacao-imagem.service';
import { CriarAvaliacaoImagemDto } from './dto/criar-avaliacao-imagem.dto';
import { ConcluirUploadDto } from './dto/concluir-upload.dto';

@Controller('avaliacoes-imagem')
export class AvaliacaoImagemController {
  constructor(
    private readonly service: AvaliacaoImagemService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Put('uploads/local/:token')
  uploadLocal(
    @Param('token') token: string,
    @Req() req: Request & { user: AuthenticatedUser },
    @Headers('content-length') contentLength?: string,
  ) {
    const parsedLength = Number(contentLength);
    return this.service.uploadLocal(
      token,
      req,
      req.user,
      Number.isFinite(parsedLength) ? parsedLength : undefined,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @Req() req: { user: AuthenticatedUser },
    @Body() dto: CriarAvaliacaoImagemDto,
  ) {
    return this.service.create(dto, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/upload-urls')
  uploadUrls(
    @Req() req: { user: AuthenticatedUser },
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.createUploadUrls(id, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/capturas/:captureId/concluir-upload')
  concludeUpload(
    @Req() req: { user: AuthenticatedUser },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('captureId', new ParseUUIDPipe()) captureId: string,
    @Body() dto: ConcluirUploadDto,
  ) {
    return this.service.concludeUpload(id, captureId, dto, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/reprocessar')
  reprocess(
    @Req() req: { user: AuthenticatedUser },
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.reprocess(id, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/status')
  status(
    @Req() req: { user: AuthenticatedUser },
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.status(id, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/resultados')
  results(
    @Req() req: { user: AuthenticatedUser },
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.results(id, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @HttpCode(200)
  remove(
    @Req() req: { user: AuthenticatedUser },
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.remove(id, req.user);
  }
}
