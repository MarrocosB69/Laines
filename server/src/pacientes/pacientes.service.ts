import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Optional,
  ForbiddenException,
  ServiceUnavailableException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { randomUUID } from 'crypto';
import { constants as fsConstants } from 'fs';
import { access, mkdir, open, unlink } from 'fs/promises';
import { basename, dirname, extname, resolve } from 'path';
import { Paciente } from './paciente.entity';
import { User } from '../users/user.entity';
import { Avaliacao } from '../avaliacoes/avaliacao.entity';
import { AvaliacaoSessao } from '../avaliacoes/avaliacao-sessao.entity';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { CriarPacienteDto } from './dto/criar-paciente.dto';
import { AtualizarPacienteDto } from './dto/atualizar-paciente.dto';
import { AtualizarOnboardingAtletaDto } from './dto/atualizar-onboarding-atleta.dto';
import { AdicionarMensagemProfessorDto } from './dto/adicionar-mensagem-professor.dto';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { ObservabilityService } from '../observability/observability.service';
import {
  asJsonRecord,
  buildCadastroAtletaConsolidado,
  compactJsonRecord,
  getCadastroAtletaOrigins,
  mergeAthleteConfirmation
} from './athlete-cadastro.utils';
import {
  AuthenticatedUser,
  hasGlobalAccess,
  hasTeamScopedAccess,
  isStudentMemberRole,
  normalizeRole
} from '../auth/access-control';
import {
  auditManagementAccess,
  clinicalScopeCondition,
  isManagementLink,
  resolveCaseCapabilities,
  resolveClinicalLink,
  resolveDirectClinicalLink,
  studentLookupFromRepository
} from '../auth/authorization';
import { AVALIACAO_REGISTRY_BY_TIPO } from '../avaliacoes/evaluation-registry';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { getDiretoriaPermissionSource } from '../common/domain/access.constants';
import {
  ORDEM_PRIORIDADE_CONTATO,
  VERSAO_PRIORIDADE_CONTATO,
  prioridadeContatoDaTriagem
} from './triagem-publica-prioridade';
import {
  gerarRelatorioTriagemPdf,
  projetarRelatorioTriagem
} from './triagem-publica-relatorio';

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
  equipeMultiIds?: string[];
};

const PACIENTE_STATUS_VALUES = [
  'Ativo',
  'Lista de Espera',
  'Triagem Publica',
  'Inativo',
  'Alta',
  'Triagem'
] as const;
type PacienteStatus = (typeof PACIENTE_STATUS_VALUES)[number];
const PATIENT_MANAGER_ROLES = new Set(['admin', 'coordenacao', 'coord_atendimento']);
const PATIENT_PENDING_CREATOR_ROLES = new Set(['professor', 'profissional', 'presidente', 'vice']);
const PRESIDENCY_ROLES = new Set(['presidente', 'vice']);
const EXTENSION_TRIAGE_STATUS_VALUES = ['triagem publica', 'triagem_publica', 'triagem'];
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EQUIPE_MULTI_AREAS = new Set(['nutricao', 'fisioterapia', 'psicologia', 'educacao_fisica', 'medicina', 'outro']);
const EQUIPE_MULTI_PAPEIS = new Set(['avaliador', 'supervisor', 'consultor', 'outro']);
const PATIENT_MANAGER_ONLY_UPDATE_FIELDS = new Set<keyof AtualizarPacienteDto>([
  'nome',
  'cpf',
  'dataNascimento',
  'genero',
  'sexoBiologico',
  'telefone',
  'email',
  'endereco',
  'bairro',
  'cidade',
  'estado',
  'status',
  'modalidadePrincipal',
  'tempoPratica',
  'frequenciaSemanal',
  'duracaoSessao',
  'outrasModalidades',
  'tipoTreino',
  'intensidade',
  'objetivo',
  'projetoId',
  'projetoNome',
  'alunoResponsavelId',
  'alunoResponsavelNome',
  'professorSupervisorId',
  'professorSupervisorNome',
  'equipeTecnicaIds',
  'equipeProfissional',
  'atletaUserId',
  'consentimentoPesquisa',
  'consentimentoData',
  'consentimentoVersao'
]);
const PATIENT_SCOPED_UPDATE_FIELDS = new Set<keyof AtualizarPacienteDto>([
  'observacoes',
  'historicoSaude',
  'comorbidadesPessoais',
  'comorbidadesFamiliares',
  'confirmacaoAtleta'
]);
const PATIENT_SCOPED_CONFIRMATION_FIELDS = new Set([
  'ebiaSelfForm',
  'formulariosLiberados'
]);
const COORD_ATENDIMENTO_PROTECTED_FIELDS = new Set([
  ...PATIENT_SCOPED_UPDATE_FIELDS,
  'confirmacaoAtleta',
  'consentimentoPesquisa',
  'consentimentoData',
  'consentimentoVersao'
]);
const EQUIPE_MULTI_ROLES = new Set(['aluno', 'presidente', 'vice', 'professor', 'profissional', 'pesquisador', 'colaborador']);
const CREDENTIALED_SUPERVISOR_ROLES = new Set(['professor', 'profissional']);

@Injectable()
export class PacientesService {
  constructor(
    @InjectRepository(Paciente) private repo: Repository<Paciente>,
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(Avaliacao) private avaliacoesRepo: Repository<Avaliacao>,
    @InjectRepository(AvaliacaoSessao) private sessoesRepo: Repository<AvaliacaoSessao>,
    private usersService: UsersService,
    private realtime: RealtimeGateway,
    private readonly config: ConfigService,
    @Optional() private readonly observability?: ObservabilityService,
    @Optional() private readonly auditoria?: AuditoriaService
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
    if (value && typeof value === 'object') {
      return Object.values(value as Record<string, unknown>)
        .flatMap((item) => this.normalizeStringArray(item))
        .filter(Boolean);
    }
    return [];
  }

  private normalizeOptionalStringArray(value: unknown): string[] | undefined {
    if (value === undefined) return undefined;
    return this.normalizeStringArray(value);
  }

