// Modelo único de navegação das sidebars, guiado pelas capacidades que o
// servidor já envia em /auth/me. JS puro, sem React: só monta dados.
// docs/implementacao/sidebars-v2/change-intent.md (decisões 1 a 3).
//
// buildSidebarModel({ portal, user, capabilities, pendingCount, requestsCount })
// devolve { papel, secoes, atalhos, rodape }. `capabilities` chega já
// normalizada por quem chama (AuthContext) — este módulo só lê, nunca deriva
// nem decide acesso; o servidor continua sendo a autoridade.
import { getAllowedAdminTabsFromCapabilities } from '../constants/adminTabs';
import { getAcademicChildren, LIGA_AREA_ROOT_TABS } from '../constants/academicNavigation';
import {
  normalizeRole,
  isStudentMemberRole,
  getAbasDeGestaoEmbutidas,
  getPaginaDeOrigem,
  ABA_DE_GESTAO_NA_PAGINA_UNICA
} from '../constants/roles';
import { getLigaAreaLabel } from '../constants/capabilities';

// Rótulo do cartão de papel no admin: por normalizedRole, como ROLE_LABELS
// já era em src/views/admin/SideBar/Sidebar.jsx.
const ADMIN_ROLE_LABELS = Object.freeze({
  admin: 'Administração',
  coordenacao: 'Coordenação',
  presidente: 'Presidência',
  vice: 'Vice-presidência',
  diretoria_marketing: 'Diretoria de Marketing',
  diretoria_ensino: 'Diretoria de Ensino',
  diretoria_pesquisa: 'Diretoria de Pesquisa',
  diretoria_extensao: 'Diretoria de Extensão',
  coord_atendimento: 'Coordenação de Atendimento',
  professor: 'Corpo Docente',
  profissional: 'Profissional',
  pesquisador: 'Pesquisador'
});

// Decisão 3: dica sob a seção que tiver algum item com aviso de sem vínculo.
const DICA_SEM_VINCULO = 'Complete supervisor e projeto no seu perfil para atender atletas.';
const AVISO_SEM_VINCULO = 'Sem vínculo';

// Rótulo/ícone das quatro áreas, únicos para admin, aluno, professor e
// equipe (decisão 2 acrescenta comunicação a professor/equipe). O rótulo
// "Comunicação" e os demais vêm do texto de hoje, não do getLigaAreaLabel
// (que é usado só para "Minha diretoria", ver mais abaixo).
const LIGA_ITEM_DEFS = Object.freeze([
  { area: 'pesquisa', id: 'research', rotulo: 'Pesquisa', icone: 'FlaskConical' },
  { area: 'ensino', id: 'ensino', rotulo: 'Ensino', icone: 'BookOpen' },
  { area: 'extensao', id: 'extensao', rotulo: 'Extensão', icone: 'Users2' },
  { area: 'comunicacao', id: 'comunicacao', rotulo: 'Comunicação', icone: 'Megaphone' }
]);

// Mesmo algoritmo nas cinco sidebars de hoje; só o par de duas letras de
// fallback (quando não há nome) mudava por portal.
const getInitials = (name, fallback) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  const first = parts[0][0] || '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : (parts[0][1] || '');
  return `${first}${last}`.toUpperCase();
};

// liga.areas manda quais das quatro aparecem (invariante 1); liga.gerencia
// não entra aqui — isso é só para "Minha diretoria" (aluno) e para as abas
// de área do admin (que usam getAllowedAdminTabsFromCapabilities, outra
// função, mais abaixo).
const DICAS_AREAS_ADMIN = {
  research: 'Repositório, projetos e ideias',
  ensino: 'Trilhas e conteúdos acadêmicos',
  extensao: 'Ações com a comunidade',
  comunicacao: 'Comunicados e materiais'
};

const ligaItens = (areasPermitidas) => (
  LIGA_ITEM_DEFS
    .filter((def) => areasPermitidas.includes(def.area))
    .map((def) => ({ id: def.id, rotulo: def.rotulo, icone: def.icone, filhos: getAcademicChildren(def.id) }))
);

