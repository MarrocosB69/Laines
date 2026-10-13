/**
 * Situação de uma linha de adequação.
 *
 * Estava embutida na cor do componente. Decidir "verde ou vermelho" a partir
 * de percentual e direção é cálculo, não apresentação — e é justamente onde
 * mora a inversão: para um nutriente com direção `limite` (sódio), passar de
 * 100% é excesso; metas individuais consideram também o afastamento acima do alvo.
 * RDA/AI são referências populacionais, não metas ou limites de segurança.
 *
 * Cobertura abaixo de 50% derruba o julgamento: com metade da energia do
 * plano vinda de alimentos sem o dado, o percentual não sustenta conclusão.
 */
export function situacaoAdequacao({ percentual, direcao, cobertura }) {
  // Number.isFinite tambem barra NaN e Infinity, nao so null/undefined.
  if (!Number.isFinite(percentual) || !Number.isFinite(cobertura) || cobertura < 0.5) return 'sem-dado';
  if (direcao === 'limite') return percentual > 100 ? 'excedido' : 'ok';
  if (direcao === 'referencia') return percentual >= 100 ? 'referencia-atingida' : 'referencia-abaixo';
  if (percentual > 120) return 'excedido';
  if (percentual < 80) return 'insuficiente';
  if (percentual < 90 || percentual > 110) return 'atencao';
  return 'ok';
}

/**
 * Distribuição energética dos macros no dia.
 *
 * Estava dentro do componente da rosca. Converter gramas em energia (4/4/9)
 * é cálculo nutricional, não desenho — o componente recebe as frações prontas
 * e só as traduz em arco.
 */
export function distribuicaoEnergetica(dia) {
  const kcalMacros = dia.cho * 4 + dia.ptn * 4 + dia.lip * 9;
  const fracao = (k) => (kcalMacros === 0 ? 0 : k / kcalMacros);
  return {
    kcalMacros,
    cho: fracao(dia.cho * 4),
    ptn: fracao(dia.ptn * 4),
    lip: fracao(dia.lip * 9)
  };
}
