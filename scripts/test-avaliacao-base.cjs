/* Base comum dos formulários de avaliação (src/components/Avaliacoes/base/ e
 * avaliacao-base.css) e as peças comuns que ela ajustou (EvaluationHeader,
 * EvaluationReadiness e ValorAnterior).
 *
 * Contrato: docs/implementacao/avaliacoes-v2/contrato-avaliacao.md. Prova:
 *   1. marcação acessível, renderizada no servidor (sem navegador): rótulo
 *      ligado ao controle, aria-describedby com unidade, ajuda e erro,
 *      fieldset/legend, "—" no lugar de valor ausente, classificação escrita
 *      e títulos no nível do contrato (módulo h3, seção h4, subseção h5);
 *      e as props da consolidação: dica "?" fora do rótulo (fechada e
 *      aberta), tom de campo e de grupo, rótulo opcional, valor em texto e
 *      variação no resultado, grupo rotulado por título e idTituloSecao;
 *   2. o CSS, lido pelo postcss do projeto: só o par Sofia, todo seletor
 *      dentro de .av-modulo, todo --lt-* existente em landing-tokens.css, cor
 *      fixa só em token, sem will-change e sem animação, alvos de 44 px,
 *      campos de 48 px, foco com --lt-focus-ring e contraste dos pares;
 *   3. reproduções sintéticas: cada verificação acusa o defeito.
 *
 * Node puro. AVALIACAO_BASE_RAIZ existe só para a prova de mutação: aponta o
 * teste para uma cópia dos arquivos, nunca para o repositório alterado. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const Module = require('node:module');

const repo = path.resolve(__dirname, '..');
const raiz = process.env.AVALIACAO_BASE_RAIZ ? path.resolve(process.env.AVALIACAO_BASE_RAIZ) : repo;
const esbuild = require(path.join(repo, 'node_modules', 'esbuild'));
const postcss = require(path.join(repo, 'node_modules', 'postcss'));
const React = require(path.join(repo, 'node_modules', 'react'));
const { createElement: h } = React;
const { renderToStaticMarkup } = require(path.join(repo, 'node_modules', 'react-dom', 'server'));

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`PASS ${name}`); };
const ler = (rel) => fs.readFileSync(path.join(raiz, rel), 'utf8');

const BASE_REL = 'src/components/Avaliacoes/base';
const CSS_REL = `${BASE_REL}/avaliacao-base.css`;
const NOMES = [
  'AvaliacaoModulo', 'AvaliacaoSecao', 'AvaliacaoIndice', 'Campo', 'CampoNumero', 'GrupoOpcoes', 'Opcao',
  'ResultadoCalculado', 'AvisoAvaliacao', 'BarraAcoesAvaliacao', 'Tendencia', 'normalizarTom', 'valorAusente'
];

// Compila a base e as três peças comuns num só pacote, com o esbuild do
// projeto; react e lucide-react ficam externos (node_modules do repositório).
function carregarBase() {
  const saida = esbuild.buildSync({
    stdin: {
      contents: [
        "export * from './base/index.js';",
        "export { efeitoDaTeclaNaDica, tomDaVariacao, normalizarDica } from './base/apoio.js';",
        "export { default as EvaluationHeader } from './components/EvaluationHeader.jsx';",
        "export { default as EvaluationReadiness } from './components/EvaluationReadiness.jsx';",
        "export { default as ValorAnterior } from './components/ValorAnterior.jsx';",
        "export { default as MiniSparkline } from '../shared/MiniSparkline.jsx';"
      ].join('\n'),
      resolveDir: path.join(raiz, 'src/components/Avaliacoes'),
      sourcefile: 'entrada-test-avaliacao-base.js',
      loader: 'js'
    },
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
  const destino = path.join(repo, 'scripts', '__test-avaliacao-base-bundle.cjs');
  const mod = new Module(destino, null);
  mod.filename = destino;
  mod.paths = Module._nodeModulePaths(repo);
  mod._compile(saida.outputFiles[0].text, destino);
  return mod.exports;
}

/* ── Leitura da marcação ─────────────────────────────────────────────── */
const noop = () => {};
const render = (el) => renderToStaticMarkup(el);
const contar = (html, re) => (html.match(re) || []).length;
const attr = (tag, nome) => {
  const m = tag.match(new RegExp(`\\s${nome}="([^"]*)"`, 'i'));
  return m ? m[1] : null;
};
const tags = (html, nome) => [...html.matchAll(new RegExp(`<${nome}\\b[^>]*>`, 'gi'))].map((m) => m[0]);
const idsDoHtml = (html) => new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
const textoDoId = (html, id) => {
  const m = html.match(new RegExp(`id="${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>([\\s\\S]*?)</(?:p|span|label|legend)>`));
  return m ? m[1].replace(/<[^>]+>/g, '') : null;
};

// Controles de formulário sem rótulo ligado: nem <label for=id>, nem dentro
// de um <label>. Caixa e rádio dentro do <label> da opção contam como ligados.
function controlesSemRotulo(html) {
  const paraIds = new Set(tags(html, 'label').map((t) => attr(t, 'for')).filter(Boolean));
  const problemas = [];
  const re = /<(input|select|textarea)\b[^>]*>/gi;
  let m;
  while ((m = re.exec(html))) {
    const tag = m[0];
    if (/type="hidden"/i.test(tag)) continue;
    const id = attr(tag, 'id');
    const antes = html.slice(0, m.index);
    const dentroDeLabel = antes.lastIndexOf('<label') > antes.lastIndexOf('</label>');
    if (!(id && paraIds.has(id)) && !dentroDeLabel) problemas.push(tag);
  }
  // E rótulo apontando para id que não existe.
  const ids = idsDoHtml(html);
  for (const alvo of paraIds) if (!ids.has(alvo)) problemas.push(`label for="${alvo}" sem controle`);
  return problemas;
}

// aria-describedby / aria-labelledby apontando para id ausente.
function referenciasQuebradas(html) {
  const ids = idsDoHtml(html);
  const problemas = [];
  for (const m of html.matchAll(/aria-(?:describedby|labelledby)="([^"]+)"/g)) {
    for (const id of m[1].split(/\s+/)) if (!ids.has(id)) problemas.push(id);
  }
  return problemas;
}

// Níveis de título na ordem do documento: [[nivel, texto]].
const titulos = (html) => [...html.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/g)]
  .map((m) => [Number(m[1]), m[2].replace(/<[^>]+>/g, '')]);

// Ausência que virou zero: o valor exibido é "0" sem que o dado seja 0.
const mostraZero = (html) => /av-resultado__numero[^>]*>\s*0\s*</.test(html);

// Elemento interativo (button, role="button", tabindex) dentro de um <label>
// ou <legend>: o nome dele entraria no nome acessível do campo ou do grupo.
const interativosNoRotulo = (html) => [...html.matchAll(/<(label|legend)\b[^>]*>([\s\S]*?)<\/\1>/g)]
  .filter((m) => /<button\b|role="button"|tabindex="0"/i.test(m[2])).map((m) => m[0]);

