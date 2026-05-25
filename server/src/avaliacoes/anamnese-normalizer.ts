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

const compact = (record: JsonRecord): JsonRecord => {
  const output: JsonRecord = {};
  Object.entries(record).forEach(([key, value]) => {
    if (value !== undefined) output[key] = value;
  });
  return output;
};

type PayloadShape = {
  tipo?: string;
  dados?: JsonRecord;
  resultados?: JsonRecord;
  meta?: JsonRecord;
};

export const normalizeAnamneseInicialPayload = <T extends PayloadShape>(payload: T): T => {
  if (normalizeType(payload?.tipo) !== 'anamnese_inicial') return payload;

  const dados = asRecord(payload.dados);
  const resultados = asRecord(payload.resultados);
  const payloadRecord = asRecord(payload as unknown);

  const canonicalDadosBrutos = mergeRecords(
    asRecord(dados.dados_brutos),
    asRecord(dados.input),
    asRecord(payloadRecord.dados_brutos),
    asRecord(payloadRecord.input)
  );

  const canonicalResultadosCalculados = {
    ...asRecord(dados.resultados_calculados),
    ...asRecord(resultados.calculated)
  };
  const canonicalClassificacoes = {
    ...asRecord(dados.classificacoes),
    ...asRecord(resultados.output)
  };

  const valueSources = [
    canonicalResultadosCalculados,
    canonicalClassificacoes,
    canonicalDadosBrutos,
    dados,
    resultados,
    payloadRecord
  ];

  const scoreRisco = toNumber(pick(valueSources, ['scoreRisco', 'score_risco', 'riscoScore']));
  const prioridade = toText(pick(valueSources, ['prioridade', 'prioridadeCuidado', 'priorityCare']));
  const flags = pick(valueSources, ['flags']) ?? [];
  const encaminhamentos = pick(valueSources, ['encaminhamentos', 'referrals']) ?? [];
  const esportivo = asRecord(pick(valueSources, ['esportivo']));

  const normalizedResultadosCalculados = compact({
    ...canonicalResultadosCalculados,
    scoreRisco: scoreRisco ?? undefined,
    prioridade: prioridade || undefined,
    flags: Array.isArray(flags) ? flags : undefined,
    encaminhamentos: Array.isArray(encaminhamentos) ? encaminhamentos : undefined
  });

  const normalizedClassificacoes = compact({
    ...canonicalClassificacoes,
    prioridadeCuidado: prioridade || undefined
  });

  const normalizedDados = compact({
    ...dados,
    esportivo: Object.keys(esportivo).length ? esportivo : undefined,
    dados_brutos: compact({
      ...canonicalDadosBrutos,
      esportivo: Object.keys(esportivo).length ? esportivo : undefined
    }),
    resultados_calculados: normalizedResultadosCalculados,
    classificacoes: normalizedClassificacoes
  });

  const normalizedResultados = compact({
    ...resultados,
    calculated: normalizedResultadosCalculados,
    output: normalizedClassificacoes
  });

  return { ...payload, dados: normalizedDados, resultados: normalizedResultados };
};
