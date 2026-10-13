import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Optional,
  ForbiddenException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryDeepPartialEntity } from 'typeorm';
import { Agendamento } from './agendamento.entity';
import { CriarAgendamentoDto } from './dto/criar-agendamento.dto';
import { AtualizarAgendamentoDto } from './dto/atualizar-agendamento.dto';
import { RemarcarAgendamentoDto } from './dto/remarcar-agendamento.dto';
import { Paciente } from '../pacientes/paciente.entity';
import { User } from '../users/user.entity';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { ObservabilityService } from '../observability/observability.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import {
  AuthenticatedUser,
  hasGlobalAccess,
  hasTeamScopedAccess,
  isStudentMemberRole,
  normalizeRole
} from '../auth/access-control';
import { clinicalScopeCondition, resolveClinicalLink, studentLookupFromRepository } from '../auth/authorization';

function formatDateTimeBr(date?: string | null, time?: string | null): string {
  if (!date) return 'data a confirmar';
  const [year, month, day] = String(date).split('-');
  const datePart = `${day}/${month}/${year}`;
  return time ? `${datePart} às ${time}` : datePart;
}

type FiltrosAgendamento = {
  pacienteId?: string;
  alunoId?: string;
  status?: string;
  limit?: number;
  offset?: number;
};

const APPOINTMENT_STATUS_VALUES = ['agendada', 'realizada', 'remarcada', 'falta'] as const;
const APPOINTMENT_TYPE_VALUES = ['primeira_consulta', 'retorno'] as const;
type AppointmentStatus = (typeof APPOINTMENT_STATUS_VALUES)[number];
type AppointmentType = (typeof APPOINTMENT_TYPE_VALUES)[number];

const STATUS_TRANSITIONS: Record<AppointmentStatus, readonly AppointmentStatus[]> = {
  agendada: ['agendada', 'realizada', 'falta', 'remarcada'],
  realizada: ['realizada'],
  falta: ['falta'],
  remarcada: ['remarcada']
};

@Injectable()
export class AgendamentosService {
  constructor(
    @InjectRepository(Agendamento) private repo: Repository<Agendamento>,
    @InjectRepository(Paciente) private pacientesRepo: Repository<Paciente>,
    @InjectRepository(User) private usersRepo: Repository<User>,
    private realtime: RealtimeGateway,
    @Optional() private readonly observability?: ObservabilityService,
    @Optional() private readonly notificacoes?: NotificacoesService
  ) {}

  private recordQuery(label: string, startedAt: number, context = 'GET /agendamentos') {
    this.observability?.recordQuery({
      label,
      durationMs: Date.now() - startedAt,
      context
    });
  }

  // Contrato unico (UPD-12): inclui a cadeia do aluno responsavel.
  private async canAccessViaPaciente(user: AuthenticatedUser, paciente: Paciente | null) {
    return (await resolveClinicalLink(user, paciente, studentLookupFromRepository(this.usersRepo))) !== null;
  }

  private parseDateOrUndefined(value?: string) {
    if (!value) return undefined;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  private normalizeAppointmentStatus(value?: string, fallback: AppointmentStatus = 'agendada'): AppointmentStatus {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return fallback;
    if ((APPOINTMENT_STATUS_VALUES as readonly string[]).includes(normalized)) {
      return normalized as AppointmentStatus;
    }
    throw new BadRequestException('Status de agendamento invalido.');
  }

  private normalizeAppointmentType(value?: string, fallback: AppointmentType = 'retorno'): AppointmentType {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return fallback;
    if ((APPOINTMENT_TYPE_VALUES as readonly string[]).includes(normalized)) {
      return normalized as AppointmentType;
    }
    throw new BadRequestException('Tipo de consulta invalido.');
  }

  private assertStatusTransition(source: AppointmentStatus, target: AppointmentStatus) {
    const allowed = STATUS_TRANSITIONS[source] || [];
    if (!allowed.includes(target)) {
      throw new BadRequestException(`Transicao de status invalida: ${source} -> ${target}.`);
    }
  }

  private normalizeEvaluations(evaluations?: string[] | null) {
    if (!Array.isArray(evaluations)) return [];
    const normalized = evaluations
      .map((item) => String(item || '').trim())
      .filter(Boolean);
    return Array.from(new Set(normalized));
  }

  private normalizeTimeToken(value?: string | null) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const matched = raw.match(/^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/);
    if (!matched) return '';
    return `${matched[1]}:${matched[2]}`;
  }