// aria-controls apontando para id ausente.
const controlesQuebrados = (html) => {
  const ids = idsDoHtml(html);
  return [...html.matchAll(/aria-controls="([^"]+)"/g)].map((m) => m[1]).filter((id) => !ids.has(id));
};

// Renderiza com a dica já aberta: o único useState da base é o da dica
// (verificado acima), e o SSR não tem clique. Troca o valor inicial só
// durante esta renderização.
function renderAberta(el) {
  const original = React.useState;
  React.useState = (inicial) => original(inicial === false ? true : inicial);
  try { return render(el); } finally { React.useState = original; }
}

/* ── Leitura do CSS (postcss do projeto) ─────────────────────────────── */
const semComentarios = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

function regrasCss(css) {
  const saida = [];
  postcss.parse(css).walkRules((regra) => {
    let pai = regra.parent;
    let media = null;
    while (pai && pai.type !== 'root') {
      if (pai.type === 'atrule' && /keyframes$/i.test(pai.name)) return;
      if (pai.type === 'atrule' && pai.name === 'media') media = [pai.params, media].filter(Boolean).join(' and ');
      pai = pai.parent;
    }
    const decl = [];
    regra.walkDecls((d) => decl.push([d.prop.toLowerCase(), d.value, d.important]));
    saida.push({ seletores: regra.selectors.map((s) => s.trim().replace(/\s+/g, ' ')), decl, media });
  });
  return saida;
}

const ESCOPO = /^\.av-modulo(?![\w-])/;
const seletoresForaDoEscopo = (css) => regrasCss(css).flatMap((r) => r.seletores).filter((s) => !ESCOPO.test(s));

const FONTES_PERMITIDAS = new Set(['var(--lt-font-family)', 'var(--lt-font-display)', 'inherit']);
const FONTES_PROIBIDAS = /\b(Inter|Poppins|Outfit|Space\s+Grotesk|Roboto|Arial|Helvetica)\b/gi;
function problemasDeFonte(css) {
  const achados = [...semComentarios(css).replace(/@import[^;]+;/g, '').matchAll(FONTES_PROIBIDAS)].map((m) => `família proibida: ${m[0]}`);
  for (const r of regrasCss(css)) {
    for (const [p, v] of r.decl) {
      if (p === 'font-family' && !FONTES_PERMITIDAS.has(v)) achados.push(`font-family fora do par Sofia: ${v}`);
      if (p === 'font') achados.push(`atalho font (esconde a família): ${v}`);
    }
  }
  // O @import do Google Fonts pede só as duas Sofia.
  for (const m of semComentarios(css).matchAll(/@import\s+url\(['"]?([^'")]+)['"]?\)/g)) {
    const familias = [...m[1].matchAll(/family=([^:&]+)/g)].map((f) => decodeURIComponent(f[1].replace(/\+/g, ' ')));
    for (const f of familias) if (!/^Sofia Sans( Extra Condensed)?$/.test(f)) achados.push(`@import de família fora do par: ${f}`);
  }
  return achados;
}

