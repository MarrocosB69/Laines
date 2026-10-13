type JsonRecord = Record<string, unknown>;

const normalizeType = (value: unknown): string => (
  String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
);

const asRecord = (value: unknown): JsonRecord => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as JsonRecord;
};

const mergeRecords = (...records: JsonRecord[]): JsonRecord => (
  records.reduce<JsonRecord>((acc, record) => ({ ...acc, ...record }), {})
);

const compact = (record: JsonRecord): JsonRecord => {
  const output: JsonRecord = {};
  Object.entries(record).forEach(([key, value]) => {
    if (value !== undefined) output[key] = value;
  });
  return output;
};

const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(String(value).replace(',', '.').trim());
  return Number.isFinite(parsed) ? parsed : null;
};

const toText = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

const toBoolean = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') return value;
  const token = String(value || '').trim().toLowerCase();
  if (!token) return null;
  if (['true', '1', 'sim', 'yes'].includes(token)) return true;
  if (['false', '0', 'nao', 'não', 'no'].includes(token)) return false;
  return null;
};

const pick = (sources: JsonRecord[], aliases: string[]): unknown => {
  for (const source of sources) {
    for (const alias of aliases) {
      if (!Object.prototype.hasOwnProperty.call(source, alias)) continue;
      const value = source[alias];
      if (value === null || value === undefined || value === '') continue;
      return value;
    }
  }
  return null;
};

const normalizeQuestionAnswer = (value: unknown): number => {
  const boolValue = toBoolean(value);
  if (boolValue === true) return 1;
  if (boolValue === false) return 0;
  const numeric = toNumber(value);
  if (Number.isFinite(numeric)) return (numeric as number) > 0 ? 1 : 0;
  return 0;
};

const scoreQuestionnaire = (value: unknown): number | null => {
  if (!value) return null;
  if (Array.isArray(value)) {
    const score = value.reduce((sum, item) => sum + normalizeQuestionAnswer(item), 0);
    return Number.isFinite(score) ? score : null;
  }
  if (typeof value === 'object') {
    const score = Object.values(value as Record<string, unknown>)
      .reduce<number>((sum, item) => sum + normalizeQuestionAnswer(item), 0);
    return Number.isFinite(score) ? score : null;
  }
  return null;
};

const round = (value: number | null, digits = 2): number | null => {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round((value as number) * factor) / factor;
};

const classifyDisponibilidadeEnergetica = (de: number | null): string => {
  if (!Number.isFinite(de)) return '';
  if ((de as number) >= 45) return 'otima';
  if ((de as number) >= 30) return 'risco_relativo';
  return 'reds_estabelecido';
};

// Só exibição (WI-013): o código da faixa continua o mesmo em `classificacao`
// e `classificacaoDE`; o rótulo escrito usa o nome do glossário.
export const ROTULO_CLASSIFICACAO_DE: Record<string, string> = {
  otima: 'Disponibilidade energética adequada',
  risco_relativo: 'Disponibilidade energética reduzida',
  reds_estabelecido: 'Baixa disponibilidade energética'
};

type PayloadShape = {
  tipo?: string;
  dados?: JsonRecord;
  resultados?: JsonRecord;
  formulaId?: string;
  formulaVersion?: string;
  classificacao?: string;
  classificacaoLabel?: string;
};

