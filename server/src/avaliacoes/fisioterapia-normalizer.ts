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

const compact = (record: JsonRecord): JsonRecord => {
  const output: JsonRecord = {};
  Object.entries(record).forEach(([key, value]) => {
    if (value !== undefined) output[key] = value;
  });
  return output;
};

type PayloadShape = {
  tipo?: string;
  dados?: JsonRecord;
  formulaId?: string;
  formulaVersion?: string;
};

export const normalizeFisioterapiaPayload = <T extends PayloadShape>(payload: T): T => {
  if (normalizeType(payload?.tipo) !== 'fisioterapia') {
    return payload;
  }

  const dados = asRecord(payload.dados);
  const input = asRecord(dados.input);

  const queixaPrincipal = toText(dados.queixaPrincipal || input.queixaPrincipal);
  const dorLocal = toText(dados.dorLocal || input.dorLocal);
  const intensidadeDor = toNumber(dados.intensidadeDor ?? input.intensidadeDor);
  const mobilidade = toText(dados.mobilidade || input.mobilidade);
  const observacoes = toText(dados.observacoes || input.observacoes);

  const normalizedDados = compact({
    ...dados,
    queixaPrincipal: queixaPrincipal || undefined,
    dorLocal: dorLocal || undefined,
    intensidadeDor: intensidadeDor ?? undefined,
    mobilidade: mobilidade || undefined,
    observacoes: observacoes || undefined,
    input: compact({
      ...input,
      queixaPrincipal: queixaPrincipal || undefined,
      dorLocal: dorLocal || undefined,
      intensidadeDor: intensidadeDor ?? undefined,
      mobilidade: mobilidade || undefined,
      observacoes: observacoes || undefined
    })
  });

  return {
    ...payload,
    dados: normalizedDados,
    formulaId: toText(payload.formulaId) || 'fisioterapia_funcional_basica',
    formulaVersion: toText(payload.formulaVersion) || '1.0.0'
  };
};
