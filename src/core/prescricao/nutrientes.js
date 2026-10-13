/**
 * Núcleo de cálculo da prescrição — camada de nutrientes.
 *
 * Sem React e sem imports do app: o catálogo e os grupos de equivalência
 * chegam por parâmetro. Isto permite que a mesma regra rode na tela e na
 * geração do PDF no backend sem que as duas divirjam.
 *
 * Regra que atravessa toda a cadeia: ausência de dado é `null`, nunca zero.
 * Um alimento sem ferro cadastrado não tem "zero de ferro" — não se sabe.
 * Somar zero mentiria sobre a adequação do plano.
 */

export const gramasDoItem = (item) => item.quantidade * item.medida.gramas;

/** Valor absoluto do nutriente no item. null quando a tabela não informa. */
export function valorNutriente(item, nutriente) {
  const por100 = item.comp[nutriente];
  if (por100 === null || por100 === undefined) return null;
  return (por100 * gramasDoItem(item)) / 100;
}

/**
 * Ancora a equivalência no nutriente do grupo. Carboidrato disponível é o
 * total menos a fibra — e exige os dois: sem fibra cadastrada o resultado é
 * null, não o carboidrato total.
 */
export function ancoraEm(compAlimento, ancora, gramas) {
  const g = (k) => (
    compAlimento[k] === null || compAlimento[k] === undefined
      ? null
      : (compAlimento[k] * gramas) / 100
  );
  if (ancora === 'choDisponivel') {
    const cho = g('cho');
    const fibra = g('fibra');
    if (cho === null || fibra === null) return null;
    return Math.max(cho - fibra, 0);
  }
  return g(ancora);
}

export const choDisponivel = (item) => ancoraEm(item.comp, 'choDisponivel', gramasDoItem(item));

export function cargaGlicemicaItem(item) {
  const disp = choDisponivel(item);
  if (item.ig === null || disp === null) return null;
  return (item.ig * disp) / 100;
}

/** Soma que ignora ausências. Tudo ausente devolve null, não zero. */
export function somaOuNull(itens, fn) {
  const validos = itens.map(fn).filter(Number.isFinite);
  return validos.length === 0 ? null : validos.reduce((a, b) => a + b, 0);
}

/**
 * Fração da energia do conjunto que vem de itens com o nutriente informado.
 * É o que separa "o plano tem pouco ferro" de "não se sabe o ferro de metade
 * do plano" — duas conclusões clínicas diferentes.
 */
export function cobertura(itens, nutriente) {
  if (!itens.length) return 0;
  const total = itens.reduce((a, i) => a + (valorNutriente(i, 'kcal') ?? 0), 0);
  // Sem energia completa, usar proporção de itens; desconhecidos não desaparecem do denominador.
  if (total === 0 || itens.some((i) => valorNutriente(i, 'kcal') === null)) {
    return itens.filter((i) => valorNutriente(i, nutriente) !== null).length / itens.length;
  }
  const comDado = itens
    .filter((i) => valorNutriente(i, nutriente) !== null)
    .reduce((a, i) => a + (valorNutriente(i, 'kcal') ?? 0), 0);
  return comDado / total;
}
