import React from 'react';
import { AlertTriangle, Apple, Calendar, CheckCircle2, ClipboardList, Droplets, Dumbbell, HeartPulse, RefreshCw } from 'lucide-react';
import { Skeleton } from '../../components/ui';

const FORM_ICONS = {
  alimentar: Apple,
  hidratacao: Droplets,
  carga_treino: Dumbbell,
  fisioterapia: HeartPulse,
};

const APPOINTMENT_STATUS_LABELS = {
  agendada: 'Agendada',
  realizada: 'Realizada',
  remarcada: 'Remarcada',
  falta: 'Falta'
};

// O mesmo rótulo de nível que a Visão geral escreve (AthleteVisaoGeral.jsx,
// NIVEL_ROTULO): a cor do tom nunca carrega o nível sozinha.
const NIVEL_ROTULO = { high: 'Prioritário', medium: 'Pendente', info: 'Informativo' };

const AthleteTabPendencias = ({
  patient,
  pendingItems,
  hasCriticalPending,
  nextAppointment,
  nextAppointmentDeadline,
  canRescheduleNextAppointment,
  loadingDetails,
  isNoShowLoading,
  formatDate,
  getAppointmentTypeLabel,
  onOpenReschedule,
  onMarkNoShow,
  onPendingItemClick,
  onPendingItemKeyDown,
  releasedSelfEvaluationCards = [],
  canSubmitSelfEvaluations = false,
}) => {
  if (!patient) return null;

  return (
    <div className="ap-tab-body">

      <section className="ap-card ap-card--agenda">
        <h2 className="ap-card__header">
          <Calendar size={16} /><span>Próxima consulta</span>
        </h2>
        {loadingDetails ? (
          <Skeleton lines={3} />
        ) : nextAppointment ? (
          <div className="athlete-metric">
            <strong>{formatDate(nextAppointment.dateObj)}</strong>
            <span>
              {nextAppointment.time || '--:--'}
              {' · '}
              {APPOINTMENT_STATUS_LABELS[nextAppointment.statusNorm] || 'Agendada'}
            </span>
            <small>Tipo: {getAppointmentTypeLabel(nextAppointment)}</small>
            <small>{(nextAppointment.evaluations || []).length} avaliação(ões) planejada(s)</small>
            {nextAppointmentDeadline && (
              <small className="athlete-deadline-note">
                Remarcação até {formatDate(nextAppointmentDeadline)}
              </small>
            )}
            <div className="athlete-appointment-actions">
              {canRescheduleNextAppointment ? (
                <button type="button" className="athlete-action-btn" onClick={onOpenReschedule}>
                  <RefreshCw size={14} /><span>Remarcar</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="athlete-action-btn athlete-action-btn--danger"
                  onClick={onMarkNoShow}
                  disabled={isNoShowLoading}
                >
                  <AlertTriangle size={14} />
                  <span>{isNoShowLoading ? 'Registrando...' : 'Avisar ausência'}</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <p className="athlete-text">Sem consultas agendadas.</p>
        )}
      </section>

      <section className="ap-card">
        <h2 className="ap-card__header">
          <ClipboardList size={16} /><span>Formulários disponíveis</span>
        </h2>
        {loadingDetails ? (
          <Skeleton lines={2} />
        ) : releasedSelfEvaluationCards.length === 0 ? (
          <p className="athlete-text">
            Nenhum formulário foi liberado ou solicitado em consulta pela equipe até o momento.
          </p>
        ) : !canSubmitSelfEvaluations ? (
          <div className="ap-forms-gate">
            <AlertTriangle size={14} />
            <span>
              Conclua seu cadastro na aba <strong>Pendências</strong> para preencher os formulários liberados.
            </span>
          </div>
        ) : (
          <div className="athlete-self-forms-grid">
            {releasedSelfEvaluationCards.map((card) => {
              const FormIcon = FORM_ICONS[card.type] || ClipboardList;
              const aguardando = card.latest
                && Boolean(card.latest?.meta?.aguardandoRevisao)
                && !card.latest?.revisadoEm;
              const revisado = Boolean(card.latest?.revisadoEm);
              return (
                <div key={card.type} className="athlete-self-form-item" data-type={card.type}>
                  <div className="athlete-self-form-icon">
                    <FormIcon size={20} />
                  </div>
                  <div className="athlete-self-form-content">
                    <strong>{card.title}</strong>
                    <span>{card.subtitle}</span>
                    {aguardando && <small>Enviado · aguardando revisão</small>}
                    {revisado && <small className="athlete-self-form-content__ok">Revisado pela equipe</small>}
                  </div>
                  <button
                    type="button"
                    className="athlete-action-btn"
                    onClick={() => onPendingItemClick({ action: 'open_form', formType: card.type })}
                  >
                    {card.latest ? 'Atualizar' : 'Preencher'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="ap-card">
        <h2 className="ap-card__header">
          <AlertTriangle size={16} /><span>O que fazer agora</span>
        </h2>
        {loadingDetails ? (
          <Skeleton lines={4} />
        ) : (
          <>
            {!hasCriticalPending && (
              <div className="athlete-empty-inline">
                <CheckCircle2 size={16} />
                <span>
                  Tudo em dia
                  {nextAppointment
                    ? ` — próxima consulta ${formatDate(nextAppointment.dateObj)}`
                    : ''}
                  .
                </span>
              </div>
            )}
            {pendingItems.length > 0 && (
              <div className="athlete-pending-list">
                {pendingItems.map((item) => (
                  <div
                    key={item.id}
                    className={`athlete-pending-item ${item.level}${item.action ? ' athlete-pending-item--action' : ''}`}
                    onClick={item.action ? () => onPendingItemClick(item) : undefined}
                    role={item.action ? 'button' : undefined}
                    tabIndex={item.action ? 0 : undefined}
                    onKeyDown={item.action ? (e) => onPendingItemKeyDown(e, item) : undefined}
                  >
                    <AlertTriangle size={15} />
                    <div>
                      <strong>{item.title}</strong>
                      <span>{item.description}</span>
                      {NIVEL_ROTULO[item.level] && (
                        <small className="athlete-pending-item__nivel">{NIVEL_ROTULO[item.level]}</small>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </section>

    </div>
  );
};

export default AthleteTabPendencias;
