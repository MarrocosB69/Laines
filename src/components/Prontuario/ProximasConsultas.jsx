import React from 'react';
import { Clock, Download, History, PlusCircle } from 'lucide-react';

const ProximasConsultas = ({
  continuityItems = [],
  canCreateActions = false,
  canExport = false,
  onOpenAppointmentModal,
  onCreateEvaluation,
  onOpenHistory,
  onExportCsv
}) => (
  <section className="pron-card pron-panel">
    <header className="pron-panel-header">
      <div>
        <h2>Próximos Passos</h2>
        <p>Itens de continuidade clínica para acompanhamento.</p>
      </div>
    </header>

    <div className="pron-continuity-list">
      {continuityItems.map((item) => (
        <article key={item.id} className={`pron-continuity-item level-${item.level || 'medio'}`}>
          <strong>{item.title}</strong>
          <p>{item.description}</p>
        </article>
      ))}
    </div>

    <div className="pron-inline-actions">
      {canCreateActions ? (
        <button type="button" className="pron-btn pron-btn-secondary" onClick={onOpenAppointmentModal}>
          <Clock size={14} />
          Nova consulta
        </button>
      ) : null}
      {canCreateActions ? (
        <button type="button" className="pron-btn pron-btn-secondary" onClick={onCreateEvaluation}>
          <PlusCircle size={14} />
          Abrir avaliações
        </button>
      ) : null}
      <button type="button" className="pron-btn pron-btn-secondary" onClick={onOpenHistory}>
        <History size={14} />
        Histórico
      </button>
      <button
        type="button"
        className="pron-btn pron-btn-secondary"
        onClick={onExportCsv}
        disabled={!canExport}
      >
        <Download size={14} />
        Exportar CSV
      </button>
    </div>
  </section>
);

export default ProximasConsultas;

