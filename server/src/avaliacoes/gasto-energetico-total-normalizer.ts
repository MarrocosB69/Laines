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

const toBoolean = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') return value;
  const token = String(value || '').trim().toLowerCase();
  if (!token) return null;
  if (['true', '1', 'sim', 'yes'].includes(token)) return true;
  if (['false', '0', 'nao', 'não', 'no'].includes(token)) return false;
  return null;
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

export const normalizeGastoEnergeticoTotalPayload = <T extends PayloadShape>(payload: T): T => {
  if (normalizeType(payload?.tipo) !== 'gasto_energetico_total') {
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

  let tmbBaseKcal = toNumber(pick(valueSources, ['tmbBaseKcal', 'tmb_base_kcal', 'tmb_kcal', 'tmb']));
  const fatorAtividade = toNumber(pick(valueSources, ['fatorAtividade', 'fator_atividade', 'activityFactor']));
  let getEstimadoKcal = toNumber(pick(valueSources, ['getEstimadoKcal', 'get_estimado_kcal', 'get_kcal', 'getKcal']));

  if (!Number.isFinite(tmbBaseKcal)) {
    tmbBaseKcal = toNumber(pick(valueSources, ['tmb_manual_kcal', 'manualTmbKcal']));
  }
  if (!Number.isFinite(getEstimadoKcal) && Number.isFinite(tmbBaseKcal) && Number.isFinite(fatorAtividade)) {
    getEstimadoKcal = Math.round((tmbBaseKcal as number) * (fatorAtividade as number));
  }

  const manutencaoKcal = toNumber(pick(valueSources, ['manutencaoKcal', 'manutencao_kcal']));
  const emagrecimentoLeveKcal = toNumber(pick(valueSources, ['emagrecimentoLeveKcal', 'emagrecimento_leve_kcal']));
  const emagrecimentoModeradoKcal = toNumber(pick(valueSources, ['emagrecimentoModeradoKcal', 'emagrecimento_moderado_kcal']));
  const emagrecimentoIntensoKcal = toNumber(pick(valueSources, ['emagrecimentoIntensoKcal', 'emagrecimento_intenso_kcal']));
  const hipertrofiaMinKcal = toNumber(pick(valueSources, ['hipertrofiaMinKcal', 'hipertrofia_min_kcal']));
  const hipertrofiaMaxKcal = toNumber(pick(valueSources, ['hipertrofiaMaxKcal', 'hipertrofia_max_kcal']));

  const sexo = toText(pick(valueSources, ['sexo', 'sex']));
  const nivelAtividade = toText(pick(valueSources, ['nivel_atividade', 'activityLevel'])) || 'sedentario';
  const fatorAtividadePersonalizado = toNumber(pick(valueSources, ['fator_atividade_personalizado', 'customActivityFactor']));
  const tmbManualKcal = toNumber(pick(valueSources, ['tmb_manual_kcal', 'manualTmbKcal']));
  const alertaIngestaoIntensa = toBoolean(pick(valueSources, ['alertaIngestaoIntensa', 'alerta_ingestao_intensa']));
  const referenciaSeguranca = toText(pick(valueSources, ['referenciaSeguranca', 'referencia_seguranca']));

  const formulaId = toText(payload.formulaId)
    || toText(pick([canonicalMetadadosFormula], ['formulaId', 'formula_id']))
    || 'mifflin_st_jeor_1990';
  const formulaVersion = toText(payload.formulaVersion)
    || toText(pick([canonicalMetadadosFormula], ['formulaVersion', 'formula_version']))
    || '1.0.0';

  const normalizedDadosBrutos = compact({
    ...canonicalDadosBrutos,
    activityLevel: nivelAtividade || undefined,
    customActivityFactor: fatorAtividadePersonalizado,
    manualTmbKcal: tmbManualKcal,
    sexo: sexo || undefined
  });

  const normalizedResultadosCalculados = compact({
    ...canonicalResultadosCalculados,
    tmbBaseKcal,
    tmb_base_kcal: tmbBaseKcal,
    fatorAtividade,
    fator_atividade: fatorAtividade,
    getEstimadoKcal,
    get_estimado_kcal: getEstimadoKcal,
    manutencaoKcal,
    manutencao_kcal: manutencaoKcal,
    emagrecimentoLeveKcal,
    emagrecimento_leve_kcal: emagrecimentoLeveKcal,
    emagrecimentoModeradoKcal,
    emagrecimento_moderado_kcal: emagrecimentoModeradoKcal,
    emagrecimentoIntensoKcal,
    emagrecimento_intenso_kcal: emagrecimentoIntensoKcal,
    hipertrofiaMinKcal,
    hipertrofia_min_kcal: hipertrofiaMinKcal,
    hipertrofiaMaxKcal,
    hipertrofia_max_kcal: hipertrofiaMaxKcal
  });

  const normalizedClassificacoes = compact({
    ...canonicalClassificacoes,
    alertaIngestaoIntensa: alertaIngestaoIntensa === null ? undefined : alertaIngestaoIntensa,
    referenciaSeguranca: referenciaSeguranca || undefined
  });

  const normalizedMetadadosFormula = compact({
    ...canonicalMetadadosFormula,
    formulaId,
    formulaVersion
  });

  const normalizedDados = compact({
    ...dados,
    sexo: sexo || undefined,
    nivel_atividade: nivelAtividade || undefined,
    fator_atividade_personalizado: fatorAtividadePersonalizado,
    tmb_manual_kcal: tmbManualKcal,
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
    tmb_kcal: tmbBaseKcal,
    fator_atividade: fatorAtividade,
    get_kcal: getEstimadoKcal,
    calculated: compact({
      ...asRecord(resultados.calculated),
      tmbBaseKcal,
      fatorAtividade,
      getEstimadoKcal,
      manutencaoKcal,
      emagrecimentoLeveKcal,
      emagrecimentoModeradoKcal,
      emagrecimentoIntensoKcal,
      hipertrofiaMinKcal,
      hipertrofiaMaxKcal
    }),
    output: compact({
      ...asRecord(resultados.output),
      alertaIngestaoIntensa: alertaIngestaoIntensa === null ? undefined : alertaIngestaoIntensa,
      referenciaSeguranca: referenciaSeguranca || undefined
    }),
    comparacao: compact({
      ...canonicalComparacao
    })
  });

  const classificacao = toText(payload.classificacao)
    || (alertaIngestaoIntensa === true ? 'alerta_ingestao_intensa' : '');
  const classificacaoLabel = toText(payload.classificacaoLabel)
    || (alertaIngestaoIntensa === true ? 'Alerta de ingestao intensa' : '');

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
