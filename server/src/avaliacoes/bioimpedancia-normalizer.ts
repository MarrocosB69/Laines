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
    if (value === undefined) return;
    output[key] = value;
  });
  return output;
};

const classifyBodyFat = (percentualGordura: number | null): string => {
  if (!Number.isFinite(percentualGordura)) return 'Sem classificacao';
  if ((percentualGordura as number) < 10) return 'Muito baixo';
  if ((percentualGordura as number) < 20) return 'Adequado';
  if ((percentualGordura as number) < 30) return 'Atencao';
  return 'Elevado';
};

type PayloadShape = {
  tipo?: string;
  dados?: JsonRecord;
  resultados?: JsonRecord;
  classificacao?: string;
  classificacaoLabel?: string;
};

export const normalizeBioimpedanciaPayload = <T extends PayloadShape>(payload: T): T => {
  if (normalizeType(payload?.tipo) !== 'bioimpedancia') {
    return payload;
  }

  const dados = (payload.dados || {}) as JsonRecord;
  const resultados = (payload.resultados || {}) as JsonRecord;
  const sources = [dados, resultados, payload as unknown as JsonRecord];

  const percentualGordura = toNumber(pick(sources, ['percentual_gordura', 'percentualGordura']));
  const pesoTotal = toNumber(pick(sources, ['peso', 'peso_total', 'pesoTotal', 'weight']));
  const pesoGorduraRaw = toNumber(pick(sources, ['peso_gordura', 'pesoGordura', 'massaGorda']));
  const pesoGordura = Number.isFinite(pesoGorduraRaw)
    ? pesoGorduraRaw
    : (Number.isFinite(percentualGordura) && Number.isFinite(pesoTotal)
      ? ((percentualGordura as number) / 100) * (pesoTotal as number)
      : null);
  const massaMagra = toNumber(pick(sources, ['massa_magra', 'massaMagra']));
  const taxaMetabolicaBasal = toNumber(pick(sources, ['taxa_metabolica_basal', 'taxaMetabolicaBasal', 'tmb']));
  const aguaTotal = toNumber(pick(sources, ['agua_total', 'aguaTotal', 'aguaCorporal']));
  const bioresistencia = toNumber(pick(sources, ['bioresistencia', 'bioresistencia_ohms', 'bioResistencia']));
  const reatancia = toNumber(pick(sources, ['reatancia', 'reatancia_ohms', 'reactancia']));
  const alvoPercentualGordura = toNumber(pick(sources, ['alvo_percentual_gordura', 'alvoPercentualGordura']));
  const alvoPesoGordura = toNumber(pick(sources, ['alvo_peso_gordura', 'alvoPesoGordura']));
  const alvoPesoTotal = toNumber(pick(sources, ['alvo_peso_total', 'alvoPesoTotal']));
  const idade = toNumber(pick(sources, ['idade']));
  const sexo = toText(pick(sources, ['sexo', 'genero', 'sex'])) || '';

  let percentualAguaPesoCorporal = toNumber(
    pick(sources, ['percentual_agua_peso_corporal', 'percentualAguaPesoCorporal'])
  );
  if (!Number.isFinite(percentualAguaPesoCorporal) && Number.isFinite(aguaTotal) && Number.isFinite(pesoTotal) && (pesoTotal as number) > 0) {
    percentualAguaPesoCorporal = ((aguaTotal as number) / (pesoTotal as number)) * 100;
  }

  let percentualAguaMassaMagra = toNumber(
    pick(sources, ['percentual_agua_massa_magra', 'percentualAguaMassaMagra'])
  );
  if (!Number.isFinite(percentualAguaMassaMagra) && Number.isFinite(aguaTotal) && Number.isFinite(massaMagra) && (massaMagra as number) > 0) {
    percentualAguaMassaMagra = ((aguaTotal as number) / (massaMagra as number)) * 100;
  }

  const classificacao = toText(payload.classificacao) || classifyBodyFat(percentualGordura);
  const classificacaoLabel = toText(payload.classificacaoLabel) || classificacao;

  const normalizedDados = compact({
    ...dados,
    percentualGordura,
    percentual_gordura: percentualGordura,
    pesoGordura,
    peso_gordura: pesoGordura,
    massaGorda: pesoGordura,
    massaMagra,
    massa_magra: massaMagra,
    taxaMetabolicaBasal,
    taxa_metabolica_basal: taxaMetabolicaBasal,
    tmb: taxaMetabolicaBasal,
    aguaTotal,
    agua_total: aguaTotal,
    aguaCorporal: aguaTotal,
    percentualAguaPesoCorporal,
    percentual_agua_peso_corporal: percentualAguaPesoCorporal,
    percentualAguaMassaMagra,
    percentual_agua_massa_magra: percentualAguaMassaMagra,
    bioresistencia,
    reatancia,
    alvoPercentualGordura,
    alvo_percentual_gordura: alvoPercentualGordura,
    alvoPesoGordura,
    alvo_peso_gordura: alvoPesoGordura,
    alvoPesoTotal,
    alvo_peso_total: alvoPesoTotal,
    sexo,
    idade
  });

  const normalizedResultados = compact({
    ...resultados,
    percentualGordura,
    percentual_gordura: percentualGordura,
    pesoGordura,
    peso_gordura: pesoGordura,
    massaMagra,
    massa_magra: massaMagra,
    aguaTotal,
    agua_total: aguaTotal,
    percentualAguaPesoCorporal,
    percentual_agua_peso_corporal: percentualAguaPesoCorporal,
    percentualAguaMassaMagra,
    percentual_agua_massa_magra: percentualAguaMassaMagra,
    taxaMetabolicaBasal,
    taxa_metabolica_basal: taxaMetabolicaBasal,
    tmb: taxaMetabolicaBasal,
    bioresistencia,
    reatancia,
    alvoPercentualGordura,
    alvo_percentual_gordura: alvoPercentualGordura,
    alvoPesoGordura,
    alvo_peso_gordura: alvoPesoGordura,
    alvoPesoTotal,
    alvo_peso_total: alvoPesoTotal,
    classificacaoGordura: classificacao
  });

  return {
    ...payload,
    dados: normalizedDados,
    resultados: normalizedResultados,
    classificacao,
    classificacaoLabel
  };
};

