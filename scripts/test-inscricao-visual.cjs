/* Formulario publico de inscricao/triagem (direcao "Energia e velocidade").
 *
 * Prova, sem navegador, tres coisas exigidas pelo change-intent
 * (docs/implementacao/inscricao-v2/change-intent.md):
 *
 *   1. Os dois termos de consentimento (texto legal) nao mudaram — hash
 *      SHA-256 do conteudo, nao comparacao de string longa no proprio teste.
 *   2. Nenhuma folha do formulario ainda importa/cita as fontes antigas
 *      (Outfit, Space Grotesk, Poppins) — so Sofia Sans / Sofia Sans Extra
 *      Condensed, dos tokens da landing.
 *   3. Toda classe `ip-*` usada nos JSX do formulario esta definida em
 *      alguma folha do formulario (nenhuma classe fantasma).
 *
 * Node puro, sem navegador, no estilo de scripts/test-landing-cascata.cjs. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`PASS ${name}`); };

const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const FORM_CSS_FILES = [
  'src/views/public/inscricao-base.css',
  'src/views/public/inscricao-campos.css',
  'src/components/Triagem/EscalasVisuais.css'
];

// "inscricao/*.jsx" (glob real, nao lista fixa): pega qualquer etapa nova
// que A/B acrescentem sem precisar editar este teste.
function jsxDoFormulario() {
  const etapaDir = path.join(root, 'src/views/public/inscricao');
  const etapas = fs.readdirSync(etapaDir)
    .filter((f) => f.endsWith('.jsx'))
    .map((f) => path.posix.join('src/views/public/inscricao', f));
  return [
    'src/views/public/InscricaoPublica.jsx',
    ...etapas,
    'src/components/Triagem/EscalasVisuais.jsx'
  ];
}

/* ── 1. Os termos de consentimento nao mudaram (texto legal) ───────────── */

// Nao comparamos a string inteira aqui — o hash e a prova, e a mensagem de
// falha abaixo diz por que isso e proposital.
const TERMOS_ESPERADOS = {
  TERMO_ADULTO: { sha256: '56386ba25843c77ffe05f42f00ae1c77be7a89c2aed1c2dfc6bc1a0fe5db794c', tamanho: 1157 },
  TERMO_MENOR: { sha256: '0a49642481e2a80f515560589707893f2bb3c7b90deb7be191ca34a950b30cda', tamanho: 906 }
};

// Extracao por indexOf (nao regex): os termos tem aspas simples e outras
// pontuacoes dentro do texto, e um template literal pode conter caracteres
// que confundem uma regex gulosa. Pega o conteudo entre o primeiro `
// depois de "export const NOME = " e o proximo `; — igual à declaracao real.
function extrairTemplateLiteral(src, nomeConst) {
  const marcador = `export const ${nomeConst} = `;
  const inicioDecl = src.indexOf(marcador);
  assert.ok(inicioDecl !== -1, `${nomeConst} não encontrado em constantes.js — texto legal parece ter sido removido`);
  const abreCrase = src.indexOf('`', inicioDecl);
  const fechaCrase = src.indexOf('`;', abreCrase + 1);
  assert.ok(abreCrase !== -1 && fechaCrase !== -1, `${nomeConst} não é mais um template literal simples em constantes.js`);
  return src.slice(abreCrase + 1, fechaCrase).replace(/\r\n/g, '\n');
}

function hashDosTermos(src) {
  const saida = {};
  for (const nome of Object.keys(TERMOS_ESPERADOS)) {
    const texto = extrairTemplateLiteral(src, nome);
    saida[nome] = { sha256: crypto.createHash('sha256').update(texto, 'utf8').digest('hex'), tamanho: texto.length };
  }
  return saida;
}

check('TERMO_ADULTO e TERMO_MENOR (texto legal de consentimento) não mudaram — hash SHA-256 idêntico ao registrado', () => {
  const src = read('src/views/public/inscricao/constantes.js');
  const atual = hashDosTermos(src);
  for (const [nome, esperado] of Object.entries(TERMOS_ESPERADOS)) {
    assert.equal(
      atual[nome].sha256,
      esperado.sha256,
      `${nome} mudou (hash ${atual[nome].sha256}, esperado ${esperado.sha256}, ${atual[nome].tamanho} caracteres). `
      + 'Isto é texto legal de consentimento: mudar exige decisão explícita da coordenação, não uma correção de '
      + 'estilo — se a mudança foi intencional, atualize TERMOS_ESPERADOS neste teste registrando por quê.'
    );
    assert.equal(atual[nome].tamanho, esperado.tamanho, `${nome}: tamanho mudou (${atual[nome].tamanho}, esperado ${esperado.tamanho})`);
  }
});

/* ── 2. Nenhuma folha do formulário cita as fontes antigas ──────────────── */

const FONTES_ANTIGAS = ['Outfit', 'Space Grotesk', 'Poppins'];

