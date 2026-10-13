// Synthetic regression for prescription edit state; no server or browser.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../src/hooks/usePrescricaoApi.js'), 'utf8');
const start = source.indexOf('// Abrir um cartão é navegação local');
const end = source.indexOf('\nexport function usePrescricaoApi', start);
assert.ok(start > 0 && end > start, 'helpers de estado da prescrição encontrados');
const helpers = source.slice(start, end);
const { assinaturaPrescricao, mesclarRespostaPrescricao } = vm.runInNewContext(
  `${helpers}\n({ assinaturaPrescricao, mesclarRespostaPrescricao })`
);

const alimento = { id: 'a', comp: { kcal: 100 } };
const plano = {
  version: 1, status: 'rascunho',
  restricoes: { semRestricao: true },
  refeicoes: [{ id: 'r', aberta: false, itens: [{ id: 'i', alimentoId: 'a', quantidade: 100 }] }]
};
const catalogo = { a: alimento };
const aberto = structuredClone(plano);
aberto.refeicoes[0].aberta = true;
assert.equal(assinaturaPrescricao(plano, catalogo), assinaturaPrescricao(aberto, catalogo),
  'abrir refeição não altera assinatura clínica');
aberto.refeicoes[0].itens[0].quantidade = 120;
assert.notEqual(assinaturaPrescricao(plano, catalogo), assinaturaPrescricao(aberto, catalogo),
  'quantidade alterada continua pendente');

const salvo = structuredClone(plano);
salvo.version = 2;
salvo.restricoes.conferidoEm = '2026-09-29T10:00:00Z';
const respostaCatalogo = { a: { ...alimento, validacaoComposicao: { version: 2 } } };
const mesclado = mesclarRespostaPrescricao(plano, aberto, salvo);
assert.equal(mesclado.version, 2, 'versão confirmada pelo servidor é mantida');
assert.equal(mesclado.restricoes.conferidoEm, salvo.restricoes.conferidoEm,
  'metadados clínicos confirmados são mantidos');
assert.equal(mesclado.refeicoes[0].itens[0].quantidade, 120,
  'digitação durante salvamento não é perdida');
assert.equal(mesclado.refeicoes[0].aberta, true, 'expansão visual continua aberta');
assert.notEqual(assinaturaPrescricao(mesclado, respostaCatalogo),
  assinaturaPrescricao(salvo, respostaCatalogo), 'edição posterior segue pendente');

const catalogoAtual = { ...catalogo, b: { id: 'b', comp: { kcal: 50 } } };
const catalogoMesclado = mesclarRespostaPrescricao(catalogo, catalogoAtual, respostaCatalogo);
assert.ok(catalogoMesclado.b, 'alimento adicionado durante salvamento permanece');
assert.equal(catalogoMesclado.a.validacaoComposicao.version, 2,
  'validação da composição recebida do servidor permanece');
assert.equal(mesclarRespostaPrescricao(plano, plano, salvo), salvo,
  'sem edição concorrente, resposta canônica é usada');

console.log('PASS estado de edição e resposta tardia da prescrição (8 verificações)');
