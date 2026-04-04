type JsonRecord = Record<string, unknown>;

const NOVA_CATEGORIES = ['in_natura', 'minimamente_processados', 'processados', 'ultraprocessados'] as const;
type NovaCategoryKey = (typeof NOVA_CATEGORIES)[number];

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

const normalizeOrigin = (value: unknown): string => {
  const token = toText(value).toLowerCase();
  if (token === 'questnova') return 'questnova';
  if (token === 'importacao') return 'importacao';
  return 'manual';
};

const normalizeNovaCategoryKey = (value: unknown): NovaCategoryKey | null => {
  const token = String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s-]+/g, '_');

  if (!token) return null;
  if (token === 'in_natura' || token === 'innatura') return 'in_natura';
  if (token === 'minimamente_processados' || token === 'minimamenteprocessados') return 'minimamente_processados';
  if (token === 'processados') return 'processados';
  if (token === 'ultraprocessados' || token === 'ultra_processados') return 'ultraprocessados';
  return null;
};

const readCategoryEnergy = (source: JsonRecord, category: NovaCategoryKey): number | null => {
  const direct = toNumber(source[category]);
  if (Number.isFinite(direct)) return direct;
  const nested = asRecord(source[category]);
  return toNumber(nested.energiaTotal ?? nested.kcal ?? nested.value);
};

const classifyNovaPattern = (percentuais: Record<string, number>): string => {
  const ultra = Number(percentuais.ultraprocessados || 0);
  if (ultra < 10) return 'Padrao saudavel';
  if (ultra < 20) return 'Padrao moderado';
  if (ultra < 30) return 'Padrao de risco';
  return 'Padrao de alto risco';
};

const emptyCategories = (): Record<NovaCategoryKey, number> => ({
  in_natura: 0,
  minimamente_processados: 0,
  processados: 0,
  ultraprocessados: 0
});

const fixed = (value: number | null, digits: number): number | null => (
  Number.isFinite(value) ? Number((value as number).toFixed(digits)) : null
);

type PayloadShape = {
  tipo?: string;
  dados?: JsonRecord;
  resultados?: JsonRecord;
  registros?: unknown[];
  totalDiario?: number;
  percentuais?: Record<string, unknown>;
  classificacao?: string;
  classificacaoLabel?: string;
  formulaId?: string;
  formulaVersion?: string;
};

