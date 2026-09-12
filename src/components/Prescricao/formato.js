/** Formatação compartilhada da prescrição. Ausência é traço, nunca zero. */

export const n = (v, casas = 0) => (
  v === null || v === undefined
    ? '—'
    : v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })
);

export const sinal = (v, casas = 0) => (
  v === null || v === undefined ? '—' : `${v > 0 ? '+' : ''}${n(v, casas)}`
);

/** Quantidade prescrita: inteiro quando é inteiro, uma casa quando é meia. */
export const qtd = (v) => n(v, v % 1 ? 1 : 0);
