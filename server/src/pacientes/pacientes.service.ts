import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Optional,
  ForbiddenException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { randomUUID } from 'crypto';
import { constants as fsConstants } from 'fs';
import { access, unlink } from 'fs/promises';
import { basename, extname, resolve } from 'path';
import { Paciente } from './paciente.entity';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { CriarPacienteDto } from './dto/criar-paciente.dto';
import { AtualizarPacienteDto } from './dto/atualizar-paciente.dto';
import { AtualizarOnboardingAtletaDto } from './dto/atualizar-onboarding-atleta.dto';
import { AdicionarMensagemProfessorDto } from './dto/adicionar-mensagem-professor.dto';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { ObservabilityService } from '../observability/observability.service';
import {
  AuthenticatedUser,
  hasGlobalAccess,
  hasTeamScopedAccess,
  isStudentMemberRole,
  normalizeRole
} from '../auth/access-control';

const ATTACHMENT_FILENAME_REGEX = /^[\w.-]+$/;
const ATTACHMENT_MIME_BY_EXT: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg'
};
type AtualizarPacienteWithMetadata = AtualizarPacienteDto & {
  linkedAt?: Date | null;
  prontuario?: string;
};

const PACIENTE_STATUS_VALUES = [
  'Ativo',
  'Lista de Espera',
  'Inativo',
  'Alta',
  'Triagem'
] as const;
type PacienteStatus = (typeof PACIENTE_STATUS_VALUES)[number];

@Injectable()
export class PacientesService {
  constructor(
    @InjectRepository(Paciente) private repo: Repository<Paciente>,
    @InjectRepository(User) private usersRepo: Repository<User>,
    private usersService: UsersService,
    private realtime: RealtimeGateway,
    private readonly config: ConfigService,
    @Optional() private readonly observability?: ObservabilityService
  ) {}

  private recordQuery(label: string, startedAt: number, context = 'GET /pacientes') {
    this.observability?.recordQuery({
      label,
      durationMs: Date.now() - startedAt,
      context
    });
  }

  private asObject(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return value as Record<string, unknown>;
  }

  private normalizeText(value: unknown): string {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  }

