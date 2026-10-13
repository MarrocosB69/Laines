import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository, SelectQueryBuilder } from 'typeorm';
import { randomUUID } from 'crypto';
import { access, mkdir, unlink, writeFile } from 'fs/promises';
import { constants as fsConstants } from 'fs';
import { basename, dirname, extname } from 'path';
import { productionUploadPath, ProductionUpload, validateProductionUpload } from './producao-upload';
import { Projeto } from './projeto.entity';
import { ProjetoProducao } from './projeto-producao.entity';
import { ProjetoIdeia, type ProjetoIdeiaInteresse } from './projeto-ideia.entity';
import { CriarProjetoDto } from './dto/criar-projeto.dto';
import { AtualizarProjetoDto } from './dto/atualizar-projeto.dto';
import { CriarProducaoPesquisaDto } from './dto/criar-producao-pesquisa.dto';
import { AtualizarProducaoPesquisaDto } from './dto/atualizar-producao-pesquisa.dto';
import { CriarIdeiaProjetoDto } from './dto/criar-ideia-projeto.dto';
import { AtualizarIdeiaProjetoDto } from './dto/atualizar-ideia-projeto.dto';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { Paciente } from '../pacientes/paciente.entity';
import { User } from '../users/user.entity';
import { Avaliacao } from '../avaliacoes/avaliacao.entity';
import {
  AuthenticatedUser,
  hasTeamScopedAccess,
  isStudentMemberRole,
  normalizeRole
} from '../auth/access-control';
import { ADMIN_ROLES, DIRETORIA_ROLES, getDiretoriaPermissionSource } from '../common/domain/access.constants';

const RESEARCH_ADMIN_ROLES = new Set<string>([
  ...ADMIN_ROLES,
  'diretoria_pesquisa'
]);

const PROJECT_INTERNAL_READ_ROLES = new Set<string>([
  'coord_atendimento',
  ...DIRETORIA_ROLES.filter((role) => role !== 'diretoria_pesquisa')
]);

@Injectable()
export class ProjetosService {
  constructor(
    @InjectRepository(Projeto) private repo: Repository<Projeto>,
    @InjectRepository(ProjetoProducao) private producoesRepo: Repository<ProjetoProducao>,
    @InjectRepository(ProjetoIdeia) private ideiasRepo: Repository<ProjetoIdeia>,
    @InjectRepository(Paciente) private pacientesRepo: Repository<Paciente>,
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(Avaliacao) private avaliacoesRepo: Repository<Avaliacao>,
    private config: ConfigService,
    private realtime: RealtimeGateway
  ) {}

  private normalizeText(value: unknown, max = 500) {
    const text = String(value ?? '').trim();
    return text ? text.slice(0, max) : undefined;
  }

  private normalizeArray(value: unknown) {
    if (!Array.isArray(value)) return [];
    return Array.from(new Set(
      value
        .map((item) => String(item || '').trim())
        .filter(Boolean)
    ));
  }

  private normalizeIdeaInteresses(value: unknown): ProjetoIdeiaInteresse[] {
    if (!Array.isArray(value)) return [];
    const seen = new Set<string>();
    return value.reduce<ProjetoIdeiaInteresse[]>((acc, item) => {
      if (!item || typeof item !== 'object') return acc;
      const record = item as Record<string, unknown>;
      const id = this.normalizeText(record.id || record.userId, 80);
      if (!id || seen.has(id)) return acc;
      seen.add(id);
      acc.push({
        id,
        nome: this.normalizeText(record.nome || record.name, 120) || 'Membro da liga',
        email: this.normalizeText(record.email, 180),
        role: this.normalizeText(record.role, 60),
        criadoEm: this.normalizeText(record.criadoEm || record.createdAt, 80) || new Date().toISOString()
      });
      return acc;
    }, []);
  }

  private toIdeaProjection(item: ProjetoIdeia) {
    return {
      ...item,
      interesses: this.normalizeIdeaInteresses(item.interesses)
    };
  }

