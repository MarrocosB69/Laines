import React from 'react';
import { n } from './formato.js';

/**
 * Apresentacional: as frações chegam prontas de `distribuicaoEnergetica`.
 * Aqui só há geometria de arco — converter grama em energia é cálculo
 * nutricional e mora no núcleo.
 */
export default function MacroRosca({ dia, metas, distribuicao, cores }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const { cho: fCho, ptn: fPtn, lip: fLip } = distribuicao;

  const arco = (fracao, offset, cor) => (
    <circle
      cx="55"
      cy="55"
      r={r}
      fill="none"
      stroke={cor}
      strokeWidth="11"
      strokeDasharray={`${(fracao * c).toFixed(1)} ${c.toFixed(1)}`}
      strokeDashoffset={(-offset * c).toFixed(1)}
      transform="rotate(-90 55 55)"
    />
  );

  return (
    // Abaixo de 1000px o painel vira faixa e a rosca reduz junto. O viewBox
    // mantem a geometria; so a caixa muda.
    <svg
      viewBox="0 0 110 110"
      className="h-[180px] w-[180px] shrink-0 max-[999px]:h-[110px] max-[999px]:w-[110px]"
      role="img"
      aria-label={`Carboidrato ${Math.round(fCho * 100)}%, proteína ${Math.round(fPtn * 100)}%, lipídio ${Math.round(fLip * 100)}%`}
    >
      <circle cx="55" cy="55" r={r} fill="none" stroke="#E7E5E4" strokeWidth="11" />
      {arco(fCho, 0, cores.cho)}
      {arco(fPtn, fCho, cores.ptn)}
      {arco(fLip, fCho + fPtn, cores.lip)}
      <text x="55" y="51" textAnchor="middle" fontSize="15" fill="#1C1917">{n(dia.kcal)}</text>
      <text x="55" y="62" textAnchor="middle" fontSize="7.5" fill="#78716C">de {n(metas.kcal)} kcal</text>
      <text x="55" y="72" textAnchor="middle" fontSize="7.5" fill="#78716C">
        {/* Sem meta de energia nao ha percentual: `x / null` da NaN e a rosca
            escrevia "NaN% da meta" na cara do usuario. */}
        {metas.kcal ? `${n((dia.kcal / metas.kcal) * 100, 1)}% da meta` : 'sem meta definida'}
      </text>
    </svg>
  );
}
