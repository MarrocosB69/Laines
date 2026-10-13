import { useMemo } from 'react';
import {
  calcularPlano,
  distribuicaoEnergetica,
  gramasDoItem,
  opcoesDoItem,
  situacaoAdequacao,
  substitutosPara,
  valorNutriente
} from '../core/prescricao/index.js';

/**
 * Única porta entre a tela e o núcleo de cálculo.
 *
 * Os componentes de prescrição são apresentacionais: nenhum deles chama o
 * núcleo. Quando cada linha de alimento calculava as próprias sugestões, o
 * mesmo cálculo rodava em vários lugares e nada garantia que a tela e o PDF
 * concordassem. Aqui o cálculo acontece uma vez, e desce como dado.
 *
 * `abertos` é o conjunto de itens com o painel de substituições expandido —
 * sugestões só são buscadas para eles, como no comportamento original.
 */
export function usePlanoCalculado(plano, {
  metas,
  referencias,
  catalogo,
  catalogoPorId,
  grupos,
  restricoes = [],
  abertos = null
} = {}) {
  const calculado = useMemo(
    () => calcularPlano(plano, metas, referencias, { catalogoPorId }),
    [plano, metas, referencias, catalogoPorId]
  );

  const totaisPorId = useMemo(
    () => Object.fromEntries(calculado.porRefeicao.map((r) => [r.id, r.totais])),
    [calculado]
  );

  const itensPorRefeicao = useMemo(
    () => Object.fromEntries(calculado.resolvidas.map((r) => [r.id, r.itens])),
    [calculado]
  );

  const todosItens = useMemo(
    () => calculado.resolvidas.flatMap((r) => r.itens),
    [calculado]
  );

  // As opções já prescritas aparecem no contador da linha, aberta ou não.
  const opcoesPorItem = useMemo(
    () => Object.fromEntries(
      todosItens.map((item) => [item.id, opcoesDoItem(item, { grupos, catalogoPorId })])
    ),
    [todosItens, grupos, catalogoPorId]
  );

  // Sugestões são caras e só interessam com o painel aberto.
  const sugestoesPorItem = useMemo(() => {
    const vazio = { motivo: null, candidatos: [] };
    return Object.fromEntries(todosItens.map((item) => {
      if (abertos && !abertos.has(item.id)) return [item.id, vazio];
      return [item.id, substitutosPara(item, { grupos, catalogo, restricoes })];
    }));
  }, [todosItens, grupos, catalogo, restricoes, abertos]);

  // Itens que colidem com restrição confirmada (UPD-11). O motor não remove o
  // item — a decisão é do profissional — mas a linha precisa dizer que ali há
  // conflito e se ele já foi justificado.
  const restritosPorItem = useMemo(() => {
    if (Array.isArray(restricoes) || !restricoes || restricoes.pendenteRevisao || restricoes.semRestricao) return {};
    const alimentoIds = new Set(restricoes.alimentoIds || []);
    const gruposRestritos = new Set(restricoes.grupos || []);
    const justificativas = restricoes.justificativas || {};
    return Object.fromEntries(todosItens.flatMap((item) => {
      const motivo = alimentoIds.has(String(item.alimentoId)) ? 'alimento' : gruposRestritos.has(item.grupo) ? 'grupo' : null;
      if (!motivo) return [];
      const justificativa = String(justificativas[item.id] || '').trim();
      return [[item.id, { motivo, justificada: justificativa.length >= 5 }]];
    }));
  }, [todosItens, restricoes]);

  // Valores exibidos em cada linha de alimento. Ficavam na própria linha, que
  // por isso chamava o núcleo; aqui descem prontos e o componente só formata.
  const valoresPorItem = useMemo(
    () => Object.fromEntries(todosItens.map((item) => [item.id, {
      gramas: gramasDoItem(item),
      kcal: valorNutriente(item, 'kcal'),
      cho: valorNutriente(item, 'cho'),
      ptn: valorNutriente(item, 'ptn'),
      lip: valorNutriente(item, 'lip')
    }])),
    [todosItens]
  );

  // A cor da barra de adequação nasce de percentual, direção e cobertura —
  // decisão de cálculo. O componente recebe a situação e escolhe o tom.
  const comSituacao = (linhas) => linhas.map((l) => ({ ...l, situacao: situacaoAdequacao(l) }));
  const macros = useMemo(() => comSituacao(calculado.macros), [calculado]);
  const micros = useMemo(() => comSituacao(calculado.micros), [calculado]);
  const distribuicao = useMemo(() => distribuicaoEnergetica(calculado.dia), [calculado]);

  return {
    calculado,
    totaisPorId,
    itensPorRefeicao,
    opcoesPorItem,
    sugestoesPorItem,
    valoresPorItem,
    restritosPorItem,
    macros,
    micros,
    distribuicao
  };
}

export default usePlanoCalculado;
