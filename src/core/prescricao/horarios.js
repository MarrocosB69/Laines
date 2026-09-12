/**
 * Horários de refeição ancorados no treino.
 *
 * Em nutrição esportiva o pré e o pós-treino não têm hora fixa: têm distância
 * do treino. Se o atleta troca o treino das 18h para as 06h, todas as
 * refeições ancoradas se movem junto — e é isso que se quer prescrever.
 *
 * Puro: sem React, sem data do sistema.
 */

/** "18:30" → 1110 minutos desde a meia-noite. */
export function paraMinutos(hhmm) {
  const partes = String(hhmm || '').split(':');
  const h = Number(partes[0]);
  const m = Number(partes[1]);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

/** 1110 → "18:30". Envolve na virada do dia em vez de estourar. */
export function paraHora(minutos) {
  if (!Number.isFinite(minutos)) return null;
  const t = ((minutos % 1440) + 1440) % 1440;
  const h = String(Math.floor(t / 60)).padStart(2, '0');
  const m = String(t % 60).padStart(2, '0');
  return `${h}:${m}`;
}

/** "−1h30" / "+15min" — como o profissional lê a distância do treino. */
export function rotuloAncora(ancora) {
  if (!ancora || !Number.isFinite(ancora.min)) return null;
  const sinal = ancora.min < 0 ? '−' : '+';
  const abs = Math.abs(ancora.min);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h && m) return `${sinal}${h}h${String(m).padStart(2, '0')}`;
  if (h) return `${sinal}${h}h`;
  return `${sinal}${m}min`;
}

/**
 * Horário efetivo da refeição.
 *
 * Sem âncora vale o horário fixo. Com âncora, o horário é calculado a partir
 * do início ou do fim do treino — e se o treino não estiver definido, não há
 * horário: devolve null em vez de fingir um.
 */
export function horarioDe(refeicao, treino) {
  if (!refeicao?.ancora) return refeicao?.horarioFixo || null;
  const inicio = paraMinutos(treino?.inicio);
  if (inicio === null) return null;
  const duracao = Number(treino?.duracao);
  const base = inicio + (refeicao.ancora.ref === 'fim' && Number.isFinite(duracao) ? duracao : 0);
  return paraHora(base + refeicao.ancora.min);
}

/** Opções de ancoragem oferecidas ao profissional. */
export const ANCORAS = [
  { valor: '', rotulo: 'Horário fixo' },
  { valor: 'inicio:-180', rotulo: '3h antes do treino' },
  { valor: 'inicio:-90', rotulo: '1h30 antes do treino' },
  { valor: 'inicio:-45', rotulo: '45min antes do treino' },
  { valor: 'fim:15', rotulo: '15min após o treino' },
  { valor: 'fim:60', rotulo: '1h após o treino' }
];

/** Ordena as refeições pelo horário efetivo; as sem horário vão para o fim. */
export function ordenarPorHorario(refeicoes, treino) {
  return [...refeicoes].sort((a, b) => {
    const ha = paraMinutos(horarioDe(a, treino));
    const hb = paraMinutos(horarioDe(b, treino));
    if (ha === null && hb === null) return 0;
    if (ha === null) return 1;
    if (hb === null) return -1;
    return ha - hb;
  });
}
