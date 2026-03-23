import { Injectable, NotFoundException, Optional, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Avaliacao } from './avaliacao.entity';
import { CriarAvaliacaoDto } from './dto/criar-avaliacao.dto';
import { AtualizarAvaliacaoDto } from './dto/atualizar-avaliacao.dto';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { ObservabilityService } from '../observability/observability.service';
import { Paciente } from '../pacientes/paciente.entity';
import { User } from '../users/user.entity';
import {
  AuthenticatedUser,
  hasGlobalAccess,
  hasTeamScopedAccess,
  isStudentMemberRole,
  normalizeRole
} from '../auth/access-control';
import { normalizeBioimpedanciaPayload } from './bioimpedancia-normalizer';

type FiltrosAvaliacao = {
  pacienteId?: string;
  projetoId?: string;
  tipo?: string;
  limit?: number;
  offset?: number;
};

type JsonObject = Record<string, unknown>;

const AVALIACAO_STATUS_VALUES = ['rascunho', 'finalizada'] as const;
type AvaliacaoStatus = (typeof AVALIACAO_STATUS_VALUES)[number];
const AVALIACAO_STATUS_TRANSITIONS: Record<AvaliacaoStatus, readonly AvaliacaoStatus[]> = {
  rascunho: ['rascunho', 'finalizada'],
  finalizada: ['finalizada']
};

@Injectable()
export class AvaliacoesService {
  constructor(
    @InjectRepository(Avaliacao) private repo: Repository<Avaliacao>,
    @InjectRepository(Paciente) private pacientesRepo: Repository<Paciente>,
    @InjectRepository(User) private usersRepo: Repository<User>,
    private realtime: RealtimeGateway,
    @Optional() private readonly observability?: ObservabilityService
  ) {}

  private recordQuery(label: string, startedAt: number, context = 'GET /avaliacoes') {
    this.observability?.recordQuery({
      label,
      durationMs: Date.now() - startedAt,
      context
    });
  }

  private normalizeStatus(value?: string, fallback: AvaliacaoStatus = 'rascunho'): AvaliacaoStatus {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return fallback;
    if ((AVALIACAO_STATUS_VALUES as readonly string[]).includes(normalized)) {
      return normalized as AvaliacaoStatus;
    }
    throw new BadRequestException('Status de avaliacao invalido.');
  }

  private assertStatusTransition(source: AvaliacaoStatus, target: AvaliacaoStatus) {
    const allowed = AVALIACAO_STATUS_TRANSITIONS[source] || [];
    if (!allowed.includes(target)) {
      throw new BadRequestException(`Transicao de status invalida: ${source} -> ${target}.`);
    }
  }

  private todayDateIso() {
    return new Date().toISOString().slice(0, 10);
  }

  private mapListRow(row: Record<string, unknown>) {
    const pontuacao = row.pontuacaoEBIA;
    const pontuacaoEBIA = pontuacao === null || pontuacao === undefined
      ? null
      : Number(pontuacao);
    return {
      id: row.id as string,
      tipo: row.tipo as string,
      pacienteId: row.pacienteId as string,
      projetoId: (row.projetoId as string) || null,
      projetoNome: (row.projetoNome as string) || null,
      alunoId: (row.alunoId as string) || null,
      status: row.status as string,
      data: (row.data as string) || null,
      classificacao: (row.classificacao as string) || null,
      classificacaoLabel: (row.classificacaoLabel as string) || null,
      pontuacaoEBIA: Number.isFinite(pontuacaoEBIA) ? pontuacaoEBIA : null,
      createdAt: row.createdAt as Date,
      updatedAt: row.updatedAt as Date
    };
  }

  private shouldUseListProjection(filtros: FiltrosAvaliacao) {
    return Number.isFinite(filtros.limit) && !filtros.pacienteId;
  }

  private canAccessViaPaciente(user: AuthenticatedUser, paciente: Paciente | null) {
    if (!paciente) return false;
    const role = normalizeRole(user.role);
    if (hasGlobalAccess(role)) return true;

    if (isStudentMemberRole(role)) {
      return paciente.alunoResponsavelId === user.id
        || (paciente.equipeTecnicaIds || []).includes(user.id);
    }

    if (hasTeamScopedAccess(role)) {
      return paciente.professorSupervisorId === user.id
        || paciente.alunoResponsavelId === user.id
        || (paciente.equipeTecnicaIds || []).includes(user.id);
    }

    if (role === 'atleta') {
      return paciente.atletaUserId === user.id;
    }

    return false;
  }

