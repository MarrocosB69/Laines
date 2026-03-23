import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Calendar, CheckCircle2, ClipboardList, LogOut, RefreshCw, TrendingUp } from 'lucide-react';
import api, { getApiErrorMessage } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { usePacientes } from '../../contexts/PacienteContext';
import { useUiFeedback } from '../../contexts/UiFeedbackContext';
import EvaluationSummaryStrip from '../../components/shared/EvaluationSummaryStrip';
import ClinicalEvaluationResultCard from '../../components/shared/ClinicalEvaluationResultCard';
import {
  getEvaluationStatusLabel,
  getEvaluationTypeLabel
} from '../../components/shared/evaluationSummaryUtils';
import { buildEvaluationResultCollection } from '../../components/shared/evaluationResultAdapter';
import AthleteOnboardingModal from './AthleteOnboardingModal';
import AthleteEbiaModal from './AthleteEbiaModal';
import AppointmentModal from '../Student/Patients/AppointmentModal';
import './AthletePortal.css';

const APPOINTMENT_STATUS_LABELS = {
  agendada: 'Agendada',
  realizada: 'Realizada',
  remarcada: 'Remarcada',
  falta: 'Falta'
};
const APPOINTMENT_TYPE_LABELS = {
  primeira_consulta: 'Primeira consulta',
  retorno: 'Retorno'
};
const COMPLETED_EVALUATION_STATUSES = new Set(['finalizada', 'concluida', 'concluido']);

const normalizeStatusToken = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, '_');

const isCompletedEvaluationStatus = (status) => COMPLETED_EVALUATION_STATUSES.has(normalizeStatusToken(status));

