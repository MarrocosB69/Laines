import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { existsSync, mkdirSync, unlinkSync, writeFileSync, rmdirSync, openSync, closeSync } from 'fs';
import { randomUUID } from 'crypto';
import { join, dirname } from 'path';
import { assertConteudoId, containedConteudoPath, conteudosRoot, validateConteudoFile } from './conteudo-upload';
import { Conteudo } from './conteudo.entity';
import { CriarConteudoDto } from './dto/criar-conteudo.dto';
import { AtualizarConteudoDto } from './dto/atualizar-conteudo.dto';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { AuthenticatedUser, isStudentMemberRole, normalizeRole } from '../auth/access-control';
import { ADMIN_ROLES, getDiretoriaPermissionSource } from '../common/domain/access.constants';

type FiltrosConteudo = {
  categoria?: string;
  status?: string;
};

type UploadedFileInfo = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
};

const CONTENT_GLOBAL_ROLES = new Set<string>([
  ...ADMIN_ROLES
]);

const CONTENT_DEFAULT_STATUS = 'em_andamento';
const CONTENT_VISIBLE_STATUSES = ['publicado', 'aprovado', 'em_andamento'];
const CONTENT_APPROVAL_STATUSES = new Set(['aprovado', 'publicado']);
const CONTENT_VALID_STATUSES = new Set([
  'rascunho',
  'em_andamento',
  'pendente_aprovacao',
  'aprovado',
  'publicado',
  'arquivado'
]);

const CONTENT_AREA_RULES: Record<string, {
  roles: string[];
}> = {
  comunicados_pesquisa: {
    roles: ['diretoria_pesquisa']
  },
  materiais_pesquisa: {
    roles: ['diretoria_pesquisa']
  },
  reunioes_cientificas: {
    roles: ['diretoria_ensino']
  },
  materiais_ensino: {
    roles: ['diretoria_ensino']
  },
  capacitacoes: {
    roles: ['diretoria_extensao']
  },
  materiais_extensao: {
    roles: ['diretoria_extensao']
  },
  comunicados_marketing: {
    roles: ['diretoria_marketing']
  },
  materiais_marketing: {
    roles: ['diretoria_marketing']
  }
};

@Injectable()
export class ConteudosService {
  constructor(
    @InjectRepository(Conteudo) private repo: Repository<Conteudo>,
    private realtime: RealtimeGateway
  ) {}

  private normalizePayload<T extends { [key: string]: any }>(payload: T) {
    const normalizeText = (value?: string) => {
      if (value === undefined || value === null) return undefined;
      const trimmed = String(value).trim();
      return trimmed.length ? trimmed : undefined;
    };

    const cursos = Array.isArray(payload.cursos)
      ? payload.cursos.map((item) => String(item).trim()).filter(Boolean)
      : undefined;

    const autores = this.normalizeTextArray(payload.autores);
    const equipeOrganizacao = this.normalizeTextArray(payload.equipeOrganizacao);

    return {
      ...payload,
      data: normalizeText(payload.data),
      link: normalizeText(payload.link),
      descricao: normalizeText(payload.descricao),
      tipo: normalizeText(payload.tipo),
      publico: normalizeText(payload.publico),
      profissionalNome: normalizeText(payload.profissionalNome),
      profissionalCredencial: normalizeText(payload.profissionalCredencial),
      cursos: cursos && cursos.length ? cursos : undefined,
      autores: autores.length ? autores : undefined,
      equipeOrganizacao: equipeOrganizacao.length ? equipeOrganizacao : undefined
    };
  }

