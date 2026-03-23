import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Optional
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { User } from './user.entity';
import { Projeto } from '../projetos/projeto.entity';
import { ObservabilityService } from '../observability/observability.service';
import * as bcrypt from 'bcryptjs';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { USER_ROLES, USER_STATUS, isStudentMemberRole } from '../common/domain/access.constants';
import type { UpdateProfileDto } from '../auth/dto/update-profile.dto';

const CACHE_MISS = Symbol('CACHE_MISS');
type AuthLookupUser = Pick<User, 'id' | 'email' | 'passwordHash' | 'role' | 'name' | 'status' | 'mustChangePassword' | 'sessionVersion'>;

@Injectable()
export class UsersService {
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
    @Optional() private readonly observability?: ObservabilityService
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

  private clearReadCaches() {
    this.authByEmailCache.clear();
    this.userByIdCache.clear();
  }

  private normalizeCpf(cpf?: string) {
    const digits = String(cpf || '').replace(/\D/g, '');
    return digits || undefined;
  }

  private normalizePhone(value?: string) {
    const digits = String(value || '').replace(/\D/g, '');
    return digits || undefined;
  }

  private sanitizeString(value?: string) {
    const normalized = String(value || '').trim();
    return normalized || undefined;
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
      throw new BadRequestException('Aluno deve possuir professor supervisor cadastrado.');
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
    if (supervisorRole !== 'professor') {
      throw new BadRequestException('Supervisor deve ser um professor cadastrado.');
    }

    if (String(supervisor.status || '').toLowerCase() !== 'ativo') {
      throw new BadRequestException('Professor supervisor precisa estar com status ativo.');
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

  private toPublic(user: User, includeTemporaryPassword = false) {
    if (!user) return user;
    const { passwordHash, tempPassword, ...rest } = user;
    if (!includeTemporaryPassword) {
      return rest;
    }
    return {
      ...rest,
      temporaryPassword: rest.mustChangePassword ? (tempPassword || null) : null,
      hasTemporaryPassword: !!(rest.mustChangePassword && tempPassword),
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

  async listActiveSupervisors() {
    const professors = await this.repo.createQueryBuilder('user')
      .select(['user.id AS id', 'user.name AS name'])
      .where('LOWER(user.role) = :role', { role: 'professor' })
      .andWhere('LOWER(user.status) = :status', { status: 'ativo' })
      .orderBy('user.name', 'ASC')
      .getRawMany<{ id: string; name: string }>();

    return professors.map((item) => ({
      id: item.id,
      name: item.name
    }));
  }

  findByEmail(email: string) {
    return this.repo.findOne({ where: { email: String(email || '').trim().toLowerCase() } });
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
        must_change_password as "mustChangePassword",
        session_version as "sessionVersion"
      from users
      where email = $1
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

  async createWithTempPassword(dto: CreateUserDto) {
    const normalizedName = this.sanitizeString(dto.name) || dto.name;
    const email = await this.buildAvailableInstitutionalEmail(normalizedName);

    const tempPassword = this.buildTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const normalizedRole = this.normalizeRole(dto.role);
    const normalizedStatus = this.normalizeStatus(dto.status);
    const alunoVinculos = await this.resolveAlunoVinculosOrThrow({
      role: normalizedRole,
      supervisorId: dto.supervisorId,
      projetoId: dto.projetoId
    });
    const user = await this.create({
      ...dto,
      ...(alunoVinculos || {}),
      email,
      role: normalizedRole,
      status: normalizedStatus,
      cpf: this.normalizeCpf(dto.cpf),
      name: normalizedName,
      passwordHash,
      tempPassword,
      mustChangePassword: true
    });

    return {
      user: this.toPublic(user, true),
      tempPassword
    };
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('Usuario nao encontrado.');
    }
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
    const alunoVinculos = await this.resolveAlunoVinculosOrThrow({
      role: nextRole,
      supervisorId: nextSupervisorId,
      projetoId: nextProjetoId
    });

    const nextName = Object.prototype.hasOwnProperty.call(dto, 'name')
      ? (this.sanitizeString(dto.name) || dto.name)
      : user.name;
    if (Object.prototype.hasOwnProperty.call(dto, 'role')) {
      payload.role = nextRole;
    }
    if (Object.prototype.hasOwnProperty.call(dto, 'status')) {
      payload.status = this.normalizeStatus(dto.status);
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

    const shouldBumpSessionVersion = Object.prototype.hasOwnProperty.call(dto, 'role')
      || Object.prototype.hasOwnProperty.call(dto, 'status')
      || Object.prototype.hasOwnProperty.call(dto, 'email');

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
    return this.toPublic(updated, true);
  }

  async updateSelfProfile(id: string, dto: UpdateProfileDto) {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('Usuario nao encontrado.');
    }

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
    return this.toPublic(updated, false);
  }

  async remove(id: string) {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('Usuario nao encontrado.');
    }
    await this.repo.delete(id);
    this.clearReadCaches();
    return { success: true };
  }

  async resetTemporaryPassword(id: string) {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('Usuario nao encontrado.');
    }

    const tempPassword = this.buildTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    await this.repo.createQueryBuilder()
      .update(User)
      .set({
        passwordHash,
        tempPassword,
        mustChangePassword: true,
        sessionVersion: () => '"session_version" + 1'
      } as unknown as Partial<User>)
      .where('id = :id', { id })
      .execute();
    this.clearReadCaches();

    const updated = await this.findById(id);
    if (!updated) {
      throw new NotFoundException('Usuario nao encontrado.');
    }

    return {
      user: this.toPublic(updated, true),
      tempPassword
    };
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
