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

const fixed = (value: number | null, digits: number): number | null => (
  Number.isFinite(value) ? Number((value as number).toFixed(digits)) : null
);

// % de gordura YMCA recalculado aqui a partir de cintura, peso e sexo, com a
// mesma regra do cliente (calculationEngine.js; WI-013, decisão 1). A equação
// original é em polegadas e libras. Fora de 2 a 70% o valor fica nulo; o valor
// enviado pelo cliente não é mais gravado como veio.
const YMCA_FAIXA_PLAUSIVEL = { min: 2, max: 70 };
const YMCA_FORA_DA_FAIXA = 'Fora da faixa plausível (2 a 70%). Verifique cintura e peso.';

const normalizeSexo = (value: unknown): 'male' | 'female' | null => {
  const token = toText(value).toLowerCase();
  if (!token) return null;
  if (token.includes('fem') || token === 'f' || token === 'female') return 'female';
  if (token.includes('masc') || token === 'm' || token === 'male') return 'male';
  return null;
};

const calcularYmca = (
  sexo: 'male' | 'female' | null,
  cinturaCm: number | null,
  pesoKg: number | null
): { valor: number | null; foraDaFaixa: boolean } => {
  if (!sexo || !Number.isFinite(cinturaCm) || (cinturaCm as number) <= 0
    || !Number.isFinite(pesoKg) || (pesoKg as number) <= 0) {
    return { valor: null, foraDaFaixa: false };
  }
  const cinturaPol = (cinturaCm as number) / 2.54;
  const pesoLb = (pesoKg as number) * 2.20462;
  const constante = sexo === 'male' ? -98.42 : -76.76;
  const bruto = ((constante + (4.15 * cinturaPol) - (0.082 * pesoLb)) / pesoLb) * 100;
  if (bruto < YMCA_FAIXA_PLAUSIVEL.min || bruto > YMCA_FAIXA_PLAUSIVEL.max) {
    return { valor: null, foraDaFaixa: true };
  }
  return { valor: bruto, foraDaFaixa: false };
};

