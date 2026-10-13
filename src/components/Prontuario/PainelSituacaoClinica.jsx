import React from 'react';
import { Activity, History, PlusCircle } from 'lucide-react';

// Um indicador em zero nao e informacao, e espaco ocupado: no prontuario
// medido, 5 dos 8 mostravam zero e ainda assim a coluna tomava 29% da largura.
// No modo faixa so aparecem os que dizem algo, com o resto resumido no fim.
const ehZero = (valor) => /^0(\s|$)/.test(String(valor || '').trim());
const chamaAtencao = (tom) => tom === 'warning' || tom === 'attention';

const PainelSituacaoClinica = ({
  prontuarioSignals = [],
  pendingModulesSummary = '',
  canCreateEvaluation = false,
  onCreateEvaluation,
  onOpenHistory,
  faixa = false
}) => faixa ? (
  <div className="pron-faixa-clinica" aria-label="Situação clínica">
    {prontuarioSignals
      .filter((s) => chamaAtencao(s.tone) || !ehZero(s.value))
      .map((signal) => (
        <span key={signal.id} className={`pron-faixa-clinica__item tone-${signal.tone || 'neutral'}`}>
          <strong>{signal.value}</strong>
          <span>{String(signal.label || '').toLowerCase()}</span>
        </span>
      ))}
    {(() => {
      const zeros = prontuarioSignals.filter((s) => !chamaAtencao(s.tone) && ehZero(s.value)).length;
      return zeros > 0 ? (
        <span className="pron-faixa-clinica__resto">
          +{zeros} {zeros === 1 ? 'indicador' : 'indicadores'} em zero
        </span>
      ) : null;
    })()}
  </div>
) : (
  <section className="pron-card pron-panel">
    <header className="pron-panel-header">
      <div className="pron-panel-header__title-row">
        <span className="pron-panel-header__icon" aria-hidden="true">
          <Activity size={15} strokeWidth={1.8} />
        </span>
        <div>
          <h2>Situação clínica</h2>
          <p>Indicadores rápidos de acompanhamento.</p>
        </div>
      </div>
    </header>

    <div className="pron-signal-grid">
      {prontuarioSignals.map((signal) => (
        <article key={signal.id} className={`pron-signal-card tone-${signal.tone || 'neutral'}`}>
          <div className="pron-signal-card__header">
            {signal.Icon && <signal.Icon size={13} className="pron-signal-card__icon" aria-hidden="true" />}
            <span>{signal.label}</span>
          </div>
          <strong>{signal.value}</strong>
        </article>
      ))}
    </div>

    {pendingModulesSummary && (
      <div className="pron-pending-badge">
        <span className="pron-pending-badge__dot" aria-hidden="true" />
        <span className="pron-pending-badge__label">Pendências:</span>
        <span className="pron-pending-badge__value">{pendingModulesSummary}</span>
      </div>
    )}

    <div className="pron-inline-actions">
      {canCreateEvaluation && (
        <button type="button" className="pron-btn pron-btn-secondary" onClick={onCreateEvaluation}>
          <PlusCircle size={14} />
          Abrir avaliações
        </button>
      )}
      <button type="button" className="pron-btn pron-btn-secondary" onClick={onOpenHistory}>
        <History size={14} />
        Histórico
      </button>
    </div>
  </section>
);

export default PainelSituacaoClinica;
