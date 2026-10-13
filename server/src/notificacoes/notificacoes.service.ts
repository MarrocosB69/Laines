import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notificacao } from './notificacao.entity';
import { CriarNotificacaoDto } from './dto/criar-notificacao.dto';
import { AtualizarNotificacaoDto } from './dto/atualizar-notificacao.dto';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { AuthenticatedUser, hasGlobalAccess } from '../auth/access-control';
import { User } from '../users/user.entity';

type FiltrosNotificacao = {
  requesterId?: string;
  requesterRole?: string;
  userId?: string;
  includeResolved?: boolean;
};

@Injectable()
export class NotificacoesService {
  constructor(
    @InjectRepository(Notificacao) private repo: Repository<Notificacao>,
    @InjectRepository(User) private usersRepo: Repository<User>,
    private realtime: RealtimeGateway
  ) {}

  private normalizeText(value?: string | null) {
    const normalized = String(value || '').trim();
    return normalized || undefined;
  }

  private normalizeRole(value?: string | null) {
    return String(value || '').trim().toLowerCase();
  }

  private normalizeAudienceToken(value?: string | null) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s-]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  private normalizeDiretoria(value?: string | null) {
    const normalized = this.normalizeAudienceToken(value);
    if (!normalized) return '';
    if (normalized === 'coord_atendimento' || normalized.includes('atendimento')) {
      return 'coord_atendimento';
    }
    return normalized.replace(/^diretoria_/, '').replace(/^de_/, '');
  }

  private normalizeDiretoriaRole(value?: string | null) {
    const diretoria = this.normalizeDiretoria(value);
    if (!diretoria) return '';
    if (diretoria === 'coord_atendimento') return 'coord_atendimento';
    return `diretoria_${diretoria}`;
  }

  private uniqueNonEmpty(values: Array<string | undefined>) {
    return Array.from(new Set(
      values
        .map((value) => this.normalizeText(value))
        .filter((value): value is string => Boolean(value))
    ));
  }

  private async createInternal(payload: CriarNotificacaoDto, targetUserId?: string) {
    const notificacao = this.repo.create({
      titulo: this.normalizeText(payload.titulo) || 'Notificacao',
      mensagem: this.normalizeText(payload.mensagem) || '',
      tipo: this.normalizeText(payload.tipo) || 'info',
      userId: this.normalizeText(targetUserId)
    });
    const saved = await this.repo.save(notificacao);
    this.realtime.emit('notificacoes.created', saved);
    return saved;
  }

  findAll(filtros: FiltrosNotificacao) {
    const qb = this.repo.createQueryBuilder('notificacao')
      .orderBy('notificacao.createdAt', 'DESC');

    const requesterRole = String(filtros.requesterRole || '').trim().toLowerCase();
    const isGlobal = hasGlobalAccess(requesterRole);

    if (!filtros.includeResolved) {
      qb.andWhere('notificacao.readAt IS NULL');
    }

    if (isGlobal && filtros.userId) {
      qb.andWhere('notificacao.userId = :userId', { userId: filtros.userId });
      return qb.getMany();
    }

    if (!filtros.requesterId) {
      qb.andWhere('1 = 0');
    } else {
      qb.andWhere('notificacao.userId = :userId', { userId: filtros.requesterId });
    }

    return qb.getMany();
  }

  findById(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  async create(dto: CriarNotificacaoDto, requester?: AuthenticatedUser) {
    const requesterRole = String(requester?.role || '').trim().toLowerCase();
    const isGlobal = hasGlobalAccess(requesterRole);

    if (!isGlobal) {
      return this.createInternal(dto, requester?.id);
    }

    const roleTargets = this.uniqueNonEmpty([
      dto.targetRole,
      ...(Array.isArray(dto.targetRoles) ? dto.targetRoles : [])
    ]);
    const diretoriaTargets = this.uniqueNonEmpty([
      dto.targetDiretoria,
      ...(Array.isArray(dto.targetDiretorias) ? dto.targetDiretorias : [])
    ]);

    if (roleTargets.length > 0 || diretoriaTargets.length > 0) {
      return this.createForAudience(roleTargets, diretoriaTargets, dto);
    }

    return this.createInternal(dto, dto.userId || requester?.id);
  }

  async createForUsers(userIds: string[], dto: Omit<CriarNotificacaoDto, 'userId'>) {
    const targets = this.uniqueNonEmpty(userIds);
    if (targets.length === 0) return [];

    const savedItems: Notificacao[] = [];
    for (const userId of targets) {
      const saved = await this.createInternal(
        {
          ...dto,
          userId
        },
        userId
      );
      savedItems.push(saved);
    }
    return savedItems;
  }

  async createForRoles(roles: string[], dto: Omit<CriarNotificacaoDto, 'userId'>) {
    return this.createForAudience(roles, [], dto);
  }

  async createForDiretorias(diretorias: string[], dto: Omit<CriarNotificacaoDto, 'userId'>) {
    return this.createForAudience([], diretorias, dto);
  }

  async createForAudience(
    roles: string[],
    diretorias: string[],
    dto: Omit<CriarNotificacaoDto, 'userId'>
  ) {
    const normalizedRoles = this.uniqueNonEmpty([
      ...roles.map((role) => this.normalizeRole(role)),
      ...diretorias.map((diretoria) => this.normalizeDiretoriaRole(diretoria))
    ]);
    const normalizedDiretorias = this.uniqueNonEmpty(
      diretorias.map((diretoria) => this.normalizeDiretoria(diretoria))
    );
    const targetsAll = normalizedRoles.includes('todos') || normalizedDiretorias.includes('todos');

    if (normalizedRoles.length === 0 && !targetsAll) return [];

    const users = await this.usersRepo.createQueryBuilder('user')
      .select(['user.id', 'user.role', 'user.diretoria'])
      .andWhere('LOWER(user.status) = :status', { status: 'ativo' })
      .getMany();

    const userIds = users
      .filter((user) => {
        if (targetsAll) return true;
        const userRole = this.normalizeRole(user.role);
        const userDiretoria = this.normalizeDiretoria(user.diretoria);
        return normalizedRoles.includes(userRole)
          || (userDiretoria ? normalizedDiretorias.includes(userDiretoria) : false);
      })
      .map((user) => this.normalizeText(user.id))
      .filter(Boolean) as string[];
    return this.createForUsers(userIds, dto);
  }

  async resolve(id: string, requester: AuthenticatedUser) {
    const notificacao = await this.findById(id);
    if (!notificacao) {
      throw new NotFoundException('Notificacao nao encontrada.');
    }

    const requesterRole = this.normalizeRole(requester?.role);
    const requesterId = this.normalizeText(requester?.id);
    const isGlobal = hasGlobalAccess(requesterRole);

    if (notificacao.userId && notificacao.userId !== requesterId && !isGlobal) {
      throw new NotFoundException('Notificacao nao encontrada.');
    }

    if (!notificacao.readAt) {
      notificacao.readAt = new Date();
    }

    const saved = await this.repo.save(notificacao);
    this.realtime.emit('notificacoes.updated', saved);
    return saved;
  }

  async update(id: string, dto: AtualizarNotificacaoDto) {
    const notificacao = await this.findById(id);
    if (!notificacao) {
      throw new NotFoundException('Notificacao nao encontrada.');
    }
    const merged = this.repo.merge(notificacao, dto);
    const saved = await this.repo.save(merged);
    this.realtime.emit('notificacoes.updated', saved);
    return saved;
  }

  async remove(id: string) {
    const notificacao = await this.findById(id);
    if (!notificacao) {
      throw new NotFoundException('Notificacao nao encontrada.');
    }
    await this.repo.delete(id);
    this.realtime.emit('notificacoes.deleted', { id, userId: notificacao.userId });
    return { success: true };
  }
}
