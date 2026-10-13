import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ADMIN_AREA_ROLES,
  PROFESSOR_AREA_ROLES,
  getAbaNaPaginaUnica,
  getAbasDeGestaoEmbutidas,
  getGestaoTabsFromCapabilities,
  getPaginaDeOrigem,
  getRedirecionamentoPaginaUnica,
  getRedirectPathFromRole,
  normalizeRole,
  temDoisPapeis
} from '../../src/constants/roles.js';

// WI-015: perfis sintéticos. `gestao` monta capabilities.gestao como o
// servidor envia (server/src/auth/authorization.ts, buildCapabilities).
const capsGestao = (itens = {}) => ({
  gestao: {
    painel: false, usuarios: false, solicitacoes: false, pacientes: false, configuracoes: false,
    relatorios: { painel: false, operacional: false, detalhado: false, exportacao: false, perfilAtletas: false },
    ...itens
  }
});
// Presidente com users:manage e requests:review: o servidor dá
// relatorios.painel, mas não relatorios.exportacao (WI-016: sem Relatórios).
const CAPS_DIRECAO = capsGestao({ painel: true, usuarios: true, solicitacoes: true, relatorios: { painel: true } });
const presidenteComGestao = { role: 'presidente', canAccessAdmin: true, capabilities: CAPS_DIRECAO };
// Professor com research:manage: o servidor dá relatorios.painel e .exportacao.
const professorComGestao = { role: 'professor', canAccessAdmin: true, capabilities: capsGestao({ painel: true, relatorios: { painel: true, exportacao: true } }) };

test('normalizeRole normaliza variacoes comuns', () => {
  assert.equal(normalizeRole('Diretoria de Extensao'), 'diretoria_extensao');
  assert.equal(normalizeRole('COORDENACAO GERAL'), 'coordenacao');
  assert.equal(normalizeRole('Vice-Presidente'), 'vice');
  assert.equal(normalizeRole('student'), 'aluno');
  assert.equal(normalizeRole('Parceiro'), 'colaborador');
});

test('getRedirectPathFromRole resolve rotas por perfil', () => {
  assert.equal(getRedirectPathFromRole('admin'), '/admin');
  // UPD-13: diretoria e uma atribuicao do discente; nao troca o ambiente inicial.
  assert.equal(getRedirectPathFromRole('diretoria_extensao'), '/aluno');
  assert.equal(getRedirectPathFromRole('coord_atendimento'), '/admin');
  assert.equal(getRedirectPathFromRole('professor'), '/professor');
  assert.equal(getRedirectPathFromRole('aluno'), '/aluno');
  assert.equal(getRedirectPathFromRole('tecnico'), '/equipe');
  assert.equal(getRedirectPathFromRole('atleta'), '/atleta');
  // Papel desconhecido nunca vai para '/': a raiz redireciona de volta e vira laco.
  assert.equal(getRedirectPathFromRole('desconhecido'), '/aluno');
});

test('WI-015: pagina de origem so para aluno, presidente, vice, professor, profissional e pesquisador', () => {
  ['aluno', 'presidente', 'vice'].forEach((role) => assert.equal(getPaginaDeOrigem(role), '/aluno', role));
  ['professor', 'profissional', 'pesquisador'].forEach((role) => assert.equal(getPaginaDeOrigem(role), '/professor', role));
  ['admin', 'coordenacao', 'coord_atendimento', 'tecnico', 'atleta', 'colaborador', 'diretoria_ensino'].forEach((role) => {
    assert.equal(getPaginaDeOrigem(role), null, `${role} nao tem pagina de origem alem de /admin`);
  });
  // Chave herdada de Object.prototype nao vira pagina.
  assert.equal(getPaginaDeOrigem('constructor'), null);
});

test('WI-015: telas de gestao seguem capabilities.gestao, na ordem do painel', () => {
  assert.deepEqual(getGestaoTabsFromCapabilities(null), []);
  assert.deepEqual(getGestaoTabsFromCapabilities(capsGestao({ painel: true })), [], 'so o painel nao e tela de gestao');
  assert.deepEqual(
    getGestaoTabsFromCapabilities(capsGestao({ usuarios: true, pacientes: true, solicitacoes: true, configuracoes: true, relatorios: { painel: true, exportacao: true } })),
    ['users', 'patients', 'requests', 'reports', 'settings']
  );
});