  private asRecord(value: unknown): JsonObject {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return value as JsonObject;
  }

  private getEbiaSelfFormRelease(paciente: Paciente) {
    const confirmation = this.asRecord(paciente.confirmacaoAtleta);
    const release = this.asRecord(confirmation.ebiaSelfForm);
    return {
      enabled: release.enabled === true,
      releaseId: String(release.releaseId || '').trim() || null,
      releasedAt: String(release.releasedAt || '').trim() || null,
      releasedById: String(release.releasedById || '').trim() || null,
      releasedByName: String(release.releasedByName || '').trim() || null
    };
  }

  private async consumeEbiaSelfFormRelease(paciente: Paciente, avaliacaoId: string) {
    const confirmation = this.asRecord(paciente.confirmacaoAtleta);
    const release = this.asRecord(confirmation.ebiaSelfForm);

    const nextConfirmation: JsonObject = {
      ...confirmation,
      ebiaSelfForm: {
        ...release,
        enabled: false,
        consumedAt: new Date().toISOString(),
        consumedByAvaliacaoId: avaliacaoId
      }
    };

    await this.pacientesRepo.save({
      id: paciente.id,
      confirmacaoAtleta: nextConfirmation
    });
  }

  private async resolveAlunoOrThrow(alunoId?: string | null) {
    if (!alunoId) return null;
    const aluno = await this.usersRepo.findOne({ where: { id: alunoId } });
    if (!aluno) {
      throw new NotFoundException('Aluno informado nao encontrado.');
    }
    if (!isStudentMemberRole(aluno.role)) {
      throw new ForbiddenException('Avaliacao deve ser vinculada a aluno, presidente ou vice.');
    }
    if ((aluno.status || '').toLowerCase() !== 'ativo') {
      throw new ForbiddenException('Aluno informado precisa estar ativo.');
    }
    return aluno;
  }

  async findAll(user: AuthenticatedUser, filtros: FiltrosAvaliacao) {
    const qb = this.repo.createQueryBuilder('avaliacao')
      .orderBy('avaliacao.createdAt', 'DESC')
      .addOrderBy('avaliacao.id', 'DESC');

    const role = normalizeRole(user.role);
    if (!hasGlobalAccess(role)) {
      if (isStudentMemberRole(role)) {
        qb.andWhere('avaliacao.alunoId = :userId', { userId: user.id });
      } else if (role === 'atleta') {
        const atletaPacientesSubQuery = this.pacientesRepo
          .createQueryBuilder('paciente')
          .select('paciente.id')
          .where('paciente.atletaUserId = :userId', { userId: user.id });
        qb.andWhere(
          `avaliacao.pacienteId IN (${atletaPacientesSubQuery.getQuery()})`
        );
        qb.setParameters(atletaPacientesSubQuery.getParameters());
      } else if (hasTeamScopedAccess(role)) {
        const equipePacientesSubQuery = this.pacientesRepo
          .createQueryBuilder('paciente')
          .select('paciente.id')
          .where(
            '(paciente.professorSupervisorId = :userId OR paciente.alunoResponsavelId = :userId OR :userId = ANY(COALESCE(paciente.equipeTecnicaIds, ARRAY[]::uuid[])))',
            { userId: user.id }
          );
        qb.andWhere(
          `avaliacao.pacienteId IN (${equipePacientesSubQuery.getQuery()})`
        );
        qb.setParameters(equipePacientesSubQuery.getParameters());
      } else {
        qb.andWhere('1 = 0');
      }
    }

    if (filtros.pacienteId) {
      qb.andWhere('avaliacao.pacienteId = :pacienteId', { pacienteId: filtros.pacienteId });
    }
    if (filtros.projetoId) {
      qb.andWhere('avaliacao.projetoId = :projetoId', { projetoId: filtros.projetoId });
    }
    if (filtros.tipo) {
      qb.andWhere('avaliacao.tipo = :tipo', { tipo: filtros.tipo });
    }
    if (Number.isFinite(filtros.limit)) {
      qb.take(filtros.limit!);
    }
    if (Number.isFinite(filtros.offset)) {
      qb.skip(filtros.offset!);
    }

    if (this.shouldUseListProjection(filtros)) {
      qb.select([
        'avaliacao.id AS "id"',
        'avaliacao.tipo AS "tipo"',
        'avaliacao.pacienteId AS "pacienteId"',
        'avaliacao.projetoId AS "projetoId"',
        'avaliacao.projetoNome AS "projetoNome"',
        'avaliacao.alunoId AS "alunoId"',
        'avaliacao.status AS "status"',
        'avaliacao.data AS "data"',
        'avaliacao.classificacao AS "classificacao"',
        'avaliacao.classificacaoLabel AS "classificacaoLabel"',
        'avaliacao.pontuacaoEBIA AS "pontuacaoEBIA"',
        'avaliacao.createdAt AS "createdAt"',
        'avaliacao.updatedAt AS "updatedAt"'
      ]);

      const startedAt = Date.now();
      const rows = await qb.getRawMany<Record<string, unknown>>();
      this.recordQuery('avaliacoes.find_all.query', startedAt, 'GET /avaliacoes');
      return rows.map((row) => this.mapListRow(row));
    }

    const startedAt = Date.now();
    const result = await qb.getMany();
    this.recordQuery('avaliacoes.find_all.query', startedAt, 'GET /avaliacoes');
    return result;
  }