  private normalizeStringArray(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value
        .map((item) => this.normalizeText(item))
        .filter(Boolean);
    }
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }
    return [];
  }

  private extractClinicalSummaryFromOnboarding(
    onboardingData: Record<string, unknown>
  ): Partial<Paciente> {
    const nextSummary: Partial<Paciente> = {};
    if (Object.prototype.hasOwnProperty.call(onboardingData, 'observacoes')) {
      nextSummary.observacoes = this.normalizeText(onboardingData.observacoes);
    }
    if (Object.prototype.hasOwnProperty.call(onboardingData, 'historicoSaude')) {
      nextSummary.historicoSaude = this.normalizeText(onboardingData.historicoSaude);
    }
    if (Object.prototype.hasOwnProperty.call(onboardingData, 'comorbidadesPessoais')) {
      nextSummary.comorbidadesPessoais = this.normalizeStringArray(onboardingData.comorbidadesPessoais);
    }
    if (Object.prototype.hasOwnProperty.call(onboardingData, 'comorbidadesFamiliares')) {
      nextSummary.comorbidadesFamiliares = this.normalizeStringArray(onboardingData.comorbidadesFamiliares);
    }
    return nextSummary;
  }

  private async generateProntuarioNumber(): Promise<string> {
    const result = await this.repo.query(
      `SELECT nextval('pacientes_prontuario_seq')::bigint AS value`
    );
    const value = Number(result?.[0]?.value || 0);
    return `PRT-${String(value).padStart(6, '0')}`;
  }

  private isTeamMember(userId: string, paciente: Paciente) {
    return Array.isArray(paciente.equipeTecnicaIds) && paciente.equipeTecnicaIds.includes(userId);
  }

  private canAccessPaciente(user: AuthenticatedUser, paciente: Paciente) {
    const role = normalizeRole(user.role);
    if (isStudentMemberRole(role)) {
      if (!user.id) return false;
      return paciente.alunoResponsavelId === user.id || this.isTeamMember(user.id, paciente);
    }

    if (hasGlobalAccess(role)) return true;
    if (!user.id) return false;

    if (hasTeamScopedAccess(role)) {
      return paciente.professorSupervisorId === user.id
        || paciente.alunoResponsavelId === user.id
        || this.isTeamMember(user.id, paciente);
    }

    if (role === 'atleta') {
      return paciente.atletaUserId === user.id;
    }

    return false;
  }

  private applyScopeFilters(qb: SelectQueryBuilder<Paciente>, user: AuthenticatedUser) {
    const role = normalizeRole(user.role);
    if (isStudentMemberRole(role)) {
      if (!user.id) {
        qb.andWhere('1 = 0');
        return;
      }
      qb.andWhere(
        '(paciente.alunoResponsavelId = :userId OR :userId = ANY(COALESCE(paciente.equipeTecnicaIds, ARRAY[]::uuid[])))',
        { userId: user.id }
      );
      return;
    }

    if (hasGlobalAccess(role)) {
      return;
    }

    if (hasTeamScopedAccess(role)) {
      qb.andWhere(
        '(paciente.professorSupervisorId = :userId OR paciente.alunoResponsavelId = :userId OR :userId = ANY(COALESCE(paciente.equipeTecnicaIds, ARRAY[]::uuid[])))',
        { userId: user.id }
      );
      return;
    }

    if (role === 'atleta') {
      qb.andWhere('paciente.atletaUserId = :userId', { userId: user.id });
      return;
    }

    qb.andWhere('1 = 0');
  }

  private async findByIdRaw(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  private normalizeCpf(cpf?: string) {
    if (!cpf) return '';
    return cpf.replace(/\D/g, '');
  }

  private normalizeEmail(email?: string) {
    const normalized = String(email || '').trim().toLowerCase();
    return normalized || '';
  }

  private async resolveAthleteUserForCreate(payload: CriarPacienteDto) {
    const requestedAthleteId = this.normalizeText(payload.atletaUserId);
    if (requestedAthleteId) {
      const athleteById = await this.usersRepo.findOne({ where: { id: requestedAthleteId } });
      if (!athleteById) {
        throw new BadRequestException('Usuario atleta informado nao foi encontrado.');
      }
      if (normalizeRole(athleteById.role) !== 'atleta') {
        throw new BadRequestException('Usuario informado deve possuir cargo de atleta.');
      }
      return {
        id: athleteById.id,
        email: this.normalizeEmail(athleteById.email) || this.normalizeEmail(payload.email)
      };
    }

    const cpf = this.normalizeCpf(payload.cpf);
    const email = this.normalizeEmail(payload.email);

    const [athleteByCpf, athleteByEmail] = await Promise.all([
      cpf ? this.usersRepo.findOne({ where: { cpf } }) : Promise.resolve(null),
      email ? this.usersRepo.findOne({ where: { email } }) : Promise.resolve(null)
    ]);

    if (athleteByCpf && athleteByEmail && athleteByCpf.id !== athleteByEmail.id) {
      throw new BadRequestException(
        'Conflito entre CPF e e-mail informado. Revise os dados do atleta antes de cadastrar.'
      );
    }

    const existing = athleteByCpf || athleteByEmail;
    if (existing) {
      if (normalizeRole(existing.role) !== 'atleta') {
        throw new BadRequestException(
          'CPF ou e-mail informado ja pertence a um usuario que nao e atleta.'
        );
      }
      return {
        id: existing.id,
        email: this.normalizeEmail(existing.email) || email
      };
    }

    const athleteCreatePayload: CreateUserDto = {
      email: email || 'placeholder@laines.ufrn.br',
      name: this.normalizeText(payload.nome),
      role: 'atleta',
      cpf: payload.cpf,
      dataNascimento: payload.dataNascimento,
      telefone: payload.telefone,
      status: 'ativo'
    };
    const createdAthlete = await this.usersService.createWithTempPassword(athleteCreatePayload);
    const createdUser = createdAthlete?.user as { id?: string; email?: string } | undefined;
    const createdId = this.normalizeText(createdUser?.id);
    if (!createdId) {
      throw new BadRequestException('Nao foi possivel criar o acesso do atleta para este paciente.');
    }

    return {
      id: createdId,
      email: this.normalizeEmail(createdUser?.email) || email
    };
  }

  private async resolveAlunoResponsavelOrThrow(alunoId: string) {
    const aluno = await this.usersRepo.findOne({ where: { id: alunoId } });
    if (!aluno) {
      throw new BadRequestException('Aluno responsavel nao encontrado.');
    }

    const alunoRole = normalizeRole(aluno.role);
    if (!isStudentMemberRole(alunoRole)) {
      throw new BadRequestException('Aluno responsavel deve possuir cargo de aluno, presidente ou vice.');
    }

    if (String(aluno.status || '').toLowerCase() !== 'ativo') {
      throw new BadRequestException('Aluno responsavel precisa estar ativo.');
    }

    if (!aluno.supervisorId || !aluno.projetoId) {
      throw new BadRequestException('Aluno responsavel precisa estar vinculado a professor e projeto.');
    }

    return {
      id: aluno.id,
      name: aluno.name,
      supervisorId: aluno.supervisorId,
      projetoId: aluno.projetoId,
      projetoNome: aluno.projetoNome
    };
  }

  private async resolveProfessorSupervisorOrThrow(supervisorId: string) {
    const supervisor = await this.usersRepo.findOne({ where: { id: supervisorId } });
    if (!supervisor) {
      throw new BadRequestException('Professor supervisor nao encontrado.');
    }

    const role = normalizeRole(supervisor.role);
    if (role !== 'professor') {
      throw new BadRequestException('Supervisor deve ser um professor cadastrado.');
    }

    if (String(supervisor.status || '').toLowerCase() !== 'ativo') {
      throw new BadRequestException('Professor supervisor precisa estar ativo.');
    }

    return {
      id: supervisor.id,
      name: supervisor.name
    };
  }

  private validateCpf(cpf?: string) {
    const digits = this.normalizeCpf(cpf);
    if (!digits || digits.length !== 11) {
      throw new BadRequestException('CPF invalido.');
    }
    return digits;
  }

  private normalizePacienteStatus(status?: string, fallback: PacienteStatus = 'Lista de Espera'): PacienteStatus {
    const normalized = String(status || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    if (!normalized) return fallback;

    if (normalized === 'ativo') return 'Ativo';
    if (normalized === 'lista de espera' || normalized === 'lista_espera' || normalized === 'espera') {
      return 'Lista de Espera';
    }
    if (normalized === 'inativo') return 'Inativo';
    if (normalized === 'alta' || normalized === 'concluido') {
      return 'Alta';
    }
    if (normalized === 'triagem' || normalized === 'pendente') {
      return 'Triagem';
    }

    throw new BadRequestException(`Status de paciente invalido. Valores aceitos: ${PACIENTE_STATUS_VALUES.join(', ')}.`);
  }

  private assertActivePatientLinks(payload: {
    status: PacienteStatus;
    alunoResponsavelId?: string;
    professorSupervisorId?: string;
    projetoId?: string;
  }) {
    if (payload.status !== 'Ativo') return;
    if (!payload.alunoResponsavelId || !payload.professorSupervisorId || !payload.projetoId) {
      throw new BadRequestException(
        'Paciente ativo precisa estar vinculado a aluno responsavel, professor supervisor e projeto.'
      );
    }
  }

  private async findAccessiblePacienteOrFail(pacienteId: string, user: AuthenticatedUser) {
    const paciente = await this.findByIdRaw(pacienteId);
    if (!paciente) {
      throw new NotFoundException('Paciente nao encontrado.');
    }
    if (!this.canAccessPaciente(user, paciente)) {
      throw new NotFoundException('Paciente nao encontrado.');
    }
    return paciente;
  }

  findAll(user: AuthenticatedUser, limit?: number, offset?: number) {
    const qb = this.repo.createQueryBuilder('paciente')
      .orderBy('paciente.createdAt', 'DESC');

    this.applyScopeFilters(qb, user);

    if (Number.isFinite(limit)) {
      qb.take(limit!);
    }
    if (Number.isFinite(offset)) {
      qb.skip(offset!);
    }
    const startedAt = Date.now();
    return qb.getMany().then((result) => {
      this.recordQuery('pacientes.find_all.query', startedAt, 'GET /pacientes');
      return result;
    });
  }

  async findById(id: string, user: AuthenticatedUser) {
    const paciente = await this.findByIdRaw(id);
    if (!paciente) return null;
    if (!this.canAccessPaciente(user, paciente)) return null;
    return paciente;
  }

  async create(dto: CriarPacienteDto, user: AuthenticatedUser) {
    const role = normalizeRole(user.role);
    const payload: CriarPacienteDto = { ...dto };
    const isStudentScopedRole = isStudentMemberRole(role);

    if (isStudentScopedRole || !hasGlobalAccess(role)) {
      if (isStudentScopedRole) {
        if (!user.id) {
          throw new ForbiddenException('Usuario autenticado invalido para vinculo de paciente.');
        }
        if (payload.alunoResponsavelId && payload.alunoResponsavelId !== user.id) {
          throw new ForbiddenException('Sem permissao para vincular paciente a outro aluno.');
        }
        payload.alunoResponsavelId = user.id;
        payload.alunoResponsavelNome = payload.alunoResponsavelNome || user.name || '';
      } else if (hasTeamScopedAccess(role)) {
        if (payload.professorSupervisorId && payload.professorSupervisorId !== user.id) {
          throw new ForbiddenException('Sem permissao para definir outro supervisor.');
        }
        payload.professorSupervisorId = payload.professorSupervisorId || user.id;
        payload.professorSupervisorNome = payload.professorSupervisorNome || user.name || '';
      } else {
        throw new ForbiddenException('Sem permissao para criar pacientes.');
      }
    }

    const athleteAccess = await this.resolveAthleteUserForCreate(payload);
    payload.atletaUserId = athleteAccess.id;
    payload.email = athleteAccess.email || payload.email;

    if (payload.alunoResponsavelId) {
      const aluno = await this.resolveAlunoResponsavelOrThrow(payload.alunoResponsavelId);
      payload.alunoResponsavelId = aluno.id;
      payload.alunoResponsavelNome = payload.alunoResponsavelNome || aluno.name;
      payload.professorSupervisorId = payload.professorSupervisorId || aluno.supervisorId;
      if (payload.projetoId && aluno.projetoId && payload.projetoId !== aluno.projetoId) {
        throw new BadRequestException('Projeto informado diverge do projeto vinculado ao aluno responsavel.');
      }
      payload.projetoId = payload.projetoId || aluno.projetoId;
      payload.projetoNome = payload.projetoNome || aluno.projetoNome || '';
    }

    if (payload.professorSupervisorId) {
      const supervisor = await this.resolveProfessorSupervisorOrThrow(payload.professorSupervisorId);
      payload.professorSupervisorId = supervisor.id;
      payload.professorSupervisorNome = payload.professorSupervisorNome || supervisor.name;
    }

    if (payload.alunoResponsavelId && !payload.professorSupervisorId) {
      throw new BadRequestException('Paciente vinculado a aluno precisa possuir professor supervisor.');
    }
    const nextStatus = this.normalizePacienteStatus(payload.status);
    this.assertActivePatientLinks({
      status: nextStatus,
      alunoResponsavelId: payload.alunoResponsavelId,
      professorSupervisorId: payload.professorSupervisorId,
      projetoId: payload.projetoId
    });

    const cpf = this.validateCpf(payload.cpf);
    const {
      anexos: _ignoredAnexos,
      mensagensProfessor: _ignoredMensagensProfessor,
      ...safePayload
    } = payload as any;

    const prontuario = await this.generateProntuarioNumber();

    const paciente = this.repo.create({
      ...safePayload,
      prontuario,
      cpf,
      status: nextStatus,
      tipoTreino: payload.tipoTreino || 'misto',
      intensidade: payload.intensidade || 'moderada',
      objetivo: payload.objetivo || 'performance',
      equipeTecnicaIds: payload.equipeTecnicaIds || [],
      anexos: [],
      mensagensProfessor: [],
      dataCadastro: new Date()
    });
    const saved = await this.repo.save(paciente);
    this.realtime.emit('pacientes.created', saved);
    return saved;
  }

  async update(id: string, dto: AtualizarPacienteDto, user: AuthenticatedUser) {
    const paciente = await this.findByIdRaw(id);
    if (!paciente) {
      throw new NotFoundException('Paciente nao encontrado.');
    }
    if (!this.canAccessPaciente(user, paciente)) {
      throw new NotFoundException('Paciente nao encontrado.');
    }

    if (Object.prototype.hasOwnProperty.call(dto, 'anexos')) {
      throw new ForbiddenException('Atualizacao de anexos deve ser feita pelos endpoints dedicados.');
    }
    if (Object.prototype.hasOwnProperty.call(dto, 'mensagensProfessor')) {
      throw new ForbiddenException('Atualizacao de mensagens deve ser feita pelo endpoint dedicado.');
    }
    const mutableDto: AtualizarPacienteWithMetadata = dto;

    const role = normalizeRole(user.role);
    if (isStudentMemberRole(role) || !hasGlobalAccess(role)) {
      const blockedFields: Array<keyof AtualizarPacienteDto> = [
        'alunoResponsavelId',
        'alunoResponsavelNome',
        'professorSupervisorId',
        'professorSupervisorNome',
        'equipeTecnicaIds',
        'atletaUserId'
      ];
      const attemptedBlockedField = blockedFields.find((field) => Object.prototype.hasOwnProperty.call(dto, field));
      if (attemptedBlockedField) {
        throw new ForbiddenException('Sem permissao para alterar vinculos de acesso do paciente.');
      }
    }

    const touchedLinkFields = [
      'alunoResponsavelId',
      'alunoResponsavelNome',
      'professorSupervisorId',
      'professorSupervisorNome',
      'projetoId',
      'projetoNome'
    ].some((field) => Object.prototype.hasOwnProperty.call(dto, field));

    let resolvedAlunoId = paciente.alunoResponsavelId;
    let resolvedSupervisorId = paciente.professorSupervisorId;
    let resolvedProjetoId = paciente.projetoId;

    if (touchedLinkFields) {
      const nextAlunoId = Object.prototype.hasOwnProperty.call(dto, 'alunoResponsavelId')
        ? dto.alunoResponsavelId
        : paciente.alunoResponsavelId;
      let nextProjetoId = Object.prototype.hasOwnProperty.call(dto, 'projetoId')
        ? dto.projetoId
        : paciente.projetoId;
      let nextSupervisorId = Object.prototype.hasOwnProperty.call(dto, 'professorSupervisorId')
        ? dto.professorSupervisorId
        : paciente.professorSupervisorId;

      if (nextAlunoId) {
        const aluno = await this.resolveAlunoResponsavelOrThrow(nextAlunoId);
        dto.alunoResponsavelId = aluno.id;
        dto.alunoResponsavelNome = dto.alunoResponsavelNome || aluno.name;
        nextSupervisorId = nextSupervisorId || aluno.supervisorId;
        if (nextProjetoId && aluno.projetoId && nextProjetoId !== aluno.projetoId) {
          throw new BadRequestException('Projeto informado diverge do projeto vinculado ao aluno responsavel.');
        }
        nextProjetoId = nextProjetoId || aluno.projetoId;
        dto.projetoId = dto.projetoId || nextProjetoId;
        dto.projetoNome = dto.projetoNome || aluno.projetoNome || '';
      }

      if (nextSupervisorId) {
        const supervisor = await this.resolveProfessorSupervisorOrThrow(nextSupervisorId);
        dto.professorSupervisorId = supervisor.id;
        dto.professorSupervisorNome = dto.professorSupervisorNome || supervisor.name;
      }

      if (nextAlunoId && !nextSupervisorId) {
        throw new BadRequestException('Paciente vinculado a aluno precisa possuir professor supervisor.');
      }

      resolvedAlunoId = nextAlunoId;
      resolvedSupervisorId = nextSupervisorId;
      resolvedProjetoId = nextProjetoId;

      if (nextAlunoId) {
        const alunoChanged = paciente.alunoResponsavelId !== nextAlunoId;
        if (!paciente.linkedAt || alunoChanged) {
          mutableDto.linkedAt = new Date();
        }
      } else if (Object.prototype.hasOwnProperty.call(dto, 'alunoResponsavelId')) {
        mutableDto.linkedAt = null;
      }
    }

    if (dto.cpf) {
      dto.cpf = this.validateCpf(dto.cpf);
    }
    if (Object.prototype.hasOwnProperty.call(dto, 'status')) {
      dto.status = this.normalizePacienteStatus(dto.status);
    }
    const nextStatus = Object.prototype.hasOwnProperty.call(dto, 'status')
      ? this.normalizePacienteStatus(dto.status)
      : this.normalizePacienteStatus(paciente.status as string);
    this.assertActivePatientLinks({
      status: nextStatus,
      alunoResponsavelId: resolvedAlunoId,
      professorSupervisorId: resolvedSupervisorId,
      projetoId: resolvedProjetoId
    });

    if (!paciente.prontuario) {
      mutableDto.prontuario = await this.generateProntuarioNumber();
    }

    const merged = this.repo.merge(paciente, mutableDto as any);
    const saved = await this.repo.save(merged);
    this.realtime.emit('pacientes.updated', saved);
    return saved;
  }

  async addProfessorMessage(
    id: string,
    dto: AdicionarMensagemProfessorDto,
    user: AuthenticatedUser
  ) {
    const paciente = await this.findByIdRaw(id);
    if (!paciente) {
      throw new NotFoundException('Paciente nao encontrado.');
    }
    if (!this.canAccessPaciente(user, paciente)) {
      throw new NotFoundException('Paciente nao encontrado.');
    }

    const role = normalizeRole(user.role);
    if (!hasGlobalAccess(role) && !hasTeamScopedAccess(role)) {
      throw new ForbiddenException('Sem permissao para enviar mensagem no prontuario.');
    }

    const messageText = String(dto.texto || '').trim();
    if (!messageText) {
      throw new BadRequestException('Mensagem vazia.');
    }

    const payload = {
      id: randomUUID(),
      texto: messageText,
      professorId: user.id || '',
      professorNome: user.name || user.email || 'Professor',
      createdAt: new Date().toISOString()
    };

    const currentMessages = Array.isArray(paciente.mensagensProfessor)
      ? paciente.mensagensProfessor
      : [];
    const merged = this.repo.merge(paciente, {
      mensagensProfessor: [payload, ...currentMessages].slice(0, 200)
    } as any);
    const saved = await this.repo.save(merged);
    this.realtime.emit('pacientes.updated', saved);
    return payload;
  }

  async updateAthleteOnboarding(
    id: string,
    dto: AtualizarOnboardingAtletaDto,
    user: AuthenticatedUser
  ) {
    const paciente = await this.findByIdRaw(id);
    if (!paciente) {
      throw new NotFoundException('Paciente nao encontrado.');
    }
    if (!this.canAccessPaciente(user, paciente)) {
      throw new NotFoundException('Paciente nao encontrado.');
    }

    const role = normalizeRole(user.role);
    if (role !== 'atleta') {
      throw new ForbiddenException('Sem permissao para atualizar onboarding do atleta.');
    }

    if (!dto.confirmacaoAtleta || Object.keys(dto.confirmacaoAtleta).length === 0) {
      throw new BadRequestException('Dados de onboarding invalidos.');
    }

    const currentConfirmation = this.asObject(paciente.confirmacaoAtleta);
    const incomingConfirmation = this.asObject(dto.confirmacaoAtleta);
    const currentData = this.asObject(currentConfirmation.dados);
    const incomingData = this.asObject(incomingConfirmation.dados);
    const mergedOnboardingData: Record<string, unknown> = {
      ...currentData,
      ...incomingData
    };
    const mergedConfirmation: Record<string, unknown> = {
      ...currentConfirmation,
      ...incomingConfirmation,
      dados: mergedOnboardingData
    };
    const onboardingSummary = this.extractClinicalSummaryFromOnboarding(mergedOnboardingData);

    const nextProntuario = paciente.prontuario || await this.generateProntuarioNumber();
    const merged = this.repo.merge(paciente, {
      prontuario: nextProntuario,
      confirmacaoAtleta: mergedConfirmation,
      ...onboardingSummary
    } as any);
    const saved = await this.repo.save(merged);
    this.realtime.emit('pacientes.updated', saved);
    return saved;
  }

  async remove(id: string) {
    const paciente = await this.findByIdRaw(id);
    if (!paciente) {
      throw new NotFoundException('Paciente nao encontrado.');
    }
    await this.repo.delete(id);
    this.realtime.emit('pacientes.deleted', { id });
    return { success: true };
  }

  private resolveAttachmentMimeType(filename: string, fallbackType?: string) {
    if (typeof fallbackType === 'string' && fallbackType.trim()) {
      return fallbackType.trim();
    }
    const extension = extname(filename || '').toLowerCase();
    return ATTACHMENT_MIME_BY_EXT[extension] || 'application/octet-stream';
  }

  private sanitizeAttachmentFilename(filename: string) {
    const rawFilename = String(filename || '').trim();
    const safeFilename = basename(rawFilename);
    if (
      !safeFilename
      || safeFilename !== rawFilename
      || !ATTACHMENT_FILENAME_REGEX.test(safeFilename)
    ) {
      throw new BadRequestException('Nome de anexo invalido.');
    }
    return safeFilename;
  }

  private buildAttachmentAbsolutePath(pacienteId: string, safeFilename: string) {
    const uploadsRoot = String(this.config.get('uploads.dir') || 'uploads');
    return resolve(process.cwd(), uploadsRoot, 'pacientes', pacienteId, 'anexos', safeFilename);
  }

  private async fileExists(filePath: string) {
    try {
      await access(filePath, fsConstants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  private buildAttachmentPayload(
    pacienteId: string,
    file: { filename: string; originalname: string; mimetype: string; size: number },
    user: AuthenticatedUser
  ) {
    const relativePath = `pacientes/${pacienteId}/anexos/${file.filename}`;
    const downloadPath = `/pacientes/${pacienteId}/anexos/${encodeURIComponent(file.filename)}`;
    const uploadsBaseUrl = String(this.config.get('uploads.baseUrl') || '').replace(/\/+$/, '');
    const fileUrl = uploadsBaseUrl ? `${uploadsBaseUrl}${downloadPath}` : downloadPath;

    return {
      id: randomUUID(),
      name: file.originalname,
      type: file.mimetype,
      size: file.size,
      path: relativePath,
      url: fileUrl,
      uploadedAt: new Date().toISOString(),
      uploadedBy: {
        id: user.id || '',
        nome: user.name || user.email || 'Usuario'
      }
    };
  }

  async addAttachment(
    pacienteId: string,
    file: { filename: string; originalname: string; mimetype: string; size: number },
    user: AuthenticatedUser
  ) {
    const paciente = await this.findAccessiblePacienteOrFail(pacienteId, user);
    const attachment = this.buildAttachmentPayload(pacienteId, file, user);
    const currentAttachments = Array.isArray(paciente.anexos) ? paciente.anexos : [];
    const mergedAttachments = [
      attachment,
      ...currentAttachments.filter((item) => {
        const normalizedPath = String((item as Record<string, unknown>)?.path || '').replace(/\\/g, '/');
        return normalizedPath !== attachment.path;
      })
    ];

    const merged = this.repo.merge(paciente, {
      anexos: mergedAttachments
    } as any);

    try {
      const saved = await this.repo.save(merged);
      this.realtime.emit('pacientes.updated', saved);
      return attachment;
    } catch (error) {
      const absolutePath = this.buildAttachmentAbsolutePath(pacienteId, file.filename);
      try {
        if (await this.fileExists(absolutePath)) {
          await unlink(absolutePath);
        }
      } catch {
        // Ignora falha de limpeza: o erro principal de persistencia sera propagado.
      }
      throw error;
    }
  }

  async resolveAttachmentDownload(
    pacienteId: string,
    filename: string,
    user: AuthenticatedUser
  ) {
    const paciente = await this.findAccessiblePacienteOrFail(pacienteId, user);
    const safeFilename = this.sanitizeAttachmentFilename(filename);
    const absolutePath = this.buildAttachmentAbsolutePath(pacienteId, safeFilename);
    if (!await this.fileExists(absolutePath)) {
      throw new NotFoundException('Anexo nao encontrado.');
    }

    const attachmentMetadata = (Array.isArray(paciente.anexos) ? paciente.anexos : [])
      .find((item) => {
        const normalizedPath = String((item as Record<string, unknown>)?.path || '').replace(/\\/g, '/');
        return normalizedPath.endsWith(`/anexos/${safeFilename}`);
      }) as Record<string, unknown> | undefined;
    if (!attachmentMetadata) {
      throw new NotFoundException('Anexo nao encontrado.');
    }

    const originalName = String(attachmentMetadata?.name || '').trim() || safeFilename;
    const mimeType = this.resolveAttachmentMimeType(
      safeFilename,
      typeof attachmentMetadata?.type === 'string' ? attachmentMetadata.type : undefined
    );

    return {
      absolutePath,
      mimeType,
      originalName,
      filename: safeFilename
    };
  }

  async removeAttachment(
    pacienteId: string,
    filename: string,
    user: AuthenticatedUser
  ) {
    const attachment = await this.resolveAttachmentDownload(pacienteId, filename, user);
    const paciente = await this.findAccessiblePacienteOrFail(pacienteId, user);

    const currentAttachments = Array.isArray(paciente.anexos) ? paciente.anexos : [];
    const normalizedSuffix = `/anexos/${attachment.filename}`;
    const nextAttachments = currentAttachments.filter((item) => {
      const normalizedPath = String((item as Record<string, unknown>)?.path || '').replace(/\\/g, '/');
      return !normalizedPath.endsWith(normalizedSuffix);
    });

    const merged = this.repo.merge(paciente, {
      anexos: nextAttachments
    } as any);
    const saved = await this.repo.save(merged);
    this.realtime.emit('pacientes.updated', saved);

    try {
      await unlink(attachment.absolutePath);
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err?.code !== 'ENOENT') {
        // Evita falha tardia apos persistencia do banco; o arquivo residual pode ser limpo depois.
      }
    }

    return {
      success: true,
      filename: attachment.filename
    };
  }
}