test('WI-016: a aba Relatorios segue relatorios.exportacao, a mesma regra dos endpoints', () => {
  // So o painel (relatorios.painel) nao abre mais a aba: os endpoints da tela
  // respondiam 403 para esse perfil (canAccessAnalyticsReports).
  assert.deepEqual(getGestaoTabsFromCapabilities(capsGestao({ painel: true, relatorios: { painel: true } })), []);
  assert.deepEqual(getGestaoTabsFromCapabilities(capsGestao({ relatorios: { painel: false, exportacao: true } })), ['reports']);
  assert.deepEqual(getGestaoTabsFromCapabilities(capsGestao({ painel: true, relatorios: { painel: true, exportacao: true } })), ['reports']);
  // Capacidade antiga sem `exportacao` (sessao velha): nada de Relatorios.
  assert.deepEqual(getGestaoTabsFromCapabilities({ gestao: { relatorios: { painel: true } } }), []);
});

test('WI-016: o perfil dos atletas tambem abre a aba Relatorios; sem os dois, nada', () => {
  // A aba abre com exportacao OU perfilAtletas, e com nenhum outro item.
  [[false, false], [true, false], [false, true], [true, true]].forEach(([exportacao, perfilAtletas]) => {
    const abas = getGestaoTabsFromCapabilities(capsGestao({ painel: true, relatorios: { painel: true, operacional: true, detalhado: true, exportacao, perfilAtletas } }));
    assert.deepEqual(abas, exportacao || perfilAtletas ? ['reports'] : [], `exportacao=${exportacao} perfilAtletas=${perfilAtletas}`);
  });
  // coord_atendimento: o servidor da gestao.pacientes e relatorios.perfilAtletas,
  // sem relatorios.exportacao (canAccessAthleteProfileAggregates). Ganha a aba,
  // so com o Perfil dos atletas, e continua no painel, sem pagina unica.
  const coordAtendimento = {
    role: 'coord_atendimento',
    canAccessAdmin: true,
    capabilities: capsGestao({ pacientes: true, relatorios: { painel: false, operacional: false, detalhado: false, exportacao: false, perfilAtletas: true } })
  };
  assert.deepEqual(getGestaoTabsFromCapabilities(coordAtendimento.capabilities), ['patients', 'reports']);
  assert.equal(temDoisPapeis(coordAtendimento), false);
  assert.equal(getRedirectPathFromRole('coord_atendimento', coordAtendimento), '/admin');
  assert.equal(getRedirecionamentoPaginaUnica(coordAtendimento, { tab: 'reports' }), null, 'continua no painel');
  // Presidente com Relatorios: o perfil nao muda nada, a aba ja vinha da exportacao.
  const presidente = { ...presidenteComGestao, capabilities: capsGestao({ painel: true, usuarios: true, relatorios: { painel: true, exportacao: true, perfilAtletas: true } }) };
  assert.deepEqual(getAbasDeGestaoEmbutidas(presidente), ['users', 'reports']);
});

test('WI-016: quem so tinha o painel perde a aba e, sem outra tela de gestao, a pagina unica', () => {
  // Professor com admin:access e aluno de diretoria de Pesquisa/Ensino/Extensao
  // (research:create etc.): o servidor da relatorios.painel, nao .exportacao.
  const soPainel = capsGestao({ painel: true, relatorios: { painel: true } });
  const professorSoPainel = { role: 'professor', canAccessAdmin: true, capabilities: soPainel };
  const diretorPesquisa = { role: 'aluno', canAccessAdmin: true, capabilities: soPainel };
  assert.deepEqual(getAbasDeGestaoEmbutidas(professorSoPainel), []);
  assert.equal(temDoisPapeis(professorSoPainel), false);
  assert.equal(getRedirectPathFromRole('professor', professorSoPainel), '/admin', 'volta ao painel, como antes do WI-015');
  assert.equal(temDoisPapeis(diretorPesquisa), false);
  assert.equal(getRedirectPathFromRole('aluno', diretorPesquisa), '/admin');
  // Com outra tela de gestao, continua com dois papeis, so sem Relatorios.
  assert.deepEqual(getAbasDeGestaoEmbutidas(presidenteComGestao), ['users', 'requests']);
  assert.equal(getRedirectPathFromRole('presidente', presidenteComGestao), '/aluno');
});

