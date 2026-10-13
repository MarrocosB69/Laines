import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { normalizeDiretoria } from '../common/domain/access.constants';
import { Tarefa } from './tarefa.entity';

const TIME_ZONE = 'America/Sao_Paulo';
const RANGES = ['week', 'month', 'quarter', 'year'] as const;
export type TaskReportRange = typeof RANGES[number];

const GROUPS = [
  { key: 'diretoria_ensino', label: 'Ensino' },
  { key: 'diretoria_pesquisa', label: 'Pesquisa' },
  { key: 'diretoria_extensao', label: 'Extensão' },
  { key: 'diretoria_marketing', label: 'Comunicação' },
  { key: 'coord_atendimento', label: 'Atendimento' },
  { key: 'geral', label: 'Geral/outros' }
] as const;

export type TaskReportCounts = {
  due: number;
  completedOnTime: number;
  completedLate: number;
  openOverdue: number;
  openOnTime: number;
  archivedUnfinished: number;
  unverifiedCompletion: number;
  noDue: number;
  punctualityRate: number | null;
};

export type TaskReportPeriod = {
  range: TaskReportRange;
  startDate: string;
  endDate: string;
  timeZone: typeof TIME_ZONE;
};

type TaskReportRow = Pick<Tarefa, 'assignedRole' | 'dueDate' | 'createdAt' | 'completedAt' | 'status' | 'archivedAt'>;

const emptyCounts = (): TaskReportCounts => ({
  due: 0, completedOnTime: 0, completedLate: 0,
  openOverdue: 0, openOnTime: 0, archivedUnfinished: 0,
  unverifiedCompletion: 0,
  noDue: 0, punctualityRate: null
});

