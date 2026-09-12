/**
 * Leituras do plano como um todo.
 *
 * Não são nutrientes: são propriedades do conjunto — quão variado ele é, quão
 * concentrado em energia, e a razão sódio/potássio, que a literatura associa a
 * desfecho cardiovascular melhor do que qualquer um dos dois isolado.
 *
 * Todas devolvem null quando falta base, nunca um número tranquilizador.
 */

import { gramasDoItem, valorNutriente, somaOuNull } from './nutrientes.js';

/**
 * Variedade: alimentos distintos e grupos distintos.
 *
 * Repetir o mesmo alimento em três refeições conta uma vez — é isso que
 * variedade quer dizer.
 */
export function variedade(itens) {
  return {
    alimentos: new Set(itens.map((i) => i.alimentoId)).size,
    grupos: new Set(itens.map((i) => i.grupo).filter(Boolean)).size
  };
}

/**
 * Densidade energética em kcal/g.
 *
 * Só faz sentido com massa: um plano sem gramas não tem densidade, e dividir
 * por zero daria Infinity.
 */
export function densidadeEnergetica(itens) {
  const gramas = itens.reduce((acc, i) => acc + gramasDoItem(i), 0);
  if (gramas <= 0) return null;
  const kcal = itens.reduce((acc, i) => acc + (valorNutriente(i, 'kcal') ?? 0), 0);
  return kcal / gramas;
}

/**
 * Razão sódio/potássio.
 *
 * Null quando qualquer um dos dois falta — a razão de um par incompleto não
 * é uma razão pequena, é uma razão desconhecida.
 */
export function razaoSodioPotassio(itens) {
  const sodio = somaOuNull(itens, (i) => valorNutriente(i, 'sodio'));
  const potassio = somaOuNull(itens, (i) => valorNutriente(i, 'potassio'));
  if (sodio === null || potassio === null || potassio === 0) return null;
  return sodio / potassio;
}

/**
 * Proteína por refeição em g/kg de peso.
 *
 * A distribuição importa tanto quanto o total: 2 g/kg concentrados em duas
 * refeições estimulam menos síntese proteica que os mesmos 2 g/kg
 * distribuídos. Sem peso do paciente não há g/kg — devolve null.
 */
export function proteinaPorRefeicao(porRefeicao, peso) {
  const p = Number(peso);
  const temPeso = Number.isFinite(p) && p > 0;
  return porRefeicao.map((r) => ({
    id: r.id,
    nome: r.nome,
    ptn: r.totais.ptn,
    gkg: temPeso ? r.totais.ptn / p : null
  }));
}

export function analisesDoPlano(itens, porRefeicao, peso) {
  return {
    ...variedade(itens),
    densidadeEnergetica: densidadeEnergetica(itens),
    naK: razaoSodioPotassio(itens),
    proteinaPorRefeicao: proteinaPorRefeicao(porRefeicao, peso)
  };
}
