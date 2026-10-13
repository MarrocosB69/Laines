/* Peças da "Visão geral" (src/components/painel/Painel.jsx e painel.css).
 *
 * Contrato: docs/implementacao/visao-geral-v2/contrato-painel.md. Prova:
 *   1. saudacaoPorHorario segue a regra de getGreeting em
 *      src/views/admin/Dashboard/DashboardStats.jsx (linhas 258-260 em
 *      26/09/2026), com as fronteiras de hora;
 *   2. painel.css não usa Inter, Poppins, Outfit nem Space Grotesk fora de
 *      comentários e declara font-family nos títulos;
 *   3. Painel.jsx exporta os seis nomes do contrato;
 *   4. reproduções sintéticas: cada verificação acima falha diante do defeito.
 * Também confere a marcação acessível (renderização no servidor, sem
 * navegador), o escopo `.painel`, os alvos de 44px, o foco, o movimento e o
 * contraste dos tons novos.
 *
 * Node puro. PAINEL_RAIZ existe só para a prova de mutação: aponta o teste
 * para uma cópia dos arquivos, nunca para o repositório alterado. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const Module = require('node:module');

const repo = path.resolve(__dirname, '..');
const raiz = process.env.PAINEL_RAIZ ? path.resolve(process.env.PAINEL_RAIZ) : repo;
const esbuild = require(path.join(repo, 'node_modules', 'esbuild'));
const { createElement: h } = require(path.join(repo, 'node_modules', 'react'));
const { renderToStaticMarkup } = require(path.join(repo, 'node_modules', 'react-dom', 'server'));

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`PASS ${name}`); };
const ler = (rel) => fs.readFileSync(path.join(raiz, rel), 'utf8');

const JSX_REL = 'src/components/painel/Painel.jsx';
const CSS_REL = 'src/components/painel/painel.css';
const NOMES = ['PainelVisaoGeral', 'PainelCabecalho', 'PainelIndicadores', 'PainelSecao', 'PainelLista', 'saudacaoPorHorario'];

// Compila o JSX com o esbuild do projeto; react e lucide-react ficam
// externos e são resolvidos no node_modules do repositório.
function carregarPainel(arquivo) {
  const saida = esbuild.buildSync({
    entryPoints: [arquivo],
    bundle: true,
    write: false,
    format: 'cjs',
    platform: 'node',
    target: 'node18',
    jsx: 'automatic',
    loader: { '.jsx': 'jsx', '.css': 'empty' },
    packages: 'external',
    logLevel: 'silent'
  });
  const destino = path.join(repo, 'scripts', '__test-painel-bundle.cjs');
  const mod = new Module(destino, null);
  mod.filename = destino;
  mod.paths = Module._nodeModulePaths(repo);
  mod._compile(saida.outputFiles[0].text, destino);
  return mod.exports;
}

/* ── Regra da saudação ──────────────────────────────────────────────────
   Fronteiras copiadas de getGreeting (DashboardStats.jsx:258-260):
   h < 12 → Bom dia; h < 18 → Boa tarde; senão → Boa noite. */
const FRONTEIRAS = [
  [0, 0, 'Bom dia'], [6, 30, 'Bom dia'], [11, 59, 'Bom dia'],
  [12, 0, 'Boa tarde'], [15, 0, 'Boa tarde'], [17, 59, 'Boa tarde'],
  [18, 0, 'Boa noite'], [21, 0, 'Boa noite'], [23, 59, 'Boa noite']
];

function divergenciasSaudacao(fn) {
  return FRONTEIRAS
    .map(([hora, minuto, esperado]) => ({ hora, minuto, esperado, obtido: fn(new Date(2026, 8, 26, hora, minuto)) }))
    .filter((r) => r.obtido !== r.esperado)
    .map((r) => `${r.hora}:${String(r.minuto).padStart(2, '0')} deu "${r.obtido}", esperado "${r.esperado}"`);
}

// Cópia literal de DashboardStats.jsx:256-261 lida em 26/09/2026, antes de o
// painel do admin passar a importar saudacaoPorHorario. Se o arquivo ainda
// tiver getGreeting, vale a versão do arquivo; senão, esta cópia.
const GET_GREETING_ORIGINAL = `const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
};`;

