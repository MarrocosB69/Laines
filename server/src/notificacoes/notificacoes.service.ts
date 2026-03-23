import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notificacao } from './notificacao.entity';
import { CriarNotificacaoDto } from './dto/criar-notificacao.dto';
import { AtualizarNotificacaoDto } from './dto/atualizar-notificacao.dto';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { AuthenticatedUser, hasGlobalAccess } from '../auth/access-control';

type FiltrosNotificacao = {
  requesterId?: string;
  requesterRole?: string;
  userId?: string;
};

@Injectable()
export class NotificacoesService {
  constructor(
    @InjectRepository(Notificacao) private repo: Repository<Notificacao>,
    private realtime: RealtimeGateway
  ) {}

  findAll(filtros: FiltrosNotificacao) {
    const qb = this.repo.createQueryBuilder('notificacao')
      .orderBy('notificacao.createdAt', 'DESC');

    const requesterRole = String(filtros.requesterRole || '').trim().toLowerCase();
    const isGlobal = hasGlobalAccess(requesterRole);

    if (!isGlobal) {
      if (!filtros.requesterId) {
        qb.andWhere('1 = 0');
      } else {
        qb.andWhere('notificacao.userId = :userId', { userId: filtros.requesterId });
      }
      return qb.getMany();
    }

    if (filtros.userId) {
      qb.andWhere('notificacao.userId = :userId', { userId: filtros.userId });
    }

    return qb.getMany();
  }

  findById(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  async create(dto: CriarNotificacaoDto, requester?: AuthenticatedUser) {
    const requesterRole = String(requester?.role || '').trim().toLowerCase();
    const isGlobal = hasGlobalAccess(requesterRole);
    const targetUserId = isGlobal
      ? (dto.userId || requester?.id)
      : requester?.id;

    const notificacao = this.repo.create({
      ...dto,
      userId: targetUserId,
      tipo: dto.tipo || 'info'
    });
    const saved = await this.repo.save(notificacao);
    this.realtime.emit('notificacoes.created', saved);
    return saved;
  }

  async update(id: string, dto: AtualizarNotificacaoDto) {
    const notificacao = await this.findById(id);
    if (!notificacao) {
      throw new NotFoundException('Notificacao nao encontrada.');
    }
    const merged = this.repo.merge(notificacao, dto as any);
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
    this.realtime.emit('notificacoes.deleted', { id });
    return { success: true };
  }
}
