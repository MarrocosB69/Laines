import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, IsNull, Repository } from 'typeorm';
import { Tarefa } from './tarefa.entity';
import { TarefaEvento } from './tarefa-evento.entity';
import { CriarTarefaDto } from './dto/criar-tarefa.dto';
import { AtualizarTarefaDto } from './dto/atualizar-tarefa.dto';
import { ConcluirTarefaDto } from './dto/concluir-tarefa.dto';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { AuthenticatedUser, normalizeRole } from '../auth/access-control';
import { ADMIN_ROLES, USER_ROLES, normalizeDiretoria, roleCanUseDiretoriaPermissions } from '../common/domain/access.constants';

type FiltrosTarefa = {
  assignedRole?: string;
  status?: string;
};

const TASK_STATUSES = new Set(['pendente', 'em_andamento', 'concluida', 'bloqueada']);
const MAX_COMPLETION_NOTE = 1000;

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
    const diretoria = normalizeDiretoria(normalized);
    if (diretoria) return diretoria;
    if (normalized === 'coord_atendimento' || normalized.includes('atendimento')) {
      return 'coord_atendimento';
    }
    if (normalized.startsWith('diretoria_de_')) return `diretoria_${normalized.replace(/^diretoria_de_/, '')}`;
    if (normalized.startsWith('diretoria_')) return normalized;
    return `diretoria_${normalized.replace(/^de_/, '')}`;
  }

  private normalizeTaskStatus(value?: string | null, fallback = 'pendente') {
    const normalized = this.normalizeAudienceToken(value || fallback);
    const mapped = normalized === 'andamento' || normalized === 'em_progresso'
      ? 'em_andamento'
      : normalized;
    if (!TASK_STATUSES.has(mapped)) {
      throw new BadRequestException('Status de tarefa invalido.');
    }
    return mapped;
  }

  private normalizeAssignedRole(value?: string | null) {
    const normalized = this.normalizeAudienceToken(value);
    if (!normalized || normalized === 'todos') return 'todos';
    if (
      normalized.startsWith('diretoria_')
      || ['ensino', 'pesquisa', 'extensao', 'marketing', 'comunicacao', 'comunicacao_social'].includes(normalized)
    ) {
      return this.normalizeDiretoriaRole(normalized);
    }
    return normalized;
  }

  private getAudienceRoles(user: AuthenticatedUser) {
    const roles = new Set<string>();
    const role = normalizeRole(user?.role);
    if (role) roles.add(role);

    const diretoriaRole = roleCanUseDiretoriaPermissions(role)
      ? this.normalizeDiretoriaRole(user?.diretoria) : '';
    if (diretoriaRole) roles.add(diretoriaRole);

    if ((USER_ROLES as readonly string[]).includes(role) && role !== 'atleta' && user?.coordAtendimento) {
      roles.add('coord_atendimento');
    }

    return Array.from(roles);
  }

  private canAccessTask(user: AuthenticatedUser, tarefa: Tarefa) {
    const role = normalizeRole(user?.role);
    if (this.hasTaskGlobalAccess(role)) return true;
    const assignedRole = normalizeRole(tarefa.assignedRole || 'todos');
    const audienceRoles = this.getAudienceRoles(user);
    if (!assignedRole || assignedRole === 'todos') {
      return (USER_ROLES as readonly string[]).includes(role) && role !== 'atleta';
    }
    return audienceRoles.includes(assignedRole);
  }

  private isTeamRole(role: string) {
    return role.startsWith('diretoria_') || role === 'coord_atendimento';
  }

  private normalizeDueDate(value?: string | null) {
    if (value == null || value === '') return null;
    const date = String(value).trim();
    const parsed = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00Z`) : null;
    if (!parsed || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
      throw new BadRequestException('Data de termino invalida. Use AAAA-MM-DD.');
    }
    return date;
  }

  private assertTeamDueDate(role: string, dueDate: string | null) {
    if (this.isTeamRole(role) && !dueDate) {
      throw new BadRequestException('Informe a data de termino da tarefa da equipe.');
    }
  }

  private normalizeCompletionNote(value?: string | null) {
    if (value != null && typeof value !== 'string') {
      throw new BadRequestException('Observacao de conclusao invalida.');
    }
    const note = String(value || '').trim();
    if (note.length > MAX_COMPLETION_NOTE) {
      throw new BadRequestException('Observacao de conclusao deve ter ate 1000 caracteres.');
    }
    return note || null;
  }

  private async recordEvent(manager: EntityManager, task: Tarefa, action: string, user: AuthenticatedUser, details?: Record<string, unknown>) {
    const events = manager.getRepository(TarefaEvento);
    await events.save(events.create({
      taskId: task.id,
      action,
      actorId: user.id,
      actorName: user.name || user.email || null,
      teamRole: task.assignedRole,
      details: details || null
    }));
  }

  private findLockedTask(manager: EntityManager, id: string) {
    return manager.getRepository(Tarefa).createQueryBuilder('tarefa')
      .where('tarefa.id = :id', { id })
      .andWhere('tarefa.archivedAt IS NULL')
      .setLock('pessimistic_write')
      .getOne();
  }

  findAll(user: AuthenticatedUser, filtros: FiltrosTarefa) {
    const qb = this.repo.createQueryBuilder('tarefa')
      .where('tarefa.archivedAt IS NULL')
      .orderBy('tarefa.createdAt', 'DESC');
    const role = normalizeRole(user?.role);
    if (!this.hasTaskGlobalAccess(role)) {
      const audienceRoles = this.getAudienceRoles(user);
      const canViewInstitutional = (USER_ROLES as readonly string[]).includes(role) && role !== 'atleta';
      if (!canViewInstitutional && audienceRoles.length === 0) {
        qb.andWhere('1 = 0');
      } else if (!canViewInstitutional) {
        qb.andWhere('tarefa.assignedRole IN (:...audienceRoles)', { audienceRoles });
      } else if (audienceRoles.length === 0) {
        qb.andWhere('tarefa.assignedRole = :todos', { todos: 'todos' });
      } else {
        qb.andWhere('(tarefa.assignedRole IN (:...audienceRoles) OR tarefa.assignedRole = :todos)', {
          audienceRoles,
          todos: 'todos'
        });
      }
    }

    if (filtros.assignedRole) {
      qb.andWhere('tarefa.assignedRole = :assignedRole', { assignedRole: this.normalizeAssignedRole(filtros.assignedRole) });
    }
    if (filtros.status) {
      qb.andWhere('tarefa.status = :status', { status: this.normalizeTaskStatus(filtros.status) });
    }

    return qb.getMany();
  }

  findById(id: string) {
    return this.repo.findOne({ where: { id, archivedAt: IsNull() } });
  }

  async create(dto: CriarTarefaDto, user: AuthenticatedUser) {
    const title = String(dto.title || '').trim();
    if (title.length < 2) throw new BadRequestException('Titulo da tarefa deve ter ao menos 2 caracteres.');
    const status = this.normalizeTaskStatus(dto.status);
    if (status === 'concluida') throw new BadRequestException('Conclua a tarefa pelo comando de conclusao.');
    const assignedRole = this.normalizeAssignedRole(dto.assignedRole);
    const dueDate = this.normalizeDueDate(dto.dueDate);
    this.assertTeamDueDate(assignedRole, dueDate);
    const saved = await this.repo.manager.transaction(async (manager) => {
      const tasks = manager.getRepository(Tarefa);
      const task = await tasks.save(tasks.create({
        title, status, assignedRole, dueDate,
        createdBy: user.id, createdByName: user.name || user.email || undefined
      }));
      await this.recordEvent(manager, task, 'created', user, { dueDate, status });
      return task;
    });
    this.realtime.emit('tarefas.created', { id: saved.id, assignedRole: saved.assignedRole, status: saved.status });
    return saved;
  }

  async update(id: string, dto: AtualizarTarefaDto, user: AuthenticatedUser) {
    const result = await this.repo.manager.transaction(async (manager) => {
      const tarefa = await this.findLockedTask(manager, id);
      if (!tarefa) throw new NotFoundException('Tarefa nao encontrada.');
      const previousRole = tarefa.assignedRole;
      const events: Array<{ action: string; details: Record<string, unknown> }> = [];
      const nextTitle = Object.prototype.hasOwnProperty.call(dto, 'title') ? String(dto.title || '').trim() : tarefa.title;
      if (nextTitle.length < 2) throw new BadRequestException('Titulo da tarefa deve ter ao menos 2 caracteres.');
      const nextRole = Object.prototype.hasOwnProperty.call(dto, 'assignedRole')
        ? this.normalizeAssignedRole(dto.assignedRole) : tarefa.assignedRole;
      const nextDueDate = Object.prototype.hasOwnProperty.call(dto, 'dueDate')
        ? this.normalizeDueDate(dto.dueDate) : (tarefa.dueDate || null);
      const reopening = tarefa.status === 'concluida'
        && Object.prototype.hasOwnProperty.call(dto, 'status')
        && this.normalizeTaskStatus(dto.status, tarefa.status) !== 'concluida';
      if (tarefa.status === 'concluida' && !reopening
        && (nextRole !== tarefa.assignedRole || nextDueDate !== (tarefa.dueDate || null))) {
        throw new BadRequestException('Reabra a tarefa antes de alterar equipe ou prazo.');
      }
      if (nextRole !== tarefa.assignedRole || Object.prototype.hasOwnProperty.call(dto, 'dueDate')) {
        this.assertTeamDueDate(nextRole, nextDueDate);
      }
      if (Object.prototype.hasOwnProperty.call(dto, 'status')) {
        const nextStatus = this.normalizeTaskStatus(dto.status, tarefa.status);
        if (nextStatus === 'concluida') throw new BadRequestException('Conclua a tarefa pelo comando de conclusao.');
        if (tarefa.status === 'concluida') {
          events.push({ action: 'reopened', details: { previousCompletedAt: tarefa.completedAt, previousCompletedById: tarefa.completedById, previousCompletionNote: tarefa.completionNote } });
          tarefa.completedAt = null;
          tarefa.completedById = null;
          tarefa.completedByName = null;
          tarefa.completionNote = null;
        } else if (nextStatus !== tarefa.status) {
          events.push({ action: 'status_changed', details: { from: tarefa.status, to: nextStatus } });
        }
        tarefa.status = nextStatus;
      }
      if (nextRole !== tarefa.assignedRole) events.push({ action: 'team_changed', details: { from: tarefa.assignedRole, to: nextRole } });
      if (nextDueDate !== (tarefa.dueDate || null)) events.push({ action: 'due_date_changed', details: { from: tarefa.dueDate || null, to: nextDueDate } });
      tarefa.title = nextTitle;
      tarefa.assignedRole = nextRole;
      tarefa.dueDate = nextDueDate;
      const updated = await manager.getRepository(Tarefa).save(tarefa);
      for (const event of events) await this.recordEvent(manager, updated, event.action, user, event.details);
      return { task: updated, previousRole };
    });
    const { task, previousRole } = result;
    if (previousRole !== task.assignedRole) {
      this.realtime.emit('tarefas.updated', { id: task.id, assignedRole: previousRole, status: task.status });
    }
    this.realtime.emit('tarefas.updated', { id: task.id, assignedRole: task.assignedRole, status: task.status });
    return task;
  }

  async resolve(id: string, user: AuthenticatedUser, dto: ConcluirTarefaDto = {}) {
    const result = await this.repo.manager.transaction(async (manager) => {
      const tarefa = await this.findLockedTask(manager, id);
      if (!tarefa || !this.canAccessTask(user, tarefa)) throw new NotFoundException('Tarefa nao encontrada.');
      if (tarefa.status === 'concluida') return { task: tarefa, changed: false };
      tarefa.status = 'concluida';
      tarefa.completedAt = new Date();
      tarefa.completedById = user.id;
      tarefa.completedByName = user.name || user.email || null;
      tarefa.completionNote = this.normalizeCompletionNote(dto.completionNote);
      const saved = await manager.getRepository(Tarefa).save(tarefa);
      await this.recordEvent(manager, saved, 'completed', user, {
        dueDate: saved.dueDate || null,
        completedAt: saved.completedAt?.toISOString(),
        completionNote: saved.completionNote
      });
      return { task: saved, changed: true };
    });
    if (result.changed) this.realtime.emit('tarefas.updated', {
      id: result.task.id, assignedRole: result.task.assignedRole, status: result.task.status
    });
    return result.task;
  }

  async remove(id: string, user: AuthenticatedUser) {
    const tarefa = await this.repo.manager.transaction(async (manager) => {
      const task = await this.findLockedTask(manager, id);
      if (!task) throw new NotFoundException('Tarefa nao encontrada.');
      task.archivedAt = new Date();
      const saved = await manager.getRepository(Tarefa).save(task);
      await this.recordEvent(manager, saved, 'archived', user, { archivedAt: saved.archivedAt?.toISOString() });
      return saved;
    });
    this.realtime.emit('tarefas.deleted', { id, assignedRole: tarefa.assignedRole });
    return { success: true };
  }
}