  private isBusinessDay(date: Date) {
    const day = date.getDay();
    return day >= 1 && day <= 5;
  }

  private endOfDay(date: Date) {
    const cloned = new Date(date);
    cloned.setHours(23, 59, 59, 999);
    return cloned;
  }

  private resolveAppointmentDate(agendamento: Pick<Agendamento, 'scheduledAt' | 'date' | 'time'>) {
    const fromScheduledAt = this.parseDateOrUndefined(
      agendamento.scheduledAt ? String(agendamento.scheduledAt) : undefined
    );
    if (fromScheduledAt) return fromScheduledAt;
    const fromDateTime = this.buildScheduledAt(agendamento.date, agendamento.time);
    if (fromDateTime) return fromDateTime;
    return this.parseDateOrUndefined(agendamento.date);
  }

  private getAthleteRescheduleDeadline(agendamento: Pick<Agendamento, 'scheduledAt' | 'date' | 'time'>) {
    const appointmentDate = this.resolveAppointmentDate(agendamento);
    if (!appointmentDate) return null;

    const previousBusinessDay = new Date(
      appointmentDate.getFullYear(),
      appointmentDate.getMonth(),
      appointmentDate.getDate()
    );
    do {
      previousBusinessDay.setDate(previousBusinessDay.getDate() - 1);
    } while (!this.isBusinessDay(previousBusinessDay));

    return this.endOfDay(previousBusinessDay);
  }

  private canAthleteReschedule(agendamento: Pick<Agendamento, 'scheduledAt' | 'date' | 'time'>, now = new Date()) {
    const deadline = this.getAthleteRescheduleDeadline(agendamento);
    if (!deadline) return false;
    return now.getTime() <= deadline.getTime();
  }

  private normalizeDateFields(
    payload: Partial<CriarAgendamentoDto & AtualizarAgendamentoDto>
  ) {
    return {
      scheduledAt: this.parseDateOrUndefined(payload.scheduledAt),
      remarcadaEm: this.parseDateOrUndefined(payload.remarcadaEm),
      remarcadaPara: this.parseDateOrUndefined(payload.remarcadaPara),
      completedAt: this.parseDateOrUndefined(payload.completedAt),
      faltouEm: this.parseDateOrUndefined(payload.faltouEm)
    };
  }

  private buildScheduledAt(date?: string, time?: string, explicit?: string) {
    if (explicit) {
      const parsedExplicit = this.parseDateOrUndefined(explicit);
      if (parsedExplicit) return parsedExplicit;
    }
    if (date && time) {
      const parsed = new Date(`${date}T${time}:00`);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }
    return undefined;
  }

  private ensureScheduleNotPast(scheduledAt?: Date | null) {
    if (!scheduledAt) return;
    const now = Date.now();
    const toleranceMs = 60 * 1000;
    if (scheduledAt.getTime() < now - toleranceMs) {
      throw new BadRequestException('Nao e permitido agendar consulta em horario passado.');
    }
  }

  private ensureStatusUpdateWindow(
    status: AppointmentStatus,
    agendamento: Pick<Agendamento, 'scheduledAt' | 'date' | 'time'>,
    now = new Date()
  ) {
    if (status !== 'realizada' && status !== 'falta') return;
    const appointmentDate = this.resolveAppointmentDate(agendamento);
    if (!appointmentDate) {
      throw new BadRequestException('Consulta sem data valida para atualizacao de status.');
    }
    const toleranceMs = 60 * 1000;
    if (appointmentDate.getTime() > now.getTime() + toleranceMs) {
      throw new BadRequestException('Nao e permitido concluir ou registrar falta antes do horario da consulta.');
    }
  }

  private async assertScheduleConflict(
    alunoId?: string,
    date?: string,
    time?: string,
    excludeId?: string
  ) {
    if (!alunoId || !date || !time) return;
    const qb = this.repo.createQueryBuilder('agendamento')
      .where('agendamento.alunoId = :alunoId', { alunoId })
      .andWhere('agendamento.date = :date', { date })
      .andWhere('agendamento.time = :time', { time })
      .andWhere('agendamento.status = :status', { status: 'agendada' });

    if (excludeId) {
      qb.andWhere('agendamento.id <> :excludeId', { excludeId });
    }

    const conflict = await qb.getOne();
    if (conflict) {
      throw new BadRequestException('Ja existe consulta nesse horario.');
    }
  }