const dateInZone = (value: Date): string => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(value);
  const part = (type: string) => parts.find((item) => item.type === type)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}`;
};

const utcDate = (year: number, month: number, day: number) => (
  new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10)
);

const dayValue = (value: string | Date | null | undefined): string | null => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : dateInZone(value);
  const text = String(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
};

export const resolveTaskReportPeriod = (rangeInput?: string, now = new Date()): TaskReportPeriod => {
  const range = String(rangeInput || 'month').trim().toLowerCase();
  if (!RANGES.includes(range as TaskReportRange)) {
    throw new BadRequestException('Período inválido para relatório de tarefas.');
  }
  const today = dateInZone(now);
  const [year, month, day] = today.split('-').map(Number);
  if (range === 'week') {
    return { range, startDate: utcDate(year, month - 1, day - 6), endDate: today, timeZone: TIME_ZONE };
  }
  if (range === 'month') {
    return { range, startDate: utcDate(year, month - 1, 1), endDate: utcDate(year, month, 0), timeZone: TIME_ZONE };
  }
  if (range === 'quarter') {
    const firstMonth = Math.floor((month - 1) / 3) * 3;
    return { range, startDate: utcDate(year, firstMonth, 1), endDate: utcDate(year, firstMonth + 3, 0), timeZone: TIME_ZONE };
  }
  return { range: 'year', startDate: utcDate(year, 0, 1), endDate: utcDate(year, 12, 0), timeZone: TIME_ZONE };
};

const groupKey = (assignedRole?: string | null) => {
  const raw = String(assignedRole || '').trim().toLowerCase();
  if (raw === 'coord_atendimento') return raw;
  const diretoria = normalizeDiretoria(raw);
  return GROUPS.some((group) => group.key === diretoria) ? diretoria as string : 'geral';
};

const finishCounts = (counts: TaskReportCounts) => {
  const deliveries = counts.completedOnTime + counts.completedLate;
  counts.punctualityRate = deliveries > 0
    ? Math.round((counts.completedOnTime / deliveries) * 1000) / 10
    : null;
  return counts;
};

export const buildTaskReport = (tasks: TaskReportRow[], period: TaskReportPeriod, now = new Date()) => {
  const today = dateInZone(now);
  const groups = GROUPS.map(({ key, label }) => ({ key, label, ...emptyCounts() }));
  const byKey = new Map<string, (typeof groups)[number]>(groups.map((group) => [group.key, group]));
  const totals = emptyCounts();
  for (const task of tasks) {
    const dueDate = dayValue(task.dueDate);
    const createdDate = task.createdAt ? dateInZone(new Date(task.createdAt)) : null;
    const isDueInPeriod = !!dueDate && dueDate >= period.startDate && dueDate <= period.endDate;
    const isLegacyInPeriod = !dueDate && !!createdDate
      && createdDate >= period.startDate && createdDate <= period.endDate;
    if (!isDueInPeriod && !isLegacyInPeriod) continue;
    const group = byKey.get(groupKey(task.assignedRole)) || byKey.get('geral')!;
    const targets: TaskReportCounts[] = [group, totals];
    for (const target of targets) {
      if (!dueDate) { target.noDue += 1; continue; }
      target.due += 1;
      if (task.status === 'concluida') {
        if (!task.completedAt) { target.unverifiedCompletion += 1; continue; }
        const completedDate = dateInZone(new Date(task.completedAt));
        target[completedDate <= dueDate ? 'completedOnTime' : 'completedLate'] += 1;
      } else if (task.archivedAt) {
        target.archivedUnfinished += 1;
      } else {
        target[dueDate < today ? 'openOverdue' : 'openOnTime'] += 1;
      }
    }
  }
  groups.forEach(finishCounts);
  return {
    generatedAt: now.toISOString(), period,
    definition: {
      cohort: 'Tarefas com vencimento no período; sem prazo por criação no período.',
      punctuality: 'Entregues no prazo / (entregues no prazo + entregues em atraso).',
      legacy: 'Sem prazo e conclusões sem data não entram na taxa; arquivadas sem entrega ficam separadas.'
    },
    totals: finishCounts(totals),
    groups
  };
};

export type TaskReport = ReturnType<typeof buildTaskReport>;

const csvCell = (value: string | number | null) => {
  const text = value === null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
};

export const taskReportCsv = (report: TaskReport): string => {
  const headers = [
    'gerado_em', 'periodo', 'inicio', 'fim', 'fuso', 'equipe',
    'com_prazo', 'entregues_no_prazo', 'entregues_em_atraso',
    'abertas_vencidas', 'abertas_no_prazo', 'arquivadas_sem_entrega', 'conclusao_sem_data',
    'sem_prazo', 'pontualidade_percentual', 'formula_pontualidade'
  ];
  const rows = [{ key: 'total', label: 'Total', ...report.totals }, ...report.groups];
  return '\uFEFF' + [
    headers.join(','),
    ...rows.map((row) => [
      report.generatedAt, report.period.range, report.period.startDate,
      report.period.endDate, report.period.timeZone, row.label,
      row.due, row.completedOnTime, row.completedLate,
      row.openOverdue, row.openOnTime, row.archivedUnfinished, row.unverifiedCompletion,
      row.noDue, row.punctualityRate, report.definition.punctuality
    ].map(csvCell).join(','))
  ].join('\r\n') + '\r\n';
};

@Injectable()
export class TarefasReportService {
  constructor(@InjectRepository(Tarefa) private readonly repo: Repository<Tarefa>) {}

  async getReport(range?: string, now = new Date()): Promise<TaskReport> {
    const period = resolveTaskReportPeriod(range, now);
    // A margem de um dia nos limites UTC cobre datas civis de São Paulo.
    // O filtro final por data local é aplicado em buildTaskReport.
    const legacyStart = new Date(Date.parse(`${period.startDate}T00:00:00Z`) - 86_400_000);
    const legacyEnd = new Date(Date.parse(`${period.endDate}T00:00:00Z`) + 172_800_000);
    const tasks = await this.repo.createQueryBuilder('tarefa')
      .select([
        'tarefa.id', 'tarefa.assignedRole', 'tarefa.status',
        'tarefa.dueDate', 'tarefa.createdAt', 'tarefa.completedAt',
        'tarefa.archivedAt'
      ])
      .where('tarefa.dueDate BETWEEN :startDate AND :endDate', {
        startDate: period.startDate, endDate: period.endDate
      })
      .orWhere('(tarefa.dueDate IS NULL AND tarefa.createdAt >= :legacyStart AND tarefa.createdAt < :legacyEnd)', {
        legacyStart, legacyEnd
      })
      .getMany();
    return buildTaskReport(tasks, period, now);
  }
}
