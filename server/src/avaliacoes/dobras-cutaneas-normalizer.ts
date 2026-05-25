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

const normalizeDobrasMap = (value: unknown): JsonRecord => {
  const source = asRecord(value);
  const output: JsonRecord = {};
  Object.entries(source).forEach(([key, item]) => {
    const cleanedKey = toText(key);
    if (!cleanedKey) return;
    output[cleanedKey] = toNumber(item);
  });
  return output;
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

export const normalizeDobrasCutaneasPayload = <T extends PayloadShape>(payload: T): T => {
  if (normalizeType(payload?.tipo) !== 'dobras_cutaneas') {
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

  const normalizedDobras = normalizeDobrasMap(mergeRecords(
    asRecord(dados.dobras),
    asRecord(canonicalDadosBrutos.dobras),
    asRecord(asRecord(dados.input).dobrasMm),
    asRecord(payloadRecord.dobras)
  ));

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

  const protocolo = toText(pick(valueSources, ['protocolo', 'protocoloDobras']));
  const sexo = toText(pick(valueSources, ['sexo', 'sex']));
  const conversionMethod = toText(pick(valueSources, ['conversionMethod', 'equacao_percentual'])) || 'siri';
  const esportivo = asRecord(pick(valueSources, ['esportivo']));

  const somaDobras = toNumber(pick(valueSources, ['soma_dobras', 'somaDobras', 'somaSeteDobras']));
  const somaDobrasTotal = toNumber(pick(valueSources, ['soma_dobras_total', 'somaDobrasTotal']));
  const densidadeCorporal = toNumber(pick(valueSources, ['densidade_corporal', 'densidadeCorporal']));
  const percentualGorduraSiri = toNumber(pick(valueSources, ['percentual_gordura_siri', 'percentualGorduraSiri']));
  const percentualGorduraBrozek = toNumber(pick(valueSources, ['percentual_gordura_brozek', 'percentualGorduraBrozek']));
  const percentualGordura = toNumber(pick(valueSources, ['percentual_gordura', 'percentualGordura', 'percentFat']));
  const massaGordaKg = toNumber(pick(valueSources, ['massa_gorda_kg', 'massaGorda', 'fatMassKg']));
  const massaMagraKg = toNumber(pick(valueSources, ['massa_magra_kg', 'massaMagra', 'leanMassKg']));

  const classificacaoPercentualGordura = toText(pick(valueSources, [
    'classificacao_percentual_gordura',
    'classificacaoPercentualGordura',
    'percentual_gordura'
  ]));
  const referenciaClassificacao = toText(pick(valueSources, ['referencia', 'classificationSource']));

  const formulaId = toText(payload.formulaId)
    || toText(pick([canonicalMetadadosFormula], ['formulaId', 'formula_id']))
    || (protocolo ? `${protocolo}-${conversionMethod}` : '');
  const formulaVersion = toText(payload.formulaVersion)
    || toText(pick([canonicalMetadadosFormula], ['formulaVersion', 'formula_version']))
    || (formulaId ? '1.0.0' : '');

  const normalizedDadosBrutos = compact({
    ...canonicalDadosBrutos,
    protocolo: protocolo || undefined,
    sexo: sexo || undefined,
    dobras: normalizedDobras,
    esportivo: Object.keys(esportivo).length ? esportivo : undefined
  });

  const normalizedResultadosCalculados = compact({
    ...canonicalResultadosCalculados,
    soma_dobras: somaDobras,
    somaDobras,
    soma_dobras_total: somaDobrasTotal,
    densidade_corporal: densidadeCorporal,
    densidadeCorporal,
    percentual_gordura_siri: percentualGorduraSiri,
    percentualGorduraSiri,
    percentual_gordura_brozek: percentualGorduraBrozek,
    percentualGorduraBrozek,
    percentual_gordura: percentualGordura,
    percentualGordura,
    massa_gorda_kg: massaGordaKg,
    massaGorda: massaGordaKg,
    massa_magra_kg: massaMagraKg,
    massaMagra: massaMagraKg
  });

  const normalizedClassificacoes = compact({
    ...canonicalClassificacoes,
    percentual_gordura: classificacaoPercentualGordura || undefined,
    classificacaoPercentualGordura: classificacaoPercentualGordura || undefined,
    referencia: referenciaClassificacao || undefined
  });

  const normalizedMetadadosFormula = compact({
    ...canonicalMetadadosFormula,
    formulaId: formulaId || undefined,
    formulaVersion: formulaVersion || undefined
  });

  const normalizedDados = compact({
    ...dados,
    protocoloDobras: protocolo || undefined,
    protocolo: protocolo || undefined,
    sexo: sexo || undefined,
    dobras: normalizedDobras,
    esportivo: Object.keys(esportivo).length ? esportivo : undefined,
    soma_dobras: somaDobras,
    soma_dobras_total: somaDobrasTotal,
    densidade_corporal: densidadeCorporal,
    percentual_gordura_siri: percentualGorduraSiri,
    percentual_gordura_brozek: percentualGorduraBrozek,
    percentual_gordura: percentualGordura,
    percentualGordura,
    massa_gorda_kg: massaGordaKg,
    massa_magra_kg: massaMagraKg,
    classificacao_percentual_gordura: classificacaoPercentualGordura || undefined,
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
    soma_dobras: somaDobras,
    densidade_corporal: densidadeCorporal,
    percentual_gordura_siri: percentualGorduraSiri,
    percentual_gordura_brozek: percentualGorduraBrozek,
    percentual_gordura: percentualGordura,
    massa_gorda_kg: massaGordaKg,
    massa_magra_kg: massaMagraKg,
    classificacao_percentual_gordura: classificacaoPercentualGordura || undefined,
    calculated: compact({
      ...asRecord(resultados.calculated),
      ...normalizedResultadosCalculados
    }),
    output: compact({
      ...asRecord(resultados.output),
      ...normalizedClassificacoes
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
    formulaId: formulaId || payload.formulaId,
    formulaVersion: formulaVersion || payload.formulaVersion,
    classificacao: classificacao || payload.classificacao,
    classificacaoLabel: classificacaoLabel || payload.classificacaoLabel
  };
};
