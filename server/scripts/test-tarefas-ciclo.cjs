/* Ciclo de vida de tarefas com dados sintéticos, sem banco ou rede. */
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
require(path.join(root, 'node_modules/ts-node')).register({ project: path.join(root, 'tsconfig.json'), transpileOnly: true });
require(path.join(root, 'node_modules/reflect-metadata'));
const { TarefasService } = require(path.join(root, 'src/tarefas/tarefas.service.ts'));
const { Tarefa } = require(path.join(root, 'src/tarefas/tarefa.entity.ts'));

const admin = { id: '00000000-0000-4000-8000-000000000001', role: 'admin', name: 'Coordenação' };
const ensino = { id: '00000000-0000-4000-8000-000000000002', role: 'aluno', diretoria: 'ensino', name: 'Aluna A' };
const pesquisa = { id: '00000000-0000-4000-8000-000000000003', role: 'aluno', diretoria: 'pesquisa', name: 'Aluno B' };
const atleta = { id: '00000000-0000-4000-8000-000000000004', role: 'atleta', name: 'Atleta' };

function fixture() {
  let tasks = new Map();
  const events = [];
  const emitted = [];
  const readClauses = [];
  let pending = Promise.resolve();
  let sequence = 0;
  const repo = {
    createQueryBuilder: () => {
      const qb = {
        where: () => qb, orderBy: () => qb,
        andWhere: (sql, params) => { readClauses.push({ sql, params }); return qb; },
        getMany: async () => []
      };
      return qb;
    },
    manager: {
      transaction(work) {
        const attempt = pending.then(async () => {
          const local = new Map([...tasks].map(([id, task]) => [id, { ...task }]));
          const newEvents = [];
          const taskRepo = {
            create: (data) => ({ id: `task-${++sequence}`, ...data }),
            save: async (task) => { local.set(task.id, { ...task }); return task; },
            createQueryBuilder: () => {
              let taskId;
              const qb = {
                where: (_sql, params) => { taskId = params.id; return qb; },
                andWhere: () => qb,
                setLock: () => qb,
                getOne: async () => {
                  const task = local.get(taskId);
                  return task && !task.archivedAt ? { ...task } : null;
                }
              };
              return qb;
            }
          };
          const eventRepo = {
            create: (data) => data,
            save: async (event) => { newEvents.push({ ...event }); return event; }
          };
          const result = await work({ getRepository: (entity) => entity === Tarefa ? taskRepo : eventRepo });
          tasks = local;
          events.push(...newEvents);
          return result;
        });
        pending = attempt.catch(() => {});
        return attempt;
      }
    }
  };
  return { service: new TarefasService(repo, { emit: (...args) => emitted.push(args) }), events, emitted, readClauses, tasks: () => tasks };
}

async function run() {
  const f = fixture();
  await f.service.findAll({ ...atleta, diretoria: 'ensino', coordAtendimento: true }, {});
  assert.deepEqual(f.readClauses.at(-1).params, { audienceRoles: ['atleta'] });
  await f.service.findAll({ id: admin.id, role: 'professor', diretoria: 'ensino' }, {});
  assert.deepEqual(f.readClauses.at(-1).params, { audienceRoles: ['professor'], todos: 'todos' });
  const base = { title: 'Preparar oficina', assignedRole: 'diretoria_ensino', dueDate: '2026-10-20' };
  await assert.rejects(() => f.service.create({ ...base, dueDate: undefined }, admin), /data de termino/i);
  await assert.rejects(() => f.service.create({ ...base, dueDate: '2026-02-30' }, admin), /Data de termino invalida/);
  await assert.rejects(() => f.service.create({ ...base, status: 'concluida' }, admin), /comando de conclusao/);
  const created = await f.service.create({ ...base, createdBy: pesquisa.id, createdByName: 'Forjado' }, admin);
  assert.equal(created.createdBy, admin.id);
  assert.equal(created.createdByName, admin.name);
  assert.equal(created.dueDate, base.dueDate);
  assert.equal(f.events[0].action, 'created');
  assert.deepEqual(f.emitted[0], ['tarefas.created', {
    id: created.id, assignedRole: 'diretoria_ensino', status: 'pendente'
  }]);
  await assert.rejects(() => f.service.resolve(created.id, pesquisa, {}), /Tarefa nao encontrada/);
  await assert.rejects(() => f.service.resolve(created.id, { ...atleta, diretoria: 'ensino', coordAtendimento: true }, {}), /Tarefa nao encontrada/);
  await assert.rejects(() => f.service.update(created.id, { status: 'concluida' }, admin), /comando de conclusao/);
  await assert.rejects(() => f.service.resolve(created.id, ensino, { completionNote: 'x'.repeat(1001) }), /ate 1000 caracteres/);
  assert.equal(f.tasks().get(created.id).status, 'pendente');

  const [first, second] = await Promise.all([
    f.service.resolve(created.id, ensino, { completionNote: '  Oficina realizada.  ' }),
    f.service.resolve(created.id, admin, { completionNote: 'Outra nota' })
  ]);
  assert.equal(first.status, 'concluida');
  assert.equal(second.completedById, ensino.id);
  assert.equal(second.completionNote, 'Oficina realizada.');
  assert.equal(f.events.filter((event) => event.action === 'completed').length, 1);
  await assert.rejects(() => f.service.update(created.id, { dueDate: '2026-10-21' }, admin), /Reabra/);
  await assert.rejects(() => f.service.update(created.id, { assignedRole: 'diretoria_pesquisa' }, admin), /Reabra/);

  const reopened = await f.service.update(created.id, { status: 'pendente', dueDate: '2026-10-21' }, admin);
  assert.equal(reopened.completedAt, null);
  assert.equal(reopened.completionNote, null);
  assert.deepEqual(f.events.slice(-2).map((event) => event.action), ['reopened', 'due_date_changed']);
  assert.equal(f.events.find((event) => event.action === 'reopened').details.previousCompletionNote, 'Oficina realizada.');
  await f.service.update(created.id, { assignedRole: 'diretoria_pesquisa' }, admin);
  assert.deepEqual(f.emitted.slice(-2).map(([, payload]) => payload.assignedRole),
    ['diretoria_ensino', 'diretoria_pesquisa']);
  await f.service.remove(created.id, admin);
  assert.ok(f.tasks().get(created.id).archivedAt instanceof Date);
  assert.equal(f.events.at(-1).action, 'archived');
  await assert.rejects(() => f.service.resolve(created.id, ensino, {}), /Tarefa nao encontrada/);
  const everyone = await f.service.create({ title: 'Comunicado institucional', assignedRole: 'todos' }, admin);
  await assert.rejects(() => f.service.resolve(everyone.id, atleta, {}), /Tarefa nao encontrada/);
  assert.equal((await f.service.resolve(everyone.id, admin, {})).status, 'concluida');
  assert.ok(f.emitted.every(([, payload]) => !('completionNote' in payload) && !('title' in payload)));
  console.log('tarefas-ciclo: prazo, autoria, acesso, concorrencia, reabertura e arquivo OK');
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