  private findByIdRaw(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  async findById(id: string, user: AuthenticatedUser) {
    const avaliacao = await this.findByIdRaw(id);
    if (!avaliacao) return null;

    const role = normalizeRole(user.role);
    if (hasGlobalAccess(role)) return avaliacao;
    if (isStudentMemberRole(role) && avaliacao.alunoId === user.id) return avaliacao;

    const paciente = await this.pacientesRepo.findOne({ where: { id: avaliacao.pacienteId } });
    if (!this.canAccessViaPaciente(user, paciente)) {
      return null;
    }
    return avaliacao;
  }

  async create(dto: CriarAvaliacaoDto, user: AuthenticatedUser) {
    const role = normalizeRole(user.role);
    const payload: CriarAvaliacaoDto = { ...dto };
    if (!hasGlobalAccess(role)) {
      if (role === 'atleta') {
        // Fluxo de atleta e validado apos carregar o paciente.
      } else if (!isStudentMemberRole(role)) {
        throw new ForbiddenException('Sem permissao para criar avaliacao.');
      } else {
        if (payload.alunoId && payload.alunoId !== user.id) {
          throw new ForbiddenException('Sem permissao para criar avaliacao para outro aluno.');
        }
        payload.alunoId = user.id;
      }
    }

    const paciente = await this.pacientesRepo.findOne({ where: { id: payload.pacienteId } });
    if (!paciente) {
      throw new NotFoundException('Paciente nao encontrado.');
    }
    if (!hasGlobalAccess(role) && !this.canAccessViaPaciente(user, paciente)) {
      throw new ForbiddenException('Sem permissao para avaliar este paciente.');
    }
    if (paciente.alunoResponsavelId) {
      if (payload.alunoId && payload.alunoId !== paciente.alunoResponsavelId) {
        throw new ForbiddenException('Avaliacao deve usar o aluno responsavel vinculado ao paciente.');
      }
      payload.alunoId = payload.alunoId || paciente.alunoResponsavelId;
    }
    if (paciente.projetoId) {
      if (payload.projetoId && payload.projetoId !== paciente.projetoId) {
        throw new ForbiddenException('Avaliacao deve manter projeto vinculado ao paciente.');
      }
      payload.projetoId = payload.projetoId || paciente.projetoId;
      payload.projetoNome = payload.projetoNome || paciente.projetoNome || '';
    }
    if (role === 'atleta') {
      if (String(payload.tipo || '').toLowerCase().trim() !== 'avaliacao_socioeconomica') {
        throw new ForbiddenException('Atleta pode preencher apenas o formulario EBIA liberado pela equipe.');
      }
      const release = this.getEbiaSelfFormRelease(paciente);
      if (!release.enabled) {
        throw new ForbiddenException('Formulario EBIA ainda nao foi liberado para este atleta.');
      }
      if (!paciente.alunoResponsavelId) {
        throw new BadRequestException('Paciente sem aluno responsavel vinculado para registrar EBIA.');
      }
      payload.alunoId = paciente.alunoResponsavelId;
      payload.status = 'finalizada';
      payload.data = payload.data || this.todayDateIso();
      payload.meta = {
        ...(this.asRecord(payload.meta)),
        origemPreenchimento: 'atleta',
        ebiaSelfForm: {
          releaseId: release.releaseId,
          releasedAt: release.releasedAt,
          releasedById: release.releasedById,
          releasedByName: release.releasedByName
        }
      };
    }
    await this.resolveAlunoOrThrow(payload.alunoId);
    const normalizedStatus = this.normalizeStatus(payload.status);
    if (normalizedStatus === 'finalizada' && !payload.data) {
      payload.data = this.todayDateIso();
    }

    const normalizedPayload = normalizeBioimpedanciaPayload(payload);
    const avaliacao = this.repo.create({
      ...normalizedPayload,
      status: normalizedStatus,
      autoSave: normalizedPayload.autoSave ?? false
    });
    const saved = await this.repo.save(avaliacao);
    if (role === 'atleta') {
      await this.consumeEbiaSelfFormRelease(paciente, saved.id);
    }
    this.realtime.emit('avaliacoes.created', saved);
    return saved;
  }

  async update(id: string, dto: AtualizarAvaliacaoDto, user: AuthenticatedUser) {
    const avaliacao = await this.findByIdRaw(id);
    if (!avaliacao) {
      throw new NotFoundException('Avaliacao nao encontrada.');
    }

    const role = normalizeRole(user.role);
    const hasAccess = await this.findById(id, user);
    if (!hasAccess) {
      throw new NotFoundException('Avaliacao nao encontrada.');
    }

    if (!hasGlobalAccess(role)) {
      if (dto.alunoId && dto.alunoId !== avaliacao.alunoId) {
        throw new ForbiddenException('Sem permissao para alterar ownership da avaliacao.');
      }
      if (dto.pacienteId && dto.pacienteId !== avaliacao.pacienteId) {
        throw new ForbiddenException('Sem permissao para trocar paciente da avaliacao.');
      }
      if (isStudentMemberRole(role) && avaliacao.alunoId && avaliacao.alunoId !== user.id) {
        throw new ForbiddenException('Sem permissao para editar avaliacao de outro aluno.');
      }
    }

    const nextPacienteId = dto.pacienteId || avaliacao.pacienteId;
    const nextPaciente = await this.pacientesRepo.findOne({ where: { id: nextPacienteId } });
    if (!nextPaciente) {
      throw new NotFoundException('Paciente nao encontrado.');
    }

    const nextAlunoId = dto.alunoId || avaliacao.alunoId || nextPaciente.alunoResponsavelId;
    if (nextPaciente.alunoResponsavelId && nextAlunoId && nextPaciente.alunoResponsavelId !== nextAlunoId) {
      throw new ForbiddenException('Avaliacao deve manter consistencia com o aluno vinculado ao paciente.');
    }
    await this.resolveAlunoOrThrow(nextAlunoId);

    const nextProjetoId = dto.projetoId || avaliacao.projetoId || nextPaciente.projetoId;
    if (nextPaciente.projetoId && nextProjetoId && nextPaciente.projetoId !== nextProjetoId) {
      throw new ForbiddenException('Avaliacao deve manter consistencia com o projeto vinculado ao paciente.');
    }

    const sourceStatus = this.normalizeStatus(avaliacao.status);
    const targetStatus = this.normalizeStatus(dto.status, sourceStatus);
    this.assertStatusTransition(sourceStatus, targetStatus);
    const nextData = dto.data || avaliacao.data || (targetStatus === 'finalizada' ? this.todayDateIso() : undefined);

    const normalizedDto = normalizeBioimpedanciaPayload(dto);
    const merged = this.repo.merge(avaliacao, {
      ...normalizedDto,
      alunoId: nextAlunoId || undefined,
      projetoId: nextPaciente.projetoId || nextProjetoId || undefined,
      projetoNome: nextPaciente.projetoNome || normalizedDto.projetoNome || avaliacao.projetoNome || undefined,
      status: targetStatus,
      data: nextData || undefined
    });
    const saved = await this.repo.save(merged);
    this.realtime.emit('avaliacoes.updated', saved);
    return saved;
  }

  async remove(id: string) {
    const avaliacao = await this.findByIdRaw(id);
    if (!avaliacao) {
      throw new NotFoundException('Avaliacao nao encontrada.');
    }
    await this.repo.delete(id);
    this.realtime.emit('avaliacoes.deleted', { id });
    return { success: true };
  }
}
