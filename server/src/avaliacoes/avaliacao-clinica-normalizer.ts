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

export const normalizeAvaliacaoClinicaPayload = <T extends PayloadShape>(payload: T): T => {
  if (normalizeType(payload?.tipo) !== 'avaliacao_clinica') return payload;

  const dados = asRecord(payload.dados);
  const resultados = asRecord(payload.resultados);

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
    dados,
    resultados,
    asRecord(payload as unknown)
  ];

  const pressaoSistolica = toNumber(pick(valueSources, [
    'pressaoSistolica', 'pressao_sistolica', 'systolic', 'pas'
  ]));
  const pressaoDiastolica = toNumber(pick(valueSources, [
    'pressaoDiastolica', 'pressao_diastolica', 'diastolic', 'pad'
  ]));
  const frequenciaCardiaca = toNumber(pick(valueSources, [
    'frequenciaCardiaca', 'frequencia_cardiaca', 'heartRate', 'fc'
  ]));
  const prioridadeCuidado = toText(pick(valueSources, [
    'prioridadeCuidado', 'prioridade_cuidado', 'prioridade', 'priority'
  ]));
  const classificacaoPressaoArterial = toText(pick(valueSources, [
    'classificacaoPressaoArterial', 'classificacao_pa', 'bpClassification'
  ]));
  const redFlagsCount = toNumber(pick(valueSources, [
    'redFlagsCount', 'red_flags_count', 'flagsCount'
  ]));

  const normalizedResultadosCalculados = compact({
    ...canonicalResultadosCalculados,
    pressaoSistolica: pressaoSistolica ?? undefined,
    pressaoDiastolica: pressaoDiastolica ?? undefined,
    frequenciaCardiaca: frequenciaCardiaca ?? undefined,
    prioridadeCuidado: prioridadeCuidado || undefined,
    redFlagsCount: redFlagsCount ?? undefined
  });

  const normalizedClassificacoes = compact({
    ...canonicalClassificacoes,
    classificacaoPressaoArterial: classificacaoPressaoArterial || undefined,
    prioridade_cuidado: prioridadeCuidado || undefined
  });

  const normalizedDados = compact({
    ...dados,
    pressaoSistolica: pressaoSistolica ?? undefined,
    pressaoDiastolica: pressaoDiastolica ?? undefined,
    frequenciaCardiaca: frequenciaCardiaca ?? undefined,
    dados_brutos: asRecord(dados.dados_brutos),
    resultados_calculados: normalizedResultadosCalculados,
    classificacoes: normalizedClassificacoes
  });

  const normalizedResultados = compact({
    ...resultados,
    pressao_sistolica: pressaoSistolica ?? undefined,
    pressao_diastolica: pressaoDiastolica ?? undefined,
    frequencia_cardiaca: frequenciaCardiaca ?? undefined,
    prioridade_cuidado: prioridadeCuidado || undefined,
    calculated: normalizedResultadosCalculados,
    output: normalizedClassificacoes
  });

  return { ...payload, dados: normalizedDados, resultados: normalizedResultados };
};
