import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Readable } from 'stream';
import { In, IsNull, Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { Paciente } from '../pacientes/paciente.entity';
import { Avaliacao } from '../avaliacoes/avaliacao.entity';
import { Agendamento } from '../agendamentos/agendamento.entity';
import { Projeto } from '../projetos/projeto.entity';
import { isStudentMemberRole } from '../common/domain/access.constants';
import { ObservabilityService } from '../observability/observability.service';

type RangeFilter = 'week' | 'month' | 'quarter' | 'year';
type ExportFormat = 'csv' | 'json';

type ReportsQuery = {
  range?: string;
  projectId?: string;
  forceRefresh?: boolean;
};

type DashboardQuery = {
  forceRefresh?: boolean;
  projectId?: string;
};

type ExportQuery = {
  range?: string;
  projectId?: string;
  anonymize?: boolean | string;
  format?: string;
};

type ExportResult = {
  filename: string;
  mimeType: string;
  stream: Readable;
};

type CachedPayload = {
  payload: Record<string, unknown>;
  expiresAt: number;
};

type QuarterBucket = {
  period: string;
  alunos: number;
  pacientes: number;
  avaliacoes: number;
  meta: number;
};

const REPORT_CACHE_TTL_MS = 60 * 1000;
const DASHBOARD_CACHE_TTL_MS = 30 * 1000;
const CORRELATIONS_CACHE_TTL_MS = 45 * 1000;
const CACHE_MAX_ENTRIES = 120;
const EXPORT_PAGE_SIZE = 200;

const TYPE_LABELS: Record<string, string> = {
  bioimpedancia: 'Avaliacoes de Bioimpedancia',
  dobras_cutaneas: 'Dobras Cutaneas',
  perimetros: 'Perimetros',
  alimentar: 'Avaliacao Alimentar (NOVA)',
  hidratacao: 'Hidratacao',
  avaliacao_socioeconomica: 'Socioeconomica (EBIA)',
  fisioterapia: 'Fisioterapia',
  psicologia: 'Psicologia'
};

const TYPE_COLORS: Record<string, string> = {
  bioimpedancia: 'progress-gradient-emerald',
  dobras_cutaneas: 'progress-gradient-green',
  perimetros: 'progress-gradient-blue',
  alimentar: 'progress-gradient-purple',
  hidratacao: 'progress-gradient-amber',
  avaliacao_socioeconomica: 'progress-gradient-cyan',
  fisioterapia: 'progress-gradient-rose',
  psicologia: 'progress-gradient-indigo'
};

const APPOINTMENT_STATUS_LABELS: Record<string, string> = {
  agendada: 'Consulta agendada',
  remarcada: 'Consulta remarcada',
  falta: 'Falta registrada',
  realizada: 'Consulta realizada'
};

const METRIC_DEFINITIONS = {
  totalAlunos: {
    label: 'Total de alunos',
    description: 'Quantidade de membros com papel estudantil no escopo selecionado.',
    formula: 'count(users.role in [aluno, presidente, vice])'
  },
  professores: {
    label: 'Professores/Profissionais',
    description: 'Quantidade de supervisores vinculados ao escopo selecionado.',
    formula: 'count(users.role in [professor, profissional])'
  },
  totalPacientes: {
    label: 'Total de pacientes',
    description: 'Pacientes cadastrados no escopo atual.',
    formula: 'count(pacientes)'
  },
  avaliacoesPeriodo: {
    label: 'Avaliacoes no periodo',
    description: 'Avaliacoes criadas dentro do recorte temporal selecionado.',
    formula: 'count(avaliacoes where createdAt >= rangeStart)'
  },
  taxaVinculacao: {
    label: 'Taxa de vinculacao',
    description: 'Percentual de pacientes com aluno responsavel definido.',
    formula: '(pacientes com alunoResponsavelId / totalPacientes) * 100'
  },
  integridade: {
    label: 'Integridade de dados',
    description: 'Percentual de avaliacoes com completude >= 80.',
    formula: '(avaliacoes com meta.completude >= 80 / totalAvaliacoes) * 100'
  },
  completionRate: {
    label: 'Taxa de conclusao',
    description: 'Percentual de consultas com status realizada.',
    formula: '(agendamentos status=realizada / totalAgendamentos) * 100'
  },
  satisfacao: {
    label: 'Satisfacao estimada',
    description: 'Indicador proxy operacional derivado da taxa de conclusao.',
    formula: '(completionRate / 100) * 5'
  },
  retencao: {
    label: 'Retencao',
    description: 'Percentual de pacientes com pelo menos duas avaliacoes registradas.',
    formula: '(pacientes com >=2 avaliacoes / totalPacientes) * 100'
  }
} as const;

@Injectable()
export class AnalyticsService {
  private readonly cache = new Map<string, CachedPayload>();

  constructor(
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(Paciente) private readonly pacientesRepo: Repository<Paciente>,
    @InjectRepository(Avaliacao) private readonly avaliacoesRepo: Repository<Avaliacao>,
    @InjectRepository(Agendamento) private readonly agendamentosRepo: Repository<Agendamento>,
    @InjectRepository(Projeto) private readonly projetosRepo: Repository<Projeto>,
    @Optional() private readonly observability?: ObservabilityService
  ) {}

  private async measureOperation<T>(
    label: string,
    operation: () => Promise<T>,
    context = 'GET /analytics/dashboard/summary'
  ) {
    const startedAt = Date.now();
    try {
      const result = await operation();
      this.observability?.recordQuery({
        label,
        durationMs: Date.now() - startedAt,
        context
      });
      return result;
    } catch (error) {
      this.observability?.recordQuery({
        label,
        durationMs: Date.now() - startedAt,
        context,
        isError: true
      });
      throw error;
    }
  }

  private normalizeRange(range?: string): RangeFilter {
    const normalized = String(range || '').trim().toLowerCase();
    if (normalized === 'week' || normalized === 'quarter' || normalized === 'year') {
      return normalized;
    }
    return 'month';
  }

  private normalizeProjectFilter(projectId?: string) {
    const normalized = String(projectId || '').trim();
    if (!normalized || normalized === 'all') return 'all';
    if (normalized === 'sem') return 'sem';
    return normalized;
  }

  private normalizeExportFormat(format?: string): ExportFormat {
    return String(format || '').trim().toLowerCase() === 'json' ? 'json' : 'csv';
  }

  private normalizeBoolean(value: unknown, defaultValue = false) {
    if (typeof value === 'boolean') return value;
    const normalized = String(value ?? '').trim().toLowerCase();
    if (!normalized) return defaultValue;
    return normalized === '1' || normalized === 'true' || normalized === 'yes';
  }

  private getRangeStart(range: RangeFilter, now = new Date()) {
    if (range === 'year') {
      return new Date(now.getFullYear(), 0, 1);
    }
    if (range === 'quarter') {
      return new Date(now.getFullYear(), now.getMonth() - 3, 1);
    }
    if (range === 'week') {
      return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
    }
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  private toDate(value?: string | Date | null) {
    if (!value) return null;
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }
    const parsed = new Date(String(value));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private inRange(value: string | Date | undefined | null, rangeStart: Date) {
    const date = this.toDate(value);
    if (!date) return false;
    return date.getTime() >= rangeStart.getTime();
  }

  private getCompleteness(meta: Record<string, unknown> | undefined | null) {
    if (!meta || typeof meta !== 'object') return 0;
    const raw = (meta as Record<string, unknown>).completude;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return 0;
    return parsed;
  }

  private getCacheKey(prefix: string, ...parts: string[]) {
    return `${prefix}:${parts.join(':')}`;
  }

  private setCache(key: string, payload: Record<string, unknown>, ttlMs: number) {
    if (this.cache.size >= CACHE_MAX_ENTRIES) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }
    this.cache.set(key, {
      payload,
      expiresAt: Date.now() + ttlMs
    });
  }

  private getCache(key: string) {
    const cached = this.cache.get(key);
    if (!cached) return null;
    if (cached.expiresAt <= Date.now()) {
      this.cache.delete(key);
      return null;
    }
    return cached.payload;
  }

  private createQuarterBuckets() {
    return [
      { period: 'Jan-Mar', alunos: 0, pacientes: 0, avaliacoes: 0, meta: 0 },
      { period: 'Abr-Jun', alunos: 0, pacientes: 0, avaliacoes: 0, meta: 0 },
      { period: 'Jul-Set', alunos: 0, pacientes: 0, avaliacoes: 0, meta: 0 },
      { period: 'Out-Dez', alunos: 0, pacientes: 0, avaliacoes: 0, meta: 0 }
    ] satisfies QuarterBucket[];
  }

  private mapUsageByType(avaliacoes: Array<Pick<Avaliacao, 'tipo'>>) {
    const byType = Object.keys(TYPE_LABELS).reduce<Record<string, number>>((acc, key) => {
      acc[key] = 0;
      return acc;
    }, {});

    avaliacoes.forEach((item) => {
      const normalized = String(item.tipo || '').trim().toLowerCase();
      if (Object.prototype.hasOwnProperty.call(byType, normalized)) {
        byType[normalized] += 1;
      }
    });

    const total = Math.max(avaliacoes.length, 1);
    return Object.keys(TYPE_LABELS).map((key) => ({
      key,
      label: TYPE_LABELS[key],
      color: TYPE_COLORS[key],
      count: byType[key] || 0,
      percentage: Math.round(((byType[key] || 0) / total) * 100)
    }));
  }

  private normalizeStatus(status?: string) {
    return String(status || '').trim().toLowerCase();
  }

  private formatRelativeTime(date: Date | null) {
    if (!date) return '-';
    const diffMs = Math.max(0, Date.now() - date.getTime());
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} h`;
    const days = Math.floor(hours / 24);
    return `${days} d`;
  }

  private formatCategoryLabel(value?: string | null, fallback = 'Nao informado') {
    const normalized = String(value || '').trim();
    if (!normalized) return fallback;
    return normalized
      .toLowerCase()
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  private getAppointmentTurn(item: Pick<Agendamento, 'time' | 'scheduledAt' | 'date'>) {
    const rawTime = String(item.time || '').trim();
    let hour = Number.NaN;
    if (rawTime) {
      const parsed = Number(rawTime.split(':')[0]);
      hour = Number.isFinite(parsed) ? parsed : Number.NaN;
    }

    if (!Number.isFinite(hour)) {
      const dateObj = this.toDate(item.scheduledAt || item.date);
      hour = dateObj ? dateObj.getHours() : Number.NaN;
    }

    if (!Number.isFinite(hour)) return 'sem_horario';
    if (hour >= 5 && hour <= 11) return 'manha';
    if (hour >= 12 && hour <= 17) return 'tarde';
    if (hour >= 18 && hour <= 23) return 'noite';
    return 'madrugada';
  }

  private getLeadTimeBucket(
    item: Pick<Agendamento, 'createdAt' | 'scheduledAt' | 'date' | 'time'>
  ) {
    const createdAt = this.toDate(item.createdAt);
    const scheduledAt = this.toDate(item.scheduledAt || item.date);
    if (!createdAt || !scheduledAt) return 'sem_referencia';
    const diffDays = (scheduledAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays <= 1) return '0-1_dia';
    if (diffDays <= 7) return '2-7_dias';
    if (diffDays <= 14) return '8-14_dias';
    return '15+_dias';
  }

  private getConsultIntervalBucket(intervalDays: number | null) {
    if (!Number.isFinite(intervalDays as number) || intervalDays === null) return 'sem_consulta';
    if (intervalDays <= 7) return '0-7_dias';
    if (intervalDays <= 21) return '8-21_dias';
    return '22+_dias';
  }

  private computeBinaryAssociation(
    entries: Array<{ category: string; event: boolean }>,
    minSampleSize = 3
  ) {
    const validEntries = entries.filter((item) => !!item.category);
    const totalEvents = validEntries.filter((item) => item.event).length;
    const totalNonEvents = validEntries.length - totalEvents;
    if (!validEntries.length) return [];

    const byCategory = new Map<string, { total: number; events: number }>();
    validEntries.forEach((item) => {
      const bucket = byCategory.get(item.category) || { total: 0, events: 0 };
      bucket.total += 1;
      if (item.event) bucket.events += 1;
      byCategory.set(item.category, bucket);
    });

    return Array.from(byCategory.entries())
      .map(([category, bucket]) => {
        const a = bucket.events;
        const b = bucket.total - bucket.events;
        const c = totalEvents - a;
        const d = totalNonEvents - b;

        const aAdj = a + 0.5;
        const bAdj = b + 0.5;
        const cAdj = c + 0.5;
        const dAdj = d + 0.5;
        const oddsRatio = (aAdj * dAdj) / (bAdj * cAdj);
        const eventRate = bucket.total > 0 ? (a / bucket.total) * 100 : 0;
        const baselineRate = validEntries.length > 0 ? (totalEvents / validEntries.length) * 100 : 0;

        return {
          label: this.formatCategoryLabel(category),
          key: category,
          sampleSize: bucket.total,
          events: a,
          nonEvents: b,
          eventRate: Number(eventRate.toFixed(1)),
          baselineRate: Number(baselineRate.toFixed(1)),
          oddsRatio: Number(oddsRatio.toFixed(2)),
          deltaVsBaseline: Number((eventRate - baselineRate).toFixed(1))
        };
      })
      .filter((item) => item.sampleSize >= minSampleSize)
      .sort((left, right) => {
        if (right.eventRate !== left.eventRate) return right.eventRate - left.eventRate;
        return right.sampleSize - left.sampleSize;
      });
  }

  private getNumericCompleteness(value: unknown) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    return parsed;
  }

  private buildAverageByCategory(
    entries: Array<{ category: string; value: number }>,
    minSampleSize = 2
  ) {
    const byCategory = new Map<string, { sum: number; total: number }>();
    entries.forEach((item) => {
      const bucket = byCategory.get(item.category) || { sum: 0, total: 0 };
      bucket.sum += item.value;
      bucket.total += 1;
      byCategory.set(item.category, bucket);
    });

    return Array.from(byCategory.entries())
      .map(([category, bucket]) => ({
        key: category,
        label: this.formatCategoryLabel(category),
        sampleSize: bucket.total,
        averageCompleteness: Number((bucket.sum / Math.max(1, bucket.total)).toFixed(1))
      }))
      .filter((item) => item.sampleSize >= minSampleSize)
      .sort((left, right) => right.averageCompleteness - left.averageCompleteness);
  }

  private rank(values: number[]) {
    const sorted = values
      .map((value, index) => ({ value, index }))
      .sort((left, right) => left.value - right.value);
    const ranks = Array(values.length).fill(0);
    for (let i = 0; i < sorted.length; i += 1) {
      let j = i;
      while (j + 1 < sorted.length && sorted[j + 1].value === sorted[i].value) {
        j += 1;
      }
      const rank = (i + j + 2) / 2;
      for (let k = i; k <= j; k += 1) {
        ranks[sorted[k].index] = rank;
      }
      i = j;
    }
    return ranks;
  }

  private computeSpearmanCorrelation(pairs: Array<{ x: number; y: number }>) {
    if (pairs.length < 3) {
      return {
        coefficient: null,
        sampleSize: pairs.length,
        interpretation: 'Amostra insuficiente para correlacao'
      };
    }

    const xs = pairs.map((item) => item.x);
    const ys = pairs.map((item) => item.y);
    const rankedX = this.rank(xs);
    const rankedY = this.rank(ys);
    const meanX = rankedX.reduce((acc, value) => acc + value, 0) / rankedX.length;
    const meanY = rankedY.reduce((acc, value) => acc + value, 0) / rankedY.length;
    let numerator = 0;
    let denominatorX = 0;
    let denominatorY = 0;

    for (let index = 0; index < rankedX.length; index += 1) {
      const dx = rankedX[index] - meanX;
      const dy = rankedY[index] - meanY;
      numerator += dx * dy;
      denominatorX += dx * dx;
      denominatorY += dy * dy;
    }

    const denominator = Math.sqrt(denominatorX * denominatorY);
    const coefficient = denominator > 0 ? numerator / denominator : 0;
    const absValue = Math.abs(coefficient);
    let interpretation = 'Correlacao muito fraca';
    if (absValue >= 0.7) interpretation = 'Correlacao forte';
    else if (absValue >= 0.4) interpretation = 'Correlacao moderada';
    else if (absValue >= 0.2) interpretation = 'Correlacao fraca';

    return {
      coefficient: Number(coefficient.toFixed(3)),
      sampleSize: pairs.length,
      interpretation
    };
  }

  private mapTopDrivers(
    absenteeismByTurn: Array<Record<string, unknown>>,
    absenteeismByLeadTime: Array<Record<string, unknown>>,
    completenessByType: Array<Record<string, unknown>>,
    retentionByInterval: Array<Record<string, unknown>>
  ) {
    const drivers: Array<Record<string, unknown>> = [];
    const topTurn = absenteeismByTurn[0];
    if (topTurn) {
      const eventRate = Number(topTurn.eventRate || 0);
      drivers.push({
        id: 'absenteeism_turn',
        title: `Turno critico: ${topTurn.label}`,
        target: 'absenteeism',
        targetLabel: 'Faltas',
        severity: eventRate >= 40 ? 'high' : eventRate >= 25 ? 'medium' : 'low',
        insight: `Este turno concentra ${eventRate.toFixed(1)}% de faltas no recorte atual.`,
        metricLabel: 'Taxa de falta',
        metricValue: `${eventRate.toFixed(1)}%`,
        recommendation: 'Revisar distribuicao de horarios e reforcar confirmacao no dia anterior.'
      });
    }

    const topLead = absenteeismByLeadTime[0];
    if (topLead) {
      const eventRate = Number(topLead.eventRate || 0);
      drivers.push({
        id: 'absenteeism_leadtime',
        title: `Lead time sensivel: ${topLead.label}`,
        target: 'absenteeism',
        targetLabel: 'Faltas',
        severity: eventRate >= 35 ? 'high' : eventRate >= 20 ? 'medium' : 'low',
        insight: `Agendamentos nesse intervalo apresentam maior risco de falta.`,
        metricLabel: 'Taxa de falta',
        metricValue: `${eventRate.toFixed(1)}%`,
        recommendation: 'Criar protocolo de confirmacao automatica para essa janela de antecedencia.'
      });
    }

    const lowestCompleteness = completenessByType[completenessByType.length - 1];
    if (lowestCompleteness) {
      const avg = Number(lowestCompleteness.averageCompleteness || 0);
      drivers.push({
        id: 'completeness_type',
        title: `Completude baixa em ${lowestCompleteness.label}`,
        target: 'completeness',
        targetLabel: 'Completude',
        severity: avg < 60 ? 'high' : avg < 75 ? 'medium' : 'low',
        insight: `A media de completude desse tipo esta em ${avg.toFixed(1)}%.`,
        metricLabel: 'Completude media',
        metricValue: `${avg.toFixed(1)}%`,
        recommendation: 'Padronizar checklist minimo e revisar orientacao do responsavel.'
      });
    }

    const lowestRetention = retentionByInterval[retentionByInterval.length - 1];
    if (lowestRetention) {
      const rate = Number(lowestRetention.retentionRate || 0);
      drivers.push({
        id: 'retention_interval',
        title: `Retencao baixa para ${lowestRetention.label}`,
        target: 'retention',
        targetLabel: 'Retencao',
        severity: rate < 40 ? 'high' : rate < 60 ? 'medium' : 'low',
        insight: `Pacientes nessa faixa mantem ${rate.toFixed(1)}% de retencao.`,
        metricLabel: 'Retencao',
        metricValue: `${rate.toFixed(1)}%`,
        recommendation: 'Revisar frequencia de retorno e plano de acompanhamento continuo.'
      });
    }

    return drivers;
  }

  private mapCorrelationAlerts(drivers: Array<Record<string, unknown>>) {
    return drivers
      .filter((driver) => ['high', 'medium'].includes(String(driver.severity || '').toLowerCase()))
      .slice(0, 5)
      .map((driver) => ({
        id: driver.id,
        target: driver.target,
        severity: driver.severity,
        title: driver.title,
        recommendation: driver.recommendation
      }));
  }

  private escapeCsvValue(value: unknown) {
    if (value === null || value === undefined) return '""';
    const normalized = String(value).replace(/"/g, '""');
    return `"${normalized}"`;
  }

  private toCsvLine(headers: string[], row: Record<string, unknown>) {
    return headers.map((header) => this.escapeCsvValue(row[header])).join(',');
  }

  private anonymizeString(value: string) {
    if (!value) return '';
    return `anon-${String(value).slice(0, 8)}`;
  }

  private async getScopedPacientes(projectFilter: string) {
    if (projectFilter === 'all') {
      return this.pacientesRepo.find({
        select: {
          id: true,
          nome: true,
          status: true,
          alunoResponsavelId: true,
          alunoResponsavelNome: true,
          professorSupervisorId: true,
          professorSupervisorNome: true,
          projetoId: true,
          projetoNome: true,
          dataCadastro: true,
          createdAt: true,
          updatedAt: true
        }
      });
    }

    if (projectFilter === 'sem') {
      return this.pacientesRepo.find({
        where: { projetoId: IsNull() },
        select: {
          id: true,
          nome: true,
          status: true,
          alunoResponsavelId: true,
          alunoResponsavelNome: true,
          professorSupervisorId: true,
          professorSupervisorNome: true,
          projetoId: true,
          projetoNome: true,
          dataCadastro: true,
          createdAt: true,
          updatedAt: true
        }
      });
    }

    return this.pacientesRepo.find({
      where: { projetoId: projectFilter },
      select: {
        id: true,
        nome: true,
        status: true,
        alunoResponsavelId: true,
        alunoResponsavelNome: true,
        professorSupervisorId: true,
        professorSupervisorNome: true,
        projetoId: true,
        projetoNome: true,
        dataCadastro: true,
        createdAt: true,
        updatedAt: true
      }
    });
  }

  private async getScopedAvaliacoes(projectFilter: string) {
    if (projectFilter === 'all') {
      return this.avaliacoesRepo.find({
        select: {
          id: true,
          tipo: true,
          pacienteId: true,
          status: true,
          projetoId: true,
          meta: true,
          createdAt: true,
          data: true
        }
      });
    }

    if (projectFilter === 'sem') {
      return this.avaliacoesRepo.find({
        where: { projetoId: IsNull() },
        select: {
          id: true,
          tipo: true,
          pacienteId: true,
          status: true,
          projetoId: true,
          meta: true,
          createdAt: true,
          data: true
        }
      });
    }

    return this.avaliacoesRepo.find({
      where: { projetoId: projectFilter },
      select: {
        id: true,
        tipo: true,
        pacienteId: true,
        status: true,
        projetoId: true,
        meta: true,
        createdAt: true,
        data: true
      }
    });
  }

  private async getScopedAgendamentos(projectFilter: string, pacienteIds: string[]) {
    if (projectFilter === 'all') {
      return this.agendamentosRepo.find({
        select: {
          id: true,
          pacienteId: true,
          pacienteNome: true,
          alunoId: true,
          alunoNome: true,
          status: true,
          appointmentType: true,
          scheduledAt: true,
          date: true,
          time: true,
          createdAt: true,
          updatedAt: true
        }
      });
    }

    if (pacienteIds.length === 0) {
      return [];
    }

    return this.agendamentosRepo.find({
      where: { pacienteId: In(pacienteIds) },
      select: {
        id: true,
        pacienteId: true,
        pacienteNome: true,
        alunoId: true,
        alunoNome: true,
        status: true,
        appointmentType: true,
        scheduledAt: true,
        date: true,
        time: true,
        createdAt: true,
        updatedAt: true
      }
    });
  }

  private async fetchPacientesForExport(projectFilter: string) {
    const where = projectFilter === 'all'
      ? undefined
      : projectFilter === 'sem'
        ? { projetoId: IsNull() }
        : { projetoId: projectFilter };

    let offset = 0;
    const collection: Array<Pick<Paciente, 'id' | 'nome' | 'status' | 'projetoId' | 'projetoNome' | 'consentimentoPesquisa'>> = [];
    while (true) {
      const page = await this.pacientesRepo.find({
        where,
        select: {
          id: true,
          nome: true,
          status: true,
          projetoId: true,
          projetoNome: true,
          consentimentoPesquisa: true,
          alunoResponsavelId: true,
          alunoResponsavelNome: true,
          createdAt: true,
          updatedAt: true
        },
        take: EXPORT_PAGE_SIZE,
        skip: offset,
        order: {
          createdAt: 'DESC'
        }
      });
      collection.push(...page);
      if (page.length < EXPORT_PAGE_SIZE) break;
      offset += page.length;
    }
    return collection;
  }

  private async fetchAvaliacoesForExport(projectFilter: string) {
    const where = projectFilter === 'all'
      ? undefined
      : projectFilter === 'sem'
        ? { projetoId: IsNull() }
        : { projetoId: projectFilter };

    let offset = 0;
    const collection: Array<Pick<Avaliacao, 'id' | 'pacienteId' | 'projetoId' | 'projetoNome' | 'tipo' | 'status' | 'meta' | 'createdAt' | 'updatedAt'>> = [];
    while (true) {
      const page = await this.avaliacoesRepo.find({
        where,
        select: {
          id: true,
          pacienteId: true,
          projetoId: true,
          projetoNome: true,
          tipo: true,
          status: true,
          meta: true,
          createdAt: true,
          updatedAt: true
        },
        take: EXPORT_PAGE_SIZE,
        skip: offset,
        order: {
          createdAt: 'DESC'
        }
      });
      collection.push(...page);
      if (page.length < EXPORT_PAGE_SIZE) break;
      offset += page.length;
    }
    return collection;
  }

  private async fetchAgendamentosForExport(projectFilter: string, pacienteIds: string[]) {
    const collection: Array<Pick<Agendamento, 'id' | 'pacienteId' | 'pacienteNome' | 'status' | 'date' | 'time' | 'appointmentType' | 'scheduledAt' | 'alunoId' | 'alunoNome' | 'createdAt' | 'updatedAt'>> = [];

    if (projectFilter === 'all') {
      let offset = 0;
      while (true) {
        const page = await this.agendamentosRepo.find({
          select: {
            id: true,
            pacienteId: true,
            pacienteNome: true,
            status: true,
            date: true,
            time: true,
            appointmentType: true,
            scheduledAt: true,
            alunoId: true,
            alunoNome: true,
            createdAt: true,
            updatedAt: true
          },
          take: EXPORT_PAGE_SIZE,
          skip: offset,
          order: {
            createdAt: 'DESC'
          }
        });
        collection.push(...page);
        if (page.length < EXPORT_PAGE_SIZE) break;
        offset += page.length;
      }
      return collection;
    }

    if (!pacienteIds.length) {
      return collection;
    }

    const chunkSize = 200;
    for (let index = 0; index < pacienteIds.length; index += chunkSize) {
      const idsChunk = pacienteIds.slice(index, index + chunkSize);
      let offset = 0;
      while (true) {
        const page = await this.agendamentosRepo.find({
          where: { pacienteId: In(idsChunk) },
          select: {
            id: true,
            pacienteId: true,
            pacienteNome: true,
            status: true,
            date: true,
            time: true,
            appointmentType: true,
            scheduledAt: true,
            alunoId: true,
            alunoNome: true,
            createdAt: true,
            updatedAt: true
          },
          take: EXPORT_PAGE_SIZE,
          skip: offset,
          order: {
            createdAt: 'DESC'
          }
        });
        collection.push(...page);
        if (page.length < EXPORT_PAGE_SIZE) break;
        offset += page.length;
      }
    }

    return collection;
  }

  private buildProjectWhere(projectFilter: string) {
    if (projectFilter === 'all') return undefined;
    if (projectFilter === 'sem') return { projetoId: IsNull() };
    return { projetoId: projectFilter };
  }

  private async *iteratePacientesForExport(projectFilter: string) {
    const where = this.buildProjectWhere(projectFilter);
    let offset = 0;

    while (true) {
      const page = await this.pacientesRepo.find({
        where,
        select: {
          id: true,
          nome: true,
          status: true,
          projetoId: true,
          projetoNome: true,
          consentimentoPesquisa: true,
          alunoResponsavelId: true,
          alunoResponsavelNome: true,
          createdAt: true,
          updatedAt: true
        },
        take: EXPORT_PAGE_SIZE,
        skip: offset,
        order: {
          createdAt: 'DESC'
        }
      });

      if (!page.length) return;
      yield page;
      if (page.length < EXPORT_PAGE_SIZE) return;
      offset += page.length;
    }
  }

  private async *iterateAvaliacoesForExport(projectFilter: string) {
    const where = this.buildProjectWhere(projectFilter);
    let offset = 0;

    while (true) {
      const page = await this.avaliacoesRepo.find({
        where,
        select: {
          id: true,
          pacienteId: true,
          projetoId: true,
          projetoNome: true,
          tipo: true,
          status: true,
          meta: true,
          createdAt: true,
          updatedAt: true
        },
        take: EXPORT_PAGE_SIZE,
        skip: offset,
        order: {
          createdAt: 'DESC'
        }
      });

      if (!page.length) return;
      yield page;
      if (page.length < EXPORT_PAGE_SIZE) return;
      offset += page.length;
    }
  }

  private async *iterateAgendamentosForExportAll() {
    let offset = 0;
    while (true) {
      const page = await this.agendamentosRepo.find({
        select: {
          id: true,
          pacienteId: true,
          pacienteNome: true,
          status: true,
          date: true,
          time: true,
          appointmentType: true,
          scheduledAt: true,
          alunoId: true,
          alunoNome: true,
          createdAt: true,
          updatedAt: true
        },
        take: EXPORT_PAGE_SIZE,
        skip: offset,
        order: {
          createdAt: 'DESC'
        }
      });
      if (!page.length) return;
      yield page;
      if (page.length < EXPORT_PAGE_SIZE) return;
      offset += page.length;
    }
  }

  private async *iterateAgendamentosForExportByPacienteIds(pacienteIds: string[]) {
    const chunkSize = 200;
    for (let index = 0; index < pacienteIds.length; index += chunkSize) {
      const idsChunk = pacienteIds.slice(index, index + chunkSize);
      let offset = 0;
      while (true) {
        const page = await this.agendamentosRepo.find({
          where: { pacienteId: In(idsChunk) },
          select: {
            id: true,
            pacienteId: true,
            pacienteNome: true,
            status: true,
            date: true,
            time: true,
            appointmentType: true,
            scheduledAt: true,
            alunoId: true,
            alunoNome: true,
            createdAt: true,
            updatedAt: true
          },
          take: EXPORT_PAGE_SIZE,
          skip: offset,
          order: {
            createdAt: 'DESC'
          }
        });
        if (!page.length) break;
        yield page;
        if (page.length < EXPORT_PAGE_SIZE) break;
        offset += page.length;
      }
    }
  }

  async getReportsOverview(query: ReportsQuery) {
    const range = this.normalizeRange(query.range);
    const projectFilter = this.normalizeProjectFilter(query.projectId);
    const cacheKey = this.getCacheKey('reports', range, projectFilter);

    if (!query.forceRefresh) {
      const cached = this.getCache(cacheKey);
      if (cached) {
        return {
          ...cached,
          cache: {
            hit: true,
            ttlSeconds: Math.floor(REPORT_CACHE_TTL_MS / 1000)
          }
        };
      }
    }

    const rangeStart = this.getRangeStart(range);

    const [users, scopedPacientes, scopedAvaliacoes, projects] = await Promise.all([
      this.usersRepo.find({
        select: {
          id: true,
          role: true,
          createdAt: true
        }
      }),
      this.getScopedPacientes(projectFilter),
      this.getScopedAvaliacoes(projectFilter),
      this.projetosRepo.find({
        select: {
          id: true,
          nome: true
        },
        order: {
          nome: 'ASC'
        }
      })
    ]);

    const pacienteIds = scopedPacientes.map((item) => item.id);
    const scopedAgendamentos = await this.getScopedAgendamentos(projectFilter, pacienteIds);

    const alunos = projectFilter === 'all'
      ? users.filter((item) => isStudentMemberRole(item.role)).length
      : new Set(
        scopedPacientes
          .map((item) => item.alunoResponsavelId)
          .filter((id): id is string => !!id)
      ).size;

    const professores = projectFilter === 'all'
      ? users.filter((item) => {
        const role = this.normalizeStatus(item.role);
        return role === 'professor' || role === 'profissional';
      }).length
      : new Set(
        scopedPacientes
          .map((item) => item.professorSupervisorId)
          .filter((id): id is string => !!id)
      ).size;

    const pacientesVinculados = scopedPacientes.filter((item) => !!item.alunoResponsavelId);
    const taxaVinculacao = scopedPacientes.length > 0
      ? Math.round((pacientesVinculados.length / scopedPacientes.length) * 100)
      : 0;

    const avaliacoesPeriodo = scopedAvaliacoes.filter((item) => (
      this.inRange(item.createdAt || item.data, rangeStart)
    ));

    const integridade = scopedAvaliacoes.length > 0
      ? Math.round((
        scopedAvaliacoes.filter((item) => this.getCompleteness(item.meta) >= 80).length
        / scopedAvaliacoes.length
      ) * 100)
      : 0;

    const completionRate = scopedAgendamentos.length > 0
      ? Math.round((
        scopedAgendamentos.filter((item) => this.normalizeStatus(item.status) === 'realizada').length
        / scopedAgendamentos.length
      ) * 100)
      : 0;

    const satisfacao = Number(((completionRate / 100) * 5).toFixed(1));

    const byPaciente = new Map<string, number>();
    scopedAvaliacoes.forEach((item) => {
      if (!item.pacienteId) return;
      byPaciente.set(item.pacienteId, (byPaciente.get(item.pacienteId) || 0) + 1);
    });
    const retidos = scopedPacientes.filter((item) => (byPaciente.get(item.id) || 0) >= 2).length;
    const retencao = scopedPacientes.length > 0
      ? Math.round((retidos / scopedPacientes.length) * 100)
      : 0;

    const usageByType = this.mapUsageByType(scopedAvaliacoes);

    const quarters = this.createQuarterBuckets();
    const currentYear = new Date().getFullYear();

    users.forEach((item) => {
      if (!isStudentMemberRole(item.role)) return;
      const createdAt = this.toDate(item.createdAt);
      if (!createdAt || createdAt.getFullYear() !== currentYear) return;
      const quarterIndex = Math.floor(createdAt.getMonth() / 3);
      quarters[quarterIndex].alunos += 1;
    });

    scopedPacientes.forEach((item) => {
      const dateRef = this.toDate(item.dataCadastro || item.createdAt);
      if (!dateRef || dateRef.getFullYear() !== currentYear) return;
      const quarterIndex = Math.floor(dateRef.getMonth() / 3);
      quarters[quarterIndex].pacientes += 1;
    });

    scopedAvaliacoes.forEach((item) => {
      const dateRef = this.toDate(item.createdAt || item.data);
      if (!dateRef || dateRef.getFullYear() !== currentYear) return;
      const quarterIndex = Math.floor(dateRef.getMonth() / 3);
      quarters[quarterIndex].avaliacoes += 1;
    });

    quarters.forEach((quarter) => {
      quarter.meta = Math.max(quarter.avaliacoes, 10);
    });

    const response = {
      generatedAt: new Date().toISOString(),
      filters: {
        range,
        projectId: projectFilter
      },
      projects,
      metrics: {
        totalAlunos: alunos,
        professores,
        totalPacientes: scopedPacientes.length,
        avaliacoesPeriodo: avaliacoesPeriodo.length,
        taxaVinculacao,
        integridade,
        completionRate,
        satisfacao,
        retencao
      },
      metricDefinitions: METRIC_DEFINITIONS,
      usageByType,
      quarterly: quarters,
      cache: {
        hit: false,
        ttlSeconds: Math.floor(REPORT_CACHE_TTL_MS / 1000)
      }
    };

    this.setCache(cacheKey, response, REPORT_CACHE_TTL_MS);
    return response;
  }

  async getDashboardSummary(query: DashboardQuery) {
    const projectFilter = this.normalizeProjectFilter(query.projectId);
    const cacheKey = this.getCacheKey('dashboard', 'summary', projectFilter);
    if (!query.forceRefresh) {
      const cached = this.getCache(cacheKey);
      if (cached) {
        return {
          ...cached,
          cache: {
            hit: true,
            ttlSeconds: Math.floor(DASHBOARD_CACHE_TTL_MS / 1000)
          }
        };
      }
    }

    const [users, pacientes, avaliacoes] = await Promise.all([
      this.measureOperation('analytics.dashboard.users.find', () => this.usersRepo.find({
        select: {
          id: true,
          role: true,
          name: true,
          email: true,
          createdAt: true,
          updatedAt: true
        }
      })),
      this.measureOperation('analytics.dashboard.pacientes.find', () => this.getScopedPacientes(projectFilter)),
      this.measureOperation('analytics.dashboard.avaliacoes.find', () => this.getScopedAvaliacoes(projectFilter))
    ]);
    const agendamentos = await this.measureOperation(
      'analytics.dashboard.agendamentos.find',
      () => this.getScopedAgendamentos(
        projectFilter,
        pacientes.map((item) => item.id)
      )
    );

    const professors = projectFilter === 'all'
      ? users.filter((item) => {
        const role = this.normalizeStatus(item.role);
        return role === 'professor' || role === 'profissional';
      }).length
      : new Set(
        pacientes
          .map((item) => item.professorSupervisorId)
          .filter((id): id is string => !!id)
      ).size;

    const activePatients = pacientes.filter((item) => this.normalizeStatus(item.status) === 'ativo').length;
    const waitingList = pacientes.filter((item) => {
      const status = this.normalizeStatus(item.status);
      return status === 'triagem' || status === 'espera' || status === 'lista de espera';
    }).length;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const weekEnd = new Date(todayStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const last30Start = new Date(todayStart);
    last30Start.setDate(last30Start.getDate() - 30);

    const normalizedAppointments = agendamentos
      .map((item) => {
        const dateObj = this.toDate(item.scheduledAt || item.date);
        return {
          id: item.id,
          pacienteId: item.pacienteId || null,
          pacienteNome: item.pacienteNome || 'Paciente',
          alunoId: item.alunoId || null,
          alunoNome: item.alunoNome || null,
          status: item.status || 'agendada',
          appointmentType: item.appointmentType || null,
          scheduledAt: item.scheduledAt || item.date || null,
          date: item.date || null,
          time: item.time || null,
          createdAt: item.createdAt || null,
          updatedAt: item.updatedAt || null,
          dateObj
        };
      })
      .sort((a, b) => (b.dateObj?.getTime() || 0) - (a.dateObj?.getTime() || 0));

    const todayList = normalizedAppointments.filter((item) => item.dateObj && item.dateObj >= todayStart && item.dateObj < todayEnd);
    const weekList = normalizedAppointments.filter((item) => item.dateObj && item.dateObj >= todayStart && item.dateObj < weekEnd);
    const last30List = normalizedAppointments.filter((item) => item.dateObj && item.dateObj >= last30Start && item.dateObj <= todayEnd);

    const totalLast30 = Math.max(last30List.length, 1);
    const appointmentStatusCount = last30List.reduce<Record<string, number>>((acc, item) => {
      const status = this.normalizeStatus(item.status) || 'agendada';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    const recentUsers = users
      .map((item) => ({
        id: `user-${item.id}`,
        action: 'Novo usuario',
        label: item.name || item.email || 'Usuario',
        type: 'user',
        occurredAt: this.toDate(item.createdAt || item.updatedAt)
      }))
      .sort((a, b) => (b.occurredAt?.getTime() || 0) - (a.occurredAt?.getTime() || 0))
      .slice(0, 6);

    const recentPacientes = pacientes
      .map((item) => ({
        id: `patient-${item.id}`,
        action: 'Novo paciente',
        label: item.nome || 'Paciente',
        type: 'link',
        occurredAt: this.toDate(item.createdAt || item.updatedAt || item.dataCadastro)
      }))
      .sort((a, b) => (b.occurredAt?.getTime() || 0) - (a.occurredAt?.getTime() || 0))
      .slice(0, 6);

    const recentAvaliacoes = avaliacoes
      .map((item) => ({
        id: `evaluation-${item.id}`,
        action: 'Nova avaliacao',
        label: item.tipo || 'Avaliacao',
        type: 'report',
        occurredAt: this.toDate(item.createdAt || item.data)
      }))
      .sort((a, b) => (b.occurredAt?.getTime() || 0) - (a.occurredAt?.getTime() || 0))
      .slice(0, 6);

    const appointmentActivities = normalizedAppointments
      .slice(0, 12)
      .map((item) => {
        const normalizedStatus = this.normalizeStatus(item.status) || 'agendada';
        return {
          id: `appointment-${item.id}`,
          action: APPOINTMENT_STATUS_LABELS[normalizedStatus] || APPOINTMENT_STATUS_LABELS.agendada,
          label: item.pacienteNome || 'Paciente',
          type: normalizedStatus === 'agendada' ? 'consulta' : normalizedStatus,
          occurredAt: this.toDate(item.updatedAt || item.createdAt || item.scheduledAt)
        };
      });

    const recentActivities = [...recentUsers, ...recentPacientes, ...recentAvaliacoes, ...appointmentActivities]
      .sort((a, b) => (b.occurredAt?.getTime() || 0) - (a.occurredAt?.getTime() || 0))
      .slice(0, 10)
      .map((item) => ({
        id: item.id,
        action: item.action,
        label: item.label,
        type: item.type,
        occurredAt: item.occurredAt?.toISOString() || null,
        time: this.formatRelativeTime(item.occurredAt || null)
      }));

    const response = {
      generatedAt: new Date().toISOString(),
      filters: {
        projectId: projectFilter
      },
      metrics: {
        totalPatients: pacientes.length,
        professors,
        activePatients,
        waitingList
      },
      appointments: {
        summary: {
          todayCount: todayList.length,
          weekCount: weekList.length,
          noShowRate: Math.round(((appointmentStatusCount.falta || 0) / totalLast30) * 100),
          rescheduleRate: Math.round(((appointmentStatusCount.remarcada || 0) / totalLast30) * 100),
          completionRate: Math.round(((appointmentStatusCount.realizada || 0) / totalLast30) * 100)
        },
        items: normalizedAppointments.map((item) => ({
          id: item.id,
          pacienteId: item.pacienteId,
          pacienteNome: item.pacienteNome,
          alunoId: item.alunoId,
          alunoNome: item.alunoNome,
          status: item.status,
          appointmentType: item.appointmentType,
          scheduledAt: item.scheduledAt,
          date: item.date,
          time: item.time,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt
        }))
      },
      recentActivities,
      cache: {
        hit: false,
        ttlSeconds: Math.floor(DASHBOARD_CACHE_TTL_MS / 1000)
      }
    };

    this.setCache(cacheKey, response, DASHBOARD_CACHE_TTL_MS);
    return response;
  }

  async getCorrelations(query: DashboardQuery) {
    const projectFilter = this.normalizeProjectFilter(query.projectId);
    const cacheKey = this.getCacheKey('analytics', 'correlations', projectFilter);
    if (!query.forceRefresh) {
      const cached = this.getCache(cacheKey);
      if (cached) {
        return {
          ...cached,
          cache: {
            hit: true,
            ttlSeconds: Math.floor(CORRELATIONS_CACHE_TTL_MS / 1000)
          }
        };
      }
    }

    const [pacientes, avaliacoes] = await Promise.all([
      this.getScopedPacientes(projectFilter),
      this.getScopedAvaliacoes(projectFilter)
    ]);
    const agendamentos = await this.getScopedAgendamentos(
      projectFilter,
      pacientes.map((item) => item.id)
    );

    const patientById = new Map(
      pacientes.map((patient) => [patient.id, patient] as const)
    );

    const retentionByPatient = new Map<string, number>();
    avaliacoes.forEach((item) => {
      if (!item.pacienteId) return;
      retentionByPatient.set(item.pacienteId, (retentionByPatient.get(item.pacienteId) || 0) + 1);
    });

    const noShowByTurn = this.computeBinaryAssociation(
      agendamentos.map((appointment) => ({
        category: this.getAppointmentTurn(appointment),
        event: this.normalizeStatus(appointment.status) === 'falta'
      }))
    );

    const noShowByLeadTime = this.computeBinaryAssociation(
      agendamentos.map((appointment) => ({
        category: this.getLeadTimeBucket(appointment),
        event: this.normalizeStatus(appointment.status) === 'falta'
      }))
    );

    const noShowByType = this.computeBinaryAssociation(
      agendamentos.map((appointment) => ({
        category: String(appointment.appointmentType || 'nao_informado').trim().toLowerCase(),
        event: this.normalizeStatus(appointment.status) === 'falta'
      }))
    );

    const noShowByProject = this.computeBinaryAssociation(
      agendamentos.map((appointment) => {
        const patient = appointment.pacienteId ? patientById.get(appointment.pacienteId) : null;
        return {
          category: String(patient?.projetoNome || patient?.projetoId || 'sem_projeto').trim().toLowerCase(),
          event: this.normalizeStatus(appointment.status) === 'falta'
        };
      })
    );

    const noShowByResponsible = this.computeBinaryAssociation(
      agendamentos.map((appointment) => {
        const patient = appointment.pacienteId ? patientById.get(appointment.pacienteId) : null;
        return {
          category: String(
            appointment.alunoNome
            || patient?.alunoResponsavelNome
            || appointment.alunoId
            || patient?.alunoResponsavelId
            || 'nao_atribuido'
          ).trim().toLowerCase(),
          event: this.normalizeStatus(appointment.status) === 'falta'
        };
      })
    );

    const appointmentsByPatient = new Map<string, Array<Date>>();
    agendamentos.forEach((item) => {
      if (!item.pacienteId) return;
      const scheduled = this.toDate(item.scheduledAt || item.date);
      if (!scheduled) return;
      const bucket = appointmentsByPatient.get(item.pacienteId) || [];
      bucket.push(scheduled);
      appointmentsByPatient.set(item.pacienteId, bucket);
    });

    const frequencyByPatient = new Map<string, number>();
    appointmentsByPatient.forEach((dates, patientId) => {
      frequencyByPatient.set(patientId, dates.length);
    });

    const completenessPairs: Array<{ x: number; y: number }> = [];
    const completenessByTypeInput: Array<{ category: string; value: number }> = [];
    const completenessByProjectInput: Array<{ category: string; value: number }> = [];
    const completenessByResponsibleInput: Array<{ category: string; value: number }> = [];

    avaliacoes.forEach((evaluation) => {
      const completeness = this.getNumericCompleteness(
        (evaluation.meta as Record<string, unknown> | undefined)?.completude
      );
      if (completeness === null) return;
      const patient = evaluation.pacienteId ? patientById.get(evaluation.pacienteId) : null;
      const frequency = evaluation.pacienteId ? (frequencyByPatient.get(evaluation.pacienteId) || 0) : 0;
      completenessPairs.push({ x: frequency, y: completeness });
      completenessByTypeInput.push({
        category: String(evaluation.tipo || 'nao_informado').trim().toLowerCase(),
        value: completeness
      });
      completenessByProjectInput.push({
        category: String(patient?.projetoNome || patient?.projetoId || 'sem_projeto').trim().toLowerCase(),
        value: completeness
      });
      completenessByResponsibleInput.push({
        category: String(
          patient?.alunoResponsavelNome
          || patient?.alunoResponsavelId
          || 'nao_atribuido'
        ).trim().toLowerCase(),
        value: completeness
      });
    });

    const spearmanFrequency = this.computeSpearmanCorrelation(completenessPairs);
    const completenessByType = this.buildAverageByCategory(completenessByTypeInput);
    const completenessByProject = this.buildAverageByCategory(completenessByProjectInput);
    const completenessByResponsible = this.buildAverageByCategory(completenessByResponsibleInput);

    const averageIntervalByPatient = new Map<string, number | null>();
    appointmentsByPatient.forEach((dates, patientId) => {
      const ordered = [...dates].sort((a, b) => a.getTime() - b.getTime());
      if (ordered.length < 2) {
        averageIntervalByPatient.set(patientId, null);
        return;
      }
      let totalDays = 0;
      for (let index = 1; index < ordered.length; index += 1) {
        totalDays += (ordered[index].getTime() - ordered[index - 1].getTime()) / (1000 * 60 * 60 * 24);
      }
      averageIntervalByPatient.set(patientId, totalDays / (ordered.length - 1));
    });

    const retentionByIntervalRaw = this.computeBinaryAssociation(
      pacientes.map((patient) => ({
        category: this.getConsultIntervalBucket(averageIntervalByPatient.get(patient.id) ?? null),
        event: (retentionByPatient.get(patient.id) || 0) >= 2
      }))
    );
    const retentionByProjectRaw = this.computeBinaryAssociation(
      pacientes.map((patient) => ({
        category: String(patient.projetoNome || patient.projetoId || 'sem_projeto').trim().toLowerCase(),
        event: (retentionByPatient.get(patient.id) || 0) >= 2
      }))
    );
    const retentionByResponsibleRaw = this.computeBinaryAssociation(
      pacientes.map((patient) => ({
        category: String(patient.alunoResponsavelNome || patient.alunoResponsavelId || 'nao_atribuido').trim().toLowerCase(),
        event: (retentionByPatient.get(patient.id) || 0) >= 2
      }))
    );

    const retentionByInterval = retentionByIntervalRaw.map((item) => ({
      ...item,
      retentionRate: item.eventRate
    }));
    const retentionByProject = retentionByProjectRaw.map((item) => ({
      ...item,
      retentionRate: item.eventRate
    }));
    const retentionByResponsible = retentionByResponsibleRaw.map((item) => ({
      ...item,
      retentionRate: item.eventRate
    }));

    const drivers = this.mapTopDrivers(
      noShowByTurn,
      noShowByLeadTime,
      completenessByType,
      retentionByInterval
    );
    const alerts = this.mapCorrelationAlerts(drivers);

    const response = {
      generatedAt: new Date().toISOString(),
      filters: {
        projectId: projectFilter
      },
      dataset: {
        patients: pacientes.length,
        evaluations: avaliacoes.length,
        appointments: agendamentos.length
      },
      absenteeism: {
        byTurn: noShowByTurn,
        byLeadTime: noShowByLeadTime,
        byAppointmentType: noShowByType,
        byProject: noShowByProject,
        byResponsible: noShowByResponsible
      },
      completeness: {
        spearmanFrequency,
        byEvaluationType: completenessByType,
        byProject: completenessByProject,
        byResponsible: completenessByResponsible
      },
      retention: {
        byConsultInterval: retentionByInterval,
        byProject: retentionByProject,
        byResponsible: retentionByResponsible
      },
      drivers,
      alerts,
      cache: {
        hit: false,
        ttlSeconds: Math.floor(CORRELATIONS_CACHE_TTL_MS / 1000)
      }
    };

    this.setCache(cacheKey, response, CORRELATIONS_CACHE_TTL_MS);
    return response;
  }

  async exportReports(query: ExportQuery): Promise<ExportResult> {
    const range = this.normalizeRange(query.range);
    const projectFilter = this.normalizeProjectFilter(query.projectId);
    const anonymize = this.normalizeBoolean(query.anonymize, true);
    const format = this.normalizeExportFormat(query.format);

    const overview = await this.getReportsOverview({
      range,
      projectId: projectFilter,
      forceRefresh: false
    });

    const projects = Array.isArray((overview as Record<string, unknown>).projects)
      ? ((overview as Record<string, unknown>).projects as Array<{ id: string; nome: string }>)
      : [];

    const projectLabel = projectFilter === 'all'
      ? 'todos'
      : projectFilter === 'sem'
        ? 'sem-projeto'
        : (projects.find((item) => item.id === projectFilter)?.nome || 'projeto');

    if (format === 'json') {
      const [scopedPacientes, scopedAvaliacoes] = await Promise.all([
        this.fetchPacientesForExport(projectFilter),
        this.fetchAvaliacoesForExport(projectFilter)
      ]);
      const scopedAgendamentos = await this.fetchAgendamentosForExport(
        projectFilter,
        scopedPacientes.map((item) => item.id)
      );

      const dataset = {
        generatedAt: (overview as Record<string, unknown>).generatedAt || new Date().toISOString(),
        projeto: projectLabel,
        filters: {
          range,
          projectId: projectFilter,
          anonymize
        },
        metrics: (overview as Record<string, unknown>).metrics || {},
        usageByType: (overview as Record<string, unknown>).usageByType || [],
        quarterly: (overview as Record<string, unknown>).quarterly || [],
        pacientes: anonymize
          ? scopedPacientes.map((patient) => ({
              id: patient.id,
              anonId: this.anonymizeString(patient.id),
              status: patient.status || '',
              projeto: patient.projetoNome || '',
              consentimentoPesquisa: patient.consentimentoPesquisa || 'pendente'
            }))
          : scopedPacientes,
        avaliacoes: anonymize
          ? scopedAvaliacoes.map((evaluation) => ({
              id: evaluation.id,
              pacienteId: evaluation.pacienteId || '',
              projeto: evaluation.projetoNome || '',
              tipo: evaluation.tipo || '',
              status: evaluation.status || ''
            }))
          : scopedAvaliacoes,
        agendamentos: scopedAgendamentos
      };

      return {
        filename: `relatorio_${projectLabel}.json`,
        mimeType: 'application/json',
        stream: Readable.from([JSON.stringify(dataset, null, 2)])
      };
    }

    const headers = [
      'tipo_registro',
      'id',
      'paciente_id',
      'paciente_nome',
      'paciente_anon_id',
      'projeto_id',
      'projeto_nome',
      'status',
      'responsavel_id',
      'responsavel_nome',
      'consulta_data',
      'consulta_hora',
      'consulta_tipo',
      'avaliacao_tipo',
      'avaliacao_completude',
      'consentimento_pesquisa',
      'criado_em',
      'atualizado_em'
    ];
    const csvGenerator = async function* generateCsv(service: AnalyticsService) {
      // UTF-8 BOM keeps accented text readable in spreadsheet tools (Excel/LibreOffice).
      yield '\uFEFF';
      yield `${headers.join(',')}\n`;

      const scopedPacienteIds: string[] = [];
      const patientLookup = new Map<string, {
        nome: string;
        projetoId: string;
        projetoNome: string;
        responsavelId: string;
        responsavelNome: string;
      }>();
      for await (const patientsPage of service.iteratePacientesForExport(projectFilter)) {
        for (const patient of patientsPage) {
          scopedPacienteIds.push(patient.id);
          patientLookup.set(patient.id, {
            nome: patient.nome || '',
            projetoId: patient.projetoId || '',
            projetoNome: patient.projetoNome || '',
            responsavelId: patient.alunoResponsavelId || '',
            responsavelNome: patient.alunoResponsavelNome || ''
          });
          const row = {
            tipo_registro: 'paciente',
            id: patient.id,
            paciente_id: patient.id,
            paciente_nome: anonymize ? '' : (patient.nome || ''),
            paciente_anon_id: anonymize ? service.anonymizeString(patient.id) : '',
            projeto_id: patient.projetoId || '',
            projeto_nome: patient.projetoNome || '',
            status: patient.status || '',
            responsavel_id: anonymize ? service.anonymizeString(patient.alunoResponsavelId || '') : (patient.alunoResponsavelId || ''),
            responsavel_nome: anonymize ? '' : (patient.alunoResponsavelNome || ''),
            consulta_data: '',
            consulta_hora: '',
            consulta_tipo: '',
            avaliacao_tipo: '',
            avaliacao_completude: '',
            consentimento_pesquisa: patient.consentimentoPesquisa || '',
            criado_em: patient.createdAt ? new Date(patient.createdAt).toISOString() : '',
            atualizado_em: patient.updatedAt ? new Date(patient.updatedAt).toISOString() : ''
          };
          yield `${service.toCsvLine(headers, row)}\n`;
        }
      }

      for await (const evaluationsPage of service.iterateAvaliacoesForExport(projectFilter)) {
        for (const evaluation of evaluationsPage) {
          const patient = evaluation.pacienteId ? patientLookup.get(evaluation.pacienteId) : null;
          const completeness = service.getNumericCompleteness(
            (evaluation.meta as Record<string, unknown> | undefined)?.completude
          );
          const row = {
            tipo_registro: 'avaliacao',
            id: evaluation.id,
            paciente_id: evaluation.pacienteId || '',
            paciente_nome: anonymize ? '' : (patient?.nome || ''),
            paciente_anon_id: anonymize ? service.anonymizeString(evaluation.pacienteId || '') : '',
            projeto_id: evaluation.projetoId || patient?.projetoId || '',
            projeto_nome: evaluation.projetoNome || patient?.projetoNome || '',
            status: evaluation.status || '',
            responsavel_id: anonymize
              ? service.anonymizeString(patient?.responsavelId || '')
              : (patient?.responsavelId || ''),
            responsavel_nome: anonymize ? '' : (patient?.responsavelNome || ''),
            consulta_data: '',
            consulta_hora: '',
            consulta_tipo: '',
            avaliacao_tipo: evaluation.tipo || '',
            avaliacao_completude: completeness === null ? '' : String(completeness),
            consentimento_pesquisa: '',
            criado_em: evaluation.createdAt ? new Date(evaluation.createdAt).toISOString() : '',
            atualizado_em: evaluation.updatedAt ? new Date(evaluation.updatedAt).toISOString() : ''
          };
          yield `${service.toCsvLine(headers, row)}\n`;
        }
      }

      if (projectFilter === 'all') {
        for await (const appointmentsPage of service.iterateAgendamentosForExportAll()) {
          for (const appointment of appointmentsPage) {
            const patient = appointment.pacienteId ? patientLookup.get(appointment.pacienteId) : null;
            const scheduledAt = service.toDate(appointment.scheduledAt || appointment.date);
            const row = {
              tipo_registro: 'consulta',
              id: appointment.id,
              paciente_id: appointment.pacienteId || '',
              paciente_nome: anonymize ? '' : (appointment.pacienteNome || patient?.nome || ''),
              paciente_anon_id: anonymize ? service.anonymizeString(appointment.pacienteId || '') : '',
              projeto_id: patient?.projetoId || '',
              projeto_nome: patient?.projetoNome || '',
              status: appointment.status || '',
              responsavel_id: anonymize
                ? service.anonymizeString(appointment.alunoId || patient?.responsavelId || '')
                : (appointment.alunoId || patient?.responsavelId || ''),
              responsavel_nome: anonymize ? '' : (appointment.alunoNome || patient?.responsavelNome || ''),
              consulta_data: appointment.date || (scheduledAt ? scheduledAt.toISOString().slice(0, 10) : ''),
              consulta_hora: appointment.time || (scheduledAt
                ? scheduledAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                : ''),
              consulta_tipo: appointment.appointmentType || '',
              avaliacao_tipo: '',
              avaliacao_completude: '',
              consentimento_pesquisa: '',
              criado_em: appointment.createdAt ? new Date(appointment.createdAt).toISOString() : '',
              atualizado_em: appointment.updatedAt ? new Date(appointment.updatedAt).toISOString() : ''
            };
            yield `${service.toCsvLine(headers, row)}\n`;
          }
        }
      } else if (scopedPacienteIds.length > 0) {
        for await (const appointmentsPage of service.iterateAgendamentosForExportByPacienteIds(scopedPacienteIds)) {
          for (const appointment of appointmentsPage) {
            const patient = appointment.pacienteId ? patientLookup.get(appointment.pacienteId) : null;
            const scheduledAt = service.toDate(appointment.scheduledAt || appointment.date);
            const row = {
              tipo_registro: 'consulta',
              id: appointment.id,
              paciente_id: appointment.pacienteId || '',
              paciente_nome: anonymize ? '' : (appointment.pacienteNome || patient?.nome || ''),
              paciente_anon_id: anonymize ? service.anonymizeString(appointment.pacienteId || '') : '',
              projeto_id: patient?.projetoId || '',
              projeto_nome: patient?.projetoNome || '',
              status: appointment.status || '',
              responsavel_id: anonymize
                ? service.anonymizeString(appointment.alunoId || patient?.responsavelId || '')
                : (appointment.alunoId || patient?.responsavelId || ''),
              responsavel_nome: anonymize ? '' : (appointment.alunoNome || patient?.responsavelNome || ''),
              consulta_data: appointment.date || (scheduledAt ? scheduledAt.toISOString().slice(0, 10) : ''),
              consulta_hora: appointment.time || (scheduledAt
                ? scheduledAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                : ''),
              consulta_tipo: appointment.appointmentType || '',
              avaliacao_tipo: '',
              avaliacao_completude: '',
              consentimento_pesquisa: '',
              criado_em: appointment.createdAt ? new Date(appointment.createdAt).toISOString() : '',
              atualizado_em: appointment.updatedAt ? new Date(appointment.updatedAt).toISOString() : ''
            };
            yield `${service.toCsvLine(headers, row)}\n`;
          }
        }
      }
    };

    return {
      filename: `relatorio_${projectLabel}.csv`,
      mimeType: 'text/csv; charset=utf-8',
      stream: Readable.from(csvGenerator(this))
    };
  }
}
