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
import { User } from '../users/user.entity';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { ADMIN_ROLES, SOLICITACAO_STATUS, UserRole } from '../common/domain/access.constants';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { MailService } from '../mail/mail.service';

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
    private readonly notificacoesService: NotificacoesService,
    private readonly mailService: MailService,
    private readonly config: ConfigService
  ) {
    this.maxAttemptsPerWindow = Math.max(Number(this.config.get('abuseProtection.accessRequestMaxAttempts') || 5), 1);
    this.rateWindowMs = Math.max(Number(this.config.get('abuseProtection.accessRequestWindowSeconds') || 900), 60) * 1000;
    this.cooldownMs = Math.max(Number(this.config.get('abuseProtection.accessRequestCooldownSeconds') || 900), 60) * 1000;
    this.duplicateWindowHours = Math.max(Number(this.config.get('abuseProtection.accessRequestDuplicateWindowHours') || 24), 1);
  }

  private normalizeRole(value?: string) {
    return String(value || '').trim().toLowerCase();
  }

  private normalizeNotificationText(value?: string | null) {
    const normalized = String(value || '').trim();
    return normalized || undefined;
  }

  private async notifySafe(fn: () => Promise<unknown>) {
    try {
      await fn();
    } catch {
      // Notificacoes nao devem quebrar o fluxo principal.
    }
  }

  private async resolveRequestUserId(solicitacao: SolicitacaoAcesso) {
    const approvedUserId = this.normalizeNotificationText(solicitacao.approvedUserId);
    if (approvedUserId) {
      return approvedUserId;
    }

    const email = String(solicitacao.email || '').trim().toLowerCase();
    if (email) {
      const byEmail = await this.usersService.findByEmail(email);
      if (byEmail?.id) return byEmail.id;
    }

    const cpf = this.normalizeCpfForLookup(solicitacao.cpf);
    if (cpf) {
      const byCpf = await this.usersService.findByCpf(cpf);
      if (byCpf?.id) return byCpf.id;
    }

    return undefined;
  }

  private async notifyAdminsAccessRequestCreated(solicitacao: SolicitacaoAcesso) {
    const titulo = 'Nova solicitacao de acesso';
    const nome = this.normalizeNotificationText(solicitacao.nome) || 'Usuario';
    const email = String(solicitacao.email || '').trim().toLowerCase();
    const cargo = this.normalizeNotificationText(solicitacao.cargoSolicitado) || 'perfil informado';
    const mensagem = `${nome} (${email}) solicitou acesso para ${cargo}.`;

    await this.notifySafe(() =>
      this.notificacoesService.createForRoles([...ADMIN_ROLES], {
        titulo,
        mensagem,
        tipo: 'acao'
      })
    );
  }

  private async notifyRequestDecisionToUser(solicitacao: SolicitacaoAcesso, status: 'aprovado' | 'recusado') {
    const userId = await this.resolveRequestUserId(solicitacao);
    if (!userId) return;

    const titulo = status === 'aprovado'
      ? 'Solicitacao aprovada'
      : 'Solicitacao recusada';
    const mensagem = status === 'aprovado'
      ? 'Sua solicitacao de acesso foi aprovada. Entre em contato com a administracao para validar o primeiro acesso.'
      : 'Sua solicitacao de acesso foi recusada. Entre em contato com a administracao para mais detalhes.';

    await this.notifySafe(() =>
      this.notificacoesService.createForUsers([userId], {
        titulo,
        mensagem,
        tipo: status === 'aprovado' ? 'sucesso' : 'alerta'
      })
    );
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

  private normalizeCpfForLookup(cpf?: string) {
    const digits = String(cpf || '').replace(/\D/g, '');
    return digits.length === 11 ? digits : undefined;
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
    await this.notifyAdminsAccessRequestCreated(saved);
    return saved;
  }

  async update(id: string, dto: AtualizarSolicitacaoDto) {
    const solicitacao = await this.findById(id);
    if (!solicitacao) {
      throw new NotFoundException('Solicitacao nao encontrada.');
    }
    const previousStatus = this.normalizeRole(solicitacao.status);
    const status = this.normalizeText(dto.status)?.toLowerCase();
    const normalizedStatus = status
      ? SOLICITACAO_STATUS.find((candidate) => candidate === status)
      : undefined;
    if (status && !normalizedStatus) {
      throw new BadRequestException('Status de solicitacao invalido.');
    }
    const merged = this.repo.merge(solicitacao, {
      ...dto,
      status: normalizedStatus || solicitacao.status,
      diretoria: this.normalizeText(dto.diretoria),
      projetoNome: this.normalizeText(dto.projetoNome)
    });
    const saved = await this.repo.save(merged);
    this.realtime.emit('solicitacoes-acesso.updated', saved);

    const nextStatus = this.normalizeRole(saved.status);
    if (nextStatus !== previousStatus && (nextStatus === 'aprovado' || nextStatus === 'recusado')) {
      await this.notifyRequestDecisionToUser(saved, nextStatus as 'aprovado' | 'recusado');
    }
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

  private async findExistingUserForApproval(
    userRepo: Repository<User>,
    lookup: { approvedUserId?: string | null; email: string; cpf?: string }
  ) {
    const approvedUserId = this.normalizeText(lookup.approvedUserId || undefined);
    if (approvedUserId) {
      const linkedUser = await userRepo.findOne({ where: { id: approvedUserId } });
      if (linkedUser) return linkedUser;
    }

    if (lookup.cpf) {
      const cpfUser = await userRepo.findOne({ where: { cpf: lookup.cpf } });
      if (cpfUser) return cpfUser;
    }

    return userRepo.findOne({ where: { email: lookup.email } });
  }

  async approveAndCreateUser(id: string, fallbackCargo?: string) {
    const result = await this.repo.manager.transaction(async (manager) => {
      const solicitacaoRepo = manager.getRepository(SolicitacaoAcesso);
      const userRepo = manager.getRepository(User);
      const solicitacao = await solicitacaoRepo.createQueryBuilder('solicitacao')
        .where('solicitacao.id = :id', { id })
        .setLock('pessimistic_write')
        .getOne();

      if (!solicitacao) {
        throw new NotFoundException('Solicitacao nao encontrada.');
      }

      const currentStatus = String(solicitacao.status || '').toLowerCase();
      if (currentStatus === 'recusado') {
        throw new ConflictException('Solicitacao recusada nao pode ser aprovada.');
      }
      const becameApprovedNow = currentStatus !== 'aprovado';

      const email = String(solicitacao.email || '').trim().toLowerCase();
      if (!email) {
        throw new BadRequestException('Solicitacao sem email valido.');
      }

      const role = this.resolveUserRole(fallbackCargo || solicitacao.cargoSolicitado);
      const cpf = this.normalizeCpfForLookup(solicitacao.cpf);

      let existingUser = await this.findExistingUserForApproval(userRepo, {
        approvedUserId: solicitacao.approvedUserId,
        email,
        cpf
      });

      const userExistedBeforeApproval = !!existingUser;
      let createdUserId = existingUser?.id || null;

      if (!existingUser) {
        const payload: CreateUserDto = {
          email,
          name: this.normalizeText(solicitacao.nome) || 'Usuario',
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
        const result = await this.usersService.createWithTempPassword(payload, { manager, deferInvitation: true });
        createdUserId = result.user.id;
        existingUser = await userRepo.findOne({ where: { id: createdUserId } });
      }

      const changes: Partial<SolicitacaoAcesso> = {};
      if (currentStatus !== 'aprovado') {
        changes.status = 'aprovado';
      }
      if (!solicitacao.approvedAt) {
        changes.approvedAt = new Date();
      }
      if (createdUserId && solicitacao.approvedUserId !== createdUserId) {
        changes.approvedUserId = createdUserId;
      }

      let saved = solicitacao;
      if (Object.keys(changes).length > 0) {
        saved = await solicitacaoRepo.save(solicitacaoRepo.merge(solicitacao, changes));
        this.realtime.emit('solicitacoes-acesso.updated', saved);
      }

      return {
        solicitacao: saved,
        becameApprovedNow,
        user: {
          id: createdUserId,
          email: existingUser?.email,
          existed: userExistedBeforeApproval,
          role
        }
      };
    });

    if (result?.solicitacao?.status === 'aprovado' && result?.becameApprovedNow) {
      await this.notifyRequestDecisionToUser(result.solicitacao, 'aprovado');

    }
    const activation = result.becameApprovedNow && !result.user.existed && result.user.id
      ? await this.usersService.sendActivationLink(result.user.id)
      : undefined;

    return { ...result, activation };
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