  private canManageResearch(user: AuthenticatedUser) {
    const role = normalizeRole(user?.role);
    const diretoria = getDiretoriaPermissionSource(user || {});

    return RESEARCH_ADMIN_ROLES.has(role)
      || (isStudentMemberRole(role) && diretoria === 'diretoria_pesquisa');
  }

  private canRegisterIdeaInterest(user: AuthenticatedUser) {
    const role = normalizeRole(user?.role);
    return isStudentMemberRole(role) || (DIRETORIA_ROLES as readonly string[]).includes(role);
  }

  private isProjectStudent(project: Projeto | null | undefined, user: AuthenticatedUser) {
    const userId = String(user?.id || '').trim();
    return Boolean(userId && Array.isArray(project?.alunosIds) && project.alunosIds.includes(userId));
  }

  private toParticipantProjectProjection(project: Projeto) {
    return {
      id: project.id,
      nome: project.nome,
      status: project.status
    };
  }

  private toInternalReadProjectProjection(project: Projeto) {
    return {
      id: project.id,
      nome: project.nome,
      area: project.area,
      status: project.status,
      coordenador: project.coordenador || null,
      descricao: project.descricao || null,
      equipe: Array.isArray(project.equipe) ? project.equipe : [],
      alunosNomes: Array.isArray(project.alunosNomes) ? project.alunosNomes : [],
      createdAt: project.createdAt,
      updatedAt: project.updatedAt
    };
  }

  private sanitizeAttachmentFilename(filename: string) {
    const raw = String(filename || '').trim();
    const safe = basename(raw);
    if (!safe || safe !== raw || !/^[\w.\-]+$/.test(safe)) {
      throw new BadRequestException('Nome de arquivo invalido.');
    }
    return safe;
  }

