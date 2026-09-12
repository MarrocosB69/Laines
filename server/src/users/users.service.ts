import {
  Injectable,
  ConflictException,
  Logger,
  NotFoundException,
  BadRequestException,
  Optional
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { User } from './user.entity';
import { Projeto } from '../projetos/projeto.entity';
import { Paciente } from '../pacientes/paciente.entity';
import { Agendamento } from '../agendamentos/agendamento.entity';
import { ObservabilityService } from '../observability/observability.service';
import * as bcrypt from 'bcryptjs';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import {
  ADMIN_ROLES,
  PERMISSIONS,
  USER_ROLES,
  USER_STATUS,
  isStudentMemberRole,
  normalizeDiretoria
} from '../common/domain/access.constants';
import { isValidCpf } from '../common/cpf';
import type { UpdateProfileDto } from '../auth/dto/update-profile.dto';
import { CredentialsService } from '../credentials/credentials.service';

const CACHE_MISS = Symbol('CACHE_MISS');
const EQUIPE_ATENDIMENTO_OPTION_ROLES = [
  'aluno',
  'presidente',
  'vice',
  'professor',
  'profissional',
  'pesquisador',
  'colaborador',
  'tecnico'
] as const;
const STUDENT_OPTION_ROLES = ['aluno', 'presidente', 'vice'] as const;
const CREDENTIALED_SUPERVISOR_ROLES = new Set(['professor', 'profissional']);
type AuthLookupUser = Pick<User, 'id' | 'email' | 'passwordHash' | 'role' | 'name' | 'status' | 'diretoria' | 'permissions' | 'mustChangePassword' | 'sessionVersion'>;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private readonly authLookupCacheTtlMs = 3000;
  private readonly userByIdCacheTtlMs = 3000;
  private readonly nullCacheTtlMs = 750;
  private readonly maxCacheEntries = 6000;
  private readonly authByEmailCache = new Map<string, { value: AuthLookupUser | null; expiresAt: number }>();
  private readonly authByEmailInFlight = new Map<string, Promise<AuthLookupUser | null>>();
  private readonly userByIdCache = new Map<string, { value: User | null; expiresAt: number }>();
  private readonly userByIdInFlight = new Map<string, Promise<User | null>>();

  constructor(
    @InjectRepository(User) private repo: Repository<User>,
    @InjectRepository(Projeto) private projetosRepo: Repository<Projeto>,
    @InjectRepository(Paciente) private pacientesRepo: Repository<Paciente>,
    @InjectRepository(Agendamento) private agendamentosRepo: Repository<Agendamento>,
    @Optional() private readonly observability?: ObservabilityService,
    @Optional() private readonly credentials?: CredentialsService
  ) {}

  private readCache<T>(cache: Map<string, { value: T; expiresAt: number }>, key: string): T | typeof CACHE_MISS {
    const entry = cache.get(key);
    if (!entry) return CACHE_MISS;
    if (entry.expiresAt <= Date.now()) {
      cache.delete(key);
      return CACHE_MISS;
    }
    return entry.value;
  }

  private writeCache<T>(cache: Map<string, { value: T; expiresAt: number }>, key: string, value: T, ttlMs: number) {
    if (!key) return;
    if (cache.size >= this.maxCacheEntries) {
      const firstKey = cache.keys().next().value;
      if (firstKey) cache.delete(firstKey);
    }
    cache.set(key, {
      value,
      expiresAt: Date.now() + Math.max(100, Math.floor(ttlMs))
    });
  }

  clearReadCaches() {
    this.authByEmailCache.clear();
    this.userByIdCache.clear();
  }

  private async syncUserNameDenormalizations(userId: string, userName?: string | null) {
    const normalizedUserId = this.sanitizeString(userId);
    if (!normalizedUserId) return;
    const normalizedName = this.sanitizeString(userName);

    await Promise.all([
      this.repo.createQueryBuilder()
        .update(User)
        .set({
          supervisorNome: normalizedName
        })
        .where('supervisor_id = :userId', { userId: normalizedUserId })
        .execute(),
      this.repo.createQueryBuilder()
        .update(User)
        .set({
          profissionalNome: normalizedName
        })
        .where('profissional_id = :userId', { userId: normalizedUserId })
        .execute(),
      this.pacientesRepo.createQueryBuilder()
        .update(Paciente)
        .set({
          alunoResponsavelNome: normalizedName
        })
        .where('aluno_responsavel_id = :userId', { userId: normalizedUserId })
        .execute(),
      this.pacientesRepo.createQueryBuilder()
        .update(Paciente)
        .set({
          professorSupervisorNome: normalizedName
        })
        .where('professor_supervisor_id = :userId', { userId: normalizedUserId })
        .execute(),
      this.agendamentosRepo.createQueryBuilder()
        .update(Agendamento)
        .set({
          alunoNome: normalizedName
        })
        .where('aluno_id = :userId', { userId: normalizedUserId })
        .execute()
    ]);
  }

  private normalizeCpf(cpf?: string) {
    const digits = String(cpf || '').replace(/\D/g, '');
    return digits || undefined;
  }

  private normalizePhone(value?: string) {
    const digits = String(value || '').replace(/\D/g, '');
    return digits || undefined;
  }

  private sanitizeString(value?: string | null) {
    const normalized = String(value || '').trim();
    return normalized || undefined;
  }

  private isPastDate(value?: string | null) {
    const normalized = this.sanitizeString(value);
    if (!normalized) return false;

    const parsed = new Date(`${normalized}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) return false;

    const today = new Date();
    const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
    return parsed.getTime() < todayUtc;
  }

  private assertStudentMemberRequiredFields(input: {
    role: string;
    cpf?: string | null;
    dataNascimento?: string | null;
    matricula?: string | null;
    periodo?: string | null;
    curso?: string | null;
    validateCpf?: boolean;
  }) {
    if (!isStudentMemberRole(input.role)) return;

    const missing: string[] = [];
    const cpf = this.normalizeCpf(input.cpf || undefined);

    if (!cpf) {
      missing.push('CPF');
    } else if (input.validateCpf !== false && !isValidCpf(cpf)) {
      throw new BadRequestException('CPF invalido. Verifique os digitos informados.');
    }
    if (!this.sanitizeString(input.dataNascimento)) missing.push('data de nascimento');
    if (!this.sanitizeString(input.matricula)) missing.push('matricula');
    if (!this.sanitizeString(input.periodo)) missing.push('periodo');
    if (!this.sanitizeString(input.curso)) missing.push('curso');

    if (missing.length > 0) {
      throw new BadRequestException(`Aluno deve possuir ${missing.join(', ')}.`);
    }
    if (!this.isPastDate(input.dataNascimento)) {
      throw new BadRequestException('Data de nascimento do aluno deve ser uma data valida no passado.');
    }
  }

  private buildInstitutionalEmail(name?: string) {
    const normalizedName = this.sanitizeString(name);
    if (!normalizedName) return '';

    const tokens = normalizedName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (tokens.length === 0) return '';

    const first = tokens[0];
    const last = tokens.length > 1 ? tokens[tokens.length - 1] : '';
    const localPart = last && last !== first ? `${first}.${last}` : first;
    return `${localPart}@laines.ufrn.br`;
  }

  private buildInstitutionalEmailOrThrow(name?: string) {
    const email = this.buildInstitutionalEmail(name);
    if (!email) {
      throw new BadRequestException('Nao foi possivel gerar email institucional a partir do nome.');
    }
    return email;
  }

  private async buildAvailableInstitutionalEmail(name?: string, excludeUserId?: string) {
    const baseEmail = this.buildInstitutionalEmailOrThrow(name);
    const [localPart, domain] = baseEmail.split('@');
    let candidate = baseEmail;
    let suffix = 1;

    while (suffix <= 999) {
      const existing = await this.findByEmail(candidate);
      if (!existing || (excludeUserId && existing.id === excludeUserId)) {
        return candidate;
      }
      suffix += 1;
      candidate = `${localPart}${suffix}@${domain}`;
    }

    throw new ConflictException('Nao foi possivel gerar email institucional unico para este usuario.');
  }

  private normalizeRole(role?: string) {
    const normalized = this.sanitizeString(role)?.toLowerCase();
    if (!normalized) return 'aluno';
    if (!USER_ROLES.includes(normalized as (typeof USER_ROLES)[number])) {
      throw new BadRequestException('Cargo invalido.');
    }
    return normalized;
  }

  private normalizeStatus(status?: string) {
    const normalized = this.sanitizeString(status)?.toLowerCase();
    if (!normalized) return 'ativo';
    if (!USER_STATUS.includes(normalized as (typeof USER_STATUS)[number])) {
      throw new BadRequestException('Status invalido.');
    }
    return normalized;
  }

  private normalizePermissions(permissions?: string[] | null) {
    if (!Array.isArray(permissions)) return [];
    const validPermissions = new Set<string>(Object.values(PERMISSIONS));
    const normalized = permissions
      .map((permission) => this.sanitizeString(permission))
      .filter((permission): permission is string => Boolean(permission));

    const invalid = normalized.find((permission) => !validPermissions.has(permission));
    if (invalid) {
      throw new BadRequestException('Permissao invalida.');
    }

    return [...new Set(normalized)];
  }

  private normalizeDiretoriaValue(value?: string | null) {
    if (value === undefined) return undefined;
    const raw = this.sanitizeString(value);
    if (!raw) return null;
    const normalized = normalizeDiretoria(raw);
    if (!normalized) {
      throw new BadRequestException('Diretoria invalida. Use pesquisa, extensao, ensino ou marketing/comunicacao.');
    }
    return normalized;
  }

  private isAdminRole(role?: string) {
    const normalized = this.sanitizeString(role)?.toLowerCase() || '';
    return (ADMIN_ROLES as readonly string[]).includes(normalized);
  }

  private async resolveAlunoVinculosOrThrow(input: {
    role: string;
    supervisorId?: string;
    projetoId?: string;
  }) {
    if (!isStudentMemberRole(input.role)) {
      return null;
    }

    const supervisorId = this.sanitizeString(input.supervisorId);
    const projetoId = this.sanitizeString(input.projetoId);

    if (!supervisorId) {
      throw new BadRequestException('Aluno deve possuir supervisor credenciado cadastrado.');
    }
    if (!projetoId) {
      throw new BadRequestException('Aluno deve possuir projeto vinculado.');
    }

    const [supervisor, projeto] = await Promise.all([
      this.repo.findOne({ where: { id: supervisorId } }),
      this.projetosRepo.findOne({ where: { id: projetoId } })
    ]);

    if (!supervisor) {
      throw new BadRequestException('Professor supervisor informado nao foi encontrado.');
    }

    const supervisorRole = this.normalizeRole(supervisor.role);
    if (!CREDENTIALED_SUPERVISOR_ROLES.has(supervisorRole)) {
      throw new BadRequestException('Supervisor deve ser professor ou profissional credenciado cadastrado.');
    }

    if (String(supervisor.status || '').toLowerCase() !== 'ativo') {
      throw new BadRequestException('Supervisor precisa estar com status ativo.');
    }

    if (
      supervisorRole === 'profissional'
      && !this.sanitizeString(supervisor.conselhoNumero)
      && !this.sanitizeString(supervisor.crn)
    ) {
      throw new BadRequestException('Profissional supervisor precisa possuir credencial cadastrada.');
    }

    if (!projeto) {
      throw new BadRequestException('Projeto informado nao foi encontrado.');
    }

    return {
      supervisorId: supervisor.id,
      supervisorNome: supervisor.name,
      projetoId: projeto.id,
      projetoNome: projeto.nome
    };
  }

  private async resolveProfissionalSupervisorOrThrow(input: {
    role: string;
    profissionalId?: string | null;
  }) {
    if (!isStudentMemberRole(input.role)) {
      return {
        profissionalId: null,
        profissionalNome: null
      };
    }

    const profissionalId = this.sanitizeString(input.profissionalId);
    if (!profissionalId) {
      return {
        profissionalId: null,
        profissionalNome: null
      };
    }

    const profissional = await this.repo.findOne({ where: { id: profissionalId } });
    if (!profissional) {
      throw new BadRequestException('Profissional supervisor informado nao foi encontrado.');
    }

    const profissionalRole = this.normalizeRole(profissional.role);
    if (profissionalRole !== 'profissional') {
      throw new BadRequestException('Profissional supervisor deve possuir perfil profissional.');
    }

    if (String(profissional.status || '').toLowerCase() !== 'ativo') {
      throw new BadRequestException('Profissional supervisor precisa estar com status ativo.');
    }
    if (!this.sanitizeString(profissional.conselhoNumero) && !this.sanitizeString(profissional.crn)) {
      throw new BadRequestException('Profissional supervisor precisa possuir credencial cadastrada.');
    }

    return {
      profissionalId: profissional.id,
      profissionalNome: profissional.name
    };
  }

  private toPublic(user: User, _includeTemporaryPassword = false) {
    if (!user) return user;
    const { passwordHash, tempPassword, ...rest } = user;
    return {
      ...rest,
      passwordChanged: !rest.mustChangePassword
    };
  }

  async findAll(limit?: number, offset?: number) {
    const qb = this.repo.createQueryBuilder('user')
      .orderBy('user.createdAt', 'DESC');

    if (Number.isFinite(limit)) {
      qb.take(limit!);
    }
    if (Number.isFinite(offset)) {
      qb.skip(offset!);
    }

    const users = await qb.getMany();
    return users.map((user) => this.toPublic(user, true));
  }

  async listEquipeAtendimentoOptions() {
    const users = await this.repo.createQueryBuilder('user')
      .select([
        'user.id',
        'user.name',
        'user.email',
        'user.role',
        'user.status',
        'user.curso',
        'user.departamento',
        'user.conselhoTipo',
        'user.supervisorId',
        'user.supervisorNome',
        'user.projetoId',
        'user.projetoNome'
      ])
      .where('LOWER(user.role) IN (:...roles)', { roles: [...EQUIPE_ATENDIMENTO_OPTION_ROLES] })
      .andWhere('LOWER(user.status) = :status', { status: 'ativo' })
      .andWhere('user.deletedAt IS NULL')
      .andWhere(`(
        LOWER(user.role) NOT IN (:...studentRoles)
        OR (user.supervisorId IS NOT NULL AND user.projetoId IS NOT NULL)
      )`, { studentRoles: [...STUDENT_OPTION_ROLES] })
      .orderBy('user.name', 'ASC')
      .getMany();

    return users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      curso: user.curso || null,
      departamento: user.departamento || null,
      conselhoTipo: user.conselhoTipo || null,
      supervisorId: user.supervisorId || null,
      supervisorNome: user.supervisorNome || null,
      projetoId: user.projetoId || null,
      projetoNome: user.projetoNome || null
    }));
  }

  async listActiveSupervisors() {
    const supervisors = await this.repo.createQueryBuilder('user')
      .select([
        'user.id AS id',
        'user.name AS name',
        'user.role AS role',
        'user.conselhoTipo AS "conselhoTipo"',
        'user.conselhoNumero AS "conselhoNumero"',
        'user.crn AS crn'
      ])
      .where('LOWER(user.role) IN (:...roles)', { roles: [...CREDENTIALED_SUPERVISOR_ROLES] })
      .andWhere('LOWER(user.status) = :status', { status: 'ativo' })
      .andWhere(`(
        LOWER(user.role) = :professorRole
        OR (
          LOWER(user.role) = :profissionalRole
          AND (
            NULLIF(TRIM(user.conselhoNumero), '') IS NOT NULL
            OR NULLIF(TRIM(user.crn), '') IS NOT NULL
          )
        )
      )`, {
        professorRole: 'professor',
        profissionalRole: 'profissional'
      })
      .orderBy('user.name', 'ASC')
      .getRawMany<{
        id: string;
        name: string;
        role: string;
        conselhoTipo?: string | null;
        conselhoNumero?: string | null;
        crn?: string | null;
      }>();

    return supervisors.map((item) => ({
      id: item.id,
      name: item.name,
      role: item.role,
      conselhoTipo: item.conselhoTipo || null,
      conselhoNumero: item.conselhoNumero || null,
      crn: item.crn || null
    }));
  }

  findByEmail(email: string) {
    return this.repo.findOne({ where: { email: String(email || '').trim().toLowerCase() } });
  }

  findByCpf(cpf: string) {
    const normalizedCpf = this.normalizeCpf(cpf);
    if (!normalizedCpf) return Promise.resolve(null);
    return this.repo.findOne({ where: { cpf: normalizedCpf } });
  }

  async findAuthByEmail(email: string): Promise<AuthLookupUser | null> {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail) {
      return null;
    }

    const cached = this.readCache(this.authByEmailCache, normalizedEmail);
    if (cached !== CACHE_MISS) {
      return cached as AuthLookupUser | null;
    }

    const inFlight = this.authByEmailInFlight.get(normalizedEmail);
    if (inFlight) {
      return inFlight;
    }

    const startedAt = Date.now();
    const loadPromise = this.repo.query(
      `select
        id,
        email,
        password_hash as "passwordHash",
        role,
        name,
        status,
        diretoria,
        permissions,
        must_change_password as "mustChangePassword",
        session_version as "sessionVersion"
      from users
      where email = $1
        and deleted_at is null
      limit 1`,
      [normalizedEmail]
    ).then((rows: Array<Record<string, unknown>>) => {
      this.observability?.recordQuery({
        label: 'users.find_auth_by_email.query',
        durationMs: Date.now() - startedAt,
        context: 'POST /auth/login'
      });
      if (!Array.isArray(rows) || rows.length === 0) {
        this.writeCache(this.authByEmailCache, normalizedEmail, null, this.nullCacheTtlMs);
        return null;
      }
      const row = rows[0];
      const parsed = {
        id: String(row.id || ''),
        email: String(row.email || ''),
        passwordHash: String(row.passwordHash || ''),
        role: String(row.role || ''),
        name: String(row.name || ''),
        status: String(row.status || ''),
        diretoria: row.diretoria ? String(row.diretoria) : null,
        permissions: Array.isArray(row.permissions)
          ? row.permissions.map((permission) => String(permission)).filter(Boolean)
          : [],
        mustChangePassword: Boolean(row.mustChangePassword),
        sessionVersion: Number(row.sessionVersion || 1)
      } as AuthLookupUser;
      this.writeCache(this.authByEmailCache, normalizedEmail, parsed, this.authLookupCacheTtlMs);
      return parsed;
    }).catch((error: unknown) => {
      this.observability?.recordQuery({
        label: 'users.find_auth_by_email.query',
        durationMs: Date.now() - startedAt,
        context: 'POST /auth/login',
        isError: true
      });
      throw error;
    }).finally(() => {
      this.authByEmailInFlight.delete(normalizedEmail);
    });

    this.authByEmailInFlight.set(normalizedEmail, loadPromise);
    return loadPromise;
  }

  findById(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  async findByIdCached(id: string) {
    const normalizedId = String(id || '').trim();
    if (!normalizedId) return null;

    const cached = this.readCache(this.userByIdCache, normalizedId);
    if (cached !== CACHE_MISS) {
      return cached as User | null;
    }

    const inFlight = this.userByIdInFlight.get(normalizedId);
    if (inFlight) {
      return inFlight;
    }

    const loadPromise = this.repo.findOne({ where: { id: normalizedId } })
      .then((user) => {
        this.writeCache(
          this.userByIdCache,
          normalizedId,
          user || null,
          user ? this.userByIdCacheTtlMs : this.nullCacheTtlMs
        );
        return user || null;
      })
      .finally(() => {
        this.userByIdInFlight.delete(normalizedId);
      });

    this.userByIdInFlight.set(normalizedId, loadPromise);
    return loadPromise;
  }

  async findPublicById(id: string, includeTemporaryPassword = false) {
    const user = await this.findByIdCached(id);
    return user ? this.toPublic(user, includeTemporaryPassword) : null;
  }

  async create(data: Partial<User>) {
    const payload: Partial<User> = { ...data };
    if (payload.email) {
      payload.email = String(payload.email).trim().toLowerCase();
    }
    if (payload.name) {
      payload.name = String(payload.name).trim();
    }
    const user = this.repo.create(payload);
    const saved = await this.repo.save(user);
    this.clearReadCaches();
    return saved;
  }

  private buildTempPassword() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    const bytes = randomBytes(16);
    let password = '';
    for (let i = 0; i < 14; i += 1) {
      password += alphabet[bytes[i] % alphabet.length];
    }
    return password;
  }

  async createWithTempPassword(dto: CreateUserDto, options?: { manager?: EntityManager; deferInvitation?: boolean }) {
    const normalizedName = this.sanitizeString(dto.name) || dto.name;
    const cpfRaw = this.normalizeCpf(dto.cpf);
    if (cpfRaw && !isValidCpf(cpfRaw)) {
      throw new BadRequestException('CPF inválido. Verifique os dígitos informados.');
    }
    const email = await this.buildAvailableInstitutionalEmail(normalizedName);

    const tempPassword = this.buildTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const normalizedRole = this.normalizeRole(dto.role);
    const normalizedStatus = this.normalizeStatus(dto.status);
    const hasDiretoria = Object.prototype.hasOwnProperty.call(dto, 'diretoria');
    const diretoria = hasDiretoria
      ? this.normalizeDiretoriaValue(dto.diretoria)
      : normalizeDiretoria(normalizedRole) || undefined;
    const hasPermissions = Object.prototype.hasOwnProperty.call(dto, 'permissions');
    const permissions = hasPermissions ? this.normalizePermissions(dto.permissions) : undefined;
    const alunoVinculos = await this.resolveAlunoVinculosOrThrow({
      role: normalizedRole,
      supervisorId: dto.supervisorId,
      projetoId: dto.projetoId
    });
    const profissionalVinculo = await this.resolveProfissionalSupervisorOrThrow({
      role: normalizedRole,
      profissionalId: dto.profissionalId
    });
    this.assertStudentMemberRequiredFields({
      role: normalizedRole,
      cpf: dto.cpf,
      dataNascimento: dto.dataNascimento,
      matricula: dto.matricula,
      periodo: dto.periodo,
      curso: dto.curso,
      validateCpf: true
    });
    const payload: Partial<User> = {
      ...dto,
      ...(alunoVinculos || {}),
      ...profissionalVinculo,
      email,
      recoveryEmail: this.sanitizeString(dto.email)?.toLowerCase() || null,
      role: normalizedRole,
      status: normalizedStatus,
      ...(diretoria !== undefined ? { diretoria } : {}),
      ...(hasPermissions ? { permissions } : {}),
      cpf: this.normalizeCpf(dto.cpf),
      name: normalizedName,
      passwordHash,
      tempPassword: null,
      mustChangePassword: true
    };
    const user = options?.manager
      ? await options.manager.getRepository(User).save(options.manager.getRepository(User).create(payload))
      : await this.create(payload);
    this.clearReadCaches();
    const activation = options?.deferInvitation
      ? { delivery: 'pending' as const }
      : await this.sendActivationLink(user.id);

    return {
      user: this.toPublic(user, true),
      activation
    };
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('Usuario nao encontrado.');
    }
    const previousName = this.sanitizeString(user.name) || '';
    const payload: Partial<User> = {
      ...dto
    };
    const nextRole = Object.prototype.hasOwnProperty.call(dto, 'role')
      ? this.normalizeRole(dto.role)
      : this.normalizeRole(user.role);
    const nextSupervisorId = Object.prototype.hasOwnProperty.call(dto, 'supervisorId')
      ? dto.supervisorId
      : user.supervisorId;
    const nextProjetoId = Object.prototype.hasOwnProperty.call(dto, 'projetoId')
      ? dto.projetoId
      : user.projetoId;
    const nextProfissionalId = Object.prototype.hasOwnProperty.call(dto, 'profissionalId')
      ? dto.profissionalId
      : user.profissionalId;
    const nextCpf = Object.prototype.hasOwnProperty.call(dto, 'cpf')
      ? dto.cpf
      : user.cpf;
    const nextDataNascimento = Object.prototype.hasOwnProperty.call(dto, 'dataNascimento')
      ? dto.dataNascimento
      : user.dataNascimento;
    const nextMatricula = Object.prototype.hasOwnProperty.call(dto, 'matricula')
      ? dto.matricula
      : user.matricula;
    const nextPeriodo = Object.prototype.hasOwnProperty.call(dto, 'periodo')
      ? dto.periodo
      : user.periodo;
    const nextCurso = Object.prototype.hasOwnProperty.call(dto, 'curso')
      ? dto.curso
      : user.curso;
    const alunoVinculos = await this.resolveAlunoVinculosOrThrow({
      role: nextRole,
      supervisorId: nextSupervisorId,
      projetoId: nextProjetoId
    });
    const profissionalVinculo = await this.resolveProfissionalSupervisorOrThrow({
      role: nextRole,
      profissionalId: nextProfissionalId
    });
    const previousRole = this.normalizeRole(user.role);
    const shouldValidateStudentCpf = Object.prototype.hasOwnProperty.call(dto, 'cpf')
      || (previousRole !== nextRole && isStudentMemberRole(nextRole));
    this.assertStudentMemberRequiredFields({
      role: nextRole,
      cpf: nextCpf,
      dataNascimento: nextDataNascimento,
      matricula: nextMatricula,
      periodo: nextPeriodo,
      curso: nextCurso,
      validateCpf: shouldValidateStudentCpf
    });

    const nextName = Object.prototype.hasOwnProperty.call(dto, 'name')
      ? (this.sanitizeString(dto.name) || dto.name)
      : user.name;
    if (Object.prototype.hasOwnProperty.call(dto, 'role')) {
      payload.role = nextRole;
      this.logger.warn(`[AUDIT] role change: userId=${id} prev=${this.normalizeRole(user.role)} next=${nextRole}`);
    }
    if (Object.prototype.hasOwnProperty.call(dto, 'status')) {
      payload.status = this.normalizeStatus(dto.status);
    }
    if (Object.prototype.hasOwnProperty.call(dto, 'permissions')) {
      payload.permissions = this.normalizePermissions(dto.permissions);
      this.logger.warn(`[AUDIT] permissions update: userId=${id} permissions=${JSON.stringify(payload.permissions)}`);
    }
    if (Object.prototype.hasOwnProperty.call(dto, 'diretoria')) {
      payload.diretoria = this.normalizeDiretoriaValue(dto.diretoria) as string | undefined;
      this.logger.warn(`[AUDIT] diretoria update: userId=${id} diretoria=${payload.diretoria || 'none'}`);
    }
    if (Object.prototype.hasOwnProperty.call(dto, 'cpf')) {
      payload.cpf = this.normalizeCpf(dto.cpf);
    }
    if (Object.prototype.hasOwnProperty.call(dto, 'name')) {
      payload.name = nextName;
    }
    if (
      Object.prototype.hasOwnProperty.call(dto, 'email') ||
      Object.prototype.hasOwnProperty.call(dto, 'name')
    ) {
      payload.email = await this.buildAvailableInstitutionalEmail(nextName, id);
    }
    if (alunoVinculos) {
      payload.supervisorId = alunoVinculos.supervisorId;
      payload.supervisorNome = alunoVinculos.supervisorNome;
      payload.projetoId = alunoVinculos.projetoId;
      payload.projetoNome = alunoVinculos.projetoNome;
    }
    payload.profissionalId = profissionalVinculo.profissionalId;
    payload.profissionalNome = profissionalVinculo.profissionalNome;

    const shouldBumpSessionVersion = Object.prototype.hasOwnProperty.call(dto, 'role')
      || Object.prototype.hasOwnProperty.call(dto, 'recoveryEmail')
      || Object.prototype.hasOwnProperty.call(dto, 'status')
      || Object.prototype.hasOwnProperty.call(dto, 'email')
      || Object.prototype.hasOwnProperty.call(dto, 'diretoria')
      || Object.prototype.hasOwnProperty.call(dto, 'permissions');

    if (shouldBumpSessionVersion) {
      await this.repo.createQueryBuilder()
        .update(User)
        .set({
          ...payload,
          sessionVersion: () => '"session_version" + 1'
        } as unknown as Partial<User>)
        .where('id = :id', { id })
        .execute();
    } else {
      await this.repo.update(id, payload);
    }
    this.clearReadCaches();
    const updated = await this.findById(id);
    if (!updated) {
      throw new NotFoundException('Usuario nao encontrado.');
    }
    const updatedName = this.sanitizeString(updated.name) || '';
    if (updatedName !== previousName) {
      await this.syncUserNameDenormalizations(updated.id, updated.name);
      this.clearReadCaches();
    }
    return this.toPublic(updated, true);
  }

  async setUserPermissions(userId: string, permissions: string[]) {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('Usuario nao encontrado.');
    }
    const normalized = this.normalizePermissions(permissions);
    this.logger.warn(`[AUDIT] setUserPermissions: userId=${userId} permissions=${JSON.stringify(normalized)}`);
    await this.repo.createQueryBuilder()
      .update(User)
      .set({
        permissions: normalized,
        sessionVersion: () => '"session_version" + 1'
      } as unknown as Partial<User>)
      .where('id = :userId', { userId })
      .execute();
    this.clearReadCaches();
    const updated = await this.findById(userId);
    if (!updated) {
      throw new NotFoundException('Usuario nao encontrado.');
    }
    return this.toPublic(updated, true);
  }

  async updateSelfProfile(id: string, dto: UpdateProfileDto) {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('Usuario nao encontrado.');
    }
    const previousName = this.sanitizeString(user.name) || '';

    const role = this.normalizeRole(user.role);
    const payload: Partial<User> = {};

    if (Object.prototype.hasOwnProperty.call(dto, 'name')) {
      payload.name = this.sanitizeString(dto.name) || user.name;
    }
    if (Object.prototype.hasOwnProperty.call(dto, 'cpf')) {
      const normalizedCpf = this.normalizeCpf(dto.cpf);
      if (!normalizedCpf || normalizedCpf.length !== 11) {
        throw new BadRequestException('CPF invalido. Utilize 11 digitos.');
      }
      payload.cpf = normalizedCpf;
    }
    if (Object.prototype.hasOwnProperty.call(dto, 'dataNascimento')) {
      payload.dataNascimento = this.sanitizeString(dto.dataNascimento);
    }
    if (Object.prototype.hasOwnProperty.call(dto, 'telefone')) {
      payload.telefone = this.normalizePhone(dto.telefone);
    }
    if (Object.prototype.hasOwnProperty.call(dto, 'matricula')) {
      payload.matricula = this.sanitizeString(dto.matricula);
    }
    if (Object.prototype.hasOwnProperty.call(dto, 'periodo')) {
      payload.periodo = this.sanitizeString(dto.periodo);
    }
    if (Object.prototype.hasOwnProperty.call(dto, 'curso')) {
      payload.curso = this.sanitizeString(dto.curso);
    }
    if (Object.prototype.hasOwnProperty.call(dto, 'departamento')) {
      payload.departamento = this.sanitizeString(dto.departamento);
    }

    if (isStudentMemberRole(role)) {
      const nextSupervisorId = Object.prototype.hasOwnProperty.call(dto, 'supervisorId')
        ? this.sanitizeString(dto.supervisorId)
        : user.supervisorId;
      const nextProjetoId = Object.prototype.hasOwnProperty.call(dto, 'projetoId')
        ? this.sanitizeString(dto.projetoId)
        : user.projetoId;
      const vinculos = await this.resolveAlunoVinculosOrThrow({
        role,
        supervisorId: nextSupervisorId,
        projetoId: nextProjetoId
      });
      if (!vinculos) {
        throw new BadRequestException('Nao foi possivel validar vinculos obrigatorios do aluno.');
      }
      payload.supervisorId = vinculos.supervisorId;
      payload.supervisorNome = vinculos.supervisorNome;
      payload.projetoId = vinculos.projetoId;
      payload.projetoNome = vinculos.projetoNome;
    }

    await this.repo.update(id, payload);
    this.clearReadCaches();
    const updated = await this.findById(id);
    if (!updated) {
      throw new NotFoundException('Usuario nao encontrado.');
    }
    const nextName = this.sanitizeString(updated.name) || '';
    if (nextName !== previousName) {
      await this.syncUserNameDenormalizations(updated.id, updated.name);
      this.clearReadCaches();
    }
    return this.toPublic(updated, false);
  }

  private mapSupervisedPaciente(paciente: Paciente) {
    return {
      id: paciente.id,
      nome: paciente.nome,
      status: paciente.status,
      prontuario: paciente.prontuario,
      modalidadePrincipal: paciente.modalidadePrincipal || null,
      projetoId: paciente.projetoId || null,
      projetoNome: paciente.projetoNome || null,
      alunoResponsavelId: paciente.alunoResponsavelId || null,
      alunoResponsavelNome: paciente.alunoResponsavelNome || null,
      professorSupervisorId: paciente.professorSupervisorId || null,
      professorSupervisorNome: paciente.professorSupervisorNome || null,
      updatedAt: paciente.updatedAt,
      createdAt: paciente.createdAt
    };
  }

  private buildSupervisionResumo(pacientes: Paciente[]) {
    const normalizeStatus = (value?: string | null) => String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '');

    const timestamps = pacientes
      .map((paciente) => paciente.updatedAt || paciente.createdAt)
      .filter(Boolean)
      .map((value) => new Date(value as Date).getTime())
      .filter((value) => Number.isFinite(value));

    return {
      totalPacientes: pacientes.length,
      pacientesAtivos: pacientes.filter((paciente) => normalizeStatus(paciente.status).includes('ativo')).length,
      listaEspera: pacientes.filter((paciente) => normalizeStatus(paciente.status).includes('espera')).length,
      triagem: pacientes.filter((paciente) => normalizeStatus(paciente.status).includes('triagem')).length,
      ultimaAtividadeEm: timestamps.length > 0 ? new Date(Math.max(...timestamps)).toISOString() : null
    };
  }

  async getMeusSupervisionados(userId: string) {
    const alunos = await this.repo
      .createQueryBuilder('u')
      .where('(u.supervisorId = :userId OR u.profissionalId = :userId)', { userId })
      .andWhere('u.deletedAt IS NULL')
      .getMany();

    const alunoIds = alunos.map((aluno) => aluno.id);

    let pacientes: Paciente[] = [];
    if (alunoIds.length > 0) {
      pacientes = await this.pacientesRepo
        .createQueryBuilder('p')
        .select([
          'p.id',
          'p.nome',
          'p.status',
          'p.prontuario',
          'p.modalidadePrincipal',
          'p.projetoId',
          'p.projetoNome',
          'p.alunoResponsavelId',
          'p.alunoResponsavelNome',
          'p.professorSupervisorId',
          'p.professorSupervisorNome',
          'p.updatedAt',
          'p.createdAt'
        ])
        .where('p.alunoResponsavelId IN (:...alunoIds)', { alunoIds })
        .andWhere('p.deletedAt IS NULL')
        .getMany();
    }

    const pacientesVinculados = await this.pacientesRepo
      .createQueryBuilder('p')
      .select([
        'p.id',
        'p.nome',
        'p.status',
        'p.prontuario',
        'p.modalidadePrincipal',
        'p.projetoId',
        'p.projetoNome',
        'p.alunoResponsavelId',
        'p.alunoResponsavelNome',
        'p.professorSupervisorId',
        'p.professorSupervisorNome',
        'p.updatedAt',
        'p.createdAt'
      ])
      .where('(:userId = ANY(COALESCE(p.equipeMultiIds, ARRAY[]::uuid[])) OR :userId = ANY(COALESCE(p.equipeTecnicaIds, ARRAY[]::uuid[])))', { userId })
      .andWhere('p.deletedAt IS NULL')
      .getMany();

    const pacientesByAluno = new Map<string, typeof pacientes>();
    pacientes.forEach((paciente) => {
      if (!paciente.alunoResponsavelId) return;
      if (!pacientesByAluno.has(paciente.alunoResponsavelId)) {
        pacientesByAluno.set(paciente.alunoResponsavelId, []);
      }
      pacientesByAluno.get(paciente.alunoResponsavelId)!.push(paciente);
    });

    const supervisedPatientIds = new Set(pacientes.map((paciente) => paciente.id));
    const pacientesDiretos = pacientesVinculados.filter((paciente) => !supervisedPatientIds.has(paciente.id));

    const result = alunos.map((aluno) => {
      const pacientesDoAluno = pacientesByAluno.get(aluno.id) || [];
      const usuarioEhProfessorSupervisor = aluno.supervisorId === userId;
      const usuarioEhProfissionalSupervisor = aluno.profissionalId === userId;
      const supervisaoTipo = usuarioEhProfessorSupervisor
        ? 'professor'
        : usuarioEhProfissionalSupervisor
          ? 'profissional'
          : 'indefinida';

      return {
        id: aluno.id,
        nome: aluno.name,
        email: aluno.email,
        matricula: aluno.matricula || null,
        curso: aluno.curso || null,
        periodo: aluno.periodo || null,
        projetoId: aluno.projetoId || null,
        projetoNome: aluno.projetoNome ?? null,
        supervisorId: aluno.supervisorId || null,
        supervisorNome: aluno.supervisorNome || null,
        profissionalId: aluno.profissionalId || null,
        profissionalNome: aluno.profissionalNome || null,
        supervisaoTipo,
        supervisao: {
          tipo: supervisaoTipo,
          professor: aluno.supervisorId
            ? { id: aluno.supervisorId, nome: aluno.supervisorNome || null }
            : null,
          profissional: aluno.profissionalId
            ? { id: aluno.profissionalId, nome: aluno.profissionalNome || null }
            : null,
          usuarioEhProfessorSupervisor,
          usuarioEhProfissionalSupervisor
        },
        resumo: this.buildSupervisionResumo(pacientesDoAluno),
        pacientes: pacientesDoAluno.map((paciente) => this.mapSupervisedPaciente(paciente))
      };
    });

    if (pacientesDiretos.length > 0) {
      result.push({
        id: `equipe-multi-${userId}`,
        nome: 'Equipe multi vinculada',
        email: 'Atletas vinculados diretamente ao seu perfil',
        matricula: null,
        curso: null,
        periodo: null,
        projetoId: null,
        projetoNome: null,
        supervisorId: null,
        supervisorNome: null,
        profissionalId: null,
        profissionalNome: null,
        supervisaoTipo: 'equipe_multi',
        supervisao: {
          tipo: 'equipe_multi',
          professor: null,
          profissional: null,
          usuarioEhProfessorSupervisor: false,
          usuarioEhProfissionalSupervisor: false
        },
        resumo: this.buildSupervisionResumo(pacientesDiretos),
        pacientes: pacientesDiretos.map((paciente) => this.mapSupervisedPaciente(paciente))
      });
    }

    return result;
  }

  async remove(id: string, actorId?: string) {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('Usuario nao encontrado.');
    }
    if (actorId && user.id === actorId) {
      throw new BadRequestException('Nao e permitido inativar o proprio usuario.');
    }

    if (this.isAdminRole(user.role) && String(user.status || '').toLowerCase() === 'ativo') {
      const activeAdminCount = await this.repo.createQueryBuilder('user')
        .where('LOWER(user.role) IN (:...roles)', { roles: [...ADMIN_ROLES] })
        .andWhere('LOWER(user.status) = :status', { status: 'ativo' })
        .getCount();
      if (activeAdminCount <= 1) {
        throw new BadRequestException('Nao e permitido inativar o ultimo usuario administrador ativo.');
      }
    }

    await this.repo.createQueryBuilder()
      .update(User)
      .set({
        status: 'inativo',
        mustChangePassword: true,
        tempPassword: null,
        sessionVersion: () => '"session_version" + 1'
      } as unknown as Partial<User>)
      .where('id = :id', { id })
      .execute();

    await this.repo.softDelete(id);
    this.clearReadCaches();
    return { success: true, softDeleted: true };
  }

  async resetTemporaryPassword(id: string) {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('Usuario nao encontrado.');
    return { user: this.toPublic(user), activation: await this.sendActivationLink(id) };
  }

  async sendActivationLink(userId: string) {
    return this.credentials ? this.credentials.issue(userId) : { delivery: 'unavailable' as const };
  }

  async updateInternal(id: string, payload: Partial<User>) {
    await this.repo.update(id, payload);
    this.clearReadCaches();
  }

  async updatePasswordAndRevokeSessions(id: string, payload: Pick<User, 'passwordHash' | 'mustChangePassword' | 'tempPassword' | 'passwordUpdatedAt'>) {
    await this.repo.createQueryBuilder()
      .update(User)
      .set({
        ...payload,
        sessionVersion: () => '"session_version" + 1'
      } as unknown as Partial<User>)
      .where('id = :id', { id })
      .execute();
    this.clearReadCaches();
  }

  async revokeAllSessions(id: string) {
    await this.repo.createQueryBuilder()
      .update(User)
      .set({
        sessionVersion: () => '"session_version" + 1'
      } as unknown as Partial<User>)
      .where('id = :id', { id })
      .execute();
    this.clearReadCaches();
  }
}