  private async resolvePacienteOrThrow(pacienteId?: string | null) {
    if (!pacienteId) return null;
    const paciente = await this.pacientesRepo.findOne({ where: { id: pacienteId } });
    if (!paciente) {
      throw new BadRequestException('Paciente informado nao foi encontrado.');
    }
    return paciente;
  }

  private async resolveAlunoOrThrow(alunoId?: string | null) {
    if (!alunoId) return null;
    const aluno = await this.usersRepo.findOne({ where: { id: alunoId } });
    if (!aluno) {
      throw new BadRequestException('Aluno informado nao foi encontrado.');
    }
    if (!isStudentMemberRole(aluno.role)) {
      throw new BadRequestException('Agendamento deve ser vinculado a aluno, presidente ou vice.');
    }
    if ((aluno.status || '').toLowerCase() !== 'ativo') {
      throw new BadRequestException('Aluno informado precisa estar ativo.');
    }
    return aluno;
  }

  private ensurePacienteAlunoConsistency(paciente: Paciente | null, alunoId?: string | null) {
    if (!paciente) return;
    if (!paciente.alunoResponsavelId) {
      throw new BadRequestException('Paciente nao possui aluno responsavel vinculado.');
    }
    if (!paciente.professorSupervisorId) {
      throw new BadRequestException('Paciente nao possui supervisor responsavel vinculado.');
    }
    if (!paciente.projetoId) {
      throw new BadRequestException('Paciente nao possui projeto vinculado.');
    }
    if (alunoId && paciente.alunoResponsavelId !== alunoId) {
      throw new BadRequestException('Paciente informado pertence a outro aluno responsavel.');
    }
  }

  findAll(user: AuthenticatedUser, filtros: FiltrosAgendamento) {
    const qb = this.repo.createQueryBuilder('agendamento')
      .orderBy('agendamento.scheduledAt', 'DESC');

    const role = normalizeRole(user.role);
    if (!hasGlobalAccess(role) && role !== 'coord_atendimento') {
      if (isStudentMemberRole(role)) {
        qb.andWhere('agendamento.alunoId = :userId', { userId: user.id });
      } else if (hasTeamScopedAccess(role) || role === 'atleta') {
        // Contrato unico (UPD-12): mesmo escopo de pacientes, com cadeia de supervisao.
        qb.leftJoin(Paciente, 'paciente', 'paciente.id = agendamento.pacienteId');
        const alunosSupervisionadosSubQuery = this.usersRepo
          .createQueryBuilder('aluno_supervisionado')
          .select('aluno_supervisionado.id')
          .where('(aluno_supervisionado.supervisorId = :userId OR aluno_supervisionado.profissionalId = :userId)')
          .andWhere('aluno_supervisionado.deletedAt IS NULL');
        qb.andWhere(
          clinicalScopeCondition({ alias: 'paciente', user, supervisedStudentsSubquery: alunosSupervisionadosSubQuery.getQuery() }) || '1 = 0',
          { userId: user.id }
        );
        qb.setParameters(alunosSupervisionadosSubQuery.getParameters());
      } else {
        qb.andWhere('1 = 0');
      }
    }

    if (filtros.pacienteId) {
      qb.andWhere('agendamento.pacienteId = :pacienteId', { pacienteId: filtros.pacienteId });
    }
    if (filtros.alunoId) {
      qb.andWhere('agendamento.alunoId = :alunoId', { alunoId: filtros.alunoId });
    }
    if (filtros.status) {
      qb.andWhere('LOWER(agendamento.status) = :status', {
        status: String(filtros.status).toLowerCase().trim()
      });
    }
    if (Number.isFinite(filtros.limit)) {
      qb.take(filtros.limit!);
    }
    if (Number.isFinite(filtros.offset)) {
      qb.skip(filtros.offset!);
    }
    const startedAt = Date.now();
    return qb.getMany().then((result) => {
      this.recordQuery('agendamentos.find_all.query', startedAt, 'GET /agendamentos');
      return result;
    });
  }

