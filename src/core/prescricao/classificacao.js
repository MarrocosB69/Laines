import { nomeParaExibicao } from './nomeAlimento.js';

/**
 * Classificação NOVA e categoria de compra.
 *
 * Nenhuma das duas existe como coluna no catálogo. O que existe é
 * `tipoAlimento` — que a TBCA preenche — e o `grupo`, que TACO e TBCA
 * preenchem. As duas classificações abaixo derivam desses campos.
 *
 * Quando nada permite classificar, o resultado é null: o painel mostra a
 * fatia como "não classificado" em vez de empurrar o alimento para um grupo
 * que ninguém verificou.
 */

export const semAcento = (texto) => String(texto || '')
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .trim()
  .toLowerCase();

export const ROTULO_NOVA = [
  'In natura ou minimamente processado',
  'Ingrediente culinário',
  'Processado',
  'Ultraprocessado'
];

export const ROTULO_NOVA_CURTO = ['In natura', 'Culinários', 'Processados', 'Ultraprocessados'];

/**
 * Mapa por `tipoAlimento`, que é o sinal mais direto.
 *
 * "Preparação" é receita feita a partir de alimentos — na NOVA, o prato
 * cozinhado em casa não é um grupo próprio: ele herda dos ingredientes. Sem a
 * lista de ingredientes, tratá-lo como in natura é a leitura mais fiel ao que
 * a tabela descreve (arroz cozido, feijão cozido, carne grelhada).
 */
const NOVA_POR_TIPO = {
  'alimento in natura': 1,
  'preparo simples do alimento': 1,
  'preparacao': 1,
  'alimento processado (ingrediente)': 2,
  'alimento processado pronto para consumo': 3,
  'alimento processado sem preparo': 3
};

/** Complemento por grupo, para as linhas sem `tipoAlimento` (a TACO não traz). */
const NOVA_POR_GRUPO = {
  'frutas e derivados': 1,
  'verduras, hortalicas e derivados': 1,
  'vegetais e derivados': 1,
  'leguminosas e derivados': 1,
  'cereais e derivados': 1,
  'carnes e derivados': 1,
  'ovos e derivados': 1,
  'peixes e frutos do mar': 1,
  'pescados e frutos do mar': 1,
  'leite e derivados': 1,
  'nozes e sementes': 1,
  'sementes e oleaginosas': 1,

  'gorduras e oleos': 2,
  'gorduras e azeites': 2,
  'produtos acucarados': 2,
  'produtos acucarados ': 2,

  'outros alimentos industrializados': 4,
  'alimentos para fins especiais': 4
};

/**
 * Grupo NOVA do alimento, ou null quando não há como afirmar.
 *
 * Bebidas, alimentos preparados e miscelânea ficam deliberadamente de fora:
 * "Bebidas" reúne água de coco e refrigerante, que estão nos extremos
 * opostos da escala.
 */
export function novaDoAlimento(alimento) {
  const porTipo = NOVA_POR_TIPO[semAcento(alimento?.tipoAlimento)];
  if (porTipo) return porTipo;
  return NOVA_POR_GRUPO[semAcento(alimento?.grupo)] ?? null;
}

/**
 * Onde o paciente encontra o alimento. Derivado do grupo, porque é o único
 * campo que o catálogo tem para isso.
 */
const CATEGORIA_POR_GRUPO = {
  'frutas e derivados': 'Hortifrúti',
  'verduras, hortalicas e derivados': 'Hortifrúti',
  'vegetais e derivados': 'Hortifrúti',

  'carnes e derivados': 'Açougue e ovos',
  'ovos e derivados': 'Açougue e ovos',

  'peixes e frutos do mar': 'Peixaria',
  'pescados e frutos do mar': 'Peixaria',

  'leite e derivados': 'Laticínios',

  'cereais e derivados': 'Mercearia',
  'leguminosas e derivados': 'Mercearia',
  'gorduras e oleos': 'Mercearia',
  'gorduras e azeites': 'Mercearia',
  'nozes e sementes': 'Mercearia',
  'sementes e oleaginosas': 'Mercearia',
  'produtos acucarados': 'Mercearia',
  'bebidas': 'Mercearia',
  'bebidas (alcoolicas e nao alcoolicas)': 'Mercearia',

  'alimentos para fins especiais': 'Suplementos'
};

export const ORDEM_CATEGORIA = [
  'Hortifrúti', 'Açougue e ovos', 'Peixaria', 'Laticínios',
  'Padaria', 'Mercearia', 'Suplementos', 'Outros'
];

export const categoriaDeCompra = (alimento) =>
  CATEGORIA_POR_GRUPO[semAcento(alimento?.grupo)] ?? 'Outros';

/**
 * Distribuição da energia do dia por grupo NOVA.
 *
 * A fatia não classificada aparece separada e nomeada. Diluí-la nas outras
 * faria a proporção de ultraprocessados parecer menor do que se pode afirmar.
 */
export function distribuicaoNova(itens) {
  const kcalDe = (i) => {
    const c = i.comp?.kcal;
    if (c === null || c === undefined) return 0;
    return (c * (i.quantidade * i.medida.gramas)) / 100;
  };
  const total = itens.reduce((acc, i) => acc + kcalDe(i), 0);
  const fatia = (filtro) => {
    const kcal = itens.filter(filtro).reduce((acc, i) => acc + kcalDe(i), 0);
    return { kcal, pct: total === 0 ? 0 : (kcal / total) * 100 };
  };

  return {
    total,
    grupos: [1, 2, 3, 4].map((g) => ({
      grupo: g,
      rotulo: ROTULO_NOVA_CURTO[g - 1],
      ...fatia((i) => i.nova === g)
    })),
    semClassificacao: fatia((i) => i.nova === null || i.nova === undefined)
  };
}

/**
 * Lista de compras: nomes, sem quantidade.
 *
 * Quantidade numa lista de compras engana — o paciente compra o pacote, não
 * as gramas do plano. Os substitutos entram marcados como opção, para não
 * inflar a compra de quem não vai trocar.
 */
export function listaDeCompras(refeicoes, catalogoPorId) {
  const mapa = new Map();

  const registrar = (alimentoId, ehOpcao) => {
    const a = catalogoPorId[alimentoId];
    if (!a) return;
    const atual = mapa.get(a.id);
    if (!atual) {
      mapa.set(a.id, { id: a.id, nome: a.nomeExibicao || nomeParaExibicao(a), categoria: categoriaDeCompra(a), opcao: ehOpcao });
    } else if (!ehOpcao) {
      // Usado como alimento em alguma refeicao: deixa de ser mera opcao.
      atual.opcao = false;
    }
  };

  refeicoes.forEach((r) => (r.itens ?? []).forEach((i) => {
    registrar(i.alimentoId, false);
    (i.substitutos ?? []).forEach((s) => registrar(s.alimentoId, true));
  }));

  const itens = [...mapa.values()];
  return ORDEM_CATEGORIA
    .map((categoria) => ({
      categoria,
      itens: itens
        .filter((x) => x.categoria === categoria)
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    }))
    .filter((c) => c.itens.length > 0);
}
