import React from 'react';
import { Activity, Apple, Calendar, Droplets, Dumbbell, Users, TrendingUp } from 'lucide-react';
import { getEvaluationTypeLabel } from '../../components/shared/evaluationSummaryUtils';
import { Skeleton } from '../../components/ui';
import AthleteMealPlan from './AthleteMealPlan';

const normalizeType = (value) =>
  String(value || '').trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '_');

function DomainPanel({ icon: Icon, title, domain, empty, children }) {
  return (
    <div className={`ap-domain-panel${domain ? ` ap-domain-panel--${domain}` : ''}`}>
      <h3 className="ap-domain-panel__header">
        <Icon size={14} />
        <span>{title}</span>
      </h3>
      {empty
        ? <p className="ap-domain-panel__empty">A equipe ainda não realizou esta avaliação.</p>
        : <div className="ap-domain-panel__body">{children}</div>
      }
    </div>
  );
}

function DomainStat({ label, value, delta, deltaInverse }) {
  const tone = delta === null || delta === undefined ? null
    : (deltaInverse ? delta < 0 : delta > 0) ? 'ok'
    : (deltaInverse ? delta > 0 : delta < 0) ? 'warn'
    : null;
  return (
    <div className="ap-domain-stat">
      <span>{label}</span>
      <strong>
        {value}
        {delta !== null && delta !== undefined && (
          <span className={`ap-trend${tone ? ` ap-trend--${tone}` : ''}`}>
            {delta > 0 ? '+' : ''}{delta}
          </span>
        )}
      </strong>
    </div>
  );
}

function DomainStatus({ aguardando, revisado }) {
  if (aguardando) return <p className="ap-domain-panel__waiting">Seu relato está aguardando revisão</p>;
  if (revisado) return <p className="ap-domain-panel__ok">Revisado pela equipe</p>;
  return null;
}

// O tom da situação é classe de AthletePortal.css (.ap-timeline-item__status--*);
// o texto já diz a situação, a cor só repete.
const TIMELINE_STATUS = {
  rascunho: { label: 'Enviado', tone: 'info' },
  concluida: { label: 'Concluída', tone: 'ok' },
  default: { label: 'Registrada', tone: 'neutro' },
};

const resolveTimelineStatus = (ev) => {
  if (ev?.revisadoEm) return { label: 'Revisado', tone: 'ok' };
  const aguardando = Boolean(ev?.meta?.aguardandoRevisao);
  if (aguardando) return { label: 'Aguardando revisão', tone: 'info' };
  const s = String(ev?.status || '').toLowerCase();
  if (['finalizada', 'concluida', 'concluido'].includes(s)) return TIMELINE_STATUS.concluida;
  if (s === 'rascunho') return TIMELINE_STATUS.rascunho;
  return TIMELINE_STATUS.default;
};

const APPOINTMENT_TYPE_LABELS = {
  primeira_consulta: 'Primeira consulta',
  retorno: 'Retorno'
};

