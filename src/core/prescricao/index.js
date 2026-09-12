export {
  gramasDoItem,
  valorNutriente,
  ancoraEm,
  choDisponivel,
  cargaGlicemicaItem,
  somaOuNull,
  cobertura
} from './nutrientes.js';
export { totaisRefeicao } from './totais.js';
export { montarOpcao, substitutosPara, opcoesDoItem } from './equivalencia.js';
export { resolverItem, calcularPlano } from './plano.js';
export { situacaoAdequacao, distribuicaoEnergetica } from './adequacao.js';
export { migrarRefeicao, alimentoLegado, por100 } from './legado.js';
export {
  paraMinutos, paraHora, rotuloAncora, horarioDe, ordenarPorHorario, ANCORAS
} from './horarios.js';
export {
  variedade, densidadeEnergetica, razaoSodioPotassio, proteinaPorRefeicao, analisesDoPlano
} from './analises.js';
export {
  novaDoAlimento, categoriaDeCompra, distribuicaoNova, listaDeCompras,
  ROTULO_NOVA, ROTULO_NOVA_CURTO, ORDEM_CATEGORIA
} from './classificacao.js';
export {
  porcaoDoGrupo, porcoesDoItem, porcoesPorGrupo, PORCAO_POR_ANCORA
} from './equivalentes.js';
