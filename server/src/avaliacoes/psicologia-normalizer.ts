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

// ── PHQ-9 ────────────────────────────────────────────────────────────────────

const PHQ9_COUNT = 9;
const PHQ9_MAX = 27;

const PHQ9_SEVERITY = [
  { max: 4, label: 'Minima' },
  { max: 9, label: 'Leve' },
  { max: 14, label: 'Moderada' },
  { max: 19, label: 'Moderadamente grave' },
  { max: PHQ9_MAX, label: 'Grave' },
];

// ── GAD-7 ─────────────────────────────────────────────────────────────────────

const GAD7_COUNT = 7;
const GAD7_MAX = 21;

const GAD7_SEVERITY = [
  { max: 4, label: 'Minima' },
  { max: 9, label: 'Leve' },
  { max: 14, label: 'Moderada' },
  { max: GAD7_MAX, label: 'Grave' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getSeverityLabel(score: number, table: { max: number; label: string }[]): string {
  return (table.find((s) => score <= s.max) ?? table[table.length - 1]).label;
}

function scoreQuestionnaire(
  answers: JsonRecord,
  count: number,
): { total: number; filled: number; complete: boolean } {
  let total = 0;
  let filled = 0;
  for (let i = 1; i <= count; i++) {
    const v = toNumber(answers[`q${i}`]);
    if (v !== null) {
      total += v;
      filled++;
    }
  }
  return { total, filled, complete: filled === count };
}

function normalizeQuestionnaireAnswers(raw: JsonRecord, count: number): JsonRecord {
  const out: JsonRecord = {};
  for (let i = 1; i <= count; i++) {
    const v = toNumber(raw[`q${i}`]);
    out[`q${i}`] = v ?? null;
  }
  return out;
}

// ── Main normalizer ───────────────────────────────────────────────────────────

type PayloadShape = {
  tipo?: string;
  dados?: JsonRecord;
  formulaId?: string;
  formulaVersion?: string;
};

export const normalizePsicologiaPayload = <T extends PayloadShape>(payload: T): T => {
  if (normalizeType(payload?.tipo) !== 'psicologia') {
    return payload;
  }

  const dados = asRecord(payload.dados);
  const input = asRecord(dados.input);

  // ── Triagem geral ──────────────────────────────────────────────────────────
  const objetivo = toText(dados.objetivo || input.objetivo);
  const humorAtual = toText(dados.humorAtual || input.humorAtual);
  const estresse = toNumber(dados.estresse ?? input.estresse);
  const ansiedadeScore = toNumber(dados.ansiedadeScore ?? input.ansiedadeScore);
  const motivacaoMudanca = toNumber(dados.motivacaoMudanca ?? input.motivacaoMudanca);
  const sono = toText(dados.sono || input.sono);
  const suporteSocial = toText(dados.suporteSocial || input.suporteSocial);
  const sinaisAlerta = toText(dados.sinaisAlerta || input.sinaisAlerta);
  const riscoCompulsao = toText(dados.riscoCompulsao || input.riscoCompulsao);
  const observacoes = toText(dados.observacoes || input.observacoes);

  // ── PHQ-9 ──────────────────────────────────────────────────────────────────
  const phq9Raw = asRecord(dados.phq9 || input.phq9);
  const phq9 = normalizeQuestionnaireAnswers(phq9Raw, PHQ9_COUNT);
  const phq9Calc = scoreQuestionnaire(phq9, PHQ9_COUNT);
  const phq9Score = phq9Calc.complete ? phq9Calc.total : (toNumber(dados.phq9Score ?? input.phq9Score));
  const phq9Severity = phq9Score !== null
    ? getSeverityLabel(phq9Score, PHQ9_SEVERITY)
    : toText(dados.phq9Severity || input.phq9Severity) || null;

  // ── GAD-7 ──────────────────────────────────────────────────────────────────
  const gad7Raw = asRecord(dados.gad7 || input.gad7);
  const gad7 = normalizeQuestionnaireAnswers(gad7Raw, GAD7_COUNT);
  const gad7Calc = scoreQuestionnaire(gad7, GAD7_COUNT);
  const gad7Score = gad7Calc.complete ? gad7Calc.total : (toNumber(dados.gad7Score ?? input.gad7Score));
  const gad7Severity = gad7Score !== null
    ? getSeverityLabel(gad7Score, GAD7_SEVERITY)
    : toText(dados.gad7Severity || input.gad7Severity) || null;

  const normalizedDados = compact({
    ...dados,
    objetivo: objetivo || undefined,
    humorAtual: humorAtual || undefined,
    estresse: estresse ?? undefined,
    ansiedadeScore: ansiedadeScore ?? undefined,
    motivacaoMudanca: motivacaoMudanca ?? undefined,
    sono: sono || undefined,
    suporteSocial: suporteSocial || undefined,
    sinaisAlerta: sinaisAlerta || undefined,
    riscoCompulsao: riscoCompulsao || undefined,
    observacoes: observacoes || undefined,
    phq9,
    phq9Score: phq9Score ?? undefined,
    phq9Severity: phq9Severity ?? undefined,
    phq9FilledCount: phq9Calc.filled || undefined,
    phq9AboveCutOff: phq9Score !== null ? phq9Score >= 10 : undefined,
    gad7,
    gad7Score: gad7Score ?? undefined,
    gad7Severity: gad7Severity ?? undefined,
    gad7FilledCount: gad7Calc.filled || undefined,
    gad7AboveCutOff: gad7Score !== null ? gad7Score >= 10 : undefined,
    input: compact({
      ...input,
      objetivo: objetivo || undefined,
      humorAtual: humorAtual || undefined,
      estresse: estresse ?? undefined,
      ansiedadeScore: ansiedadeScore ?? undefined,
      motivacaoMudanca: motivacaoMudanca ?? undefined,
      sono: sono || undefined,
      suporteSocial: suporteSocial || undefined,
      sinaisAlerta: sinaisAlerta || undefined,
      riscoCompulsao: riscoCompulsao || undefined,
      observacoes: observacoes || undefined,
      phq9,
      phq9Score: phq9Score ?? undefined,
      phq9Severity: phq9Severity ?? undefined,
      gad7,
      gad7Score: gad7Score ?? undefined,
      gad7Severity: gad7Severity ?? undefined,
    }),
  });

  return {
    ...payload,
    dados: normalizedDados,
    formulaId: toText(payload.formulaId) || 'psicologia_triagem_emocional',
    formulaVersion: toText(payload.formulaVersion) || '2.0.0',
  };
};
