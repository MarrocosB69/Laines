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

const toTextArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || '').trim())
    .filter(Boolean);
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
  meta?: JsonRecord;
  formulaId?: string;
  formulaVersion?: string;
  classificacao?: string;
  classificacaoLabel?: string;
};

export const normalizeBioimpedanciaPayload = <T extends PayloadShape>(payload: T): T => {
  if (normalizeType(payload?.tipo) !== 'bioimpedancia') {
    return payload;
  }

  const payloadRecord = asRecord(payload as unknown);
  const dados = asRecord(payload.dados);
  const resultados = asRecord(payload.resultados);
  const meta = asRecord(payload.meta);

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
    canonicalDadosBrutos,
    canonicalClassificacoes,
    canonicalMetadadosFormula,
    canonicalComparacao,
    dados,
    resultados,
    payloadRecord
  ];

  const percentualGordura = toNumber(pick(valueSources, ['percentual_gordura', 'percentualGordura', 'percentFat']));
  const pesoTotal = toNumber(pick(valueSources, ['peso', 'peso_total', 'pesoTotal', 'weight', 'weightKg']));
  const pesoGorduraRaw = toNumber(pick(valueSources, ['peso_gordura', 'pesoGordura', 'massaGorda', 'massa_gorda_kg', 'fatMassKg']));
  const pesoGordura = Number.isFinite(pesoGorduraRaw)
    ? pesoGorduraRaw
    : (Number.isFinite(percentualGordura) && Number.isFinite(pesoTotal)
      ? ((percentualGordura as number) / 100) * (pesoTotal as number)
      : null);
  const massaMagra = toNumber(pick(valueSources, ['massa_magra', 'massaMagra', 'massa_magra_kg', 'leanMassKg']));
  const taxaMetabolicaBasal = toNumber(pick(valueSources, ['taxa_metabolica_basal', 'taxaMetabolicaBasal', 'tmb', 'tmb_kcal', 'deviceTmbKcal']));
  const aguaTotal = toNumber(pick(valueSources, ['agua_total', 'aguaTotal', 'aguaCorporal', 'agua_total_l', 'tbwL']));
  const bioresistencia = toNumber(pick(valueSources, ['bioresistencia', 'bioresistencia_ohms', 'bioResistencia', 'resistanceOhm']));
  const reatancia = toNumber(pick(valueSources, ['reatancia', 'reatancia_ohms', 'reactancia', 'reactanceOhm']));
  const alvoPercentualGordura = toNumber(pick(valueSources, ['alvo_percentual_gordura', 'alvoPercentualGordura']));
  const alvoPesoGordura = toNumber(pick(valueSources, ['alvo_peso_gordura', 'alvoPesoGordura']));
  const alvoPesoTotal = toNumber(pick(valueSources, ['alvo_peso_total', 'alvoPesoTotal']));
  const idade = toNumber(pick(valueSources, ['idade', 'ageYears']));
  const sexo = toText(pick(valueSources, ['sexo', 'genero', 'sex']));
  const ffmi = toNumber(pick(valueSources, ['ffmi']));
  const phaseAngle = toNumber(pick(valueSources, ['phaseAngle', 'anguloFase']));
  const ecwIcwRatio = toNumber(pick(valueSources, ['ecwIcwRatio', 'ecw_icw_ratio']));
  const tmbCunningham = toNumber(pick(valueSources, ['tmbCunningham', 'tmb_cunningham']));
  const tmbGuedes = toNumber(pick(valueSources, ['tmbGuedes', 'tmb_guedes']));
  const diffDeviceVsCunningham = toNumber(pick(valueSources, ['diffDeviceVsCunningham', 'diff_device_vs_cunningham']));
  const diffDeviceVsGuedes = toNumber(pick(valueSources, ['diffDeviceVsGuedes', 'diff_device_vs_guedes']));
  const esportivo = asRecord(pick(valueSources, ['esportivo']));

  let percentualAguaPesoCorporal = toNumber(
    pick(valueSources, ['percentual_agua_peso_corporal', 'percentualAguaPesoCorporal'])
  );
  if (!Number.isFinite(percentualAguaPesoCorporal) && Number.isFinite(aguaTotal) && Number.isFinite(pesoTotal) && (pesoTotal as number) > 0) {
    percentualAguaPesoCorporal = ((aguaTotal as number) / (pesoTotal as number)) * 100;
  }

  let percentualAguaMassaMagra = toNumber(
    pick(valueSources, ['percentual_agua_massa_magra', 'percentualAguaMassaMagra'])
  );
  if (!Number.isFinite(percentualAguaMassaMagra) && Number.isFinite(aguaTotal) && Number.isFinite(massaMagra) && (massaMagra as number) > 0) {
    percentualAguaMassaMagra = ((aguaTotal as number) / (massaMagra as number)) * 100;
  }

  const completude = toNumber(pick([dados, meta, payloadRecord], ['completude']));
  const pendencias = toTextArray(pick([dados, meta, payloadRecord], ['pendencias']));

  const formulaId = toText(payload.formulaId) || toText(pick([canonicalMetadadosFormula], ['formulaId', 'formula_id']));
  const formulaVersion = toText(payload.formulaVersion) || toText(pick([canonicalMetadadosFormula], ['formulaVersion', 'formula_version']));

  const classificacao = toText(payload.classificacao)
    || toText(pick([canonicalClassificacoes], ['bodyFat', 'classificacaoGordura']))
    || classifyBodyFat(percentualGordura);
  const classificacaoLabel = toText(payload.classificacaoLabel)
    || toText(pick([canonicalClassificacoes], ['bodyFatClassificacao', 'classificacao']))
    || classificacao;

  const deltaMetaPercentualGordura = Number.isFinite(percentualGordura) && Number.isFinite(alvoPercentualGordura)
    ? (percentualGordura as number) - (alvoPercentualGordura as number)
    : null;

  const normalizedDadosBrutos = compact({
    ...canonicalDadosBrutos,
    percentFat: percentualGordura,
    fatMassKg: pesoGordura,
    leanMassKg: massaMagra,
    tbwL: aguaTotal,
    resistanceOhm: bioresistencia,
    reactanceOhm: reatancia,
    weightKg: pesoTotal,
    ageYears: idade,
    sex: sexo,
    esportivo: Object.keys(esportivo).length ? esportivo : undefined
  });

  const normalizedResultadosCalculados = compact({
    ...canonicalResultadosCalculados,
    percentual_gordura: percentualGordura,
    percentualGordura: percentualGordura,
    massa_gorda_kg: pesoGordura,
    massa_magra_kg: massaMagra,
    massaMagra: massaMagra,
    massa_magra: massaMagra,
    agua_total_l: aguaTotal,
    percentual_agua_peso_corporal: percentualAguaPesoCorporal,
    percentual_agua_massa_magra: percentualAguaMassaMagra,
    tmb_kcal: taxaMetabolicaBasal,
    ffmi,
    phaseAngle,
    ecwIcwRatio,
    tmbCunningham,
    tmbGuedes,
    diffDeviceVsCunningham,
    diffDeviceVsGuedes
  });

  const normalizedClassificacoes = compact({
    ...canonicalClassificacoes,
    bodyFat: classificacao,
    bodyFatClassificacao: classificacaoLabel,
    classificacaoGordura: classificacao
  });

  const normalizedMetadadosFormula = compact({
    ...canonicalMetadadosFormula,
    formulaId: formulaId || undefined,
    formulaVersion: formulaVersion || undefined
  });

  const normalizedComparacao = compact({
    ...canonicalComparacao,
    delta_meta_percentual_gordura: Number.isFinite(deltaMetaPercentualGordura)
      ? Number((deltaMetaPercentualGordura as number).toFixed(2))
      : undefined
  });

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
    idade,
    esportivo: Object.keys(esportivo).length ? esportivo : undefined,
    dados_brutos: normalizedDadosBrutos,
    resultados_calculados: normalizedResultadosCalculados,
    classificacoes: normalizedClassificacoes,
    metadados_formula: normalizedMetadadosFormula,
    comparacao: normalizedComparacao,
    completude: Number.isFinite(completude) ? completude : undefined,
    pendencias: pendencias.length ? pendencias : undefined
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
    classificacaoGordura: classificacao,
    calculated: compact({
      ...asRecord(resultados.calculated),
      percentualGordura,
      percentual_gordura: percentualGordura,
      massaMagra,
      massa_magra: massaMagra,
      ffmi,
      phaseAngle,
      ecwIcwRatio,
      tmbCunningham,
      tmbGuedes,
      diffDeviceVsCunningham,
      diffDeviceVsGuedes
    }),
    output: compact({
      ...asRecord(resultados.output),
      classificacaoGordura: classificacao,
      bodyFatClassificacao: classificacaoLabel
    }),
    comparacao: normalizedComparacao
  });

  return {
    ...payload,
    dados: normalizedDados,
    resultados: normalizedResultados,
    classificacao,
    classificacaoLabel
  };
};
