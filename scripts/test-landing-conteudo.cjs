/* Conteudo da landing (direcao "Energia e velocidade").
 *
 * Prova tres coisas exigidas pelo change-intent
 * (docs/implementacao/landing-v2/change-intent.md) para a pagina publica:
 *
 *   1. O texto das quatro areas em AreasLiga.jsx e literal das telas do
 *      sistema, nao copy nova (plano.md, secao 1). O teste extrai o texto
 *      de dentro do proprio AreasLiga.jsx (nao duplica os valores) e
 *      confere contra o arquivo-fonte citado.
 *   2. Nenhuma tela publica chama /public/stats nem importa capturas de
 *      public/screenshots.
 *   3. Nenhuma tela publica traz termo clinico usado como numero ou
 *      chamariz.
 *
 * "Tela publica" = todo *.jsx em src/views/landing/ (inclusive os modais:
 * eles herdam fonte/cor da landing, mesmo fora da fronteira deste agente)
 * mais src/views/LoginPage.jsx.
 *
 * Mais uma verificacao (nao pedida pelo change-intent, achada na verificacao
 * visual em navegador de 2026-09-25): src/index.css declara `h2 { color:
 * ... }` e `h3 { color: ... }` GLOBAIS (para telas internas). Heranca de cor
 * perde para qualquer regra que declare a propriedade no proprio elemento,
 * mesmo com especificidade menor — um h2/h3 dentro de .lp-areas que so
 * herde `color` do container fica com o azul-escuro global (~1,1:1 sobre o
 * fundo escuro da cena) em vez do branco pretendido. Foi exatamente o que
 * aconteceu aqui: medido no pixel do screenshot, #1D3350 sobre #0B2A5E.
 * Corrigido com `color` explicito em .lp-areas h2 e .lp-raia h3. Este teste
 * prova estaticamente que a correcao nao regride.
 *
 * Node puro, sem navegador. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`PASS ${name}`); };

const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

/* ── 1. Texto das areas e literal da fonte citada ──────────────────────── */

const FONTE_POR_AREA = {
  Ensino: 'src/views/admin/Areas/Ensino.jsx',
  Pesquisa: 'src/views/admin/Research/ResearchProjects.jsx',
  Extensão: 'src/views/admin/Areas/Extensao.jsx',
  Comunicação: 'src/views/admin/Areas/Comunicacao.jsx'
};

// Quando a sintese do plano corta o final de uma frase do sistema, o teste
// aceita o prefixo verificavel ate ali (a landing fecha a frase com ponto
// proprio). Cada recorte aceito tem que estar documentado aqui, por area.
const RECORTES_DOCUMENTADOS = {
  Pesquisa: 'a fonte termina em "...da liga em um só lugar."; a landing corta '
    + '"em um só lugar" (plano.md, seção 1) e fecha a frase com ponto próprio'
};

function areasDaLanding() {
  const src = read('src/views/landing/AreasLiga.jsx');
  const bloco = src.match(/const AREAS = \[([\s\S]*?)\n\];/);
  assert.ok(bloco, 'AreasLiga.jsx precisa declarar a constante AREAS');
  const itens = [...bloco[1].matchAll(/nome:\s*'([^']+)'[\s\S]*?descricao:\s*'([^']+)'/g)]
    .map(([, nome, descricao]) => ({ nome, descricao }));
  assert.equal(itens.length, 4, 'AreasLiga.jsx precisa declarar as quatro áreas da liga');
  return itens;
}

check('o texto das quatro áreas em AreasLiga.jsx é literal (ou prefixo documentado) do arquivo-fonte citado', () => {
  for (const { nome, descricao } of areasDaLanding()) {
    const arquivo = FONTE_POR_AREA[nome];
    assert.ok(arquivo, `área "${nome}" não tem arquivo-fonte mapeado no teste`);
    const fonte = read(arquivo);
    const semPontoFinal = descricao.replace(/\.$/, '');
    const literal = fonte.includes(descricao);
    const prefixo = fonte.includes(semPontoFinal);
    assert.ok(
      literal || prefixo,
      `"${descricao}" (área ${nome}) não aparece em ${arquivo}`
      + (RECORTES_DOCUMENTADOS[nome] ? ` — recorte esperado: ${RECORTES_DOCUMENTADOS[nome]}` : '')
    );
    if (!literal) {
      assert.ok(
        RECORTES_DOCUMENTADOS[nome],
        `"${descricao}" (área ${nome}) só bate como prefixo em ${arquivo}, mas esse recorte não está `
        + 'documentado em RECORTES_DOCUMENTADOS — todo corte precisa de justificativa registrada'
      );
    }
  }
});

