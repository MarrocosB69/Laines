import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { SolicitacaoAcesso } from './solicitacao-acesso.entity';
import { CriarSolicitacaoDto } from './dto/criar-solicitacao.dto';
import { AtualizarSolicitacaoDto } from './dto/atualizar-solicitacao.dto';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { SOLICITACAO_STATUS, UserRole } from '../common/domain/access.constants';

type RequestLimitState = {
  count: number;
  windowStartedAt: number;
  blockedUntil: number;
};

@Injectable()
export class SolicitacoesService {
  private readonly creationAttempts = new Map<string, RequestLimitState>();
  private readonly maxAttemptsPerWindow: number;
  private readonly rateWindowMs: number;
  private readonly cooldownMs: number;
  private readonly duplicateWindowHours: number;

  constructor(
    @InjectRepository(SolicitacaoAcesso) private repo: Repository<SolicitacaoAcesso>,
    private realtime: RealtimeGateway,
    private readonly usersService: UsersService,
    private readonly config: ConfigService
  ) {
    this.maxAttemptsPerWindow = Math.max(Number(this.config.get('abuseProtection.accessRequestMaxAttempts') || 5), 1);
    this.rateWindowMs = Math.max(Number(this.config.get('abuseProtection.accessRequestWindowSeconds') || 900), 60) * 1000;
    this.cooldownMs = Math.max(Number(this.config.get('abuseProtection.accessRequestCooldownSeconds') || 900), 60) * 1000;
    this.duplicateWindowHours = Math.max(Number(this.config.get('abuseProtection.accessRequestDuplicateWindowHours') || 24), 1);
  }

  async findAll(limit?: number, offset?: number) {
    const qb = this.repo.createQueryBuilder('solicitacao')
      .orderBy('solicitacao.createdAt', 'DESC');
    if (Number.isFinite(limit)) {
      qb.take(limit!);
    }
    if (Number.isFinite(offset)) {
      qb.skip(offset!);
    }
    return qb.getMany();
  }

  findById(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  private normalizeCpf(cpf?: string) {
    const digits = String(cpf || '').replace(/\D/g, '');
    if (digits.length !== 11) {
      throw new BadRequestException('CPF invalido.');
    }
    return digits;
  }

  private normalizeText(value?: string) {
    const normalized = String(value || '').trim();
    return normalized || undefined;
  }

  private normalizeDate(value?: string) {
    const normalized = this.normalizeText(value);
    if (!normalized) return undefined;
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Data de nascimento invalida.');
    }
    return normalized;
  }

  private cleanupRateLimits() {
    if (this.creationAttempts.size === 0) return;
    const now = Date.now();
    this.creationAttempts.forEach((state, key) => {
      const windowExpired = now - state.windowStartedAt > this.rateWindowMs;
      const notBlocked = state.blockedUntil <= now;
      if (windowExpired && notBlocked) {
        this.creationAttempts.delete(key);
      }
    });
  }

  private registerRequestAttempt(clientIp: string) {
    const key = `ip:${clientIp || 'unknown'}`;
    const now = Date.now();
    const current = this.creationAttempts.get(key);
    if (!current) {
      this.creationAttempts.set(key, {
        count: 1,
        windowStartedAt: now,
        blockedUntil: 0
      });
      return;
    }

    if (current.blockedUntil > now) {
      return;
    }

    if (now - current.windowStartedAt > this.rateWindowMs) {
      current.windowStartedAt = now;
      current.count = 1;
      current.blockedUntil = 0;
      this.creationAttempts.set(key, current);
      return;
    }

    current.count += 1;
    if (current.count > this.maxAttemptsPerWindow) {
      current.blockedUntil = now + this.cooldownMs;
    }
    this.creationAttempts.set(key, current);
  }

  private assertRateLimit(clientIp: string) {
    this.cleanupRateLimits();
    const key = `ip:${clientIp || 'unknown'}`;
    const current = this.creationAttempts.get(key);
    if (!current) return;
    const now = Date.now();
    if (current.blockedUntil > now) {
      const seconds = Math.ceil((current.blockedUntil - now) / 1000);
      throw new HttpException(
        `Muitas tentativas. Tente novamente em ${seconds}s.`,
        HttpStatus.TOO_MANY_REQUESTS
      );
    }
  }

  private async assertNoRecentDuplicate(email: string, cpf: string) {
    const duplicateSince = new Date(Date.now() - (this.duplicateWindowHours * 60 * 60 * 1000));

    const existingPending = await this.repo.findOne({
      where: [
        {
          email,
          status: 'pendente',
          createdAt: MoreThan(duplicateSince)
        },
        {
          cpf,
          status: 'pendente',
          createdAt: MoreThan(duplicateSince)
        }
      ]
    });

    if (existingPending) {
      throw new ConflictException('Ja existe uma solicitacao pendente para este CPF ou email.');
    }
  }

  private normalizeCreatePayload(dto: CriarSolicitacaoDto) {
    const email = String(dto.email || '').trim().toLowerCase();
    const nome = this.normalizeText(dto.nome);
    const cpf = this.normalizeCpf(dto.cpf);
    const dataNascimento = this.normalizeDate(dto.dataNascimento);
    if (!nome || !email) {
      throw new BadRequestException('Nome e email sao obrigatorios.');
    }

    return {
      nome,
      email,
      cpf,
      dataNascimento,
      telefone: this.normalizeText(dto.telefone),
      area: this.normalizeText(dto.area),
      cargoSolicitado: this.normalizeText(dto.cargoSolicitado),
      matricula: this.normalizeText(dto.matricula),
      conselhoTipo: this.normalizeText(dto.conselhoTipo),
      conselhoNumero: this.normalizeText(dto.conselhoNumero),
      instituicao: this.normalizeText(dto.instituicao),
      diretoria: this.normalizeText(dto.diretoria),
      projetoId: dto.projetoId || undefined,
      projetoNome: this.normalizeText(dto.projetoNome),
      justificativa: this.normalizeText(dto.justificativa)
    };
  }

