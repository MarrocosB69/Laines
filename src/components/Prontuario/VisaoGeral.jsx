import React from 'react';
import { ArrowRight, FileText, Paperclip } from 'lucide-react';
import { FeedbackState } from '../ui';
import { getEvaluationTypeLabel } from '../shared/evaluationSummaryUtils';
import { clinicalDate } from './prontuarioOverview';

const CATEGORIES = { obrigatoria: 'Obrigatória no atendimento atual', solicitada: 'Solicitada na consulta', opcional: 'Opcional', nao_aplicavel: 'Não aplicável' };
const formatNumber = (value) => Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 1 });

const VisaoGeral = ({
  snapshot, overview, formatDate, summaryNote = '', planError = '', planLoading = false, loading = false, error = '',
  onOpenEvaluationType, onOpenTab, onOpenAppointment, editableTypes = new Set(), avaliacoes = [],
}) => {
  const { metrics = [], eligible = [] } = snapshot;
  const changes = metrics.filter((metric) => metric.previous);
  const plan = overview.activePlan;
  const priorityTasks = (overview.tasks || []).slice(0, 2);
  const formatPlanDate = (value) => formatDate(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : value);
  return (
    <div className="vg-overview">
      {priorityTasks.length > 0 && (
        <section className="pron-card pron-panel vg-priorities" aria-labelledby="vg-priorities-title">
          <header className="pron-panel-header">
            <div>
              <h2 id="vg-priorities-title">Prioridades do atendimento</h2>
              <p>As primeiras ações do fluxo atual, em ordem de relevância.</p>
            </div>
            <button type="button" className="pron-link-btn" onClick={() => onOpenTab('pendencias')}>
              Ver todas as pendências
            </button>
          </header>
          <ul className="vg-priorities__list">
            {priorityTasks.map((task) => (
              <li key={task.id} className="vg-priorities__item">
                <div>
                  <strong>{task.mensagem}</strong>
                  <span>{task.detalhe}</span>
                </div>
                {task.actionable && task.tipo === 'avaliacao' && (
                  <button
                    type="button"
                    className="pron-link-btn"
                    onClick={() => onOpenEvaluationType(task.itemTipo, task.avaliacaoId)}
                    aria-label={`${task.acao?.label || 'Abrir'} ${task.mensagem}`}
                  >
                    {task.acao?.label || 'Abrir'} <ArrowRight size={15} aria-hidden="true" />
                  </button>
                )}
                {task.actionable && task.tipo === 'revisao' && (
                  <button type="button" className="pron-link-btn" onClick={() => onOpenTab('dados-clinicos')} aria-label={`Revisar ${task.mensagem}`}>
                    Revisar <ArrowRight size={15} aria-hidden="true" />
                  </button>
                )}
                {task.actionable && task.tipo === 'sem_consulta' && (
                  <button type="button" className="pron-link-btn" onClick={onOpenAppointment}>
                    Marcar retorno <ArrowRight size={15} aria-hidden="true" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="pron-card pron-panel">
        <header className="pron-panel-header"><div><h2>Síntese do atendimento</h2><p>Últimos registros finalizados, sem revisão pendente, deste paciente.</p></div></header>
        {loading ? <p className="pron-estado" role="status">Carregando a síntese clínica…</p> : error ? <p className="pron-estado pron-estado--falha" role="alert">{error}</p> : (
          <>
            {metrics.length ? (
              <dl className="vg-snapshot">
                {metrics.map((metric) => (
                  <div key={metric.id} className="vg-snapshot__metric">
                    <dt>{metric.label}</dt>
                    <dd><strong>{formatNumber(metric.value)}</strong> {metric.unit}</dd>
                    <dd className="vg-snapshot__origem">{getEvaluationTypeLabel(metric.item.tipo)} · {formatDate(new Date(clinicalDate(metric.item)))}</dd>
                  </div>
                ))}
              </dl>
            ) : <FeedbackState empty size="sm" title="Sem medidas elegíveis para a síntese." />}
            <div className="vg-care-summary">
              <div>
                <h3>Conduta vigente</h3>
                {planLoading ? <p className="pron-estado" role="status">Consultando a conduta vigente…</p> : planError ? <p className="pron-estado pron-estado--falha" role="alert">{planError}</p> : plan ? (
                  <>
                    <p><strong>Plano alimentar ativo</strong>{plan.faseAtual ? ` · ${plan.faseAtual}` : ''}</p>
                    <p>Desde {formatPlanDate(plan.dataInicio)}{plan.dataFim ? ` · Até ${formatPlanDate(plan.dataFim)}` : ''}</p>
                    {plan.metaCalorica != null && <p>Meta prescrita: {formatNumber(plan.metaCalorica)} kcal/dia.</p>}
                  </>
                ) : <p>Nenhum plano alimentar vigente registrado.</p>}
                {summaryNote && <details><summary>Observação clínica registrada</summary><p className="vg-recorded-note">{summaryNote}</p></details>}
              </div>
              <div>
                <h3>O que mudou</h3>
                {changes.length ? (
                  <ul className="vg-changes">
                    {changes.map((metric) => <li key={metric.id}><strong>{metric.label}:</strong> {metric.delta === 0 ? 'sem variação' : `${metric.delta > 0 ? '+' : ''}${formatNumber(metric.delta)} ${metric.deltaUnit || metric.unit}`} desde {formatDate(new Date(clinicalDate(metric.previous.item)))} ({getEvaluationTypeLabel(metric.item.tipo)}).</li>)}
                  </ul>
                ) : <p>Ainda não há duas medidas comparáveis do mesmo instrumento.</p>}
                {overview.appointment && <p>Próxima consulta: <strong>{formatDate(overview.appointment.scheduledAt || overview.appointment.date)}</strong></p>}
              </div>
            </div>
          </>
        )}
      </section>
      <section className="pron-card pron-panel vg-demand-details">
        <details>
          <summary>Instrumentos e resultados completos <span>{overview.moduleStates.length} disponíveis</span></summary>
          <p className="pron-text-secondary">Instrumentos opcionais e não aplicáveis ao caso ficam disponíveis e não contam como atraso. A indicação acompanha a consulta atual.</p>
          <p className="pron-text-secondary">{overview.applicabilityNote}</p>
          <ul className="vg-instruments">
            {overview.moduleStates.map((module) => {
              const existing = avaliacoes.find((item) => item.tipo === module.tipo && !item.deletedAt);
              const canOpen = Boolean(existing) || editableTypes.has(module.tipo);
              return <li key={module.tipo}>
                <div><strong>{module.label}</strong><span>{CATEGORIES[module.category]}{module.complete ? ' · Registro finalizado' : existing ? ' · Histórico disponível' : ' · Sem registro'}</span></div>
                {canOpen && <button type="button" className="pron-link-btn" onClick={() => onOpenEvaluationType(module.tipo, existing?.id)} aria-label={`${existing ? 'Ver' : 'Abrir'} ${module.label}`}><ArrowRight size={18} aria-hidden="true" /></button>}
              </li>;
            })}
          </ul>
          <p className="pron-text-secondary">{eligible.length} registros elegíveis para a síntese. Rascunhos e envios em revisão permanecem no histórico.</p>
          <button type="button" className="pron-link-btn" onClick={() => onOpenTab('avaliacoes')}><FileText size={15} aria-hidden="true" />Ver histórico e resultados completos</button>
        </details>
        <button type="button" className="pron-link-btn" onClick={() => onOpenTab('anexos')}><Paperclip size={15} aria-hidden="true" />Consultar anexos</button>
      </section>
    </div>
  );
};

export default VisaoGeral;