/* ── 2 e 3. Nada de numero publico, captura interna ou termo clinico ────── */

// "atletas ativos" e "avaliações clínicas" eram numero/chamariz clinico na
// landing anterior (hero-stat e hero-pill de HeroCopy.jsx). "paciente" e
// "prontuário" sao vocabulario de atendimento que nao pertence a pagina
// publica. "atleta" sozinho fica FORA da lista: os modais falam
// legitimamente de atleta (ex.: "É atleta e quer ser atendido pela liga?").
const TERMOS_CLINICOS = ['atletas ativos', 'avaliações clínicas', 'paciente', 'prontuário'];

function acharReferenciasPublicas(arquivos) {
  const achados = [];
  for (const { rel, conteudo } of arquivos) {
    if (/\/public\/stats/i.test(conteudo)) achados.push(`${rel} referencia /public/stats`);
    if (/screenshots/i.test(conteudo)) achados.push(`${rel} referencia public/screenshots`);
  }
  return achados;
}

function acharTermosClinicos(arquivos) {
  const achados = [];
  for (const { rel, conteudo } of arquivos) {
    const baixo = conteudo.toLowerCase();
    for (const termo of TERMOS_CLINICOS) {
      if (baixo.includes(termo.toLowerCase())) achados.push(`${rel} contém "${termo}"`);
    }
  }
  return achados;
}

function telasPublicasReais() {
  const landingDir = path.join(root, 'src/views/landing');
  const relLanding = fs.readdirSync(landingDir)
    .filter((f) => f.endsWith('.jsx'))
    .map((f) => path.posix.join('src/views/landing', f));
  const rels = [...relLanding, 'src/views/LoginPage.jsx'];
  return rels.map((rel) => ({ rel, conteudo: read(rel) }));
}

check('nenhuma tela pública (landing/*.jsx, LoginPage.jsx) chama /public/stats nem importa capturas de public/screenshots', () => {
  const achados = acharReferenciasPublicas(telasPublicasReais());
  assert.deepEqual(achados, [], `dado numérico/captura interna vazando na página pública:\n  ${achados.join('\n  ')}`);
});

check('nenhuma tela pública traz termo clínico usado como número ou chamariz', () => {
  const achados = acharTermosClinicos(telasPublicasReais());
  assert.deepEqual(achados, [], `termo clínico na página pública:\n  ${achados.join('\n  ')}`);
});

/* ── 4. O teste detecta o defeito (reprodução sintética) ───────────────── */

check('o teste detecta o defeito (reprodução sintética de número público, captura interna e termo clínico)', () => {
  const arquivosComDefeito = [
    {
      rel: 'src/views/landing/HeroCopy.jsx (sintético)',
      conteudo: "const { data } = await api.get('/public/stats');\n"
        + 'return <span>{data.atletasAtivos} atletas ativos</span>;'
    },
    {
      rel: 'src/views/landing/AccessRequestModal.jsx (sintético)',
      conteudo: 'import capa from "../../../public/screenshots/prontuario.png";'
    },
    {
      rel: 'src/views/landing/HeroCopy.jsx (sintético, 2)',
      conteudo: '<p>Acompanhe avaliações clínicas do paciente em tempo real.</p>'
    }
  ];

  const referencias = acharReferenciasPublicas(arquivosComDefeito);
  assert.equal(referencias.length, 2, 'a varredura precisa flagrar /public/stats e a captura de screenshots separadamente');
  assert.ok(referencias.some((a) => a.includes('/public/stats')), 'não flagrou /public/stats');
  assert.ok(referencias.some((a) => a.includes('public/screenshots')), 'não flagrou public/screenshots');

  const termos = acharTermosClinicos(arquivosComDefeito);
  assert.ok(termos.some((a) => a.includes('atletas ativos')), 'não flagrou "atletas ativos"');
  assert.ok(termos.some((a) => a.includes('avaliações clínicas')), 'não flagrou "avaliações clínicas"');
  assert.ok(termos.some((a) => a.includes('paciente')), 'não flagrou "paciente"');

  // E um arquivo limpo, sem nenhum dos termos, não deve disparar nada —
  // confirma que a varredura não acusa por acidente (falso positivo).
  const arquivoLimpo = [{ rel: 'sintético-limpo.jsx', conteudo: '<h2>As quatro áreas da liga</h2><p>Projetos, ideias e produções científicas da liga.</p>' }];
  assert.deepEqual(acharReferenciasPublicas(arquivoLimpo), []);
  assert.deepEqual(acharTermosClinicos(arquivoLimpo), []);
});

