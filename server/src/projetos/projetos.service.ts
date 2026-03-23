import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository, SelectQueryBuilder } from 'typeorm';
import { Projeto } from './projeto.entity';
import { CriarProjetoDto } from './dto/criar-projeto.dto';
import { AtualizarProjetoDto } from './dto/atualizar-projeto.dto';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { Paciente } from '../pacientes/paciente.entity';
import { User } from '../users/user.entity';
import {
  AuthenticatedUser,
  hasGlobalAccess,
  hasTeamScopedAccess,
  isStudentMemberRole,
  normalizeRole
} from '../auth/access-control';

@Injectable()
export class ProjetosService {
  constructor(
    @InjectRepository(Projeto) private repo: Repository<Projeto>,
    @InjectRepository(Paciente) private pacientesRepo: Repository<Paciente>,
    @InjectRepository(User) private usersRepo: Repository<User>,
    private realtime: RealtimeGateway
  ) {}

  private async validarLimiteAlunos(alunosIds: string[] | undefined, projetoId?: string) {
    const ids = Array.from(new Set((alunosIds || []).filter(Boolean)));
    if (ids.length === 0) return;

    const excedidos: string[] = [];
    for (const alunoId of ids) {
      const qb = this.repo.createQueryBuilder('projeto')
        .where(':alunoId = ANY(projeto.alunosIds)', { alunoId });
      if (projetoId) {
        qb.andWhere('projeto.id <> :projetoId', { projetoId });
      }
      const count = await qb.getCount();
      if (count >= 2) {
        excedidos.push(alunoId);
      }
    }

    if (excedidos.length > 0) {
      throw new BadRequestException(
        `Alunos ja vinculados ao limite de projetos: ${excedidos.join(', ')}`
      );
    }
  }

  private findByIdRaw(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  private async resolveLinkedProjectId(userId?: string) {
    if (!userId) return null;
    const user = await this.usersRepo.findOne({
      where: { id: userId },
      select: {
        id: true,
        projetoId: true
      }
    });
    return user?.projetoId || null;
  }

  private async resolveScopedProjectsFromPatientAccess(userId: string) {
    const rows = await this.pacientesRepo.createQueryBuilder('paciente')
      .select('DISTINCT paciente.projetoId', 'projetoId')
      .where('paciente.projetoId IS NOT NULL')
      .andWhere(
        '(paciente.professorSupervisorId = :userId OR paciente.alunoResponsavelId = :userId OR :userId = ANY(COALESCE(paciente.equipeTecnicaIds, ARRAY[]::uuid[])))',
        { userId }
      )
      .getRawMany<{ projetoId: string | null }>();

    return rows
      .map((row) => String(row.projetoId || '').trim())
      .filter(Boolean);
  }

  private async buildTeamScopeProjectIds(user: AuthenticatedUser) {
    const userId = String(user?.id || '').trim();
    if (!userId) return [];

    const [linkedProjectId, patientProjectIds] = await Promise.all([
      this.resolveLinkedProjectId(userId),
      this.resolveScopedProjectsFromPatientAccess(userId)
    ]);
    const merged = new Set<string>(patientProjectIds);
    if (linkedProjectId) {
      merged.add(linkedProjectId);
    }
    return Array.from(merged);
  }

  private applyTeamScope(
    qb: SelectQueryBuilder<Projeto>,
    user: AuthenticatedUser,
    scopedProjectIds: string[]
  ) {
    const userId = String(user?.id || '').trim();
    if (!userId) {
      qb.andWhere('1 = 0');
      return;
    }

    qb.andWhere(new Brackets((scopeQb) => {
      scopeQb.where('projeto.coordenadorId = :userId', { userId });
      scopeQb.orWhere(':userId = ANY(COALESCE(projeto.alunosIds, ARRAY[]::uuid[]))', { userId });
      if (scopedProjectIds.length > 0) {
        scopeQb.orWhere('projeto.id IN (:...scopedProjectIds)', {
          scopedProjectIds
        });
      }
    }));
  }

  async findAll(user: AuthenticatedUser) {
    const role = normalizeRole(user?.role);
    if (hasGlobalAccess(role)) {
      return this.repo.find({ order: { createdAt: 'DESC' } });
    }

    if (isStudentMemberRole(role) || role === 'atleta') {
      return this.findPublic();
    }

    if (!hasTeamScopedAccess(role)) {
      throw new ForbiddenException('Sem permissao para listar projetos.');
    }

    const scopedProjectIds = await this.buildTeamScopeProjectIds(user);
    const qb = this.repo.createQueryBuilder('projeto')
      .orderBy('projeto.createdAt', 'DESC');
    this.applyTeamScope(qb, user, scopedProjectIds);
    return qb.getMany();
  }

  findPublic() {
    return this.repo.find({
      select: {
        id: true,
        nome: true,
        status: true
      },
      order: { nome: 'ASC' }
    });
  }

  async findById(id: string, user: AuthenticatedUser) {
    const role = normalizeRole(user?.role);
    if (hasGlobalAccess(role)) {
      return this.findByIdRaw(id);
    }

    if (isStudentMemberRole(role) || role === 'atleta') {
      return this.repo.findOne({
        where: { id },
        select: {
          id: true,
          nome: true,
          status: true
        }
      });
    }

    if (!hasTeamScopedAccess(role)) {
      throw new ForbiddenException('Sem permissao para acessar projeto.');
    }

    const scopedProjectIds = await this.buildTeamScopeProjectIds(user);
    const qb = this.repo.createQueryBuilder('projeto')
      .where('projeto.id = :id', { id });
    this.applyTeamScope(qb, user, scopedProjectIds);
    return qb.getOne();
  }

  async create(dto: CriarProjetoDto) {
    await this.validarLimiteAlunos(dto.alunosIds);
    const projeto = this.repo.create({
      ...dto,
      area: dto.area || 'nutricao',
      status: dto.status || 'planejamento',
      equipe: dto.equipe || [],
      alunosIds: dto.alunosIds || [],
      alunosNomes: dto.alunosNomes || []
    });
    const saved = await this.repo.save(projeto);
    this.realtime.emit('projetos.created', saved);
    return saved;
  }

  async update(id: string, dto: AtualizarProjetoDto) {
    const projeto = await this.findByIdRaw(id);
    if (!projeto) {
      throw new NotFoundException('Projeto nao encontrado.');
    }
    await this.validarLimiteAlunos(dto.alunosIds, id);
    const payload: Partial<Projeto> = { ...dto };
    await this.repo.update(id, payload);
    const updated = await this.findByIdRaw(id);
    if (updated) {
      this.realtime.emit('projetos.updated', updated);
    }
    return updated;
  }

  async remove(id: string) {
    const projeto = await this.findByIdRaw(id);
    if (!projeto) {
      throw new NotFoundException('Projeto nao encontrado.');
    }
    await this.repo.delete(id);
    this.realtime.emit('projetos.deleted', { id });
    return { success: true };
  }
}