// Selo numérico (contagem), não o aviso de texto da decisão 3. Formatação
// preservada por portal: o admin trunca sem teto, o atleta usa "9+" (era
// Math.trunc(requestsCount) vs. pendingCount > 9 ? '9+' : pendingCount).
const buildSelo = (valorBruto, { limitarA9 = false, sufixoDescricao }) => {
  const numero = Number.isFinite(valorBruto) ? Math.trunc(valorBruto) : 0;
  if (numero <= 0) return null;
  return {
    selo: limitarA9 && numero > 9 ? '9+' : String(numero),
    seloDescricao: `${numero} ${sufixoDescricao}`
  };
};

// ── WI-015: gestão dentro da página de origem ────────────────────────────
// Quem tem dois papéis (aluno presidente/vice ou professor com o painel,
// regra em src/constants/roles.js, temDoisPapeis) vê as telas de gestão numa
// seção da própria barra, com ids que não colidem com os do portal.
// Rótulos, ícones e dicas iguais aos do painel, exceto "Cadastro de atletas"
// (decisão 3: "Meus Atletas" continua sendo a rotina).
const GESTAO_ITEM_DEFS = Object.freeze({
  users: { rotulo: 'Membros', icone: 'UserCog', dica: 'Equipe interna da liga' },
  patients: { rotulo: 'Cadastro de atletas', icone: 'UserCircle', dica: 'Pessoas atendidas e acompanhadas' },
  requests: { rotulo: 'Solicitações', icone: 'Inbox', dica: 'Pedidos e aprovações pendentes' },
  reports: { rotulo: 'Relatórios', icone: 'FileText', dica: 'Indicadores e histórico' },
  settings: { rotulo: 'Configurações', icone: 'Settings', dica: 'Preferências e parâmetros' }
});

// Rótulo de cada tela de gestão pelo id da página única (cabeçalhos).
export const ROTULOS_DE_GESTAO = Object.freeze(Object.fromEntries(
  Object.entries(GESTAO_ITEM_DEFS).map(([tab, def]) => [ABA_DE_GESTAO_NA_PAGINA_UNICA[tab], def.rotulo])
));

// Ids da página única que esta pessoa pode abrir (as views aceitam só estes).
export const getAreasDeGestao = (user) => (
  getAbasDeGestaoEmbutidas(user).map((tab) => ABA_DE_GESTAO_NA_PAGINA_UNICA[tab])
);

// Seção de gestão para o portal `paginaDoPortal` ('/aluno' ou '/professor'),
// ou null. Só aparece no portal de origem da pessoa: em outro portal, os
// links levariam a uma página que não tem essas telas.
const buildSecaoGestao = ({ user, capabilities, requestsCount, paginaDoPortal, id, titulo }) => {
  const pessoa = { ...user, capabilities };
  if (getPaginaDeOrigem(pessoa.role) !== paginaDoPortal) return null;
  const selo = buildSelo(requestsCount, { sufixoDescricao: 'solicitações pendentes' });
  const itens = getAbasDeGestaoEmbutidas(pessoa).map((tab) => ({
    id: ABA_DE_GESTAO_NA_PAGINA_UNICA[tab],
    ...GESTAO_ITEM_DEFS[tab],
    ...(tab === 'requests' && selo ? selo : {})
  }));
  return itens.length > 0 ? { id, titulo, itens } : null;
};