const AthleteTabAcompanhamento = ({
  patient,
  evaluationsSorted,
  upcomingAppointments,
  composicaoPanel,
  hidratacaoPanel,
  alimentacaoPanel,
  treinoPanel,
  loadingDetails,
  formatDate,
}) => {
  if (!patient) return null;

  const selfEvals = evaluationsSorted.filter(
    (ev) => ev?.meta?.atletaSelfReport || ev?.meta?.origemPreenchimento === 'atleta'
  );

  // Ponto por tipo de avaliação: só gráfico, o tipo vem escrito ao lado.
  const EVAL_TYPE_DOTS = {
    alimentar: 'alimentar',
    hidratacao: 'hidratacao',
    carga_treino: 'treino',
    fisioterapia: 'fisioterapia',
  };

  return (
    <div className="ap-tab-body">

      <AthleteMealPlan key={patient.id} patientId={patient.id} />

      {upcomingAppointments.length > 0 && (
        <section className="ap-card">
          <h2 className="ap-card__header">
            <Calendar size={16} /><span>Próximas consultas</span>
          </h2>
          <div className="ap-timeline">
            {upcomingAppointments.map((appt) => (
              <div key={appt.id} className="ap-timeline-item">
                <div className="ap-timeline-item__date">
                  {formatDate(appt.dateObj)}
                </div>
                <div className="ap-timeline-item__content">
                  <strong>
                    {APPOINTMENT_TYPE_LABELS[String(appt.appointmentType || '').toLowerCase()]
                      || 'Consulta'}
                  </strong>
                  <span className="ap-timeline-item__status--ok">Agendada {appt.time ? `· ${appt.time}` : ''}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="ap-card ap-card--full">
        <h2 className="ap-card__header">
          <TrendingUp size={16} /><span>Meus auto-relatos</span>
        </h2>
        {loadingDetails ? (
          <Skeleton lines={3} />
        ) : selfEvals.length === 0 ? (
          <p className="athlete-text">Nenhum auto-relato enviado ainda.</p>
        ) : (
          <div className="ap-timeline">
            {selfEvals.map((ev) => {
              const { label, tone } = resolveTimelineStatus(ev);
              const dateVal = ev.dataAvaliacao || ev.createdAt || ev.data;
              const typeKey = normalizeType(ev.tipo);
              const dotTone = EVAL_TYPE_DOTS[typeKey] || 'outro';
              return (
                <div key={ev.id} className="ap-timeline-item">
                  <div className="ap-timeline-item__date">
                    {dateVal ? formatDate(new Date(dateVal)) : '—'}
                  </div>
                  <span className={`ap-timeline-item__dot ap-timeline-item__dot--${dotTone}`} aria-hidden="true" />
                  <div className="ap-timeline-item__content">
                    <strong>{getEvaluationTypeLabel(typeKey)}</strong>
                    <span className={`ap-timeline-item__status--${tone}`}>{label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="ap-card ap-card--full">
        <h2 className="ap-card__header">
          <Activity size={16} /><span>Minha evolução</span>
        </h2>
        <div className="ap-evolution-grid">

          <DomainPanel icon={Activity} title="Composição corporal" domain="body" empty={!composicaoPanel}>
            {composicaoPanel && (
              <>
                {composicaoPanel.peso !== null && (
                  <DomainStat label="Peso" value={`${composicaoPanel.peso} kg`} />
                )}
                {composicaoPanel.percGordura !== null && (
                  <DomainStat
                    label="% Gordura"
                    value={`${composicaoPanel.percGordura}%`}
                    delta={composicaoPanel.deltaPercGordura}
                    deltaInverse
                  />
                )}
                {composicaoPanel.massaMagra !== null && (
                  <DomainStat label="Massa magra" value={`${composicaoPanel.massaMagra} kg`} />
                )}
                <p className="ap-domain-panel__date">Última: {composicaoPanel.dateLabel}</p>
              </>
            )}
          </DomainPanel>

          <DomainPanel icon={Droplets} title="Hidratação" domain="hydration" empty={!hidratacaoPanel}>
            {hidratacaoPanel && (
              <>
                {hidratacaoPanel.status !== 'sem_dado' && (
                  <div className={`ap-domain-badge ap-domain-badge--${hidratacaoPanel.status}`}>
                    {hidratacaoPanel.statusLabel}
                  </div>
                )}
                {hidratacaoPanel.perda !== null && (
                  <DomainStat label="Perda de peso" value={`${hidratacaoPanel.perda}%`} />
                )}
                {hidratacaoPanel.sedePercebida !== null && (
                  <DomainStat label="Sede percebida" value={`${hidratacaoPanel.sedePercebida}/10`} />
                )}
                <DomainStatus aguardando={hidratacaoPanel.aguardando} revisado={hidratacaoPanel.revisado} />
                <p className="ap-domain-panel__date">Última: {hidratacaoPanel.dateLabel}</p>
              </>
            )}
          </DomainPanel>

          <DomainPanel icon={Apple} title="Alimentação" domain="nutrition" empty={!alimentacaoPanel}>
            {alimentacaoPanel && (
              <>
                {alimentacaoPanel.adesao !== null && (
                  <DomainStat label="Adesão ao plano" value={`${alimentacaoPanel.adesao}/10`} />
                )}
                <DomainStatus aguardando={alimentacaoPanel.aguardando} revisado={alimentacaoPanel.revisado} />
                <p className="ap-domain-panel__date">Última: {alimentacaoPanel.dateLabel}</p>
              </>
            )}
          </DomainPanel>

          <DomainPanel icon={Dumbbell} title="Treino" domain="training" empty={!treinoPanel}>
            {treinoPanel && (
              <>
                {treinoPanel.faseLabel && (
                  <DomainStat label="Fase" value={treinoPanel.faseLabel} />
                )}
                {treinoPanel.carga !== null && (
                  <DomainStat label="Carga semanal" value={`${treinoPanel.carga} UA`} />
                )}
                {treinoPanel.rpe !== null && (
                  <DomainStat label="RPE médio" value={`${treinoPanel.rpe}/10`} />
                )}
                <DomainStatus aguardando={treinoPanel.aguardando} revisado={treinoPanel.revisado} />
                <p className="ap-domain-panel__date">Última: {treinoPanel.dateLabel}</p>
              </>
            )}
          </DomainPanel>

        </div>
      </section>

      {(patient?.alunoResponsavelNome || patient?.professorSupervisorNome || patient?.projetoNome) && (
        <section className="ap-card">
          <h2 className="ap-card__header">
            <Users size={16} /><span>Minha equipe</span>
          </h2>
          <div className="athlete-prontuario-grid">
            {patient.projetoNome && (
              <div className="athlete-prontuario-item">
                <span>Projeto</span>
                <strong>{patient.projetoNome}</strong>
              </div>
            )}
            {patient.alunoResponsavelNome && (
              <div className="athlete-prontuario-item">
                <span>Aluno responsável</span>
                <strong>{patient.alunoResponsavelNome}</strong>
              </div>
            )}
            {patient.professorSupervisorNome && (
              <div className="athlete-prontuario-item">
                <span>Professor supervisor</span>
                <strong>{patient.professorSupervisorNome}</strong>
              </div>
            )}
          </div>
        </section>
      )}

    </div>
  );
};

export default AthleteTabAcompanhamento;
