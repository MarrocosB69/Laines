const STATUS_META = {
  finalizada: { label: 'Finalizada', tone: 'success' },
  pendente: { label: 'Pendente', tone: 'warning' },
  em_analise: { label: 'Em analise', tone: 'info' },
  rascunho: { label: 'Rascunho', tone: 'neutral' },
  falta: { label: 'Falta', tone: 'danger' },
  sem_registro: { label: 'Sem registro', tone: 'neutral' }
};

const TYPE_LABELS = {
  bioimpedancia: 'Bioimpedancia',
  dobras_cutaneas: 'Dobras cutaneas',
  perimetros: 'Perimetros',
  alimentar: 'Avaliação alimentar',
  hidratacao: 'Hidratacao',
  avaliacao_socioeconomica: 'Socioeconomica (EBIA)',
  fisioterapia: 'Fisioterapia',
  psicologia: 'Psicologia'
};

const normalizeToken = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');

const toSentenceCase = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return 'Não informado';
  return `${raw.charAt(0).toUpperCase()}${raw.slice(1)}`;
};

export const getEvaluationTypeLabel = (value) => {
  const key = normalizeToken(value);
  if (!key) return 'Não informado';
  return TYPE_LABELS[key] || toSentenceCase(String(value).replace(/_/g, ' '));
};

export const getEvaluationStatusLabel = (value) => {
  const key = normalizeToken(value);
  if (!key) return STATUS_META.sem_registro.label;
  return STATUS_META[key]?.label || toSentenceCase(String(value).replace(/_/g, ' '));
};

export const getEvaluationStatusTone = (value) => {
  const key = normalizeToken(value);
  return STATUS_META[key]?.tone || 'neutral';
};
