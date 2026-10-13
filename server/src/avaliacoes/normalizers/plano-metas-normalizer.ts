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

const clamp = (value: number | null, min: number, max: number): number | null => {
  if (value === null) return null;
  return Math.min(max, Math.max(min, value));
};

const normalizeType = (value: unknown): string => (
  String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
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

export const normalizePlanoMetasPayload = <T extends PayloadShape>(payload: T): T => {
  if (normalizeType(payload?.tipo) !== 'plano_metas') return payload;

  const dados = asRecord(payload.dados);
  const input = asRecord(dados.input);

  const versao = toText(dados.versao || input.versao) || 'simples';

  // Campos simples
  const oQueQueroMudar = toText(dados.oQueQueroMudar ?? input.oQueQueroMudar);
  const motivacao = clamp(
    toNumber(dados.motivacao ?? input.motivacao),
    0,
    10
  );
  const pros = toText(dados.pros ?? input.pros);
  const contras = toText(dados.contras ?? input.contras);

  // Campos completos
  const mudancaDesejada = toText(dados.mudancaDesejada ?? input.mudancaDesejada);
  const motivosParaMudar = toText(dados.motivosParaMudar ?? input.motivosParaMudar);
  const comoPlanejo = toText(dados.comoPlanejo ?? input.comoPlanejo);
  const estrategias = toText(dados.estrategias ?? input.estrategias);
  const planosParaDificuldades = toText(dados.planosParaDificuldades ?? input.planosParaDificuldades);
  const comoOutrosPodemAjudar = toText(dados.comoOutrosPodemAjudar ?? input.comoOutrosPodemAjudar);
  const comoMonitorar = toText(dados.comoMonitorar ?? input.comoMonitorar);
  const grauConfianca = clamp(
    toNumber(dados.grauConfianca ?? input.grauConfianca),
    1,
    10
  );
  const observacoes = toText(dados.observacoes ?? input.observacoes);

  const normalizedDados = compact({
    ...dados,
    versao,
    oQueQueroMudar: oQueQueroMudar || undefined,
    motivacao: motivacao ?? undefined,
    pros: pros || undefined,
    contras: contras || undefined,
    mudancaDesejada: mudancaDesejada || undefined,
    motivosParaMudar: motivosParaMudar || undefined,
    comoPlanejo: comoPlanejo || undefined,
    estrategias: estrategias || undefined,
    planosParaDificuldades: planosParaDificuldades || undefined,
    comoOutrosPodemAjudar: comoOutrosPodemAjudar || undefined,
    comoMonitorar: comoMonitorar || undefined,
    grauConfianca: grauConfianca ?? undefined,
    observacoes: observacoes || undefined,
    input: compact({
      ...input,
      versao,
      oQueQueroMudar: oQueQueroMudar || undefined,
      motivacao: motivacao ?? undefined,
      pros: pros || undefined,
      contras: contras || undefined,
      mudancaDesejada: mudancaDesejada || undefined,
      motivosParaMudar: motivosParaMudar || undefined,
      comoPlanejo: comoPlanejo || undefined,
      estrategias: estrategias || undefined,
      planosParaDificuldades: planosParaDificuldades || undefined,
      comoOutrosPodemAjudar: comoOutrosPodemAjudar || undefined,
      comoMonitorar: comoMonitorar || undefined,
      grauConfianca: grauConfianca ?? undefined,
      observacoes: observacoes || undefined,
    }),
  });

  return {
    ...payload,
    dados: normalizedDados,
    formulaId: toText(payload.formulaId) || 'plano_metas_motivacional_v1',
    formulaVersion: toText(payload.formulaVersion) || '1.0.0',
  };
};
