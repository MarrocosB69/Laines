import { novaDoAlimento, categoriaDeCompra } from '../core/prescricao/classificacao.js';
import { nomeParaExibicao } from '../core/prescricao/nomeAlimento.js';

/**
 * Ponte entre o catálogo real (TACO + TBCA) e o núcleo de cálculo.
 *
 * O núcleo não conhece a API: ele espera alimentos com `grupo`, `medidas`,
 * `ig` e `comp`. Aqui as linhas do catálogo ganham esse formato — e o que o
 * catálogo não tem vira `null`, nunca zero, para que a tela mostre traço em
 * vez de inventar número.
 */

/**
 * Âncora de equivalência por grupo do catálogo.
 *
 * ATENÇÃO — isto é chamada clínica, não técnica. O mapa abaixo cobre os casos
 * em que a literatura é consensual (carne equivale por proteína, fruta e
 * cereal por carboidrato disponível, óleo por lipídio). Grupos ausentes ficam
 * deliberadamente sem âncora: o núcleo responde "alimento sem grupo de
 * equivalência classificado" e não oferece substituto, que é melhor do que
 * sugerir troca por um critério que ninguém validou.
 *
 * Os nomes seguem a grafia do catálogo. A comparação ignora acento e caixa.
 */
export const ANCORA_POR_GRUPO = {
  'carnes e derivados': 'ptn',
  // O catalogo grafa o mesmo grupo de tres jeitos; sem as tres variantes,
  // 70 linhas de pescado ficavam sem equivalencia.
  'pescados e frutos do mar': 'ptn',
  'peixes e frutos do mar': 'ptn',
  'ovos e derivados': 'ptn',
  'leite e derivados': 'ptn',
  'leguminosas e derivados': 'ptn',

  'cereais e derivados': 'choDisponivel',
  'frutas e derivados': 'choDisponivel',
  'verduras, hortalicas e derivados': 'choDisponivel',
  'vegetais e derivados': 'choDisponivel',
  'produtos acucarados': 'choDisponivel',

  'gorduras e oleos': 'lip',
  'gorduras e azeites': 'lip',
  'nozes e sementes': 'lip',
  'sementes e oleaginosas': 'lip'
};

const semAcento = (texto) => String(texto || '')
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .trim()
  .toLowerCase();

export const ancoraDoGrupo = (grupo) => ANCORA_POR_GRUPO[semAcento(grupo)] ?? null;

/** Converte para número, preservando a ausência como null. */
const num = (valor) => {
  if (valor === null || valor === undefined || valor === '') return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
};

/**
 * O catálogo não traz medida caseira. Em vez de inventar uma porção, o
 * alimento passa a ser prescrito em grama: a quantidade digitada É a grama.
 * Quando houver tabela de medidas, basta ela entrar aqui e a tela mostra
 * "colher de sopa · 15 g" sem que nada mais mude.
 */
const MEDIDA_EM_GRAMAS = [{ descricao: null, gramas: 1 }];

export function adaptarAlimento(linha) {
  if (!linha) return null;
  const grupo = linha.grupo || null;
  const fonte = linha.fonte || 'TACO';
  return {
    id: String(linha.id),
    nome: linha.descricao,
    nomeExibicao: nomeParaExibicao({ nome: linha.descricao, fonte }),
    codigoFonte: String(linha.codigoTexto || linha.codigo || ''),
    fonte,
    grupo,
    tipoAlimento: linha.tipoAlimento || null,
    nova: novaDoAlimento(linha),
    categoriaCompra: categoriaDeCompra(linha),
    // O grupo do núcleo é a chave da âncora; sem âncora conhecida o alimento
    // fica sem grupo de equivalência, e o painel diz isso.
    grupoEquivalencia: ancoraDoGrupo(grupo),
    // Nem TACO nem TBCA trazem índice glicêmico.
    ig: num(linha.indiceGlicemico),
    medidas: MEDIDA_EM_GRAMAS,
    comp: {
      kcal: num(linha.energiaKcal),
      cho: num(linha.carboidrato),
      ptn: num(linha.proteina),
      lip: num(linha.lipidios),
      fibra: num(linha.fibra),
      ferro: num(linha.ferro),
      calcio: num(linha.calcio),
      zinco: num(linha.zinco),
      magnesio: num(linha.magnesio),
      vitaminaD: num(linha.vitaminaD),
      potassio: num(linha.potassio),
      sodio: num(linha.sodio)
    }
  };
}

/**
 * Grupos de equivalência no formato do núcleo, montados a partir do que o
 * catálogo carregado realmente tem — não de uma lista fixa.
 */
export function gruposDoCatalogo(alimentos = []) {
  const grupos = {};
  for (const a of alimentos) {
    if (!a?.grupoEquivalencia || !a.grupo) continue;
    grupos[a.grupo] = { rotulo: a.grupo, ancora: a.grupoEquivalencia };
  }
  return grupos;
}

/**
 * Metas do plano. O GET vem da última avaliação de gasto energético; as metas
 * de macro podem não ter sido definidas, e nesse caso permanecem null — a
 * adequação mostra traço em vez de comparar contra zero.
 */
export function adaptarMetas(contexto, pesoPaciente) {
  const g = contexto?.metasGet || {};
  return {
    kcal: num(g.calorias),
    cho: num(g.cho),
    ptn: num(g.ptn),
    lip: num(g.lip),
    fibra: num(g.fibras),
    peso: num(pesoPaciente)
  };
}
