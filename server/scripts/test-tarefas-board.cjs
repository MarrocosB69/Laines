/* Contrato sintético: tarefas arquivadas não voltam ao Kanban operacional. */
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
require(path.join(root, 'node_modules/ts-node')).register({ project: path.join(root, 'tsconfig.json'), transpileOnly: true });
require(path.join(root, 'node_modules/reflect-metadata'));
const { AnalyticsService } = require(path.join(root, 'src/analytics/analytics.service.ts'));

const rows = [
  { id: 'ativa', title: 'Tarefa ativa', status: 'pendente', assignedRole: 'diretoria_ensino', createdAt: new Date('2026-10-01T12:00:00Z'), updatedAt: new Date('2026-10-01T12:00:00Z'), archivedAt: null },
  { id: 'arquivada', title: 'Tarefa arquivada', status: 'concluida', assignedRole: 'diretoria_ensino', createdAt: new Date('2026-10-01T12:00:00Z'), updatedAt: new Date('2026-10-01T12:00:00Z'), archivedAt: new Date('2026-10-02T12:00:00Z') }
];
const emptyRepo = { find: async () => [] };
const tarefasRepo = {
  find: async (options) => {
    assert.equal(options.where?.archivedAt?.type, 'isNull');
    return rows.filter((row) => !row.archivedAt);
  }
};
const service = new AnalyticsService(
  emptyRepo, emptyRepo, emptyRepo, emptyRepo, emptyRepo, emptyRepo, emptyRepo, tarefasRepo
);

service.getDashboardOperationalBoard({ forceRefresh: true }).then((board) => {
  const ids = board.columns.flatMap((column) => column.cards.map((card) => card.id));
  assert.ok(ids.includes('task-ativa'));
  assert.ok(!ids.includes('task-arquivada'));
  console.log('tarefas-board: arquivadas fora do Kanban OK');
}).catch((error) => { console.error(error); process.exitCode = 1; });
