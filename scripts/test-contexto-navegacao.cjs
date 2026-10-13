// UPD-18 (frente "contexto na navegação") — UX-07: StudentView.jsx e
// ProfessorView.jsx guardavam a área ativa em useState, então F5, voltar no
// navegador ou compartilhar o endereço não recuperavam onde a pessoa estava.
//
// Este teste exercita a lógica PURA de src/hooks/useAreaNavegacao.js
// (resolveArea / buildAreaSearchParams), não o hook React em si — sem DOM,
// sem router montado. Ele falha se a leitura da área voltar a ignorar a
// query string (ex.: se resolveArea passar a devolver sempre o padrão, ou se
// buildAreaSearchParams passar a descartar os demais parâmetros da URL).
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const root = path.resolve(__dirname, '..');
const esbuild = require(path.join(root, 'node_modules', 'esbuild'));

// useAreaNavegacao.js importa 'react' e 'react-router-dom' (para o hook em
// si), mas resolveArea/buildAreaSearchParams não tocam nenhum dos dois.
// Bundlar com esbuild (mesmo padrão de scripts/test-navegacao-liga.cjs)
// resolve os imports relativos do projeto; react/react-router-dom só
// precisam existir em node_modules para o require funcionar — nunca são
// executados, já que este teste não chama useAreaNavegacao().
function carregarModulosSrc() {
  const entrySource = [
    "export * as areaNavegacao from './src/hooks/useAreaNavegacao.js';",
    // WI-015: ids de gestão que a página única aceita, por pessoa.
    "export * as sidebarModel from './src/navigation/sidebarModel.js';"
  ].join('\n');

  const result = esbuild.buildSync({
    stdin: { contents: entrySource, resolveDir: root, loader: 'js' },
    bundle: true,
    format: 'cjs',
    platform: 'node',
    target: 'node18',
    write: false
  });

  const code = result.outputFiles[0].text;
  const bundlePath = path.join(root, 'scripts', '__test-contexto-navegacao-bundle.cjs');
  const mod = new Module(bundlePath, null);
  mod.filename = bundlePath;
  mod.paths = Module._nodeModulePaths(root);
  mod._compile(code, bundlePath);
  return mod.exports;
}

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`PASS ${name}`);
}

