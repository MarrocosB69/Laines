import { choDisponivel, cargaGlicemicaItem, somaOuNull, valorNutriente } from './nutrientes.js';

/**
 * Totais de uma refeição.
 *
 * O IG ponderado considera apenas itens que têm IG e carboidrato disponível.
 * Um alimento sem IG cadastrado fica de fora da média em vez de entrar como
 * zero — entrar como zero puxaria o índice para baixo e faria a refeição
 * parecer mais branda do que é.
 */
export function totaisRefeicao(itens) {
  const pares = itens
    .map((i) => ({ ig: i.ig, disp: choDisponivel(i) }))
    .filter((p) => p.ig !== null && p.disp !== null);
  const dispTotal = pares.reduce((a, p) => a + p.disp, 0);

  return {
    kcal: somaOuNull(itens, (i) => valorNutriente(i, 'kcal')) ?? 0,
    cho: somaOuNull(itens, (i) => valorNutriente(i, 'cho')) ?? 0,
    ptn: somaOuNull(itens, (i) => valorNutriente(i, 'ptn')) ?? 0,
    lip: somaOuNull(itens, (i) => valorNutriente(i, 'lip')) ?? 0,
    choDisponivel: somaOuNull(itens, choDisponivel),
    cargaGlicemica: somaOuNull(itens, cargaGlicemicaItem),
    igPonderado: dispTotal === 0 ? null : pares.reduce((a, p) => a + p.ig * p.disp, 0) / dispTotal
  };
}