const AthletePortal = () => {
  const { user, logout } = useAuth();
  const { notify } = useUiFeedback();
  const { formatDate, convertFirebaseDate } = usePacientes();
  const [patient, setPatient] = useState(null);
  const [evaluations, setEvaluations] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loadingPatient, setLoadingPatient] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showEbiaModal, setShowEbiaModal] = useState(false);
  const [isSubmittingEbia, setIsSubmittingEbia] = useState(false);
  const [isRescheduleOpen, setIsRescheduleOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [isNoShowLoading, setIsNoShowLoading] = useState(false);

  const loadLinkedPatient = useCallback(async () => {
    if (!user?.uid) {
      setPatient(null);
      return;
    }
    setLoadingPatient(true);
    try {
      const { data } = await api.get('/pacientes');
      const list = Array.isArray(data) ? data : [];
      const found = list.find((item) => item.atletaUserId === user.uid) || null;
      setPatient(found);
    } catch (error) {
      setPatient(null);
    } finally {
      setLoadingPatient(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    loadLinkedPatient();
  }, [loadLinkedPatient]);

  useEffect(() => {
    if (!patient) {
      setShowOnboarding(false);
      setShowEbiaModal(false);
      return;
    }
    const completed = Boolean(patient.confirmacaoAtleta?.completed);
    const ebiaReleased = Boolean(patient.confirmacaoAtleta?.ebiaSelfForm?.enabled);
    setShowOnboarding(!completed);
    setShowEbiaModal(completed && ebiaReleased);
  }, [patient]);

  const handleSaveOnboarding = async (data) => {
    if (!patient?.id) return;
    const payload = {
      confirmacaoAtleta: {
        dados: data,
        completed: true,
        submittedAt: new Date().toISOString()
      }
    };
    await api.patch(`/pacientes/${patient.id}/onboarding`, payload);
    setShowOnboarding(false);
  };

  const loadAthleteDetails = useCallback(async () => {
    if (!patient?.id) {
      setEvaluations([]);
      setAppointments([]);
      return;
    }

    setLoadingDetails(true);
    try {
      const [evalRes, appRes] = await Promise.all([
        api.get('/avaliacoes', { params: { pacienteId: patient.id } }),
        api.get('/agendamentos', { params: { pacienteId: patient.id } })
      ]);
      setEvaluations(Array.isArray(evalRes.data) ? evalRes.data : []);
      setAppointments(Array.isArray(appRes.data) ? appRes.data : []);
    } catch (error) {
      setEvaluations([]);
      setAppointments([]);
      notify({
        type: 'error',
        title: 'Erro ao carregar dados',
        message: getApiErrorMessage(error, 'Não foi possível carregar agenda e avaliações do atleta.')
      });
    } finally {
      setLoadingDetails(false);
    }
  }, [notify, patient?.id]);

  useEffect(() => {
    loadAthleteDetails();
  }, [loadAthleteDetails]);

  const evaluationsSorted = useMemo(() => {
    return [...evaluations].sort((a, b) => {
      const aDate = convertFirebaseDate(a.createdAt || a.data) || 0;
      const bDate = convertFirebaseDate(b.createdAt || b.data) || 0;
      return bDate - aDate;
    });
  }, [evaluations, convertFirebaseDate]);

  const pendingEvaluations = useMemo(() => {
    return evaluationsSorted.filter((item) => item.status && !isCompletedEvaluationStatus(item.status));
  }, [evaluationsSorted]);

  const upcomingAppointments = useMemo(() => {
    const now = new Date();
    const allowedStatuses = new Set(['agendada']);
    return appointments
      .map((item) => ({
        ...item,
        dateObj: convertFirebaseDate(item.scheduledAt || item.date),
        statusNorm: String(item.status || 'agendada').toLowerCase()
      }))
      .filter((item) => item.dateObj && item.dateObj >= now && allowedStatuses.has(item.statusNorm))
      .sort((a, b) => a.dateObj - b.dateObj);
  }, [appointments, convertFirebaseDate]);

  const nextAppointment = useMemo(() => upcomingAppointments[0], [upcomingAppointments]);

  const plannedEvaluationItems = useMemo(() => {
    const items = [];
    upcomingAppointments.forEach((appointment) => {
      const evaluationsInAppointment = Array.isArray(appointment.evaluations) ? appointment.evaluations : [];
      evaluationsInAppointment.forEach((evaluationType, index) => {
        const normalizedType = String(evaluationType || '').toLowerCase().trim();
        const typeLabel = getEvaluationTypeLabel(normalizedType);
        const scheduledDate = appointment.dateObj || null;
        items.push({
          id: `agenda-avaliacao-${appointment.id || 'consulta'}-${normalizedType || index}-${index}`,
          title: `Avaliação planejada: ${typeLabel}`,
          description: `Consulta ${scheduledDate ? formatDate(scheduledDate) : 'sem data'}${appointment.time ? ` - ${appointment.time}` : ''}`,
          level: 'info'
        });
      });
    });
    return items;
  }, [formatDate, upcomingAppointments]);

  const pendingItems = useMemo(() => {
    if (!patient) return [];

    const items = [];
    if (showOnboarding) {
      items.push({
        id: 'onboarding',
        title: 'Complete seu cadastro inicial',
        description: 'Finalize o onboarding para liberar o acompanhamento completo.',
        level: 'high'
      });
    }

    if (patient.confirmacaoAtleta?.ebiaSelfForm?.enabled) {
      items.push({
        id: 'ebia-liberado',
        title: 'EBIA aguardando preenchimento',
        description: 'A equipe liberou o formulario EBIA para voce responder.',
        level: 'high'
      });
    }

    if (String(patient.consentimentoPesquisa || '').toLowerCase() === 'pendente') {
      items.push({
        id: 'consentimento',
        title: 'Consentimento de pesquisa pendente',
        description: 'A assinatura do termo de consentimento ainda não foi registrada.',
        level: 'high'
      });
    }

    pendingEvaluations.forEach((evaluation, index) => {
      const rawStatus = String(evaluation.status || 'pendente').toLowerCase().trim();
      const statusLabel = getEvaluationStatusLabel(rawStatus);
      const evaluationDate = convertFirebaseDate(
        evaluation.updatedAt || evaluation.createdAt || evaluation.data
      );
      items.push({
        id: `avaliacao-${evaluation.id || index}`,
        title: `Avaliação pendente: ${getEvaluationTypeLabel(evaluation.tipo)}`,
        description: `${statusLabel}${evaluationDate ? ` - ${formatDate(evaluationDate)}` : ''}`,
        level: 'info'
      });
    });

    plannedEvaluationItems.forEach((item) => {
      items.push(item);
    });

    if (!nextAppointment) {
      items.push({
        id: 'agenda',
        title: 'Sem proxima consulta agendada',
        description: 'Solicite um novo horario para manter o acompanhamento em dia.',
        level: 'medium'
      });
    }

    if (String(patient.status || '').toLowerCase() === 'lista de espera') {
      items.push({
        id: 'status',
        title: 'Paciente em lista de espera',
        description: 'Seu atendimento ainda não foi reativado pela equipe.',
        level: 'high'
      });
    }

    return items;
  }, [
    convertFirebaseDate,
    formatDate,
    nextAppointment,
    patient,
    pendingEvaluations,
    plannedEvaluationItems,
    showOnboarding
  ]);

  const getAthleteRescheduleDeadline = useCallback((appointment) => {
    if (!appointment) return null;
    const appointmentDate = appointment.dateObj
      || convertFirebaseDate(appointment.scheduledAt || appointment.date);
    if (!appointmentDate) return null;

    const previousBusinessDay = new Date(
      appointmentDate.getFullYear(),
      appointmentDate.getMonth(),
      appointmentDate.getDate()
    );
    do {
      previousBusinessDay.setDate(previousBusinessDay.getDate() - 1);
    } while (previousBusinessDay.getDay() === 0 || previousBusinessDay.getDay() === 6);

    previousBusinessDay.setHours(23, 59, 59, 999);
    return previousBusinessDay;
  }, [convertFirebaseDate]);

  const canAthleteReschedule = useCallback((appointment) => {
    const deadline = getAthleteRescheduleDeadline(appointment);
    if (!deadline) return false;
    return Date.now() <= deadline.getTime();
  }, [getAthleteRescheduleDeadline]);

  const nextAppointmentDeadline = useMemo(() => {
    if (!nextAppointment) return null;
    return getAthleteRescheduleDeadline(nextAppointment);
  }, [getAthleteRescheduleDeadline, nextAppointment]);

  const canRescheduleNextAppointment = useMemo(() => {
    if (!nextAppointment) return false;
    return canAthleteReschedule(nextAppointment);
  }, [canAthleteReschedule, nextAppointment]);
  const getAppointmentTypeLabel = useCallback((appointment) => {
    const key = String(appointment?.appointmentType || '').toLowerCase();
    return APPOINTMENT_TYPE_LABELS[key] || 'Não informado';
  }, []);

  const getEvaluationResponsible = useCallback((evaluation) => {
    return evaluation?.alunoNome
      || evaluation?.createdByName
      || patient?.alunoResponsavelNome
      || patient?.alunoResponsavel?.nome
      || 'Equipe LAINES';
  }, [patient?.alunoResponsavel?.nome, patient?.alunoResponsavelNome]);

  const evaluationResultCollection = useMemo(() => (
    buildEvaluationResultCollection(evaluationsSorted, {
      groupBy: (item) => normalizeType(item?.tipo),
      getDateValue: (item) => item?.updatedAt || item?.createdAt || item?.data
    })
  ), [evaluationsSorted]);

  const latestEvaluationSummary = useMemo(() => {
    const latestEvaluation = evaluationsSorted[0];
    if (!latestEvaluation) {
      return {
        empty: true,
        status: 'sem_registro',
        items: []
      };
    }

    const evaluationDate = convertFirebaseDate(latestEvaluation.createdAt || latestEvaluation.data);
    const updatedAt = convertFirebaseDate(
      latestEvaluation.updatedAt || latestEvaluation.createdAt || latestEvaluation.data
    );
    const completion = latestEvaluation?.meta?.completude;
    const responsible = latestEvaluation?.alunoNome
      || latestEvaluation?.createdByName
      || patient?.alunoResponsavelNome
      || patient?.alunoResponsavel?.nome
      || 'Equipe LAINES';

    return {
      empty: false,
      status: latestEvaluation.status || 'rascunho',
      items: [
        { label: 'Tipo', value: getEvaluationTypeLabel(latestEvaluation.tipo) },
        { label: 'Responsavel', value: responsible },
        { label: 'Data', value: evaluationDate ? formatDate(evaluationDate) : 'Não informada' },
        {
          label: 'Completude',
          value: typeof completion === 'number' ? `${completion}%` : 'Não informada'
        },
        { label: 'Projeto', value: latestEvaluation.projetoNome || patient?.projetoNome || 'Não vinculado' },
        { label: 'Última atualização', value: updatedAt ? formatDate(updatedAt) : 'Não informada' }
      ]
    };
  }, [convertFirebaseDate, evaluationsSorted, formatDate, patient?.alunoResponsavel?.nome, patient?.alunoResponsavelNome, patient?.projetoNome]);

  const handleLogout = async () => {
    await logout();
  };

  const handleOpenReschedule = () => {
    if (!nextAppointment) return;
    setSelectedAppointment(nextAppointment);
    setIsRescheduleOpen(true);
  };

  const handleMarkNoShow = async () => {
    if (!nextAppointment?.id) return;
    setIsNoShowLoading(true);
    try {
      await api.patch(`/agendamentos/${nextAppointment.id}`, {
        status: 'falta',
        faltouEm: new Date().toISOString()
      });
      notify({
        type: 'success',
        title: 'Falta registrada',
        message: 'A consulta foi marcada como falta.'
      });
      await loadAthleteDetails();
    } catch (error) {
      notify({
        type: 'error',
        title: 'Erro ao registrar falta',
        message: getApiErrorMessage(error, 'Não foi possível registrar a falta para esta consulta.')
      });
    } finally {
      setIsNoShowLoading(false);
    }
  };

  const handleSubmitEbia = useCallback(async (payload) => {
    if (!patient?.id || isSubmittingEbia) return;
    setIsSubmittingEbia(true);
    try {
      await api.post('/avaliacoes', {
        ...payload,
        pacienteId: patient.id,
        projetoId: patient.projetoId || undefined,
        projetoNome: patient.projetoNome || undefined,
        status: 'finalizada'
      });
      notify({
        type: 'success',
        title: 'EBIA enviada',
        message: 'A avaliação EBIA foi registrada no prontuário.'
      });
      setShowEbiaModal(false);
      await Promise.all([loadAthleteDetails(), loadLinkedPatient()]);
    } catch (error) {
      notify({
        type: 'error',
        title: 'Erro ao enviar EBIA',
        message: getApiErrorMessage(error, 'Não foi possível salvar a avaliação EBIA.')
      });
    } finally {
      setIsSubmittingEbia(false);
    }
  }, [isSubmittingEbia, loadAthleteDetails, loadLinkedPatient, notify, patient?.id, patient?.projetoId, patient?.projetoNome]);

  return (
    <div className="athlete-portal laines-page-shell">
      <header className="athlete-header laines-page-header">
        <div>
          <h1 className="laines-page-title">Portal do atleta</h1>
          <p className="laines-page-subtitle">Acompanhe suas avaliações, agenda e evolução.</p>
        </div>
        <div className="athlete-header-actions">
          <div className="athlete-badges">
            <span className="athlete-badge">
              <ClipboardList size={14} /> {evaluationsSorted.length} avaliações
            </span>
            <span className="athlete-badge">
              <TrendingUp size={14} /> {pendingItems.length} pendencias
            </span>
          </div>
          <button type="button" className="athlete-logout-btn" onClick={handleLogout}>
            <LogOut size={14} />
            <span>Sair</span>
          </button>
        </div>
      </header>

      {loadingPatient ? (
        <div className="athlete-empty laines-feedback-state">Carregando dados...</div>
      ) : !patient ? (
        <div className="athlete-empty laines-feedback-state">Nenhum atleta vinculado a este acesso.</div>
      ) : (
        <div className="athlete-body">
          <div className="athlete-card">
            <div className="athlete-card-header">
              <ClipboardList size={18} />
              <span>Resumo clinico</span>
            </div>
            <h2>{patient.nome}</h2>
            <p className="athlete-subtext">{patient.modalidadePrincipal || 'Modalidade não informada'}</p>
            <p className="athlete-text">
              {patient.observacoes || 'Sem observacoes registradas.'}
            </p>
          </div>

          <div className="athlete-card">
            <div className="athlete-card-header">
              <Calendar size={18} />
              <span>Próxima consulta</span>
            </div>
            {loadingDetails ? (
              <p className="athlete-text">Carregando agenda...</p>
            ) : nextAppointment ? (
              <div className="athlete-metric">
                <strong>{formatDate(nextAppointment.dateObj)}</strong>
                <span>
                  {nextAppointment.time || '--:--'} - {APPOINTMENT_STATUS_LABELS[nextAppointment.statusNorm] || 'Agendada'}
                </span>
                <small>
                  {(nextAppointment.evaluations || []).length} avaliação(ões) planejada(s)
                </small>
                <small>
                  Tipo: {getAppointmentTypeLabel(nextAppointment)}
                </small>
                {nextAppointmentDeadline && (
                  <small className="athlete-deadline-note">
                    Remarcacao ate {formatDate(nextAppointmentDeadline)}
                  </small>
                )}
                <div className="athlete-appointment-actions">
                  {canRescheduleNextAppointment ? (
                    <button
                      type="button"
                      className="athlete-action-btn"
                      onClick={handleOpenReschedule}
                    >
                      <RefreshCw size={14} />
                      <span>Remarcar consulta</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="athlete-action-btn athlete-action-btn--danger"
                      onClick={handleMarkNoShow}
                      disabled={isNoShowLoading}
                    >
                      <AlertTriangle size={14} />
                      <span>{isNoShowLoading ? 'Registrando...' : 'Registrar falta'}</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <p className="athlete-text">Sem consultas agendadas.</p>
            )}
          </div>

          <div className="athlete-card">
            <div className="athlete-card-header">
              <AlertTriangle size={18} />
              <span>Pendencias</span>
            </div>
            {loadingDetails ? (
              <p className="athlete-text">Carregando pendencias...</p>
            ) : pendingItems.length === 0 ? (
              <div className="athlete-empty-inline">
                <CheckCircle2 size={16} />
                <span>Nenhuma pendencia no momento.</span>
              </div>
            ) : (
              <div className="athlete-pending-list">
                {pendingItems.map((item) => (
                  <div key={item.id} className={`athlete-pending-item ${item.level}`}>
                    <AlertTriangle size={15} />
                    <div>
                      <strong>{item.title}</strong>
                      <span>{item.description}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="athlete-card full">
            <div className="athlete-card-header">
              <ClipboardList size={18} />
              <span>Avaliacoes recentes</span>
            </div>
            <EvaluationSummaryStrip
              title="Resumo da avaliação mais recente"
              subtitle="Panorama clinico padronizado do ultimo registro."
              status={latestEvaluationSummary.status}
              empty={latestEvaluationSummary.empty}
              emptyMessage="Sem avaliação para gerar resumo clínico."
              items={latestEvaluationSummary.items}
            />
            {loadingDetails ? (
              <div className="athlete-empty laines-feedback-state">Carregando avaliações...</div>
            ) : evaluationsSorted.length === 0 ? (
              <div className="athlete-empty laines-feedback-state">Nenhuma avaliação registrada.</div>
            ) : (
              <div className="athlete-list">
                {evaluationResultCollection.slice(0, 8).map(({ evaluation: item, result }, index) => {
                  const evaluationDate = convertFirebaseDate(item.createdAt || item.data);
                  return (
                    <ClinicalEvaluationResultCard
                      key={item.id || `athlete-result-${index}`}
                      result={result}
                      status={item.status || 'pendente'}
                      typeLabel={getEvaluationTypeLabel(item.tipo)}
                      responsible={getEvaluationResponsible(item)}
                      completion={item?.meta?.completude}
                      dateLabel={evaluationDate ? formatDate(evaluationDate) : 'Não informada'}
                      project={item.projetoNome || patient?.projetoNome || 'Não vinculado'}
                      className="athlete-clinical-result"
                      compact
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <AthleteOnboardingModal
        isOpen={showOnboarding}
        patient={patient}
        onSave={handleSaveOnboarding}
      />
      <AppointmentModal
        isOpen={isRescheduleOpen}
        onClose={() => {
          setIsRescheduleOpen(false);
          setSelectedAppointment(null);
        }}
        onSuccess={loadAthleteDetails}
        patient={patient}
        appointment={selectedAppointment}
        isReschedule
        lockEvaluations
      />
      <AthleteEbiaModal
        isOpen={showEbiaModal}
        patient={patient}
        release={patient?.confirmacaoAtleta?.ebiaSelfForm || null}
        isSubmitting={isSubmittingEbia}
        onClose={() => setShowEbiaModal(false)}
        onSubmit={handleSubmitEbia}
      />
    </div>
  );
};

export default AthletePortal;

function normalizeType(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');
}
