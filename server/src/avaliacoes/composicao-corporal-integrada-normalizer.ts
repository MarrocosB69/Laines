type JsonRecord = Record<string, unknown>;

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

type PayloadShape = {
  tipo?: string;
  dados?: JsonRecord;
  resultados?: JsonRecord;
  formulaId?: string;
  formulaVersion?: string;
  classificacao?: string;
  classificacaoLabel?: string;
};

export const normalizeComposicaoCorporalIntegradaPayload = <T extends PayloadShape>(payload: T): T => {
  if (normalizeType(payload?.tipo) !== 'composicao_corporal_integrada') {
    return payload;
  }

  const payloadRecord = asRecord(payload as unknown);
  const dados = asRecord(payload.dados);
  const resultados = asRecord(payload.resultados);

  const canonicalDadosBrutos = mergeRecords(
    asRecord(dados.dados_brutos),
    asRecord(dados.input),
    asRecord(payloadRecord.dados_brutos),
    asRecord(payloadRecord.input)
  );
  const canonicalResultadosCalculados = mergeRecords(
    asRecord(dados.resultados_calculados),
    asRecord(resultados.calculated),
    asRecord(payloadRecord.resultados_calculados)
  );
  const canonicalClassificacoes = mergeRecords(
    asRecord(dados.classificacoes),
    asRecord(resultados.output),
    asRecord(payloadRecord.classificacoes)
  );
  const canonicalMetadadosFormula = mergeRecords(
    asRecord(dados.metadados_formula),
    asRecord(payloadRecord.metadados_formula)
  );
  const canonicalComparacao = mergeRecords(
    asRecord(dados.comparacao),
    asRecord(resultados.comparacao),
    asRecord(payloadRecord.comparacao)
  );

  const valueSources = [
    canonicalResultadosCalculados,
    canonicalClassificacoes,
    canonicalDadosBrutos,
    canonicalMetadadosFormula,
    canonicalComparacao,
    dados,
    resultados,
    payloadRecord
  ];

  const fonteOficial = toText(pick(valueSources, ['fonte_oficial', 'fonteOficial', 'selectedSourceId']));
  const percentualGorduraOficial = toNumber(pick(valueSources, [
    'percentualGorduraOficial',
    'percentual_gordura_oficial',
    'percentual_gordura',
    'percentualGordura'
  ]));
  const massaGordaOficialKg = toNumber(pick(valueSources, [
    'massaGordaOficialKg',
    'massa_gorda_oficial_kg',
    'massa_gorda_kg'
  ]));
  const massaMagraOficialKg = toNumber(pick(valueSources, [
    'massaMagraOficialKg',
    'massa_magra_oficial_kg',
    'massa_magra_kg',
    'massaMagra'
  ]));
  const aguaCorporalOficialL = toNumber(pick(valueSources, [
    'aguaCorporalOficialL',
    'agua_corporal_oficial_l',
    'agua_total_l'
  ]));
  const tmbSelecionadaKcal = toNumber(pick(valueSources, ['tmbSelecionadaKcal', 'tmb_selecionada_kcal', 'tmbKcal']));
  const getEstimadoKcal = toNumber(pick(valueSources, ['getEstimadoKcal', 'get_estimado_kcal', 'getKcal']));

  const sexo = toText(pick(valueSources, ['sexo', 'sex']));
  const idade = toNumber(pick(valueSources, ['idade', 'ageYears']));
  const pesoKg = toNumber(pick(valueSources, ['peso_kg', 'peso', 'weightKg', 'weight']));
  const estaturaCm = toNumber(pick(valueSources, ['estatura_cm', 'estatura', 'heightCm', 'height']));
  const nivelAtividade = toText(pick(valueSources, ['nivel_atividade', 'activityLevel'])) || 'sedentario';
  const fatorAtividadePersonalizado = toNumber(pick(valueSources, ['fator_atividade_personalizado', 'customActivityFactor']));

  const formulaId = toText(payload.formulaId)
    || toText(pick([canonicalMetadadosFormula], ['formulaId', 'formula_id']))
    || 'mifflin_st_jeor_1990';
  const formulaVersion = toText(payload.formulaVersion)
    || toText(pick([canonicalMetadadosFormula], ['formulaVersion', 'formula_version']))
    || '1.0.0';

  const classificacaoPercentualGordura = toText(pick(valueSources, [
    'percentual_gordura',
    'classificacaoPercentualGordura',
    'classificacao'
  ]));
  const referenciaClassificacao = toText(pick(valueSources, ['referencia', 'classificationSource']));

  const normalizedDadosBrutos = compact({
    ...canonicalDadosBrutos,
    selectedSourceId: fonteOficial || undefined,
    activityLevel: nivelAtividade || undefined,
    customActivityFactor: fatorAtividadePersonalizado,
    sexo: sexo || undefined,
    idade: idade ?? undefined,
    pesoKg: pesoKg ?? undefined,
    estaturaCm: estaturaCm ?? undefined
  });

  const normalizedResultadosCalculados = compact({
    ...canonicalResultadosCalculados,
    percentualGorduraOficial,
    percentual_gordura_oficial: percentualGorduraOficial,
    massaGordaOficialKg,
    massa_gorda_oficial_kg: massaGordaOficialKg,
    massaMagraOficialKg,
    massa_magra_oficial_kg: massaMagraOficialKg,
    aguaCorporalOficialL,
    agua_corporal_oficial_l: aguaCorporalOficialL,
    tmbSelecionadaKcal,
    tmb_selecionada_kcal: tmbSelecionadaKcal,
    getEstimadoKcal,
    get_estimado_kcal: getEstimadoKcal
  });

  const normalizedClassificacoes = compact({
    ...canonicalClassificacoes,
    percentual_gordura: classificacaoPercentualGordura || undefined,
    referencia: referenciaClassificacao || undefined,
    fonte_oficial: toText(pick([canonicalClassificacoes], ['fonte_oficial'])) || undefined
  });

  const normalizedMetadadosFormula = compact({
    ...canonicalMetadadosFormula,
    formulaId,
    formulaVersion
  });

  const normalizedDados = compact({
    ...dados,
    fonte_oficial: fonteOficial || undefined,
    percentualGorduraOficial,
    percentual_gordura_oficial: percentualGorduraOficial,
    massaMagraOficialKg,
    massa_magra_oficial_kg: massaMagraOficialKg,
    massaGordaOficialKg,
    massa_gorda_oficial_kg: massaGordaOficialKg,
    aguaCorporalOficialL,
    agua_corporal_oficial_l: aguaCorporalOficialL,
    tmbSelecionadaKcal,
    tmb_selecionada_kcal: tmbSelecionadaKcal,
    getEstimadoKcal,
    get_estimado_kcal: getEstimadoKcal,
    sexo: sexo || undefined,
    idade: idade ?? undefined,
    peso_kg: pesoKg,
    estatura_cm: estaturaCm,
    nivel_atividade: nivelAtividade || undefined,
    fator_atividade_personalizado: fatorAtividadePersonalizado,
    dados_brutos: normalizedDadosBrutos,
    resultados_calculados: normalizedResultadosCalculados,
    classificacoes: normalizedClassificacoes,
    metadados_formula: normalizedMetadadosFormula,
    comparacao: compact({
      ...canonicalComparacao
    })
  });

  const normalizedResultados = compact({
    ...resultados,
    percentual_gordura: percentualGorduraOficial,
    massa_gorda_kg: massaGordaOficialKg,
    massa_magra_kg: massaMagraOficialKg,
    agua_total_l: aguaCorporalOficialL,
    tmb_kcal: tmbSelecionadaKcal,
    get_kcal: getEstimadoKcal,
    calculated: compact({
      ...asRecord(resultados.calculated),
      percentualGorduraOficial,
      massaGordaOficialKg,
      massaMagraOficialKg,
      aguaCorporalOficialL,
      tmbSelecionadaKcal,
      getEstimadoKcal
    }),
    output: compact({
      ...asRecord(resultados.output),
      percentual_gordura: classificacaoPercentualGordura || undefined,
      referencia: referenciaClassificacao || undefined
    }),
    comparacao: compact({
      ...canonicalComparacao
    })
  });

  const classificacao = toText(payload.classificacao) || classificacaoPercentualGordura;
  const classificacaoLabel = toText(payload.classificacaoLabel) || classificacaoPercentualGordura;

  return {
    ...payload,
    dados: normalizedDados,
    resultados: normalizedResultados,
    formulaId,
    formulaVersion,
    classificacao: classificacao || payload.classificacao,
    classificacaoLabel: classificacaoLabel || payload.classificacaoLabel
  };
};
