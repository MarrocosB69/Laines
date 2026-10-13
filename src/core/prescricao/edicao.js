/** Assinatura do conteúdo prescrito; expansão dos cartões é só navegação. */
export const assinaturaPrescricao = (plano, catalogo) => JSON.stringify({
  plano: plano && {
    ...plano,
    refeicoes: (plano.refeicoes || []).map((refeicao) => {
      const persistente = { ...refeicao };
      delete persistente.aberta;
      return persistente;
    })
  },
  catalogo
});

/** Reaplica ao snapshot confirmado somente edições feitas durante o envio. */
export const mesclarRespostaPrescricao = (enviado, atual, salvo) => {
  if (JSON.stringify(atual) === JSON.stringify(enviado)) return salvo;
  if (Array.isArray(atual) || Array.isArray(enviado) || Array.isArray(salvo)) return atual;
  const objeto = (valor) => valor && typeof valor === 'object';
  if (!objeto(atual) || !objeto(enviado) || !objeto(salvo)) return atual;
  const resultado = { ...salvo };
  for (const chave of new Set([...Object.keys(enviado), ...Object.keys(atual)])) {
    if (!(chave in atual)) delete resultado[chave];
    else if (!(chave in enviado)) resultado[chave] = atual[chave];
    else resultado[chave] = mesclarRespostaPrescricao(enviado[chave], atual[chave], salvo[chave]);
  }
  return resultado;
};
