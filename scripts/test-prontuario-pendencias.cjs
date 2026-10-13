// Synthetic prontuário fixtures only. No real patient, credential or database.
//
// UPD-14 — Prontuário e pendências. Regressão para o achado UX-02: um
// paciente novo sem nenhum registro não pode ser lido como 17 atrasos.
// Este teste falha se a classificação voltar a tratar todo instrumento
// ausente como pendência, independente de ser obrigatório, solicitado,
// opcional ou não aplicável ao caso.
const assert = require('node:assert');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`PASS ${name}`);
}

(async () => {
  const { buildProntuarioOverview } = await import(
    pathToFileURL(path.join(root, 'src/components/Prontuario/prontuarioOverview.js')).href
  );
  const { listEvaluationRegistryByContext } = await import(
    pathToFileURL(path.join(root, 'src/constants/evaluationRegistry.js')).href
  );

  // Os mesmos instrumentos que a captura real da auditoria mostrava como
  // "17 módulos pendentes" para um paciente sem nenhum registro (UX-02).
  const modules = listEvaluationRegistryByContext('prontuario')
    .map((item) => ({ id: item.moduleId || item.type, label: item.shortLabel || item.label, tipo: item.type }));
  assert.strictEqual(modules.length, 17, 'a fixture segue os 17 instrumentos reais do registro de avaliações');

  const OBRIGATORIAS = ['anamnese_inicial', 'avaliacao_clinica', 'perimetros'];
  const baseArgs = {
    modules,
    patientId: 'paciente-novo',
    avaliacoes: [],
    agendamentos: [],
    planos: [],
    pendencias: [],
    canCreateEvaluation: true,
    canCreateAppointment: true,
    canCreateMealPlan: true,
    canReview: true,
    editableTypes: new Set(modules.map((item) => item.tipo)),
    agora: new Date('2026-09-21T09:00:00-03:00')
  };
  const consultaHoje = (evaluations = []) => ([{
    id: 'consulta-hoje', pacienteId: 'paciente-novo', status: 'agendada',
    scheduledAt: '2026-09-21T13:00:00-03:00', evaluations
  }]);

  check('paciente novo sem nenhum registro não acumula os 17 instrumentos como atraso', () => {
    const overview = buildProntuarioOverview(baseArgs);
    assert.strictEqual(overview.tasks.length, 0,
      'sem consulta em curso e sem nenhum registro, nada no fluxo atual justifica uma pendência');
    assert.ok(overview.moduleStates.every((module) => module.category === 'opcional'),
      'sem contexto de atendimento nenhum dos 17 instrumentos é obrigatório ou solicitado');
  });

  check('consulta do dia torna as 3 obrigatórias pendência, sem arrastar as 14 opcionais', () => {
    const overview = buildProntuarioOverview({ ...baseArgs, agendamentos: consultaHoje() });
    assert.strictEqual(overview.tasks.length, 3, 'só as 3 obrigatórias entram na fila, nunca os 17 instrumentos');
    assert.deepStrictEqual(overview.tasks.map((task) => task.itemTipo).sort(), [...OBRIGATORIAS].sort());
    assert.ok(overview.tasks.every((task) => task.category === 'obrigatoria' && task.severidade === 'alta'),
      'obrigatória tem categoria e severidade próprias, distintas de opcional');
    const opcionais = overview.moduleStates.filter((module) => !OBRIGATORIAS.includes(module.tipo));
    assert.strictEqual(opcionais.length, 14);
    assert.ok(opcionais.every((module) => module.category === 'opcional'),
      'instrumento opcional não vira obrigatório só por existir uma consulta hoje');
  });

  check('instrumento solicitado pela equipe aparece como solicitado, nunca como obrigatório', () => {
    const overview = buildProntuarioOverview({ ...baseArgs, agendamentos: consultaHoje(['hidratacao']) });
    assert.strictEqual(overview.tasks.length, 4, '3 obrigatórias + 1 solicitada, nada além disso');
    const hidratacao = overview.tasks.find((task) => task.itemTipo === 'hidratacao');
    assert.ok(hidratacao, 'a solicitação da equipe na consulta vira tarefa');
    assert.strictEqual(hidratacao.category, 'solicitada');
    assert.notStrictEqual(hidratacao.category, 'obrigatoria');
    assert.strictEqual(hidratacao.severidade, 'media', 'solicitada pesa menos que obrigatória na fila');
    assert.strictEqual(hidratacao.detalhe, 'Solicitada na consulta agendada');
  });

  check('instrumento fora da área da equipe do caso é não aplicável e nunca vira pendência', () => {
    const agendamentos = consultaHoje();

    const semPsicologaNaEquipe = buildProntuarioOverview({ ...baseArgs, agendamentos, teamAreas: new Set(['nutricao']) });
    const psicologia = semPsicologaNaEquipe.moduleStates.find((module) => module.tipo === 'psicologia');
    assert.strictEqual(psicologia.category, 'nao_aplicavel');
    assert.ok(semPsicologaNaEquipe.tasks.every((task) => task.itemTipo !== 'psicologia'),
      'não aplicável nunca entra na fila de pendências');
    assert.strictEqual(semPsicologaNaEquipe.tasks.length, 3, 'só as obrigatórias; psicologia não aplicável não infla a fila');

    const comPsicologaNaEquipe = buildProntuarioOverview({ ...baseArgs, agendamentos, teamAreas: new Set(['nutricao', 'psicologia']) });
    assert.strictEqual(
      comPsicologaNaEquipe.moduleStates.find((module) => module.tipo === 'psicologia').category,
      'opcional',
      'com psicóloga na equipe do caso o instrumento volta a ser um opcional disponível, não mais não aplicável'
    );

    const equipeDesconhecida = buildProntuarioOverview({ ...baseArgs, agendamentos });
    assert.strictEqual(
      equipeDesconhecida.moduleStates.find((module) => module.tipo === 'psicologia').category,
      'opcional',
      'sem informação de equipe a ausência é nula: não vira "não aplicável" por presunção (regra: ausência é nulo, nunca zero)'
    );
  });

  check('zero registros não é lido como "em dia": estado e ação seguem honestos', () => {
    const semNada = buildProntuarioOverview(baseArgs);
    assert.strictEqual(semNada.tasks.length, 0);
    assert.strictEqual(semNada.state, 'Atendimento não iniciado');
    assert.notStrictEqual(semNada.state, 'Em dia', 'zero pendências não pode ler como normalidade');
    assert.ok(semNada.action, 'zero pendências ainda assim aponta uma próxima ação, nunca silêncio');
    assert.strictEqual(semNada.action.kind, 'evaluation');
    assert.strictEqual(semNada.action.type, 'anamnese_inicial');

    const finalizada = (tipo, id) => ({
      id, pacienteId: 'paciente-novo', tipo, status: 'finalizada',
      data: '2026-09-20', measuredAt: '2026-09-20T10:00:00-03:00', resultados: { valor: 1 }
    });
    const emAcompanhamento = buildProntuarioOverview({
      ...baseArgs,
      avaliacoes: [finalizada('anamnese_inicial', 'a1'), finalizada('avaliacao_clinica', 'a2'), finalizada('perimetros', 'a3')]
    });
    assert.notStrictEqual(emAcompanhamento.state, semNada.state,
      'ter registro e não ter registro produzem estados diferentes; zero nunca é lido como o mesmo "em dia" de um caso acompanhado');
  });

  console.log(`${passed} verificações de pendências do prontuário passaram.`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
