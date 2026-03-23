import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tarefa } from './tarefa.entity';
import { CriarTarefaDto } from './dto/criar-tarefa.dto';
import { AtualizarTarefaDto } from './dto/atualizar-tarefa.dto';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { AuthenticatedUser, hasGlobalAccess, normalizeRole } from '../auth/access-control';

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

  findAll(user: AuthenticatedUser, filtros: FiltrosTarefa) {
    const qb = this.repo.createQueryBuilder('tarefa')
      .orderBy('tarefa.createdAt', 'DESC');
    const role = normalizeRole(user?.role);
    if (!hasGlobalAccess(role)) {
      qb.andWhere('(tarefa.assignedRole = :role OR tarefa.assignedRole = :todos)', {
        role,
        todos: 'todos'
      });
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
