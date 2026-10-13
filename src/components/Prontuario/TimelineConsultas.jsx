import React from 'react';
import { Download, Loader2, RefreshCcw } from 'lucide-react';
import { FeedbackState, Skeleton } from '../ui';

const TimelineConsultas = ({
  consultationHistory = [],
  consultationStatusSummary = {},
  consultationStatusOptions = [],
  filteredConsultationHistory = [],
  visibleConsultationHistory = [],
  consultationStatusFilter = 'all',
  consultationTypeFilter = 'all',
  consultationPeriodFilter = 'all',
  consultationSearch = '',
  hasConsultationFiltersApplied = false,
  consultationHasMore = false,
  loadingAppointments = false,
  isRefreshingAppointments = false,
  appointmentsError = '',
  appointmentsSyncLabel = '',
  formatDate,
  getAppointmentTypeLabel,
  getAppointmentStatusLabel,
  onChangeStatusFilter,
  onChangeTypeFilter,
  onChangePeriodFilter,
  onChangeSearch,
  onClearFilters,
  onRefresh,
  onExportCsv,
  onLoadMore,
  onRetryLoad
}) => (
  <section className="pron-card pron-panel">
    <header className="pron-panel-header">
      <div>
        <h2>Consultas</h2>
        <p>Linha do tempo de agendamentos e atendimentos.</p>
      </div>
      <div className="pron-inline-actions">
        <span className="pron-text-muted">{filteredConsultationHistory.length} registros</span>
        <button
          type="button"
          className="pron-btn pron-btn-secondary"
          onClick={onRefresh}
          disabled={loadingAppointments || isRefreshingAppointments}
        >
          {isRefreshingAppointments ? <Loader2 size={16} className="spin" aria-hidden="true" /> : <RefreshCcw size={16} aria-hidden="true" />}
          {isRefreshingAppointments ? 'Atualizando...' : 'Atualizar'}
        </button>
        <button
          type="button"
          className="pron-btn pron-btn-secondary"
          onClick={onExportCsv}
          disabled={filteredConsultationHistory.length === 0 || loadingAppointments}
        >
          <Download size={16} aria-hidden="true" />
          Exportar CSV
        </button>
      </div>
    </header>

    <div className="pron-consultation-summary">
      <span><strong>{consultationHistory.length}</strong> total</span>
      <span><strong>{consultationStatusSummary.agendada || 0}</strong> agendadas</span>
      <span><strong>{consultationStatusSummary.realizada || 0}</strong> realizadas</span>
      <span><strong>{consultationStatusSummary.remarcada || 0}</strong> remarcadas</span>
      <span><strong>{consultationStatusSummary.falta || 0}</strong> faltas</span>
    </div>

    <div className="pron-filters-grid">
      <select
        value={consultationStatusFilter}
        onChange={(event) => onChangeStatusFilter?.(event.target.value)}
        aria-label="Filtrar consultas por status"
      >
        <option value="all">Todos os status</option>
        {consultationStatusOptions.map((status) => (
          <option key={status} value={status}>
            {getAppointmentStatusLabel(status)}
          </option>
        ))}
      </select>
      <select
        value={consultationTypeFilter}
        onChange={(event) => onChangeTypeFilter?.(event.target.value)}
        aria-label="Filtrar consultas por tipo"
      >
        <option value="all">Todos os tipos</option>
        <option value="primeira_consulta">Primeira consulta</option>
        <option value="retorno">Retorno</option>
      </select>
      <select
        value={consultationPeriodFilter}
        onChange={(event) => onChangePeriodFilter?.(event.target.value)}
        aria-label="Filtrar consultas por período"
      >
        <option value="all">Todos os períodos</option>
        <option value="future">Futuras</option>
        <option value="past">Passadas</option>
      </select>
      <input
        type="text"
        value={consultationSearch}
        onChange={(event) => onChangeSearch?.(event.target.value)}
        placeholder="Buscar por profissional, tipo ou status..."
        aria-label="Buscar no histórico de consultas"
      />
      <button
        type="button"
        className="pron-btn pron-btn-secondary"
        onClick={onClearFilters}
        disabled={!hasConsultationFiltersApplied}
      >
        Limpar
      </button>
    </div>

    <div className="pron-inline-status" role="status" aria-live="polite">
      <span>{filteredConsultationHistory.length} de {consultationHistory.length} {consultationHistory.length === 1 ? 'consulta exibida' : 'consultas exibidas'}</span>
      {hasConsultationFiltersApplied ? (
        <span>Filtros aplicados sobre o histórico completo.</span>
      ) : null}
      <span>{appointmentsSyncLabel}</span>
    </div>

    {loadingAppointments ? (
      <Skeleton lines={4} />
    ) : appointmentsError ? (
      <div className="pron-error-block">
        <p role="alert">{appointmentsError}</p>
        <button type="button" className="pron-btn pron-btn-secondary" onClick={onRetryLoad}>
          Recarregar
        </button>
      </div>
    ) : filteredConsultationHistory.length === 0 ? (
      <FeedbackState
        empty
        size="sm"
        title={hasConsultationFiltersApplied
          ? 'Nenhuma consulta encontrada com os filtros aplicados.'
          : 'Nenhuma consulta registrada para este atleta.'}
      />
    ) : (
      <ol className="timeline">
        {visibleConsultationHistory.map((item) => (
          <li key={item.id} className="timeline-item">
            <div className="timeline-dot" aria-hidden="true" />
            <div className="timeline-item-head">
              <strong>{item.scheduledDate ? formatDate(item.scheduledDate) : '—'}</strong>
              <span className={`pron-badge status-${item.normalizedStatus || 'agendada'}`}>
                {getAppointmentStatusLabel(item.normalizedStatus)}
              </span>
            </div>
            <p className="pron-text-secondary">
              {getAppointmentTypeLabel(item)} · {item.time || '--:--'}
            </p>
            <p className="pron-text-secondary">
              {item.professionalName || 'Profissional não informado'}
            </p>
          </li>
        ))}
      </ol>
    )}

    {consultationHasMore ? (
      <div className="pron-panel-footer">
        <button type="button" className="pron-btn pron-btn-secondary" onClick={onLoadMore}>
          Carregar mais consultas
        </button>
      </div>
    ) : null}
  </section>
);

export default TimelineConsultas;