  private findByIdRaw(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  async findById(id: string, user: AuthenticatedUser) {
    const agendamento = await this.findByIdRaw(id);
    if (!agendamento) return null;

    const role = normalizeRole(user.role);
    if (hasGlobalAccess(role)) return agendamento;
    if (isStudentMemberRole(role) && agendamento.alunoId === user.id) return agendamento;

    if (agendamento.pacienteId) {
      const paciente = await this.pacientesRepo.findOne({ where: { id: agendamento.pacienteId } });
      if (await this.canAccessViaPaciente(user, paciente)) {
        return agendamento;
      }
    }

    return null;
  }

  async create(dto: CriarAgendamentoDto, user: AuthenticatedUser) {
    const role = normalizeRole(user.role);
    const payload: CriarAgendamentoDto = { ...dto };
    if (!hasGlobalAccess(role)) {
      if (!isStudentMemberRole(role)) {
        throw new ForbiddenException('Sem permissao para criar agendamentos.');
      }
      if (payload.alunoId && payload.alunoId !== user.id) {
        throw new ForbiddenException('Sem permissao para criar agendamento para outro aluno.');
      }
      payload.alunoId = user.id;
      payload.alunoNome = user.name || '';
    }

    const paciente = await this.resolvePacienteOrThrow(payload.pacienteId);
    if (paciente && !hasGlobalAccess(role)) {
      if (!(await this.canAccessViaPaciente(user, paciente))) {
        throw new ForbiddenException('Sem permissao para agendar para este paciente.');
      }
    }
    if (paciente?.alunoResponsavelId) {
      payload.alunoId = payload.alunoId || paciente.alunoResponsavelId;
      payload.alunoNome = paciente.alunoResponsavelNome || '';
      payload.pacienteNome = paciente.nome || '';
    }
    this.ensurePacienteAlunoConsistency(paciente, payload.alunoId);
    const aluno = await this.resolveAlunoOrThrow(payload.alunoId);
    if (aluno) {
      payload.alunoNome = aluno.name;
    }

    if (!dto.date || !dto.time) {
      throw new BadRequestException('Data e horario sao obrigatorios.');
    }
    const normalizedEvaluations = this.normalizeEvaluations(dto.evaluations);
    if (normalizedEvaluations.length === 0) {
      throw new BadRequestException('Selecione ao menos uma avaliacao.');
    }

    await this.assertScheduleConflict(payload.alunoId, payload.date, payload.time);

    const normalizedDateFields = this.normalizeDateFields(payload);
    const scheduledAt = this.buildScheduledAt(payload.date, payload.time, payload.scheduledAt);
    if (!scheduledAt) {
      throw new BadRequestException('Data ou horario invalidos para agendamento.');
    }
    const nextStatus = this.normalizeAppointmentStatus(payload.status);
    if (nextStatus !== 'agendada') {
      throw new BadRequestException('Novo agendamento deve iniciar com status agendada.');
    }
    this.ensureScheduleNotPast(scheduledAt);
    const appointmentType = this.normalizeAppointmentType(payload.appointmentType);

    const agendamento = this.repo.create({
      ...payload,
      ...normalizedDateFields,
      scheduledAt,
      appointmentType,
      evaluations: normalizedEvaluations,
      status: nextStatus
    });
    const saved = await this.repo.save(agendamento);
    this.realtime.emit('agendamentos.created', saved);

    if (payload.pacienteId) {
      await this.pacientesRepo.update(payload.pacienteId, {
        status: 'Ativo',
        faltas: 0
      });
    }

    void this.dispatchAppointmentNotification('agendada', saved, paciente);
    return saved;
  }

  async update(id: string, dto: AtualizarAgendamentoDto, user: AuthenticatedUser) {
    const agendamento = await this.findByIdRaw(id);
    if (!agendamento) {
      throw new NotFoundException('Agendamento nao encontrado.');
    }

    const role = normalizeRole(user.role);
    const hasAccess = await this.findById(id, user);
    if (!hasAccess) {
      throw new NotFoundException('Agendamento nao encontrado.');
    }
    const sourceStatus = this.normalizeAppointmentStatus(agendamento.status);

    const isAthlete = role === 'atleta';
    let payloadDto: AtualizarAgendamentoDto = dto;
    if (isAthlete) {
      const allowedFields = new Set(['status', 'faltouEm']);
      const attemptedRestricted = Object.keys(dto).find((field) => !allowedFields.has(field));
      if (attemptedRestricted) {
        throw new ForbiddenException('Atleta nao pode alterar dados estruturais da consulta.');
      }
      if (dto.status !== 'falta') {
        throw new ForbiddenException('Atleta so pode registrar falta quando o prazo de remarcacao expira.');
      }
      if (sourceStatus !== 'agendada') {
        throw new BadRequestException('Consulta encerrada nao pode ser alterada pelo atleta.');
      }
      if (this.canAthleteReschedule(agendamento)) {
        throw new BadRequestException('Ainda e possivel remarcar a consulta. Use a remarcacao antes de registrar falta.');
      }
      payloadDto = {
        status: 'falta',
        faltouEm: dto.faltouEm || new Date().toISOString()
      };
    }

    if (!isAthlete && !hasGlobalAccess(role)) {
      if (payloadDto.alunoId && payloadDto.alunoId !== agendamento.alunoId) {
        throw new ForbiddenException('Sem permissao para alterar aluno do agendamento.');
      }
      if (payloadDto.pacienteId && payloadDto.pacienteId !== agendamento.pacienteId) {
        throw new ForbiddenException('Sem permissao para alterar paciente do agendamento.');
      }
    }

    const requestedStatus = this.normalizeAppointmentStatus(payloadDto.status, sourceStatus);
    this.assertStatusTransition(sourceStatus, requestedStatus);

    if (!isAthlete && requestedStatus === 'remarcada' && sourceStatus !== 'remarcada') {
      throw new BadRequestException('Use o endpoint de remarcacao para marcar consulta como remarcada.');
    }

    const scheduleFieldsTouched = ['date', 'time', 'scheduledAt']
      .some((field) => Object.prototype.hasOwnProperty.call(payloadDto, field));
    if (
      (sourceStatus === 'realizada' || sourceStatus === 'falta' || sourceStatus === 'remarcada')
      && (scheduleFieldsTouched || requestedStatus !== sourceStatus)
    ) {
      throw new BadRequestException('Consulta encerrada nao permite alteracao estrutural.');
    }

    if (requestedStatus !== 'remarcada') {
      const effectiveAlunoId = payloadDto.alunoId || agendamento.alunoId;
      const effectiveDate = payloadDto.date || agendamento.date;
      const effectiveTime = payloadDto.time || agendamento.time;
      await this.assertScheduleConflict(effectiveAlunoId, effectiveDate, effectiveTime, id);
    }

    if (requestedStatus === 'remarcada' && !payloadDto.remarcadaPara && sourceStatus !== 'remarcada') {
      throw new BadRequestException('Campo remarcadaPara obrigatorio ao marcar consulta como remarcada.');
    }

    const nextPacienteId = payloadDto.pacienteId || agendamento.pacienteId;
    const nextAlunoId = payloadDto.alunoId || agendamento.alunoId;
    const nextPaciente = await this.resolvePacienteOrThrow(nextPacienteId);
    this.ensurePacienteAlunoConsistency(nextPaciente, nextAlunoId);
    const nextAluno = await this.resolveAlunoOrThrow(nextAlunoId);

    const normalizedPayload: AtualizarAgendamentoDto = {
      ...payloadDto
    };
    normalizedPayload.status = requestedStatus;
    normalizedPayload.appointmentType = this.normalizeAppointmentType(
      normalizedPayload.appointmentType,
      this.normalizeAppointmentType(agendamento.appointmentType)
    );
    if (nextPaciente?.nome) {
      normalizedPayload.pacienteNome = nextPaciente.nome;
    }
    if (nextAluno?.name) {
      normalizedPayload.alunoNome = nextAluno.name;
    }
    if (Object.prototype.hasOwnProperty.call(payloadDto, 'evaluations')) {
      const normalizedEvaluations = this.normalizeEvaluations(payloadDto.evaluations);
      if (normalizedEvaluations.length === 0) {
        throw new BadRequestException('Selecione ao menos uma avaliacao.');
      }
      normalizedPayload.evaluations = normalizedEvaluations;
    }

    const normalizedDateFields = this.normalizeDateFields(normalizedPayload);
    const scheduledAt = this.buildScheduledAt(
      normalizedPayload.date || agendamento.date,
      normalizedPayload.time || agendamento.time,
      normalizedPayload.scheduledAt
    );
    if (scheduleFieldsTouched && !scheduledAt) {
      throw new BadRequestException('Data ou horario invalidos para agendamento.');
    }
    if (scheduleFieldsTouched && requestedStatus === 'agendada') {
      this.ensureScheduleNotPast(scheduledAt);
    }
    const effectiveSchedule = {
      scheduledAt: scheduledAt ?? agendamento.scheduledAt,
      date: normalizedPayload.date || agendamento.date,
      time: normalizedPayload.time || agendamento.time
    };
    if (requestedStatus === 'realizada') {
      this.ensureStatusUpdateWindow(requestedStatus, effectiveSchedule);
      normalizedPayload.completedAt = normalizedPayload.completedAt || new Date().toISOString();
    }
    if (requestedStatus === 'falta') {
      this.ensureStatusUpdateWindow(requestedStatus, effectiveSchedule);
      normalizedPayload.faltouEm = normalizedPayload.faltouEm || new Date().toISOString();
    }

    const merged = this.repo.merge(agendamento, {
      ...normalizedPayload,
      ...normalizedDateFields,
      scheduledAt: scheduledAt ?? agendamento.scheduledAt
    });
    const saved = await this.repo.save(merged);
    this.realtime.emit('agendamentos.updated', saved);

    const pacienteId = payloadDto.pacienteId || agendamento.pacienteId;
    if (requestedStatus !== sourceStatus && pacienteId) {
      if (requestedStatus === 'falta') {
        const paciente = await this.pacientesRepo.findOne({ where: { id: pacienteId } });
        if (paciente) {
          const faltas = Number(paciente.faltas || 0) + 1;
          const updatePayload: QueryDeepPartialEntity<Paciente> = { faltas };
          if (faltas >= 3) {
            updatePayload.status = 'Lista de Espera';
          }
          await this.pacientesRepo.update(pacienteId, updatePayload);
          void this.dispatchAppointmentNotification('falta', saved, paciente);
        }
      }
    }

    return saved;
  }

  async reschedule(id: string, dto: RemarcarAgendamentoDto, user: AuthenticatedUser) {
    const source = await this.findById(id, user);
    if (!source) {
      throw new NotFoundException('Agendamento nao encontrado.');
    }
    const role = normalizeRole(user.role);

    const sourceStatus = this.normalizeAppointmentStatus(source.status);
    if (sourceStatus === 'remarcada') {
      throw new BadRequestException('Agendamento ja foi remarcado.');
    }
    if (sourceStatus === 'realizada' || sourceStatus === 'falta') {
      throw new BadRequestException('Nao e permitido remarcar consulta encerrada.');
    }

    if (role === 'atleta' && !this.canAthleteReschedule(source)) {
      throw new BadRequestException('Remarcacao permitida somente ate 1 dia util antes da consulta.');
    }

    const sourceEvaluations = this.normalizeEvaluations(source.evaluations);
    const requestedEvaluations = this.normalizeEvaluations(dto.evaluations);
    const rescheduleEvaluations = role === 'atleta'
      ? sourceEvaluations
      : (requestedEvaluations.length > 0 ? requestedEvaluations : sourceEvaluations);
    if (rescheduleEvaluations.length === 0) {
      throw new BadRequestException('Selecione ao menos uma avaliacao.');
    }

    const requestedTime = this.normalizeTimeToken(dto.time);
    if (!requestedTime) {
      throw new BadRequestException('Horario invalido para remarcacao.');
    }
    const sourceTime = this.normalizeTimeToken(source.time);
    if (source.date === dto.date && sourceTime === requestedTime) {
      throw new BadRequestException('Novo horario deve ser diferente da consulta original.');
    }

    await this.assertScheduleConflict(source.alunoId, dto.date, requestedTime, source.id);
    const rescheduledAt = this.buildScheduledAt(dto.date, requestedTime);
    if (!rescheduledAt) {
      throw new BadRequestException('Data ou horario invalidos para remarcacao.');
    }
    this.ensureScheduleNotPast(rescheduledAt);
    const nextAppointmentType = this.normalizeAppointmentType(
      dto.appointmentType,
      this.normalizeAppointmentType(source.appointmentType)
    );

    const now = new Date();

    const result = await this.repo.manager.transaction(async (manager) => {
      const sourceRepository = manager.getRepository(Agendamento);

      const sourceFresh = await sourceRepository.findOne({ where: { id: source.id } });
      if (!sourceFresh) {
        throw new NotFoundException('Agendamento nao encontrado.');
      }

      sourceFresh.status = 'remarcada';
      sourceFresh.remarcadaEm = now;
      sourceFresh.remarcadaPara = rescheduledAt;
      const sourceSaved = await sourceRepository.save(sourceFresh);

      const newAppointment = sourceRepository.create({
        pacienteId: sourceFresh.pacienteId,
        pacienteNome: sourceFresh.pacienteNome,
        alunoId: sourceFresh.alunoId,
        alunoNome: sourceFresh.alunoNome,
        date: dto.date,
        time: requestedTime,
        appointmentType: nextAppointmentType,
        scheduledAt: rescheduledAt,
        evaluations: rescheduleEvaluations,
        status: 'agendada',
        origemId: sourceFresh.id
      });
      const newSaved = await sourceRepository.save(newAppointment);
      return { sourceSaved, newSaved };
    });

    this.realtime.emit('agendamentos.updated', result.sourceSaved);
    this.realtime.emit('agendamentos.created', result.newSaved);

    const pacienteParaNotif = result.newSaved.pacienteId
      ? await this.pacientesRepo.findOne({ where: { id: result.newSaved.pacienteId } })
      : null;
    void this.dispatchAppointmentNotification('remarcada', result.newSaved, pacienteParaNotif);

    return {
      success: true,
      source: result.sourceSaved,
      rescheduled: result.newSaved
    };
  }

  private async dispatchAppointmentNotification(
    event: 'agendada' | 'remarcada' | 'falta',
    agendamento: Agendamento,
    paciente: Paciente | null
  ): Promise<void> {
    if (!this.notificacoes) return;
    try {
      const dtLabel = formatDateTimeBr(agendamento.date, agendamento.time);
      const atletaNome = paciente?.nome || 'Atleta';
      const atletaUserId = paciente?.atletaUserId;
      const alunoId = agendamento.alunoId;

      if (event === 'agendada') {
        // Notifica o atleta
        if (atletaUserId) {
          await this.notificacoes.createForUsers([atletaUserId], {
            titulo: 'Consulta agendada',
            mensagem: `Sua consulta foi agendada para ${dtLabel}. Fique atento ao horário!`,
            tipo: 'agendamento',
          });
        }
        // Notifica o membro da liga responsável
        if (alunoId) {
          await this.notificacoes.createForUsers([alunoId], {
            titulo: 'Consulta agendada',
            mensagem: `Consulta com ${atletaNome} agendada para ${dtLabel}.`,
            tipo: 'agendamento',
          });
        }
      } else if (event === 'remarcada') {
        if (atletaUserId) {
          await this.notificacoes.createForUsers([atletaUserId], {
            titulo: 'Consulta remarcada',
            mensagem: `Sua consulta foi remarcada para ${dtLabel}.`,
            tipo: 'agendamento',
          });
        }
        if (alunoId) {
          await this.notificacoes.createForUsers([alunoId], {
            titulo: 'Consulta remarcada',
            mensagem: `Consulta com ${atletaNome} remarcada para ${dtLabel}.`,
            tipo: 'agendamento',
          });
        }
      } else if (event === 'falta') {
        const recipients = [paciente?.professorSupervisorId, ...(paciente?.equipeMultiIds || [])]
          .filter((id): id is string => !!id);
        await this.notificacoes.createForUsers([...new Set(recipients)], {
          titulo: 'Falta registrada',
          mensagem: 'Há uma falta registrada na sua equipe. Consulte a agenda dos pacientes vinculados.',
          tipo: 'alerta_clinico',
        });
      }
    } catch {
      // Best-effort — não interrompe o fluxo
    }
  }

  async remove(id: string) {
    const agendamento = await this.findByIdRaw(id);
    if (!agendamento) {
      throw new NotFoundException('Agendamento nao encontrado.');
    }
    await this.repo.delete(id);
    this.realtime.emit('agendamentos.deleted', { id, pacienteId: agendamento.pacienteId });
    return { success: true };
  }
}