  private normalizeOptionalNumber(value: unknown): number | undefined {
    if (value === null || value === undefined || value === '') return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private compactRecord(record: Record<string, unknown>): Record<string, unknown> {
    return Object.entries(record).reduce<Record<string, unknown>>((acc, [key, value]) => {
      if (value === undefined) return acc;
      if (Array.isArray(value)) {
        acc[key] = value;
        return acc;
      }
      if (value && typeof value === 'object') {
        acc[key] = this.compactRecord(value as Record<string, unknown>);
        return acc;
      }
      acc[key] = value;
      return acc;
    }, {});
  }

  private hasMeaningfulValue(value: unknown): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') {
      return Object.values(value as Record<string, unknown>).some((item) => this.hasMeaningfulValue(item));
    }
    return true;
  }

  private sanitizeFormReleasePatch(value: unknown) {
    const record = asJsonRecord(value);
    return compactJsonRecord({
      enabled: record.enabled === true,
      releaseId: this.normalizeText(record.releaseId) || undefined,
      releasedAt: this.normalizeText(record.releasedAt) || undefined,
      releasedById: this.normalizeText(record.releasedById) || undefined,
      releasedByName: this.normalizeText(record.releasedByName) || undefined,
      disabledAt: this.normalizeText(record.disabledAt) || undefined,
      disabledById: this.normalizeText(record.disabledById) || undefined,
      disabledByName: this.normalizeText(record.disabledByName) || undefined,
      consumedAt: record.consumedAt === null ? null : this.normalizeText(record.consumedAt) || undefined,
      consumedByAvaliacaoId: record.consumedByAvaliacaoId === null
        ? null
        : this.normalizeText(record.consumedByAvaliacaoId) || undefined
    });
  }

  private sanitizeScopedConfirmationPatch(incoming: unknown) {
    const confirmation = asJsonRecord(incoming);
    const attemptedBlockedField = Object.keys(confirmation)
      .find((field) => !PATIENT_SCOPED_CONFIRMATION_FIELDS.has(field));
    if (attemptedBlockedField) {
      throw new ForbiddenException('Sem permissao para alterar dados sensiveis do cadastro do atleta.');
    }

    const next: Record<string, unknown> = {};
    if (Object.prototype.hasOwnProperty.call(confirmation, 'ebiaSelfForm')) {
      next.ebiaSelfForm = this.sanitizeFormReleasePatch(confirmation.ebiaSelfForm);
    }
    if (Object.prototype.hasOwnProperty.call(confirmation, 'formulariosLiberados')) {
      const forms = asJsonRecord(confirmation.formulariosLiberados);
      next.formulariosLiberados = Object.entries(forms).reduce<Record<string, unknown>>((acc, [type, release]) => {
        const normalizedType = this.normalizeText(type);
        if (!normalizedType) return acc;
        acc[normalizedType] = this.sanitizeFormReleasePatch(release);
        return acc;
      }, {});
    }
    return compactJsonRecord(next);
  }

  private todayDateIso() {
    return new Date().toISOString().slice(0, 10);
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
    if (Array.isArray(paciente.equipeTecnicaIds) && paciente.equipeTecnicaIds.includes(userId)) return true;
    if (Array.isArray(paciente.equipeMultiIds) && paciente.equipeMultiIds.includes(userId)) return true;
    return false;
  }

  private syncEquipeMultiIds(
    equipeProfissional: Array<{ userId: string; userName: string; area: string; papel: string }> | null | undefined
  ): string[] {
    if (!Array.isArray(equipeProfissional)) return [];
    return [...new Set(equipeProfissional.map((m) => m.userId).filter(Boolean))];
  }

  private async resolveEquipeProfissionalOrThrow(
    equipeProfissional: Array<{ userId: string; userName?: string; area?: string; papel?: string }> | null | undefined
  ) {
    if (!Array.isArray(equipeProfissional) || equipeProfissional.length === 0) return [];

    const byUserIdInput = new Map<string, { userId: string; userName?: string; area?: string; papel?: string }>();
    for (const member of equipeProfissional) {
      const userId = this.normalizeText(member?.userId);
      if (!userId) continue;
      if (!UUID_V4_REGEX.test(userId)) {
        throw new BadRequestException('Equipe multiprofissional contem identificador de usuario invalido.');
      }
      if (!byUserIdInput.has(userId)) {
        byUserIdInput.set(userId, member);
      }
    }

    const userIds = [...byUserIdInput.keys()];
    if (userIds.length === 0) return [];

    const users = await this.usersRepo
      .createQueryBuilder('user')
      .where('user.id IN (:...userIds)', { userIds })
      .andWhere('user.deletedAt IS NULL')
      .getMany();
    const usersById = new Map(users.map((user) => [user.id, user]));

    return userIds.map((userId) => {
      const user = usersById.get(userId);
      if (!user) {
        throw new BadRequestException('Membro da equipe multiprofissional nao encontrado.');
      }

      const role = normalizeRole(user.role);
      if (!EQUIPE_MULTI_ROLES.has(role)) {
        throw new BadRequestException('Equipe multiprofissional deve conter alunos, docentes ou profissionais da LAINES.');
      }
      if (String(user.status || '').toLowerCase() !== 'ativo') {
        throw new BadRequestException('Membro da equipe multiprofissional precisa estar ativo.');
      }
      if (isStudentMemberRole(role) && (!user.supervisorId || !user.projetoId)) {
        throw new BadRequestException('Aluno da equipe multiprofissional precisa estar vinculado a supervisor e projeto.');
      }

      const input = byUserIdInput.get(userId);
      const area = this.normalizeText(input?.area || 'outro').toLowerCase();
      const papel = this.normalizeText(input?.papel || 'avaliador').toLowerCase();
      if (!EQUIPE_MULTI_AREAS.has(area)) {
        throw new BadRequestException('Area da equipe multiprofissional invalida.');
      }
      if (!EQUIPE_MULTI_PAPEIS.has(papel)) {
        throw new BadRequestException('Papel da equipe multiprofissional invalido.');
      }

      return {
        userId: user.id,
        userName: user.name,
        area,
        papel
      };
    });
  }

  private hasPatientManagementAccess(user: AuthenticatedUser): boolean {
    const role = normalizeRole(user.role);
    return PATIENT_MANAGER_ROLES.has(role);
  }

  private hasExtensionTriageAccess(user: AuthenticatedUser): boolean {
    const role = normalizeRole(user.role);
    if (this.hasPatientManagementAccess(user)) return true;
    if (PRESIDENCY_ROLES.has(role)) return false;
    if (role === 'diretoria_extensao') return true;
    if (!isStudentMemberRole(role)) return false;
    return getDiretoriaPermissionSource({
      role,
      diretoria: user.diretoria || null
    }) === 'diretoria_extensao';
  }

  private isExtensionTriageStatus(status?: string | null) {
    return EXTENSION_TRIAGE_STATUS_VALUES.includes(this.normalizeStatusForComparison(status));
  }

  private async canManagePacienteCareTeam(user: AuthenticatedUser, _paciente: Paciente) {
    return this.hasPatientManagementAccess(user);
  }

  // Contrato unico (UPD-12): vinculo direto, sem consulta ao banco.
  private canAccessPaciente(user: AuthenticatedUser, paciente: Paciente) {
    return resolveDirectClinicalLink(user, paciente) !== null;
  }

  // Contrato unico (UPD-12): inclui a cadeia do aluno responsavel.
  private async canAccessPacienteForUser(user: AuthenticatedUser, paciente: Paciente) {
    return (await resolveClinicalLink(user, paciente, studentLookupFromRepository(this.usersRepo))) !== null;
  }

  private applyScopeFilters(qb: SelectQueryBuilder<Paciente>, user: AuthenticatedUser) {
    const role = normalizeRole(user.role);
    if (this.hasPatientManagementAccess(user)) {
      return;
    }

    // Contrato unico (UPD-12): mesmo filtro de escopo dos demais objetos clinicos.
    const alunosSupervisionadosSubQuery = this.usersRepo
      .createQueryBuilder('aluno_supervisionado')
      .select('aluno_supervisionado.id')
      .where('(aluno_supervisionado.supervisorId = :userId OR aluno_supervisionado.profissionalId = :userId)')
      .andWhere('aluno_supervisionado.deletedAt IS NULL');
    const linkedScope = clinicalScopeCondition({
      alias: 'paciente',
      user,
      supervisedStudentsSubquery: alunosSupervisionadosSubQuery.getQuery()
    });
    if (linkedScope === null) return;

    // Presidencia/vice enxergam tambem a lista de espera para triagem de extensao.
    if (PRESIDENCY_ROLES.has(role) && user.id) {
      qb.andWhere(
        `(${linkedScope} OR LOWER(paciente.status) IN (:...waitlistStatuses))`,
        { userId: user.id, waitlistStatuses: ['lista de espera', 'lista_espera', 'espera', 'triagem publica', 'triagem_publica', 'triagem'] }
      );
      qb.setParameters(alunosSupervisionadosSubQuery.getParameters());
      return;
    }
    qb.andWhere(linkedScope, { userId: user.id });
    qb.setParameters(alunosSupervisionadosSubQuery.getParameters());
  }

  private async findByIdRaw(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  private normalizeCpf(cpf?: string) {
    if (!cpf) return '';
    return cpf.replace(/\D/g, '');
  }

  private maskCpf(cpf?: string) {
    const digits = this.normalizeCpf(cpf);
    if (digits.length < 2) return '';
    return `***.***.***-${digits.slice(-2)}`;
  }

  private normalizeNullableDate(value: unknown, fieldLabel: string) {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const normalized = this.normalizeText(value);
    if (!normalized) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      throw new BadRequestException(`${fieldLabel} invalida.`);
    }
    const parsed = new Date(`${normalized}T00:00:00.000Z`);
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== normalized) {
      throw new BadRequestException(`${fieldLabel} invalida.`);
    }
    return normalized;
  }

  private normalizePacienteDateFields(payload: Record<string, unknown>) {
    if (Object.prototype.hasOwnProperty.call(payload, 'dataNascimento')) {
      payload.dataNascimento = this.normalizeNullableDate(payload.dataNascimento, 'Data de nascimento');
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'consentimentoData')) {
      payload.consentimentoData = this.normalizeNullableDate(payload.consentimentoData, 'Data do consentimento');
    }
  }

  private mapAthletePaciente(paciente: Paciente) {
    const confirmacaoAtleta = this.asObject(paciente.confirmacaoAtleta);
    const ebiaSelfForm = this.asObject(confirmacaoAtleta.ebiaSelfForm);
    const cadastroAtleta = buildCadastroAtletaConsolidado(paciente);
    return {
      id: paciente.id,
      prontuario: paciente.prontuario,
      nome: paciente.nome,
      cpf: this.maskCpf(paciente.cpf),
      dataNascimento: paciente.dataNascimento || null,
      genero: paciente.genero,
      status: paciente.status,
      modalidadePrincipal: paciente.modalidadePrincipal || null,
      tempoPratica: paciente.tempoPratica || null,
      frequenciaSemanal: paciente.frequenciaSemanal ?? null,
      duracaoSessao: paciente.duracaoSessao ?? null,
      outrasModalidades: paciente.outrasModalidades || null,
      tipoTreino: paciente.tipoTreino,
      intensidade: paciente.intensidade,
      objetivo: paciente.objetivo,
      projetoId: paciente.projetoId || null,
      projetoNome: paciente.projetoNome || null,
      alunoResponsavelId: paciente.alunoResponsavelId || null,
      alunoResponsavelNome: paciente.alunoResponsavelNome || null,
      professorSupervisorNome: paciente.professorSupervisorNome || null,
      atletaUserId: paciente.atletaUserId || null,
      consentimentoPesquisa: paciente.consentimentoPesquisa,
      consentimentoData: paciente.consentimentoData || null,
      faltas: paciente.faltas,
      confirmacaoAtleta: {
        origem: confirmacaoAtleta.origem || cadastroAtleta.origemCadastro || null,
        origens: Array.isArray(confirmacaoAtleta.origens) ? confirmacaoAtleta.origens : [],
        cadastroStatus: confirmacaoAtleta.cadastroStatus || cadastroAtleta.statusCadastroAtleta || null,
        completed: Boolean(confirmacaoAtleta.completed),
        completadoEm: confirmacaoAtleta.completadoEm || null,
        submittedAt: confirmacaoAtleta.submittedAt || null,
        anamneseId: confirmacaoAtleta.anamneseId || null,
        versao: confirmacaoAtleta.versao || null,
        dados: this.asObject(confirmacaoAtleta.dados),
        formulariosLiberados: this.asObject(confirmacaoAtleta.formulariosLiberados),
        ebiaSelfForm: {
          enabled: Boolean(ebiaSelfForm.enabled),
          releasedAt: ebiaSelfForm.releasedAt || null,
          releaseId: ebiaSelfForm.releaseId || null,
          consumedAt: ebiaSelfForm.consumedAt || null
        }
      },
      cadastroAtleta,
      createdAt: paciente.createdAt,
      updatedAt: paciente.updatedAt
    };
  }

  private mapPacienteResponse(paciente: Paciente) {
    return {
      ...paciente,
      cadastroAtleta: buildCadastroAtletaConsolidado(paciente)
    };
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
      throw new BadRequestException('Aluno responsavel precisa estar vinculado a supervisor e projeto.');
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
      throw new BadRequestException('Supervisor responsavel nao encontrado.');
    }

    const role = normalizeRole(supervisor.role);
    if (!CREDENTIALED_SUPERVISOR_ROLES.has(role)) {
      throw new BadRequestException('Supervisor deve ser professor ou profissional credenciado cadastrado.');
    }

    if (String(supervisor.status || '').toLowerCase() !== 'ativo') {
      throw new BadRequestException('Supervisor responsavel precisa estar ativo.');
    }

    if (
      role === 'profissional'
      && !this.normalizeText(supervisor.conselhoNumero)
      && !this.normalizeText(supervisor.crn)
    ) {
      throw new BadRequestException('Profissional supervisor precisa possuir credencial cadastrada.');
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
    if (normalized === 'triagem publica' || normalized === 'triagem_publica') {
      return 'Triagem Publica';
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

  private normalizeStatusForComparison(status?: string | null) {
    return String(status || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  private isWaitlistStatus(status?: string | null) {
    const normalized = this.normalizeStatusForComparison(status);
    return normalized === 'lista de espera'
      || normalized === 'lista_espera'
      || normalized === 'espera'
      || this.isExtensionTriageStatus(status);
  }

  private isActiveStatus(status?: string | null) {
    return this.normalizeStatusForComparison(status) === 'ativo';
  }

  private mapWaitlistSummary(paciente: Paciente) {
    return {
      id: paciente.id,
      prontuario: paciente.prontuario,
      nome: paciente.nome,
      status: paciente.status,
      modalidadePrincipal: paciente.modalidadePrincipal || null,
      projetoId: paciente.projetoId || null,
      projetoNome: paciente.projetoNome || null,
      dataCadastro: paciente.dataCadastro || null,
      createdAt: paciente.createdAt,
      updatedAt: paciente.updatedAt,
      restricted: true
    };
  }

  private mapPublicTriageResponse(paciente: Paciente) {
    const confirmation = asJsonRecord(paciente.confirmacaoAtleta);
    const publicInscricao = asJsonRecord(confirmation.inscricaoPublica);
    const dados = asJsonRecord(publicInscricao.dados || confirmation.dados);
    return {
      id: paciente.id,
      prontuario: paciente.prontuario,
      nome: paciente.nome,
      cpf: this.maskCpf(paciente.cpf),
      status: paciente.status,
      modalidadePrincipal: paciente.modalidadePrincipal || null,
      telefone: paciente.telefone || null,
      email: paciente.email || null,
      cidade: paciente.cidade || null,
      estado: paciente.estado || null,
      dataCadastro: paciente.dataCadastro || null,
      createdAt: paciente.createdAt,
      updatedAt: paciente.updatedAt,
      restricted: true,
      triagemPublica: true,
      prioridadeContato: prioridadeContatoDaTriagem(dados),
      confirmacaoAtleta: {
        origem: confirmation.origem || 'inscricao_publica',
        origens: Array.isArray(confirmation.origens) ? confirmation.origens : [],
        cadastroStatus: confirmation.cadastroStatus || 'triagem_publica',
        inscricaoPublica: {
          atualizadoEm: publicInscricao.atualizadoEm || confirmation.inscritoEm || null,
          dados
        },
        dados
      }
    };
  }

  private async mapPacienteCreateResponse(paciente: Paciente, user: AuthenticatedUser) {
    if (this.hasPatientManagementAccess(user)) {
      return this.mapPacienteResponse(paciente);
    }
    if (await this.canAccessPacienteForUser(user, paciente)) {
      return this.mapPacienteResponse(paciente);
    }
    return this.mapWaitlistSummary(paciente);
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
        'Paciente ativo precisa estar vinculado a aluno responsavel, supervisor responsavel e projeto.'
      );
    }
  }

  private async resolveStudentMemberIds(userIds: Array<string | null | undefined>) {
    const ids = [...new Set(
      userIds
        .map((id) => this.normalizeText(id))
        .filter(Boolean)
    )];
    if (ids.length === 0) return [];

    const users = await this.usersRepo.createQueryBuilder('user')
      .select(['user.id', 'user.role'])
      .where('user.id IN (:...ids)', { ids })
      .andWhere('user.deletedAt IS NULL')
      .getMany();

    return users
      .filter((user) => isStudentMemberRole(normalizeRole(user.role)))
      .map((user) => user.id);
  }

  private async assertStudentActiveLinkCapacityOrThrow(
    userIds: Array<string | null | undefined>,
    excludePacienteId?: string
  ) {
    const studentIds = await this.resolveStudentMemberIds(userIds);
    for (const studentId of studentIds) {
      const qb = this.repo.createQueryBuilder('paciente')
        .where('LOWER(paciente.status) = :status', { status: 'ativo' })
        .andWhere('paciente.deletedAt IS NULL')
        .andWhere(
          '(paciente.alunoResponsavelId = :studentId OR :studentId = ANY(COALESCE(paciente.equipeTecnicaIds, ARRAY[]::uuid[])) OR :studentId = ANY(COALESCE(paciente.equipeMultiIds, ARRAY[]::uuid[])))',
          { studentId }
        );
      if (excludePacienteId) {
        qb.andWhere('paciente.id <> :excludePacienteId', { excludePacienteId });
      }
      const activeLinks = await qb.getCount();
      if (activeLinks >= 3) {
        throw new BadRequestException('Discente ja possui o limite de 3 vinculos ativos com pacientes.');
      }
    }
  }

  private isMergeableCadastroInicial(paciente: Paciente) {
    const normalizedStatus = String(paciente.status || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const origins = getCadastroAtletaOrigins(paciente.confirmacaoAtleta);
    return normalizedStatus === 'lista de espera'
      || normalizedStatus === 'lista_espera'
      || normalizedStatus === 'espera'
      || normalizedStatus === 'triagem'
      || normalizedStatus === 'triagem publica'
      || normalizedStatus === 'triagem_publica'
      || origins.includes('inscricao_publica');
  }

  private resolveTeamCadastroStatus(current: unknown, status: PacienteStatus) {
    const currentConfirmation = asJsonRecord(current);
    if (currentConfirmation.completed || currentConfirmation.completadoEm || currentConfirmation.submittedAt) {
      return this.normalizeText(currentConfirmation.cadastroStatus) || 'cadastro_atleta_completo';
    }
    if (status === 'Lista de Espera' || status === 'Triagem' || status === 'Triagem Publica') {
      return 'pre_cadastro';
    }
    return 'cadastro_atleta_pendente';
  }

  private buildTeamConfirmation(
    current: unknown,
    incoming: unknown,
    status: PacienteStatus,
    user: AuthenticatedUser
  ) {
    return mergeAthleteConfirmation(current, incoming, {
      origem: 'equipe',
      cadastroStatus: this.resolveTeamCadastroStatus(current, status),
      actorId: user.id || null,
      actorName: user.name || null
    });
  }

  private async findAccessiblePacienteOrFail(pacienteId: string, user: AuthenticatedUser) {
    const paciente = await this.findByIdRaw(pacienteId);
    if (!paciente) {
      throw new NotFoundException('Paciente nao encontrado.');
    }
    if (!(await this.canAccessPacienteForUser(user, paciente))) {
      throw new NotFoundException('Paciente nao encontrado.');
    }
    return paciente;
  }

  private async canWriteSupervisorMessage(user: AuthenticatedUser, paciente: Paciente) {
    if (this.hasPatientManagementAccess(user)) return true;

    const role = normalizeRole(user.role);
    if (!user.id || !['professor', 'profissional'].includes(role)) return false;
    if (paciente.professorSupervisorId === user.id) return true;

    if (Array.isArray(paciente.equipeProfissional)) {
      const supervisorMembership = paciente.equipeProfissional.some((member) => (
        String(member?.userId || '') === user.id
        && String(member?.papel || '').toLowerCase().includes('super')
      ));
      if (supervisorMembership) return true;
    }

    if (!paciente.alunoResponsavelId) return false;
    const aluno = await this.usersRepo.findOne({ where: { id: paciente.alunoResponsavelId } });
    if (!aluno || aluno.deletedAt) return false;
    return aluno.supervisorId === user.id || aluno.profissionalId === user.id;
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
      if (normalizeRole(user.role) === 'atleta') {
        return result.map((paciente) => this.mapAthletePaciente(paciente));
      }
      const role = normalizeRole(user.role);
      if (PRESIDENCY_ROLES.has(role)) {
        return result.map((paciente) => (
          this.canAccessPaciente(user, paciente)
            ? this.mapPacienteResponse(paciente)
            : this.mapWaitlistSummary(paciente)
        ));
      }
      return result.map((paciente) => this.mapPacienteResponse(paciente));
    });
  }

  async findPublicTriage(user: AuthenticatedUser) {
    if (!this.hasExtensionTriageAccess(user)) {
      throw new ForbiddenException('Sem permissao para consultar a triagem publica.');
    }

    const pacientes = await this.repo.createQueryBuilder('paciente')
      .where('paciente.deletedAt IS NULL')
      .andWhere('LOWER(paciente.status) IN (:...statuses)', {
        statuses: ['lista de espera', 'lista_de_espera', 'triagem publica', 'triagem_publica', 'triagem']
      })
      .orderBy('paciente.createdAt', 'ASC')
      .getMany();

    const publicos = pacientes.filter((paciente) => {
      const confirmation = asJsonRecord(paciente.confirmacaoAtleta);
      return getCadastroAtletaOrigins(confirmation).includes('inscricao_publica')
        || Object.keys(asJsonRecord(confirmation.inscricaoPublica)).length > 0;
    });
    const ordenados = publicos.map((paciente) => this.mapPublicTriageResponse(paciente))
      .sort((a, b) => ORDEM_PRIORIDADE_CONTATO[a.prioridadeContato.nivel]
        - ORDEM_PRIORIDADE_CONTATO[b.prioridadeContato.nivel]
        || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        || String(a.id).localeCompare(String(b.id)));
    return ordenados.map((paciente, index) => ({ ...paciente, posicaoFila: index + 1 }));
  }

  async gerarRelatorioTriagemPublicaPdf(user: AuthenticatedUser) {
    const fila = await this.findPublicTriage(user);
    const linhas = projetarRelatorioTriagem(fila);
    const pdf = await gerarRelatorioTriagemPdf(linhas);
    if (!this.auditoria) {
      throw new ServiceUnavailableException('Auditoria de exportacao indisponivel.');
    }
    await this.auditoria.create({
      action: 'exportacao_fila_triagem_publica',
      entity: 'pacientes',
      entityId: 'triagem_publica',
      meta: { userId: user.id, role: normalizeRole(user.role), total: linhas.length,
        versao: VERSAO_PRIORIDADE_CONTATO }
    });
    return pdf;
  }

  async findById(id: string, user: AuthenticatedUser) {
    const paciente = await this.findByIdRaw(id);
    if (!paciente) return null;
    const link = await resolveClinicalLink(user, paciente, studentLookupFromRepository(this.usersRepo));
    if (!link) return null;
    if (isManagementLink(link)) {
      await auditManagementAccess(this.auditoria, user, 'pacientes', paciente.id, { acao: 'leitura_prontuario' });
    }
    if (normalizeRole(user.role) === 'atleta') {
      return this.mapAthletePaciente(paciente);
    }
    // A interface consome o que o servidor decidiu para este caso; nao recalcula.
    return {
      ...this.mapPacienteResponse(paciente),
      capacidadesDoCaso: resolveCaseCapabilities(user, paciente, link, Object.keys(AVALIACAO_REGISTRY_BY_TIPO))
    };
  }

  async create(dto: CriarPacienteDto, user: AuthenticatedUser) {
    const role = normalizeRole(user.role);
    const payload = { ...dto };
    this.normalizePacienteDateFields(payload);
    const isPatientManager = this.hasPatientManagementAccess(user);
    if (!isPatientManager) {
      if (!PATIENT_PENDING_CREATOR_ROLES.has(role)) {
        throw new ForbiddenException('Sem permissao para criar pacientes.');
      }
      payload.status = 'Lista de Espera';
      delete (payload as Partial<CriarPacienteDto>).alunoResponsavelId;
      delete (payload as Partial<CriarPacienteDto>).alunoResponsavelNome;
      delete (payload as Partial<CriarPacienteDto>).professorSupervisorId;
      delete (payload as Partial<CriarPacienteDto>).professorSupervisorNome;
      delete (payload as Partial<CriarPacienteDto>).projetoId;
      delete (payload as Partial<CriarPacienteDto>).projetoNome;
      delete (payload as Partial<CriarPacienteDto>).equipeTecnicaIds;
      delete (payload as Partial<CriarPacienteDto>).equipeProfissional;
      delete (payload as Partial<CriarPacienteDto>).atletaUserId;
    }

    const cpf = this.validateCpf(payload.cpf);
    payload.cpf = cpf;
    const existingCadastroPaciente = await this.repo.findOne({ where: { cpf } });
    if (existingCadastroPaciente && !this.isMergeableCadastroInicial(existingCadastroPaciente)) {
      throw new BadRequestException(
        'Ja existe um paciente cadastrado com este CPF. Abra o prontuario existente para atualizar os dados.'
      );
    }

    if (isPatientManager) {
      const athleteAccess = await this.resolveAthleteUserForCreate(payload);
      if (
        existingCadastroPaciente?.atletaUserId
        && existingCadastroPaciente.atletaUserId !== athleteAccess.id
      ) {
        throw new BadRequestException(
          'Paciente em lista de espera ja esta vinculado a outro acesso de atleta.'
        );
      }
      payload.atletaUserId = athleteAccess.id;
      payload.email = athleteAccess.email || payload.email;
    } else {
      delete (payload as Partial<CriarPacienteDto>).atletaUserId;
    }

    if (payload.alunoResponsavelId) {
      const aluno = await this.resolveAlunoResponsavelOrThrow(payload.alunoResponsavelId);
      payload.alunoResponsavelId = aluno.id;
      payload.alunoResponsavelNome = aluno.name;
      payload.professorSupervisorId = payload.professorSupervisorId || aluno.supervisorId;
      if (payload.projetoId && aluno.projetoId && payload.projetoId !== aluno.projetoId) {
        throw new BadRequestException('Projeto informado diverge do projeto vinculado ao aluno responsavel.');
      }
      payload.projetoId = payload.projetoId || aluno.projetoId;
      payload.projetoNome = aluno.projetoNome || '';
    }

    if (payload.professorSupervisorId) {
      const supervisor = await this.resolveProfessorSupervisorOrThrow(payload.professorSupervisorId);
      payload.professorSupervisorId = supervisor.id;
      payload.professorSupervisorNome = supervisor.name;
    }

    if (payload.alunoResponsavelId && !payload.professorSupervisorId) {
      throw new BadRequestException('Paciente vinculado a aluno precisa possuir professor supervisor.');
    }
    const equipeProfissional = await this.resolveEquipeProfissionalOrThrow(payload.equipeProfissional);
    const nextStatus = this.normalizePacienteStatus(payload.status);
    this.assertActivePatientLinks({
      status: nextStatus,
      alunoResponsavelId: payload.alunoResponsavelId,
      professorSupervisorId: payload.professorSupervisorId,
      projetoId: payload.projetoId
    });
    if (this.isActiveStatus(nextStatus)) {
      await this.assertStudentActiveLinkCapacityOrThrow([
        payload.alunoResponsavelId,
        ...(payload.equipeTecnicaIds || []),
        ...this.syncEquipeMultiIds(equipeProfissional)
      ]);
    }

    const {
      anexos: _ignoredAnexos,
      mensagensProfessor: _ignoredMensagensProfessor,
      ...safePayload
    } = payload;

    if (existingCadastroPaciente) {
      const merged = this.repo.merge(existingCadastroPaciente, {
        ...safePayload,
        prontuario: existingCadastroPaciente.prontuario || await this.generateProntuarioNumber(),
        cpf,
        status: nextStatus,
        tipoTreino: payload.tipoTreino || existingCadastroPaciente.tipoTreino || 'misto',
        intensidade: payload.intensidade || existingCadastroPaciente.intensidade || 'moderada',
        objetivo: payload.objetivo || existingCadastroPaciente.objetivo || 'performance',
        equipeTecnicaIds: payload.equipeTecnicaIds || existingCadastroPaciente.equipeTecnicaIds || [],
        equipeMultiIds: this.syncEquipeMultiIds(equipeProfissional),
        equipeProfissional,
        anexos: existingCadastroPaciente.anexos || [],
        mensagensProfessor: existingCadastroPaciente.mensagensProfessor || [],
        dataCadastro: existingCadastroPaciente.dataCadastro || new Date(),
        linkedAt: payload.alunoResponsavelId
          ? existingCadastroPaciente.linkedAt || new Date()
          : existingCadastroPaciente.linkedAt,
        confirmacaoAtleta: this.buildTeamConfirmation(
          existingCadastroPaciente.confirmacaoAtleta,
          safePayload.confirmacaoAtleta,
          nextStatus,
          user
        )
      } as Partial<Paciente>);
      const saved = await this.repo.save(merged);
      this.realtime.emit('pacientes.updated', saved);
      return this.mapPacienteCreateResponse(saved, user);
    }

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
      equipeMultiIds: this.syncEquipeMultiIds(equipeProfissional),
      equipeProfissional,
      anexos: [],
      mensagensProfessor: [],
      dataCadastro: new Date(),
      confirmacaoAtleta: this.buildTeamConfirmation(
        null,
        safePayload.confirmacaoAtleta,
        nextStatus,
        user
      )
    } as Partial<Paciente>);
    const saved = await this.repo.save(paciente);
    this.realtime.emit('pacientes.created', saved);
    return this.mapPacienteCreateResponse(saved, user);
  }

  async update(id: string, dto: AtualizarPacienteDto, user: AuthenticatedUser) {
    const paciente = await this.findByIdRaw(id);
    if (!paciente) {
      throw new NotFoundException('Paciente nao encontrado.');
    }
    if (!(await this.canAccessPacienteForUser(user, paciente))) {
      throw new NotFoundException('Paciente nao encontrado.');
    }

    if (Object.prototype.hasOwnProperty.call(dto, 'anexos')) {
      throw new ForbiddenException('Atualizacao de anexos deve ser feita pelos endpoints dedicados.');
    }
    if (Object.prototype.hasOwnProperty.call(dto, 'mensagensProfessor')) {
      throw new ForbiddenException('Atualizacao de mensagens deve ser feita pelo endpoint dedicado.');
    }
    const mutableDto: AtualizarPacienteWithMetadata & Record<string, unknown> = { ...dto };
    this.normalizePacienteDateFields(mutableDto);

    if (normalizeRole(user.role) === 'coord_atendimento') {
      const protectedField = Object.keys(dto).find((field) => COORD_ATENDIMENTO_PROTECTED_FIELDS.has(field));
      if (protectedField) throw new ForbiddenException('Coordenacao de atendimento altera apenas cadastro e vinculos do paciente.');
    }

    const isPatientManager = this.hasPatientManagementAccess(user);
    if (!isPatientManager) {
      const attemptedBlockedField = Array.from(PATIENT_MANAGER_ONLY_UPDATE_FIELDS)
        .find((field) => Object.prototype.hasOwnProperty.call(dto, field));
      if (attemptedBlockedField) {
        throw new ForbiddenException('Apenas coordenacao pode alterar dados administrativos, status ou vinculos do paciente.');
      }
      const attemptedUnsupportedField = Object.keys(dto)
        .find((field) => !PATIENT_SCOPED_UPDATE_FIELDS.has(field as keyof AtualizarPacienteDto));
      if (attemptedUnsupportedField) {
        throw new ForbiddenException('Sem permissao para alterar este campo do paciente.');
      }
      if (Object.prototype.hasOwnProperty.call(dto, 'confirmacaoAtleta')) {
        if (!(await this.canWriteSupervisorMessage(user, paciente))) {
          throw new ForbiddenException('Somente coordenacao ou supervisor responsavel pode liberar formularios do atleta.');
        }
        mutableDto.confirmacaoAtleta = this.sanitizeScopedConfirmationPatch(dto.confirmacaoAtleta);
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
    const touchedTeamFields = [
      'equipeTecnicaIds',
      'equipeProfissional'
    ].some((field) => Object.prototype.hasOwnProperty.call(dto, field));
    const touchedStatusField = Object.prototype.hasOwnProperty.call(dto, 'status');

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
        dto.alunoResponsavelNome = aluno.name;
        nextSupervisorId = nextSupervisorId || aluno.supervisorId;
        if (nextProjetoId && aluno.projetoId && nextProjetoId !== aluno.projetoId) {
          throw new BadRequestException('Projeto informado diverge do projeto vinculado ao aluno responsavel.');
        }
        nextProjetoId = nextProjetoId || aluno.projetoId;
        dto.projetoId = dto.projetoId || nextProjetoId;
        dto.projetoNome = aluno.projetoNome || '';
      }

      if (nextSupervisorId) {
        const supervisor = await this.resolveProfessorSupervisorOrThrow(nextSupervisorId);
        dto.professorSupervisorId = supervisor.id;
        dto.professorSupervisorNome = supervisor.name;
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
    if (touchedStatusField) {
      dto.status = this.normalizePacienteStatus(dto.status);
    }
    const nextStatus = touchedStatusField
      ? this.normalizePacienteStatus(dto.status)
      : this.normalizePacienteStatus(paciente.status as string);
    const currentStatus = this.normalizePacienteStatus(paciente.status as string);
    const shouldValidateActiveLinks = this.isActiveStatus(nextStatus)
      && (
        touchedStatusField
        || touchedLinkFields
        || touchedTeamFields
        || !this.isActiveStatus(currentStatus)
      );
    if (shouldValidateActiveLinks) {
      this.assertActivePatientLinks({
        status: nextStatus,
        alunoResponsavelId: resolvedAlunoId,
        professorSupervisorId: resolvedSupervisorId,
        projetoId: resolvedProjetoId
      });
    }

    if (!paciente.prontuario) {
      mutableDto.prontuario = await this.generateProntuarioNumber();
    }

    if (Object.prototype.hasOwnProperty.call(dto, 'equipeProfissional')) {
      const equipeProfissional = await this.resolveEquipeProfissionalOrThrow(dto.equipeProfissional);
      mutableDto.equipeProfissional = equipeProfissional;
      mutableDto.equipeMultiIds = this.syncEquipeMultiIds(equipeProfissional);
    }
    if (Object.prototype.hasOwnProperty.call(dto, 'confirmacaoAtleta')) {
      mutableDto.confirmacaoAtleta = isPatientManager
        ? this.buildTeamConfirmation(
          paciente.confirmacaoAtleta,
          dto.confirmacaoAtleta,
          nextStatus,
          user
        )
        : mergeAthleteConfirmation(paciente.confirmacaoAtleta, mutableDto.confirmacaoAtleta);
    }
    if (this.isActiveStatus(nextStatus) && (touchedStatusField || touchedLinkFields || touchedTeamFields)) {
      const nextEquipeTecnicaIds = Object.prototype.hasOwnProperty.call(dto, 'equipeTecnicaIds')
        ? dto.equipeTecnicaIds
        : paciente.equipeTecnicaIds;
      const nextEquipeMultiIds = Object.prototype.hasOwnProperty.call(mutableDto, 'equipeMultiIds')
        ? mutableDto.equipeMultiIds
        : paciente.equipeMultiIds;
      await this.assertStudentActiveLinkCapacityOrThrow([
        resolvedAlunoId,
        ...(nextEquipeTecnicaIds || []),
        ...(nextEquipeMultiIds || [])
      ], id);
    }

    const merged = this.repo.merge(paciente, mutableDto);
    const saved = await this.repo.save(merged);
    this.realtime.emit('pacientes.updated', saved);
    return this.mapPacienteResponse(saved);
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
    if (!(await this.canAccessPacienteForUser(user, paciente))) {
      throw new NotFoundException('Paciente nao encontrado.');
    }

    if (!(await this.canWriteSupervisorMessage(user, paciente))) {
      throw new ForbiddenException('Somente coordenacao ou supervisor responsavel pode registrar nota no prontuario.');
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
      supervisorId: user.id || '',
      supervisorNome: user.name || user.email || 'Supervisor',
      createdAt: new Date().toISOString()
    };

    const currentMessages = Array.isArray(paciente.mensagensProfessor)
      ? paciente.mensagensProfessor
      : [];
    const merged = this.repo.merge(paciente, {
      mensagensProfessor: [payload, ...currentMessages].slice(0, 200)
    });
    const saved = await this.repo.save(merged);
    this.realtime.emit('pacientes.updated', saved);
    return payload;
  }

  private buildOnboardingEsportivoPayload(dto?: AtualizarOnboardingAtletaDto['esportivo']) {
    if (!dto || typeof dto !== 'object') return {};
    const carga = this.asObject(dto.cargaSemanal);
    const historicoLesoes = Array.isArray(dto.historicoLesoes)
      ? dto.historicoLesoes
        .map((item) => this.compactRecord({
          local: this.normalizeText(item?.local) || undefined,
          tempoAfastado: this.normalizeText(item?.tempoAfastado) || undefined
        }))
        .filter((item) => this.hasMeaningfulValue(item))
      : undefined;
    const proximasCompeticoes = Array.isArray(dto.proximasCompeticoes)
      ? dto.proximasCompeticoes
        .map((item) => this.compactRecord({
          nome: this.normalizeText(item?.nome) || undefined,
          data: this.normalizeText(item?.data) || undefined
        }))
        .filter((item) => this.hasMeaningfulValue(item))
      : undefined;

    return this.compactRecord({
      modalidade: this.normalizeText(dto.modalidade) || undefined,
      posicao: this.normalizeText(dto.posicao) || undefined,
      provas: this.normalizeOptionalStringArray(dto.provas),
      nivel: this.normalizeText(dto.nivel) || undefined,
      clube: this.normalizeText(dto.clube) || undefined,
      frequenciaSemanal: this.normalizeOptionalNumber(dto.frequenciaSemanal),
      duracaoSessao: this.normalizeOptionalNumber(dto.duracaoSessao),
      cargaSemanal: this.compactRecord({
        tecnico: this.normalizeOptionalNumber(carga.tecnico),
        tatico: this.normalizeOptionalNumber(carga.tatico),
        fisico: this.normalizeOptionalNumber(carga.fisico),
        preventivo: this.normalizeOptionalNumber(carga.preventivo)
      }),
      fasePeriodizacao: this.normalizeText(dto.fasePeriodizacao) || undefined,
      historicoLesoes,
      proximasCompeticoes,
      historicaREDS: dto.historicaREDS
    });
  }

  private normalizeOnboardingMedicamentos(value: unknown) {
    if (value === undefined) return undefined;
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => {
        const record = this.asObject(item);
        return this.compactRecord({
          nome: this.normalizeText(record.nome),
          dose: this.normalizeText(record.dose) || undefined,
          frequencia: this.normalizeText(record.frequencia) || undefined
        });
      })
      .filter((item) => this.normalizeText(item.nome).length > 0);
  }

  private buildFamilyHistoryFlags(comorbidadesFamiliares?: string[]) {
    const normalized = this.normalizeStringArray(comorbidadesFamiliares)
      .map((item) => item.toLowerCase());
    if (normalized.length === 0) return {};
    const includes = (terms: string[]) => normalized.some((item) => terms.some((term) => item.includes(term)));
    return {
      familyCardiovascular: includes(['cardio', 'coracao', 'coração', 'hipertens']),
      familyDiabetes: includes(['diabetes']),
      familyCancer: includes(['cancer', 'câncer', 'neoplas']),
      familyObesity: includes(['obes'])
    };
  }

  private buildOnboardingAnamneseDados(
    dto: AtualizarOnboardingAtletaDto,
    paciente: Paciente,
    dataAvaliacao: string
  ) {
    const esportivo = this.buildOnboardingEsportivoPayload(dto.esportivo);
    const objetivos = this.normalizeOptionalStringArray(dto.objetivos);
    const patologias = this.normalizeOptionalStringArray(dto.patologias);
    const comorbidadesFamiliares = this.normalizeOptionalStringArray(dto.comorbidadesFamiliares);

    const dadosBrutos = this.compactRecord({
      dataAvaliacao,
      nomePaciente: paciente.nome,
      dataNascimento: this.normalizeText(dto.dataNascimento || paciente.dataNascimento) || undefined,
      genero: this.normalizeText(dto.genero) || undefined,
      sexoBiologico: this.normalizeText(dto.sexoBiologico || paciente.sexoBiologico || dto.genero) || undefined,
      identidadeGenero: this.normalizeText(dto.identidadeGenero) || undefined,
      telefone: this.normalizeText(dto.telefone) || undefined,
      cidade: this.normalizeText(dto.cidade) || undefined,
      estado: this.normalizeText(dto.estado) || undefined,
      objetivos,
      queixaPrincipal: this.normalizeText(dto.queixaPrincipal) || undefined,
      patologias,
      medicamentos: this.normalizeOnboardingMedicamentos(dto.medicamentos),
      suplementos: this.normalizeOnboardingMedicamentos(dto.suplementos),
      alergias: this.normalizeText(dto.alergias) || undefined,
      cirurgias: this.normalizeText(dto.cirurgias) || undefined,
      sonoHoras: this.normalizeOptionalNumber(dto.sonoHoras),
      sonoQualidade: this.normalizeOptionalNumber(dto.sonoQualidade),
      estresseNivel: this.normalizeOptionalNumber(dto.estresseNivel),
      alcoolUso: this.normalizeText(dto.alcoolUso) || undefined,
      tabacoUso: this.normalizeText(dto.tabacoUso) || undefined,
      cicloMenstrualRegularidade: this.normalizeText(dto.cicloMenstrualRegularidade) || undefined,
      cicloMenstrualContraceptivo: this.normalizeText(dto.cicloMenstrualContraceptivo) || undefined,
      comorbidadesFamiliares,
      ...this.buildFamilyHistoryFlags(comorbidadesFamiliares),
      atividadeTipo: this.normalizeText(dto.esportivo?.modalidade) || undefined,
      atividadeFrequencia: this.normalizeOptionalNumber(dto.esportivo?.frequenciaSemanal),
      atividadeDuracao: this.normalizeOptionalNumber(dto.esportivo?.duracaoSessao),
      esportivo: this.hasMeaningfulValue(esportivo) ? esportivo : undefined
    });

    return {
      dados_brutos: dadosBrutos,
      esportivo
    };
  }

  private buildOnboardingSelfReportedData(dto: AtualizarOnboardingAtletaDto) {
    const incomingConfirmation = this.asObject(dto.confirmacaoAtleta);
    const incomingData = this.asObject(incomingConfirmation.dados);
    const esportivo = this.buildOnboardingEsportivoPayload(dto.esportivo);
    const medicamentos = this.normalizeOnboardingMedicamentos(dto.medicamentos);
    const suplementos = this.normalizeOnboardingMedicamentos(dto.suplementos);
    const patologias = this.normalizeOptionalStringArray(dto.patologias);
    const comorbidadesFamiliares = this.normalizeOptionalStringArray(dto.comorbidadesFamiliares);
    const queixaPrincipal = this.normalizeText(dto.queixaPrincipal);
    const alergias = this.normalizeText(dto.alergias);

    return compactJsonRecord({
      ...incomingData,
      dataNascimento: this.normalizeText(dto.dataNascimento) || undefined,
      genero: this.normalizeText(dto.genero) || undefined,
      sexoBiologico: this.normalizeText(dto.sexoBiologico) || undefined,
      identidadeGenero: this.normalizeText(dto.identidadeGenero) || undefined,
      telefone: this.normalizeText(dto.telefone) || undefined,
      cidade: this.normalizeText(dto.cidade) || undefined,
      estado: this.normalizeText(dto.estado) || undefined,
      objetivos: this.normalizeOptionalStringArray(dto.objetivos),
      queixaPrincipal: queixaPrincipal || undefined,
      observacoes: this.normalizeText(incomingData.observacoes) || queixaPrincipal || undefined,
      patologias,
      comorbidadesPessoais: this.normalizeStringArray(incomingData.comorbidadesPessoais).length
        ? this.normalizeStringArray(incomingData.comorbidadesPessoais)
        : patologias,
      medicamentos,
      suplementos,
      alergias: alergias || undefined,
      alergiaIntolerancia: this.normalizeText(incomingData.alergiaIntolerancia) || alergias || undefined,
      cirurgias: this.normalizeText(dto.cirurgias) || undefined,
      sonoHoras: this.normalizeOptionalNumber(dto.sonoHoras),
      sonoQualidade: this.normalizeOptionalNumber(dto.sonoQualidade),
      estresseNivel: this.normalizeOptionalNumber(dto.estresseNivel),
      alcoolUso: this.normalizeText(dto.alcoolUso) || undefined,
      tabacoUso: this.normalizeText(dto.tabacoUso) || undefined,
      cicloMenstrualRegularidade: this.normalizeText(dto.cicloMenstrualRegularidade) || undefined,
      cicloMenstrualContraceptivo: this.normalizeText(dto.cicloMenstrualContraceptivo) || undefined,
      comorbidadesFamiliares,
      esportivo: this.hasMeaningfulValue(esportivo) ? esportivo : undefined
    });
  }

  private buildOnboardingPacientePatch(dto: AtualizarOnboardingAtletaDto): Partial<Paciente> {
    const patch: Partial<Paciente> = {};
    const has = (key: keyof AtualizarOnboardingAtletaDto) => Object.prototype.hasOwnProperty.call(dto, key);
    const assignText = (dtoKey: keyof AtualizarOnboardingAtletaDto, entityKey: keyof Paciente) => {
      if (!has(dtoKey)) return;
      const value = this.normalizeText(dto[dtoKey]);
      if (value) {
        (patch as Record<string, unknown>)[entityKey as string] = value;
      }
    };

    assignText('dataNascimento', 'dataNascimento');
    assignText('genero', 'genero');
    assignText('sexoBiologico', 'sexoBiologico');
    assignText('telefone', 'telefone');
    assignText('cidade', 'cidade');
    assignText('estado', 'estado');

    const confirmationData = this.buildOnboardingSelfReportedData(dto);
    Object.assign(patch, this.extractClinicalSummaryFromOnboarding(confirmationData));

    if (has('objetivos')) {
      const objetivos = this.normalizeStringArray(dto.objetivos);
      if (objetivos[0]) {
        patch.objetivo = objetivos[0];
      }
    }
    if (has('patologias')) {
      patch.comorbidadesPessoais = this.normalizeStringArray(dto.patologias);
    }
    if (has('comorbidadesFamiliares')) {
      patch.comorbidadesFamiliares = this.normalizeStringArray(dto.comorbidadesFamiliares);
    }

    if (dto.esportivo && typeof dto.esportivo === 'object') {
      const modalidade = this.normalizeText(dto.esportivo.modalidade);
      const frequenciaSemanal = this.normalizeOptionalNumber(dto.esportivo.frequenciaSemanal);
      const duracaoSessao = this.normalizeOptionalNumber(dto.esportivo.duracaoSessao);
      if (modalidade) patch.modalidadePrincipal = modalidade;
      if (frequenciaSemanal !== undefined) patch.frequenciaSemanal = frequenciaSemanal;
      if (duracaoSessao !== undefined) patch.duracaoSessao = duracaoSessao;
    }

    return patch;
  }

  private async resolveOnboardingSessao(
    paciente: Paciente,
    sessoesRepo: Repository<AvaliacaoSessao>
  ) {
    const existente = await sessoesRepo.findOne({
      where: { pacienteId: paciente.id },
      order: { createdAt: 'DESC' }
    });
    if (existente) return existente;

    return sessoesRepo.save(sessoesRepo.create({
      pacienteId: paciente.id,
      projetoId: paciente.projetoId || undefined,
      dataReferencia: this.todayDateIso(),
      status: 'rascunho',
      meta: {
        origem: 'athlete_onboarding'
      }
    }));
  }

  private async saveOnboardingAnamnese(
    paciente: Paciente,
    sessao: AvaliacaoSessao,
    dto: AtualizarOnboardingAtletaDto,
    avaliacoesRepo: Repository<Avaliacao>
  ) {
    const dataAvaliacao = this.todayDateIso();
    const payload: Partial<Avaliacao> = {
      sessaoId: sessao.id,
      tipo: 'anamnese_inicial',
      pacienteId: paciente.id,
      projetoId: paciente.projetoId || undefined,
      projetoNome: paciente.projetoNome || undefined,
      alunoId: paciente.alunoResponsavelId || undefined,
      status: 'rascunho',
      data: dataAvaliacao,
      dados: this.buildOnboardingAnamneseDados(dto, paciente, dataAvaliacao),
      autoSave: false,
      schemaVersion: 1,
      sourceSystem: 'athlete_onboarding',
      sourceRef: paciente.id
    };

    const existente = await avaliacoesRepo.findOne({
      where: {
        sessaoId: sessao.id,
        tipo: 'anamnese_inicial'
      }
    });

    if (existente) {
      return avaliacoesRepo.save(avaliacoesRepo.merge(existente, payload));
    }
    return avaliacoesRepo.save(avaliacoesRepo.create(payload));
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
    if (!(await this.canAccessPacienteForUser(user, paciente))) {
      throw new NotFoundException('Paciente nao encontrado.');
    }

    const role = normalizeRole(user.role);
    if (role !== 'atleta') {
      throw new ForbiddenException('Sem permissao para atualizar onboarding do atleta.');
    }

    if (paciente.atletaUserId !== user.id) {
      throw new ForbiddenException('Sem permissao para atualizar onboarding deste atleta.');
    }

    if (!this.hasMeaningfulValue(dto)) {
      throw new BadRequestException('Dados de onboarding invalidos.');
    }

    const saved = await this.repo.manager.transaction(async (manager) => {
      const pacientesRepo = manager.getRepository(Paciente);
      const sessoesRepo = manager.getRepository(AvaliacaoSessao);
      const avaliacoesRepo = manager.getRepository(Avaliacao);
      const currentPaciente = await pacientesRepo.findOne({ where: { id } });
      if (!currentPaciente) {
        throw new NotFoundException('Paciente nao encontrado.');
      }
      if (currentPaciente.atletaUserId !== user.id) {
        throw new ForbiddenException('Sem permissao para atualizar onboarding deste atleta.');
      }

      const sessao = await this.resolveOnboardingSessao(currentPaciente, sessoesRepo);
      const avaliacao = await this.saveOnboardingAnamnese(currentPaciente, sessao, dto, avaliacoesRepo);
      const completedAt = new Date().toISOString();
      const incomingConfirmation = this.asObject(dto.confirmacaoAtleta);
      const confirmation = mergeAthleteConfirmation(
        currentPaciente.confirmacaoAtleta,
        {
          ...incomingConfirmation,
          dados: this.buildOnboardingSelfReportedData(dto)
        },
        {
          origem: 'atleta',
          cadastroStatus: 'cadastro_atleta_completo',
          timestamp: completedAt,
          actorId: user.id || null,
          actorName: user.name || null,
          completed: true,
          anamneseId: avaliacao.id,
          versao: '1.0'
        }
      );
      const nextProntuario = currentPaciente.prontuario || await this.generateProntuarioNumber();
      const merged = pacientesRepo.merge(currentPaciente, {
        prontuario: nextProntuario,
        ...this.buildOnboardingPacientePatch(dto),
        confirmacaoAtleta: confirmation
      } as Partial<Paciente>);
      return pacientesRepo.save(merged);
    });
    this.realtime.emit('pacientes.updated', saved);
    return this.mapAthletePaciente(saved);
  }

  async getAthleteOnboardingStatus(id: string, user: AuthenticatedUser) {
    const paciente = await this.findByIdRaw(id);
    if (!paciente) {
      throw new NotFoundException('Paciente nao encontrado.');
    }
    if (!(await this.canAccessPacienteForUser(user, paciente))) {
      throw new NotFoundException('Paciente nao encontrado.');
    }

    const role = normalizeRole(user.role);
    const canViewStatus = role === 'atleta'
      ? paciente.atletaUserId === user.id
      : hasGlobalAccess(role) || role === 'coord_atendimento' || hasTeamScopedAccess(role) || isStudentMemberRole(role);
    if (!canViewStatus) {
      throw new ForbiddenException('Sem permissao para consultar onboarding do atleta.');
    }

    const confirmation = this.asObject(paciente.confirmacaoAtleta);
    const completadoEm = this.normalizeText(
      confirmation.completadoEm || confirmation.submittedAt || confirmation.completedAt
    );
    const concluido = Boolean(
      confirmation.completed
      || confirmation.anamneseId
      || completadoEm
    );

    return {
      concluido,
      ...(completadoEm ? { completadoEm } : {})
    };
  }

  async remove(id: string) {
    const paciente = await this.findByIdRaw(id);
    if (!paciente) {
      throw new NotFoundException('Paciente nao encontrado.');
    }
    await this.repo.update(id, {
      status: 'Inativo'
    });
    await this.repo.softDelete(id);
    this.realtime.emit('pacientes.deleted', { id });
    return { success: true, softDeleted: true };
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
    file: { filename: string; originalname: string; mimetype: string; size: number; buffer: Buffer },
    user: AuthenticatedUser
  ) {
    const paciente = await this.findAccessiblePacienteOrFail(pacienteId, user);
    if (!(await this.canWriteSupervisorMessage(user, paciente))) {
      throw new ForbiddenException('Somente coordenacao ou supervisor responsavel pode anexar arquivos ao prontuario.');
    }
    const attachment = this.buildAttachmentPayload(pacienteId, file, user);
    const currentAttachments = Array.isArray(paciente.anexos) ? paciente.anexos : [];
    const mergedAttachments = [
      attachment,
      ...currentAttachments.filter((item) => {
        const normalizedPath = String((item as Record<string, unknown>)?.path || '').replace(/\\/g, '/');
        return normalizedPath !== attachment.path;
      })
    ];

    const absolutePath = this.buildAttachmentAbsolutePath(pacienteId, file.filename);
    await mkdir(dirname(absolutePath), { recursive: true });
    let created = false;
    let saved: Paciente;
    try {
      const handle = await open(absolutePath, 'wx');
      created = true;
      try {
        await handle.writeFile(file.buffer);
      } finally {
        await handle.close();
      }
      const merged = this.repo.merge(paciente, { anexos: mergedAttachments });
      saved = await this.repo.save(merged);
    } catch (error) {
      if (created) {
        try {
          await unlink(absolutePath);
        } catch {
          // Preserva o erro original de escrita ou persistencia.
        }
      }
      throw error;
    }
    this.realtime.emit('pacientes.updated', saved);
    return attachment;
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
    if (!(await this.canWriteSupervisorMessage(user, paciente))) {
      throw new ForbiddenException('Somente coordenacao ou supervisor responsavel pode remover anexos do prontuario.');
    }

    const currentAttachments = Array.isArray(paciente.anexos) ? paciente.anexos : [];
    const normalizedSuffix = `/anexos/${attachment.filename}`;
    const nextAttachments = currentAttachments.filter((item) => {
      const normalizedPath = String((item as Record<string, unknown>)?.path || '').replace(/\\/g, '/');
      return !normalizedPath.endsWith(normalizedSuffix);
    });

    const merged = this.repo.merge(paciente, {
      anexos: nextAttachments
    });
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