/* ── 5. h2/h3 de landing-areas.css não dependem de herança de cor ──────── */

// src/index.css declara `h2 { color: var(--color-dark-blue) }` e
// `h3 { color: var(--color-dark-blue) }` fora da landing. Qualquer regra
// aqui que estilize um h2/h3 sem declarar `color` no PRÓPRIO bloco herdaria
// a cor do container — e herança perde para essas regras globais, mesmo
// elas tendo especificidade menor (herança não entra na disputa de
// especificidade: só concorre com declarações que miram o próprio
// elemento). Este parser é textual (sem CSSOM): acha o bloco de cada
// seletor terminado em " h2" ou " h3" e confere se ele mesmo declara
// `color`.
function blocosDeSeletor(css, sufixoSeletor) {
  const semComentarios = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const blocos = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(semComentarios)) !== null) {
    const seletores = m[1].split(',').map((s) => s.trim());
    if (seletores.some((s) => s.endsWith(sufixoSeletor))) {
      blocos.push({ seletores, corpo: m[2] });
    }
  }
  return blocos;
}

function seletoresSemCorPropria(css) {
  const alvos = [...blocosDeSeletor(css, ' h2'), ...blocosDeSeletor(css, ' h3')];
  // Agrupado por seletor: um bloco de media query que só ajusta font-size
  // não precisa redeclarar `color` se a regra base (mesmo seletor, fora da
  // media) já declara — só falta cor se NENHUM bloco daquele seletor a tem.
  const temCorPorSeletor = new Map();
  for (const { seletores, corpo } of alvos) {
    const chave = seletores.join(', ');
    const temCor = /(?<![\w-])color\s*:/.test(corpo);
    temCorPorSeletor.set(chave, (temCorPorSeletor.get(chave) || false) || temCor);
  }
  return [...temCorPorSeletor.entries()].filter(([, temCor]) => !temCor).map(([chave]) => chave);
}

check('h2/h3 dentro de .lp-areas declaram color próprio (não dependem de herança, que perderia para o h2/h3 global de src/index.css)', () => {
  const css = read('src/views/landing/landing-areas.css');
  const semCor = seletoresSemCorPropria(css);
  assert.deepEqual(semCor, [], `seletor(es) sem "color" próprio, vão herdar do container e perder para o h2/h3 global:\n  ${semCor.join('\n  ')}`);
});

check('o teste detecta o defeito (reprodução sintética do h2 sem color próprio, o bug medido em 2026-09-25)', () => {
  const cssComDefeito = '.lp-areas { color: white; } .lp-areas h2 { font-size: 1.25rem; }';
  const achadosComDefeito = seletoresSemCorPropria(cssComDefeito);
  assert.deepEqual(achadosComDefeito, ['.lp-areas h2'], 'a varredura precisa flagrar o h2 que só tem font-size, sem color próprio');

  const cssCorrigido = '.lp-areas { color: white; } .lp-areas h2 { color: var(--lt-color-text-inverse); font-size: 1.25rem; }';
  assert.deepEqual(seletoresSemCorPropria(cssCorrigido), [], 'com "color" no próprio bloco do h2, a varredura não deve mais acusar');
});

console.log(`\n${passed} verificações de conteúdo da landing passaram.`);
