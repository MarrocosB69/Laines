export const CONTENT_STATUS_LABELS = {
  rascunho: 'Rascunho',
  em_andamento: 'Em andamento',
  pendente_aprovacao: 'Pendente de aprovacao',
  aprovado: 'Aprovado',
  publicado: 'Publicado',
  arquivado: 'Arquivado'
};

const EDITOR_STATUS_OPTIONS = [
  { value: 'rascunho', label: CONTENT_STATUS_LABELS.rascunho },
  { value: 'em_andamento', label: CONTENT_STATUS_LABELS.em_andamento },
  { value: 'pendente_aprovacao', label: CONTENT_STATUS_LABELS.pendente_aprovacao },
  { value: 'arquivado', label: CONTENT_STATUS_LABELS.arquivado }
];

const APPROVER_STATUS_OPTIONS = [
  ...EDITOR_STATUS_OPTIONS,
  { value: 'aprovado', label: CONTENT_STATUS_LABELS.aprovado },
  { value: 'publicado', label: CONTENT_STATUS_LABELS.publicado }
];

export const splitCommaList = (value) => String(value || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

export const formatList = (value) => {
  if (!Array.isArray(value) || value.length === 0) return '';
  return value.join(', ');
};

export const getContentStatusLabel = (status) => (
  CONTENT_STATUS_LABELS[String(status || '').trim()] || status || 'Sem status'
);

// A fonte de verdade é `capabilities`, vinda do servidor (ou da reserva local
// para sessão antiga em src/constants/capabilities.js) — não derivar de
// role/diretoria no cliente (UPD-13). O servidor já impõe a mesma regra em
// conteudos.service.ts; isto é só a projeção da interface.
export const canApproveContent = (user) => Boolean(user?.capabilities?.liga?.aprovaConteudo);

// areaKey: chave da área em capabilities.liga.gerencia ('ensino', 'pesquisa',
// 'extensao' ou 'comunicacao').
export const canManageContentArea = (user, areaKey) => {
  if (canApproveContent(user)) return true;
  const gerencia = user?.capabilities?.liga?.gerencia;
  return Array.isArray(gerencia) && gerencia.includes(areaKey);
};

export const getStatusOptionsForUser = (user) => (
  canApproveContent(user) ? APPROVER_STATUS_OPTIONS : EDITOR_STATUS_OPTIONS
);
