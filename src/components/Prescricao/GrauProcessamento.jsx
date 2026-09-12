import React from 'react';
import { n } from './formato.js';

/** Cores dos grupos NOVA: do verde da liga ao terra, sem semáforo. */
const COR_NOVA = ['#5C9150', '#8FBF83', '#C9A24A', '#B0724A'];
const COR_SEM = 'rgba(29, 51, 80, 0.18)';

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
      <div className="rounded-xl border border-stone-200 bg-white px-4 py-3">
        <p className="text-sm text-stone-900">Grau de processamento</p>
        <p className="mt-1 text-xs text-stone-400">Sem alimentos no plano.</p>
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
    <div className="rounded-xl border border-stone-200 bg-white px-4 py-3">
      <p className="mb-2 text-sm text-stone-900">Grau de processamento</p>

      <div className="flex h-5 overflow-hidden rounded" role="img"
        aria-label={faixas.map((f) => `${f.rotulo} ${n(f.pct, 1)}%`).join(', ')}>
        {faixas.map((f) => (
          <div key={f.grupo} style={{ width: `${f.pct}%`, background: f.cor }} title={`${f.rotulo}: ${n(f.pct, 1)}%`} />
        ))}
      </div>

      <ul className="mt-1.5">
        {faixas.map((f) => (
          <li key={f.grupo} className="flex items-center gap-2 py-0.5 text-xs">
            <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: f.cor }} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-stone-600">{f.rotulo}</span>
            <span className="shrink-0 whitespace-nowrap text-stone-500">
              {n(f.kcal)} kcal · {n(f.pct, 1)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
