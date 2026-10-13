// UPD-15 — Gráficos e tabelas: contrato de visualização de dados.
// Dados 100% sintéticos, sem rede nem banco.
//
// Este script carrega as funções puras de src/components/Prontuario/
// EvolucaoAnalytics.jsx (escala temporal, extração de valor, cobertura)
// via esbuild + um `require` com stubs para 'react'/'recharts'/'lucide-react'
// e para os imports relativos do componente — não reimplementa a lógica à
// parte. Se alguém reverter o eixo para índice ou fizer um valor ausente
// virar zero, é a função REAL do componente que falha aqui, não uma cópia.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('module');
const esbuild = require(path.join(__dirname, '..', 'node_modules', 'esbuild'));

const root = path.resolve(__dirname, '..');
const componentPath = path.join(root, 'src/components/Prontuario/EvolucaoAnalytics.jsx');
const componentSource = fs.readFileSync(componentPath, 'utf8');

function carregarComponente() {
  const { code } = esbuild.transformSync(componentSource, {
    loader: 'jsx',
    format: 'cjs',
    target: 'node18',
    sourcefile: componentPath
  });

  // O componente React (JSX/recharts) nunca é executado por este script —
  // só as const/function do topo do arquivo. Os stubs abaixo existem
  // somente para o `require(...)` dessas dependências não quebrar ao
  // avaliar o módulo; nenhum deles precisa fazer nada de verdade.
  const stubs = {
    react: { createElement: () => null, Fragment: Symbol('Fragment') },
    recharts: new Proxy({}, { get: () => () => null }),
    'lucide-react': new Proxy({}, { get: () => () => null }),
    '../../constants/evaluationRegistry': {
      getEvaluationRegistryItem: () => ({ supportsLongitudinalComparison: true }),
      getEvaluationTypeLabelFromRegistry: (tipo) => tipo
    },
    '../ui': { FeedbackState: () => null },
    './EvolucaoAnalytics.css': {}
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

const {
  buildGroupAnalytics,
  coerceNumber,
  extractMetricValue
} = carregarComponente();

let passed = 0;
function check(name, fn) {
  fn();
  passed++;
  console.log(`PASS ${name}`);
}

// ── Fixture: intervalos irregulares (1 dia, depois ~6 meses) ──────────────
// 'perimetros' alimenta peso/imc/circunferência do grupo "composicao".
const avaliacoesIntervalosIrregulares = [
  { id: 'ev1', tipo: 'perimetros', data: '2026-01-01', dados: { peso: 70 } },
  { id: 'ev2', tipo: 'perimetros', data: '2026-01-02', dados: { peso: 70.5 } },
  { id: 'ev3', tipo: 'perimetros', data: '2026-07-02', dados: { peso: 68 } }
];

// ── Fixture: zero conhecido vs ausência ────────────────────────────────────
// 'evolucao_retorno' alimenta o score de adesão do grupo "adesao". Um score
// 0 é um dado real (adesão nula relatada); a sessão sem o campo é diferente:
// ninguém mediu, não é "zero".
const avaliacoesAdesao = [
  { id: 'adA', tipo: 'evolucao_retorno', data: '2026-02-01', dados: { scoreAdesaoGeral: 0 } },
  { id: 'adB', tipo: 'evolucao_retorno', data: '2026-03-01', dados: {} },
  { id: 'adC', tipo: 'evolucao_retorno', data: '2026-04-01', dados: { scoreAdesaoGeral: 7 } }
];

check('escala temporal: posição no eixo segue a data real, não o índice', () => {
  const grupos = buildGroupAnalytics(avaliacoesIntervalosIrregulares);
  const composicao = grupos.find((g) => g.id === 'composicao');
  assert.equal(composicao.chartData.length, 3, 'as 3 sessões devem virar 3 pontos');

  const [p1, p2, p3] = composicao.chartData;
  assert.equal(p1.timestamp, new Date('2026-01-01').getTime());
  assert.equal(p2.timestamp, new Date('2026-01-02').getTime());
  assert.equal(p3.timestamp, new Date('2026-07-02').getTime());

  const gapCurto = p2.timestamp - p1.timestamp; // 1 dia
  const gapLongo = p3.timestamp - p2.timestamp; // ~6 meses
  assert.ok(gapCurto > 0 && gapLongo > 0, 'os intervalos precisam ser positivos');
  // Por índice, os dois intervalos teriam a MESMA largura (1 posição cada).
  // Pela data real, ~6 meses precisam pesar muito mais que 1 dia no eixo.
  assert.ok(
    gapLongo > gapCurto * 50,
    `intervalo de 6 meses (${gapLongo}ms) deveria ser muito maior que o de 1 dia (${gapCurto}ms) — ` +
      'se isto falhar, o eixo voltou a espaçar por índice.'
  );
});

check('JSX do eixo X usa escala numérica pela data real, não categoria por índice', () => {
  const blocoXAxis = componentSource.match(/<XAxis\b[\s\S]*?\/>/);
  assert.ok(blocoXAxis, 'não encontrei o elemento <XAxis /> no componente');
  const bloco = blocoXAxis[0];
  assert.match(bloco, /dataKey="timestamp"/, 'XAxis precisa usar o timestamp real como dataKey');
  assert.match(bloco, /type="number"/, 'XAxis precisa ser numérico (escala real), não categórico');
  assert.doesNotMatch(
    bloco,
    /dataKey="dateLabel"/,
    'XAxis voltou a usar o rótulo textual como categoria — isso espaça por índice, não por tempo'
  );
});

check('coerceNumber distingue zero, ausência e string vazia', () => {
  assert.equal(coerceNumber(0), 0);
  assert.equal(coerceNumber('0'), 0);
  assert.equal(coerceNumber(null), null);
  assert.equal(coerceNumber(undefined), null);
  assert.equal(coerceNumber(''), null);
  assert.notEqual(coerceNumber(0), null, 'zero não pode virar nulo');
  assert.notEqual(coerceNumber(null), 0, 'nulo não pode virar zero');
});

check('extractMetricValue: campo ausente não vira zero', () => {
  const metric = { aliases: ['scoreAdesaoGeral'] };
  const comValor = { dados: { scoreAdesaoGeral: 0 } };
  const semCampo = { dados: {} };
  assert.equal(extractMetricValue(comValor, metric), 0);
  assert.equal(extractMetricValue(semCampo, metric), null);
});

check('ponto ausente some do gráfico: não vira zero, não vira queda, não entra na média', () => {
  const grupos = buildGroupAnalytics(avaliacoesAdesao);
  const adesao = grupos.find((g) => g.id === 'adesao');

  // A sessão sem o campo (adB) não gera linha nenhuma no grupo — não vira
  // um ponto zero plotado no meio da série.
  assert.equal(adesao.chartData.length, 2, 'só as 2 sessões com valor viram ponto');
  const semAusente = adesao.chartData.find((row) => row.timestamp === new Date('2026-03-01').getTime());
  assert.equal(semAusente, undefined, 'a sessão sem registro não pode aparecer como ponto (nem como zero)');

  const zeroConhecido = adesao.chartData.find((row) => row.timestamp === new Date('2026-02-01').getTime());
  assert.equal(zeroConhecido.scoreAdesaoGeral, 0);
  assert.equal(typeof zeroConhecido.scoreAdesaoGeral, 'number', 'zero conhecido continua sendo o número 0');

  assert.equal(adesao.pointCounts.scoreAdesaoGeral, 2, 'a contagem de pontos ignora a sessão ausente');

  // "Não entra na média": a média sobre os pontos existentes é (0+7)/2, não
  // (0+0+7)/3 — se a ausência tivesse virado zero, a média cairia para 2,33.
  const soma = adesao.chartData.reduce((acc, row) => acc + row.scoreAdesaoGeral, 0);
  const media = soma / adesao.chartData.length;
  assert.equal(media, 3.5);
  assert.notEqual(media, (0 + 0 + 7) / 3, 'ausência não pode entrar na média como zero');
});

check('cobertura parcial é reportada quando falta dado em sessão elegível', () => {
  const grupos = buildGroupAnalytics(avaliacoesAdesao);
  const adesao = grupos.find((g) => g.id === 'adesao');
  const cobertura = adesao.coverageByMetric.scoreAdesaoGeral;

  assert.equal(cobertura.total, 3, 'as 3 sessões de evolucao_retorno são elegíveis para o score');
  assert.equal(cobertura.found, 2, 'só 2 delas têm o valor');
  assert.equal(cobertura.ratio, 2 / 3);
  assert.equal(cobertura.parcial, true, 'cobertura abaixo de 100% precisa ser sinalizada como parcial');
});

check('cobertura completa não é marcada como parcial', () => {
  const grupos = buildGroupAnalytics(avaliacoesIntervalosIrregulares);
  const composicao = grupos.find((g) => g.id === 'composicao');
  const cobertura = composicao.coverageByMetric.peso;

  assert.equal(cobertura.total, 3);
  assert.equal(cobertura.found, 3);
  assert.equal(cobertura.ratio, 1);
  assert.equal(cobertura.parcial, false, 'com 100% das sessões elegíveis preenchidas não há cobertura parcial');
});

check('denominador da cobertura conta só as sessões elegíveis para a métrica', () => {
  // Discriminação do denominador. Dentro do MESMO grupo "composicao",
  // 'perimetros' alimenta peso mas não %gordura; 'dobras_cutaneas' faz o
  // inverso. Se o denominador fosse "todas as avaliações do grupo", um peso
  // medido nas duas sessões possíveis apareceria como cobertura de 2/3 — um
  // dado completo desacreditado como parcial só porque houve outro
  // instrumento no meio do caminho.
  const grupoMisto = [
    { id: 'mA', tipo: 'perimetros', data: '2026-01-01', dados: { peso: 70 } },
    { id: 'mB', tipo: 'perimetros', data: '2026-02-01', dados: { peso: 69 } },
    { id: 'mC', tipo: 'dobras_cutaneas', data: '2026-03-01', dados: { percentualGordura: 18 } }
  ];
  const composicao = buildGroupAnalytics(grupoMisto).find((g) => g.id === 'composicao');

  const peso = composicao.coverageByMetric.peso;
  assert.equal(peso.total, 2, 'só as 2 sessões de perímetros são elegíveis para peso');
  assert.notEqual(peso.total, 3, 'a sessão de dobras cutâneas não podia medir peso: fora do denominador');
  assert.equal(peso.found, 2);
  assert.equal(peso.parcial, false, 'peso completo não pode ser exibido como cobertura parcial');

  const gordura = composicao.coverageByMetric.percentualGordura;
  assert.equal(gordura.total, 1, 'só a sessão de dobras cutâneas é elegível para %gordura');
  assert.equal(gordura.found, 1);
  assert.equal(gordura.parcial, false);
});

check('série que mistura métodos diferentes fica identificável pela origem', () => {
  const avaliacoesMetodoMisto = [
    { id: 'gA', tipo: 'dobras_cutaneas', data: '2026-01-01', dados: { percentualGordura: 18 } },
    { id: 'gB', tipo: 'bioimpedancia', data: '2026-02-01', dados: { percentualGordura: 16 } }
  ];
  const grupos = buildGroupAnalytics(avaliacoesMetodoMisto);
  const composicao = grupos.find((g) => g.id === 'composicao');
  const cobertura = composicao.coverageByMetric.percentualGordura;

  assert.equal(cobertura.origins.length, 2, 'as duas origens (dobras cutâneas e bioimpedância) precisam ficar visíveis');
  assert.ok(cobertura.origins.includes('dobras_cutaneas'));
  assert.ok(cobertura.origins.includes('bioimpedancia'));

  // Cada linha da tabela/gráfico carrega o tipo de quem gerou aquele ponto —
  // a estimativa/medida não fica anônima dentro de uma série "contínua".
  const tipos = composicao.chartData.map((row) => row.tipo).filter(Boolean);
  assert.deepEqual(new Set(tipos), new Set(['dobras_cutaneas', 'bioimpedancia']));
});

console.log(`\n${passed} teste(s) de visualização de dados passaram.`);
