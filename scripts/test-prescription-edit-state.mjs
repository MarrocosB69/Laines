import assert from 'node:assert/strict';
import { assinaturaPrescricao, mesclarRespostaPrescricao } from '../src/core/prescricao/edicao.js';

const alimento = { nome: 'Alimento sintético', comp: { kcal: 100 } };
const base = {
  version: 3,
  status: 'rascunho',
  refeicoes: [{ id: 'r1', nome: 'Almoço', aberta: true, itens: [
    { id: 'i1', alimentoId: 'a1', medidaIdx: 0, quantidade: 100, substitutos: [] }
  ] }]
};
const catalogo = { a1: alimento };
const assinatura = assinaturaPrescricao(base, catalogo);
assert.equal(assinaturaPrescricao({ ...base, refeicoes: [{ ...base.refeicoes[0], aberta: false }] }, catalogo), assinatura,
  'recolher a refeição não deve gerar edição pendente');
assert.notEqual(assinaturaPrescricao({ ...base, refeicoes: [{ ...base.refeicoes[0], itens: [
  { ...base.refeicoes[0].itens[0], quantidade: 150 }
] }] }, catalogo), assinatura, 'mudar quantidade deve gerar edição pendente');

const salvo = { ...base, version: 4, status: 'em_revisao' };
const digitadoDuranteEnvio = { ...base, refeicoes: [{ ...base.refeicoes[0], itens: [
  { ...base.refeicoes[0].itens[0], quantidade: 175 }
] }] };
const mesclado = mesclarRespostaPrescricao(base, digitadoDuranteEnvio, salvo);
assert.equal(mesclado.version, 4, 'a versão confirmada deve avançar');
assert.equal(mesclado.status, 'em_revisao', 'a transição confirmada deve permanecer');
assert.equal(mesclado.refeicoes[0].itens[0].quantidade, 175, 'digitação durante o envio não pode sumir');
assert.notEqual(assinaturaPrescricao(mesclado, catalogo), assinaturaPrescricao(salvo, catalogo),
  'edição posterior deve pedir outro salvamento');

const catalogoAtual = { ...catalogo, a2: { nome: 'Segundo alimento sintético' } };
const catalogoMesclado = mesclarRespostaPrescricao(catalogo, catalogoAtual, catalogo);
assert.deepEqual(catalogoMesclado.a2, catalogoAtual.a2, 'candidato escolhido durante envio deve permanecer');
console.log('Estado da prescrição: expansão visual, edição durante salvamento e catálogo OK.');
