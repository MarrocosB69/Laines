// Sidebars v2 — modelo único de navegação. Dados 100% sintéticos.
//
// Prova as decisões de docs/implementacao/sidebars-v2/change-intent.md:
// 1) nenhum item aparece sem capacidade (liga.areas, liga.gerencia,
//    getAllowedAdminTabsFromCapabilities);
// 2) paridade — mesmos itens/ids/rótulos/ordem de hoje, exceto as decisões
//    2 (Comunicação para professor/equipe) e 3 (aviso de sem vínculo);
// 3) decisão 3 isolada (aviso + dica).
//
// Mesmo padrão de scripts/test-navegacao-liga.cjs: src/**/*.js usa import
// sem extensão (resolução Vite, não Node ESM nativo) — bundlamos com esbuild
// e carregamos via require, para exercitar sidebarModel.js de verdade
// (não uma cópia) junto dos módulos que ele importa.
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const root = path.resolve(__dirname, '..');
const esbuild = require(path.join(root, 'node_modules', 'esbuild'));

function carregarModulosSrc() {
  const entrySource = [
    "export * as roles from './src/constants/roles.js';",
    "export * as adminTabs from './src/constants/adminTabs.js';",
    "export * as academicNavigation from './src/constants/academicNavigation.js';",
    "export * as capabilities from './src/constants/capabilities.js';",
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
  const bundlePath = path.join(root, 'scripts', '__test-sidebar-modelo-bundle.cjs');
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
    academicNavigation: { LIGA_AREA_ROOT_TABS },
    capabilities: { normalizeCapabilities },
    adminTabs: { getAllowedAdminTabsFromCapabilities },
    roles: { getAbaNaPaginaUnica },
    sidebarModel: { buildSidebarModel, ROTULOS_DE_GESTAO, getAreasDeGestao }
  } = carregarModulosSrc();

  // id do item de liga -> nome da área em capabilities.liga.areas (o
  // inverso de LIGA_AREA_ROOT_TABS, que vai de área para id).
  const AREA_POR_ITEM_ID = Object.fromEntries(
    Object.entries(LIGA_AREA_ROOT_TABS).map(([area, id]) => [id, area])
  );

  // Ids de seção que, em cada portal, guardam itens de liga (leitura) -
  // usado pelo invariante 1. "areas" (admin) fica de fora de propósito:
  // lá o item vem de getAllowedAdminTabsFromCapabilities (gerência), não
  // de liga.areas (leitura) — são regras diferentes, checadas separado.
  const SECOES_DE_LIGA_POR_LEITURA = ['liga'];

  // Invariante 1a: todo item de liga (pelas seções acima) está em
  // capabilities.liga.areas. Lança (não retorna boolean) para servir tanto
  // à checagem real quanto à prova de detecção via assert.throws.
  const assertLigaContidaEmAreas = (model, areasPermitidas) => {
    model.secoes
      .filter((secao) => SECOES_DE_LIGA_POR_LEITURA.includes(secao.id))
      .forEach((secao) => {
        secao.itens.forEach((item) => {
          const area = AREA_POR_ITEM_ID[item.id];
          if (!area) return; // item que não é de área (não deveria ocorrer nestas seções)
          assert.ok(
            areasPermitidas.includes(area),
            `item de liga "${item.id}" (área "${area}") fora de capabilities.liga.areas`
          );
        });
      });
  };

  // Invariante 1b: toda aba do admin está em getAllowedAdminTabsFromCapabilities.
  const assertAdminContidoEmAbas = (model, allowedTabs) => {
    model.secoes.forEach((secao) => {
      secao.itens.forEach((item) => {
        assert.ok(allowedTabs.includes(item.id), `aba do admin "${item.id}" fora do permitido`);
      });
    });
  };

  // ── Prova de detecção: os dois invariantes acima realmente pegam o
  // defeito, em vez de passar sempre (reprodução sintética, não o modelo
  // real) ──────────────────────────────────────────────────────────────
  check('o invariante de liga.areas detecta uma área fora da capacidade', () => {
    const modeloComVazamento = { secoes: [{ id: 'liga', itens: [{ id: 'comunicacao' }] }] };
    assert.throws(() => assertLigaContidaEmAreas(modeloComVazamento, ['ensino', 'pesquisa', 'extensao']));
  });

  check('o invariante de liga.areas não acusa nada quando está tudo contido', () => {
    const modeloOk = { secoes: [{ id: 'liga', itens: [{ id: 'ensino' }] }] };
    assert.doesNotThrow(() => assertLigaContidaEmAreas(modeloOk, ['ensino', 'pesquisa']));
  });

  check('o invariante de abas do admin detecta uma aba fora do permitido', () => {
    const modeloComVazamento = { secoes: [{ id: 'system', itens: [{ id: 'settings' }] }] };
    assert.throws(() => assertAdminContidoEmAbas(modeloComVazamento, ['dashboard']));
  });

  check('o invariante de abas do admin não acusa nada quando está tudo permitido', () => {
    const modeloOk = { secoes: [{ id: 'system', itens: [{ id: 'settings' }] }] };
    assert.doesNotThrow(() => assertAdminContidoEmAbas(modeloOk, ['dashboard', 'settings']));
  });

  // ── Usuários sintéticos ──────────────────────────────────────────────
  const capsPara = (user) => normalizeCapabilities(null, user);
  const modeloPara = (portal, user, extras = {}) => buildSidebarModel({ portal, user, capabilities: capsPara(user), ...extras });

  const idsDe = (secao) => secao.itens.map((i) => i.id);
  const rotulosDe = (secao) => secao.itens.map((i) => i.rotulo);
  const secoesIds = (model) => model.secoes.map((s) => s.id);

  // Tabela esperada (paridade): mesma estrutura de hoje em
  // src/views/admin/SideBar/Sidebar.jsx (NAVIGATION_GROUPS), copiada aqui
  // como valor esperado - admin e coordenação têm capabilities idênticas
  // (as duas são ADMIN_ROLES, gerência de tudo).
  const ADMIN_SECOES_ESPERADAS = [
    { id: 'overview', titulo: 'Visão Geral', ids: ['dashboard'], rotulos: ['Início'] },
    { id: 'people', titulo: 'Pessoas', ids: ['users', 'patients'], rotulos: ['Membros', 'Atletas'] },
    { id: 'areas', titulo: 'Áreas', ids: ['research', 'ensino', 'extensao', 'comunicacao'], rotulos: ['Pesquisa', 'Ensino', 'Extensão', 'Comunicação'] },
    { id: 'management', titulo: 'Gestão', ids: ['requests', 'reports'], rotulos: ['Solicitações', 'Relatórios'] },
    { id: 'system', titulo: 'Sistema', ids: ['settings'], rotulos: ['Configurações'] }
  ];

  const assertSecoesIguaisA = (model, esperado) => {
    assert.deepEqual(secoesIds(model), esperado.map((s) => s.id), 'ids das seções, na ordem');
    esperado.forEach((secaoEsperada) => {
      const secao = model.secoes.find((s) => s.id === secaoEsperada.id);
      assert.ok(secao, `seção "${secaoEsperada.id}" deveria existir`);
      assert.equal(secao.titulo, secaoEsperada.titulo, `título da seção "${secaoEsperada.id}"`);
      assert.deepEqual(idsDe(secao), secaoEsperada.ids, `ids dos itens de "${secaoEsperada.id}", na ordem`);
      assert.deepEqual(rotulosDe(secao), secaoEsperada.rotulos, `rótulos dos itens de "${secaoEsperada.id}", na ordem`);
    });
  };

  check('admin: paridade das seções/itens com o menu de hoje', () => {
    const model = modeloPara('admin', { role: 'admin' });
    assertSecoesIguaisA(model, ADMIN_SECOES_ESPERADAS);
    assert.equal(model.papel.titulo, 'Administração');
    assert.deepEqual(model.atalhos, [], 'admin não tem atalho sem permissions/isStudentMemberRole');
  });

  check('coordenação: paridade das seções/itens com o menu de hoje (mesmas capacidades do admin)', () => {
    const model = modeloPara('admin', { role: 'coordenacao' });
    assertSecoesIguaisA(model, ADMIN_SECOES_ESPERADAS);
    assert.equal(model.papel.titulo, 'Coordenação', 'rótulo do papel muda, a estrutura não');
  });

  check('invariante 1 no admin: abas contidas em getAllowedAdminTabsFromCapabilities (admin e coordenação)', () => {
    ['admin', 'coordenacao'].forEach((role) => {
      const user = { role };
      const caps = capsPara(user);
      const model = modeloPara('admin', user);
      assertAdminContidoEmAbas(model, getAllowedAdminTabsFromCapabilities(caps));
    });
  });

  // As duas checagens acima usam admin/coordenação, que sempre têm gerência
  // de tudo (ADMIN_ROLES) - por isso não distinguem "filtrei certo" de "não
  // filtrei nada". Uma capacidade restrita de verdade (como o servidor pode
  // mandar) é o que prova o filtro - e é o alvo da prova de mutação.
  check('invariante 1 (capacidade restrita, não o fallback "libera tudo"): admin só vê a área que gere', () => {
    const capsRestritas = {
      liga: { leitura: true, areas: ['ensino'], gerencia: ['ensino'], aprovaConteudo: false },
      atendimento: { habilitado: false, escopo: 'nenhum', motivo: 'perfil_sem_atendimento' },
      gestao: { painel: true, usuarios: false, solicitacoes: false, pacientes: false, configuracoes: false, relatorios: { painel: false } }
    };
    const model = buildSidebarModel({ portal: 'admin', user: { role: 'coordenacao' }, capabilities: capsRestritas });
    const areas = model.secoes.find((s) => s.id === 'areas');
    assert.deepEqual(idsDe(areas), ['ensino'], 'só a área gerida deveria aparecer');
    assertAdminContidoEmAbas(model, getAllowedAdminTabsFromCapabilities(capsRestritas));
  });

  check('invariante 1 (capacidade restrita): aluno só lê a área que capabilities.liga.areas autoriza', () => {
    const capsRestritas = {
      liga: { leitura: true, areas: ['ensino', 'pesquisa'], gerencia: [], aprovaConteudo: false },
      atendimento: { habilitado: true, escopo: 'vinculo', motivo: null },
      gestao: {}
    };
    const model = buildSidebarModel({ portal: 'aluno', user: { role: 'aluno' }, capabilities: capsRestritas });
    const liga = model.secoes.find((s) => s.id === 'liga');
    assert.deepEqual(idsDe(liga), ['research', 'ensino'], 'só ensino/pesquisa deveriam aparecer, extensão e comunicação não');
    assertLigaContidaEmAreas(model, capsRestritas.liga.areas);
  });

  // Um aluno "com vínculo" tem supervisorId e projetoId — sem isso,
  // capabilities.atendimento.motivo vira 'sem_vinculo' (decisão 3, testada
  // à parte, mais abaixo).
  const ALUNO_COM_VINCULO = { role: 'aluno', supervisorId: 'sup-1', projetoId: 'proj-1' };

  const ALUNO_SECOES_BASE_ESPERADAS = [
    { id: 'rotina', titulo: 'Minha rotina', ids: ['dashboard', 'patients', 'agenda'], rotulos: ['Visão Geral', 'Meus Atletas', 'Minha Agenda'] },
    { id: 'liga', titulo: 'Liga', ids: ['research', 'ensino', 'extensao', 'comunicacao'], rotulos: ['Pesquisa', 'Ensino', 'Extensão', 'Comunicação'] },
    { id: 'avaliacoes', titulo: 'Avaliações', ids: ['imagem'], rotulos: ['Avaliação por imagem'] }
  ];

  check('aluno com vínculo: paridade das seções/itens (sem "Minha diretoria", sem gerência)', () => {
    const model = modeloPara('aluno', ALUNO_COM_VINCULO);
    assertSecoesIguaisA(model, ALUNO_SECOES_BASE_ESPERADAS);
    assert.equal(model.papel.titulo, 'Estudante');
    assert.equal(model.papel.subtitulo, 'Aluno da Liga');
    assert.equal(model.rodape.tag, 'LAINES · Área do aluno');
    assert.deepEqual(model.atalhos, [], 'aluno comum não vê a Presidência');
    model.secoes.forEach((secao) => assert.equal(secao.dica, undefined, `seção "${secao.id}" não deveria ter dica sem decisão 3`));
  });

  check('aluno com gerência de diretoria: "Minha diretoria" aparece com a área gerida', () => {
    const user = { ...ALUNO_COM_VINCULO, diretoria: 'ensino' };
    const model = modeloPara('aluno', user);
    assertSecoesIguaisA(model, [
      ALUNO_SECOES_BASE_ESPERADAS[0],
      ALUNO_SECOES_BASE_ESPERADAS[1],
      { id: 'diretoria', titulo: 'Minha diretoria', ids: ['ensino'], rotulos: ['Ensino'] },
      ALUNO_SECOES_BASE_ESPERADAS[2]
    ]);
  });

  check('presidente: mesma estrutura de aluno, mais o atalho de Presidência', () => {
    const model = modeloPara('aluno', { ...ALUNO_COM_VINCULO, role: 'presidente' });
    assertSecoesIguaisA(model, ALUNO_SECOES_BASE_ESPERADAS);
    assert.equal(model.papel.titulo, 'Estudante', 'o cartão de papel não vira "Presidente"');
    assert.deepEqual(model.atalhos.map((a) => a.rotulo), ['Presidência']);
  });

  check('invariante 1 no aluno/presidente: itens de liga contidos em capabilities.liga.areas', () => {
    [ALUNO_COM_VINCULO, { ...ALUNO_COM_VINCULO, diretoria: 'ensino' }, { ...ALUNO_COM_VINCULO, role: 'presidente' }].forEach((user) => {
      const caps = capsPara(user);
      const model = modeloPara('aluno', user);
      assertLigaContidaEmAreas(model, caps.liga.areas);
    });
  });

  // Professor e técnico: "Áreas" (3) vira "Liga" (4, com Comunicação) —
  // decisão 2, a única mudança visível de estrutura permitida aqui.
  check('professor: Supervisão + Liga (4, com Comunicação) — decisão 2', () => {
    const model = modeloPara('professor', { role: 'professor' });
    assertSecoesIguaisA(model, [
      { id: 'supervisao', titulo: 'Supervisão', ids: ['dashboard', 'patients', 'agenda'], rotulos: ['Visão Geral', 'Alunos e Atletas', 'Agenda'] },
      { id: 'liga', titulo: 'Liga', ids: ['research', 'ensino', 'extensao', 'comunicacao'], rotulos: ['Pesquisa', 'Ensino', 'Extensão', 'Comunicação'] }
    ]);
    assert.equal(model.papel.titulo, 'Professor');
    assert.equal(model.papel.subtitulo, 'Supervisão ativa');
    assert.equal(model.rodape.tag, 'LAINES · Área do professor');
    const filhosPesquisa = model.secoes.find((s) => s.id === 'liga').itens.find((i) => i.id === 'research').filhos;
    assert.ok(Array.isArray(filhosPesquisa) && filhosPesquisa.length > 0, 'itens de liga continuam com filhos (subseções acadêmicas)');
  });

  // WI-015: com canAccessAdmin e alguma tela de gestão, o professor tem dois
  // papéis e a gestão entra na própria barra (bloco WI-015, mais abaixo). O
  // atalho só continua para quem passa no portão sem nenhuma tela de gestão.
  check('professor: atalho de Administração só para canAccessAdmin sem tela de gestão (WI-015)', () => {
    assert.deepEqual(modeloPara('professor', { role: 'professor', canAccessAdmin: false }).atalhos, []);
    const soPortao = buildSidebarModel({
      portal: 'professor',
      user: { role: 'professor', canAccessAdmin: true },
      capabilities: { ...capsPara({ role: 'professor' }), gestao: { painel: true, relatorios: { painel: false } } }
    });
    assert.deepEqual(soPortao.atalhos.map((a) => a.rotulo), ['Administração']);
    assert.deepEqual(soPortao.atalhos[0].estado, { returnTo: '/professor' });
    assert.ok(!soPortao.secoes.some((s) => s.id === 'gestao'), 'sem tela de gestão, nada de seção Gestão');
    // WI-016: Relatórios exige relatorios.exportacao (research:manage aqui).
    const comGestao = modeloPara('professor', { role: 'professor', canAccessAdmin: true, permissions: ['research:manage'] });
    assert.deepEqual(comGestao.atalhos, [], 'com dois papéis o atalho some');
    const soOPainel = modeloPara('professor', { role: 'professor', canAccessAdmin: true });
    assert.deepEqual(soOPainel.atalhos.map((a) => a.rotulo), ['Administração'], 'só o painel, sem Relatórios: continua com o atalho');
  });

  check('técnico (equipe): Atendimento + Liga (4, com Comunicação) — decisão 2, sem atalhos', () => {
    const model = modeloPara('equipe', { role: 'tecnico' });
    assertSecoesIguaisA(model, [
      // + Visão Geral: aba inicial nova (visao-geral-v2, decisão do usuário de 26/09/2026).
      { id: 'atendimento', titulo: 'Atendimento', ids: ['dashboard', 'atletas'], rotulos: ['Visão Geral', 'Atletas'] },
      { id: 'liga', titulo: 'Liga', ids: ['research', 'ensino', 'extensao', 'comunicacao'], rotulos: ['Pesquisa', 'Ensino', 'Extensão', 'Comunicação'] }
    ]);
    assert.equal(model.papel.titulo, 'Equipe Técnica');
    assert.equal(model.papel.subtitulo, 'Acompanhamento esportivo');
    assert.equal(model.rodape.tag, 'LAINES · Área da equipe');
    assert.deepEqual(model.atalhos, [], 'TeamSidebar nunca teve atalhos');
  });

  check('invariante 1 em professor/técnico: itens de liga contidos em capabilities.liga.areas', () => {
    [{ role: 'professor' }, { role: 'tecnico' }].forEach((user) => {
      const caps = capsPara(user);
      const portal = user.role === 'tecnico' ? 'equipe' : 'professor';
      assertLigaContidaEmAreas(modeloPara(portal, user), caps.liga.areas);
    });
  });

  check('atleta: só "Meu acompanhamento", nenhum item de liga', () => {
    const user = { role: 'atleta' };
    const caps = capsPara(user);
    assert.deepEqual(caps.liga.areas, [], 'atleta não lê a liga (capabilities)');
    const model = modeloPara('atleta', user);
    assertSecoesIguaisA(model, [
      // + Visão Geral: aba inicial nova (visao-geral-v2, decisão do usuário de 26/09/2026).
      { id: 'acompanhamento', titulo: 'Meu acompanhamento', ids: ['dashboard', 'pendencias', 'cadastro', 'acompanhamento'], rotulos: ['Visão Geral', 'Pendências', 'Cadastro', 'Acompanhamento'] }
    ]);
    assert.equal(model.papel.titulo, 'Atleta');
    assert.equal(model.rodape.tag, null);
    assert.deepEqual(model.atalhos, []);
    const idsDeLiga = Object.values(LIGA_AREA_ROOT_TABS);
    model.secoes.forEach((secao) => secao.itens.forEach((item) => {
      assert.ok(!idsDeLiga.includes(item.id), `atleta não deveria ter o item de liga "${item.id}"`);
    }));
  });

  check('atleta: selo de pendências usa "9+" a partir de 10 (formatação de hoje)', () => {
    // Pelo id, não pela posição: a Visão Geral passou a ser o primeiro item.
    const pendencias = (m) => m.secoes[0].itens.find((item) => item.id === 'pendencias');
    const semPendencia = modeloPara('atleta', { role: 'atleta' }, { pendingCount: 0 });
    assert.equal(pendencias(semPendencia).selo, undefined);
    const comPoucas = modeloPara('atleta', { role: 'atleta' }, { pendingCount: 3 });
    assert.equal(pendencias(comPoucas).selo, '3');
    const comMuitas = modeloPara('atleta', { role: 'atleta' }, { pendingCount: 12 });
    assert.equal(pendencias(comMuitas).selo, '9+');
    assert.equal(pendencias(comMuitas).seloDescricao, '12 pendências', 'a descrição usa o número real, não o "9+" visível');
  });

  // ── Decisão 3: aluno sem vínculo ─────────────────────────────────────
  const DICA_SEM_VINCULO = 'Complete supervisor e projeto no seu perfil para atender atletas.';
  const ALUNO_SEM_VINCULO = { role: 'aluno' }; // sem supervisorId/projetoId

  check('decisão 3: aluno sem vínculo recebe aviso nos três itens e dica nas duas seções', () => {
    const caps = capsPara(ALUNO_SEM_VINCULO);
    assert.equal(caps.atendimento.motivo, 'sem_vinculo', 'pré-condição do cenário sintético');

    const model = modeloPara('aluno', ALUNO_SEM_VINCULO);
    const rotina = model.secoes.find((s) => s.id === 'rotina');
    const avaliacoes = model.secoes.find((s) => s.id === 'avaliacoes');

    assert.equal(rotina.itens.find((i) => i.id === 'dashboard').aviso, undefined, '"Visão Geral" não é um dos três itens da decisão 3');
    assert.equal(rotina.itens.find((i) => i.id === 'patients').aviso, 'Sem vínculo');
    assert.equal(rotina.itens.find((i) => i.id === 'agenda').aviso, 'Sem vínculo');
    assert.equal(avaliacoes.itens.find((i) => i.id === 'imagem').aviso, 'Sem vínculo');

    assert.equal(rotina.dica, DICA_SEM_VINCULO);
    assert.equal(avaliacoes.dica, DICA_SEM_VINCULO);
    // A estrutura (ids/ordem) continua a mesma - só aviso/dica mudam.
    assertSecoesIguaisA(model, ALUNO_SECOES_BASE_ESPERADAS);
  });

  check('decisão 3: aluno com vínculo não recebe aviso nem dica', () => {
    const model = modeloPara('aluno', ALUNO_COM_VINCULO);
    model.secoes.forEach((secao) => {
      assert.equal(secao.dica, undefined, `seção "${secao.id}" sem dica`);
      secao.itens.forEach((item) => assert.equal(item.aviso, undefined, `item "${item.id}" sem aviso`));
    });
  });

  // ── Lacunas que a prova de mutação da revisão independente expôs ─────────
  const capsSoEnsino = {
    liga: { leitura: true, areas: ['ensino'], gerencia: [], aprovaConteudo: false },
    atendimento: { habilitado: true, escopo: 'vinculo', motivo: null },
    gestao: {}
  };

  check('invariante 1 (capacidade restrita): professor e equipe só leem as áreas de liga.areas', () => {
    for (const [portal, role] of [['professor', 'professor'], ['equipe', 'tecnico']]) {
      const model = buildSidebarModel({ portal, user: { role }, capabilities: capsSoEnsino });
      const liga = model.secoes.find((s) => s.id === 'liga');
      assert.deepEqual(idsDe(liga), ['ensino'], `${portal}: só a área autorizada deveria aparecer`);
    }
  });

  check('atalho "Portal do Professor" no admin depende de admin:access (condição de hoje)', () => {
    const comAcesso = modeloPara('admin', { role: 'professor', permissions: ['admin:access'] });
    const semAcesso = modeloPara('admin', { role: 'professor', permissions: [] });
    assert.ok(comAcesso.atalhos.some((a) => a.id === 'professor'), 'com admin:access o atalho aparece');
    assert.ok(!semAcesso.atalhos.some((a) => a.id === 'professor'), 'sem admin:access o atalho não aparece');
  });

  check('vice também vê o atalho de Presidência (presidente e vice, como hoje)', () => {
    const model = modeloPara('aluno', { ...ALUNO_COM_VINCULO, role: 'vice' });
    assert.deepEqual(model.atalhos.map((a) => a.rotulo), ['Presidência']);
  });

  check('atleta: "9+" só a partir de 10 pendências; 9 aparece como 9', () => {
    const pendencias = (m) => m.secoes[0].itens.find((item) => item.id === 'pendencias');
    assert.equal(pendencias(modeloPara('atleta', { role: 'atleta' }, { pendingCount: 9 })).selo, '9');
    assert.equal(pendencias(modeloPara('atleta', { role: 'atleta' }, { pendingCount: 10 })).selo, '9+');
  });

  check('admin: selo de solicitações aparece quando há pedidos (requestsCount)', () => {
    const model = modeloPara('admin', { role: 'admin' }, { requestsCount: 3 });
    const itens = model.secoes.flatMap((s) => s.itens);
    assert.equal(itens.find((i) => i.id === 'requests').selo, '3');
    const semPedidos = modeloPara('admin', { role: 'admin' }, { requestsCount: 0 }).secoes.flatMap((s) => s.itens);
    assert.equal(semPedidos.find((i) => i.id === 'requests').selo, undefined);
  });

  check('admin recolhido: as áreas mantêm as dicas de antes (paridade do texto)', () => {
    const areas = modeloPara('admin', { role: 'admin' }).secoes.find((s) => s.id === 'areas');
    assert.equal(areas.itens.find((i) => i.id === 'research').dica, 'Repositório, projetos e ideias');
    assert.equal(areas.itens.find((i) => i.id === 'comunicacao').dica, 'Comunicados e materiais');
  });

  // ── WI-015: página única para quem tem dois papéis ───────────────────────
  // Capacidades no formato do servidor (buildCapabilities); `gestao` muda.
  const capsCom = (user, gestao) => ({
    ...capsPara(user),
    gestao: {
      painel: false, usuarios: false, solicitacoes: false, pacientes: false, configuracoes: false,
      relatorios: { painel: false, operacional: false, detalhado: false, exportacao: false },
      ...gestao
    }
  });
  // Relatórios só com relatorios.exportacao (WI-016): este perfil de direção
  // tem também research:manage, que o servidor converte em exportacao.
  const GESTAO_DIRECAO = { painel: true, usuarios: true, pacientes: true, solicitacoes: true, relatorios: { painel: true, exportacao: true } };
  const PRESIDENTE_GESTOR = { ...ALUNO_COM_VINCULO, role: 'presidente', canAccessAdmin: true };
  const PROFESSOR_GESTOR = { role: 'professor', canAccessAdmin: true };
  const modeloCom = (portal, user, gestao, extras = {}) => (
    buildSidebarModel({ portal, user, capabilities: capsCom(user, gestao), ...extras })
  );
  const todosOsIds = (model) => model.secoes.flatMap(idsDe);

  check('WI-015: presidente com gestão tem uma barra só, com a seção Direção e sem atalho', () => {
    const model = modeloCom('aluno', PRESIDENTE_GESTOR, GESTAO_DIRECAO);
    assertSecoesIguaisA(model, [
      ...ALUNO_SECOES_BASE_ESPERADAS,
      {
        id: 'direcao', titulo: 'Direção',
        ids: ['gestao_membros', 'gestao_atletas', 'gestao_solicitacoes', 'gestao_relatorios'],
        rotulos: ['Membros', 'Cadastro de atletas', 'Solicitações', 'Relatórios']
      }
    ]);
    assert.deepEqual(model.atalhos, [], 'sem o atalho Presidência');
  });

  check('WI-015: vice com gestão também; Configurações só com capabilities.gestao.configuracoes', () => {
    const vice = { ...PRESIDENTE_GESTOR, role: 'vice' };
    const direcao = modeloCom('aluno', vice, { relatorios: { painel: true, exportacao: true }, configuracoes: true }).secoes.find((s) => s.id === 'direcao');
    assert.deepEqual(idsDe(direcao), ['gestao_relatorios', 'gestao_configuracoes']);
    assert.deepEqual(rotulosDe(direcao), ['Relatórios', 'Configurações']);
  });

  check('WI-015: presidente sem capabilities.gestao não ganha nada de gestão (igual a antes)', () => {
    const semGestao = modeloCom('aluno', { ...PRESIDENTE_GESTOR, canAccessAdmin: false }, {});
    assertSecoesIguaisA(semGestao, ALUNO_SECOES_BASE_ESPERADAS);
    assert.deepEqual(semGestao.atalhos.map((a) => a.rotulo), ['Presidência'], 'o atalho de antes continua');
    // Capacidade sem o portão de /admin também não embute nada (sem acesso novo).
    const semPortao = modeloCom('aluno', { ...PRESIDENTE_GESTOR, canAccessAdmin: false }, GESTAO_DIRECAO);
    assertSecoesIguaisA(semPortao, ALUNO_SECOES_BASE_ESPERADAS);
    assert.deepEqual(getAreasDeGestao({ ...PRESIDENTE_GESTOR, canAccessAdmin: false, capabilities: capsCom(PRESIDENTE_GESTOR, GESTAO_DIRECAO) }), []);
  });

  check('WI-015: aluno comum e aluno com diretoria sem portão ficam iguais a antes', () => {
    assertSecoesIguaisA(modeloPara('aluno', ALUNO_COM_VINCULO), ALUNO_SECOES_BASE_ESPERADAS);
    const diretor = modeloPara('aluno', { ...ALUNO_COM_VINCULO, diretoria: 'ensino' });
    assert.deepEqual(secoesIds(diretor), ['rotina', 'liga', 'diretoria', 'avaliacoes']);
    assert.deepEqual(diretor.atalhos, []);
  });

  check('WI-015: professor com o painel tem a seção Gestão, sem atalho; professor comum igual a antes', () => {
    const model = modeloCom('professor', PROFESSOR_GESTOR, { painel: true, pacientes: true, relatorios: { painel: true, exportacao: true } });
    assert.deepEqual(secoesIds(model), ['supervisao', 'liga', 'gestao']);
    const gestao = model.secoes.find((s) => s.id === 'gestao');
    assert.equal(gestao.titulo, 'Gestão');
    assert.deepEqual(idsDe(gestao), ['gestao_atletas', 'gestao_relatorios']);
    assert.deepEqual(rotulosDe(gestao), ['Cadastro de atletas', 'Relatórios']);
    assert.deepEqual(model.atalhos, []);
    const comum = modeloPara('professor', { role: 'professor' });
    assert.deepEqual(secoesIds(comum), ['supervisao', 'liga']);
    assert.deepEqual(comum.atalhos, []);
  });

  check('WI-015: sem itens repetidos — os ids de gestão não colidem com nenhum outro item', () => {
    const casos = [
      modeloCom('aluno', { ...PRESIDENTE_GESTOR, diretoria: 'ensino' }, { ...GESTAO_DIRECAO, configuracoes: true }),
      modeloCom('professor', PROFESSOR_GESTOR, { ...GESTAO_DIRECAO, configuracoes: true })
    ];
    casos.forEach((model) => {
      const secaoGestao = model.secoes.find((s) => s.id === 'direcao' || s.id === 'gestao');
      const outros = model.secoes.filter((s) => s !== secaoGestao).flatMap(idsDe);
      idsDe(secaoGestao).forEach((id) => assert.ok(!outros.includes(id), `"${id}" repetido fora da seção de gestão`));
      // Nenhuma área da Liga (nem "patients"/"dashboard") dentro da gestão.
      [...Object.values(LIGA_AREA_ROOT_TABS), 'patients', 'dashboard'].forEach((id) => {
        assert.ok(!idsDe(secaoGestao).includes(id), `a gestão não repete "${id}"`);
      });
      assert.equal(new Set(idsDe(secaoGestao)).size, idsDe(secaoGestao).length);
    });
  });

  check('WI-015: selo de solicitações pendentes no item Solicitações, como no painel', () => {
    const solicitacoes = (requestsCount) => modeloCom('aluno', PRESIDENTE_GESTOR, GESTAO_DIRECAO, { requestsCount })
      .secoes.find((s) => s.id === 'direcao').itens.find((i) => i.id === 'gestao_solicitacoes');
    assert.equal(solicitacoes(4).selo, '4');
    assert.equal(solicitacoes(4).seloDescricao, '4 solicitações pendentes');
    assert.equal(solicitacoes(0).selo, undefined);
    const prof = modeloCom('professor', PROFESSOR_GESTOR, { solicitacoes: true }, { requestsCount: 2 });
    assert.equal(prof.secoes.find((s) => s.id === 'gestao').itens[0].selo, '2');
  });

  check('WI-015: a gestão só entra no portal de origem da pessoa', () => {
    // Professor com dois papéis numa barra de aluno (ex.: rota própria com
    // returnTo de aluno) não leva links para telas que /aluno não abre.
    const model = modeloCom('aluno', { ...PROFESSOR_GESTOR }, GESTAO_DIRECAO);
    assert.ok(!model.secoes.some((s) => s.id === 'direcao'));
  });

  check('WI-015: mesmas telas de gestão para a mesma pessoa (antes: as duas páginas; depois: a página única)', () => {
    const perfis = [
      ['aluno', { ...PRESIDENTE_GESTOR, diretoria: 'pesquisa' }, { ...GESTAO_DIRECAO, configuracoes: true }],
      ['aluno', { ...PRESIDENTE_GESTOR, role: 'vice' }, { solicitacoes: true }],
      ['aluno', { ...ALUNO_COM_VINCULO, canAccessAdmin: true, diretoria: 'ensino' }, { painel: true, relatorios: { painel: true } }],
      ['professor', PROFESSOR_GESTOR, { painel: true, relatorios: { painel: true } }],
      ['professor', { role: 'profissional', canAccessAdmin: true }, GESTAO_DIRECAO]
    ];
    perfis.forEach(([portal, user, gestao]) => {
      const capabilities = capsCom(user, gestao);
      // Antes: a página de origem (as seções não dependiam de canAccessAdmin)
      // somada às abas do painel, que não mudou.
      const origemAntes = buildSidebarModel({ portal, user: { ...user, canAccessAdmin: false }, capabilities });
      const painel = buildSidebarModel({ portal: 'admin', user, capabilities });
      const antes = new Set([...todosOsIds(origemAntes), ...todosOsIds(painel).map(getAbaNaPaginaUnica)]);
      const depois = new Set(todosOsIds(buildSidebarModel({ portal, user, capabilities })));
      assert.deepEqual([...depois].sort(), [...antes].sort(), `${user.role}: telas antes x depois`);
      // E as do painel continuam decididas pela mesma função do servidor.
      getAllowedAdminTabsFromCapabilities(capabilities).forEach((tab) => {
        assert.ok(depois.has(getAbaNaPaginaUnica(tab)), `${user.role}: aba "${tab}" do painel sem equivalente`);
      });
    });
  });

  check('WI-015: admin, coordenação e coordenação de atendimento continuam só com o painel', () => {
    assertSecoesIguaisA(modeloPara('admin', { role: 'admin', canAccessAdmin: true }), ADMIN_SECOES_ESPERADAS);
    assertSecoesIguaisA(modeloPara('admin', { role: 'coordenacao', canAccessAdmin: true }), ADMIN_SECOES_ESPERADAS);
    // Capacidades da reserva local sem canAccessAdmin = as do servidor para
    // este papel (gestao.pacientes e relatorios.perfilAtletas, sem painel).
    const coordAt = modeloPara('admin', { role: 'coord_atendimento' });
    assert.deepEqual(secoesIds(coordAt), ['overview', 'people', 'management']);
    assert.deepEqual(idsDe(coordAt.secoes[1]), ['patients'], 'coord_atendimento: Atletas, como antes');
    assert.deepEqual(idsDe(coordAt.secoes[2]), ['reports'], 'coord_atendimento: Relatórios só com o perfil dos atletas (WI-016)');
    assert.deepEqual(getAreasDeGestao({ role: 'coord_atendimento', canAccessAdmin: true, capabilities: capsPara({ role: 'coord_atendimento' }) }), []);
    assert.deepEqual(getAreasDeGestao({ role: 'admin', canAccessAdmin: true, capabilities: capsPara({ role: 'admin' }) }), []);
  });

  // ── WI-016: aba Relatórios pela mesma capacidade dos endpoints ──────────
  // relatorios.painel (canAccessAnalyticsDashboard) é mais larga que a regra
  // dos dados (canAccessAnalyticsReports = relatorios.exportacao): quem só
  // tinha o painel via a aba e recebia 403. Ninguém ganha acesso novo.
  check('WI-016: Relatórios só com relatorios.exportacao, no painel e na página única', () => {
    const soPainel = capsCom(PROFESSOR_GESTOR, { painel: true, pacientes: true, relatorios: { painel: true } });
    assert.ok(!getAllowedAdminTabsFromCapabilities(soPainel).includes('reports'), 'painel: sem a aba');
    const professor = buildSidebarModel({ portal: 'professor', user: PROFESSOR_GESTOR, capabilities: soPainel });
    assert.deepEqual(idsDe(professor.secoes.find((s) => s.id === 'gestao')), ['gestao_atletas'], 'página única: sem Relatórios');
    const comExportacao = capsCom(PROFESSOR_GESTOR, { painel: true, pacientes: true, relatorios: { painel: true, exportacao: true } });
    assert.ok(getAllowedAdminTabsFromCapabilities(comExportacao).includes('reports'));
    // Admin e coordenação continuam com a aba (reserva local: exportacao = admin).
    assert.ok(getAllowedAdminTabsFromCapabilities(capsPara({ role: 'admin' })).includes('reports'));
    assert.ok(getAllowedAdminTabsFromCapabilities(capsPara({ role: 'coordenacao' })).includes('reports'));
  });

  // Decisão de 12/10/2026: a aba abre também com relatorios.perfilAtletas.
  // Varredura de papéis x diretorias x permissões na reserva local (espelho
  // de buildCapabilities): a aba só difere da regra anterior (exportacao)
  // para coord_atendimento, e só para mais. Ninguém perde nem ganha outra.
  check('WI-016: o perfil dos atletas abre Relatórios só para coord_atendimento', () => {
    const PAPEIS = ['admin', 'coordenacao', 'presidente', 'vice', 'diretoria_marketing', 'diretoria_ensino', 'diretoria_pesquisa',
      'diretoria_extensao', 'coord_atendimento', 'professor', 'profissional', 'pesquisador', 'colaborador', 'tecnico', 'atleta', 'aluno'];
    const DIRETORIAS = ['', 'ensino', 'pesquisa', 'extensao', 'marketing'];
    const PERMISSOES = ['admin:access', 'users:manage', 'patients:manage', 'research:manage', 'requests:review', 'research:create',
      'research:update-own-area', 'extensao:create', 'extensao:update-own-area', 'ensino:create', 'ensino:update-own-area',
      'marketing:create', 'marketing:update-own-area'];
    const conjuntos = [[], ...PERMISSOES.map((p) => [p]), PERMISSOES];
    const ganham = new Set();
    let casos = 0;
    PAPEIS.forEach((role) => DIRETORIAS.forEach((diretoria) => conjuntos.forEach((permissions) => {
      [false, true].forEach((canAccessAdmin) => {
        const caps = capsPara({ role, diretoria, permissions, canAccessAdmin });
        const antes = Boolean(caps.gestao.relatorios.exportacao);
        const depois = getAllowedAdminTabsFromCapabilities(caps).includes('reports');
        assert.ok(!(antes && !depois), `${role}/${diretoria}/${permissions.join(',')}: perdeu Relatórios`);
        if (depois && !antes) ganham.add(role);
        casos += 1;
      });
    })));
    assert.ok(casos > 1000, `varredura curta demais: ${casos}`);
    assert.deepEqual([...ganham], ['coord_atendimento']);
    // E coord_atendimento continua sem página única: a aba fica no painel.
    const coordAt = { role: 'coord_atendimento', canAccessAdmin: true };
    assert.deepEqual(getAreasDeGestao({ ...coordAt, capabilities: capsPara(coordAt) }), []);
    // A varredura não é vazia: perfilAtletas sozinho abre a aba, então um
    // outro papel que o recebesse sem exportacao entraria em `ganham`.
    const vazado = capsCom(PROFESSOR_GESTOR, { relatorios: { painel: true, exportacao: false, perfilAtletas: true } });
    assert.ok(getAllowedAdminTabsFromCapabilities(vazado).includes('reports'));
  });

  check('WI-016: quem só tinha o painel e Relatórios perde a seção de gestão e volta ao atalho', () => {
    const soPainel = { painel: true, relatorios: { painel: true } };
    const professor = modeloCom('professor', PROFESSOR_GESTOR, soPainel);
    assert.ok(!professor.secoes.some((s) => s.id === 'gestao'));
    assert.deepEqual(professor.atalhos.map((a) => a.rotulo), ['Administração']);
    // Aluno de diretoria de Pesquisa (research:create): portão de /admin
    // aberto pelo painel, nenhuma tela de gestão; sem seção Direção.
    const diretor = modeloCom('aluno', { ...ALUNO_COM_VINCULO, canAccessAdmin: true, diretoria: 'pesquisa' }, soPainel);
    assert.ok(!diretor.secoes.some((s) => s.id === 'direcao'));
    assert.deepEqual(getAreasDeGestao({ ...ALUNO_COM_VINCULO, canAccessAdmin: true, capabilities: capsCom(ALUNO_COM_VINCULO, soPainel) }), []);
  });

  check('WI-015: rótulos de gestão por id da página única (cabeçalhos)', () => {
    assert.deepEqual(ROTULOS_DE_GESTAO, {
      gestao_membros: 'Membros',
      gestao_atletas: 'Cadastro de atletas',
      gestao_solicitacoes: 'Solicitações',
      gestao_relatorios: 'Relatórios',
      gestao_configuracoes: 'Configurações'
    });
  });

  console.log(`\n${passed} verificações passaram (sidebars v2 — modelo único de navegação).`);
})();