test('WI-015: dois papeis exige pagina de origem, portao de /admin e alguma tela de gestao', () => {
  assert.equal(temDoisPapeis(presidenteComGestao), true);
  assert.deepEqual(getAbasDeGestaoEmbutidas(presidenteComGestao), ['users', 'requests']);
  assert.equal(temDoisPapeis(professorComGestao), true);
  assert.deepEqual(getAbasDeGestaoEmbutidas(professorComGestao), ['reports']);
  // Sem capabilities.gestao: nada de gestao, mesmo presidente.
  assert.equal(temDoisPapeis({ role: 'presidente', canAccessAdmin: false, capabilities: capsGestao() }), false);
  // Sem o portao de /admin, a capacidade sozinha nao embute nada (sem acesso novo).
  assert.equal(temDoisPapeis({ role: 'presidente', canAccessAdmin: false, capabilities: CAPS_DIRECAO }), false);
  // Portao aberto mas nenhuma tela de gestao: continua com duas paginas, como antes.
  assert.equal(temDoisPapeis({ role: 'professor', canAccessAdmin: true, capabilities: capsGestao({ painel: true }) }), false);
  // Admin, coordenacao e coordenacao de atendimento nunca: so tem /admin.
  const tudo = capsGestao({ painel: true, usuarios: true, pacientes: true, solicitacoes: true, configuracoes: true, relatorios: { painel: true, exportacao: true } });
  ['admin', 'coordenacao', 'coord_atendimento', 'tecnico', 'atleta', 'colaborador'].forEach((role) => {
    assert.equal(temDoisPapeis({ role, canAccessAdmin: true, capabilities: tudo }), false, role);
  });
});

test('WI-015: o login leva quem tem dois papeis a pagina de origem; os demais, como antes', () => {
  assert.equal(getRedirectPathFromRole('presidente', presidenteComGestao), '/aluno');
  assert.equal(getRedirectPathFromRole('vice', { ...presidenteComGestao, role: 'vice' }), '/aluno');
  assert.equal(getRedirectPathFromRole('professor', professorComGestao), '/professor');
  assert.equal(getRedirectPathFromRole('pesquisador', { ...professorComGestao, role: 'pesquisador' }), '/professor');
  // Iguais a antes.
  assert.equal(getRedirectPathFromRole('presidente', { role: 'presidente' }), '/aluno');
  assert.equal(getRedirectPathFromRole('aluno', { canAccessAdmin: true }), '/admin', 'portao sem tela de gestao: painel, como antes');
  assert.equal(getRedirectPathFromRole('coord_atendimento', { canAccessAdmin: true, capabilities: capsGestao({ pacientes: true }) }), '/admin');
  assert.equal(getRedirectPathFromRole('colaborador', { canAccessAdmin: true, capabilities: CAPS_DIRECAO }), '/admin');
  assert.equal(getRedirectPathFromRole('admin', { canAccessAdmin: true, capabilities: CAPS_DIRECAO }), '/admin');
});

test('WI-015: /admin de quem tem dois papeis vai a aba equivalente da pagina unica', () => {
  assert.equal(getAbaNaPaginaUnica('users'), 'gestao_membros');
  assert.equal(getAbaNaPaginaUnica('patients'), 'gestao_atletas');
  assert.equal(getAbaNaPaginaUnica('research_projects'), 'research_projects', 'subsecao da Liga mantem o id');
  assert.equal(getAbaNaPaginaUnica(''), 'dashboard');
  assert.equal(getAbaNaPaginaUnica('constructor'), 'constructor', 'chave herdada nao vira aba de gestao');

  assert.deepEqual(getRedirecionamentoPaginaUnica(presidenteComGestao, { tab: 'requests' }), { to: '/aluno?area=gestao_solicitacoes', state: null });
  assert.deepEqual(getRedirecionamentoPaginaUnica(presidenteComGestao, {}), { to: '/aluno', state: null });
  assert.deepEqual(getRedirecionamentoPaginaUnica(professorComGestao, { tab: 'ensino_materiais' }), { to: '/professor?area=ensino_materiais', state: null });
  // Retorno do prontuario aberto no painel: returnTab vira returnView.
  assert.deepEqual(
    getRedirecionamentoPaginaUnica(professorComGestao, { tab: 'patients', state: { selectedPatientId: 'pac-sintetico', returnTab: 'patients' } }),
    { to: '/professor?area=gestao_atletas', state: { selectedPatientId: 'pac-sintetico', returnView: 'gestao_atletas' } }
  );
  // Quem nao tem dois papeis fica no painel.
  assert.equal(getRedirecionamentoPaginaUnica({ role: 'admin', canAccessAdmin: true, capabilities: CAPS_DIRECAO }, { tab: 'users' }), null);
  assert.equal(getRedirecionamentoPaginaUnica({ role: 'coord_atendimento', canAccessAdmin: true, capabilities: capsGestao({ pacientes: true }) }, {}), null);
  assert.equal(getRedirecionamentoPaginaUnica(null, {}), null);
});

test('constantes de papeis essenciais estao presentes', () => {
  // coord_atendimento chega a /admin por capacidade de gestao, nao por papel administrativo.
  assert.equal(ADMIN_AREA_ROLES.includes('coord_atendimento'), false);
  assert.ok(PROFESSOR_AREA_ROLES.includes('profissional'));
});
