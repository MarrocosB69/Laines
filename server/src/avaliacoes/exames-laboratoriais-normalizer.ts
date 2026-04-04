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

const asArray = (value: unknown): unknown[] => {
  if (!Array.isArray(value)) return [];
  return value;
};

const compact = (record: JsonRecord): JsonRecord => {
  const output: JsonRecord = {};
  Object.entries(record).forEach(([key, value]) => {
    if (value === undefined) return;
    output[key] = value;
  });
  return output;
};

const clampPercentage = (value: number) => Math.max(0, Math.min(100, value));

const normalizeStatusByRange = (value: number | null, refMin: number | null, refMax: number | null) => {
  if (!Number.isFinite(value)) return 'sem_dado';
  const numeric = value as number;

  if (Number.isFinite(refMin) && numeric < (refMin as number)) return 'alterado';
  if (Number.isFinite(refMax) && numeric > (refMax as number)) return 'alterado';

  if (Number.isFinite(refMin) && Number.isFinite(refMax) && (refMax as number) > (refMin as number)) {
    const span = (refMax as number) - (refMin as number);
    const margin = span * 0.05;
    if (numeric <= (refMin as number) + margin || numeric >= (refMax as number) - margin) {
      return 'limitrofe';
    }
    return 'normal';
  }

  if (Number.isFinite(refMin) || Number.isFinite(refMax)) {
    return 'normal';
  }
  return 'sem_referencia';
};

type PayloadShape = {
  tipo?: string;
  dados?: JsonRecord;
  resultados?: JsonRecord;
  registros?: unknown[];
  formulaId?: string;
  formulaVersion?: string;
  classificacao?: string;
  classificacaoLabel?: string;
};

export const normalizeExamesLaboratoriaisPayload = <T extends PayloadShape>(payload: T): T => {
  if (normalizeType(payload?.tipo) !== 'exames_laboratoriais') {
    return payload;
  }

  const dados = asRecord(payload.dados);
  const resultados = asRecord(payload.resultados);
  const canonicalDadosBrutos = asRecord(dados.dados_brutos);

  const sourcePanel = toText(
    canonicalDadosBrutos.painel
    || dados.painel
    || 'geral'
  ) || 'geral';

  const sourceAnalitos = asArray(
    canonicalDadosBrutos.analitos
    || dados.analitos
    || payload.registros
    || dados.registros
  );

  const normalizedAnalitos = sourceAnalitos
    .map((item, index) => {
      const row = asRecord(item);
      const nome = toText(row.nome || row.analito || row.nomeAnalito || `analito_${index + 1}`);
      const valor = toNumber(row.valor ?? row.value ?? row.resultado);
      const unidade = toText(row.unidade || row.unit || '');
      const referenciaMin = toNumber(row.referenciaMin ?? row.refMin ?? row.valorRefMin);
      const referenciaMax = toNumber(row.referenciaMax ?? row.refMax ?? row.valorRefMax);
      const dataColeta = toText(row.dataColeta || row.data || row.measuredAt || '');
      const laboratorio = toText(row.laboratorio || row.lab || '');
      const status = normalizeStatusByRange(valor, referenciaMin, referenciaMax);
      return compact({
        id: toText(row.id || `${Date.now()}-${index}`),
        nome,
        valor,
        unidade: unidade || undefined,
        referenciaMin,
        referenciaMax,
        dataColeta: dataColeta || undefined,
        laboratorio: laboratorio || undefined,
        status
      });
    })
    .filter((item) => Boolean(item.nome));

  const statusPorAnalito = normalizedAnalitos.reduce<Record<string, string>>((acc, item) => {
    const nome = toText(item.nome);
    const status = toText(item.status) || 'sem_dado';
    if (nome) acc[nome] = status;
    return acc;
  }, {});

  const alteracoesCount = normalizedAnalitos.filter((item) => toText(item.status) === 'alterado').length;
  const limitesCount = normalizedAnalitos.filter((item) => toText(item.status) === 'limitrofe').length;
  const normaisCount = normalizedAnalitos.filter((item) => toText(item.status) === 'normal').length;

  const statusPainel = alteracoesCount > 0
    ? 'alterado'
    : limitesCount > 0
      ? 'limitrofe'
      : normaisCount > 0
        ? 'normal'
        : 'sem_classificacao';

  const scoreRisco = clampPercentage(((alteracoesCount * 2) + limitesCount) * 10);

  const canonicalResultadosCalculados = compact({
    alteracoesCount,
    limitesCount,
    normaisCount,
    scoreRisco,
    variacoes: asArray(asRecord(dados.comparacao).variacoes)
  });

  const canonicalClassificacoes = compact({
    statusPainel,
    statusPorAnalito
  });

  const metadadosFormula = compact({
    formulaId: toText(payload.formulaId) || 'lab_ref_range_v1',
    formulaVersion: toText(payload.formulaVersion) || '1.0.0'
  });

  const classificacao = toText(payload.classificacao) || statusPainel;
  const classificacaoLabel = toText(payload.classificacaoLabel) || statusPainel;

  const normalizedDados = compact({
    ...dados,
    painel: sourcePanel,
    analitos: normalizedAnalitos,
    dados_brutos: compact({
      ...canonicalDadosBrutos,
      painel: sourcePanel,
      analitos: normalizedAnalitos
    }),
    resultados_calculados: canonicalResultadosCalculados,
    classificacoes: canonicalClassificacoes,
    metadados_formula: metadadosFormula
  });

  const normalizedResultados = compact({
    ...resultados,
    calculated: compact({
      ...asRecord(resultados.calculated),
      ...canonicalResultadosCalculados
    }),
    output: compact({
      ...asRecord(resultados.output),
      statusPainel,
      statusPorAnalito
    })
  });

  return {
    ...payload,
    dados: normalizedDados,
    resultados: normalizedResultados,
    registros: normalizedAnalitos,
    formulaId: metadadosFormula.formulaId as string,
    formulaVersion: metadadosFormula.formulaVersion as string,
    classificacao,
    classificacaoLabel
  };
};
