import React from 'react';
import { n } from './formato.js';

/**
 * Apresentacional: a situação chega decidida pelo núcleo.
 *
 * A inversão do sódio (passar de 100% é excesso, não conquista) vive em
 * `situacaoAdequacao`; aqui cada situação só vira um tom. A cor nunca carrega
 * sozinha o significado — o valor e o percentual estão sempre na linha.
 *
 * Os tons são tokens (PrescricaoPlano.css): meta atingida em verde, limite e
 * meta não atingida em vermelho, referência populacional em azul — três
 * semânticas, três cores, e o rótulo escrito ao lado de cada uma.
 */
const COR_SITUACAO = {
  'sem-dado': 'var(--pp-raia)',
  ok: 'var(--lt-color-brand-green)',
  atencao: 'var(--pp-atencao-traco)',
  insuficiente: 'var(--lt-color-danger-text)',
  excedido: 'var(--lt-color-danger-text)',
  'referencia-atingida': 'var(--lt-color-brand-blue)',
  'referencia-abaixo': 'var(--pp-atencao-traco)'
};

const ROTULO_SITUACAO = {
  'sem-dado': 'Sem dados suficientes', ok: 'Na faixa', atencao: 'Ajuste',
  insuficiente: 'Abaixo da meta', excedido: 'Acima da meta ou limite',
  'referencia-atingida': 'Referência populacional atingida', 'referencia-abaixo': 'Abaixo da referência populacional'
};

export default function LinhaAdequacao({ linha }) {
  const { percentual, direcao, cobertura: cob, situacao } = linha;
  const parcial = linha.valor !== null && Number.isFinite(cob) && cob < 1;
  const largura = percentual === null ? 0 : Math.min(percentual, 100);
  const cor = COR_SITUACAO[situacao] ?? COR_SITUACAO['sem-dado'];

  return (
    <tr className="pp-adequacao__linha" aria-label={`${linha.rotulo}: ${ROTULO_SITUACAO[situacao] || 'Sem dados suficientes'}${parcial ? ', subtotal conhecido' : ''}`}>
      <th scope="row" className="pp-adequacao__nutriente">
        {linha.rotulo}
        {direcao === 'limite' && <span className="pp-adequacao__limite">limite</span>}
        <span className={`pp-situacao pp-situacao--${situacao}`}>{ROTULO_SITUACAO[situacao]}</span>
      </th>
      <td className="pp-adequacao__valor" data-rotulo={parcial ? 'Subtotal conhecido' : 'Plano'}>
        {n(linha.valor, linha.valor !== null && linha.valor < 20 ? 1 : 0)} {linha.unidade}{parcial && <span aria-hidden="true"> *</span>}
      </td>
      <td className="pp-adequacao__referencia" data-rotulo="Referência">
        {n(linha.referencia, linha.referencia < 20 ? 1 : 0)}
        {linha.tipo !== 'meta' && <span className="pp-adequacao__tipo">{linha.tipo}</span>}
      </td>
      <td className="pp-adequacao__proporcao">
        <span className="pp-adequacao__trilho">
          <span className="adequacao-barra pp-adequacao__barra" style={{ width: `${largura}%`, background: cor }} />
        </span>
        <span className="pp-adequacao__pct">{n(percentual, 0)}{percentual !== null ? '%' : ''}</span>
      </td>
      <td className="pp-adequacao__cobertura" data-rotulo="Cobert.">
        {Number.isFinite(cob) && cob < 1 ? `${Math.min(99, Math.round(cob * 100))}%` : ''}
      </td>
    </tr>
  );
}
