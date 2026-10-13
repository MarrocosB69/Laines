// UPD-18 (frente "contexto do vínculo e fim do recadastro redundante") —
// UX-07 / "CLI cadastro": o UPD-12 criou `capabilities.atendimento` (server/
// src/auth/authorization.ts) com `habilitado`, `escopo` e `motivo`
// ('sem_vinculo' | 'perfil_sem_atendimento' | null), mas nenhuma tela lia
// `motivo` — quem entrava na área de atendimento sem habilitação via só uma
// lista vazia, sem saber por quê. O UPD-13 já havia tirado o bloqueio do
// cadastro; faltava a tela explicar o motivo e o caminho.
//
// Este script carrega a função PURA resolveAthletesPanelState de
// src/views/Student/StudentDashboard/StudentDashboard.jsx via esbuild +
// stubs (mesmo padrão de scripts/test-visualizacao-dados.cjs) — não
// reimplementa a regra à parte. Se a tela voltar a colapsar dois dos quatro
// estados (erro de carregamento, sem vínculo, perfil sem atendimento, vazio
// legítimo) na mesma saída, é a função REAL do componente que falha aqui.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('module');
const esbuild = require(path.join(__dirname, '..', 'node_modules', 'esbuild'));

const root = path.resolve(__dirname, '..');
const componentPath = path.join(root, 'src/views/Student/StudentDashboard/StudentDashboard.jsx');
const componentSource = fs.readFileSync(componentPath, 'utf8');

function carregarComponente() {
  const { code } = esbuild.transformSync(componentSource, {
    loader: 'jsx',
    format: 'cjs',
    target: 'node18',
    sourcefile: componentPath
  });

  // O componente React nunca é executado por este script — só as
  // const/function do topo do arquivo (resolveAthletesPanelState não usa
  // JSX nem hooks). Os stubs abaixo existem somente para o `require(...)`
  // dessas dependências não quebrar ao avaliar o módulo; nenhum precisa
  // fazer nada de verdade.
  const stubs = {
    react: { createElement: () => null, Fragment: Symbol('Fragment') },
    'lucide-react': new Proxy({}, { get: () => () => null }),
    '../../../services/api': { getApiErrorMessage: () => '' },
    '../../../contexts/PacienteContext': { usePacientes: () => ({}) },
    // Peças da Visão geral (visao-geral-v2): o Node não resolve .jsx aqui.
    '../../../components/painel/Painel': {},
    '../../../contexts/AuthContext': { useAuth: () => ({}) },
    '../../../contexts/UiFeedbackContext': { useUiFeedback: () => ({}) },
    '../../../utils/dateUtils': { toDateKey: () => '' },
    '../../../components/Dashboard/ProximasAcoes': {},
    '../../../components/ui': { FeedbackState: () => null },
    './StudentDashboard.css': {}
  };

  const originalLoad = Module._load;
  Module._load = function (request, ...rest) {
    if (Object.prototype.hasOwnProperty.call(stubs, request)) return stubs[request];
    return originalLoad.call(this, request, ...rest);
  };

  try {
    const mod = new Module(componentPath, null);
    mod.filename = componentPath;
    mod.paths = Module._nodeModulePaths(path.dirname(componentPath));
    mod._compile(code, componentPath);
    return mod.exports;
  } finally {
    Module._load = originalLoad;
  }
}

const { resolveAthletesPanelState } = carregarComponente();

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`PASS ${name}`);
}

// ── Fixtures dos quatro estados exigidos pela auditoria ────────────────────
const ESTADO_CARREGANDO = { loading: true, error: null, atendimento: null, totalPacientes: 0 };
const ESTADO_ERRO = {
  loading: false,
  error: 'Erro ao carregar pacientes. Tente novamente.',
  atendimento: { habilitado: true, motivo: null },
  totalPacientes: 0
};
const ESTADO_SEM_VINCULO = {
  loading: false,
  error: null,
  atendimento: { habilitado: false, escopo: 'nenhum', motivo: 'sem_vinculo' },
  totalPacientes: 0
};
const ESTADO_PERFIL_SEM_ATENDIMENTO = {
  loading: false,
  error: null,
  atendimento: { habilitado: false, escopo: 'nenhum', motivo: 'perfil_sem_atendimento' },
  totalPacientes: 0
};
const ESTADO_VAZIO_LEGITIMO = {
  loading: false,
  error: null,
  atendimento: { habilitado: true, escopo: 'vinculo', motivo: null },
  totalPacientes: 0
};
const ESTADO_LISTA = {
  loading: false,
  error: null,
  atendimento: { habilitado: true, escopo: 'vinculo', motivo: null },
  totalPacientes: 3
};

