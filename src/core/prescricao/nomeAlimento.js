const FONTES_OFICIAIS = new Set(['TACO', 'TBCA']);

/** Apresentação derivada; a descrição oficial permanece em `nome`. */
export function nomeParaExibicao(alimento) {
  const nome = String(alimento?.nome ?? alimento?.descricao ?? '')
    .normalize('NFC').replace(/\s+/gu, ' ').trim();
  const fonte = String(alimento?.fonte ?? '').toUpperCase();
  if (!FONTES_OFICIAIS.has(fonte)) return nome;

  const expandido = nome
    .replace(/(^|[\s,(])c\/(?=\s|$)/giu, '$1com')
    .replace(/(^|[\s,(])s\/(?=\s|$)/giu, '$1sem');
  let profundidade = 0;
  let resultado = '';
  for (const caractere of expandido) {
    if (caractere === '(') profundidade += 1;
    if (caractere === ')') profundidade = Math.max(0, profundidade - 1);
    resultado += caractere === ',' && profundidade === 0 ? ' · ' : caractere;
  }
  return resultado.replace(/\s*·\s*/gu, ' · ').replace(/\s+/gu, ' ').trim();
}
