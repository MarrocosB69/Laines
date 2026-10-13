import React from 'react';
import { n } from './formato.js';

/**
 * Apresentacional: as frações chegam prontas de `distribuicaoEnergetica`.
 * Aqui só há geometria de arco — converter grama em energia é cálculo
 * nutricional e mora no núcleo.
 */
export default function MacroRosca({ dia, metas, distribuicao, cores, energia, composicaoIncompleta = false }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const { cho: fCho, ptn: fPtn, lip: fLip } = distribuicao;
  // Sem meta de energia nao ha percentual: `x / null` da NaN e a rosca
  // escrevia "NaN% da meta" na cara do usuario.
  const semEnergia = energia?.valor === null;
  const energiaParcial = !semEnergia && Number.isFinite(energia?.cobertura) && energia.cobertura < 1;
  const kcalExibida = semEnergia ? '—' : n(dia.kcal);
  const rotuloMeta = semEnergia ? 'sem composição'
    : energiaParcial ? 'subtotal conhecido'
      : metas.kcal ? `${n((dia.kcal / metas.kcal) * 100, 1)}% da meta` : 'sem meta definida';

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
    // O tamanho da caixa vem do CSS (o painel muda de forma com a largura);
    // o viewBox mantem a geometria. Com role="img" o texto de dentro nao e
    // lido, entao o rotulo acessivel repete a energia e a meta, alem da
    // divisao entre os macronutrientes.
    <svg
      viewBox="0 0 110 110"
      className="pp-rosca"
      role="img"
      aria-label={`${composicaoIncompleta ? 'Distribuição apenas dos nutrientes conhecidos. ' : ''}Carboidrato ${Math.round(fCho * 100)}%, proteína ${Math.round(fPtn * 100)}%, lipídio ${Math.round(fLip * 100)}%. ${kcalExibida} de ${n(metas.kcal)} kcal, ${rotuloMeta}`}
    >
      <circle className="pp-rosca__trilho" cx="55" cy="55" r={r} fill="none" strokeWidth="11" />
      {arco(fCho, 0, cores.cho)}
      {arco(fPtn, fCho, cores.ptn)}
      {arco(fLip, fCho + fPtn, cores.lip)}
      <text className="pp-rosca__valor" x="55" y="51" textAnchor="middle" fontSize="15">{kcalExibida}</text>
      <text className="pp-rosca__apoio" x="55" y="62" textAnchor="middle" fontSize="7.5">de {n(metas.kcal)} kcal</text>
      <text className="pp-rosca__apoio" x="55" y="72" textAnchor="middle" fontSize="7.5">
        {rotuloMeta}
      </text>
    </svg>
  );
}