  async create(dto: CriarSolicitacaoDto, clientIp = 'unknown') {
    this.assertRateLimit(clientIp);
    this.registerRequestAttempt(clientIp);
    const normalized = this.normalizeCreatePayload(dto);
    const existingUser = await this.usersService.findByEmail(normalized.email);
    if (existingUser) {
      throw new ConflictException('Ja existe usuario ativo para este email.');
    }
    await this.assertNoRecentDuplicate(normalized.email, normalized.cpf);

    const solicitacao = this.repo.create({
      ...normalized,
      status: 'pendente',
      origem: 'landing'
    });
    const saved = await this.repo.save(solicitacao);
    this.realtime.emit('solicitacoes-acesso.created', saved);
    return saved;
  }

  async update(id: string, dto: AtualizarSolicitacaoDto) {
    const solicitacao = await this.findById(id);
    if (!solicitacao) {
      throw new NotFoundException('Solicitacao nao encontrada.');
    }
    const status = this.normalizeText(dto.status)?.toLowerCase();
    const normalizedStatus = status
      ? (SOLICITACAO_STATUS.includes(status as any) ? status : undefined)
      : undefined;
    if (status && !normalizedStatus) {
      throw new BadRequestException('Status de solicitacao invalido.');
    }
    const merged = this.repo.merge(solicitacao, {
      ...dto,
      status: normalizedStatus || solicitacao.status,
      diretoria: this.normalizeText(dto.diretoria),
      projetoNome: this.normalizeText(dto.projetoNome)
    } as any);
    const saved = await this.repo.save(merged);
    this.realtime.emit('solicitacoes-acesso.updated', saved);
    return saved;
  }

  private resolveUserRole(cargoSolicitado?: string): UserRole {
    const normalized = this.normalizeText(cargoSolicitado)?.toLowerCase();
    if (normalized === 'professor') return 'professor';
    if (normalized === 'profissional') return 'profissional';
    if (normalized === 'pesquisador') return 'pesquisador';
    if (normalized === 'parceiro' || normalized === 'colaborador') return 'colaborador';
    return 'professor';
  }

  async approveAndCreateUser(id: string, fallbackCargo?: string) {
    const solicitacao = await this.findById(id);
    if (!solicitacao) {
      throw new NotFoundException('Solicitacao nao encontrada.');
    }
    const currentStatus = String(solicitacao.status || '').toLowerCase();
    if (currentStatus === 'recusado') {
      throw new ConflictException('Solicitacao recusada nao pode ser aprovada.');
    }

    const email = String(solicitacao.email || '').trim().toLowerCase();
    if (!email) {
      throw new BadRequestException('Solicitacao sem email valido.');
    }

    const role = this.resolveUserRole(fallbackCargo || solicitacao.cargoSolicitado);
    let existingUser = await this.usersService.findByEmail(email);
    const userExistedBeforeApproval = !!existingUser;
    let tempPassword: string | null = null;
    let createdUserId = existingUser?.id || null;

    if (currentStatus === 'aprovado' && existingUser) {
      return {
        solicitacao,
        user: {
          id: existingUser.id,
          existed: true,
          role
        },
        tempPassword: null
      };
    }

    if (!existingUser) {
      const payload: CreateUserDto = {
        name: this.normalizeText(solicitacao.nome) || 'Usuario',
        email,
        role,
        cpf: this.normalizeText(solicitacao.cpf),
        dataNascimento: this.normalizeText(solicitacao.dataNascimento),
        telefone: this.normalizeText(solicitacao.telefone),
        diretoria: this.normalizeText(solicitacao.diretoria),
        projetoId: solicitacao.projetoId || undefined,
        projetoNome: this.normalizeText(solicitacao.projetoNome),
        matricula: this.normalizeText(solicitacao.matricula),
        conselhoTipo: this.normalizeText(solicitacao.conselhoTipo),
        conselhoNumero: this.normalizeText(solicitacao.conselhoNumero),
        status: 'ativo'
      };
      const result = await this.usersService.createWithTempPassword(payload);
      createdUserId = result.user.id;
      tempPassword = result.tempPassword;
      existingUser = await this.usersService.findById(createdUserId);
    }

    const saved = currentStatus === 'aprovado'
      ? solicitacao
      : await this.repo.save(this.repo.merge(solicitacao, { status: 'aprovado' }));
    this.realtime.emit('solicitacoes-acesso.updated', saved);
    return {
      solicitacao: saved,
      user: {
        id: createdUserId,
        existed: userExistedBeforeApproval,
        role
      },
      tempPassword
    };
  }

  async remove(id: string) {
    const solicitacao = await this.findById(id);
    if (!solicitacao) {
      throw new NotFoundException('Solicitacao nao encontrada.');
    }
    await this.repo.delete(id);
    this.realtime.emit('solicitacoes-acesso.deleted', { id });
    return { success: true };
  }
}