export const normalizeAvaliacaoAlimentarPayload = <T extends PayloadShape>(payload: T): T => {
  if (normalizeType(payload?.tipo) !== 'alimentar') {
    return payload;
  }

  const payloadRecord = asRecord(payload as unknown);
  const dados = asRecord(payload.dados);
  const resultados = asRecord(payload.resultados);

  const input = asRecord(dados.input);
  const resultadosCalculated = asRecord(resultados.calculated);
  const resultadosOutput = asRecord(resultados.output);

  const categoriasSources = [
    asRecord(dados.categorias),
    asRecord(dados.kcalPorGrupo),
    asRecord(input.categorias),
    asRecord(input.kcalPorGrupo),
    asRecord(payloadRecord.categorias),
    asRecord(payloadRecord.kcalPorGrupo)
  ];

  const categorias = emptyCategories();
  NOVA_CATEGORIES.forEach((category) => {
    for (const source of categoriasSources) {
      const rawValue = readCategoryEnergy(source, category);
      if (!Number.isFinite(rawValue)) continue;
      categorias[category] = Number(rawValue);
      break;
    }
  });

  const aliasesByCategory: Record<NovaCategoryKey, string[]> = {
    in_natura: ['kcalInNatura', 'kcal_in_natura'],
    minimamente_processados: ['kcalMinimamenteProcessados', 'kcal_minimamente_processados'],
    processados: ['kcalProcessados', 'kcal_processados'],
    ultraprocessados: ['kcalUltraprocessados', 'kcal_ultraprocessados']
  };

  NOVA_CATEGORIES.forEach((category) => {
    const aliasValue = toNumber(pick([dados, input, payloadRecord], aliasesByCategory[category]));
    if (Number.isFinite(aliasValue)) categorias[category] = Number(aliasValue);
  });

  const registros = [
    ...asArray(payload.registros),
    ...asArray(dados.registros),
    ...asArray(input.registros),
    ...asArray(payloadRecord.registros)
  ];

  if (Object.values(categorias).every((value) => value <= 0) && registros.length > 0) {
    registros.forEach((row) => {
      const item = asRecord(row);
      const category = normalizeNovaCategoryKey(item.categoria || item.category || item.grupo);
      if (!category) return;
      const energia = toNumber(item.energia ?? item.kcal ?? item.calorias ?? item.valorEnergetico);
      if (!Number.isFinite(energia)) return;
      categorias[category] = Number(categorias[category] + (energia as number));
    });
  }

  NOVA_CATEGORIES.forEach((category) => {
    categorias[category] = Number(categorias[category].toFixed(2));
  });

  const totalDiarioCalculado = Number(
    NOVA_CATEGORIES.reduce((sum, key) => sum + Number(categorias[key] || 0), 0).toFixed(2)
  );
  const kcalTotalInformado = toNumber(pick(
    [dados, input, resultadosCalculated, payloadRecord],
    ['kcalTotalInformado', 'kcal_total_informado']
  ));
  const totalDiario = toNumber(pick(
    [dados, resultados, resultadosCalculated, payloadRecord],
    ['totalDiario', 'total_diario']
  ));
  const totalResolved = Number.isFinite(totalDiario)
    ? (totalDiario as number)
    : (Number.isFinite(kcalTotalInformado) && (kcalTotalInformado as number) > 0
      ? (kcalTotalInformado as number)
      : totalDiarioCalculado);
  const inconsistenciaKcal = Number.isFinite(kcalTotalInformado) && (kcalTotalInformado as number) > 0
    ? Number(((kcalTotalInformado as number) - totalDiarioCalculado).toFixed(2))
    : null;

  const percentuais = NOVA_CATEGORIES.reduce<Record<NovaCategoryKey, number>>((acc, key) => {
    if (totalDiarioCalculado <= 0) {
      acc[key] = 0;
      return acc;
    }
    acc[key] = Number(((categorias[key] / totalDiarioCalculado) * 100).toFixed(2));
    return acc;
  }, emptyCategories());

  const percentuaisSobreTotalInformado = NOVA_CATEGORIES.reduce<Record<NovaCategoryKey, number | null>>((acc, key) => {
    if (!Number.isFinite(kcalTotalInformado) || (kcalTotalInformado as number) <= 0) {
      acc[key] = null;
      return acc;
    }
    acc[key] = Number(((categorias[key] / (kcalTotalInformado as number)) * 100).toFixed(2));
    return acc;
  }, {
    in_natura: null,
    minimamente_processados: null,
    processados: null,
    ultraprocessados: null
  });

  const classificacao = toText(payload.classificacao)
    || toText(dados.classificacao)
    || toText(resultadosOutput.classificacao)
    || classifyNovaPattern(percentuais);

  const warnings = asArray(
    pick([dados, resultadosOutput, payloadRecord], ['warnings'])
  ).map((item) => toText(item)).filter(Boolean);

  const origemDados = normalizeOrigin(pick([dados, input, payloadRecord], ['origemDados', 'origem_dados']));
  const fonteExterna = toText(pick([dados, input, payloadRecord], ['fonteExterna', 'fonte_externa']));

  const normalizedDados = compact({
    ...dados,
    categorias,
    kcalPorGrupo: categorias,
    kcalInNatura: categorias.in_natura,
    kcalMinimamenteProcessados: categorias.minimamente_processados,
    kcalProcessados: categorias.processados,
    kcalUltraprocessados: categorias.ultraprocessados,
    totalDiario: fixed(totalResolved, 2),
    totalDiarioCalculado: fixed(totalDiarioCalculado, 2),
    kcalTotalInformado: fixed(kcalTotalInformado, 2),
    inconsistenciaKcal: fixed(inconsistenciaKcal, 2),
    percentuais,
    percentuaisSobreTotalInformado,
    classificacao,
    input: compact({
      ...input,
      categorias,
      kcalInNatura: categorias.in_natura,
      kcalMinimamenteProcessados: categorias.minimamente_processados,
      kcalProcessados: categorias.processados,
      kcalUltraprocessados: categorias.ultraprocessados,
      origemDados,
      fonteExterna: fonteExterna || undefined,
      kcalTotalInformado: fixed(kcalTotalInformado, 2)
    }),
    source: compact({
      ...asRecord(dados.source),
      mode: origemDados,
      system: toText(pick([asRecord(dados.source), payloadRecord], ['sourceSystem', 'system'])) || 'manual',
      externalRef: fonteExterna || undefined
    }),
    warnings
  });

  const normalizedResultados = compact({
    ...resultados,
    totalDiario: fixed(totalResolved, 2),
    percentuais,
    classificacao,
    calculated: compact({
      ...resultadosCalculated,
      totalDiario: fixed(totalResolved, 2),
      totalDiarioCalculado: fixed(totalDiarioCalculado, 2),
      inconsistenciaKcal: fixed(inconsistenciaKcal, 2),
      percentuais,
      percentuaisSobreTotalInformado
    }),
    output: compact({
      ...resultadosOutput,
      classificacao,
      warnings
    })
  });

  const formulaId = toText(payload.formulaId) || 'nova_percentual_distribuicao';
  const formulaVersion = toText(payload.formulaVersion) || '1.0.0';

  return {
    ...payload,
    dados: normalizedDados,
    resultados: normalizedResultados,
    registros: Array.isArray(payload.registros) ? payload.registros : [],
    totalDiario: fixed(totalResolved, 2) ?? payload.totalDiario,
    percentuais: percentuais as Record<string, unknown>,
    classificacao,
    classificacaoLabel: toText(payload.classificacaoLabel) || classificacao,
    formulaId,
    formulaVersion
  };
};
