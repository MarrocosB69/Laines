import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tarefa } from './tarefa.entity';
import { CriarTarefaDto } from './dto/criar-tarefa.dto';
import { AtualizarTarefaDto } from './dto/atualizar-tarefa.dto';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { AuthenticatedUser, normalizeRole } from '../auth/access-control';
import { ADMIN_ROLES } from '../common/domain/access.constants';

type FiltrosTarefa = {
  assignedRole?: string;
  status?: string;
};

@Injectable()
export class TarefasService {
  constructor(
    @InjectRepository(Tarefa) private repo: Repository<Tarefa>,
    private realtime: RealtimeGateway
  ) {}

  private hasTaskGlobalAccess(role?: string) {
    return (ADMIN_ROLES as readonly string[]).includes(normalizeRole(role));
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

  private normalizeDiretoriaRole(value?: string | null) {
    const normalized = this.normalizeAudienceToken(value);
    if (!normalized) return '';
    if (normalized === 'coord_atendimento' || normalized.includes('atendimento')) {
      return 'coord_atendimento';
    }
    if (normalized.startsWith('diretoria_')) return normalized;
    return `diretoria_${normalized.replace(/^de_/, '')}`;
  }

  private getAudienceRoles(user: AuthenticatedUser) {
    const roles = new Set<string>();
    const role = normalizeRole(user?.role);
    if (role) roles.add(role);

    const diretoriaRole = this.normalizeDiretoriaRole(user?.diretoria);
    if (diretoriaRole) roles.add(diretoriaRole);

    if (user?.coordAtendimento) {
      roles.add('coord_atendimento');
    }

    return Array.from(roles);
  }

  private canAccessTask(user: AuthenticatedUser, tarefa: Tarefa) {
    const role = normalizeRole(user?.role);
    if (this.hasTaskGlobalAccess(role)) return true;
    const assignedRole = normalizeRole(tarefa.assignedRole || 'todos');
    const audienceRoles = this.getAudienceRoles(user);
    return !assignedRole || assignedRole === 'todos' || audienceRoles.includes(assignedRole);
  }

  findAll(user: AuthenticatedUser, filtros: FiltrosTarefa) {
    const qb = this.repo.createQueryBuilder('tarefa')
      .orderBy('tarefa.createdAt', 'DESC');
    const role = normalizeRole(user?.role);
    if (!this.hasTaskGlobalAccess(role)) {
      const audienceRoles = this.getAudienceRoles(user);
      if (audienceRoles.length === 0) {
        qb.andWhere('tarefa.assignedRole = :todos', { todos: 'todos' });
      } else {
        qb.andWhere('(tarefa.assignedRole IN (:...audienceRoles) OR tarefa.assignedRole = :todos)', {
          audienceRoles,
          todos: 'todos'
        });
      }
    }

    if (filtros.assignedRole) {
      qb.andWhere('tarefa.assignedRole = :assignedRole', { assignedRole: filtros.assignedRole });
    }
    if (filtros.status) {
      qb.andWhere('tarefa.status = :status', { status: filtros.status });
    }

    return qb.getMany();
  }

  findById(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  async create(dto: CriarTarefaDto) {
    const tarefa = this.repo.create({
      ...dto,
      status: dto.status || 'pendente',
      assignedRole: dto.assignedRole || 'todos'
    });
    const saved = await this.repo.save(tarefa);
    this.realtime.emit('tarefas.created', saved);
    return saved;
  }

  async update(id: string, dto: AtualizarTarefaDto) {
    const tarefa = await this.findById(id);
    if (!tarefa) {
      throw new NotFoundException('Tarefa nao encontrada.');
    }
    const merged = this.repo.merge(tarefa, dto as any);
    const saved = await this.repo.save(merged);
    this.realtime.emit('tarefas.updated', saved);
    return saved;
  }

  async resolve(id: string, user: AuthenticatedUser) {
    const tarefa = await this.findById(id);
    if (!tarefa || !this.canAccessTask(user, tarefa)) {
      throw new NotFoundException('Tarefa nao encontrada.');
    }

    if (tarefa.status !== 'concluida') {
      tarefa.status = 'concluida';
    }

    const saved = await this.repo.save(tarefa);
    this.realtime.emit('tarefas.updated', saved);
    return saved;
  }

  async remove(id: string) {
    const tarefa = await this.findById(id);
    if (!tarefa) {
      throw new NotFoundException('Tarefa nao encontrada.');
    }
    await this.repo.delete(id);
    this.realtime.emit('tarefas.deleted', { id });
    return { success: true };
  }
}
