import { cobertura, cargaGlicemicaItem, somaOuNull, valorNutriente } from './nutrientes.js';
import { totaisRefeicao } from './totais.js';

/** Junta o item prescrito com o alimento do catálogo. */
export function resolverItem(item, catalogoPorId) {
  const a = catalogoPorId[item.alimentoId];
  return {
    ...item,
    nome: a.nome,
    fonte: a.fonte,
    grupo: a.grupo,
    ig: a.ig,
    // Classificacao NOVA e categoria de compra viajam com o item resolvido:
    // sem isso o painel de processamento e a lista de compras nao alcancam.
    nova: a.nova ?? null,
    categoriaCompra: a.categoriaCompra ?? null,
    comp: a.comp,
    medida: a.medidas[item.medidaIdx ?? 0]
  };
}

/**
 * Calcula o plano inteiro.
 *
 * Substitutos entram como alternativa e nunca somam ao total do dia: o plano
 * continua sendo o item prescrito, e as opções são caminhos paralelos para a
 * mesma linha. Por isso `todosItens` percorre apenas os itens das refeições —
 * `item.substitutos` não entra em nenhum somatório.
 */
/**
 * So ha percentual quando existe referencia positiva e finita.
 *
 * Sem esta guarda, meta nula virava `valor / null` — que em JS e NaN (ou
 * Infinity) e escapava da checagem de nulo la na frente, pintando a linha de
 * vermelho como se fosse deficit. Ausencia de meta nao e inadequacao.
 */
const podeComparar = (referencia) => Number.isFinite(referencia) && referencia > 0;

export function calcularPlano(plano, metas, referencias, { catalogoPorId } = {}) {
  const resolvidas = plano.refeicoes.map((r) => ({
    id: r.id,
    itens: r.itens.map((i) => resolverItem(i, catalogoPorId))
  }));
  const porRefeicao = resolvidas.map((r) => ({ id: r.id, totais: totaisRefeicao(r.itens) }));
  const todosItens = resolvidas.flatMap((r) => r.itens);

  const dia = {
    kcal: porRefeicao.reduce((a, r) => a + r.totais.kcal, 0),
    cho: porRefeicao.reduce((a, r) => a + r.totais.cho, 0),
    ptn: porRefeicao.reduce((a, r) => a + r.totais.ptn, 0),
    lip: porRefeicao.reduce((a, r) => a + r.totais.lip, 0),
    cargaGlicemica: somaOuNull(todosItens, cargaGlicemicaItem)
  };

  const linhaRef = (ref) => {
    const valor = somaOuNull(todosItens, (i) => valorNutriente(i, ref.nutriente));
    return {
      nutriente: ref.nutriente,
      rotulo: ref.rotulo,
      unidade: ref.unidade,
      tipo: ref.tipo,
      direcao: ref.direcao,
      referencia: ref.valor,
      valor,
      cobertura: cobertura(todosItens, ref.nutriente),
      percentual: valor === null || !podeComparar(ref.valor) ? null : (valor / ref.valor) * 100
    };
  };

  const linhaMacro = (nutriente, rotulo, unidade, valor, referencia) => ({
    nutriente,
    rotulo,
    unidade,
    tipo: 'meta',
    direcao: 'meta',
    referencia,
    valor,
    cobertura: 1,
    percentual: podeComparar(referencia) ? (valor / referencia) * 100 : null
  });

  const macros = [
    linhaMacro('kcal', 'Energia', 'kcal', dia.kcal, metas.kcal),
    linhaMacro('cho', 'Carboidrato', 'g', dia.cho, metas.cho),
    linhaMacro('ptn', 'Proteína', 'g', dia.ptn, metas.ptn),
    linhaMacro('lip', 'Lipídio', 'g', dia.lip, metas.lip),
    ...referencias.filter((r) => r.nutriente === 'fibra').map(linhaRef)
  ];
  const micros = referencias.filter((r) => r.nutriente !== 'fibra').map(linhaRef);

  return { resolvidas, porRefeicao, dia, macros, micros, metas };
}
