const assert = require('node:assert/strict');
const {
  resolveTaskReportPeriod, buildTaskReport, taskReportCsv, TarefasReportService
} = require('../dist/tarefas/tarefas-report.service.js');
const { TarefasReportController } = require('../dist/tarefas/tarefas-report.controller.js');
const { RolesGuard } = require('../dist/auth/roles.guard.js');
const { Reflector } = require('@nestjs/core');

const guards = Reflect.getMetadata('__guards__', TarefasReportController) || [];
assert.ok(guards.some((guard) => guard.name === 'JwtAuthGuard'));
assert.ok(guards.some((guard) => guard.name === 'RolesGuard'));
const rolesGuard = new RolesGuard(new Reflector());
const canRead = (handler, role) => rolesGuard.canActivate({
  getHandler: () => TarefasReportController.prototype[handler],
  getClass: () => TarefasReportController,
  switchToHttp: () => ({ getRequest: () => ({ user: { role } }) })
});
for (const handler of ['getReport', 'exportReport']) {
  assert.equal(canRead(handler, 'admin'), true);
  assert.equal(canRead(handler, 'coordenacao'), true);
  assert.equal(canRead(handler, 'diretoria_pesquisa'), false);
  assert.equal(canRead(handler, 'diretoria_marketing'), false);
  assert.equal(canRead(handler, 'aluno'), false);
}

const now = new Date('2026-10-02T14:00:00.000Z');
const period = resolveTaskReportPeriod('month', now);
assert.deepEqual(period, {
  range: 'month', startDate: '2026-10-01', endDate: '2026-10-31',
  timeZone: 'America/Sao_Paulo'
});
assert.deepEqual(resolveTaskReportPeriod('week', now), {
  range: 'week', startDate: '2026-09-26', endDate: '2026-10-02',
  timeZone: 'America/Sao_Paulo'
});
assert.equal(resolveTaskReportPeriod('quarter', now).endDate, '2026-12-31');
assert.equal(resolveTaskReportPeriod('year', now).startDate, '2026-01-01');
assert.throws(() => resolveTaskReportPeriod('all', now), /Período inválido/);

const task = (assignedRole, dueDate, status = 'pendente', completedAt = null, extra = {}) => ({
  assignedRole, dueDate, status, completedAt,
  createdAt: new Date('2026-10-01T12:00:00.000Z'), ...extra
});
const tasks = [
  task('diretoria_ensino', '2026-10-01', 'concluida', new Date('2026-10-02T02:30:00Z')),
  task('diretoria_ensino', '2026-10-01', 'concluida', new Date('2026-10-02T03:01:00Z')),
  task('diretoria_pesquisa', '2026-10-01'),
  task('marketing', '2026-10-02'),
  task('coord_atendimento', '2026-10-15'),
  task('diretoria_ensino', '2026-10-01', 'concluida'),
  task('diretoria_extensao', '2026-10-01', 'concluida', new Date('2026-10-01T12:00:00Z'), {
    archivedAt: new Date('2026-10-02T12:00:00Z')
  }),
  task('diretoria_extensao', '2026-10-01', 'pendente', null, {
    archivedAt: new Date('2026-10-02T13:00:00Z')
  }),
  task('todos', null, 'pendente', null, {
    title: 'Dados do paciente', completionNote: 'Não exportar observação'
  }),
  task('diretoria_pesquisa', '2026-09-30'),
  task('todos', null, 'pendente', null, { createdAt: new Date('2026-09-30T12:00:00Z') })
];

const report = buildTaskReport(tasks, period, now);
assert.deepEqual({ ...report.totals }, {
  due: 8, completedOnTime: 2, completedLate: 1,
  openOverdue: 1, openOnTime: 2, archivedUnfinished: 1,
  unverifiedCompletion: 1,
  noDue: 1, punctualityRate: 66.7
});
assert.equal(report.groups.find((group) => group.key === 'diretoria_ensino').punctualityRate, 50);
assert.equal(report.groups.find((group) => group.key === 'geral').noDue, 1);
assert.equal(report.groups.find((group) => group.key === 'diretoria_extensao').completedOnTime, 1);
assert.equal(report.groups.find((group) => group.key === 'diretoria_extensao').archivedUnfinished, 1);
assert.ok(!JSON.stringify(report).includes('Não exportar observação'));
assert.ok(!taskReportCsv(report).includes('Dados do paciente'));
assert.ok(!taskReportCsv(report).includes('Não exportar observação'));

const monthBoundary = buildTaskReport([
  task('todos', null, 'pendente', null, { createdAt: new Date('2026-10-01T02:30:00Z') }),
  task('todos', null, 'pendente', null, { createdAt: new Date('2026-10-01T03:01:00Z') })
], period, now);
assert.equal(monthBoundary.totals.noDue, 1, 'criação deve usar a data civil de São Paulo');

const selected = [];
const qb = {
  select(fields) { selected.push(...fields); return this; },
  where() { return this; },
  orWhere() { return this; },
  async getMany() { return tasks; }
};
const service = new TarefasReportService({ createQueryBuilder: () => qb });
service.getReport('month', now).then((result) => {
  assert.equal(result.totals.due, 8);
  assert.ok(selected.includes('tarefa.archivedAt'));
  assert.ok(!selected.some((field) => /title|completionNote|completedBy/.test(field)));
  console.log('Relatório de tarefas: período, prazo, grupos, legados e projeção OK.');
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