  private resolveAttachmentMimeType(filename: string, fallback?: string) {
    if (fallback && String(fallback).trim()) return fallback;
    const ext = extname(filename || '').toLowerCase();
    const map: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg'
    };
    return map[ext] || 'application/octet-stream';
  }

  private buildProductionFilePayload(
    projetoId: string | undefined,
    producaoId: string,
    file: { filename: string; originalname: string; mimetype: string; size: number },
    user: AuthenticatedUser
  ) {
    const bucket = projetoId || 'geral';
    const relativePath = `projetos/${bucket}/producoes/${file.filename}`;
    const downloadPath = `/projetos/producoes/${producaoId}/arquivo/${encodeURIComponent(file.filename)}`;
    const uploadsBaseUrl = String(this.config.get('uploads.baseUrl') || '').replace(/\/+$/, '');

    return {
      id: randomUUID(),
      name: file.originalname,
      filename: file.filename,
      type: file.mimetype,
      size: file.size,
      path: relativePath,
      url: uploadsBaseUrl ? `${uploadsBaseUrl}${downloadPath}` : downloadPath,
      uploadedAt: new Date().toISOString(),
      uploadedBy: {
        id: user.id || '',
        nome: user.name || user.email || 'Usuario'
      }
    };
  }

  private buildProductionAttachmentAbsolutePath(relativePath: string) {
    const uploadsRoot = String(this.config.get('uploads.dir') || 'uploads');
    return productionUploadPath(uploadsRoot, relativePath);
  }

  private async fileExists(filePath: string) {
    try {
      await access(filePath, fsConstants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  private isProductionVisible(
    item: ProjetoProducao,
    user: AuthenticatedUser,
    scopedProjectIds: string[]
  ) {
    if (this.canManageResearch(user)) return true;
    const visibility = String(item.visibilidade || 'interno_laines');
    if (visibility === 'restrito') return false;
    const status = String(item.status || '').toLowerCase();
    if (status === 'publicado' && ['interno_laines', 'publico'].includes(visibility)) {
      return true;
    }
    return Boolean(item.projetoId && scopedProjectIds.includes(item.projetoId));
  }

  private async syncProjectNameDenormalizations(projectId: string, projectName?: string | null) {
    const normalizedProjectId = String(projectId || '').trim();
    if (!normalizedProjectId) return;
    const normalizedProjectName = String(projectName || '').trim() || undefined;

    await Promise.all([
      this.usersRepo.createQueryBuilder()
        .update(User)
        .set({
          projetoNome: normalizedProjectName
        })
        .where('projeto_id = :projectId', { projectId: normalizedProjectId })
        .execute(),
      this.pacientesRepo.createQueryBuilder()
        .update(Paciente)
        .set({
          projetoNome: normalizedProjectName
        })
        .where('projeto_id = :projectId', { projectId: normalizedProjectId })
        .execute(),
      this.avaliacoesRepo.createQueryBuilder()
        .update(Avaliacao)
        .set({
          projetoNome: normalizedProjectName
        })
        .where('projeto_id = :projectId', { projectId: normalizedProjectId })
        .execute()
    ]);
  }

  private async validarLimiteAlunos(alunosIds: string[] | undefined, projetoId?: string) {
    const ids = Array.from(new Set((alunosIds || []).filter(Boolean)));
    if (ids.length === 0) return;

    const excedidos: string[] = [];
    for (const alunoId of ids) {
      const qb = this.repo.createQueryBuilder('projeto')
        .where(':alunoId = ANY(projeto.alunosIds)', { alunoId });
      if (projetoId) {
        qb.andWhere('projeto.id <> :projetoId', { projetoId });
      }
      const count = await qb.getCount();
      if (count >= 2) {
        excedidos.push(alunoId);
      }
    }

    if (excedidos.length > 0) {
      throw new BadRequestException(
        `Alunos ja vinculados ao limite de projetos: ${excedidos.join(', ')}`
      );
    }
  }

  private findByIdRaw(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  private async resolveLinkedProjectId(userId?: string) {
    if (!userId) return null;
    const user = await this.usersRepo.findOne({
      where: { id: userId },
      select: {
        id: true,
        projetoId: true
      }
    });
    return user?.projetoId || null;
  }

  private async resolveScopedProjectsFromPatientAccess(userId: string) {
    const rows = await this.pacientesRepo.createQueryBuilder('paciente')
      .select('DISTINCT paciente.projetoId', 'projetoId')
      .where('paciente.projetoId IS NOT NULL')
      .andWhere(
        '(paciente.professorSupervisorId = :userId OR paciente.alunoResponsavelId = :userId OR :userId = ANY(COALESCE(paciente.equipeTecnicaIds, ARRAY[]::uuid[])) OR :userId = ANY(COALESCE(paciente.equipeMultiIds, ARRAY[]::uuid[])))',
        { userId }
      )
      .getRawMany<{ projetoId: string | null }>();

    return rows
      .map((row) => String(row.projetoId || '').trim())
      .filter(Boolean);
  }

  private async buildTeamScopeProjectIds(user: AuthenticatedUser) {
    const userId = String(user?.id || '').trim();
    if (!userId) return [];

    const [linkedProjectId, patientProjectIds] = await Promise.all([
      this.resolveLinkedProjectId(userId),
      this.resolveScopedProjectsFromPatientAccess(userId)
    ]);
    const merged = new Set<string>(patientProjectIds);
    if (linkedProjectId) {
      merged.add(linkedProjectId);
    }
    return Array.from(merged);
  }

  private applyTeamScope(
    qb: SelectQueryBuilder<Projeto>,
    user: AuthenticatedUser,
    scopedProjectIds: string[]
  ) {
    const userId = String(user?.id || '').trim();
    if (!userId) {
      qb.andWhere('1 = 0');
      return;
    }

    qb.andWhere(new Brackets((scopeQb) => {
      scopeQb.where('projeto.coordenadorId = :userId', { userId });
      scopeQb.orWhere(':userId = ANY(COALESCE(projeto.alunosIds, ARRAY[]::uuid[]))', { userId });
      if (scopedProjectIds.length > 0) {
        scopeQb.orWhere('projeto.id IN (:...scopedProjectIds)', {
          scopedProjectIds
        });
      }
    }));
  }

  async findAll(user: AuthenticatedUser) {
    const role = normalizeRole(user?.role);
    if (this.canManageResearch(user)) {
      return this.repo.find({ order: { createdAt: 'DESC' } });
    }

    if (isStudentMemberRole(role) || role === 'atleta') {
      const projects = await this.repo.find({ order: { createdAt: 'DESC' } });
      return projects.map((project) => this.toParticipantProjectProjection(project));
    }

    if (PROJECT_INTERNAL_READ_ROLES.has(role)) {
      const projects = await this.repo.find({ order: { createdAt: 'DESC' } });
      return projects.map((project) => this.toInternalReadProjectProjection(project));
    }

    if (!hasTeamScopedAccess(role)) {
      throw new ForbiddenException('Sem permissao para listar projetos.');
    }

    const scopedProjectIds = await this.buildTeamScopeProjectIds(user);
    const qb = this.repo.createQueryBuilder('projeto')
      .orderBy('projeto.createdAt', 'DESC');
    this.applyTeamScope(qb, user, scopedProjectIds);
    return qb.getMany();
  }

  findPublic() {
    return this.repo.find({
      select: {
        id: true,
        nome: true,
        status: true
      },
      order: { nome: 'ASC' }
    });
  }

  async findById(id: string, user: AuthenticatedUser) {
    const role = normalizeRole(user?.role);
    if (this.canManageResearch(user)) {
      return this.findByIdRaw(id);
    }

    if (isStudentMemberRole(role) || role === 'atleta') {
      const project = await this.findByIdRaw(id);
      if (!project) return null;
      return this.toParticipantProjectProjection(project);
    }

    if (PROJECT_INTERNAL_READ_ROLES.has(role)) {
      const project = await this.findByIdRaw(id);
      return project ? this.toInternalReadProjectProjection(project) : null;
    }

    if (!hasTeamScopedAccess(role)) {
      throw new ForbiddenException('Sem permissao para consultar projeto.');
    }

    const scopedProjectIds = await this.buildTeamScopeProjectIds(user);
    const qb = this.repo.createQueryBuilder('projeto')
      .where('projeto.id = :id', { id });
    this.applyTeamScope(qb, user, scopedProjectIds);
    return qb.getOne();
  }

  async create(dto: CriarProjetoDto, user: AuthenticatedUser) {
    if (!this.canManageResearch(user)) {
      throw new ForbiddenException('Sem permissao para cadastrar projetos de pesquisa.');
    }
    await this.validarLimiteAlunos(dto.alunosIds);
    const projeto = this.repo.create({
      ...dto,
      area: dto.area || 'nutricao',
      status: dto.status || 'planejamento',
      equipe: dto.equipe || [],
      alunosIds: dto.alunosIds || [],
      alunosNomes: dto.alunosNomes || []
    });
    const saved = await this.repo.save(projeto);
    this.realtime.emit('projetos.created', saved);
    return saved;
  }

  async update(id: string, dto: AtualizarProjetoDto, user: AuthenticatedUser) {
    if (!this.canManageResearch(user)) {
      throw new ForbiddenException('Sem permissao para atualizar projetos de pesquisa.');
    }
    const projeto = await this.findByIdRaw(id);
    if (!projeto) {
      throw new NotFoundException('Projeto nao encontrado.');
    }
    await this.validarLimiteAlunos(dto.alunosIds, id);
    const payload: Partial<Projeto> = { ...dto };
    await this.repo.update(id, payload);
    const updated = await this.findByIdRaw(id);
    if (updated) {
      if (Object.prototype.hasOwnProperty.call(dto, 'nome')) {
        await this.syncProjectNameDenormalizations(updated.id, updated.nome);
      }
      this.realtime.emit('projetos.updated', updated);
    }
    return updated;
  }

  async findProducoes(user: AuthenticatedUser) {
    const scopedProjectIds = await this.buildTeamScopeProjectIds(user);
    const items = await this.producoesRepo.find({
      order: { createdAt: 'DESC' }
    });
    return items.filter((item) => this.isProductionVisible(item, user, scopedProjectIds));
  }

  async createProducao(
    dto: CriarProducaoPesquisaDto,
    file: ProductionUpload | undefined,
    user: AuthenticatedUser
  ) {
    if (!this.canManageResearch(user)) {
      throw new ForbiddenException('Apenas coordenacao ou diretoria de pesquisa podem cadastrar producoes.');
    }
    const projectId = this.normalizeText(dto.projetoId, 80);
    const project = projectId ? await this.findByIdRaw(projectId) : null;
    if (projectId && !project) {
      throw new NotFoundException('Projeto nao encontrado.');
    }
    if (!file && !this.normalizeText(dto.linkExterno, 500)) {
      throw new BadRequestException('Informe um arquivo ou link para a producao.');
    }

    const entity = this.producoesRepo.create({
      projetoId: project?.id,
      projetoNome: project?.nome,
      titulo: this.normalizeText(dto.titulo, 200) || 'Producao sem titulo',
      tipo: this.normalizeText(dto.tipo, 60) || 'documento',
      descricao: this.normalizeText(dto.descricao, 2000),
      autores: this.normalizeArray(dto.autores),
      ano: Number.isFinite(Number(dto.ano)) ? Number(dto.ano) : undefined,
      area: this.normalizeText(dto.area || project?.area, 60),
      status: this.normalizeText(dto.status, 40) || 'em_revisao',
      visibilidade: this.normalizeText(dto.visibilidade, 40) || 'interno_laines',
      linkExterno: this.normalizeText(dto.linkExterno, 500),
      criadoPorId: user.id || undefined,
      criadoPorNome: user.name || user.email || undefined
    });

    const prepared = this.producoesRepo.create(entity);
    prepared.id = prepared.id || randomUUID();
    let storedPath: string | undefined;
    if (file) {
      const { ext, mime } = validateProductionUpload(file);
      const filename = `${randomUUID()}${ext}`;
      storedPath = `projetos/${project?.id || 'geral'}/producoes/${filename}`;
      const absolutePath = this.buildProductionAttachmentAbsolutePath(storedPath);
      await mkdir(dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, file.buffer, { flag: 'wx' });
      prepared.arquivo = this.buildProductionFilePayload(project?.id, prepared.id, {
        filename, originalname: file.originalname, mimetype: mime, size: file.buffer.length
      }, user);
    }

    try {
      const saved = await this.producoesRepo.save(prepared);
      this.realtime.emit('projetos.producoes.created', saved);
      return saved;
    } catch (error) {
      if (storedPath) {
        try {
          const absolutePath = this.buildProductionAttachmentAbsolutePath(storedPath);
          if (await this.fileExists(absolutePath)) {
            await unlink(absolutePath);
          }
        } catch {
          // Mantem o erro de persistencia como causa principal.
        }
      }
      throw error;
    }
  }

  async updateProducao(id: string, dto: AtualizarProducaoPesquisaDto, user: AuthenticatedUser) {
    if (!this.canManageResearch(user)) {
      throw new ForbiddenException('Sem permissao para revisar producoes.');
    }
    const item = await this.producoesRepo.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException('Producao nao encontrada.');
    }
    const projectId = this.normalizeText(dto.projetoId || item.projetoId, 80);
    const project = projectId ? await this.findByIdRaw(projectId) : null;
    if (projectId && !project) {
      throw new NotFoundException('Projeto nao encontrado.');
    }

    const status = this.normalizeText(dto.status, 40);
    const payload: Partial<ProjetoProducao> = {
      projetoId: project?.id,
      projetoNome: project?.nome,
      titulo: this.normalizeText(dto.titulo, 200) || item.titulo,
      tipo: this.normalizeText(dto.tipo, 60) || item.tipo,
      descricao: Object.prototype.hasOwnProperty.call(dto, 'descricao')
        ? this.normalizeText(dto.descricao, 2000)
        : item.descricao,
      autores: Object.prototype.hasOwnProperty.call(dto, 'autores')
        ? this.normalizeArray(dto.autores)
        : item.autores,
      ano: Object.prototype.hasOwnProperty.call(dto, 'ano')
        ? (Number.isFinite(Number(dto.ano)) ? Number(dto.ano) : undefined)
        : item.ano,
      area: this.normalizeText(dto.area || project?.area, 60) || item.area,
      status: status || item.status,
      visibilidade: this.normalizeText(dto.visibilidade, 40) || item.visibilidade,
      linkExterno: Object.prototype.hasOwnProperty.call(dto, 'linkExterno')
        ? this.normalizeText(dto.linkExterno, 500)
        : item.linkExterno
    };

    if (status === 'publicado' && item.status !== 'publicado') {
      payload.validadoPorId = user.id || undefined;
      payload.validadoPorNome = user.name || user.email || undefined;
      payload.validadoEm = new Date();
    }

    const updated = await this.producoesRepo.save(this.producoesRepo.merge(item, payload));
    if (updated) {
      this.realtime.emit('projetos.producoes.updated', updated);
    }
    return updated;
  }

  async resolveProducaoAttachmentDownload(
    producaoId: string,
    filename: string,
    user: AuthenticatedUser
  ) {
    const item = await this.producoesRepo.findOne({ where: { id: producaoId } });
    const scopedProjectIds = await this.buildTeamScopeProjectIds(user);
    if (!item || !this.isProductionVisible(item, user, scopedProjectIds)) {
      throw new NotFoundException('Arquivo nao encontrado.');
    }
    const safeFilename = this.sanitizeAttachmentFilename(filename);
    const metadata = item.arquivo || {};
    const storedFilename = String(metadata.filename || '').trim();
    const relativePath = String(metadata.path || '').replace(/\\/g, '/');
    if (!storedFilename || storedFilename !== safeFilename || !relativePath.endsWith(`/${safeFilename}`)) {
      throw new NotFoundException('Arquivo nao encontrado.');
    }
    const absolutePath = this.buildProductionAttachmentAbsolutePath(relativePath);
    if (!await this.fileExists(absolutePath)) {
      throw new NotFoundException('Arquivo nao encontrado.');
    }
    return {
      absolutePath,
      mimeType: this.resolveAttachmentMimeType(safeFilename, String(metadata.type || '')),
      originalName: String(metadata.name || '').trim() || safeFilename
    };
  }

  async removeProducao(id: string, user: AuthenticatedUser) {
    if (!this.canManageResearch(user)) {
      throw new ForbiddenException('Sem permissao para remover producoes.');
    }
    const item = await this.producoesRepo.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException('Producao nao encontrada.');
    }
    await this.producoesRepo.softDelete(id);
    this.realtime.emit('projetos.producoes.deleted', { id });
    return { success: true };
  }

  async findIdeias(_user: AuthenticatedUser) {
    const items = await this.ideiasRepo.find({
      order: { createdAt: 'DESC' }
    });
    return items.map((item) => this.toIdeaProjection(item));
  }

  async createIdeia(dto: CriarIdeiaProjetoDto, user: AuthenticatedUser) {
    const role = normalizeRole(user?.role);
    const canCreateIdea = this.canManageResearch(user) || isStudentMemberRole(role);
    if (!canCreateIdea) {
      throw new ForbiddenException('Sem permissao para cadastrar ideias.');
    }
    const canManage = this.canManageResearch(user);
    const item = this.ideiasRepo.create({
      titulo: this.normalizeText(dto.titulo, 200) || 'Ideia sem titulo',
      problema: this.normalizeText(dto.problema, 2000),
      justificativa: this.normalizeText(dto.justificativa, 2000),
      objetivo: this.normalizeText(dto.objetivo, 2000),
      area: this.normalizeText(dto.area, 60) || 'multidisciplinar',
      palavrasChave: this.normalizeArray(dto.palavrasChave),
      status: canManage ? (this.normalizeText(dto.status, 40) || 'ideia') : 'ideia',
      responsavelId: canManage ? this.normalizeText(dto.responsavelId, 80) : undefined,
      responsavelNome: canManage ? this.normalizeText(dto.responsavelNome, 120) : undefined,
      observacoes: this.normalizeText(dto.observacoes, 2000),
      criadoPorId: user.id || undefined,
      criadoPorNome: user.name || user.email || undefined,
      interesses: []
    });
    const saved = await this.ideiasRepo.save(item);
    this.realtime.emit('projetos.ideias.created', saved);
    return this.toIdeaProjection(saved);
  }

  async setIdeiaInteresse(id: string, interessado: boolean, user: AuthenticatedUser) {
    if (!this.canRegisterIdeaInterest(user)) {
      throw new ForbiddenException('Apenas discentes da liga podem demonstrar interesse em ideias.');
    }
    const item = await this.ideiasRepo.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException('Ideia nao encontrada.');
    }

    const userId = this.normalizeText(user?.id, 80);
    if (!userId) {
      throw new ForbiddenException('Usuario sem identificador valido.');
    }

    const current = this.normalizeIdeaInteresses(item.interesses);
    const exists = current.some((entry) => entry.id === userId);
    const next = interessado
      ? (
        exists
          ? current
          : [
            ...current,
            {
              id: userId,
              nome: this.normalizeText(user.name, 120) || this.normalizeText(user.email, 180) || 'Membro da liga',
              email: this.normalizeText(user.email, 180),
              role: this.normalizeText(user.role, 60),
              criadoEm: new Date().toISOString()
            }
          ]
      )
      : current.filter((entry) => entry.id !== userId);

    if (next.length === current.length && interessado === exists) {
      return this.toIdeaProjection(item);
    }

    item.interesses = next;
    const updated = await this.ideiasRepo.save(item);
    this.realtime.emit('projetos.ideias.interesse.updated', {
      id: updated.id,
      totalInteresses: next.length
    });
    return this.toIdeaProjection(updated);
  }

  async updateIdeia(id: string, dto: AtualizarIdeiaProjetoDto, user: AuthenticatedUser) {
    if (!this.canManageResearch(user)) {
      throw new ForbiddenException('Sem permissao para atualizar ideias.');
    }
    const item = await this.ideiasRepo.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException('Ideia nao encontrada.');
    }
    const payload: Partial<ProjetoIdeia> = {
      titulo: this.normalizeText(dto.titulo, 200) || item.titulo,
      problema: Object.prototype.hasOwnProperty.call(dto, 'problema') ? this.normalizeText(dto.problema, 2000) : item.problema,
      justificativa: Object.prototype.hasOwnProperty.call(dto, 'justificativa') ? this.normalizeText(dto.justificativa, 2000) : item.justificativa,
      objetivo: Object.prototype.hasOwnProperty.call(dto, 'objetivo') ? this.normalizeText(dto.objetivo, 2000) : item.objetivo,
      area: this.normalizeText(dto.area, 60) || item.area,
      palavrasChave: Object.prototype.hasOwnProperty.call(dto, 'palavrasChave') ? this.normalizeArray(dto.palavrasChave) : item.palavrasChave,
      status: this.normalizeText(dto.status, 40) || item.status,
      responsavelId: Object.prototype.hasOwnProperty.call(dto, 'responsavelId') ? this.normalizeText(dto.responsavelId, 80) : item.responsavelId,
      responsavelNome: Object.prototype.hasOwnProperty.call(dto, 'responsavelNome') ? this.normalizeText(dto.responsavelNome, 120) : item.responsavelNome,
      observacoes: Object.prototype.hasOwnProperty.call(dto, 'observacoes') ? this.normalizeText(dto.observacoes, 2000) : item.observacoes
    };
    await this.ideiasRepo.update(id, payload);
    const updated = await this.ideiasRepo.findOne({ where: { id } });
    if (updated) {
      this.realtime.emit('projetos.ideias.updated', updated);
    }
    return updated ? this.toIdeaProjection(updated) : updated;
  }

  async removeIdeia(id: string, user: AuthenticatedUser) {
    if (!this.canManageResearch(user)) {
      throw new ForbiddenException('Sem permissao para remover ideias.');
    }
    const item = await this.ideiasRepo.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException('Ideia nao encontrada.');
    }
    await this.ideiasRepo.softDelete(id);
    this.realtime.emit('projetos.ideias.deleted', { id });
    return { success: true };
  }

  async remove(id: string, user: AuthenticatedUser) {
    if (!this.canManageResearch(user)) {
      throw new ForbiddenException('Sem permissao para remover projetos de pesquisa.');
    }
    const projeto = await this.findByIdRaw(id);
    if (!projeto) {
      throw new NotFoundException('Projeto nao encontrado.');
    }
    await this.repo.delete(id);
    this.realtime.emit('projetos.deleted', { id });
    return { success: true };
  }
}