// ── Admin ────────────────────────────────────────────────────────────────
// As abas (inclusive as quatro áreas) vêm de getAllowedAdminTabsFromCapabilities
// - a MESMA função de hoje - e não de liga.areas: no admin, uma área só
// aparece por gerência (liga.gerencia), não por leitura.
function buildAdminModel({ user, capabilities, requestsCount }) {
  const role = normalizeRole(user?.role);
  const allowedTabs = getAllowedAdminTabsFromCapabilities(capabilities);
  const has = (id) => allowedTabs.includes(id);
  const selo = buildSelo(requestsCount, { sufixoDescricao: 'solicitações pendentes' });

  const secoes = [
    {
      id: 'overview', titulo: 'Visão Geral',
      itens: [has('dashboard') && { id: 'dashboard', rotulo: 'Início', icone: 'LayoutDashboard', dica: 'Resumo do painel' }].filter(Boolean)
    },
    {
      id: 'people', titulo: 'Pessoas',
      itens: [
        has('users') && { id: 'users', rotulo: 'Membros', icone: 'Users', dica: 'Equipe interna da liga' },
        has('patients') && { id: 'patients', rotulo: 'Atletas', icone: 'UserCircle', dica: 'Pessoas atendidas e acompanhadas' }
      ].filter(Boolean)
    },
    {
      id: 'areas', titulo: 'Áreas',
      // Dicas da sidebar recolhida do admin, iguais às de antes (paridade).
      itens: LIGA_ITEM_DEFS.filter((def) => has(def.id)).map((def) => ({ id: def.id, rotulo: def.rotulo, icone: def.icone, dica: DICAS_AREAS_ADMIN[def.id], filhos: getAcademicChildren(def.id) }))
    },
    {
      id: 'management', titulo: 'Gestão',
      itens: [
        has('requests') && { id: 'requests', rotulo: 'Solicitações', icone: 'Inbox', dica: 'Pedidos e aprovações pendentes', ...(selo || {}) },
        has('reports') && { id: 'reports', rotulo: 'Relatórios', icone: 'FileText', dica: 'Indicadores e histórico' }
      ].filter(Boolean)
    },
    {
      id: 'system', titulo: 'Sistema',
      itens: [has('settings') && { id: 'settings', rotulo: 'Configurações', icone: 'Settings', dica: 'Preferências e parâmetros' }].filter(Boolean)
    }
  ].filter((secao) => secao.itens.length > 0);

  // "Portal do Professor": condição preservada ao pé da letra - permissão
  // avulsa 'admin:access' em user.permissions, não capabilities (ver relatório
  // sobre a nota de paridade canAccessAdmin -> capabilities.gestao.painel).
  const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
  const podeAbrirProfessor = ['professor', 'profissional', 'pesquisador'].includes(role) && permissions.includes('admin:access');

  const atalhos = [];
  if (isStudentMemberRole(role)) {
    atalhos.push({ id: 'aluno', rotulo: 'Área do Aluno', icone: 'GraduationCap', cor: '#60a5fa', destino: '/aluno', usarActiveTabComoRetorno: true });
  }
  if (podeAbrirProfessor) {
    atalhos.push({ id: 'professor', rotulo: 'Portal do Professor', icone: 'GraduationCap', cor: '#a78bfa', destino: '/professor' });
  }

  const nomeBruto = user?.name || user?.nome || '';
  return {
    papel: { titulo: ADMIN_ROLE_LABELS[role] || 'Administração', subtitulo: null },
    secoes,
    atalhos,
    rodape: { nome: nomeBruto || 'Admin', iniciais: getInitials(nomeBruto, 'AD'), tag: null }
  };
}

