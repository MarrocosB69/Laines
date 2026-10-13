// A inscrição pública é um autorrelato histórico. Este seletor só prepara
// contexto de leitura; nenhum valor daqui é um resultado de avaliação.
const asRecord = (value) => (
  value && typeof value === 'object' && !Array.isArray(value) ? value : {}
);

const PUBLIC_CHOICE_LABELS = Object.freeze({
  sexoBiologico: { feminino: 'Feminino', masculino: 'Masculino', nao_informado: 'Prefiro não informar' },
  tipoTreino: { forca: 'Força', resistencia: 'Resistência/aeróbico', misto: 'Misto', tecnico: 'Técnico/tático' },
  intensidade: { leve: 'Leve', moderada: 'Moderada', alta: 'Alta', muito_alta: 'Muito alta' },
  objetivo: {
    performance: 'Melhora de desempenho', saude: 'Saúde e qualidade de vida',
    estetica: 'Estética/composição corporal', reabilitacao: 'Reabilitação', outro: 'Outro'
  },
  avaliacaoSolicitada: {
    nutricional: 'Avaliação nutricional', fisioterapia: 'Avaliação fisioterapêutica',
    psicologia: 'Acompanhamento psicológico'
  }
});

const hasValue = (value) => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'boolean') return true;
  if (Array.isArray(value)) return value.some(hasValue);
  return false;
};

const hideIdentifiers = (value) => value
  .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[e-mail omitido]')
  .replace(/\b\d{3}[.\s-]?\d{3}[.\s-]?\d{3}[-.\s]?\d{2}\b/g, '[identificador omitido]')
  .replace(/(?:\+?55[\s-]?)?\(?\d{2}\)?[\s-]?9?\d{4}[-.\s]?\d{4}\b/g, '[contato omitido]');

const textValue = (value) => {
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (typeof value === 'string') return hideIdentifiers(value.trim());
  return '';
};

const listValue = (value) => (
  Array.isArray(value) ? value.filter(hasValue).map(textValue).filter(Boolean).join(', ') : ''
);

const familyValue = (value) => {
  if (Array.isArray(value)) return listValue(value);
  const family = asRecord(value);
  return [
    ['pai', 'Pai'],
    ['mae', 'Mãe'],
    ['legado', 'Histórico']
  ]
    .map(([key, label]) => {
      const items = listValue(family[key]);
      return items ? `${label}: ${items}` : '';
    })
    .filter(Boolean)
    .join(' · ');
};

const normalizeClause = (value) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const additionalHistory = (history, family) => {
  const known = new Set(family.split(' · ').map(normalizeClause));
  return textValue(history)
    .split(/\s*[|·]\s*/)
    .filter((part) => part && !known.has(normalizeClause(part)))
    .join(' · ');
};

const answeredCount = (answers) => (
  Object.values(asRecord(answers)).filter(hasValue).length
);

const ebiaAnsweredCount = (value) => {
  const answers = asRecord(value).respostas;
  if (!Array.isArray(answers)) return 0;
  return answers.filter((answer) => hasValue(asRecord(answer).resposta)).length;
};

const addItem = (items, label, value) => {
  const formatted = Array.isArray(value) ? listValue(value) : textValue(value);
  if (formatted) items.push({ label, value: formatted });
};

const addChoiceItem = (items, label, key, value) => {
  const raw = textValue(value);
  if (raw) items.push({ label, value: PUBLIC_CHOICE_LABELS[key]?.[raw] || raw });
};

const addChoiceListItem = (items, label, key, value) => {
  if (!Array.isArray(value)) return;
  const formatted = value.filter(hasValue).map((item) => {
    const raw = textValue(item);
    return PUBLIC_CHOICE_LABELS[key]?.[raw] || raw;
  }).filter(Boolean).join(', ');
  if (formatted) items.push({ label, value: formatted });
};

const sportsValue = (value, primaryFrequency) => {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 5).map((entry, index) => {
    const sport = asRecord(entry);
    const name = textValue(sport.modalidade);
    if (!name) return '';
    const practice = textValue(sport.tempoPratica);
    const frequency = textValue(sport.frequenciaSemanal || (index === 0 ? primaryFrequency : null));
    const minutes = textValue(sport.duracaoSessao);
    return [name, frequency ? `${frequency}×/semana` : '', practice, minutes ? `${minutes} min/sessão` : ''].filter(Boolean).join(' · ');
  }).filter(Boolean);
};

export const getMergedOnboardingData = (confirmation) => ({
  ...asRecord(asRecord(confirmation).inscricaoPublica?.dados),
  ...asRecord(asRecord(confirmation).dados)
});

