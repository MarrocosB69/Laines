type JsonRecord = Record<string, unknown>;

const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(String(value).replace(',', '.').trim());
  return Number.isFinite(parsed) ? parsed : null;
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

// Classificacao de PA conforme SBC 2020.
const computeClassificacaoPA = (sistolica: number | null, diastolica: number | null): string => {
  if (!Number.isFinite(sistolica) || !Number.isFinite(diastolica)) {
    return 'Nao classificado';
  }
  const s = sistolica as number;
  const d = diastolica as number;

  if (s >= 180 || d >= 110) return 'HAS Estagio 3';
  if (s >= 160 || d >= 100) return 'HAS Estagio 2';
  if (s >= 140 || d >= 90) return 'HAS Estagio 1';
  if ((s >= 130 && s <= 139) || (d >= 85 && d <= 89)) return 'Pre-HAS';
  if ((s >= 120 && s <= 129) || (d >= 80 && d <= 84)) return 'Normal-alta';
  return 'Normal';
};

const resolvePrioridadeCuidado = (classificacaoPA: string): string => {
  if (classificacaoPA === 'HAS Estagio 3') return 'urgente';
  if (classificacaoPA === 'HAS Estagio 2') return 'alta';
  if (classificacaoPA === 'HAS Estagio 1' || classificacaoPA === 'Pre-HAS') return 'media';
  return 'baixa';
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

  const valueSources = [
    canonicalResultadosCalculados,
    dados,
    canonicalDadosBrutos,
    resultados,
    payloadRecord
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
  const redFlagsCount = toNumber(pick(valueSources, [
    'redFlagsCount', 'red_flags_count', 'flagsCount'
  ]));
  const esportivo = asRecord(pick(valueSources, ['esportivo']));

  // Sempre recalcula classificacao no backend e ignora qualquer valor enviado pelo frontend.
  const classificacaoPA = computeClassificacaoPA(pressaoSistolica, pressaoDiastolica);
  const prioridadeCuidado = resolvePrioridadeCuidado(classificacaoPA);

  const normalizedResultadosCalculados = compact({
    ...canonicalResultadosCalculados,
    pressaoSistolica: pressaoSistolica ?? undefined,
    pressaoDiastolica: pressaoDiastolica ?? undefined,
    frequenciaCardiaca: frequenciaCardiaca ?? undefined,
    classificacaoPA: classificacaoPA || undefined,
    prioridadeCuidado: prioridadeCuidado || undefined,
    redFlagsCount: redFlagsCount ?? undefined
  });

  const normalizedClassificacoes = compact({
    classificacaoPA: classificacaoPA || undefined,
    classificacaoPressaoArterial: classificacaoPA || undefined,
    prioridadeCuidado: prioridadeCuidado || undefined,
    prioridade_cuidado: prioridadeCuidado || undefined
  });

  const normalizedDados = compact({
    ...dados,
    pressaoSistolica: pressaoSistolica ?? undefined,
    pressaoDiastolica: pressaoDiastolica ?? undefined,
    frequenciaCardiaca: frequenciaCardiaca ?? undefined,
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
    pressao_sistolica: pressaoSistolica ?? undefined,
    pressao_diastolica: pressaoDiastolica ?? undefined,
    frequencia_cardiaca: frequenciaCardiaca ?? undefined,
    classificacaoPA: classificacaoPA || undefined,
    classificacao_pressao_arterial: classificacaoPA || undefined,
    prioridade_cuidado: prioridadeCuidado || undefined,
    calculated: normalizedResultadosCalculados,
    output: normalizedClassificacoes
  });

  return { ...payload, dados: normalizedDados, resultados: normalizedResultados };
};
