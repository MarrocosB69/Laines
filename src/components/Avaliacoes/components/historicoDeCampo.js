// Localiza a medicao anterior de um campo dentro do historico do modulo.
// Separado do componente porque fast-refresh exige que um arquivo com
// componente exporte apenas componentes.

export const paraNumero = (bruto) => {
  if (bruto === null || bruto === undefined) return null;
  const texto = String(bruto).trim();
  if (!texto) return null;
  const n = Number(texto.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

// Cada modulo grava sob nomes diferentes conforme a versao do schema
// (percentFat, percentual_gordura, percentualGordura). Varrer as fontes
// conhecidas evita perder o historico so por causa do nome do campo.
const fontesDoRegistro = (registro) => [
  registro?.dados?.dadosBrutos,
  registro?.dados,
  registro?.dados?.resultados_calculados,
  registro?.resultados
];

export const acharValorAnterior = (moduleHistory, aliases, { ignorarId = null } = {}) => {
  const chaves = Array.isArray(aliases) ? aliases : [aliases];
  for (const registro of moduleHistory || []) {
    if (!registro) continue;
    // O registro em edicao nao e "anterior" a si mesmo.
    if (ignorarId && String(registro.id) === String(ignorarId)) continue;
    for (const fonte of fontesDoRegistro(registro)) {
      if (!fonte || typeof fonte !== 'object') continue;
      for (const chave of chaves) {
        const valor = paraNumero(fonte[chave]);
        if (valor !== null) {
          return {
            valor,
            data: registro.measuredAt || registro.data || registro.dataAvaliacao || registro.createdAt || null,
            id: registro.id || null
          };
        }
      }
    }
  }
  return null;
};

