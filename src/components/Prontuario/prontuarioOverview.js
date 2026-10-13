import { OBRIGATORIAS, estaFechada, prontaParaFinalizar } from '../../core/prontuario/estado.js';
import { getEvaluationEditAreas } from '../../constants/evaluationRegistry.js';

const token = (value) => String(value ?? '').trim().toLowerCase().replace(/-/g, '_');
const dateMs = (value) => {
  if (!value) return null;
  const localValue = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value + 'T00:00:00' : value;
  const date = typeof value?.toDate === 'function' ? value.toDate() : new Date(localValue);
  return Number.isFinite(date?.getTime()) ? date.getTime() : null;
};
export const clinicalDate = (item) => dateMs(item?.measuredAt || item?.data || item?.dataAvaliacao || item?.createdAt);
const availableRecord = (item, patientId) => item && !item.deletedAt && Boolean(patientId)
  && String(item.pacienteId) === String(patientId);
const dayOf = (time) => {
  const day = new Date(time);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
};
const nextDay = (time) => {
  const day = new Date(time);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1).getTime();
};

export const eligibleEvaluations = (items = [], patientId) => items
  .filter((item) => availableRecord(item, patientId) && token(item.status) === 'finalizada' && !item.meta?.aguardandoRevisao)
  .sort((a, b) => (clinicalDate(b) ?? 0) - (clinicalDate(a) ?? 0));

const sourcesOf = (item) => [item.resultados, item.dados, item.dados?.input, item.dados?.dados_brutos];
const numberAt = (sources, paths) => {
  for (const source of sources) {
    for (const path of paths) {
      const raw = path.split('.').reduce((value, key) => value?.[key], source);
      if (!['number', 'string'].includes(typeof raw) || String(raw).trim() === '') continue;
      const value = Number(String(raw).replace(',', '.'));
      if (Number.isFinite(value)) return value;
    }
  }
  return null;
};
const methodOf = (item) => JSON.stringify(sourcesOf(item).map((source) => [
  ...['protocolo', 'protocolId', 'metodo', 'equacao', 'formula', 'equipamento', 'modelo'].map((key) => source?.[key] ?? null),
  source?.metadados_formula?.formulaId ?? null, source?.metadados_formula?.formulaVersion ?? null,
]));

const METRICS = [
  { id: 'peso', label: 'Peso', unit: 'kg', types: ['bioimpedancia', 'perimetros', 'gasto_energetico_total', 'composicao_corporal_imagem'], paths: ['pesoKg', 'peso', 'pesoAtual', 'peso_kg', 'pesoTotal'], positive: true },
  { id: 'gordura', label: 'Gordura corporal', unit: '%', deltaUnit: 'p.p.', types: ['bioimpedancia', 'dobras_cutaneas'], paths: ['percentualGordura', 'percentual_gordura', 'percentFat'] },
  { id: 'get', label: 'GET', unit: 'kcal/dia', types: ['gasto_energetico_total'], paths: ['getEstimadoKcal', 'get_estimado_kcal', 'get_kcal'], positive: true },
  { id: 'fc', label: 'Frequência cardíaca', unit: 'bpm', types: ['avaliacao_clinica'], paths: ['frequenciaCardiaca', 'frequencia_cardiaca', 'fc'], positive: true },
];

export function buildClinicalSnapshot(items = [], patientId) {
  const eligible = eligibleEvaluations(items, patientId);
  const metrics = METRICS.map((metric) => {
    const measurements = eligible.filter((item) => metric.types.includes(token(item.tipo))).map((item) => ({
      item, value: numberAt(sourcesOf(item), metric.paths),
    })).filter(({ value, item }) => value !== null && (!metric.positive || value > 0) && clinicalDate(item) !== null);
    const latest = measurements[0];
    if (!latest) return null;
    const previous = measurements.find((measurement) => measurement.item.id !== latest.item.id
      && token(measurement.item.tipo) === token(latest.item.tipo)
      && methodOf(measurement.item) === methodOf(latest.item)
      && clinicalDate(measurement.item) < clinicalDate(latest.item));
    return { ...metric, ...latest, previous: previous || null, delta: previous ? latest.value - previous.value : null };
  }).filter(Boolean);
  return { eligible, metrics };
}

export function findActivePlan(plans = [], patientId, agora = new Date()) {
  const now = agora.getTime();
  return plans.filter((plan) => {
    if (!availableRecord(plan, patientId) || token(plan.status) !== 'ativo') return false;
    const start = dateMs(plan.dataInicio);
    const end = dateMs(plan.dataFim);
    const endExclusive = typeof plan.dataFim === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(plan.dataFim);
    return (!plan.dataInicio || (start !== null && start <= now))
      && (!plan.dataFim || (end !== null && (endExclusive ? now < nextDay(end) : now <= end)));
  }).sort((a, b) => (dateMs(b.dataInicio) ?? 0) - (dateMs(a.dataInicio) ?? 0)
    || (dateMs(b.updatedAt) ?? 0) - (dateMs(a.updatedAt) ?? 0))[0] || null;
}