// ── Aluno ────────────────────────────────────────────────────────────────
// Liga: capabilities.liga.areas (leitura), igual para todo membro discente.
// Minha diretoria: só capabilities.liga.gerencia - não é consequência de ter
// diretoria, é o que o servidor autorizou (docs/.../sidebars-v2, UPD-13).
function buildAlunoModel({ user, capabilities, requestsCount }) {
  const role = normalizeRole(user?.role);
  const areasPermitidas = Array.isArray(capabilities?.liga?.areas) ? capabilities.liga.areas : [];
  const gerenciaAreas = Array.isArray(capabilities?.liga?.gerencia) ? capabilities.liga.gerencia : [];
  const semVinculo = capabilities?.atendimento?.motivo === 'sem_vinculo';
  const aviso = semVinculo ? AVISO_SEM_VINCULO : undefined;

  // Espalha {aviso} só quando existe: a chave nem aparece no item quando a
  // pessoa tem vínculo, em vez de aparecer com valor undefined.
  const comAviso = aviso ? { aviso } : {};
  const rotinaItens = [
    { id: 'dashboard', rotulo: 'Visão Geral', icone: 'LayoutDashboard' },
    { id: 'patients', rotulo: 'Meus Atletas', icone: 'Users', ...comAviso },
    { id: 'agenda', rotulo: 'Minha Agenda', icone: 'Calendar', ...comAviso }
  ];

  const diretoriaIds = new Set();
  const diretoriaItens = gerenciaAreas.reduce((acc, area) => {
    const rootTab = LIGA_AREA_ROOT_TABS[area];
    if (!rootTab || diretoriaIds.has(rootTab)) return acc;
    diretoriaIds.add(rootTab);
    acc.push({ id: rootTab, rotulo: getLigaAreaLabel(area), icone: 'Landmark' });
    return acc;
  }, []);

  const avaliacaoItens = [{ id: 'imagem', rotulo: 'Avaliação por imagem', icone: 'Camera', ...comAviso }];

  const comDica = semVinculo ? { dica: DICA_SEM_VINCULO } : {};
  // WI-015: com dois papéis, a direção entra aqui e o atalho para /admin sai.
  const secaoDirecao = buildSecaoGestao({
    user, capabilities, requestsCount, paginaDoPortal: '/aluno', id: 'direcao', titulo: 'Direção'
  });
  const secoes = [
    { id: 'rotina', titulo: 'Minha rotina', itens: rotinaItens, ...comDica },
    { id: 'liga', titulo: 'Liga', itens: ligaItens(areasPermitidas) },
    diretoriaItens.length > 0 ? { id: 'diretoria', titulo: 'Minha diretoria', itens: diretoriaItens } : null,
    { id: 'avaliacoes', titulo: 'Avaliações', itens: avaliacaoItens, ...comDica },
    secaoDirecao
  ].filter(Boolean);

  const atalhos = [];
  if ((role === 'presidente' || role === 'vice') && !secaoDirecao) {
    atalhos.push({
      id: 'presidencia', rotulo: 'Presidência', icone: 'ShieldCheck', cor: '#34d399',
      destino: '/admin', lerRetornoDaLocalizacao: true
    });
  }

  const nomeBruto = user?.name || user?.nome || '';
  return {
    papel: { titulo: 'Estudante', subtitulo: 'Aluno da Liga' },
    secoes,
    atalhos,
    rodape: { nome: nomeBruto || 'Aluno', iniciais: getInitials(nomeBruto, 'AL'), tag: 'LAINES · Área do aluno' }
  };
}

// ── Professor ────────────────────────────────────────────────────────────
// Decisão 2: a seção "Áreas" (3 itens) vira "Liga" (4, com Comunicação),
// igual à leitura do aluno - capabilities.liga.areas manda, não uma lista
// fixa local (isso é o que a exclusão antiga em ProfessorView.jsx fazia).
function buildProfessorModel({ user, capabilities, requestsCount }) {
  const areasPermitidas = Array.isArray(capabilities?.liga?.areas) ? capabilities.liga.areas : [];
  // WI-015: com dois papéis, a gestão entra aqui e o atalho para /admin sai.
  const secaoGestao = buildSecaoGestao({
    user, capabilities, requestsCount, paginaDoPortal: '/professor', id: 'gestao', titulo: 'Gestão'
  });
  const secoes = [
    {
      id: 'supervisao', titulo: 'Supervisão',
      itens: [
        { id: 'dashboard', rotulo: 'Visão Geral', icone: 'LayoutDashboard' },
        { id: 'patients', rotulo: 'Alunos e Atletas', icone: 'Users' },
        { id: 'agenda', rotulo: 'Agenda', icone: 'CalendarDays' }
      ]
    },
    { id: 'liga', titulo: 'Liga', itens: ligaItens(areasPermitidas) },
    secaoGestao
  ].filter(Boolean);

  // Condição preservada ao pé da letra (user.canAccessAdmin), não trocada
  // por capabilities.gestao.painel: canAccessAdmin usa resolveAdminAccess,
  // que também conta gestao.usuarios/solicitacoes/pacientes/configuracoes
  // (hasManagementAccess) - só gestao.painel seria uma condição mais
  // estreita e esconderia o atalho para quem hoje o vê.
  const atalhos = user?.canAccessAdmin && !secaoGestao
    ? [{ id: 'admin', rotulo: 'Administração', icone: 'ShieldCheck', cor: '#60a5fa', destino: '/admin', estado: { returnTo: '/professor' } }]
    : [];

  const nomeBruto = user?.name || user?.nome || '';
  return {
    papel: { titulo: 'Professor', subtitulo: 'Supervisão ativa' },
    secoes,
    atalhos,
    rodape: { nome: nomeBruto || 'Professor', iniciais: getInitials(nomeBruto, 'PR'), tag: 'LAINES · Área do professor' }
  };
}

