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

const clampScore = (value: number) => Math.max(0, Math.min(100, value));

const toResponseScore = (value: number | null) => {
  if (!Number.isFinite(value)) return null;
  return clampScore(((value as number) - 1) * 25);
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

export const normalizeEvolucaoRetornoPayload = <T extends PayloadShape>(payload: T): T => {
  if (normalizeType(payload?.tipo) !== 'evolucao_retorno') {
    return payload;
  }

  const dados = asRecord(payload.dados);
  const resultados = asRecord(payload.resultados);
  const canonicalDadosBrutos = asRecord(dados.dados_brutos);
  const canonicalResultadosCalculados = asRecord(dados.resultados_calculados);
  const canonicalClassificacoes = asRecord(dados.classificacoes);
  const canonicalMetadadosFormula = asRecord(dados.metadados_formula);

  const adesaoPlanoAlimentar = toNumber(
    canonicalDadosBrutos.adesaoPlanoAlimentar
    ?? dados.adesaoPlanoAlimentar
    ?? asRecord(dados.input).adesaoPlanoAlimentar
  );
  const adesaoAtividadeFisica = toNumber(
    canonicalDadosBrutos.adesaoAtividadeFisica
    ?? dados.adesaoAtividadeFisica
    ?? asRecord(dados.input).adesaoAtividadeFisica
  );
  const respostaPercebida = toNumber(
    canonicalDadosBrutos.respostaPercebida
    ?? dados.respostaPercebida
    ?? asRecord(dados.input).respostaPercebida
  );
  const intercorrencias = toText(
    canonicalDadosBrutos.intercorrencias
    || dados.intercorrencias
    || asRecord(dados.input).intercorrencias
  );
  const sintomas = toText(
    canonicalDadosBrutos.sintomas
    || dados.sintomas
    || asRecord(dados.input).sintomas
  );
  const conduta = toText(
    canonicalDadosBrutos.conduta
    || dados.conduta
    || asRecord(dados.input).conduta
  );
  const proximaAvaliacao = toText(
    canonicalDadosBrutos.proximaAvaliacao
    || dados.proximaAvaliacao
    || asRecord(dados.input).proximaAvaliacao
  );

  const responseScore = toResponseScore(respostaPercebida);

  const computedScore = clampScore(
    ((Number.isFinite(adesaoPlanoAlimentar) ? (adesaoPlanoAlimentar as number) : 0) * 0.5)
    + ((Number.isFinite(adesaoAtividadeFisica) ? (adesaoAtividadeFisica as number) : 0) * 0.35)
    + ((Number.isFinite(responseScore) ? (responseScore as number) : 0) * 0.15)
  );

  const scoreAdesaoGeral = toNumber(canonicalResultadosCalculados.scoreAdesaoGeral) ?? computedScore;

  const redSignal = intercorrencias.length >= 15 || sintomas.length >= 15;
  const prioridadeRetorno = scoreAdesaoGeral < 50 || redSignal
    ? 'alta'
    : scoreAdesaoGeral < 75
      ? 'moderada'
      : 'baixa';

  const resumoObjetivos = asArray(canonicalResultadosCalculados.resumoObjetivos).length
    ? asArray(canonicalResultadosCalculados.resumoObjetivos)
    : [
      compact({
        objetivo: 'Plano atual',
        status: scoreAdesaoGeral >= 75 ? 'melhora' : scoreAdesaoGeral >= 50 ? 'estavel' : 'piora',
        justificativa: prioridadeRetorno === 'alta'
          ? 'Baixa adesao ou intercorrencias relevantes.'
          : prioridadeRetorno === 'moderada'
            ? 'Adesao parcial, manter monitoramento proximo.'
            : 'Boa adesao global e resposta favoravel.'
      })
    ];

  const metadadosFormula = compact({
    ...canonicalMetadadosFormula,
    formulaId: toText(payload.formulaId) || toText(canonicalMetadadosFormula.formulaId) || 'evolucao_adesao_score_v1',
    formulaVersion: toText(payload.formulaVersion) || toText(canonicalMetadadosFormula.formulaVersion) || '1.0.0'
  });

  const classificacao = toText(payload.classificacao) || prioridadeRetorno;
  const classificacaoLabel = toText(payload.classificacaoLabel) || `Prioridade ${prioridadeRetorno}`;

  const normalizedDados = compact({
    ...dados,
    dados_brutos: compact({
      ...canonicalDadosBrutos,
      adesaoPlanoAlimentar,
      adesaoAtividadeFisica,
      respostaPercebida,
      intercorrencias: intercorrencias || undefined,
      sintomas: sintomas || undefined,
      conduta: conduta || undefined,
      proximaAvaliacao: proximaAvaliacao || undefined
    }),
    resultados_calculados: compact({
      ...canonicalResultadosCalculados,
      scoreAdesaoGeral,
      resumoObjetivos
    }),
    classificacoes: compact({
      ...canonicalClassificacoes,
      prioridadeRetorno
    }),
    metadados_formula: metadadosFormula
  });

  const normalizedResultados = compact({
    ...resultados,
    score_adesao_geral: scoreAdesaoGeral,
    prioridade_cuidado: prioridadeRetorno,
    calculated: compact({
      ...asRecord(resultados.calculated),
      scoreAdesaoGeral,
      resumoObjetivos
    }),
    output: compact({
      ...asRecord(resultados.output),
      prioridadeRetorno
    })
  });

  return {
    ...payload,
    dados: normalizedDados,
    resultados: normalizedResultados,
    formulaId: metadadosFormula.formulaId as string,
    formulaVersion: metadadosFormula.formulaVersion as string,
    classificacao,
    classificacaoLabel
  };
};
