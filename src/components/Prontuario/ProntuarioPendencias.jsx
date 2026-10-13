import React from 'react';
import { CalendarClock, CheckCircle2, Circle } from 'lucide-react';
import { FeedbackState } from '../ui';

const ProntuarioPendencias = ({
  pendenciasExternas = [], loading = false, error = '', applicabilityNote = '',
  onOpenEvaluationType, onOpenAppointment, onReview,
}) => (
  <section className="pron-card pron-panel">
    <header className="pron-panel-header">
      <div><h2>Pendências do atendimento</h2><p>{!loading && !error && `${pendenciasExternas.length} tarefas do fluxo atual. `}Instrumentos opcionais e não aplicáveis ao caso não contam como atraso.</p></div>
    </header>
    {loading ? <p className="pron-estado" role="status">Carregando o atendimento…</p> : error ? <p className="pron-estado pron-estado--falha" role="alert">{error}</p> : pendenciasExternas.length === 0 ? (
      <FeedbackState empty icon={CheckCircle2} size="sm" title="Nenhuma tarefa indicada pelo fluxo atual." />
    ) : (
      <div className="pron-pendencias-list">
        {pendenciasExternas.map((item) => (
          <article key={item.id} className={`pron-pendencia-item severity-${item.severidade}`}>
            <div><div className="pron-title-inline">{item.tipo === 'sem_consulta' ? <CalendarClock size={16} aria-hidden="true" /> : <Circle size={16} aria-hidden="true" />}<span>{item.mensagem}</span></div><small>{item.detalhe}</small></div>
            {item.actionable && <button type="button" className="pron-link-btn" aria-label={`${item.acao.label} ${item.mensagem}`} onClick={() => {
              if (item.tipo === 'sem_consulta') onOpenAppointment?.();
              else if (item.tipo === 'revisao') onReview?.(item);
              else onOpenEvaluationType?.(item.itemTipo, item.avaliacaoId);
            }}>{item.acao.label}</button>}
          </article>
        ))}
      </div>
    )}
    {!loading && !error && applicabilityNote && <p className="pron-text-secondary">{applicabilityNote}</p>}
  </section>
);

export default ProntuarioPendencias;
