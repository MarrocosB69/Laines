/**
 * Nome de usuário que cabe sem quebrar palavra.
 *
 * O rodapé da sidebar tinha `max-width: 120px` com reticências, e
 * "Juliana Nascimento Costa" virava "Juliana Nasciment..." — um nome cortado
 * no meio não identifica ninguém e passa impressão de defeito.
 *
 * Aqui o encurtamento é semântico: primeiro nome e último sobrenome, que é
 * como as pessoas se identificam. O nome completo continua disponível no
 * atributo `title` de quem chama.
 */

/** Partículas que não contam como sobrenome. */
const PARTICULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'del', 'di', 'van', 'von']);

export function nomeExibicao(nomeCompleto, limite = 22) {
  const bruto = String(nomeCompleto || '').trim().replace(/\s+/g, ' ');
  if (!bruto) return '';
  if (bruto.length <= limite) return bruto;

  const partes = bruto.split(' ');
  if (partes.length < 2) {
    // Nome único e longo demais: não há como encurtar sem cortar palavra.
    return bruto;
  }

  const primeiro = partes[0];
  // Último termo que não seja partícula — "Bruno de Andrade" vira "Bruno Andrade",
  // não "Bruno de".
  let ultimo = partes[partes.length - 1];
  for (let i = partes.length - 1; i > 0; i -= 1) {
    if (!PARTICULAS.has(partes[i].toLowerCase())) { ultimo = partes[i]; break; }
  }

  const curto = `${primeiro} ${ultimo}`;
  // Se nem assim couber, é melhor o nome inteiro em duas linhas do que
  // um pedaço de palavra.
  return curto.length <= limite ? curto : primeiro;
}

export default nomeExibicao;
