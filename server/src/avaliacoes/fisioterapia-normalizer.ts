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
  return Array.isArray(value) ? value : [];
};

const compact = (record: JsonRecord): JsonRecord => {
  const output: JsonRecord = {};
  Object.entries(record).forEach(([key, value]) => {
    if (value !== undefined) output[key] = value;
  });
  return output;
};

const normalizeSessao = (value: unknown): JsonRecord | null => {
  const record = asRecord(value);
  const id = toText(record.id);
  const data = toText(record.data);
  if (!id || !data) return null;
  return {
    ...record,
    id,
    data
  };
};

const normalizeObjetivo = (value: unknown): JsonRecord => {
  const record = asRecord(value);
  return {
    ...record,
    id: toText(record.id),
    texto: toText(record.texto),
    concluido: Boolean(record.concluido)
  };
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
  const queixaPrincipal = toText(dados.queixaPrincipal ?? input.queixaPrincipal);
  const intensidadeDor = toNumber(dados.intensidadeDor ?? input.intensidadeDor);
  const mobilidade = toText(dados.mobilidade ?? input.mobilidade);

  const normalizedDados = compact({
    ...dados,
    queixaPrincipal: queixaPrincipal || undefined,
    intensidadeDor: intensidadeDor ?? undefined,
    mobilidade: mobilidade || undefined,
    diagnosticoClinico: toText(dados.diagnosticoClinico),
    diagnosticoCineticofuncional: toText(dados.diagnosticoCineticofuncional),
    examesComplementares: toText(dados.examesComplementares),
    sessoes: asArray(dados.sessoes)
      .map((item) => normalizeSessao(item))
      .filter((item): item is JsonRecord => Boolean(item)),
    objetivosCurtoPrazo: asArray(dados.objetivosCurtoPrazo).map((item) => normalizeObjetivo(item)),
    objetivosMedioLongoPrazo: asArray(dados.objetivosMedioLongoPrazo).map((item) => normalizeObjetivo(item)),
    condutasCurtoPrazo: toText(dados.condutasCurtoPrazo),
    condutasMedioLongoPrazo: toText(dados.condutasMedioLongoPrazo),
    input: compact({
      ...input,
      queixaPrincipal: queixaPrincipal || undefined,
      intensidadeDor: intensidadeDor ?? undefined,
      mobilidade: mobilidade || undefined
    })
  });

  return {
    ...payload,
    dados: normalizedDados,
    formulaId: toText(payload.formulaId) || 'fisioterapia_funcional_basica',
    formulaVersion: toText(payload.formulaVersion) || '2.0.0'
  };
};