  private normalizeTextArray(value: unknown) {
    if (!Array.isArray(value)) return [];
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  private normalizeConteudoStatus(status?: string | null) {
    const normalized = String(status || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s-]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');

    const aliases: Record<string, string> = {
      andamento: 'em_andamento',
      em_progresso: 'em_andamento',
      pendente: 'pendente_aprovacao',
      pendente_de_aprovacao: 'pendente_aprovacao',
      aprovado_publicado: 'publicado'
    };

    return aliases[normalized] || normalized;
  }

  private deleteFileIfExists(relativePath?: string | null) {
    if (!relativePath) return;
    const fullPath = containedConteudoPath(relativePath);
    if (existsSync(fullPath)) {
      try { unlinkSync(fullPath); } catch { /* ignore */ }
    }
  }

  private isGlobalContentManager(user?: AuthenticatedUser) {
    const role = normalizeRole(user?.role);
    return CONTENT_GLOBAL_ROLES.has(role);
  }

  private canManageConteudo(user: AuthenticatedUser | undefined, categoria?: string | null) {
    const role = normalizeRole(user?.role);
    if (this.isGlobalContentManager(user)) return true;

    const normalizedCategoria = String(categoria || '').trim();
    const rule = CONTENT_AREA_RULES[normalizedCategoria];
    if (!rule) return false;

    const diretoria = getDiretoriaPermissionSource(user || {});
    if (rule.roles.includes(role)) return true;
    if (isStudentMemberRole(role) && diretoria && rule.roles.includes(diretoria)) return true;
    return false;
  }

  private getManageableCategories(user?: AuthenticatedUser) {
    if (this.isGlobalContentManager(user)) return Object.keys(CONTENT_AREA_RULES);
    const role = normalizeRole(user?.role);
    const diretoria = getDiretoriaPermissionSource(user || {});

    return Object.entries(CONTENT_AREA_RULES)
      .filter(([, rule]) => (
        rule.roles.includes(role)
        || Boolean(isStudentMemberRole(role) && diretoria && rule.roles.includes(diretoria))
      ))
      .map(([categoria]) => categoria);
  }

  private assertCanManageConteudo(user: AuthenticatedUser, categoria?: string | null) {
    if (this.canManageConteudo(user, categoria)) return;

    throw new ForbiddenException('Sem permissao para editar conteudo desta area.');
  }

  private assertValidStatus(status: string) {
    if (!CONTENT_VALID_STATUSES.has(status)) {
      throw new ForbiddenException('Status de conteudo invalido.');
    }
  }

  private assertCanApplyStatus(user: AuthenticatedUser, status: string) {
    this.assertValidStatus(status);
    if (CONTENT_APPROVAL_STATUSES.has(status) && !this.isGlobalContentManager(user)) {
      throw new ForbiddenException('Apenas a coordenacao pode aprovar ou publicar conteudos.');
    }
  }

  private resolveCreateStatus(user: AuthenticatedUser, rawStatus?: string) {
    const status = this.normalizeConteudoStatus(rawStatus) || CONTENT_DEFAULT_STATUS;
    this.assertCanApplyStatus(user, status);
    return status;
  }

  private resolveUpdateStatus(user: AuthenticatedUser, rawStatus?: string) {
    if (rawStatus === undefined || rawStatus === null) return undefined;
    const status = this.normalizeConteudoStatus(rawStatus);
    this.assertCanApplyStatus(user, status);
    return status;
  }

  private getActorName(user?: AuthenticatedUser) {
    return user?.name || user?.email || 'Equipe LAINES';
  }

  private applyApprovalMetadata(
    payload: Partial<Conteudo>,
    status: string | undefined,
    user: AuthenticatedUser,
    previousStatus?: string
  ) {
    if (!status || status === previousStatus) return payload;
    if (!CONTENT_APPROVAL_STATUSES.has(status)) return payload;

    const now = new Date();
    payload.aprovadoPorId = user?.id;
    payload.aprovadoPorNome = this.getActorName(user);
    payload.aprovadoEm = now;
    if (status === 'publicado') {
      payload.publicadoEm = now;
    }
    return payload;
  }

  private assertCanViewConteudo(user: AuthenticatedUser | undefined, conteudo: Conteudo) {
    if (this.canManageConteudo(user, conteudo.categoria)) return;
    const status = this.normalizeConteudoStatus(conteudo.status);
    if (CONTENT_VISIBLE_STATUSES.includes(status)) return;
    throw new ForbiddenException('Conteudo indisponivel para este perfil.');
  }

  findAll(filtros: FiltrosConteudo, user?: AuthenticatedUser) {
    const qb = this.repo.createQueryBuilder('conteudo')
      .orderBy('conteudo.createdAt', 'DESC');

    if (filtros.categoria) {
      qb.andWhere('conteudo.categoria = :categoria', { categoria: filtros.categoria });
    }

    if (filtros.status) {
      qb.andWhere('conteudo.status = :status', { status: this.normalizeConteudoStatus(filtros.status) });
    }

    if (!this.isGlobalContentManager(user)) {
      const manageableCategories = this.getManageableCategories(user);
      qb.andWhere(new Brackets((scope) => {
        scope.where('conteudo.status IN (:...visibleStatuses)', { visibleStatuses: CONTENT_VISIBLE_STATUSES });
        if (manageableCategories.length > 0) {
          scope.orWhere('conteudo.categoria IN (:...manageableCategories)', { manageableCategories });
        }
      }));
    }

    return qb.getMany();
  }

  findById(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  async create(dto: CriarConteudoDto, user: AuthenticatedUser) {
    this.assertCanManageConteudo(user, dto.categoria);
    const status = this.resolveCreateStatus(user, dto.status);
    const payload = this.applyApprovalMetadata({
      ...this.normalizePayload(dto),
      status,
      criadoPorId: user?.id,
      criadoPorNome: this.getActorName(user)
    }, status, user) as Partial<Conteudo>;
    const conteudo = this.repo.create(payload);
    const saved = await this.repo.save(conteudo);
    this.realtime.emit('conteudos.created', saved);
    return saved;
  }

  async update(id: string, dto: AtualizarConteudoDto, user: AuthenticatedUser) {
    const conteudo = await this.findById(id);
    if (!conteudo) {
      throw new NotFoundException('Conteudo nao encontrado.');
    }
    this.assertCanManageConteudo(user, conteudo.categoria);
    if (dto.categoria && dto.categoria !== conteudo.categoria) {
      this.assertCanManageConteudo(user, dto.categoria);
    }
    const nextStatus = this.resolveUpdateStatus(user, dto.status);
    const payload = this.applyApprovalMetadata({
      ...this.normalizePayload(dto),
      ...(nextStatus ? { status: nextStatus } : {})
    }, nextStatus, user, conteudo.status) as Partial<Conteudo>;
    const merged = this.repo.merge(conteudo, payload);
    const saved = await this.repo.save(merged);
    this.realtime.emit('conteudos.updated', saved);
    return saved;
  }

  async remove(id: string, user: AuthenticatedUser) {
    const conteudo = await this.findById(id);
    if (!conteudo) {
      throw new NotFoundException('Conteudo nao encontrado.');
    }
    this.assertCanManageConteudo(user, conteudo.categoria);
    this.deleteFileIfExists(conteudo.arquivoPath);
    await this.repo.delete(id);
    this.realtime.emit('conteudos.deleted', { id });
    return { success: true };
  }

  async assertCanUpload(id: string, user: AuthenticatedUser) {
    assertConteudoId(id);
    const conteudo = await this.findById(id);
    if (!conteudo) throw new NotFoundException('Conteudo nao encontrado.');
    this.assertCanManageConteudo(user, conteudo.categoria);
    return conteudo;
  }

  async anexarArquivo(id: string, file: UploadedFileInfo, user: AuthenticatedUser) {
    // Recheck at the write boundary even when called without the HTTP guard.
    const conteudo = await this.assertCanUpload(id, user);
    const { ext, mime } = validateConteudoFile(file);
    const filename = `${randomUUID()}${ext}`;
    const fullPath = containedConteudoPath(join(conteudosRoot(), id, filename));
    const storedPath = join(process.env.UPLOAD_DIR || 'uploads', 'conteudos', id, filename);
    const previousPath = conteudo.arquivoPath;
    if (previousPath) containedConteudoPath(previousPath);
    const directory = dirname(fullPath);
    mkdirSync(directory, { recursive: true });
    let created = false;
    let descriptor: number | undefined;
    let saved: Conteudo;
    try {
      containedConteudoPath(fullPath);
      descriptor = openSync(fullPath, 'wx', 0o600);
      created = true;
      writeFileSync(descriptor, file.buffer);
      closeSync(descriptor);
      descriptor = undefined;
      saved = await this.repo.save(this.repo.merge(conteudo, {
        arquivoPath: storedPath,
        arquivoNome: file.originalname,
        arquivoMime: mime
      }));
    } catch (error) {
      if (descriptor !== undefined) closeSync(descriptor);
      if (created) this.deleteFileIfExists(fullPath);
      try { rmdirSync(directory); } catch { /* Keep directories containing existing files. */ }
      throw error;
    }
    // Preserve the old attachment if persistence of its replacement fails.
    if (previousPath && previousPath !== fullPath) this.deleteFileIfExists(previousPath);
    this.realtime.emit('conteudos.updated', saved);
    return saved;
  }

  async getArquivoInfo(id: string, user?: AuthenticatedUser) {
    const conteudo = await this.findById(id);
    if (!conteudo) throw new NotFoundException('Conteudo nao encontrado.');
    this.assertCanViewConteudo(user, conteudo);
    if (!conteudo.arquivoPath) throw new NotFoundException('Nenhum arquivo anexado a este conteudo.');
    return {
      fullPath: containedConteudoPath(conteudo.arquivoPath),
      nome: conteudo.arquivoNome || 'arquivo',
      mime: conteudo.arquivoMime || 'application/octet-stream'
    };
  }

  async removerArquivo(id: string, user: AuthenticatedUser) {
    const conteudo = await this.findById(id);
    if (!conteudo) throw new NotFoundException('Conteudo nao encontrado.');
    this.assertCanManageConteudo(user, conteudo.categoria);
    if (conteudo.arquivoPath) containedConteudoPath(conteudo.arquivoPath);
    await this.repo.createQueryBuilder()
      .update(Conteudo)
      .set({ arquivoPath: () => 'NULL', arquivoNome: () => 'NULL', arquivoMime: () => 'NULL' })
      .where('id = :id', { id })
      .execute();
    this.deleteFileIfExists(conteudo.arquivoPath);
    const updated = await this.findById(id);
    this.realtime.emit('conteudos.updated', updated);
    return { success: true };
  }

}
