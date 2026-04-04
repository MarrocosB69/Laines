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

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

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

const round = (value: number | null, digits = 2): number | null => (
  Number.isFinite(value) ? Number((value as number).toFixed(digits)) : null
);

const classifyHydration = (lossPercent: number | null) => {
  if (!Number.isFinite(lossPercent)) {
    return { label: 'Sem classificacao', alertLevel: 'neutral' };
  }
  const numeric = lossPercent as number;
  if (numeric >= 3) return { label: 'Desidratacao importante', alertLevel: 'danger' };
  if (numeric >= 2) return { label: 'Desidratacao moderada', alertLevel: 'warning' };
  if (numeric > 0) return { label: 'Leve desidratacao', alertLevel: 'info' };
  return { label: 'Sem perda relevante', alertLevel: 'success' };
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

export const normalizeHidratacaoPayload = <T extends PayloadShape>(payload: T): T => {
  if (normalizeType(payload?.tipo) !== 'hidratacao') {
    return payload;
  }

  const payloadRecord = asRecord(payload as unknown);
  const dados = asRecord(payload.dados);
  const resultados = asRecord(payload.resultados);
  const input = asRecord(dados.input);
  const resultadosCalculated = asRecord(resultados.calculated);
  const resultadosOutput = asRecord(resultados.output);

  const valueSources = [dados, input, resultadosCalculated, resultados, payloadRecord];

  const pesoAntesExercicio = toNumber(pick(valueSources, ['pesoAntesExercicio', 'weightBeforeKg']));
  const pesoAposExercicio = toNumber(pick(valueSources, ['pesoAposExercicio', 'weightAfterKg']));
  const duracaoExercicioMin = toNumber(pick(valueSources, ['duracaoExercicioMin', 'durationMin']));
  const volumeIngeridoMl = toNumber(pick(valueSources, ['volumeIngeridoMl', 'fluidIntakeMl'])) ?? 0;
  const volumeUrinarioMl = toNumber(pick(valueSources, ['volumeUrinarioMl', 'urineVolumeMl'])) ?? 0;
  const modalidade = toText(pick(valueSources, ['modalidade', 'modality']));
  const temperaturaAmbiente = toNumber(pick(valueSources, ['temperaturaAmbiente', 'ambientTemperatureC']));
  const observacoes = toText(pick(valueSources, ['observacoes', 'notes']));

  let perdaPesoAbsolutaKg = toNumber(pick(valueSources, ['perdaPesoAbsolutaKg']));
  if (!Number.isFinite(perdaPesoAbsolutaKg) && Number.isFinite(pesoAntesExercicio) && Number.isFinite(pesoAposExercicio)) {
    perdaPesoAbsolutaKg = (pesoAntesExercicio as number) - (pesoAposExercicio as number);
  }

  let perdaPesoPercentual = toNumber(pick(valueSources, ['perdaPesoPercentual']));
  if (!Number.isFinite(perdaPesoPercentual) && Number.isFinite(perdaPesoAbsolutaKg) && Number.isFinite(pesoAntesExercicio) && (pesoAntesExercicio as number) > 0) {
    perdaPesoPercentual = ((perdaPesoAbsolutaKg as number) / (pesoAntesExercicio as number)) * 100;
  }

  let perdaHidricaLiquidaMl = toNumber(pick(valueSources, ['perdaHidricaLiquidaMl']));
  if (!Number.isFinite(perdaHidricaLiquidaMl) && Number.isFinite(perdaPesoAbsolutaKg)) {
    perdaHidricaLiquidaMl = ((perdaPesoAbsolutaKg as number) * 1000) + volumeIngeridoMl - volumeUrinarioMl;
  }

  let taxaSudoreseLh = toNumber(pick(valueSources, ['taxaSudoreseLh']));
  if (!Number.isFinite(taxaSudoreseLh) && Number.isFinite(perdaHidricaLiquidaMl) && Number.isFinite(duracaoExercicioMin) && (duracaoExercicioMin as number) > 0) {
    taxaSudoreseLh = (((perdaHidricaLiquidaMl as number) / (duracaoExercicioMin as number)) * 60) / 1000;
  }

  const classificacao = classifyHydration(perdaPesoPercentual);
  const classificacaoHidrica = toText(
    pick([dados, resultadosOutput, payloadRecord], ['classificacaoHidrica', 'classificacao'])
  ) || classificacao.label;
  const alertLevel = toText(pick([resultadosOutput, payloadRecord], ['alertLevel'])) || classificacao.alertLevel;
  const warnings = asArray(pick([resultadosOutput, dados, payloadRecord], ['warnings']))
    .map((item) => toText(item))
    .filter(Boolean);

  const normalizedDados = compact({
    ...dados,
    pesoAntesExercicio: round(pesoAntesExercicio, 3),
    pesoAposExercicio: round(pesoAposExercicio, 3),
    duracaoExercicioMin: round(duracaoExercicioMin, 2),
    volumeIngeridoMl: round(volumeIngeridoMl, 2),
    volumeUrinarioMl: round(volumeUrinarioMl, 2),
    modalidade: modalidade || undefined,
    temperaturaAmbiente: round(temperaturaAmbiente, 2),
    observacoes: observacoes || undefined,
    perdaPesoAbsolutaKg: round(perdaPesoAbsolutaKg, 3),
    perdaPesoPercentual: round(perdaPesoPercentual, 2),
    perdaHidricaLiquidaMl: round(perdaHidricaLiquidaMl, 0),
    taxaSudoreseLh: round(taxaSudoreseLh, 2),
    classificacaoHidrica,
    input: compact({
      ...input,
      pesoAntesExercicio: round(pesoAntesExercicio, 3),
      pesoAposExercicio: round(pesoAposExercicio, 3),
      duracaoExercicioMin: round(duracaoExercicioMin, 2),
      volumeIngeridoMl: round(volumeIngeridoMl, 2),
      volumeUrinarioMl: round(volumeUrinarioMl, 2),
      modalidade: modalidade || undefined,
      temperaturaAmbiente: round(temperaturaAmbiente, 2),
      observacoes: observacoes || undefined
    }),
    source: compact({
      ...asRecord(dados.source),
      mode: toText(pick([asRecord(dados.source), payloadRecord], ['mode'])) || 'manual'
    })
  });

  const normalizedResultados = compact({
    ...resultados,
    perdaPesoAbsolutaKg: round(perdaPesoAbsolutaKg, 3),
    perdaPesoPercentual: round(perdaPesoPercentual, 2),
    perdaHidricaLiquidaMl: round(perdaHidricaLiquidaMl, 0),
    taxaSudoreseLh: round(taxaSudoreseLh, 2),
    calculated: compact({
      ...resultadosCalculated,
      perdaPesoAbsolutaKg: round(perdaPesoAbsolutaKg, 3),
      perdaPesoPercentual: round(perdaPesoPercentual, 2),
      perdaHidricaLiquidaMl: round(perdaHidricaLiquidaMl, 0),
      taxaSudoreseLh: round(taxaSudoreseLh, 2)
    }),
    output: compact({
      ...resultadosOutput,
      classificacaoHidrica,
      alertLevel,
      warnings
    })
  });

  return {
    ...payload,
    dados: normalizedDados,
    resultados: normalizedResultados,
    classificacao: toText(payload.classificacao) || classificacaoHidrica,
    classificacaoLabel: toText(payload.classificacaoLabel) || classificacaoHidrica,
    formulaId: toText(payload.formulaId) || 'hidratacao_balanco_hidrico',
    formulaVersion: toText(payload.formulaVersion) || '1.0.0'
  };
};
