import assert from 'node:assert/strict';
import { getTaskDeadlineInfo } from '../src/utils/taskDeadline.js';

const task = (dueDate, status = 'pendente', completedAt = null) => ({ dueDate, status, completedAt });
const beforeMidnight = new Date('2026-10-03T02:59:59Z');
const afterMidnight = new Date('2026-10-03T03:00:00Z');

assert.deepEqual(getTaskDeadlineInfo(task('2026-10-03'), beforeMidnight), {
  tone: 'upcoming', label: 'Faltam 1 dia', dateLabel: 'Prazo 03/10/2026'
});
assert.deepEqual(getTaskDeadlineInfo(task('2026-10-03'), afterMidnight), {
  tone: 'today', label: 'Vence hoje', dateLabel: 'Prazo 03/10/2026'
});
assert.deepEqual(getTaskDeadlineInfo(task('2026-10-02'), afterMidnight), {
  tone: 'overdue', label: 'Atrasada há 1 dia', dateLabel: 'Prazo 02/10/2026'
});
assert.equal(getTaskDeadlineInfo(task(null), afterMidnight).label, 'Sem prazo');
assert.equal(getTaskDeadlineInfo(task('2026-02-30'), afterMidnight).label, 'Prazo indisponível');

const delivered = getTaskDeadlineInfo(task('2026-10-02', 'concluida', '2026-10-03T02:00:00Z'), afterMidnight);
assert.equal(delivered.tone, 'done');
assert.match(delivered.label, /Entregue em 02\/10\/2026.*23:00/);
assert.equal(delivered.dateLabel, '');

console.log('taskDeadline: 6 cenários de prazo civil em São Paulo passaram.');
