// Catalog and prescription checks with synthetic foods; no database or patient records.
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
require(path.join(root, 'server/node_modules/ts-node')).register({
  project: path.join(root, 'server/tsconfig.json'), transpileOnly: true
});
const { TacoService, termosBuscaAlimento } = require(path.join(root, 'server/src/taco/taco.service.ts'));
const { ancoraDoGrupoParaEntrega, nomeAlimentoParaEntrega, portion } = require(path.join(root, 'server/src/planos-alimentares/prescricao-contract.ts'));

function buscarComConsulta(query, grupo) {
  const seen = { clauses: [], params: {}, order: [], limit: null };
  const qb = {
    andWhere(clause, params) { seen.clauses.push(clause); Object.assign(seen.params, params); return this; },
    orderBy(clause) { seen.order.push(clause); return this; },
    addOrderBy(clause) { seen.order.push(clause); return this; },
    take(limit) { seen.limit = limit; return this; },
    async getMany() { return []; }
  };
  let created = 0;
  const service = new TacoService({ createQueryBuilder() { created++; return qb; } });
  return service.buscar({ query, grupo, limite: 20 }).then((results) => ({ results, seen, created }));
}

let passed = 0;
async function check(name, test) { await test(); passed++; console.log(`PASS ${name}`); }

(async () => {
  const { nomeParaExibicao } = await import(pathToFileURL(path.join(root, 'src/core/prescricao/nomeAlimento.js')).href);
  const { adaptarAlimento, ANCORA_POR_GRUPO } = await import(pathToFileURL(path.join(root, 'src/services/prescricaoCatalogo.js')).href);
  await check('delivery anchors match the editor group classification', () => {
    for (const [grupo, ancora] of Object.entries(ANCORA_POR_GRUPO)) {
      assert.equal(ancoraDoGrupoParaEntrega(grupo), ancora, grupo);
    }
    assert.equal(ancoraDoGrupoParaEntrega('grupo desconhecido'), null);
  });
  await check('presentation keeps the official identity and preparation detail', () => {
    const fonte = { nome: 'Arroz, integral, cozido, c/ sal', fonte: 'TBCA' };
    const display = 'Arroz · integral · cozido · com sal';
    assert.equal(nomeParaExibicao(fonte), display);
    assert.equal(nomeAlimentoParaEntrega(fonte), display);
    assert.equal(fonte.nome, 'Arroz, integral, cozido, c/ sal');
    assert.equal(nomeParaExibicao({ nome: 'Sopa (legumes, carne), s/ sal', fonte: 'TACO' }),
      'Sopa (legumes, carne) · sem sal');
    assert.equal(nomeParaExibicao({ nome: 'Receita, c/ sal', fonte: 'manual' }), 'Receita, c/ sal');
  });

  await check('adapter and delivery keep source name, code and nutrients', () => {
    const original = 'Arroz, integral, cozido, c/ sal';
    const a = adaptarAlimento({ id: 7, descricao: original, codigoTexto: 'C0209A', fonte: 'TBCA',
      grupo: 'Cereais e derivados', energiaKcal: 124, carboidrato: 25 });
    assert.equal(a.nome, original);
    assert.equal(a.nomeExibicao, 'Arroz · integral · cozido · com sal');
    assert.equal(a.codigoFonte, 'C0209A');
    assert.equal(a.comp.kcal, 124);
    assert.equal(a.comp.cho, 25);
    assert.equal(a.comp.ferro, null);
    const projected = portion({ alimentoId: a.id, quantidade: 100, medidaIdx: 0 }, { [a.id]: a });
    assert.equal(projected.descricao, a.nomeExibicao);
    assert.equal(projected.calorias, 124);
    const misleading = { ...a, nomeExibicao: 'Outro alimento' };
    assert.equal(portion({ alimentoId: a.id, quantidade: 100, medidaIdx: 0 }, { [a.id]: misleading }).descricao,
      a.nomeExibicao);
    const semSal = adaptarAlimento({ id: 8, descricao: 'Arroz, integral, cozido, s/ sal',
      codigoTexto: 'C0210A', fonte: 'TBCA', grupo: 'Cereais e derivados', energiaKcal: 120 });
    assert.notEqual(semSal.id, a.id);
    assert.notEqual(semSal.nomeExibicao, a.nomeExibicao);
    assert.equal(a.nome, original);
  });

  await check('term normalization accepts accent, order, separators and salt abbreviations', () => {
    assert.deepEqual(termosBuscaAlimento('Árroz, integral'), ['arroz', 'integral']);
    assert.deepEqual(termosBuscaAlimento('integral arroz'), ['integral', 'arroz']);
    assert.deepEqual(termosBuscaAlimento('C/ sal'), ['com', 'sal']);
    assert.deepEqual(termosBuscaAlimento('s/ sal'), ['sem', 'sal']);
    assert.deepEqual(termosBuscaAlimento('%_'), []);
  });

  await check('search requires every safe token and does not interpolate LIKE wildcards', async () => {
    const { seen } = await buscarComConsulta('integral arroz');
    assert.equal(seen.clauses.length, 2);
    assert.deepEqual([seen.params.termo0, seen.params.termo1], ['%integral%', '%arroz%']);
    assert.ok(seen.order[0].includes('length'));
    const abbreviations = await buscarComConsulta('com sal');
    assert.equal(abbreviations.seen.params.alternativa0, '%c/%');
    assert.equal(abbreviations.seen.params.termo1, '%sal%');
    const punctuation = await buscarComConsulta('%_');
    assert.equal(punctuation.created, 0);
    assert.deepEqual(punctuation.results, []);
  });

  await check('source code search is exact and group-only loading keeps its prior order', async () => {
    const code = await buscarComConsulta('C0209A');
    assert.equal(code.seen.params.codigo, 'c0209a');
    assert.equal(code.seen.clauses.length, 1);
    assert.ok(code.seen.clauses[0].includes('codigoTexto'));
    const group = await buscarComConsulta('', 'Cereais');
    assert.equal(group.seen.order[0], 'alimento.descricao');
    assert.equal(group.seen.params.grupo, '%Cereais%');
    assert.equal(group.seen.limit, 20);
  });

  console.log(`PASS ${passed} food-name/search checks`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