export const getPublicTriageContext = (confirmation) => {
  const publicInscricao = asRecord(asRecord(confirmation).inscricaoPublica);
  const data = asRecord(publicInscricao.dados);
  const updatedAt = textValue(publicInscricao.atualizadoEm) || null;
  const negative = asRecord(data.relatoNegativo);

  const treino = [];
  const sports = sportsValue(data.esportes, data.frequenciaSemanal);
  if (sports.length) {
    sports.forEach((sport, index) => treino.push({ label: `Esporte ${index + 1}`, value: sport }));
  } else {
    addItem(treino, 'Modalidade', data.modalidadePrincipal);
    addItem(treino, 'Outras modalidades', data.outrasModalidades);
    addItem(treino, 'Tempo de prática', data.tempoPratica);
    if (hasValue(data.frequenciaSemanal)) {
      treino.push({ label: 'Frequência semanal', value: `${textValue(data.frequenciaSemanal)}×/semana` });
    }
    if (hasValue(data.duracaoSessao)) {
      treino.push({ label: 'Duração da sessão', value: `${textValue(data.duracaoSessao)} min` });
    }
  }
  addChoiceItem(treino, 'Tipo de treino', 'tipoTreino', data.tipoTreino);
  addChoiceItem(treino, 'Intensidade informada', 'intensidade', data.intensidade);
  addChoiceItem(treino, 'Objetivo informado', 'objetivo', data.objetivo);

  const saude = [];
  addChoiceItem(saude, 'Sexo biológico informado', 'sexoBiologico', data.sexoBiologico);
  addItem(saude, 'Lesão ou dor atual relatada', data.lesaoAtual);
  addItem(saude, 'Lesão nos últimos três meses relatada', data.lesaoUltimos3Meses);
  if (data.lesaoAtual === true || data.lesaoUltimos3Meses === true) {
    const impactLabels = { normal: 'Prática normal', adaptada: 'Treino adaptado', interrompida: 'Prática interrompida' };
    const impact = textValue(data.impactoLesao);
    if (impact) saude.push({ label: 'Impacto atual na prática', value: impactLabels[impact] || impact });
  }
  const personal = listValue(data.comorbidadesPessoais);
  if (personal) saude.push({ label: 'Condições pessoais relatadas', value: personal });
  else if (negative.comorbidades === true) {
    saude.push({ label: 'Condições pessoais relatadas', value: 'Nenhuma, segundo a inscrição' });
  }
  const family = familyValue(data.comorbidadesFamiliares);
  if (family) saude.push({ label: 'Histórico familiar relatado', value: family });
  addItem(saude, 'Histórico de saúde informado', additionalHistory(data.historicoSaude, family));
  const signs = listValue(Array.isArray(data.sinaisClinicos)
    ? data.sinaisClinicos.filter((item) => item !== 'nenhum') : []);
  if (signs) saude.push({ label: 'Sinais relatados', value: signs });
  else if (negative.sinais === true || (Array.isArray(data.sinaisClinicos) && data.sinaisClinicos.includes('nenhum'))) {
    saude.push({ label: 'Sinais relatados', value: 'Nenhum, segundo a inscrição' });
  }
  const exams = listValue(data.examesRealizados);
  if (exams) saude.push({ label: 'Exames informados', value: exams });
  else if (negative.exames === true) {
    saude.push({ label: 'Exames informados', value: 'Nenhum no último ano, segundo a inscrição' });
  }
  const redsCount = answeredCount(data.redsRespostas);
  if (redsCount) {
    saude.push({
      label: 'Rastreio de disponibilidade energética autorrelatado',
      value: `${redsCount} ${redsCount === 1 ? 'resposta registrada' : 'respostas registradas'}`
    });
  }
  addItem(saude, 'Observações da inscrição', data.observacoes);

  const rotina = [];
  addItem(rotina, 'Renda declarada', data.rendaMensal);
  addItem(rotina, 'Escolaridade', data.escolaridade);
  if (hasValue(data.hidratacao)) {
    rotina.push({ label: 'Líquidos por dia informados', value: `${textValue(data.hidratacao)} L/dia` });
  }
  if (hasValue(data.bristol)) {
    rotina.push({ label: 'Bristol informado', value: `Tipo ${textValue(data.bristol)}` });
  }
  addItem(rotina, 'Cor da primeira urina', data.urinaPrimeira);
  addItem(rotina, 'Cor da última urina', data.urinaUltima);
  addItem(rotina, 'Suplemento ou medicamento no dia', data.suplementoNoDia);
  const ebiaCount = ebiaAnsweredCount(data.ebia);
  if (ebiaCount) {
    rotina.push({
      label: 'Rastreio EBIA autorrelatado',
      value: `${ebiaCount} ${ebiaCount === 1 ? 'resposta registrada' : 'respostas registradas'}`
    });
  }
  addChoiceListItem(rotina, 'Avaliações solicitadas', 'avaliacaoSolicitada', data.avaliacaoSolicitada);

  const sections = [
    { id: 'treino', label: 'Treino', items: treino },
    { id: 'saude', label: 'Saúde relatada', items: saude },
    { id: 'rotina', label: 'Rotina e solicitações', items: rotina }
  ].filter((section) => section.items.length > 0);

  const summary = [];
  if (sports.length) {
    summary.push(`Esporte: ${sports[0]}${sports.length > 1 ? ` · +${sports.length - 1}` : ''}`);
  } else {
    if (hasValue(data.modalidadePrincipal)) summary.push(`Modalidade: ${textValue(data.modalidadePrincipal)}`);
    const frequency = hasValue(data.frequenciaSemanal) ? `${textValue(data.frequenciaSemanal)}×/semana` : '';
    const duration = hasValue(data.duracaoSessao) ? `${textValue(data.duracaoSessao)} min` : '';
    if (frequency || duration) summary.push(`Treino: ${[frequency, duration].filter(Boolean).join(' · ')}`);
  }
  if (Array.isArray(data.avaliacaoSolicitada) && hasValue(data.avaliacaoSolicitada)) {
    const count = data.avaliacaoSolicitada.filter(hasValue).length;
    summary.push(`${count} ${count === 1 ? 'avaliação solicitada' : 'avaliações solicitadas'}`);
  }

  return {
    data,
    updatedAt,
    hasData: sections.length > 0,
    summary: summary.slice(0, 3),
    sections
  };
};
