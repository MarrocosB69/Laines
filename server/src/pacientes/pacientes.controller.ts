import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  NotFoundException,
  Res,
  StreamableFile,
  ParseUUIDPipe,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
  UseGuards
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, resolve } from 'path';
import { createReadStream, existsSync, mkdirSync } from 'fs';
import type { Response } from 'express';
import { PacientesService } from './pacientes.service';
import { CriarPacienteDto } from './dto/criar-paciente.dto';
import { AtualizarPacienteDto } from './dto/atualizar-paciente.dto';
import { AtualizarOnboardingAtletaDto } from './dto/atualizar-onboarding-atleta.dto';
import { AdicionarMensagemProfessorDto } from './dto/adicionar-mensagem-professor.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuthenticatedUser } from '../auth/access-control';
import { parsePagination } from '../common/pagination';
import { ADMIN_ROLES, STUDENT_MEMBER_ROLES } from '../common/domain/access.constants';

const ROLES_EDICAO = [
  ...ADMIN_ROLES,
  'coord_atendimento',
  'diretoria_extensao',
  'professor',
  'profissional',
  ...STUDENT_MEMBER_ROLES
];
const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_UPLOAD_MIME = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg'
]);
const ALLOWED_UPLOAD_EXT = new Set(['.pdf', '.png', '.jpg', '.jpeg']);
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Controller('pacientes')
export class PacientesController {
  constructor(private readonly pacientesService: PacientesService) {}

  private static buildUploadDir(pacienteId: string) {
    const uploadsRoot = process.env.UPLOAD_DIR || 'uploads';
    const dir = resolve(process.cwd(), uploadsRoot, 'pacientes', pacienteId, 'anexos');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  private static sanitizeBaseName(filename: string) {
    return filename
      .replace(/\.[^.]+$/, '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w.-]/g, '_')
      .slice(0, 80);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(
    @Req() req: { user: AuthenticatedUser },
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    const { limit: parsedLimit, offset: parsedOffset } = parsePagination({
      limit,
      offset,
      defaultLimit: 200
    });
    return this.pacientesService.findAll(
      req.user,
      parsedLimit,
      parsedOffset
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/onboarding-status')
  onboardingStatus(
    @Req() req: { user: AuthenticatedUser },
    @Param('id', new ParseUUIDPipe()) id: string
  ) {
    return this.pacientesService.getAthleteOnboardingStatus(id, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findOne(
    @Req() req: { user: AuthenticatedUser },
    @Param('id', new ParseUUIDPipe()) id: string
  ) {
    const paciente = await this.pacientesService.findById(id, req.user);
    if (!paciente) {
      throw new NotFoundException('Paciente nao encontrado.');
    }
    return paciente;
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ROLES_EDICAO)
  @Post()
  create(@Req() req: { user: AuthenticatedUser }, @Body() dto: CriarPacienteDto) {
    return this.pacientesService.create(dto, req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ROLES_EDICAO)
  @Patch(':id')
  update(
    @Req() req: { user: AuthenticatedUser },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AtualizarPacienteDto
  ) {
    return this.pacientesService.update(id, dto, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/mensagens-professor')
  addProfessorMessage(
    @Req() req: { user: AuthenticatedUser },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AdicionarMensagemProfessorDto
  ) {
    return this.pacientesService.addProfessorMessage(id, dto, req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('atleta')
  @Patch(':id/onboarding')
  updateOnboarding(
    @Req() req: { user: AuthenticatedUser },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AtualizarOnboardingAtletaDto
  ) {
    return this.pacientesService.updateAthleteOnboarding(id, dto, req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ROLES_EDICAO)
  @Post(':id/anexos')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: (req, _file, cb) => {
        const pacienteId = String(req.params?.id || '');
        if (!UUID_V4_REGEX.test(pacienteId)) {
          cb(new HttpException('Identificador de paciente invalido.', HttpStatus.BAD_REQUEST), '');
          return;
        }
        cb(null, PacientesController.buildUploadDir(pacienteId));
      },
      filename: (_req, file, cb) => {
        const ext = extname(file.originalname || '').toLowerCase();
        const safeBase = PacientesController.sanitizeBaseName(file.originalname || 'arquivo');
        cb(null, `${Date.now()}-${safeBase}${ext}`);
      }
    }),
    fileFilter: (_req, file, cb) => {
      const ext = extname(file.originalname || '').toLowerCase();
      const isValidMime = ALLOWED_UPLOAD_MIME.has(file.mimetype);
      const isValidExt = ALLOWED_UPLOAD_EXT.has(ext);
      if (!isValidMime || !isValidExt) {
        cb(new HttpException('Formato de arquivo nao permitido.', HttpStatus.BAD_REQUEST), false);
        return;
      }
      cb(null, true);
    },
    limits: {
      fileSize: MAX_UPLOAD_SIZE_BYTES
    }
  }))
  async uploadAnexo(
    @Req() req: { user: AuthenticatedUser },
    @Param('id', new ParseUUIDPipe()) id: string,
    @UploadedFile() file: { filename: string; originalname: string; mimetype: string; size: number } | undefined
  ) {
    if (!file) {
      throw new HttpException('Arquivo obrigatorio.', HttpStatus.BAD_REQUEST);
    }
    return this.pacientesService.addAttachment(id, file, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/anexos/:filename')
  async downloadAnexo(
    @Req() req: { user: AuthenticatedUser },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('filename') filename: string,
    @Res({ passthrough: true }) response: Response
  ) {
    const attachment = await this.pacientesService.resolveAttachmentDownload(id, filename, req.user);
    response.setHeader('Content-Type', attachment.mimeType);
    response.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(attachment.originalName)}`
    );
    return new StreamableFile(createReadStream(attachment.absolutePath));
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ROLES_EDICAO)
  @Delete(':id/anexos/:filename')
  removeAnexo(
    @Req() req: { user: AuthenticatedUser },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('filename') filename: string
  ) {
    return this.pacientesService.removeAttachment(id, filename, req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.pacientesService.remove(id);
  }
}
