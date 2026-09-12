import { ancoraEm, cargaGlicemicaItem, gramasDoItem, valorNutriente } from './nutrientes.js';

const arredondar = (q, passo) => Math.max(passo, Math.round(q / passo) * passo);

/**
 * Monta uma opção concreta a partir de alimento, medida e alvo da âncora.
 *
 * A equivalência é ancorada no nutriente que define o grupo — carboidrato
 * disponível para frutas e cereais, proteína para carnes, lipídio para
 * gorduras — e nunca por caloria: dois alimentos de mesma caloria podem ter
 * papéis metabólicos opostos.
 */
export function montarOpcao(
  base,
  alimento,
  medidaIdx,
  { grupos, modo = 'auto', quantidadeFixa = null, passo = 0.5 } = {}
) {
  const grupo = grupos[base.grupo];
  const medida = alimento.medidas[medidaIdx];
  if (!grupo || !medida) return null;
  const alvo = ancoraEm(base.comp, grupo.ancora, gramasDoItem(base));
  const porMedida = ancoraEm(alimento.comp, grupo.ancora, medida.gramas);
  if (alvo === null || alvo === 0 || porMedida === null || porMedida === 0) return null;

  const quantidade = modo === 'fixa' && quantidadeFixa !== null
    ? quantidadeFixa
    : arredondar(alvo / porMedida, passo);

  const gramas = quantidade * medida.gramas;
  const real = ancoraEm(alimento.comp, grupo.ancora, gramas);
  const val = (k) => (alimento.comp[k] === null ? null : (alimento.comp[k] * gramas) / 100);
  const delta = (k) => {
    const nv = val(k);
    const bv = valorNutriente(base, k);
    return nv === null || bv === null ? null : nv - bv;
  };
  const dispCand = ancoraEm(alimento.comp, 'choDisponivel', gramas);
  const cg = alimento.ig === null || dispCand === null ? null : (alimento.ig * dispCand) / 100;
  const cgBase = cargaGlicemicaItem(base);

  return {
    alimentoId: alimento.id,
    nome: alimento.nome,
    fonte: alimento.fonte,
    medidaIdx,
    medida,
    quantidade,
    gramas,
    modo,
    ancora: grupo.ancora,
    desvio: (real - alvo) / alvo,
    deltaCho: delta('cho'),
    deltaPtn: delta('ptn'),
    deltaLip: delta('lip'),
    ig: alimento.ig,
    deltaIg: alimento.ig === null || base.ig === null ? null : alimento.ig - base.ig,
    deltaCg: cg === null || cgBase === null ? null : cg - cgBase
  };
}

/**
 * Candidatos do mesmo grupo, igualados pela âncora.
 *
 * A ordem importa: a quantidade é arredondada para medida caseira praticável
 * ANTES do filtro de tolerância. Filtrar antes ofereceria substitutos que só
 * fecham em "1,37 colher" — na prática, não fecham.
 */
export function substitutosPara(
  base,
  { grupos, catalogo, restricoes = [], tolerancia = 0.1, passo = 0.5, limite = 6 } = {}
) {
  const grupo = grupos[base.grupo];
  if (!grupo) return { motivo: 'sem-grupo', candidatos: [] };
  const alvo = ancoraEm(base.comp, grupo.ancora, gramasDoItem(base));
  if (alvo === null || alvo === 0) return { motivo: 'ancora-indisponivel', candidatos: [] };

  const melhores = new Map();
  for (const alimento of catalogo) {
    if (alimento.grupo !== base.grupo) continue;
    if (alimento.id === base.alimentoId) continue;
    if (restricoes.includes(alimento.id)) continue;
    for (let i = 0; i < alimento.medidas.length; i += 1) {
      const op = montarOpcao(base, alimento, i, { grupos, passo });
      if (!op || Math.abs(op.desvio) > tolerancia) continue;
      const atual = melhores.get(alimento.id);
      if (!atual || Math.abs(op.desvio) < Math.abs(atual.desvio)) melhores.set(alimento.id, op);
    }
  }

  return {
    motivo: null,
    candidatos: [...melhores.values()]
      .sort((a, b) => Math.abs(a.desvio) - Math.abs(b.desvio))
      .slice(0, limite)
  };
}

/**
 * Opção sem equivalência calculável.
 *
 * Acontece quando o profissional escolhe um substituto de outro grupo, ou um
 * alimento cuja tabela não informa o nutriente âncora. A troca continua
 * valendo — ela foi prescrita — mas a tela precisa dizer que ali não há
 * equivalência, e não fingir uma.
 */
function opcaoSemEquivalencia(base, alimento, medidaIdx, quantidade) {
  const medida = alimento.medidas[medidaIdx] ?? alimento.medidas[0];
  // Sem equivalencia nao ha quantidade calculada. O padrao segue a medida:
  // 1 porcao caseira, ou 100 g quando o alimento e prescrito em grama —
  // porque 1 grama de azeite nao e um ponto de partida util.
  const q = quantidade ?? (medida.gramas === 1 ? 100 : 1);
  const gramas = q * medida.gramas;
  const val = (k) => (alimento.comp[k] === null || alimento.comp[k] === undefined
    ? null
    : (alimento.comp[k] * gramas) / 100);
  const delta = (k) => {
    const a = val(k);
    const b = valorNutriente(base, k);
    return a === null || b === null ? null : a - b;
  };
  return {
    alimentoId: alimento.id,
    nome: alimento.nome,
    fonte: alimento.fonte,
    medidaIdx,
    medida,
    quantidade: q,
    gramas,
    modo: 'fixa',
    // Null, nao zero: nao existe desvio quando nao existe equivalencia.
    desvio: null,
    deltaCho: delta('cho'),
    deltaPtn: delta('ptn'),
    deltaLip: delta('lip'),
    deltaFibra: delta('fibra'),
    deltaCg: null,
    deltaIg: null
  };
}

/**
 * Resolve as opções já prescritas no item, recalculando as automáticas.
 *
 * O que o profissional escolheu nunca é descartado: se a equivalência não sai,
 * a opção aparece mesmo assim, marcada como sem equivalência. Antes ela era
 * filtrada fora e sumia da tela logo depois de ser adicionada.
 */
export function opcoesDoItem(base, { grupos, catalogoPorId } = {}) {
  return (base.substitutos ?? [])
    .map((s) => {
      const alimento = catalogoPorId[s.alimentoId];
      // Alimento ausente do catalogo carregado e o unico caso de descarte.
      if (!alimento) return null;
      const op = montarOpcao(base, alimento, s.medidaIdx, {
        grupos,
        modo: s.modo,
        quantidadeFixa: s.quantidade ?? null
      });
      return op ?? opcaoSemEquivalencia(base, alimento, s.medidaIdx ?? 0, s.quantidade ?? null);
    })
    .filter(Boolean);
}