// ── Equipe (técnico) ────────────────────────────────────────────────────
// O ramo "profissional" (isMulti) de TeamSidebar.jsx é inalcançável - /equipe
// só aceita tecnico, e profissional vai para /professor (App.jsx) - por isso
// não existe aqui (ver relatório). Decisão 2: "Áreas" (3) vira "Liga" (4).
function buildEquipeModel({ user, capabilities }) {
  const areasPermitidas = Array.isArray(capabilities?.liga?.areas) ? capabilities.liga.areas : [];
  const secoes = [
    // Visão Geral: decisão do usuário de 26/09/2026 (docs/implementacao/visao-geral-v2/),
    // a aba inicial nova da equipe, na mesma posição que tem nos outros portais.
    { id: 'atendimento', titulo: 'Atendimento', itens: [{ id: 'dashboard', rotulo: 'Visão Geral', icone: 'LayoutDashboard' }, { id: 'atletas', rotulo: 'Atletas', icone: 'Users' }] },
    { id: 'liga', titulo: 'Liga', itens: ligaItens(areasPermitidas) }
  ];

  const nomeBruto = user?.name || user?.nome || '';
  return {
    papel: { titulo: 'Equipe Técnica', subtitulo: 'Acompanhamento esportivo' },
    secoes,
    atalhos: [],
    rodape: { nome: nomeBruto || 'Equipe', iniciais: getInitials(nomeBruto, 'ET'), tag: 'LAINES · Área da equipe' }
  };
}

// ── Atleta ───────────────────────────────────────────────────────────────
function buildAtletaModel({ user, pendingCount }) {
  const selo = buildSelo(pendingCount, { limitarA9: true, sufixoDescricao: 'pendências' });
  const nomeBruto = user?.name || user?.nome || '';
  return {
    papel: { titulo: 'Atleta', subtitulo: null },
    secoes: [{
      id: 'acompanhamento', titulo: 'Meu acompanhamento',
      itens: [
        // Visão Geral: aba inicial nova do atleta (visao-geral-v2, decisão do usuário).
        { id: 'dashboard', rotulo: 'Visão Geral', icone: 'LayoutDashboard' },
        { id: 'pendencias', rotulo: 'Pendências', icone: 'ClipboardCheck', ...(selo ? { selo: selo.selo, seloDescricao: selo.seloDescricao, seloPontoRecolhido: true } : {}) },
        { id: 'cadastro', rotulo: 'Cadastro', icone: 'UserRound' },
        { id: 'acompanhamento', rotulo: 'Acompanhamento', icone: 'TrendingUp' }
      ]
    }],
    atalhos: [],
    rodape: { nome: nomeBruto || 'Atleta', iniciais: getInitials(nomeBruto, 'AT'), tag: null }
  };
}

const BUILDERS = Object.freeze({
  admin: buildAdminModel,
  aluno: buildAlunoModel,
  professor: buildProfessorModel,
  equipe: buildEquipeModel,
  atleta: buildAtletaModel
});

export function buildSidebarModel({ portal, user, capabilities, pendingCount = 0, requestsCount = 0 }) {
  const builder = BUILDERS[portal];
  if (!builder) throw new Error(`buildSidebarModel: portal desconhecido "${portal}"`);
  return builder({ user, capabilities: capabilities || {}, pendingCount, requestsCount });
}
