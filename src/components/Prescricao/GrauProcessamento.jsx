import React from 'react';
import { n } from './formato.js';

/** Cores dos grupos NOVA: do verde da liga ao terra, sem semáforo. */
const COR_NOVA = ['#5C9150', '#8FBF83', '#C9A24A', '#B0724A'];
const COR_SEM = 'var(--pp-raia)';

/**
 * Apresentacional: a distribuição já chega calculada.
 *
 * A fatia sem classificação aparece nomeada, não diluída — senão a proporção
 * de ultraprocessados pareceria menor do que se pode afirmar.
 */
export default function GrauProcessamento({ distribuicao }) {
  const { grupos, semClassificacao, total } = distribuicao;

  if (total === 0) {
    return (
      <div className="pp-cartao">
        <h3 className="pp-cartao__titulo">Grau de processamento</h3>
        <p className="pp-cartao__vazio">Sem alimentos no plano.</p>
      </div>
    );
  }

  const faixas = [
    ...grupos.filter((g) => g.pct > 0).map((g) => ({ ...g, cor: COR_NOVA[g.grupo - 1] })),
    ...(semClassificacao.pct > 0
      ? [{ grupo: 0, rotulo: 'Não classificado', ...semClassificacao, cor: COR_SEM }]
      : [])
  ];

  return (
    <div className="pp-cartao">
      <h3 className="pp-cartao__titulo">Grau de processamento</h3>

      <div className="pp-nova__barra" role="img"
        aria-label={faixas.map((f) => `${f.rotulo} ${n(f.pct, 1)}%`).join(', ')}>
        {faixas.map((f) => (
          <div key={f.grupo} style={{ width: `${f.pct}%`, background: f.cor }} title={`${f.rotulo}: ${n(f.pct, 1)}%`} />
        ))}
      </div>

      <ul className="pp-nova__legenda">
        {faixas.map((f) => (
          <li key={f.grupo} className="pp-nova__item">
            <span className="pp-nova__cor" style={{ background: f.cor }} aria-hidden="true" />
            <span className="pp-nova__rotulo">{f.rotulo}</span>
            <span className="pp-nova__valor">
              {n(f.kcal)} kcal · {n(f.pct, 1)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