const tokensDeclarados = (css) => new Set([...semComentarios(css).matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
const tokensUsados = (css) => new Set([...semComentarios(css).matchAll(/var\(\s*(--[\w-]+)/g)].map((m) => m[1]));
function tokensInexistentes(css, tokensLanding) {
  const landing = tokensDeclarados(tokensLanding);
  const locais = tokensDeclarados(css);
  return [...tokensUsados(css)].filter((t) => (t.startsWith('--lt-') ? !landing.has(t) : !locais.has(t)));
}

// Cor fixa (hex, rgb, hsl ou nome) fora da declaração de um token --av-*.
const COR_FIXA = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?)\(|\b(?:white|black|red|green|blue|gray|grey|orange|yellow|purple|pink)\b/i;
function coresFixas(css) {
  const achados = [];
  for (const r of regrasCss(css)) {
    for (const [p, v] of r.decl) {
      if (p.startsWith('--av-')) continue;
      // Sem url(...) e sem var(--...): "blue" em --lt-color-brand-blue é nome
      // de token, não cor.
      let limpo = v.replace(/url\([^)]*\)/g, '');
      while (/var\([^()]*\)/.test(limpo)) limpo = limpo.replace(/var\([^()]*\)/g, '');
      if (COR_FIXA.test(limpo)) achados.push(`${r.seletores[0]} { ${p}: ${v} }`);
    }
  }
  return achados;
}

// Movimento: nenhuma animação (a base não anima), nenhuma transição de
// transform/all e nenhum will-change.
function problemasDeMovimento(css) {
  const achados = [];
  if (/will-change/i.test(semComentarios(css))) achados.push('will-change declarado');
  for (const r of regrasCss(css)) {
    for (const [p, v] of r.decl) {
      if (p.startsWith('animation') && v !== 'none') achados.push(`animação: ${r.seletores[0]} { ${p}: ${v} }`);
      if (p.startsWith('transition') && /\b(transform|all)\b/.test(v)) achados.push(`transição de movimento: ${r.seletores[0]} { ${p}: ${v} }`);
    }
  }
  return achados;
}

const importantes = (css) => regrasCss(css).flatMap((r) => r.decl.filter(([, , imp]) => imp).map(([p]) => `${r.seletores[0]} { ${p} !important }`));

// Regra cujo seletor contém o trecho pedido e declara prop: valor.
const temRegra = (css, trecho, prop, valor) => regrasCss(css)
  .some((r) => r.seletores.some((s) => s.includes(trecho)) && r.decl.some(([p, v]) => p === prop && v === valor));

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
    const valores = [...semComentarios(css).matchAll(new RegExp(`--${nome}\\s*:\\s*([^;]+);`, 'g'))].map((m) => m[1].trim());
    const valor = valores[valores.length - 1];
    if (!valor) continue;
    const alias = valor.match(/^var\(\s*--([\w-]+)\s*\)$/);
    if (alias) return token(alias[1], ...folhas);
    assert.match(valor, /^#[0-9a-f]{3,6}$/i, `--${nome} não é um hexadecimal: ${valor}`);
    return valor;
  }
  throw new Error(`token --${nome} não encontrado`);
}

/* ═════════════════════════════ Verificações ═════════════════════════════ */
const base = carregarBase();
const css = ler(CSS_REL);
const tokensLanding = fs.readFileSync(path.join(repo, 'src/views/landing/landing-tokens.css'), 'utf8');

check('a base exporta os nomes do contrato', () => {
  assert.deepEqual(NOMES.filter((n) => typeof base[n] !== 'function'), []);
});

// O único estado aceito é o da dica "?" (aberta ou fechada), estado de
// interface que nunca vai para o dado salvo: um useState, só em useDica.js.
const ARQUIVO_DO_ESTADO_DA_DICA = 'useDica.js';
check('só apresentação: nenhum estado de negócio, efeito ou chamada de API nos componentes da base', () => {
  const arquivos = fs.readdirSync(path.join(raiz, BASE_REL)).filter((f) => /\.jsx?$/.test(f));
  const achados = arquivos.flatMap((f) => {
    const fonte = ler(`${BASE_REL}/${f}`);
    const proibidos = [/\buseReducer\b/, /\buseEffect\b/, /\buseLayoutEffect\b/, /\bfetch\(/, /\baxios\b/, /from ['"][^'"]*services?\//, /\bapi\./];
    if (f !== ARQUIVO_DO_ESTADO_DA_DICA) proibidos.push(/\buseState\b/);
    return proibidos.filter((re) => re.test(fonte)).map((re) => `${f}: ${re}`);
  });
  assert.deepEqual(achados, []);
  const estados = ler(`${BASE_REL}/${ARQUIVO_DO_ESTADO_DA_DICA}`).match(/\buseState\(/g) || [];
  assert.equal(estados.length, 1, 'useDica.js tem um único useState (dica aberta ou fechada)');
});

check('Campo: rótulo ligado por for/id; unidade, ajuda e erro em aria-describedby; value/onChange intactos', () => {
  const html = render(h(base.Campo, {
    rotulo: 'Peso', unidade: 'kg', ajuda: 'Balança calibrada', erro: 'Informe o peso', obrigatorio: true, className: 'eval-field'
  }, h('input', { className: 'eval-input', value: '72,5', onChange: noop })));
  assert.deepEqual(controlesSemRotulo(html), []);
  assert.deepEqual(referenciasQuebradas(html), []);
  const [input] = tags(html, 'input');
  assert.equal(attr(input, 'class'), 'eval-input av-controle', 'a classe do formulário fica e ganha av-controle');
  assert.equal(attr(input, 'value'), '72,5');
  assert.equal(attr(input, 'aria-invalid'), 'true');
  const descritos = attr(input, 'aria-describedby').split(' ').map((id) => textoDoId(html, id));
  assert.deepEqual(descritos, ['kg', 'Balança calibrada', 'Informe o peso']);
  assert.equal(attr(input, 'placeholder'), null, 'a unidade não mora no placeholder');
  assert.match(html, /<span class="av-campo__unidade" id="[^"]+">kg<\/span>/, 'unidade visível');
  assert.match(html, /^<div class="av-campo av-campo--erro eval-field">/, 'a classe legada vem de className');
});

check('Campo: obrigatório escrito por extenso dentro do rótulo, não só um asterisco', () => {
  const html = render(h(base.Campo, { rotulo: 'Estatura', obrigatorio: true, classeObrigatorio: 'dobras-required-dot' }, h('input', {})));
  const [label] = html.match(/<label\b[\s\S]*?<\/label>/);
  assert.match(label, /Estatura <span class="av-campo__obrigatorio dobras-required-dot">obrigatório<\/span>/);
  assert.doesNotMatch(label, /\*/);
});

check('Campo: sem className, nenhuma classe legada (o modo essencial conta .eval-field)', () => {
  const html = render(h(base.Campo, { rotulo: 'Modalidade' }, h('input', { type: 'text' })));
  assert.match(html, /^<div class="av-campo">/);
  assert.doesNotMatch(html, /eval-field/);
});

check('Campo: id do controle preservado; função recebe os props de ligação; grupo rotulado', () => {
  const comId = render(h(base.Campo, { rotulo: 'Peso' }, h('input', { id: 'bia-peso' })));
  assert.match(comId, /<label class="av-campo__rotulo" id="bia-peso-rotulo" for="bia-peso">/);
  const funcao = render(h(base.Campo, { rotulo: 'Sexo', ajuda: 'Como no documento' }, (p) => h('select', { ...p, className: 'av-controle' }, h('option', null, 'F'))));
  assert.deepEqual(controlesSemRotulo(funcao), []);
  assert.deepEqual(referenciasQuebradas(funcao), []);
  assert.match(tags(funcao, 'select')[0], /aria-describedby="[^"]+-ajuda"/);
  const grupo = render(h(base.Campo, { rotulo: 'Lados' }, h('button', { type: 'button' }, 'D'), h('button', { type: 'button' }, 'E')));
  assert.match(grupo, /<span class="av-campo__rotulo" id="([^"]+)">Lados<\/span>[\s\S]*role="group" aria-labelledby="\1"/);
  const oculto = render(h(base.Campo, { rotulo: 'Medida 1', rotuloOculto: true }, h('input', {})));
  assert.match(oculto, /<label class="av-campo__rotulo av-sr"[^>]* for="/);
});

check('CampoNumero: input decimal rotulado, unidade visível e type do formulário preservado', () => {
  const html = render(h(base.CampoNumero, { rotulo: 'Altura', unidade: 'cm', value: '170', onChange: noop, name: 'altura', inputClassName: 'eval-input' }));
  assert.deepEqual(controlesSemRotulo(html), []);
  const [input] = tags(html, 'input');
  assert.equal(attr(input, 'type'), 'text');
  assert.equal(attr(input, 'inputmode'), 'decimal');
  assert.equal(attr(input, 'name'), 'altura');
  assert.equal(attr(input, 'value'), '170');
  assert.match(html, />cm<\/span>/);
  const numero = render(h(base.CampoNumero, { rotulo: 'FC', type: 'number', step: '1', value: 60, onChange: noop }));
  assert.equal(attr(tags(numero, 'input')[0], 'type'), 'number', 'type="number" continua number');
  assert.equal(attr(tags(numero, 'input')[0], 'step'), '1');
});

check('GrupoOpcoes: fieldset com legend primeiro; opções com name/value/checked do formulário', () => {
  const html = render(h(base.GrupoOpcoes, { legenda: 'Há moradores menores de 18 anos no domicílio?', ajuda: 'Moradores fixos', erro: 'Escolha uma opção', obrigatorio: true, horizontal: true },
    h(base.Opcao, { rotulo: 'Sim', name: 'temMenores', value: 'sim', checked: true, onChange: noop }),
    h(base.Opcao, { rotulo: 'Não', name: 'temMenores', value: 'nao', checked: false, onChange: noop })));
  assert.match(html, /^<fieldset class="av-grupo av-grupo--horizontal av-grupo--erro" aria-describedby="[^"]+">(<legend class="av-grupo__legenda">)Há moradores menores de 18 anos no domicílio\? <span class="av-campo__obrigatorio">obrigatório<\/span><\/legend>/);
  assert.deepEqual(referenciasQuebradas(html), []);
  assert.deepEqual(controlesSemRotulo(html), []);
  const opcoes = tags(html, 'input');
  assert.equal(opcoes.length, 2);
  assert.equal(attr(opcoes[0], 'type'), 'radio');
  assert.equal(attr(opcoes[0], 'name'), 'temMenores');
  assert.equal(attr(opcoes[0], 'value'), 'sim');
  assert.match(opcoes[0], /checked=""/);
  assert.doesNotMatch(opcoes[1], /checked/);
  const caixa = render(h(base.Opcao, { tipo: 'checkbox', rotulo: 'Histórico de amenorreia', checked: false, onChange: noop }));
  assert.match(caixa, /^<label class="av-opcao"><input type="checkbox"/);
});

check('ResultadoCalculado: "—" quando não há valor, nunca 0; zero continua zero', () => {
  for (const ausente of [null, undefined, '', Number.NaN, Infinity]) {
    const html = render(h(base.ResultadoCalculado, { rotulo: 'IMC', valor: ausente, unidade: 'kg/m²' }));
    assert.match(html, /<span aria-hidden="true">—<\/span><span class="av-sr">sem valor<\/span>/, `valor ${String(ausente)}`);
    assert.equal(mostraZero(html), false);
    assert.doesNotMatch(html, /kg\/m²/, 'sem valor, sem unidade solta');
  }
  const zero = render(h(base.ResultadoCalculado, { rotulo: 'Faltas', valor: 0, unidade: 'dias' }));
  assert.match(zero, /av-resultado__numero">0<\/span> <span class="av-resultado__unidade">dias<\/span>/);
  const texto = render(h(base.ResultadoCalculado, { rotulo: '% gordura', valor: null, semValor: 'Não calculado' }));
  assert.match(texto, />Não calculado</);
  assert.doesNotMatch(texto, /—/);
});

check('ResultadoCalculado: classificação escrita; o tom só vale com ela', () => {
  const html = render(h(base.ResultadoCalculado, {
    rotulo: 'IMC', valor: '23,4', unidade: 'kg/m²', classificacao: 'Eutrofia', tom: 'warn', referencia: '18,5 a 24,9 kg/m² (OMS)', metodo: 'Peso ÷ estatura²'
  }));
  assert.match(html, /^<div class="av-resultado av-resultado--atencao">/);
  assert.match(html, /<p class="av-resultado__classificacao">Eutrofia<\/p>/);
  assert.match(html, /18,5 a 24,9 kg\/m² \(OMS\)/);
  assert.match(html, /Peso ÷ estatura²/);
  const semTexto = render(h(base.ResultadoCalculado, { rotulo: 'IMC', valor: '31', tom: 'risk' }));
  assert.match(semTexto, /^<div class="av-resultado av-resultado--neutro">/, 'tom sem classificação escrita não pinta');
  assert.equal(base.normalizarTom('ok'), 'positivo');
  assert.equal(base.normalizarTom('danger'), 'perigo');
  assert.equal(base.normalizarTom('qualquer'), 'neutro');
});

check('títulos: módulo h3, seção h4, subseção h5; seção avulsa h4; aria-labelledby no título', () => {
  const html = render(h(base.AvaliacaoModulo, { titulo: 'Bioimpedância', descricao: 'Composição por BIA', status: 'Rascunho', statusTom: 'warn', data: new Date(2026, 8, 27, 22, 30) },
    h(base.AvaliacaoSecao, { id: 'bia-medidas', titulo: 'Medidas' },
      h(base.AvaliacaoSecao, { id: 'bia-tronco', titulo: 'Tronco' }, h('p', null, 'x')))));
  assert.deepEqual(titulos(html), [[3, 'Bioimpedância'], [4, 'Medidas'], [5, 'Tronco']]);
  assert.match(html, /^<div class="av-modulo">/);
  assert.match(html, /<section id="bia-medidas" class="av-secao" aria-labelledby="bia-medidas-titulo">/);
  assert.match(html, /<section id="bia-tronco" class="av-secao av-secao--sub" aria-labelledby="bia-tronco-titulo">/);
  assert.match(html, /<h4 id="bia-medidas-titulo" class="av-secao__titulo" tabindex="-1">Medidas<\/h4>/i);
  assert.match(html, /<span class="av-selo av-selo--atencao">Rascunho<\/span>/);
  assert.match(html, /datetime="2026-09-27"[^>]*>27\/09\/2026<\/time>/i, 'dia local, não UTC');
  assert.deepEqual(referenciasQuebradas(html), []);
  const avulsa = render(h(base.AvaliacaoSecao, { titulo: 'Observações' }, 'x'));
  assert.deepEqual(titulos(avulsa), [[4, 'Observações']]);
  assert.deepEqual(referenciasQuebradas(avulsa), []);
  const imagem = render(h(base.AvaliacaoModulo, { titulo: 'Imagem', nivelTitulo: 2 }, h(base.AvaliacaoSecao, { titulo: 'Fotos' })));
  assert.deepEqual(titulos(imagem), [[2, 'Imagem'], [3, 'Fotos']]);
});

check('índice "Neste formulário": nav rotulada e âncoras para as seções', () => {
  const html = render(h(base.AvaliacaoIndice, { itens: [{ id: 'bia-medidas', titulo: 'Medidas' }, { id: 'bia-resultados', titulo: 'Resultados' }] }));
  assert.match(html, /^<nav class="av-indice" aria-labelledby="([^"]+)"><p id="\1" class="av-indice__titulo">Neste formulário<\/p><ol class="av-indice__lista">/);
  assert.match(html, /<a class="av-indice__link" href="#bia-medidas">Medidas<\/a>/);
  assert.equal(contar(html, /<li class="av-indice__item">/g), 2);
  assert.equal(render(h(base.AvaliacaoIndice, { itens: [] })), '');
});

check('barra de ações: região de status sempre presente e os mesmos textos de hoje', () => {
  const botao = h('button', { type: 'button', className: 'ui-button ui-button-primary' }, 'Salvar avaliação');
  const vazio = render(h(base.BarraAcoesAvaliacao, { status: null }, botao));
  assert.match(vazio, /^<div class="av-acoes"><span class="av-acoes__status" role="status" aria-live="polite"><\/span><button/);
  assert.match(vazio, />Salvar avaliação<\/button>/);
  const esperado = { saving: 'Salvando...', saved: 'Salvo', error: 'Erro ao salvar' };
  for (const [status, texto] of Object.entries(esperado)) {
    const html = render(h(base.BarraAcoesAvaliacao, { status }, botao));
    assert.match(html, new RegExp(`class="av-acoes__status save-indicator ${status}" role="status" aria-live="polite">(?:<svg[\\s\\S]*?</svg>)?${texto.replace('.', '\\.')}</span>`));
  }
  const alimentar = render(h(base.BarraAcoesAvaliacao, { status: 'error', textosStatus: { error: 'Erro' } }, botao));
  assert.match(alimentar, /(?:<\/svg>)Erro<\/span>/);
});

check('aviso: tipo em ícone e prefixo lido; texto do formulário intacto', () => {
  const html = render(h(base.AvisoAvaliacao, { tipo: 'atencao' }, 'Somente leitura para o seu perfil.'));
  assert.match(html, /^<div class="av-aviso av-aviso--atencao"><svg[^>]*aria-hidden="true"/);
  assert.match(html, /<span class="av-sr">Atenção: <\/span>Somente leitura para o seu perfil\./);
  assert.doesNotMatch(html, /role=/, 'aviso estático não é região viva');
  const perigo = render(h(base.AvisoAvaliacao, { tipo: 'perigo', anunciar: true, rotuloTipo: '' }, 'Falha ao salvar.'));
  assert.match(perigo, /role="alert"/);
  assert.doesNotMatch(perigo, /av-sr/);
});

check('tendência: mesma série do MiniSparkline, gráfico escondido e resumo em texto', () => {
  const valores = [24.1, 23.5, 22.3];
  const html = render(h(base.Tendencia, { rotulo: '% gordura (últimos 6)', valores, alvo: 23, largura: 240, altura: 82, unidade: '%', casas: 1, rotuloAlvo: 'valor anterior' }));
  assert.match(html, /^<figure class="av-tendencia"><figcaption class="av-tendencia__rotulo">% gordura \(últimos 6\)<\/figcaption><div class="av-tendencia__grafico" aria-hidden="true"><svg/);
  const direto = render(h(base.MiniSparkline, { values: valores, target: 23, width: 240, height: 82 }));
  assert.ok(html.includes(direto), 'o SVG é o mesmo do MiniSparkline com os mesmos dados');
  assert.match(html, /<p class="av-sr">3 medições; primeira 24,1 %; última 22,3 %; valor anterior 23 %\.<\/p>/);
  const vazio = render(h(base.Tendencia, { rotulo: 'GET (últimos 6)', valores: [] }));
  assert.match(vazio, /mini-sparkline--empty">Sem dados<\/div>/);
  assert.match(vazio, /<p class="av-sr">Sem dados<\/p>/);
});

check('peças comuns: API e textos visíveis iguais, estado também para o leitor de tela', () => {
  const cabecalho = render(h(base.EvaluationHeader, { icon: h('svg'), title: 'Hidratação', subtitle: 'Balanço hídrico', badge: h('span', null, 'Salvo') }));
  assert.match(cabecalho, /<div class="eval-icon" aria-hidden="true">/);
  assert.match(cabecalho, /<h3 class="eval-title">Hidratação<\/h3>/);
  const prontidao = render(h(base.EvaluationReadiness, { items: [
    { key: 'loss', label: 'Perda percentual', status: 'warning', value: '1,23%' },
    { key: 'core', label: 'Campos de finalização', status: 'pending' },
    { key: 'zero', label: 'Carga', status: 'ok', value: 0 }
  ] }));
  assert.match(prontidao, /aria-label="Prontidao do modulo"/);
  assert.match(prontidao, /<strong>1,23%<\/strong><span style="[^"]*clip-path:inset\(50%\)[^"]*"> \(Atenção\)<\/span>/);
  assert.match(prontidao, /<strong>Pendente<\/strong><\/div>/, 'sem valor, o texto visível é o de antes');
  assert.match(prontidao, /<strong>OK<\/strong><\/div>/, 'valor 0 não deixa um "0" solto');
  assert.equal(render(h(base.ValorAnterior, { anterior: null, atual: '10' })), '');
  const bom = render(h(base.ValorAnterior, { anterior: { valor: 23, data: null }, atual: '22', unidade: '%', melhorQuando: 'menor' }));
  assert.match(bom, /^<span class="valor-anterior tom-bom"><span style="[^"]+">Valor anterior: <\/span><span class="valor-anterior__base">23,0%<\/span>/);
  assert.match(bom, /−1,0%<span style="[^"]+"> \(na direção desejada\)<\/span>/);
  const atencao = render(h(base.ValorAnterior, { anterior: { valor: 23, data: null }, atual: '24', unidade: '%', melhorQuando: 'menor' }));
  assert.match(atencao, /tom-atencao[\s\S]*<svg[^>]*aria-hidden="true"[\s\S]*\+1,0%<span style="[^"]+"> \(atenção: na direção oposta à desejada\)<\/span>/);
  const neutro = render(h(base.ValorAnterior, { anterior: { valor: 23, data: null }, atual: '24', unidade: '%' }));
  assert.doesNotMatch(neutro, /direção|<svg/, 'sem direção desejada, nada de tom');
});

/* ── Props novas da consolidação (dica, tom, rótulo e valor do resultado,
      variação, grupo rotulado por título, id do título da seção) ──────── */
const LINHAS_DICA = ['Siri (1956): %G = (495 / DC) - 450', 'Brozek (1963): %G = (4.57 / DC - 4.142) x 100'];

check('a base exporta Dica e idTituloSecao; idTituloSecao é o id do título de AvaliacaoSecao', () => {
  assert.equal(typeof base.Dica, 'function');
  assert.equal(base.idTituloSecao('bia-medidas'), 'bia-medidas-titulo');
  const html = render(h(base.AvaliacaoSecao, { id: 'bia-medidas', titulo: 'Medidas' }, 'x'));
  assert.match(html, new RegExp(`<h4 id="${base.idTituloSecao('bia-medidas')}"`));
});

check('Campo com dica: botão de 44 px fora do <label>, aria-expanded/aria-controls, painel hidden; o nome do campo não leva o do botão', () => {
  const html = render(h(base.Campo, { rotulo: 'Conversao de % gordura', dica: { texto: LINHAS_DICA, rotulo: 'Abrir informação' }, className: 'eval-field' },
    h('select', { className: 'eval-input', value: 'siri', onChange: noop }, h('option', { value: 'siri' }, 'Siri'))));
  assert.deepEqual(interativosNoRotulo(html), []);
  const [label] = html.match(/<label\b[\s\S]*?<\/label>/);
  assert.doesNotMatch(label, /Abrir|\?/, 'o rótulo não contém o botão nem o "?"');
  const [botao] = tags(html, 'button');
  assert.equal(attr(botao, 'type'), 'button');
  assert.equal(attr(botao, 'class'), 'av-dica__botao');
  assert.equal(attr(botao, 'aria-label'), 'Abrir informação', 'o mesmo nome de antes');
  assert.equal(attr(botao, 'aria-expanded'), 'false');
  const painelId = attr(botao, 'aria-controls');
  assert.match(html, new RegExp(`<span class="av-dica__painel" id="${painelId}" hidden="">${LINHAS_DICA.map((l) => `<span class="av-dica__linha">${l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</span>`).join('')}</span>`));
  assert.match(html, /<button[^>]*><span class="av-dica__marca" aria-hidden="true">\?<\/span><\/button>/);
  assert.deepEqual(controlesQuebrados(html), []);
  assert.deepEqual(referenciasQuebradas(html), []);
  assert.doesNotMatch(attr(tags(html, 'select')[0], 'aria-describedby') || '', new RegExp(painelId), 'fechada, a dica não descreve o controle');
  const semDica = render(h(base.Campo, { rotulo: 'Protocolo', dica: [] }, h('input', {})));
  assert.doesNotMatch(semDica, /av-dica/, 'dica sem texto não vira botão');
  const numero = render(h(base.CampoNumero, { rotulo: 'Peitoral', unidade: 'mm', dica: 'Linha axilar', tom: 'atencao', value: '8', onChange: noop }));
  assert.doesNotMatch(tags(numero, 'input')[0], /\s(dica|tom)=/, 'CampoNumero não repassa dica nem tom ao <input>');
  assert.match(numero, /aria-label="Mais informações"/, 'rótulo padrão do botão');
});

check('dica aberta: o texto entra no aria-describedby do controle; Esc fecha; Enter e espaço não sobem', () => {
  const html = renderAberta(h(base.Campo, { rotulo: 'Local do edema', ajuda: 'Opcional', dica: ['Registre o local predominante.'] }, h('input', { id: 'clinica-edema' })));
  const [botao] = tags(html, 'button');
  assert.equal(attr(botao, 'aria-expanded'), 'true');
  assert.match(html, /<span class="av-dica__painel" id="clinica-edema-dica">/, 'aberta, sem hidden');
  const descritos = attr(tags(html, 'input')[0], 'aria-describedby').split(' ');
  assert.deepEqual(descritos, ['clinica-edema-ajuda', 'clinica-edema-dica']);
  assert.equal(textoDoId(html, 'clinica-edema-dica'), 'Registre o local predominante.');
  assert.deepEqual(referenciasQuebradas(html), []);
  assert.equal(base.efeitoDaTeclaNaDica('Escape', true), 'fechar');
  assert.equal(base.efeitoDaTeclaNaDica('Escape', false), null, 'fechada, Esc segue para quem estiver em volta');
  assert.equal(base.efeitoDaTeclaNaDica('Enter', false), 'isolar');
  assert.equal(base.efeitoDaTeclaNaDica(' ', true), 'isolar');
  assert.equal(base.efeitoDaTeclaNaDica('Tab', true), null);
  const fonte = ler(`${BASE_REL}/useDica.js`);
  assert.match(fonte, /efeito === 'fechar'[\s\S]*?setAberta\(false\)/, 'Esc no botão fecha');
  assert.match(fonte, /stopPropagation\?\.\(\);\s*setAberta\(\(atual\) => !atual\)/, 'o clique no "?" alterna e não aciona um ancestral');
});

check('dica em ResultadoCalculado, GrupoOpcoes e avulsa; linhas vazias saem', () => {
  const resultado = render(h(base.ResultadoCalculado, { rotulo: 'IMC', valor: '23,4', dica: { texto: ['IMC', 'Formula: peso / altura²'], rotulo: 'Abrir informacao' } }));
  assert.match(resultado, /^<div class="av-resultado av-resultado--neutro"><div class="av-resultado__cabeca"><p class="av-resultado__rotulo">IMC<\/p><button type="button" class="av-dica__botao" aria-label="Abrir informacao" aria-expanded="false" aria-controls="([^"]+)">[\s\S]*?<\/button><span class="av-dica__painel" id="\1" hidden="">/);
  const grupo = render(h(base.GrupoOpcoes, { legenda: 'Sinais e sintomas', dica: { texto: ['Checklist semiológico.'], rotulo: 'Abrir informacao' }, ajuda: 'Marque os presentes' },
    h(base.Opcao, { tipo: 'checkbox', rotulo: 'Palidez', checked: false, onChange: noop })));
  assert.doesNotMatch(grupo, /<legend|<fieldset/, 'o "?" não entra na legend: o grupo vira role="group"');
  assert.match(grupo, /^<div class="av-grupo" role="group" aria-labelledby="([^"]+)" aria-describedby="[^"]+-ajuda"><div class="av-grupo__cabeca"><span class="av-grupo__legenda" id="\1">Sinais e sintomas<\/span><button/);
  assert.deepEqual(interativosNoRotulo(grupo), []);
  assert.deepEqual(referenciasQuebradas(grupo), []);
  assert.deepEqual(controlesQuebrados(grupo), []);
  const avulsa = render(h(base.Dica, { texto: ['Equacao: x', '', null, 'Ano: 1919'], rotulo: 'Abrir informação' }));
  assert.equal(contar(avulsa, /<span class="av-dica__linha">/g), 2, 'linhas vazias saem, como em Dobras');
  assert.equal(render(h(base.Dica, { texto: ['', null] })), '', 'sem texto, sem botão');
});

check('tom em Campo e GrupoOpcoes: classe, ícone escondido no rótulo, sem aria-invalid; sem tom, nada muda', () => {
  const html = render(h(base.Campo, { rotulo: 'Tríceps', unidade: 'mm', ajuda: 'Acima da faixa usual', tom: 'warn', className: 'eval-field' }, h('input', { className: 'eval-input' })));
  assert.match(html, /^<div class="av-campo av-campo--atencao eval-field">/);
  const [, icone] = html.match(/<label[^>]*>(<svg[^>]*>)[\s\S]*?<\/svg>Tríceps<\/label>/) || [];
  assert.ok(icone && /av-tom__icone/.test(icone) && /aria-hidden="true"/.test(icone), 'ícone do tom no rótulo, escondido do leitor de tela');
  assert.equal(attr(tags(html, 'input')[0], 'aria-invalid'), null, 'tom não é erro');
  const perigo = render(h(base.Campo, { rotulo: 'Ideação', tom: 'perigo' }, h('input', {})));
  assert.match(perigo, /^<div class="av-campo av-campo--perigo">/);
  assert.doesNotMatch(render(h(base.Campo, { rotulo: 'Peso', tom: 'positivo' }, h('input', {}))), /av-campo--|av-tom/, 'só atenção e perigo se aplicam a campo');
  const grupo = render(h(base.GrupoOpcoes, { legenda: 'Item 9', tom: 'perigo' }, h(base.Opcao, { rotulo: 'Nunca', name: 'q9', value: '0', checked: false, onChange: noop })));
  const [, iconeGrupo] = grupo.match(/^<fieldset class="av-grupo av-grupo--perigo"[^>]*><legend class="av-grupo__legenda">(<svg[^>]*>)[\s\S]*?<\/svg>Item 9<\/legend>/) || [];
  assert.ok(iconeGrupo && /av-tom__icone/.test(iconeGrupo) && /aria-hidden="true"/.test(iconeGrupo), 'ícone do tom na legend, escondido');
});

check('ResultadoCalculado: rótulo opcional, valor em texto com tom, variação com o sinal escrito', () => {
  const semRotulo = render(h(base.ResultadoCalculado, { valor: '12' }));
  assert.doesNotMatch(semRotulo, /av-resultado__rotulo/, 'sem rótulo, sem <p> vazio');
  const texto = render(h(base.ResultadoCalculado, { rotulo: 'Prioridade', valor: 'Prioridade: Alta', valorEmTexto: true, tom: 'risk' }));
  assert.match(texto, /^<div class="av-resultado av-resultado--perigo av-resultado--texto"><p class="av-resultado__rotulo">Prioridade<\/p><p class="av-resultado__valor"><span class="av-resultado__numero av-resultado__numero--texto">Prioridade: Alta<\/span><\/p><\/div>$/);
  const textoAusente = render(h(base.ResultadoCalculado, { rotulo: 'Prioridade', valor: null, valorEmTexto: true, tom: 'risk' }));
  assert.match(textoAusente, /^<div class="av-resultado av-resultado--neutro">/, 'sem valor, sem tom e sem classe de texto');
  assert.match(textoAusente, /<span aria-hidden="true">—<\/span><span class="av-sr">sem valor<\/span>/);
  const piora = render(h(base.ResultadoCalculado, { rotulo: '% gordura', valor: '22,40', unidade: '%', variacao: '+1,20 %', melhorQuando: 'menor' }));
  assert.match(piora, /<p class="av-resultado__variacao av-resultado__variacao--atencao"><svg[^>]*aria-hidden="true"[\s\S]*?<\/svg><span class="av-sr">Variação em relação à avaliação anterior: <\/span>\+1,20 %<span class="av-sr"> \(atenção: na direção oposta à desejada\)<\/span><\/p>/);
  const melhora = render(h(base.ResultadoCalculado, { rotulo: '% gordura', valor: '21', variacao: '−0,80 %', melhorQuando: 'menor' }));
  assert.match(melhora, /av-resultado__variacao--positivo[\s\S]*?−0,80 %<span class="av-sr"> \(na direção desejada\)<\/span>/);
  const neutra = render(h(base.ResultadoCalculado, { rotulo: 'Peso', valor: '72', variacao: '+1,0 kg' }));
  assert.match(neutra, /<p class="av-resultado__variacao"><span class="av-sr">Variação em relação à avaliação anterior: <\/span>\+1,0 kg<\/p>/, 'sem melhorQuando, sem tom nem ícone');
  assert.equal(base.tomDaVariacao('+0,00 %', 'maior'), 'neutro', 'zero é estável');
  assert.equal(base.tomDaVariacao('-2', 'maior'), 'atencao');
  assert.doesNotMatch(render(h(base.ResultadoCalculado, { rotulo: 'IMC', valor: '23' })), /av-resultado__variacao/);
});

check('GrupoOpcoes rotuladoPor: role="group" com aria-labelledby no título que já existe, sem legend', () => {
  const html = render(h(base.AvaliacaoSecao, { id: 'reds-sinais', titulo: 'Sinais de risco' },
    h(base.GrupoOpcoes, { rotuladoPor: base.idTituloSecao('reds-sinais'), horizontal: true },
      h(base.Opcao, { tipo: 'checkbox', rotulo: 'Amenorreia', checked: true, onChange: noop }))));
  assert.match(html, /<div class="av-grupo av-grupo--horizontal" role="group" aria-labelledby="reds-sinais-titulo"><div class="av-grupo__opcoes">/);
  assert.doesNotMatch(html, /<legend|<fieldset|av-grupo__cabeca/);
  assert.deepEqual(referenciasQuebradas(html), []);
  assert.deepEqual(controlesSemRotulo(html), []);
});

check('rotuloOculto: a linha do rótulo só tem o <label> escondido, e o CSS a tira da caixa (sem vão acima do controle)', () => {
  const html = render(h(base.Campo, { rotulo: 'Tríceps, medida 1', rotuloOculto: true }, h('input', {})));
  assert.match(html, /<div class="av-campo__cabeca"><label class="av-campo__rotulo av-sr"[^>]*>Tríceps, medida 1<\/label><\/div>/);
  assert.ok(temRegra(css, '.av-campo__cabeca:has(> .av-sr:only-child)', 'display', 'contents'), 'display: contents, não none: o label segue nomeando o controle');
  assert.equal(temRegra(css, '.av-campo__cabeca', 'display', 'none'), false);
});

check('o teste detecta o defeito (dica dentro do rótulo, aria-controls quebrado)', () => {
  assert.equal(interativosNoRotulo('<label for="x">Peso<span role="button" tabindex="0" aria-label="Abrir informação">?</span></label>').length, 1);
  assert.equal(interativosNoRotulo('<fieldset><legend>Sinais<button type="button">?</button></legend></fieldset>').length, 1);
  assert.deepEqual(interativosNoRotulo('<label for="x">Peso</label><button type="button">?</button>'), []);
  assert.deepEqual(controlesQuebrados('<button aria-controls="a"></button><span id="b"></span>'), ['a']);
});

/* ── CSS ──────────────────────────────────────────────────────────────── */
check('avaliacao-base.css: o postcss lê o arquivo', () => {
  assert.ok(regrasCss(css).length > 50);
});

check('avaliacao-base.css: só o par Sofia (declarações e @import)', () => {
  assert.deepEqual(problemasDeFonte(css), []);
});

check('avaliacao-base.css: todo seletor começa em .av-modulo', () => {
  assert.deepEqual(seletoresForaDoEscopo(css), []);
});

check('avaliacao-base.css: todo --lt-* existe em landing-tokens.css e todo --av-* é declarado', () => {
  assert.deepEqual(tokensInexistentes(css, tokensLanding), []);
});

check('avaliacao-base.css: cor fixa só em token --av-*; sem !important; sem modo escuro', () => {
  assert.deepEqual(coresFixas(css), []);
  assert.deepEqual(importantes(css), []);
  assert.doesNotMatch(semComentarios(css), /prefers-color-scheme/);
});

check('avaliacao-base.css: sem will-change, sem animação e sem transição de transform', () => {
  assert.deepEqual(problemasDeMovimento(css), []);
});

check('avaliacao-base.css: alvos de 44 px, campos de 48 px e foco com --lt-focus-ring', () => {
  for (const trecho of ['.av-indice__link', '.av-opcao', ':is(.ui-button, .eval-btn)', '.eval-readiness__item']) {
    assert.ok(temRegra(css, trecho, 'min-height', 'var(--lt-target-min)'), `${trecho} sem min-height: var(--lt-target-min)`);
  }
  assert.ok(temRegra(css, '.av-modulo', '--av-controle-altura', '48px'));
  assert.ok(temRegra(css, ':where(.av-controle', 'height', 'var(--av-controle-altura)'));
  for (const trecho of ['.av-indice__link:focus-visible', ':is(.ui-button, .eval-btn):focus-visible', '.av-opcao:focus-within', ':not([type="radio"]):focus']) {
    assert.ok(temRegra(css, trecho, 'box-shadow', 'var(--lt-focus-ring)'), `${trecho} sem --lt-focus-ring`);
  }
});

check('contraste: pares de texto a 4,5:1 e gráficos a 3:1', () => {
  const t = (nome) => token(nome, css, tokensLanding);
  const pares = [
    ['av-atencao-texto', 'lt-color-surface', 4.5],
    ['av-atencao-texto', 'av-atencao-fundo', 4.5],
    ['av-atencao-texto', 'lt-color-surface-field', 4.5],
    ['lt-color-danger-text', 'lt-color-surface', 4.5],
    ['lt-color-danger-text', 'lt-color-danger-bg', 4.5],
    ['lt-color-success-text', 'lt-color-success-bg', 4.5],
    ['lt-color-text-muted', 'lt-color-track-tint', 4.5],
    ['lt-color-text-muted', 'lt-color-surface-field', 4.5],
    ['lt-color-text-subtle', 'lt-color-surface', 4.5],
    ['lt-color-brand-blue', 'lt-color-track-tint', 4.5],
    ['lt-color-brand-green-text', 'lt-color-surface', 4.5],
    ['lt-color-text-inverse', 'lt-color-start-top', 4.5],
    ['lt-color-text-inverse', 'lt-color-start-bottom', 4.5],
    ['av-atencao-traco', 'lt-color-surface', 3],
    ['lt-color-border-field', 'lt-color-surface', 3]
  ];
  for (const [frente, fundo, piso] of pares) {
    const razao = contraste(t(frente), t(fundo));
    console.log(`     --${frente} ${t(frente)} sobre --${fundo} ${t(fundo)} → ${razao.toFixed(2)}:1 (piso ${piso}:1)`);
    assert.ok(razao >= piso, `--${frente} sobre --${fundo}: ${razao.toFixed(2)}:1`);
  }
});

check('avaliacao-base.css: dica com alvo de 44 px, painel [hidden] escondido, anel na marca; tom e valor em texto nos pares da base', () => {
  for (const prop of ['width', 'min-width', 'height', 'min-height']) {
    assert.ok(temRegra(css, '.av-dica__botao', prop, 'var(--lt-target-min)'), `.av-dica__botao sem ${prop}: var(--lt-target-min)`);
  }
  assert.ok(temRegra(css, '.av-dica__painel[hidden]', 'display', 'none'), 'display do painel venceria o [hidden] do navegador');
  assert.ok(temRegra(css, '.av-dica__botao:focus-visible .av-dica__marca', 'box-shadow', 'var(--lt-focus-ring)'));
  assert.ok(temRegra(css, '.av-dica__botao[aria-expanded="true"] .av-dica__marca', 'background', 'var(--lt-color-brand-blue)'), 'aberta: a marca muda de forma (cheia)');
  assert.ok(temRegra(css, '.av-campo--atencao > .av-campo__controle', 'border-color', 'var(--av-atencao-traco)'));
  assert.ok(temRegra(css, '.av-campo--perigo > .av-campo__controle', 'border-color', 'var(--lt-color-danger-text)'));
  assert.ok(temRegra(css, '.av-resultado--texto.av-resultado--perigo .av-resultado__numero', 'color', 'var(--lt-color-danger-text)'));
  // O tom do controle não passa de (0,3,0): foco, só leitura e erro (0,4,0) vencem.
  const regraTom = regrasCss(css).find((r) => r.seletores.some((s) => s.includes('.av-campo--atencao > .av-campo__controle')));
  assert.ok(regraTom.seletores.every((s) => s.startsWith('.av-modulo :where(')), 'o tom do controle fica dentro de :where()');
});

check('contraste dos pares novos: marca aberta, painel da dica, valor em texto, variação e faixa do grupo', () => {
  const t = (nome) => token(nome, css, tokensLanding);
  const pares = [
    ['lt-color-text-inverse', 'lt-color-brand-blue', 4.5],
    ['lt-color-text', 'lt-color-track-tint', 4.5],
    ['lt-color-success-text', 'lt-color-surface-field', 4.5],
    ['lt-color-danger-text', 'lt-color-surface-field', 4.5],
    ['lt-color-text', 'av-atencao-fundo', 4.5],
    ['lt-color-text', 'lt-color-danger-bg', 4.5],
    ['lt-color-brand-blue', 'lt-color-surface', 3]
  ];
  for (const [frente, fundo, piso] of pares) {
    const razao = contraste(t(frente), t(fundo));
    console.log(`     --${frente} ${t(frente)} sobre --${fundo} ${t(fundo)} → ${razao.toFixed(2)}:1 (piso ${piso}:1)`);
    assert.ok(razao >= piso, `--${frente} sobre --${fundo}: ${razao.toFixed(2)}:1`);
  }
});

/* ── Reproduções sintéticas: cada verificação acusa o defeito ─────────── */
check('o teste detecta o defeito (rótulo, referência, zero, título, fonte, escopo, token, cor e movimento)', () => {
  // Marcação.
  assert.equal(controlesSemRotulo('<label>Peso</label><input id="p"/>').length, 1, 'rótulo solto, sem for');
  assert.equal(controlesSemRotulo('<label for="x">Peso</label><input id="p"/>').length, 2, 'for errado');
  assert.deepEqual(controlesSemRotulo('<label><input type="radio"/> Sim</label>'), [], 'opção dentro do label é ligada');
  assert.deepEqual(referenciasQuebradas('<input aria-describedby="a b"/><p id="a">x</p>'), ['b']);
  assert.equal(mostraZero('<span class="av-resultado__numero">0</span>'), true);
  assert.notDeepEqual(titulos('<h3>M</h3><h3>Seção</h3>'), [[3, 'M'], [4, 'Seção']]);
  // CSS.
  assert.deepEqual(problemasDeFonte('.av-modulo .x { font-family: Poppins, sans-serif; }').length, 2);
  assert.deepEqual(problemasDeFonte('/* sem Inter */ .av-modulo .x { font-family: var(--lt-font-family); }'), []);
  assert.equal(problemasDeFonte("@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400&display=swap');").length, 1);
  assert.deepEqual(seletoresForaDoEscopo('.av-modulo .ok { color: var(--lt-color-text); } .eval-card { border: 0; } .av-moduloX .y { top: 0; }'), ['.eval-card', '.av-moduloX .y']);
  assert.deepEqual(tokensInexistentes('.av-modulo .x { color: var(--lt-color-nao-existe); top: var(--av-nao-declarado); }', tokensLanding), ['--lt-color-nao-existe', '--av-nao-declarado']);
  assert.equal(coresFixas('.av-modulo { --av-ok: #fff; } .av-modulo .x { color: #9a3412; background: rgba(0, 0, 0, 0.1); border-color: red; }').length, 3);
  assert.deepEqual(coresFixas('.av-modulo .x { background-image: url("data:image/svg+xml,%232560a8"); color: var(--lt-color-brand-blue); }'), []);
  assert.equal(coresFixas('.av-modulo .x { background: linear-gradient(var(--lt-color-brand-blue), white); }').length, 1);
  assert.equal(problemasDeMovimento('.av-modulo .a { will-change: transform; transition: transform 200ms; animation: x 1s; }').length, 3);
  assert.equal(importantes('.av-modulo .a { color: var(--lt-color-text) !important; }').length, 1);
  assert.equal(temRegra('.av-modulo .av-opcao { min-height: 40px; }', '.av-opcao', 'min-height', 'var(--lt-target-min)'), false);
});

console.log(`\n${passed} verificações da base das avaliações passaram.`);
