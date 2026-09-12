/**
 * Método por equivalentes (lista de trocas).
 *
 * Em vez de prescrever "120 g de arroz", prescreve-se "2 porções de cereais"
 * e o paciente escolhe qual cereal. O que define a porção é a quantidade do
 * nutriente âncora do grupo — a mesma âncora que já rege a substituição.
 */

import { ancoraEm, gramasDoItem } from './nutrientes.js';

/**
 * Tamanho da porção de equivalência, em grama do nutriente âncora.
 *
 * ATENÇÃO — decisão clínica. Os valores abaixo são os da lista de trocas
 * clássica: 15 g de carboidrato disponível, 7 g de proteína, 5 g de lipídio.
 * Hortaliças usam porção menor porque, com 15 g, uma porção viraria um prato
 * inteiro de alface.
 *
 * A chave é a âncora do grupo, não o grupo: qualquer grupo novo que ancore em
 * proteína já herda 7 g sem precisar ser listado aqui.
 */
export const PORCAO_POR_ANCORA = {
  choDisponivel: 15,
  ptn: 7,
  lip: 5
};

/** Grupos que fogem do padrão da âncora, pela grafia do catálogo. */
export const PORCAO_POR_GRUPO = {
  'verduras, hortaliças e derivados': 5,
  'vegetais e derivados': 5
};

const semAcento = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

export function porcaoDoGrupo(grupo, ancora) {
  const especifica = Object.entries(PORCAO_POR_GRUPO)
    .find(([nome]) => semAcento(nome) === semAcento(grupo));
  if (especifica) return especifica[1];
  return PORCAO_POR_ANCORA[ancora] ?? null;
}

/**
 * Quantas porções de equivalência o item representa.
 *
 * Meia porção é a menor unidade que se prescreve: arredondar para inteiro
 * distorceria demais em grupos de porção pequena. Sem âncora ou sem o
 * nutriente informado, devolve null — não zero.
 */
export function porcoesDoItem(item, ancora) {
  const porcao = porcaoDoGrupo(item.grupo, ancora);
  if (!porcao || !ancora) return null;
  const valor = ancoraEm(item.comp, ancora, gramasDoItem(item));
  if (valor === null) return null;
  return Math.round((valor / porcao) * 2) / 2;
}

/**
 * Porções somadas por grupo no dia inteiro — a leitura que o método por
 * equivalentes entrega ao paciente.
 */
export function porcoesPorGrupo(itens, grupos) {
  const acc = new Map();
  for (const item of itens) {
    const ancora = grupos[item.grupo]?.ancora ?? null;
    const p = porcoesDoItem(item, ancora);
    if (p === null) continue;
    const atual = acc.get(item.grupo) ?? { grupo: item.grupo, porcoes: 0, ancora };
    atual.porcoes += p;
    acc.set(item.grupo, atual);
  }
  return [...acc.values()].sort((a, b) => b.porcoes - a.porcoes);
}