export const normalizeTriagemRedsPayload = <T extends PayloadShape>(payload: T): T => {
  if (normalizeType(payload?.tipo) !== 'triagem_reds') {
    return payload;
  }

  const payloadRecord = asRecord(payload as unknown);
  const dados = asRecord(payload.dados);
  const resultados = asRecord(payload.resultados);
  const dadosBrutos = asRecord(dados.dados_brutos);
  const input = asRecord(dados.input);
  const calculated = asRecord(resultados.calculated);
  const output = asRecord(resultados.output);
  const fallbackManual = asRecord(
    pick(
      [dados, dadosBrutos, input, payloadRecord],
      ['fallbackManual', 'fallback_manual', 'manualFallback', 'entradaManual']
    )
  );
  const automaticSources = asRecord(
    pick(
      [dados, dadosBrutos, input, payloadRecord],
      ['fontesAutomaticas', 'fontes_automaticas', 'autoSources', 'origensAutomaticas']
    )
  );

  const valueSources = [
    dados,
    dadosBrutos,
    input,
    fallbackManual,
    automaticSources,
    resultados,
    calculated,
    output,
    payloadRecord
  ];

  const ingestaoAuto = toNumber(pick(valueSources, [
    'ingestaoKcalR24hAuto',
    'ingestao_kcal_r24h_auto',
    'ingestaoKcalR24h_automatica',
    'caloriasTotalAuto',
    'caloriasTotal',
    'totalDiario'
  ]));
  const ingestaoManual = toNumber(pick(valueSources, [
    'ingestaoKcalR24hManual',
    'ingestao_kcal_r24h_manual',
    'ingestaoKcalR24hFallback',
    'ingestaoKcalFallback',
    'ingestaoManualKcal'
  ]));
  const ingestaoKcal = toNumber(pick(valueSources, [
    'ingestaoKcalR24h',
    'ingestao_kcal_r24h',
    'ingestaoKcal',
    'caloriasTotal',
    'totalDiario'
  ]));

  const gastoAutoDiario = toNumber(pick(valueSources, [
    'gastoExercicioKcalAuto',
    'gasto_exercicio_kcal_auto',
    'gastoExercicioKcalDiarioAuto',
    'gastoExercicioKcalDiario'
  ]));
  const gastoAutoSemanal = toNumber(pick(valueSources, [
    'gastoExercicioSemanalAuto',
    'gasto_exercicio_semanal_auto',
    'gastoExercicioSemanal',
    'gastoExercicioSemanalKcal',
    'totalGastoSemanalKcal'
  ]));
  const gastoManualDiario = toNumber(pick(valueSources, [
    'gastoExercicioKcalManual',
    'gasto_exercicio_kcal_manual',
    'gastoManualKcal',
    'gastoExercicioDiarioManual'
  ]));
  const gastoManualSemanal = toNumber(pick(valueSources, [
    'gastoExercicioSemanalManual',
    'gasto_exercicio_semanal_manual',
    'gastoManualSemanalKcal'
  ]));
  const gastoExercicioKcal = toNumber(pick(valueSources, [
    'gastoExercicioKcal',
    'gasto_exercicio_kcal',
    'gastoExercicioDiarioKcal'
  ]));

  const massaMagraAuto = toNumber(pick(valueSources, [
    'massaMagraKgAuto',
    'massa_magra_kg_auto',
    'massaMagraAuto',
    'massaMagra'
  ]));
  const massaMagraManual = toNumber(pick(valueSources, [
    'massaMagraKgManual',
    'massa_magra_kg_manual',
    'massaMagraFallback',
    'massaMagraManual'
  ]));
  const massaMagraKg = toNumber(pick(valueSources, [
    'massaMagraKg',
    'massa_magra_kg',
    'massaMagra'
  ]));

  const ingestaoKcalResolvida = Number.isFinite(ingestaoKcal)
    ? (ingestaoKcal as number)
    : (Number.isFinite(ingestaoAuto)
      ? (ingestaoAuto as number)
      : (Number.isFinite(ingestaoManual) ? (ingestaoManual as number) : null));

  const gastoAutoResolvido = Number.isFinite(gastoAutoDiario)
    ? (gastoAutoDiario as number)
    : (Number.isFinite(gastoAutoSemanal) ? (gastoAutoSemanal as number) / 7 : null);
  const gastoManualResolvido = Number.isFinite(gastoManualDiario)
    ? (gastoManualDiario as number)
    : (Number.isFinite(gastoManualSemanal) ? (gastoManualSemanal as number) / 7 : null);
  const gastoExercicioResolvido = Number.isFinite(gastoExercicioKcal)
    ? (gastoExercicioKcal as number)
    : (Number.isFinite(gastoAutoResolvido)
      ? (gastoAutoResolvido as number)
      : (Number.isFinite(gastoManualResolvido) ? (gastoManualResolvido as number) : null));

  const massaMagraResolvida = Number.isFinite(massaMagraKg)
    ? (massaMagraKg as number)
    : (Number.isFinite(massaMagraAuto)
      ? (massaMagraAuto as number)
      : (Number.isFinite(massaMagraManual) ? (massaMagraManual as number) : null));

  const precisaDadosExtras = [
    !Number.isFinite(ingestaoKcalResolvida) ? 'ingestaoKcalR24h' : null,
    !Number.isFinite(gastoExercicioResolvido) ? 'gastoExercicioKcal' : null,
    !Number.isFinite(massaMagraResolvida) || (massaMagraResolvida as number) <= 0 ? 'massaMagraKg' : null
  ].filter((item): item is string => Boolean(item));

  const energiaDisponivel = (
    Number.isFinite(ingestaoKcalResolvida)
    && Number.isFinite(gastoExercicioResolvido)
    && Number.isFinite(massaMagraResolvida)
    && (massaMagraResolvida as number) > 0
  )
    ? ((ingestaoKcalResolvida as number) - (gastoExercicioResolvido as number)) / (massaMagraResolvida as number)
    : null;
  const disponibilidadeEnergeticaExplicit = toNumber(pick(valueSources, [
    'disponibilidadeEnergetica',
    'disponibilidade_energetica',
    'DE',
    'de'
  ]));
  const disponibilidadeEnergetica = Number.isFinite(energiaDisponivel)
    ? round(energiaDisponivel, 2)
    : round(disponibilidadeEnergeticaExplicit, 2);
  const classificacaoDEExplicit = toText(pick(valueSources, [
    'classificacaoDE',
    'classificacao_de',
    'classificacao'
  ]));
  const classificacaoDE = classificacaoDEExplicit || classifyDisponibilidadeEnergetica(disponibilidadeEnergetica);

  const leafAnswers = pick(valueSources, ['leafQRespostas', 'leaf_q_respostas', 'leafQ', 'leaf']);
  const leaAnswers = pick(valueSources, ['leaQ13Respostas', 'lea_q13_respostas', 'leaQ13', 'lea']);

  const scoreLeafFromAnswers = scoreQuestionnaire(leafAnswers);
  const scoreLeaFromAnswers = scoreQuestionnaire(leaAnswers);
  const scoreLeafExplicit = toNumber(pick(valueSources, ['scoreLeafQ', 'score_leaf_q']));
  const scoreLeaExplicit = toNumber(pick(valueSources, ['scoreLeaQ13', 'score_lea_q13']));
  const scoreLeafQ = Number.isFinite(scoreLeafExplicit)
    ? Math.round(scoreLeafExplicit as number)
    : (Number.isFinite(scoreLeafFromAnswers) ? Math.round(scoreLeafFromAnswers as number) : null);
  const scoreLeaQ13 = Number.isFinite(scoreLeaExplicit)
    ? Math.round(scoreLeaExplicit as number)
    : (Number.isFinite(scoreLeaFromAnswers) ? Math.round(scoreLeaFromAnswers as number) : null);
  const scoreRastreio = Number.isFinite(scoreLeafQ) ? scoreLeafQ : scoreLeaQ13;

  const historicoAmenorreia = toBoolean(pick(valueSources, ['historicoAmenorreia', 'historico_amenorreia']));
  const historicoFraturaEstresse = toBoolean(pick(valueSources, ['historicoFraturaEstresse', 'historico_fratura_estresse']));
  const pressaoParaRestricao = toBoolean(pick(valueSources, ['pressaoParaRestricao', 'pressao_para_restricao']));
  const sintomasRaw = pick(valueSources, ['sintomas']);
  const sintomas = Array.isArray(sintomasRaw)
    ? sintomasRaw.map((item) => toText(item)).filter(Boolean)
    : [];

  const normalizedDadosBrutos = compact({
    ...dadosBrutos,
    ingestaoKcalR24hAuto: round(ingestaoAuto, 2),
    gastoExercicioSemanalAuto: round(gastoAutoSemanal, 2),
    gastoExercicioKcalAuto: round(gastoAutoResolvido, 2),
    massaMagraKgAuto: round(massaMagraAuto, 2),
    ingestaoKcalR24hManual: round(ingestaoManual, 2),
    gastoExercicioKcalManual: round(gastoManualResolvido, 2),
    massaMagraKgManual: round(massaMagraManual, 2)
  });

  const normalizedCalculated = compact({
    ...calculated,
    DE: disponibilidadeEnergetica,
    disponibilidadeEnergetica,
    classificacaoDE: classificacaoDE || undefined,
    scoreLeafQ: Number.isFinite(scoreRastreio) ? scoreRastreio : undefined,
    scoreLeaQ13: Number.isFinite(scoreLeaQ13) ? scoreLeaQ13 : undefined,
    precisaDadosExtras
  });

  const normalizedDados = compact({
    ...dados,
    ingestaoKcalR24hAuto: round(ingestaoAuto, 2),
    gastoExercicioSemanalAuto: round(gastoAutoSemanal, 2),
    gastoExercicioKcalAuto: round(gastoAutoResolvido, 2),
    massaMagraKgAuto: round(massaMagraAuto, 2),
    ingestaoKcalR24hManual: round(ingestaoManual, 2),
    gastoExercicioKcalManual: round(gastoManualResolvido, 2),
    massaMagraKgManual: round(massaMagraManual, 2),
    ingestaoKcalR24h: round(ingestaoKcalResolvida, 2),
    gastoExercicioKcal: round(gastoExercicioResolvido, 2),
    massaMagraKg: round(massaMagraResolvida, 2),
    disponibilidadeEnergetica,
    historicoAmenorreia: historicoAmenorreia === null ? undefined : historicoAmenorreia,
    historicoFraturaEstresse: historicoFraturaEstresse === null ? undefined : historicoFraturaEstresse,
    pressaoParaRestricao: pressaoParaRestricao === null ? undefined : pressaoParaRestricao,
    sintomas,
    leafQRespostas: Array.isArray(leafAnswers) || typeof leafAnswers === 'object' ? leafAnswers : undefined,
    leaQ13Respostas: Array.isArray(leaAnswers) || typeof leaAnswers === 'object' ? leaAnswers : undefined,
    scoreLeafQ: Number.isFinite(scoreRastreio) ? scoreRastreio : undefined,
    scoreLeaQ13: Number.isFinite(scoreLeaQ13) ? scoreLeaQ13 : undefined,
    precisaDadosExtras,
    dados_brutos: normalizedDadosBrutos
  });

  const normalizedResultados = compact({
    ...resultados,
    DE: disponibilidadeEnergetica,
    disponibilidadeEnergetica,
    classificacaoDE: classificacaoDE || undefined,
    scoreLeafQ: Number.isFinite(scoreRastreio) ? scoreRastreio : undefined,
    scoreLeaQ13: Number.isFinite(scoreLeaQ13) ? scoreLeaQ13 : undefined,
    precisaDadosExtras,
    calculated: normalizedCalculated,
    output: compact({
      ...output,
      classificacaoDE: classificacaoDE || undefined,
      precisaDadosExtras
    })
  });

  const formulaId = toText(payload.formulaId) || 'DE';
  const formulaVersion = toText(payload.formulaVersion) || '1.0.0';
  const classificacaoLabel = classificacaoDE
    ? ROTULO_CLASSIFICACAO_DE[classificacaoDE] || `Triagem de Disponibilidade Energetica: ${classificacaoDE}`
    : toText(payload.classificacaoLabel);

  return {
    ...payload,
    dados: normalizedDados,
    resultados: normalizedResultados,
    formulaId,
    formulaVersion,
    classificacao: classificacaoDE || payload.classificacao,
    classificacaoLabel: classificacaoLabel || payload.classificacaoLabel
  };
};
