type JsonRecord = Record<string, unknown>;

const toText = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(String(value).replace(',', '.').trim());
  return Number.isFinite(parsed) ? parsed : null;
};

const toBooleanChoice = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  const token = String(value || '').trim().toLowerCase();
  if (!token) return null;
  if (['sim', 's', 'true', '1', 'yes'].includes(token)) return true;
  if (['nao', 'não', 'n', 'false', '0', 'no'].includes(token)) return false;
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

const compact = (record: JsonRecord): JsonRecord => {
  const output: JsonRecord = {};
  Object.entries(record).forEach(([key, value]) => {
    if (value !== undefined) output[key] = value;
  });
  return output;
};

type EbiaClassification = {
  code: string;
  label: string;
  min: number;
  max: number;
};

const EBIA_RANGES: {
  comMenores: EbiaClassification[];
  semMenores: EbiaClassification[];
} = {
  comMenores: [
    { code: 'SA', label: 'Seguranca Alimentar', min: 0, max: 0 },
    { code: 'IL', label: 'Inseguranca Alimentar Leve', min: 1, max: 5 },
    { code: 'IM', label: 'Inseguranca Alimentar Moderada', min: 6, max: 9 },
    { code: 'IG', label: 'Inseguranca Alimentar Grave', min: 10, max: 14 }
  ],
  semMenores: [
    { code: 'SA', label: 'Seguranca Alimentar', min: 0, max: 0 },
    { code: 'IL', label: 'Inseguranca Alimentar Leve', min: 1, max: 3 },
    { code: 'IM', label: 'Inseguranca Alimentar Moderada', min: 4, max: 5 },
    { code: 'IG', label: 'Inseguranca Alimentar Grave', min: 6, max: 8 }
  ]
};

const classifyEbia = (temMenores: boolean, score: number): EbiaClassification => {
  const ranges = temMenores ? EBIA_RANGES.comMenores : EBIA_RANGES.semMenores;
  return ranges.find((item) => score >= item.min && score <= item.max) || ranges[ranges.length - 1];
};

type PayloadShape = {
  tipo?: string;
  dados?: JsonRecord;
  resultados?: JsonRecord;
  pontuacaoEBIA?: number;
  classificacao?: string;
  classificacaoLabel?: string;
  formulaId?: string;
  formulaVersion?: string;
};

export const normalizeAvaliacaoSocioeconomicaPayload = <T extends PayloadShape>(payload: T): T => {
  if (normalizeType(payload?.tipo) !== 'avaliacao_socioeconomica') {
    return payload;
  }

  const payloadRecord = asRecord(payload as unknown);
  const dados = asRecord(payload.dados);
  const resultados = asRecord(payload.resultados);
  const input = asRecord(dados.input);
  const resultadosCalculated = asRecord(resultados.calculated);
  const resultadosOutput = asRecord(resultados.output);

  const respostasRaw = asRecord(
    dados.respostas
    || input.respostas
    || payloadRecord.respostas
  );

  const respostas: Record<string, boolean | null> = {};
  for (let index = 1; index <= 14; index += 1) {
    const key = `q${index}`;
    const parsed = toBooleanChoice(respostasRaw[key]);
    respostas[key] = parsed;
  }

  const temMenores = toBooleanChoice(
    dados.temMenores ?? input.temMenores ?? payloadRecord.temMenores
  ) === true;
  const totalPerguntas = temMenores ? 14 : 8;
  const pontuacaoCalculada = Array.from({ length: totalPerguntas }, (_, idx) => `q${idx + 1}`)
    .reduce((sum, key) => sum + (respostas[key] === true ? 1 : 0), 0);

  const pontuacaoEBIA = toNumber(payload.pontuacaoEBIA)
    ?? toNumber(resultadosCalculated.pontuacaoEBIA)
    ?? toNumber(resultados.pontuacaoEBIA)
    ?? pontuacaoCalculada;

  const classificacaoCalculada = classifyEbia(temMenores, Number(pontuacaoEBIA || 0));
  const classificacao = toText(payload.classificacao)
    || toText(resultadosOutput.classificacao)
    || classificacaoCalculada.code;
  const classificacaoLabel = toText(payload.classificacaoLabel)
    || toText(resultadosOutput.classificacaoLabel)
    || classificacaoCalculada.label;

  const normalizedDados = compact({
    ...dados,
    temMenores,
    respostas,
    input: compact({
      ...input,
      temMenores,
      respostas
    }),
    source: compact({
      ...asRecord(dados.source),
      mode: toText(asRecord(dados.source).mode) || 'questionario_ebia',
      system: toText(asRecord(dados.source).system) || 'manual'
    })
  });

  const normalizedResultados = compact({
    ...resultados,
    pontuacaoEBIA: Number.isFinite(pontuacaoEBIA) ? Number(pontuacaoEBIA) : undefined,
    classificacao,
    classificacaoLabel,
    calculated: compact({
      ...resultadosCalculated,
      pontuacaoEBIA: Number.isFinite(pontuacaoEBIA) ? Number(pontuacaoEBIA) : undefined
    }),
    output: compact({
      ...resultadosOutput,
      classificacao,
      classificacaoLabel
    })
  });

  return {
    ...payload,
    dados: normalizedDados,
    resultados: normalizedResultados,
    pontuacaoEBIA: Number.isFinite(pontuacaoEBIA) ? Number(pontuacaoEBIA) : payload.pontuacaoEBIA,
    classificacao,
    classificacaoLabel,
    formulaId: toText(payload.formulaId) || 'ebia_14_itens',
    formulaVersion: toText(payload.formulaVersion) || '1.0.0'
  };
};