export function buildProntuarioOverview({
  avaliacoes = [], agendamentos = [], modules = [], patientId, planos = [],
  pendencias = [], loading = false, error = '', planLoading = false, planError = '',
  canCreateEvaluation = false, canCreateAppointment = false, canCreateMealPlan = false,
  canReview = false, editableTypes = new Set(), teamAreas = new Set(), agora = new Date(),
}) {
  const records = avaliacoes.filter((item) => availableRecord(item, patientId));
  const eligible = eligibleEvaluations(records, patientId);
  const visible = new Set(modules.map((item) => token(item.tipo)));
  const dayStart = dayOf(agora.getTime());
  const dayEnd = nextDay(dayStart);
  const appointments = agendamentos.filter((item) => availableRecord(item, patientId)
    && token(item.status) === 'agendada' && (dateMs(item.scheduledAt || item.date) ?? 0) >= dayStart)
    .sort((a, b) => dateMs(a.scheduledAt || a.date) - dateMs(b.scheduledAt || b.date));
  const appointment = appointments[0] || null;
  const appointmentDay = appointment ? dayOf(dateMs(appointment.scheduledAt || appointment.date)) : null;
  // No evaluation-to-appointment link exists in the API. Date matching stays explicit in the UI.
  const currentRecords = records.filter((item) => {
    const time = dateMs(item.updatedAt) ?? clinicalDate(item);
    return time !== null && time >= dayStart && time < dayEnd;
  });
  const inCare = appointmentDay === dayStart || currentRecords.some((item) => OBRIGATORIAS.includes(token(item.tipo)) && !estaFechada(item) && !item.meta?.aguardandoRevisao);
  const required = new Set(inCare ? OBRIGATORIAS : []);
  const requested = new Set((appointment?.evaluations || []).map(token));
  // Um instrumento restrito a uma area (psicologia, fisioterapia) so vira
  // "nao aplicavel" quando o caso ja tem equipe registrada e nenhum membro
  // cobre a area exigida. Equipe desconhecida nao vira "nao aplicavel":
  // ausencia de dado sobre a equipe e nula, nao prova que o instrumento nao
  // cabe no caso — fica "opcional" ate a equipe estar definida.
  const categoryOf = (type) => {
    if (required.has(type)) return 'obrigatoria';
    if (requested.has(type)) return 'solicitada';
    const areas = getEvaluationEditAreas(type);
    const restritoAArea = areas.length > 0 && !areas.includes('nutricao');
    if (restritoAArea && teamAreas.size > 0 && !areas.some((area) => teamAreas.has(area))) return 'nao_aplicavel';
    return 'opcional';
  };
  const forTask = (item, category) => {
    const start = category === 'solicitada' ? appointmentDay : dayStart;
    const time = clinicalDate(item);
    return start !== null && time !== null && time >= start && time < nextDay(start);
  };
  const moduleStates = modules.map((module) => {
    const type = token(module.tipo);
    const category = categoryOf(type);
    const foraDoFluxo = category === 'opcional' || category === 'nao_aplicavel';
    const matching = eligible.filter((item) => token(item.tipo) === type);
    return { ...module, category, complete: foraDoFluxo ? matching.length > 0 : matching.some((item) => forTask(item, category)),
      hasHistory: records.some((item) => token(item.tipo) === type) };
  });
  const tasks = [];
  for (const module of moduleStates) {
    const type = token(module.tipo);
    if (module.category === 'opcional' || module.category === 'nao_aplicavel' || module.complete) continue;
    const draft = currentRecords.find((item) => token(item.tipo) === type && !estaFechada(item) && !item.meta?.aguardandoRevisao && forTask(item, module.category));
    const remote = pendencias.find((item) => token(item.itemTipo || item.tipo) === type);
    tasks.push({ id: 'fluxo-' + type, tipo: 'avaliacao', itemTipo: type, avaliacaoId: draft?.id,
      category: module.category, severidade: module.category === 'obrigatoria' ? 'alta' : 'media',
      mensagem: module.label + (draft ? ' em andamento' : ' indicada para este atendimento'),
      detalhe: module.category === 'obrigatoria' ? 'Obrigatória no atendimento atual' : 'Solicitada na consulta agendada',
      acao: { label: draft ? 'Continuar' : 'Iniciar' }, remoteId: remote?.id,
      actionable: canCreateEvaluation && editableTypes.has(type),
    });
  }
  for (const item of records.filter((record) => record.meta?.aguardandoRevisao && visible.has(token(record.tipo)))) {
    const type = token(item.tipo);
    const label = modules.find((module) => token(module.tipo) === type)?.label || item.tipo;
    const existing = tasks.findIndex((task) => task.itemTipo === type && forTask(item, task.category));
    if (existing !== -1) tasks.splice(existing, 1);
    tasks.unshift({ id: 'revisao-' + item.id, tipo: 'revisao', itemTipo: type, avaliacaoId: item.id,
      severidade: 'media', mensagem: label + ' aguarda revisão', detalhe: 'Envio recebido para conferência',
      acao: { label: 'Revisar' }, actionable: canReview && (Boolean(item.meta?.atletaSelfReport) || item.meta?.origemPreenchimento === 'atleta') });
  }
  const activePlan = !planLoading && !planError ? findActivePlan(planos, patientId, agora) : null;
  if (activePlan && !appointment) tasks.push({ id: 'retorno', tipo: 'sem_consulta', severidade: 'baixa',
    mensagem: 'Definir retorno do plano vigente', detalhe: 'Sem consulta futura registrada',
    acao: { label: 'Marcar retorno' }, actionable: canCreateAppointment });

  // Fila unica ordenada por relevancia: revisao pendente primeiro (alguem ja
  // fez o trabalho e espera resposta), obrigatoria antes de solicitada, e
  // continuidade de agenda por ultimo. Sem isto a ordem seguia so a ordem do
  // registro de instrumentos, misturando severidades na mesma lista.
  const PESO_TIPO = { revisao: 0, avaliacao: 1, sem_consulta: 2 };
  const PESO_SEVERIDADE = { alta: 0, media: 1, baixa: 2 };
  tasks.sort((a, b) => (PESO_TIPO[a.tipo] ?? 3) - (PESO_TIPO[b.tipo] ?? 3)
    || (PESO_SEVERIDADE[a.severidade] ?? 3) - (PESO_SEVERIDADE[b.severidade] ?? 3));

  let action = null;
  let state = activePlan ? 'Plano vigente' : appointment ? 'Consulta agendada' : eligible.length ? 'Em acompanhamento' : 'Atendimento não iniciado';
  if (loading) state = 'Carregando atendimento';
  else if (error) state = 'Dados do atendimento indisponíveis';
  else {
    const review = tasks.find((task) => task.tipo === 'revisao' && task.actionable);
    const drafts = currentRecords.filter((item) => !estaFechada(item) && !item.meta?.aguardandoRevisao
      && editableTypes.has(token(item.tipo)) && canCreateEvaluation);
    const ready = drafts.find(prontaParaFinalizar);
    const draft = drafts.find((item) => required.has(token(item.tipo)) || requested.has(token(item.tipo)));
    const task = tasks.find((item) => item.tipo === 'avaliacao' && item.actionable);
    if (review) { state = 'Revisão pendente'; action = { label: 'Revisar avaliação', kind: 'review', item: review }; }
    else if (ready) { state = 'Avaliação pronta para revisão'; action = { label: 'Revisar avaliação', kind: 'evaluation', type: ready.tipo, id: ready.id }; }
    else if (draft) { state = 'Consulta em andamento'; action = { label: 'Continuar consulta', kind: 'evaluation', type: draft.tipo, id: draft.id }; }
    else if (task) action = { label: inCare ? 'Continuar consulta' : 'Preparar consulta', kind: 'evaluation', type: task.itemTipo };
    else if (canCreateMealPlan && !planLoading && !planError && !activePlan && eligible.some((item) => token(item.tipo) === 'gasto_energetico_total')) action = { label: 'Preparar plano', kind: 'plan' };
    else if (activePlan && !appointment && canCreateAppointment) action = { label: 'Marcar retorno', kind: 'appointment' };
    else if (!eligible.length && !appointment && canCreateEvaluation && editableTypes.has('anamnese_inicial')) action = { label: 'Iniciar consulta', kind: 'evaluation', type: 'anamnese_inicial' };
    else if (appointment) action = { label: 'Ver consulta agendada', kind: 'history' };
    else action = { label: eligible.length ? 'Consultar avaliações' : 'Ver dados do paciente', kind: 'tab', tab: eligible.length ? 'avaliacoes' : 'dados-clinicos' };
    if (!review && tasks.some((item) => item.tipo === 'revisao')) state = 'Revisão pendente';
  }
  return { tasks: loading || error ? [] : tasks, moduleStates, action, state, appointment, activePlan,
    applicabilityNote: 'As indicações acompanham a consulta agendada; avaliações finalizadas do mesmo dia indicam conclusão. Confira os registros nos detalhes.' };
}
