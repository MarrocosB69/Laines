import React from 'react';
import { n } from './formato.js';

/**
 * Quanto do alimento original esta opção reproduz, no nutriente que ancora o
 * grupo.
 *
 * Mostra equivalência, não desvio: "97%" e "104%" se leem direto, enquanto
 * "−3,0%" e "+4,0%" pedem tradução — e a direção continua legível, porque o
 * número fica acima ou abaixo de 100.
 *
 * O desvio existe porque a quantidade é arredondada para a medida caseira
 * antes de ser comparada: prescrever "1,5 colher" e aceitar 97% é melhor do
 * que prescrever "1,47 colher" e cravar 100%.
 */
export default function SeloEquivalencia({ desvio }) {
  if (desvio === null || desvio === undefined || !Number.isFinite(desvio)) {
    return <span className="pp-selo-equiv pp-selo-equiv--sem">sem equivalência</span>;
  }

  // Arredondar antes de decidir as casas: 100.00000001 % 1 nao e zero, e o
  // selo escrevia "100,0%" onde cabia "100%".
  const pct = Math.round((1 + desvio) * 1000) / 10;
  const distancia = Math.abs(desvio);
  // A cor apenas reforça; o número já diz tudo sozinho.
  const tom = distancia <= 0.02 ? 'exata' : distancia <= 0.05 ? 'boa' : 'limite';

  return (
    <span
      className={`pp-selo-equiv pp-selo-equiv--${tom}`}
      title={`Reproduz ${n(pct, Number.isInteger(pct) ? 0 : 1)}% do nutriente âncora do alimento original`}
    >
      {n(pct, Number.isInteger(pct) ? 0 : 1)}%
    </span>
  );
}