// Executa o corpo de getGreeting com um Date falso que devolve a hora pedida.
function regraDeGetGreeting(fonte) {
  const achado = fonte.replace(/\r\n/g, '\n').match(/const getGreeting = \(\) => \{([\s\S]*?)\n\};/);
  if (!achado) return null;
  let hora = 0;
  class DataFalsa { getHours() { return hora; } }
  const fn = vm.runInNewContext(`(function () {${achado[1]}\n})`, { Date: DataFalsa });
  return (h0) => { hora = h0; return fn(); };
}

function getGreetingDoAdmin() {
  const fonte = fs.readFileSync(path.join(raiz, 'src/views/admin/Dashboard/DashboardStats.jsx'), 'utf8');
  const doArquivo = regraDeGetGreeting(fonte);
  return { regra: doArquivo || regraDeGetGreeting(GET_GREETING_ORIGINAL), origem: doArquivo ? 'DashboardStats.jsx' : 'cópia de 26/09/2026' };
}

// Horas (0-23) em que duas regras discordam.
const horasDivergentes = (a, b) => Array.from({ length: 24 }, (_, hora) => hora)
  .filter((hora) => a(new Date(2026, 8, 26, hora, 0)) !== b(hora));

/* ── Leitura do CSS ─────────────────────────────────────────────────── */
const semComentarios = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

// Regras na ordem do arquivo: { seletores, decl: [[prop, valor]], media }.
// @media aninhado junta as condições; @keyframes fica de fora.
function regras(css) {
  const texto = semComentarios(css).replace(/@import[^;]+;/g, '');
  const saida = [];
  const lerCorpo = (corpo, media) => {
    let i = 0;
    while (i < corpo.length) {
      const abre = corpo.indexOf('{', i);
      if (abre < 0) break;
      const prelude = corpo.slice(i, abre).trim();
      if (prelude.startsWith('@')) {
        let prof = 1; let j = abre + 1;
        while (j < corpo.length && prof > 0) { if (corpo[j] === '{') prof += 1; else if (corpo[j] === '}') prof -= 1; j += 1; }
        if (prelude.startsWith('@media')) lerCorpo(corpo.slice(abre + 1, j - 1), [media, prelude].filter(Boolean).join(' and '));
        i = j;
        continue;
      }
      const fecha = corpo.indexOf('}', abre);
      const decl = corpo.slice(abre + 1, fecha).split(';')
        .map((d) => { const k = d.indexOf(':'); return k < 0 ? null : [d.slice(0, k).trim().toLowerCase(), d.slice(k + 1).trim()]; })
        .filter((d) => d && d[0]);
      if (prelude) saida.push({ seletores: prelude.split(',').map((s) => s.trim().replace(/\s+/g, ' ')), decl, media });
      i = fecha + 1;
    }
  };
  lerCorpo(texto, null);
  return saida;
}

const FONTES_PROIBIDAS = /\b(Inter|Poppins|Outfit|Space\s+Grotesk)\b/gi;
const fontesProibidas = (css) => [...semComentarios(css).matchAll(FONTES_PROIBIDAS)].map((m) => m[0]);

// font-family declarado numa regra cujo seletor termina na classe pedida.
function fonteDe(css, classe) {
  const alvo = regras(css).find((r) => r.seletores.some((s) => s.endsWith(`.${classe}`)) && r.decl.some(([p]) => p === 'font-family'));
  return alvo ? alvo.decl.find(([p]) => p === 'font-family')[1] : null;
}

const SEM_MOVIMENTO = 'prefers-reduced-motion: no-preference';
const emMs = (t) => (t.endsWith('ms') ? parseFloat(t) : parseFloat(t) * 1000);

// Movimento fora da regra: animação fora de no-preference, laço infinito,
// duração total acima de 5 s, will-change, transição de transform sem guarda.
function problemasDeMovimento(css) {
  const achados = [];
  if (/will-change/i.test(semComentarios(css))) achados.push('will-change declarado');
  for (const r of regras(css)) {
    const guardada = Boolean(r.media && r.media.includes(SEM_MOVIMENTO));
    for (const [prop, valor] of r.decl) {
      const onde = `${r.seletores.join(', ')} { ${prop}: ${valor} }`;
      if (prop.startsWith('animation')) {
        if (!guardada) achados.push(`animação sem ${SEM_MOVIMENTO}: ${onde}`);
        if (/infinite/i.test(valor)) achados.push(`laço infinito: ${onde}`);
        const tempos = valor.match(/-?[\d.]+m?s\b/g) || [];
        const repeticoes = valor.replace(/-?[\d.]+m?s\b/g, '').match(/(?:^|\s)(\d+(?:\.\d+)?)(?=\s|$)/);
        const total = (tempos[0] ? emMs(tempos[0]) : 0) * (repeticoes ? Number(repeticoes[1]) : 1);
        if (total > 5000) achados.push(`animação de ${total} ms, acima de 5 s: ${onde}`);
      }
      if (prop.startsWith('transition') && !guardada && /\b(transform|all)\b/.test(valor)) {
        achados.push(`transição de movimento sem ${SEM_MOVIMENTO}: ${onde}`);
      }
    }
  }
  return achados;
}