function fontesAntigasEm(arquivos) {
  const achados = [];
  for (const { rel, conteudo } of arquivos) {
    // Comentários explicando um reset (ex.: "Reset do h1 global... Poppins
    // e background-clip:text...") citam o nome antigo de propósito; só a
    // regra de verdade importa. Mesmo tratamento de test-landing-cascata.cjs
    // e test-landing-isolamento.cjs para CSS.
    const semComentarios = conteudo.replace(/\/\*[\s\S]*?\*\//g, '');
    for (const fonte of FONTES_ANTIGAS) {
      if (semComentarios.includes(fonte)) achados.push(`${rel} cita "${fonte}" fora de comentário`);
    }
  }
  return achados;
}

function follhasCssDoFormularioReais() {
  return FORM_CSS_FILES.map((rel) => ({ rel, conteudo: read(rel) }));
}

check('nenhuma folha CSS do formulário importa ou cita Outfit, Space Grotesk ou Poppins', () => {
  const achados = fontesAntigasEm(follhasCssDoFormularioReais());
  assert.deepEqual(achados, [], `fonte antiga ainda presente:\n  ${achados.join('\n  ')}`);
});

/* ── 3. Toda classe ip-* usada no JSX do formulário está definida ───────── */

// Varredura textual (sem CSSOM), no espírito de test-landing-isolamento.cjs:
// classes definidas = `.ip-algo` em alguma folha CSS do formulário;
// classes usadas = qualquer token "ip-algo" no texto dos JSX do formulário
// (cobre className literal, template literal com sufixo dinâmico como
// `ip-chip${extraClass}`, e strings passadas como argumento).
function classesDefinidas(arquivosCss) {
  const definidas = new Set();
  for (const { conteudo } of arquivosCss) {
    const semComentarios = conteudo.replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of semComentarios.matchAll(/\.(ip-[\w-]+)/g)) definidas.add(m[1]);
  }
  return definidas;
}

function classesUsadas(arquivosJsx) {
  const usadas = new Map(); // classe -> primeiro arquivo onde apareceu
  for (const { rel, conteudo } of arquivosJsx) {
    for (const m of conteudo.matchAll(/\bip-[a-zA-Z0-9-]+/g)) {
      if (!usadas.has(m[0])) usadas.set(m[0], rel);
    }
  }
  return usadas;
}

function classesFantasmas(arquivosCss, arquivosJsx) {
  const definidas = classesDefinidas(arquivosCss);
  const usadas = classesUsadas(arquivosJsx);
  const faltando = [];
  for (const [classe, rel] of usadas) {
    if (!definidas.has(classe)) faltando.push(`${classe} (usada em ${rel}, não definida em nenhuma folha do formulário)`);
  }
  return faltando;
}

check('toda classe ip-* usada nos JSX do formulário está definida em alguma folha CSS do formulário', () => {
  const arquivosJsx = jsxDoFormulario().map((rel) => ({ rel, conteudo: read(rel) }));
  const faltando = classesFantasmas(follhasCssDoFormularioReais(), arquivosJsx);
  assert.deepEqual(faltando, [], `classe(s) ip-* sem definição:\n  ${faltando.join('\n  ')}`);
});

/* ── 4. O teste detecta o defeito (reproduções sintéticas) ──────────────── */

check('o teste detecta o defeito (reprodução sintética: termo alterado por 1 caractere)', () => {
  const srcOriginal = read('src/views/public/inscricao/constantes.js');
  // Muda só um caractere do meio do TERMO_ADULTO ("18 anos" -> "17 anos"),
  // do jeito que um erro de digitação ou uma "melhoria de texto" faria.
  const srcMutado = srcOriginal.replace('Tenho 18 anos de idade', 'Tenho 17 anos de idade');
  assert.notEqual(srcMutado, srcOriginal, 'a mutação de teste não encontrou o trecho esperado em TERMO_ADULTO — ajuste o teste');

  const hashOriginal = hashDosTermos(srcOriginal).TERMO_ADULTO.sha256;
  const hashMutado = hashDosTermos(srcMutado).TERMO_ADULTO.sha256;
  assert.notEqual(hashMutado, hashOriginal, 'o hash não mudou com o texto mutado — a extração não está lendo o conteúdo real');
  assert.notEqual(hashMutado, TERMOS_ESPERADOS.TERMO_ADULTO.sha256, 'o hash mutado bateu por acidente com o hash esperado');
});

check('o teste detecta o defeito (reprodução sintética: classe ip-* usada sem definição)', () => {
  const cssLimpo = [{ rel: 'sintético.css', conteudo: '.ip-chip { color: red; } .ip-qbtn { color: blue; }' }];
  const jsxComDefeito = [{ rel: 'sintético.jsx', conteudo: '<button className="ip-chip ip-chip--fantasma">Opção</button>' }];
  const achados = classesFantasmas(cssLimpo, jsxComDefeito);
  assert.deepEqual(achados, ['ip-chip--fantasma (usada em sintético.jsx, não definida em nenhuma folha do formulário)']);

  // E o caso limpo real (o do repositório, hoje) não deve acusar nada —
  // confirma que a varredura não é positiva por acidente.
  const arquivosJsxReais = jsxDoFormulario().map((rel) => ({ rel, conteudo: read(rel) }));
  assert.deepEqual(classesFantasmas(follhasCssDoFormularioReais(), arquivosJsxReais), []);
});

console.log(`\n${passed} verificações visuais do formulário de inscrição passaram.`);
