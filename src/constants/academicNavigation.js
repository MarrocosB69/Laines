export const ACADEMIC_NAVIGATION = Object.freeze({
  research: [
    { id: 'research', section: 'overview', label: 'Painel' },
    { id: 'research_repository', section: 'repository', label: 'Repositório' },
    { id: 'research_projects', section: 'projects', label: 'Projetos' },
    { id: 'research_ideas', section: 'ideas', label: 'Ideias' }
  ],
  ensino: [
    { id: 'ensino', section: 'overview', label: 'Painel' },
    { id: 'ensino_reunioes', section: 'reunioes', label: 'Reuniões e rodas' },
    { id: 'ensino_materiais', section: 'materiais', label: 'Materiais' }
  ],
  extensao: [
    { id: 'extensao', section: 'overview', label: 'Painel' },
    { id: 'extensao_triagens', section: 'triagens', label: 'Triagens' },
    { id: 'extensao_capacitacoes', section: 'capacitacoes', label: 'Capacitações' },
    { id: 'extensao_materiais', section: 'materiais', label: 'Materiais' }
  ],
  comunicacao: [
    { id: 'comunicacao', section: 'overview', label: 'Painel' },
    { id: 'comunicacao_comunicados', section: 'comunicados', label: 'Comunicados' },
    { id: 'comunicacao_materiais', section: 'materiais', label: 'Materiais' }
  ]
});

// Nome da área em `capabilities.liga` (pesquisa/ensino/extensao/comunicacao)
// para a raiz de navegação usada nas telas (StudentView/AdminView/Sidebar).
// Só "pesquisa" diverge do id de navegação legado ("research"); as demais
// coincidem com a chave de ACADEMIC_NAVIGATION.
export const LIGA_AREA_ROOT_TABS = Object.freeze({
  ensino: 'ensino',
  pesquisa: 'research',
  extensao: 'extensao',
  comunicacao: 'comunicacao'
});

const ACADEMIC_TAB_INDEX = Object.entries(ACADEMIC_NAVIGATION).reduce((acc, [root, sections]) => {
  sections.forEach((item) => {
    acc[item.id] = { ...item, root };
  });
  return acc;
}, {});

export const getAcademicRootTab = (tab) => {
  const id = String(tab || '').trim();
  return ACADEMIC_TAB_INDEX[id]?.root || id;
};

export const getAcademicSectionFromTab = (tab) => {
  const id = String(tab || '').trim();
  return ACADEMIC_TAB_INDEX[id]?.section || 'overview';
};

export const getAcademicTabFromSection = (root, section) => {
  const sections = ACADEMIC_NAVIGATION[root] || [];
  const match = sections.find((item) => item.section === section);
  return match?.id || root;
};

export const getAcademicTabLabel = (tab) => {
  const id = String(tab || '').trim();
  return ACADEMIC_TAB_INDEX[id]?.label || '';
};

export const getAcademicChildren = (root) => ACADEMIC_NAVIGATION[root] || [];