/* ── Contraste (a fórmula de scripts/test-landing-tokens.cjs) ───────── */
function luminancia(hex) {
  const limpo = hex.replace('#', '');
  const cheio = limpo.length === 3 ? limpo.split('').map((c) => c + c).join('') : limpo;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(cheio.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contraste = (a, b) => {
  const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (escuro + 0.05);
};

// Último valor hexadecimal declarado para um token, seguindo var() um nível.
function token(nome, ...folhas) {
  for (const css of folhas) {
    const valores = [...semComentarios(css).matchAll(new RegExp(`--${nome}\s*:\s*([^;]+);`, 'g'))].map((m) => m[1].trim());
    const valor = valores[valores.length - 1];
    if (!valor) continue;
    const alias = valor.match(/^var\(\s*--([\w-]+)\s*\)$/);
    if (alias) return token(alias[1], ...folhas);
    assert.match(valor, /^#[0-9a-f]{3,6}$/i, `--${nome} não é um hexadecimal: ${valor}`);
    return valor;
  }
  throw new Error(`token --${nome} não encontrado`);
}

/* ── Marcação ────────────────────────────────────────────────────────── */
const contar = (html, re) => (html.match(re) || []).length;
const botoes = (html) => [...html.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)].map((m) => m[0]);
const Icone = () => null;
const DATA = new Date(2026, 8, 26, 9, 30);

// Exportações ausentes ou que não são funções.
const exportacoesFaltando = (mod) => NOMES.filter((nome) => typeof mod[nome] !== 'function');

/* ═════════════════════════════ Verificações ═════════════════════════════ */
const painel = carregarPainel(path.join(raiz, JSX_REL));
const css = ler(CSS_REL);
const tokensLanding = fs.readFileSync(path.join(repo, 'src/views/landing/landing-tokens.css'), 'utf8');

check('Painel.jsx exporta os seis nomes do contrato', () => {
  assert.deepEqual(exportacoesFaltando(painel), []);
});

check('saudacaoPorHorario: fronteiras 11:59/12:00 e 17:59/18:00 iguais às de DashboardStats.jsx', () => {
  assert.deepEqual(divergenciasSaudacao(painel.saudacaoPorHorario), []);
});

check('saudacaoPorHorario e getGreeting do admin concordam nas 24 horas', () => {
  const { regra, origem } = getGreetingDoAdmin();
  console.log(`     getGreeting lido de: ${origem}`);
  assert.deepEqual(horasDivergentes(painel.saudacaoPorHorario, regra), []);
});

check('painel.css não usa Inter, Poppins, Outfit nem Space Grotesk fora de comentários', () => {
  assert.deepEqual(fontesProibidas(css), []);
});

check('painel.css declara font-family nos títulos, no número e no corpo, só com as duas Sofia', () => {
  assert.equal(fonteDe(css, 'painel-cabecalho__titulo'), 'var(--lt-font-display)');
  assert.equal(fonteDe(css, 'painel-secao__titulo'), 'var(--lt-font-family)');
  assert.equal(fonteDe(css, 'painel-indicador__valor'), 'var(--lt-font-display)');
  assert.equal(fonteDe(css, 'painel'), 'var(--lt-font-family)');
  const outras = regras(css).flatMap((r) => r.decl).filter(([p]) => p === 'font-family')
    .map(([, v]) => v).filter((v) => !['var(--lt-font-family)', 'var(--lt-font-display)'].includes(v));
  assert.deepEqual(outras, [], 'font-family fora do par Sofia');
});

check('todo seletor de painel.css começa em .painel (nada global, nem .stat-card solto)', () => {
  const soltos = regras(css).flatMap((r) => r.seletores).filter((s) => !/^\.painel(?![\w-])/.test(s));
  assert.deepEqual(soltos, []);
});

check('alvos clicáveis têm 44px ou mais e foco visível com --lt-focus-ring', () => {
  const todas = regras(css);
  for (const classe of ['painel-indicador--acao', 'painel-lista__linha', 'painel-secao__acao', 'painel-botao']) {
    const alvo = todas.some((r) => r.seletores.some((s) => s.includes(`.${classe}`) || (classe === 'painel-indicador--acao' && s.endsWith('.painel-indicador')))
      && r.decl.some(([p, v]) => p === 'min-height' && v === 'var(--lt-target-min)'));
    assert.ok(alvo, `.${classe} sem min-height: var(--lt-target-min)`);
  }
  for (const classe of ['painel-indicador--acao', 'painel-lista__linha--acao', 'painel-secao__acao', 'painel-botao']) {
    const foco = todas.some((r) => r.seletores.some((s) => s.endsWith(`.${classe}:focus-visible`))
      && r.decl.some(([p, v]) => p === 'box-shadow' && v === 'var(--lt-focus-ring)'));
    assert.ok(foco, `.${classe}:focus-visible sem --lt-focus-ring`);
  }
});

check('movimento só com no-preference, sem laço acima de 5 s e sem will-change', () => {
  assert.deepEqual(problemasDeMovimento(css), []);
});

check('tons novos passam 4,5:1 como texto e 3:1 como gráfico', () => {
  const t = (nome) => token(nome, css, tokensLanding);
  const pares = [
    ['painel-atencao-texto', 'lt-color-surface', 4.5],
    ['painel-atencao-texto', 'painel-atencao-fundo', 4.5],
    ['painel-atencao-texto', 'lt-color-track-tint', 4.5],
    ['painel-atencao-traco', 'lt-color-surface', 3],
    ['lt-color-brand-green-text', 'painel-positivo-fundo', 3]
  ];
  for (const [frente, fundo, piso] of pares) {
    const razao = contraste(t(frente), t(fundo));
    console.log(`     --${frente} ${t(frente)} sobre --${fundo} ${t(fundo)} → ${razao.toFixed(2)}:1 (piso ${piso}:1)`);
    assert.ok(razao >= piso, `--${frente} sobre --${fundo}: ${razao.toFixed(2)}:1`);
  }
});

check('cabeçalho: saudação e nome num h2 (o h1 é do portal), papel e data em pt-BR', () => {
  const html = renderToStaticMarkup(h(painel.PainelCabecalho, { saudacao: 'Bom dia', nome: 'Maria', papel: 'Professora', data: DATA }));
  assert.match(html, /<h2 class="painel-cabecalho__titulo">Bom dia, Maria<\/h2>/);
  assert.match(html, /<time class="painel-cabecalho__data" dateTime="2026-09-26">sábado, 26 de setembro<\/time>/i);
  assert.match(html, />Professora</);
  const semNome = renderToStaticMarkup(h(painel.PainelCabecalho, { saudacao: 'Boa noite' }));
  assert.match(semNome, /<h2 class="painel-cabecalho__titulo">Boa noite<\/h2>/, 'sem nome não sobra vírgula');
});

check('indicadores: section com aria-label, lista, clicável vira botão com as classes de compatibilidade', () => {
  const itens = [
    { id: 'sup', rotulo: 'Atletas supervisionados', valor: 5, detalhe: '2 novos', icone: Icone, onClick: () => {} },
    { id: 'zero', rotulo: 'Consultas hoje', valor: 0 },
    { id: 'nulo', rotulo: 'Sem registro', valor: null, tom: 'atencao' }
  ];
  const html = renderToStaticMarkup(h(painel.PainelIndicadores, { rotulo: 'Indicadores do dia', itens }));
  assert.match(html, /^<section class="painel-indicadores" aria-label="Indicadores do dia">/);
  assert.match(html, /<ul role="list" class="painel-indicadores__lista"/);
  assert.equal(contar(html, /<li class="painel-indicadores__item">/g), 3);
  const encontrados = botoes(html);
  assert.equal(encontrados.length, 1, 'o item com onClick é botão, e só ele');
  const [botao] = encontrados;
  assert.match(botao, /^<button type="button" class="painel-indicador stat-card painel-indicador--neutro stat-card-action painel-indicador--acao">/);
  assert.match(botao, /Atletas supervisionados/);
  assert.match(html, /<div class="painel-indicador stat-card painel-indicador--neutro">[\s\S]*?>0<\/span>/, 'zero continua zero');
  assert.match(html, /<span aria-hidden="true">—<\/span><span class="painel-sr">sem dado<\/span>/, 'nulo não vira zero');
  assert.match(html, /painel-indicador--atencao[\s\S]*?Atenção/, 'atenção vem escrita');
  const carregando = renderToStaticMarkup(h(painel.PainelIndicadores, { rotulo: 'Indicadores', itens: [], carregando: true }));
  assert.match(carregando, /aria-busy="true"/);
  assert.equal(contar(carregando, /stat-card/g), 0, 'esqueleto não se passa por indicador');
});

check('seção: aria-labelledby aponta para o h2 e os estados são do próprio componente', () => {
  const base = { id: 'agenda', titulo: 'Agenda', acao: { rotulo: 'Ver todas', onClick: () => {} } };
  const pronto = renderToStaticMarkup(h(painel.PainelSecao, base, h('p', null, 'conteúdo')));
  assert.match(pronto, /^<section id="agenda" class="painel-secao" aria-labelledby="agenda-titulo">/);
  assert.match(pronto, /<h2 id="agenda-titulo" class="painel-secao__titulo">Agenda<\/h2>/);
  assert.match(pronto, /<button type="button" class="painel-secao__acao">Ver todas/);
  assert.match(pronto, /conteúdo/);
  const carregando = renderToStaticMarkup(h(painel.PainelSecao, { ...base, estado: 'carregando' }, 'conteúdo'));
  assert.match(carregando, /aria-busy="true"/);
  assert.doesNotMatch(carregando, /conteúdo/);
  const erro = renderToStaticMarkup(h(painel.PainelSecao, { ...base, estado: 'erro', erro: { mensagem: 'Falhou.', onTentarNovamente: () => {} } }));
  assert.match(erro, /role="alert">Falhou\.<\/p>/);
  assert.match(erro, /<button type="button" class="painel-botao">[\s\S]*Tentar novamente<\/button>/);
  const vazio = renderToStaticMarkup(h(painel.PainelSecao, { ...base, estado: 'vazio', vazio: { titulo: 'Nada pendente', descricao: 'Tudo em dia.' } }));
  assert.match(vazio, /Nada pendente[\s\S]*Tudo em dia\./);
  const semId = renderToStaticMarkup(h(painel.PainelSecao, { titulo: 'Outra' }));
  const [, rotulo] = semId.match(/aria-labelledby="([^"]+)"/);
  assert.match(semId, new RegExp(`<h2 id="${rotulo}"`), 'sem id, o rótulo ainda aponta para o h2');
});

check('lista: ul com aria-label; só a linha com onClick é botão', () => {
  const html = renderToStaticMarkup(h(painel.PainelLista, {
    rotuloAcessivel: 'Pendências',
    itens: [
      { id: 1, titulo: 'Revisar avaliação', subtitulo: 'Atleta A', meta: 'hoje', tom: 'atencao', onClick: () => {} },
      { id: 2, titulo: 'Consulta', subtitulo: 'Atleta B', meta: '14:00' }
    ]
  }));
  assert.match(html, /^<ul role="list" class="painel-lista" aria-label="Pendências">/);
  assert.equal(contar(html, /<li class="painel-lista__item">/g), 2);
  assert.equal(botoes(html).length, 1);
  assert.match(botoes(html)[0], /Revisar avaliação[\s\S]*Atenção/);
  assert.equal(renderToStaticMarkup(h(painel.PainelLista, { rotuloAcessivel: 'x', itens: [] })), '');
});

/* ── Reproduções sintéticas: cada verificação acusa o defeito ─────────── */
check('o teste detecta o defeito (saudação, fontes, exportações, movimento e escopo)', () => {
  // Saudação: fronteira deslocada de 12h para 13h e de 18h para 19h.
  const tardia = (d) => { const hora = d.getHours(); if (hora <= 12) return 'Bom dia'; if (hora < 19) return 'Boa tarde'; return 'Boa noite'; };
  assert.equal(divergenciasSaudacao(tardia).length, 2, 'a tabela pega 12:00 e 18:00');
  const adminMutado = regraDeGetGreeting(GET_GREETING_ORIGINAL.replace('h < 12', 'h < 13'));
  assert.deepEqual(horasDivergentes(painel.saudacaoPorHorario, adminMutado), [12], 'a comparação hora a hora pega 12h');

  // Fontes: Poppins em declaração é defeito; em comentário, não.
  assert.deepEqual(fontesProibidas('.painel .x { font-family: Poppins, sans-serif; }'), ['Poppins']);
  assert.deepEqual(fontesProibidas('/* sem Inter nem Poppins */ .painel .x { font-family: var(--lt-font-family); }'), []);
  assert.deepEqual(fontesProibidas('.painel .x { pointer-events: none; font-family: "Space Grotesk"; }'), ['Space Grotesk']);
  assert.equal(fonteDe('.painel .painel-secao__titulo { margin: 0; }', 'painel-secao__titulo'), null, 'título sem font-family herda Poppins do h2 global');

  // Exportações: um nome do contrato ausente.
  const semLista = { ...painel, PainelLista: undefined };
  assert.deepEqual(exportacoesFaltando(semLista), ['PainelLista']);

  // Movimento: sem guarda, em laço, longo demais e com will-change.
  assert.equal(problemasDeMovimento('.painel .a { animation: p 1s 3; }').length, 1);
  assert.equal(problemasDeMovimento('@media (prefers-reduced-motion: no-preference) { .painel .a { animation: p 1.4s ease-in-out infinite; } }').length, 1);
  assert.equal(problemasDeMovimento('@media (prefers-reduced-motion: no-preference) { .painel .a { animation: p 1.6s ease-in-out 4; } }').length, 1);
  assert.equal(problemasDeMovimento('@media (prefers-reduced-motion: no-preference) { .painel .a { animation: p 1.6s ease-in-out 3; } }').length, 0);
  assert.equal(problemasDeMovimento('.painel .a { will-change: transform; transition: transform 200ms; }').length, 2);

  // Escopo: uma regra .stat-card solta vazaria para as outras telas.
  const soltos = regras('.painel .ok { color: red; } .stat-card { border: 0; }').flatMap((r) => r.seletores)
    .filter((s) => !/^\.painel(?![\w-])/.test(s));
  assert.deepEqual(soltos, ['.stat-card']);
});

/* ── Lacunas que a prova de mutação da revisão independente expôs (27/09) ── */
check('cabeçalho: dateTime usa o dia local, não o UTC (21h30 ainda é o mesmo dia)', () => {
  const noite = new Date(2026, 8, 26, 21, 30); // em UTC-3 já é 27/09 00:30
  const html = renderToStaticMarkup(h(painel.PainelCabecalho, { saudacao: 'Boa noite', data: noite }));
  assert.match(html, /dateTime="2026-09-26"|datetime="2026-09-26"/, 'toISOString() daria o dia seguinte no fuso de Brasília');
});

check('item expandido: aria-expanded e estado visível; sem a prop, nenhum aria-expanded', () => {
  const itens = [{ id: 'a', rotulo: 'A', valor: 1, onClick: () => {}, expandido: true }, { id: 'b', rotulo: 'B', valor: 2, onClick: () => {} }];
  const html = renderToStaticMarkup(h(painel.PainelIndicadores, { rotulo: 'Indicadores', itens }));
  assert.equal(contar(html, /aria-expanded="true"/g), 1, 'só o item expandido anuncia o estado');
  assert.match(html, /painel-indicador--ativo/);
  const lista = renderToStaticMarkup(h(painel.PainelLista, { rotuloAcessivel: 'L', itens: [{ id: 'x', titulo: 'X', onClick: () => {}, expandido: false }] }));
  assert.match(lista, /aria-expanded="false"/);
});

check('tom "atencao" muda só o acento, nunca o fundo inteiro do indicador (contrato)', () => {
  const semComentarios = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const regras = [...semComentarios.matchAll(/([^{}]*painel-indicador--atencao[^{}]*)\{([^}]*)\}/g)];
  const pintaFundo = regras.filter(([, seletor, corpo]) => !/::?(before|after)|__/.test(seletor) && /(^|;)\s*background(-color)?\s*:/.test(corpo));
  assert.deepEqual(pintaFundo.map(([, s]) => s.trim()), [], 'a regra do próprio cartão não pode trocar o fundo');
});

console.log(`\n${passed} verificações das peças da Visão geral passaram.`);
