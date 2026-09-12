/**
 * Leitura de planos gravados pela tela antiga.
 *
 * Puro de proposito: nao conhece React nem a API, so transforma dado. Assim
 * a conversao pode ser testada com o payload real do banco, sem navegador.
 */

/**
 * Reconstrucao de um plano gravado pela tela antiga.
 *
 * Aquela tela nao referenciava o catalogo: gravava a composicao dentro do
 * proprio alimento, com `tacoId: null`. Procurar o alimento por id devolvia
 * nada e o calculo quebrava a tela inteira.
 *
 * Aqui cada alimento antigo vira uma entrada de catalogo sintetica, montada
 * com o que o proprio plano ja carrega. Os numeros gravados sao a
 * contribuicao da porcao, entao voltam para base 100 g.
 */
export const por100 = (valor, gramas) => {
  if (valor === null || valor === undefined || valor === '') return null;
  const v = Number(valor);
  const g = Number(gramas);
  if (!Number.isFinite(v) || !Number.isFinite(g) || g <= 0) return null;
  return (v / g) * 100;
};

export const alimentoLegado = (a, id) => {
  const g = a?.quantidadeGramas == null ? 100 : Number(a.quantidadeGramas);
  return {
    ...a,
    id,
    nome: a?.descricao || 'Alimento sem nome',
    fonte: 'plano',
    origemComposicao: 'legado_pendente',
    // Nao da para saber o grupo de um alimento gravado sem referencia, e sem
    // grupo nao ha equivalencia — o painel dira isso em vez de inventar troca.
    grupo: null,
    grupoEquivalencia: null,
    ig: null,
    medidas: [{ descricao: a?.medidaCaseira || null, gramas: 1 }],
    comp: {
      kcal: por100(a?.calorias, g),
      cho: por100(a?.cho, g),
      ptn: por100(a?.ptn, g),
      lip: por100(a?.lip, g),
      fibra: por100(a?.fibra, g),
      ferro: null, calcio: null, zinco: null,
      magnesio: null, vitaminaD: null, potassio: null, sodio: null
    }
  };
};

/**
 * Converte uma refeicao antiga e devolve tambem os alimentos sinteticos que
 * ela precisou criar, para o container registra-los no catalogo.
 */
export const migrarRefeicao = (r, indice, catalogo, schemaVersion) => {
  if (schemaVersion !== undefined && ![1, 2].includes(schemaVersion)) {
    throw new Error('Versão de prescrição não suportada. Atualize a aplicação antes de salvar.');
  }
  if (schemaVersion === 2 || (Array.isArray(r?.itens) && (r.itens.length || !r?.alimentos?.length))) {
    return { ...r, horarioFixo: r.horarioFixo || r.horario || '', aberta: r.aberta ?? indice === 0 };
  }

  const antigos = Array.isArray(r?.alimentos) ? r.alimentos : [];
  const itens = antigos.map((a, j) => {
    const id = `legado-${indice}-${j}`;
    catalogo[id] = alimentoLegado(a, id);
    return {
      id: `i${indice}-${j}`,
      alimentoId: id,
      medidaIdx: 0,
      quantidade: a?.quantidadeGramas == null ? 100 : Number(a.quantidadeGramas),
      substitutos: []
    };
  });

  // No modelo antigo o substituto ficava solto na refeicao, sem dizer qual
  // alimento ele trocava. Com um unico alimento a leitura e inequivoca e o
  // vinculo pode ser feito; com varios, atribuir seria inventar — entao eles
  // ficam guardados e a refeicao avisa.
  const soltos = Array.isArray(r?.substitutos) ? r.substitutos : [];
  const semVinculo = [...(r?.substitutosSemVinculo || [])];
  if (soltos.length && itens.length === 1) {
    soltos.forEach((sub, k) => {
      const id = `legado-${indice}-sub-${k}`;
      catalogo[id] = alimentoLegado(sub, id);
      itens[0].substitutos.push({
        alimentoId: id,
        medidaIdx: 0,
        modo: 'fixa',
        quantidade: sub?.quantidadeGramas == null ? 100 : Number(sub.quantidadeGramas)
      });
    });
  } else {
    if (!semVinculo.length) semVinculo.push(...soltos);
  }

  return {
    ...r,
    id: r?.id || `r${indice}`,
    nome: r?.nome || `Refeição ${indice + 1}`,
    horario: r?.horario || '',
    horarioFixo: r?.horarioFixo || r?.horario || '',
    etiqueta: r?.etiqueta ?? null,
    aberta: indice === 0,
    itens,
    substitutosSemVinculo: semVinculo
  };
};
