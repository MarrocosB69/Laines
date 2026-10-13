import React, { useEffect, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import api, { getApiErrorMessage } from '../../../../services/api';
import { subscribeRealtimeEvent } from '../../../../services/realtime';
import { downloadBlobFile, getFilenameFromDisposition } from '../utils/exportUtils';
import './TaskPerformancePanel.css';

const RANGE_OPTIONS = [
  { value: 'week', label: 'Últimos 7 dias' },
  { value: 'month', label: 'Mês atual' },
  { value: 'quarter', label: 'Trimestre atual' },
  { value: 'year', label: 'Ano atual' }
];

const formatCivilDate = (value) => {
  const [year, month, day] = String(value || '').split('-');
  return year && month && day ? `${day}/${month}/${year}` : '—';
};

const formatRate = (value) => (
  Number.isFinite(value) ? `${Number(value).toLocaleString('pt-BR')}%` : '—'
);

const groupMetrics = [
  { key: 'completedOnTime', label: 'No prazo' },
  { key: 'completedLate', label: 'Em atraso' },
  { key: 'openOverdue', label: 'Abertas vencidas' },
  { key: 'openOnTime', label: 'Abertas no prazo' },
  { key: 'archivedUnfinished', label: 'Arquivadas sem entrega' },
  { key: 'noDue', label: 'Sem prazo' }
];

const TaskPerformancePanel = () => {
  const [range, setRange] = useState('month');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    api.get('/tarefas/relatorio', { params: { range }, signal: controller.signal })
      .then(({ data }) => setReport(data))
      .catch((requestError) => {
        if (!controller.signal.aborted) {
          setReport(null);
          setError(getApiErrorMessage(requestError, 'Não foi possível carregar o desempenho das tarefas.'));
        }
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [range, reloadKey]);

  useEffect(() => {
    let refreshTimer;
    const scheduleRefresh = () => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => setReloadKey((value) => value + 1), 150);
    };
    const unsubscribers = ['tarefas.created', 'tarefas.updated', 'tarefas.deleted']
      .map((eventName) => subscribeRealtimeEvent(eventName, scheduleRefresh));
    return () => {
      window.clearTimeout(refreshTimer);
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, []);

  const exportReport = async (format) => {
    if (exporting) return;
    setExporting(true);
    setError('');
    try {
      const response = await api.get('/tarefas/relatorio/export', {
        params: { range, format }, responseType: 'blob'
      });
      const fallback = `tarefas-diretorias-${range}.${format}`;
      const filename = getFilenameFromDisposition(response.headers?.['content-disposition'], fallback);
      downloadBlobFile(response.data, filename);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Não foi possível exportar o relatório de tarefas.'));
    } finally {
      setExporting(false);
    }
  };

  const totals = report?.totals;
  const groups = Array.isArray(report?.groups)
    ? report.groups.filter((group) => Number(group.due || 0) + Number(group.noDue || 0) > 0)
    : [];

  return (
    <section className="reports-section reports-tasks-section" aria-labelledby="task-report-title">
      <header className="reports-section-header task-report-header">
        <div className="task-report-intro">
          <h3 id="task-report-title">Tarefas por diretoria</h3>
          <p>Entregas da equipe e cumprimento dos prazos, sem dados clínicos.</p>
        </div>
        <div className="task-report-controls">
          <label htmlFor="task-report-range">Período das tarefas</label>
          <div className="task-report-control-row">
            <select id="task-report-range" value={range} onChange={(event) => setRange(event.target.value)}>
              {RANGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setReloadKey((value) => value + 1)}
              disabled={loading}
              aria-label="Atualizar relatório de tarefas"
            >
              <RefreshCw size={16} aria-hidden="true" /> Atualizar
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div className="task-report-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setReloadKey((value) => value + 1)}>Tentar novamente</button>
        </div>
      )}

      <div className="task-report-content" aria-busy={loading}>
        {loading ? (
          <div className="reports-empty-state" role="status">Carregando desempenho das tarefas…</div>
        ) : !report ? (
          !error && <div className="reports-empty-state">Relatório indisponível.</div>
        ) : (
          <>
            <div className="task-report-overview">
              <div className="task-report-rate">
                <span>Pontualidade das entregas</span>
                <strong>{formatRate(totals?.punctualityRate)}</strong>
                <small>{totals?.completedOnTime || 0} no prazo de {(totals?.completedOnTime || 0) + (totals?.completedLate || 0)} entregas</small>
              </div>
              <p>
                <strong className="task-report-due-count">{totals?.due || 0}</strong> tarefas com prazo de {formatCivilDate(report.period?.startDate)} a {formatCivilDate(report.period?.endDate)}.
                {' '}{totals?.noDue || 0} antigas sem prazo, separadas da taxa.
              </p>
            </div>
            {groups.length === 0 ? (
              <div className="reports-empty-state">Nenhuma tarefa neste período.</div>
            ) : (
              <ul className="task-report-groups" aria-label="Desempenho por equipe">
                {groups.map((group) => (
                  <li key={group.key} className="task-report-group">
                    <div className="task-report-group-heading">
                      <strong>{group.label}</strong>
                      <span>{formatRate(group.punctualityRate)} no prazo · {group.due} com prazo</span>
                    </div>
                    <dl>
                      {groupMetrics.map((metric) => (
                        <div key={metric.key}>
                          <dt>{metric.label}</dt>
                          <dd>{group[metric.key] || 0}</dd>
                        </div>
                      ))}
                    </dl>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
      {report && !loading && (
        <div className="task-report-footer">
          <div className="task-report-method">
            <p>O período considera o vencimento; tarefas sem prazo entram pela data de criação.</p>
            <p>Taxa: entregues no prazo ÷ entregas com data confirmada. Abertas vencidas aparecem à parte.</p>
            {Number(totals?.unverifiedCompletion || 0) > 0 && (
              <p>{totals.unverifiedCompletion} conclusão sem data comprovada fora da taxa.</p>
            )}
            {Number(totals?.archivedUnfinished || 0) > 0 && (
              <p>{totals.archivedUnfinished} tarefa arquivada sem entrega, separada das abertas.</p>
            )}
            <small>
              Atualizado em{' '}
              <time dateTime={report.generatedAt}>
                {new Date(report.generatedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
              </time>
            </small>
          </div>
          <div className="task-report-exports" aria-label="Exportar relatório de tarefas">
            <button type="button" onClick={() => exportReport('csv')} disabled={exporting}>
              <Download size={16} aria-hidden="true" /> CSV
            </button>
            <button type="button" onClick={() => exportReport('json')} disabled={exporting}>
              <Download size={16} aria-hidden="true" /> JSON
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

export default TaskPerformancePanel;