// Mesmos rótulos e cortes de ymcaBodyFatClassification no cliente.
const classificarYmca = (
  sexo: 'male' | 'female' | null,
  valor: number | null,
  foraDaFaixa: boolean
): string => {
  if (foraDaFaixa) return YMCA_FORA_DA_FAIXA;
  if (!Number.isFinite(valor) || !sexo) return 'Sem classificacao YMCA';
  const percentual = valor as number;
  const [baixo, adequado, atencao] = sexo === 'male' ? [10, 20, 25] : [18, 30, 35];
  if (percentual < baixo) return 'Baixo % gordura estimado';
  if (percentual < adequado) return 'Adequado';
  if (percentual < atencao) return 'Atencao';
  return 'Elevado';
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

export const normalizePerimetrosPayload = <T extends PayloadShape>(payload: T): T => {
  if (normalizeType(payload?.tipo) !== 'perimetros') {
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

  const peso = toNumber(pick(valueSources, ['peso', 'peso_kg', 'weight', 'weightKg']));
  let estaturaM = toNumber(pick(valueSources, ['estatura', 'estatura_m', 'heightM']));
  let estaturaCm = toNumber(pick(valueSources, ['estatura_cm', 'altura', 'height', 'estaturaCm']));
  if (!Number.isFinite(estaturaM) && Number.isFinite(estaturaCm)) {
    estaturaM = fixed((estaturaCm as number) / 100, 4);
  }
  if (!Number.isFinite(estaturaCm) && Number.isFinite(estaturaM)) {
    estaturaCm = fixed((estaturaM as number) * 100, 1);
  }

  const cinturaCm = toNumber(pick(valueSources, ['cintura', 'cintura_cm', 'cinturaCm']));
  const quadrilCm = toNumber(pick(valueSources, ['quadril', 'quadril_cm', 'quadrilCm']));
  const pescocoCm = toNumber(pick(valueSources, ['pescoco', 'pescoco_cm', 'pescocoCm']));
  const focoCardiometabolico = toBoolean(pick(valueSources, ['foco_cardiometabolico', 'focoCardiometabolico']));

  const imc = toNumber(pick(valueSources, ['imc']));
  const rcq = toNumber(pick(valueSources, ['rcq']));
  const indiceCinturaEstatura = toNumber(pick(valueSources, ['indice_cintura_estatura', 'indiceCinturaEstatura', 'ice']));
  const indiceConicidade = toNumber(pick(valueSources, ['indice_conicidade', 'indiceConicidade', 'conicity']));
  const sexo = normalizeSexo(pick(valueSources, ['sexo', 'sex']));
  const ymca = calcularYmca(sexo, cinturaCm, peso);
  const percentualGorduraYmca = fixed(ymca.valor, 2);
  const classificacaoYmca = classificarYmca(sexo, ymca.valor, ymca.foraDaFaixa);
  const areaSuperficieCorporal = toNumber(pick(valueSources, ['area_superficie_corporal', 'areaSuperficieCorporal']));
  const riscoCintura = toText(pick(valueSources, ['risco_cintura', 'riscoCintura', 'classificacaoCintura']));
  const tmbSelecionada = toNumber(pick(valueSources, ['tmbSelecionada', 'tmbSelecionadaKcal', 'tmb_kcal']));
  const esportivo = asRecord(pick(valueSources, ['esportivo']));

  const formulaId = toText(payload.formulaId)
    || toText(pick([canonicalMetadadosFormula], ['formulaId', 'formula_id']));
  const formulaVersion = toText(payload.formulaVersion)
    || toText(pick([canonicalMetadadosFormula], ['formulaVersion', 'formula_version']));

  const normalizedDadosBrutos = compact({
    ...canonicalDadosBrutos,
    pesoKg: peso,
    estaturaCm: estaturaCm,
    cinturaCm: cinturaCm,
    quadrilCm: quadrilCm,
    pescocoCm: pescocoCm,
    focoCardiometabolico: focoCardiometabolico === null ? undefined : focoCardiometabolico,
    esportivo: Object.keys(esportivo).length ? esportivo : undefined
  });

  const normalizedResultadosCalculados = compact({
    ...canonicalResultadosCalculados,
    imc,
    rcq,
    indiceCinturaEstatura,
    indice_cintura_estatura: indiceCinturaEstatura,
    indiceConicidade,
    indice_conicidade: indiceConicidade,
    percentualGorduraYmca,
    percentual_gordura_ymca: percentualGorduraYmca,
    areaSuperficieCorporal,
    area_superficie_corporal: areaSuperficieCorporal,
    tmbSelecionada
  });

  const normalizedClassificacoes = compact({
    ...canonicalClassificacoes,
    cintura: toText(pick([canonicalClassificacoes], ['cintura', 'classificacaoCintura'])) || undefined,
    imc: toText(pick([canonicalClassificacoes], ['imc', 'classificacaoImc'])) || undefined,
    rcq: toText(pick([canonicalClassificacoes], ['rcq', 'classificacaoRcq'])) || undefined,
    ice: toText(pick([canonicalClassificacoes], ['ice', 'classificacaoIce'])) || undefined,
    conicidade: toText(pick([canonicalClassificacoes], ['conicidade', 'classificacaoConicidade'])) || undefined,
    ymca: classificacaoYmca,
    classificacaoYmca: Object.prototype.hasOwnProperty.call(canonicalClassificacoes, 'classificacaoYmca')
      ? classificacaoYmca
      : undefined
  });

  const normalizedMetadadosFormula = compact({
    ...canonicalMetadadosFormula,
    formulaId: formulaId || undefined,
    formulaVersion: formulaVersion || undefined
  });

  const normalizedDados = compact({
    ...dados,
    peso,
    peso_kg: peso,
    estatura: estaturaM,
    estatura_m: estaturaM,
    estatura_cm: estaturaCm,
    cintura: cinturaCm,
    cintura_cm: cinturaCm,
    quadril: quadrilCm,
    quadril_cm: quadrilCm,
    pescoco: pescocoCm,
    pescoco_cm: pescocoCm,
    foco_cardiometabolico: focoCardiometabolico === null ? undefined : focoCardiometabolico,
    imc,
    rcq,
    indice_cintura_estatura: indiceCinturaEstatura,
    indice_conicidade: indiceConicidade,
    percentual_gordura_ymca: percentualGorduraYmca,
    area_superficie_corporal: areaSuperficieCorporal,
    risco_cintura: riscoCintura || undefined,
    esportivo: Object.keys(esportivo).length ? esportivo : undefined,
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
    imc,
    rcq,
    indice_cintura_estatura: indiceCinturaEstatura,
    indice_conicidade: indiceConicidade,
    percentual_gordura_ymca: percentualGorduraYmca,
    area_superficie_corporal: areaSuperficieCorporal,
    risco_cintura: riscoCintura || undefined,
    tmbSelecionada: tmbSelecionada ?? undefined,
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

  const classificacao = toText(payload.classificacao)
    || toText(pick([normalizedClassificacoes], ['imc', 'cintura']));
  const classificacaoLabel = toText(payload.classificacaoLabel)
    || toText(pick([normalizedClassificacoes], ['imc', 'cintura']));

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