(() => {
  // ── 1. Cada estado produz o `kind` esperado ───────────────────────────
  check('carregando produz kind "loading"', () => {
    assert.equal(resolveAthletesPanelState(ESTADO_CARREGANDO).kind, 'loading');
  });

  check('sem_vinculo produz mensagem de habilitação pendente, não erro nem vazio comum', () => {
    const estado = resolveAthletesPanelState(ESTADO_SEM_VINCULO);
    assert.equal(estado.kind, 'sem_vinculo');
    assert.match(estado.description, /supervisor/i);
    assert.match(estado.description, /projeto/i);
    assert.notEqual(estado.kind, 'erro');
    assert.notEqual(estado.kind, 'vazio');
  });

  check('perfil_sem_atendimento produz mensagem distinta de sem_vinculo (área não se oferece)', () => {
    const semVinculo = resolveAthletesPanelState(ESTADO_SEM_VINCULO);
    const perfilSemAtendimento = resolveAthletesPanelState(ESTADO_PERFIL_SEM_ATENDIMENTO);
    assert.equal(perfilSemAtendimento.kind, 'perfil_sem_atendimento');
    assert.notEqual(perfilSemAtendimento.title, semVinculo.title);
    assert.notEqual(perfilSemAtendimento.description, semVinculo.description);
    // Quem não atende por perfil não deve ser mandado "procurar a
    // coordenação" para vincular supervisor/projeto — isso resolveria
    // sem_vinculo, não perfil_sem_atendimento.
    assert.doesNotMatch(perfilSemAtendimento.description, /procure a coordenação/i);
  });

  check('motivo ausente/desconhecido com habilitado=false cai em perfil_sem_atendimento, nunca trava', () => {
    const semMotivo = resolveAthletesPanelState({
      loading: false, error: null, atendimento: { habilitado: false, motivo: null }, totalPacientes: 0
    });
    assert.equal(semMotivo.kind, 'perfil_sem_atendimento');
    const semAtendimento = resolveAthletesPanelState({
      loading: false, error: null, atendimento: null, totalPacientes: 0
    });
    assert.equal(semAtendimento.kind, 'perfil_sem_atendimento');
  });

  check('habilitado=true com zero pacientes produz o vazio legítimo, distinto dos dois anteriores', () => {
    const vazio = resolveAthletesPanelState(ESTADO_VAZIO_LEGITIMO);
    assert.equal(vazio.kind, 'vazio');
    assert.match(vazio.title, /nenhum atleta vinculado/i);
  });

  check('erro de carregamento continua distinto de todos os outros três', () => {
    const erro = resolveAthletesPanelState(ESTADO_ERRO);
    assert.equal(erro.kind, 'erro');
    assert.equal(erro.description, ESTADO_ERRO.error, 'a mensagem real do erro deve chegar à tela, não um texto genérico');
  });

  check('habilitado=true com pacientes produz "lista" (não intercepta o estado normal)', () => {
    assert.equal(resolveAthletesPanelState(ESTADO_LISTA).kind, 'lista');
  });

  // ── 2. Precedência: carregando e erro nunca perdem para o motivo ───────
  check('loading tem prioridade sobre erro e sobre o motivo de atendimento', () => {
    const estado = resolveAthletesPanelState({
      loading: true,
      error: 'algum erro',
      atendimento: { habilitado: false, motivo: 'sem_vinculo' },
      totalPacientes: 0
    });
    assert.equal(estado.kind, 'loading');
  });

  check('erro de carregamento tem prioridade sobre o motivo de atendimento (não inventa "sem vínculo" quando a causa é a rede)', () => {
    const estado = resolveAthletesPanelState({
      loading: false,
      error: 'falha de rede',
      atendimento: { habilitado: false, motivo: 'sem_vinculo' },
      totalPacientes: 0
    });
    assert.equal(estado.kind, 'erro');
  });

  // ── 3. Prova mecânica de que os quatro estados nunca colapsam ──────────
  check('os quatro estados exigidos pela auditoria produzem quatro saídas distintas', () => {
    const saidas = [
      resolveAthletesPanelState(ESTADO_ERRO),
      resolveAthletesPanelState(ESTADO_SEM_VINCULO),
      resolveAthletesPanelState(ESTADO_PERFIL_SEM_ATENDIMENTO),
      resolveAthletesPanelState(ESTADO_VAZIO_LEGITIMO)
    ].map((estado) => JSON.stringify({ kind: estado.kind, title: estado.title, description: estado.description }));

    const unicas = new Set(saidas);
    assert.equal(
      unicas.size,
      saidas.length,
      `dois ou mais dos quatro estados produziram a mesma saída: ${JSON.stringify(saidas)}`
    );
  });

  console.log(`\n${passed} verificações passaram (UPD-18 — contexto do vínculo de atendimento).`);
})();