(() => {
  const {
    areaNavegacao: { resolveArea, buildAreaSearchParams },
    sidebarModel: { getAreasDeGestao }
  } = carregarModulosSrc();

  const STUDENT_AREAS = ['dashboard', 'patients', 'agenda', 'imagem', 'research', 'ensino', 'extensao', 'comunicacao'];
  // "comunicacao" entrou em 26/09/2026 (decisão 2,
  // docs/implementacao/sidebars-v2/change-intent.md — ProfessorView.jsx,
  // LIGA_ROOTS_PROFESSOR): o servidor já autoriza as quatro áreas da liga
  // para todo não atleta, e a exclusão anterior era só do cliente. "imagem"
  // (avaliação por imagem) continua exclusiva do aluno — é o caso usado
  // abaixo para provar que link profundo para área fora do perfil ainda
  // cai no padrão.
  const PROFESSOR_AREAS = ['dashboard', 'patients', 'agenda', 'research', 'ensino', 'extensao', 'comunicacao'];

  // ── 1. Leitura da query string ──────────────────────────────────────────
  check('área válida na query string é devolvida', () => {
    assert.equal(resolveArea('area=agenda', STUDENT_AREAS, 'dashboard'), 'agenda');
  });

  check('lixo na query string devolve o padrão, não quebra', () => {
    assert.equal(resolveArea('area=%00%%%lixo', STUDENT_AREAS, 'dashboard'), 'dashboard');
    assert.equal(resolveArea('area=inexistente', STUDENT_AREAS, 'dashboard'), 'dashboard');
  });

  check('ausência de área na query string devolve o padrão', () => {
    assert.equal(resolveArea('', STUDENT_AREAS, 'dashboard'), 'dashboard');
    assert.equal(resolveArea('outraCoisa=1', STUDENT_AREAS, 'dashboard'), 'dashboard');
  });

  check('aceita URLSearchParams já construído, não só string', () => {
    const params = new URLSearchParams();
    params.set('area', 'patients');
    assert.equal(resolveArea(params, STUDENT_AREAS, 'dashboard'), 'patients');
  });

  check('paramName customizado é respeitado (ex.: "tab" do AdminView)', () => {
    assert.equal(resolveArea('tab=research', STUDENT_AREAS, 'dashboard', 'tab'), 'research');
    // Com o nome padrão ("area"), o mesmo valor sob "tab" é ignorado.
    assert.equal(resolveArea('tab=research', STUDENT_AREAS, 'dashboard'), 'dashboard');
  });

  // ── 2. Troca de área preserva os demais parâmetros da URL ──────────────
  check('trocar de área produz a query string esperada', () => {
    const next = buildAreaSearchParams('', 'agenda');
    assert.equal(next.get('area'), 'agenda');
  });

  check('trocar de área não descarta paciente/filtro já presentes na URL', () => {
    const atual = new URLSearchParams('area=patients&paciente=abc123&pagina=2');
    const next = buildAreaSearchParams(atual, 'agenda');
    assert.equal(next.get('area'), 'agenda');
    assert.equal(next.get('paciente'), 'abc123', 'paciente não pode ser descartado ao trocar de área');
    assert.equal(next.get('pagina'), '2', 'outros filtros não podem ser descartados ao trocar de área');
  });

  check('buildAreaSearchParams não muta o URLSearchParams recebido (é uma cópia)', () => {
    const atual = new URLSearchParams('area=dashboard');
    const next = buildAreaSearchParams(atual, 'agenda');
    assert.equal(atual.get('area'), 'dashboard', 'o objeto original não deve ser alterado');
    assert.equal(next.get('area'), 'agenda');
    assert.notEqual(next, atual);
  });

  // ── 3. Área permitida por perfil ────────────────────────────────────────
  // Mesmo achado do UX-07 aplicado ao gate por perfil: cada área só é
  // concedida se estiver na lista do perfil — um link profundo não pode dar
  // o que o perfil não tem.
  check('aluno recebe "comunicacao" quando ela vem na URL (perfil autorizado)', () => {
    assert.equal(resolveArea('area=comunicacao', STUDENT_AREAS, 'dashboard'), 'comunicacao');
  });

  // Decisão 2 de 26/09/2026: professor passou a ter "comunicacao" (era
  // excluída antes; ver comentário de PROFESSOR_AREAS acima).
  check('professor recebe "comunicacao" quando ela vem na URL (perfil autorizado desde 26/09/2026)', () => {
    assert.equal(resolveArea('area=comunicacao', PROFESSOR_AREAS, 'dashboard'), 'comunicacao');
  });

  check('professor NÃO recebe "imagem" vindo na URL (perfil sem essa área — exclusiva do aluno)', () => {
    assert.equal(resolveArea('area=imagem', PROFESSOR_AREAS, 'dashboard'), 'dashboard');
  });

  check('link profundo para área de outro perfil cai no padrão, sem lançar erro', () => {
    assert.doesNotThrow(() => resolveArea('area=imagem', PROFESSOR_AREAS, 'dashboard'));
  });

  // A lista local PROFESSOR_AREAS acima é uma cópia; sem esta verificação,
  // reverter a Comunicação nas telas passaria despercebido (a sidebar
  // mostraria o item e o clique cairia em silêncio na aba inicial).
  check('as telas do professor e da equipe aceitam as quatro áreas da liga (decisão 2 de 26/09/2026)', () => {
    const fsLocal = require('node:fs');
    const pathLocal = require('node:path');
    const raiz = pathLocal.resolve(__dirname, '..');
    for (const [arquivo, constante] of [['src/views/professor/ProfessorView.jsx', 'LIGA_ROOTS_PROFESSOR'], ['src/views/Team/TeamPortal.jsx', 'LIGA_ROOTS_EQUIPE']]) {
      const fonte = fsLocal.readFileSync(pathLocal.join(raiz, arquivo), 'utf8');
      const achado = fonte.match(new RegExp(`const ${constante} = \\[([^\\]]*)\\]`));
      assert.ok(achado, `${constante} não encontrado em ${arquivo}`);
      const areas = [...achado[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
      assert.deepEqual(areas, ['research', 'ensino', 'extensao', 'comunicacao'], `${arquivo}: ${constante}`);
    }
  });

  // ── 4. WI-015: telas de gestão na página única ──────────────────────────
  // As views somam getAreasDeGestao(user) às próprias áreas; um link para
  // uma tela de gestão só abre para quem o servidor autoriza (capabilities)
  // e já passava no portão de /admin (canAccessAdmin).
  const gestao = (itens) => ({ gestao: { painel: true, relatorios: { painel: false }, ...itens } });
  const presidente = { role: 'presidente', canAccessAdmin: true, capabilities: gestao({ usuarios: true, solicitacoes: true }) };
  // WI-016: Relatórios exige relatorios.exportacao (research:manage no servidor).
  const professor = { role: 'professor', canAccessAdmin: true, capabilities: gestao({ relatorios: { painel: true, exportacao: true } }) };
  const professorSoPainel = { role: 'professor', canAccessAdmin: true, capabilities: gestao({ relatorios: { painel: true } }) };
  const areasDe = (base, user) => [...base, ...getAreasDeGestao(user)];

  check('WI-015: presidente com gestão abre as telas de gestão autorizadas por link (F5, voltar)', () => {
    assert.equal(resolveArea('area=gestao_membros', areasDe(STUDENT_AREAS, presidente), 'dashboard'), 'gestao_membros');
    assert.equal(resolveArea('area=gestao_solicitacoes', areasDe(STUDENT_AREAS, presidente), 'dashboard'), 'gestao_solicitacoes');
  });

  check('WI-015: tela de gestão não autorizada cai no padrão, mesmo para quem tem dois papéis', () => {
    assert.equal(resolveArea('area=gestao_configuracoes', areasDe(STUDENT_AREAS, presidente), 'dashboard'), 'dashboard');
    assert.equal(resolveArea('area=gestao_membros', areasDe(PROFESSOR_AREAS, professor), 'dashboard'), 'dashboard');
    assert.equal(resolveArea('area=gestao_relatorios', areasDe(PROFESSOR_AREAS, professor), 'dashboard'), 'gestao_relatorios');
    // Só o painel não abre Relatórios (WI-016): o link cai no padrão.
    assert.equal(resolveArea('area=gestao_relatorios', areasDe(PROFESSOR_AREAS, professorSoPainel), 'dashboard'), 'dashboard');
  });

  check('WI-015: sem dois papéis (aluno comum, sem portão, coord_atendimento), nenhuma tela de gestão por link', () => {
    assert.equal(resolveArea('area=gestao_membros', areasDe(STUDENT_AREAS, { role: 'aluno' }), 'dashboard'), 'dashboard');
    assert.equal(resolveArea('area=gestao_membros', areasDe(STUDENT_AREAS, { ...presidente, canAccessAdmin: false }), 'dashboard'), 'dashboard');
    // coord_atendimento com a aba Relatórios (perfil dos atletas, WI-016) segue só no painel.
    assert.deepEqual(getAreasDeGestao({ role: 'coord_atendimento', canAccessAdmin: true, capabilities: gestao({ pacientes: true, relatorios: { painel: false, exportacao: false, perfilAtletas: true } }) }), []);
  });

  check('WI-015: StudentView e ProfessorView somam getAreasDeGestao(user) às áreas aceitas', () => {
    const fsLocal = require('node:fs');
    for (const [arquivo, constante] of [['src/views/Student/StudentView/StudentView.jsx', 'STUDENT_AREAS'], ['src/views/professor/ProfessorView.jsx', 'PROFESSOR_AREAS']]) {
      const fonte = fsLocal.readFileSync(path.join(root, arquivo), 'utf8');
      assert.ok(fonte.includes('getAreasDeGestao(user)'), `${arquivo}: deveria usar getAreasDeGestao(user)`);
      assert.ok(fonte.includes(`[...${constante}, ...areasDeGestao]`), `${arquivo}: allowedAreas = [...${constante}, ...areasDeGestao]`);
      assert.match(fonte, /useAreaNavegacao\(\{\s*allowedAreas,/, `${arquivo}: useAreaNavegacao recebe a lista somada`);
    }
  });

  console.log(`\n${passed} verificações passaram (UPD-18 — contexto na navegação).`);
})();
