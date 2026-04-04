import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Calendar, CheckCircle2, ClipboardList, FileText, LogOut, RefreshCw, TrendingUp } from 'lucide-react';
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
const COMORBIDADE_LABELS = {
  diabetes: 'Diabetes Mellitus',
  hipertensao: 'Hipertensao arterial',
  anemia: 'Anemia',
  cardio: 'Doenca cardiovascular',
  dislipidemia: 'Dislipidemia',
  renal_hepatica: 'Doenca renal ou hepatica',
  tireoide: 'Doenca da tireoide',
  nenhum: 'Sem diagnostico conhecido'
};

const normalizeStatusToken = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, '_');

const isCompletedEvaluationStatus = (status) => COMPLETED_EVALUATION_STATUSES.has(normalizeStatusToken(status));

const normalizeToArray = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || '').trim())
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const formatPortalValue = (value, fallback = 'Nao informado') => {
  if (Array.isArray(value)) {
    const normalized = value.map((item) => String(item || '').trim()).filter(Boolean);
    return normalized.length ? normalized.join(', ') : fallback;
  }
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
};

const mapComorbidadesToLabels = (value) => (
  normalizeToArray(value).map((item) => COMORBIDADE_LABELS[item] || item)
);

const parseProfileDate = (value) => {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) return direct;

  if (typeof value === 'string') {
    const normalized = value.trim();
    const slashMatch = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (slashMatch) {
      const [, day, month, year] = slashMatch;
      const converted = new Date(`${year}-${month}-${day}T00:00:00`);
      if (!Number.isNaN(converted.getTime())) return converted;
    }
  }
  return null;
};

const calculateAge = (birthDateValue) => {
  const parsed = parseProfileDate(birthDateValue);
  if (!parsed) return null;
  const now = new Date();
  let age = now.getFullYear() - parsed.getFullYear();
  const monthDiff = now.getMonth() - parsed.getMonth();
  const beforeBirthday = monthDiff < 0 || (monthDiff === 0 && now.getDate() < parsed.getDate());
  if (beforeBirthday) age -= 1;
  return age >= 0 ? age : null;
};

const buildInitials = (fullName = '') => {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'AT';
  const first = parts[0][0] || '';
  const last = parts.length > 1 ? (parts[parts.length - 1][0] || '') : (parts[0][1] || '');
  return `${first}${last}`.toUpperCase() || 'AT';
};

const AthletePortal = ({ focusSection = 'dashboard', hideInternalHeader = false }) => {
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
  const overviewSectionRef = useRef(null);
  const agendaSectionRef = useRef(null);
  const pendingSectionRef = useRef(null);
  const prontuarioSectionRef = useRef(null);
  const avaliacoesSectionRef = useRef(null);

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
    const response = await api.patch(`/pacientes/${patient.id}/onboarding`, payload);
    if (response?.data) {
      setPatient(response.data);
    }
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
  const athleteInitialData = useMemo(() => {
    const raw = patient?.confirmacaoAtleta?.dados;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return {};
    }
    return raw;
  }, [patient?.confirmacaoAtleta?.dados]);

  const athleteProntuario = useMemo(() => {
    const observacoes = formatPortalValue(patient?.observacoes || athleteInitialData?.observacoes, 'Sem observacoes registradas');
    const historicoSaude = formatPortalValue(patient?.historicoSaude || athleteInitialData?.historicoSaude, 'Historico nao informado');
    const comorbidadesPessoais = mapComorbidadesToLabels(
      (patient?.comorbidadesPessoais || []).length
        ? patient?.comorbidadesPessoais
        : athleteInitialData?.comorbidadesPessoais
    );
    const comorbidadesFamiliares = mapComorbidadesToLabels(
      (patient?.comorbidadesFamiliares || []).length
        ? patient?.comorbidadesFamiliares
        : athleteInitialData?.comorbidadesFamiliares
    );
    return {
      observacoes,
      historicoSaude,
      comorbidadesPessoais,
      comorbidadesFamiliares
    };
  }, [
    athleteInitialData?.comorbidadesFamiliares,
    athleteInitialData?.comorbidadesPessoais,
    athleteInitialData?.historicoSaude,
    athleteInitialData?.observacoes,
    patient?.comorbidadesFamiliares,
    patient?.comorbidadesPessoais,
    patient?.historicoSaude,
    patient?.observacoes
  ]);

  const prontuarioIdentityItems = useMemo(() => ([
    { label: 'Prontuario', value: formatPortalValue(patient?.prontuario, 'Em geracao') },
    { label: 'Nome completo', value: formatPortalValue(athleteInitialData?.nomeCompleto || patient?.nome) },
    { label: 'Data de nascimento', value: formatPortalValue(athleteInitialData?.dataNascimento || patient?.dataNascimento) },
    { label: 'CPF', value: formatPortalValue(patient?.cpf) },
    { label: 'Genero', value: formatPortalValue(patient?.genero) },
    { label: 'Modalidade principal', value: formatPortalValue(patient?.modalidadePrincipal) },
    { label: 'Projeto', value: formatPortalValue(patient?.projetoNome, 'Nao vinculado') },
    { label: 'Status do atendimento', value: formatPortalValue(patient?.status) }
  ]), [
    athleteInitialData?.dataNascimento,
    athleteInitialData?.nomeCompleto,
    patient?.cpf,
    patient?.dataNascimento,
    patient?.genero,
    patient?.modalidadePrincipal,
    patient?.nome,
    patient?.projetoNome,
    patient?.prontuario,
    patient?.status
  ]);

  const athleteDisplayName = useMemo(
    () => formatPortalValue(athleteInitialData?.nomeCompleto || patient?.nome, 'Atleta'),
    [athleteInitialData?.nomeCompleto, patient?.nome]
  );

  const athleteBirthDate = useMemo(
    () => athleteInitialData?.dataNascimento || patient?.dataNascimento || '',
    [athleteInitialData?.dataNascimento, patient?.dataNascimento]
  );

  const athleteAge = useMemo(() => calculateAge(athleteBirthDate), [athleteBirthDate]);

  const athleteInitials = useMemo(() => buildInitials(athleteDisplayName), [athleteDisplayName]);

  const latestEvaluationDateLabel = useMemo(() => {
    const latest = evaluationsSorted[0];
    if (!latest) return 'Sem registro';
    const date = convertFirebaseDate(latest.updatedAt || latest.createdAt || latest.data);
    return date ? formatDate(date) : 'Sem registro';
  }, [convertFirebaseDate, evaluationsSorted, formatDate]);

  const nextAppointmentDateLabel = useMemo(() => {
    if (!nextAppointment?.dateObj) return 'Sem agenda';
    return formatDate(nextAppointment.dateObj);
  }, [formatDate, nextAppointment?.dateObj]);

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
          description: `Consulta ${scheduledDate ? formatDate(scheduledDate) : 'Sem data'}${appointment.time ? ` - ${appointment.time}` : ''}`,
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
        description: 'A equipe liberou o formulário EBIA para você responder.',
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
        title: 'Sem próxima consulta agendada',
        description: 'Solicite um novo horário para manter o acompanhamento em dia.',
        level: 'medium'
      });
    }

    if (String(patient.status || '').toLowerCase() === 'lista de espera') {
      items.push({
        id: 'status',
        title: 'Atleta em lista de espera',
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
        { label: 'Responsável', value: responsible },
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

  useEffect(() => {
    if (!patient || loadingPatient) return;
    if (!focusSection || focusSection === 'dashboard') return;

    const sectionMap = {
      resumo: overviewSectionRef,
      agenda: agendaSectionRef,
      pendencias: pendingSectionRef,
      prontuario: prontuarioSectionRef,
      avaliacoes: avaliacoesSectionRef
    };
    const targetRef = sectionMap[focusSection];
    if (targetRef?.current) {
      targetRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [focusSection, loadingPatient, patient]);

  return (
    <motion.div
      className="athlete-portal laines-page-shell"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      {!hideInternalHeader && (
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
              <TrendingUp size={14} /> {pendingItems.length} pendências
            </span>
          </div>
          <button type="button" className="athlete-logout-btn" onClick={handleLogout}>
            <LogOut size={14} />
            <span>Sair</span>
          </button>
        </div>
      </header>
      )}

      {loadingPatient ? (
        <div className="athlete-empty laines-feedback-state">Carregando dados...</div>
      ) : !patient ? (
        <div className="athlete-empty laines-feedback-state">Nenhum atleta vinculado a este acesso.</div>
      ) : (
        <div className="athlete-body">
          <div className="athlete-card" ref={overviewSectionRef}>
            <div className="athlete-card-header">
              <ClipboardList size={18} />
              <span>Resumo clínico</span>
            </div>
            <h2>{patient.nome}</h2>
            <p className="athlete-subtext">{patient.modalidadePrincipal || 'Modalidade não informada'}</p>
            <p className="athlete-text">
              {patient.observacoes || 'Sem observações registradas.'}
            </p>
          </div>

          <div className="athlete-card" ref={agendaSectionRef}>
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
                    Remarcação até {formatDate(nextAppointmentDeadline)}
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

          <div className="athlete-card" ref={pendingSectionRef}>
            <div className="athlete-card-header">
              <AlertTriangle size={18} />
              <span>Pendências</span>
            </div>
            {loadingDetails ? (
              <p className="athlete-text">Carregando pendências...</p>
            ) : pendingItems.length === 0 ? (
              <div className="athlete-empty-inline">
                <CheckCircle2 size={16} />
                <span>Nenhuma pendência no momento.</span>
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

          <div className="athlete-card full athlete-prontuario-card" ref={prontuarioSectionRef}>
            <div className="athlete-card-header">
              <FileText size={18} />
              <span>Meu prontuario</span>
            </div>

            <div className="athlete-prontuario-shell">
              <section className="athlete-prontuario-hero">
                <div className="athlete-prontuario-head">
                  <div className="athlete-prontuario-heading">
                    <p className="athlete-prontuario-eyebrow">Prontuario do atleta</p>
                    <strong className="athlete-prontuario-id">{athleteDisplayName}</strong>
                    <p className="athlete-prontuario-note">
                      Registro clinico #{formatPortalValue(patient?.prontuario, 'Em geracao')}
                    </p>
                  </div>
                  <div className="athlete-prontuario-badges">
                    <span className="athlete-pill ok">Prontuario ativo</span>
                    <span className="athlete-pill neutral">
                      Nº {formatPortalValue(patient?.prontuario, 'Pendente')}
                    </span>
                    <span className={`athlete-pill ${patient?.confirmacaoAtleta?.completed ? 'ok' : 'pending'}`}>
                      {patient?.confirmacaoAtleta?.completed ? 'Cadastro inicial concluido' : 'Cadastro inicial pendente'}
                    </span>
                    <span className={`athlete-pill ${String(patient?.consentimentoPesquisa || '').toLowerCase() === 'aceito' ? 'ok' : 'pending'}`}>
                      {String(patient?.consentimentoPesquisa || '').toLowerCase() === 'aceito'
                        ? 'Consentimento aceito'
                        : 'Consentimento pendente'}
                    </span>
                  </div>
                </div>

                <div className="athlete-prontuario-hero-main">
                  <article className="athlete-prontuario-patient-card">
                    <div className="athlete-prontuario-avatar">{athleteInitials}</div>
                    <div className="athlete-prontuario-patient-info">
                      <p className="athlete-prontuario-patient-meta">
                        CPF: {formatPortalValue(patient?.cpf, '---')} - {formatPortalValue(athleteBirthDate, '---')}
                      </p>
                      <p className="athlete-prontuario-patient-meta">
                        Modalidade: {formatPortalValue(patient?.modalidadePrincipal)}
                      </p>
                      <p className="athlete-prontuario-patient-meta">
                        Projeto: {formatPortalValue(patient?.projetoNome, 'Nao vinculado')}
                      </p>
                      <p className="athlete-prontuario-patient-meta">
                        Responsavel: {formatPortalValue(patient?.alunoResponsavelNome || patient?.alunoResponsavel?.nome, 'Equipe LAINES')}
                      </p>
                    </div>
                  </article>

                  <div className="athlete-prontuario-stats-grid">
                    <article className="athlete-prontuario-stat">
                      <span>Idade</span>
                      <strong>{typeof athleteAge === 'number' ? `${athleteAge} anos` : '---'}</strong>
                    </article>
                    <article className="athlete-prontuario-stat">
                      <span>Avaliacoes</span>
                      <strong>{evaluationsSorted.length}</strong>
                    </article>
                    <article className="athlete-prontuario-stat">
                      <span>Ultima avaliacao</span>
                      <strong>{latestEvaluationDateLabel}</strong>
                    </article>
                    <article className="athlete-prontuario-stat athlete-prontuario-stat--highlight">
                      <span>Proxima consulta</span>
                      <strong>{nextAppointmentDateLabel}</strong>
                    </article>
                  </div>
                </div>
              </section>

              <div className="athlete-prontuario-summary">
                <article className="athlete-prontuario-summary-item">
                  <span>Status de atendimento</span>
                  <strong>{formatPortalValue(patient?.status)}</strong>
                </article>
                <article className="athlete-prontuario-summary-item">
                  <span>Ingestao de agua</span>
                  <strong>{formatPortalValue(athleteInitialData?.ingestaoAgua)}</strong>
                </article>
                <article className="athlete-prontuario-summary-item">
                  <span>Litros por dia</span>
                  <strong>{formatPortalValue(athleteInitialData?.litrosAguaDia)}</strong>
                </article>
                <article className="athlete-prontuario-summary-item">
                  <span>Qualidade do sono</span>
                  <strong>{formatPortalValue(athleteInitialData?.dificuldadeDormir)}</strong>
                </article>
              </div>

              <div className="athlete-prontuario-layout">
                <section className="athlete-prontuario-section athlete-prontuario-section--identity">
                  <h3>Identificacao</h3>
                  <div className="athlete-prontuario-grid">
                    {prontuarioIdentityItems.map((item) => (
                      <div key={item.label} className="athlete-prontuario-item">
                        <span>{item.label}</span>
                        <strong>{item.value}</strong>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="athlete-prontuario-section athlete-prontuario-section--clinical">
                  <h3>Resumo clinico</h3>
                  <p><strong>Queixa principal:</strong> {athleteProntuario.observacoes}</p>
                  <p><strong>Historico de saude:</strong> {athleteProntuario.historicoSaude}</p>
                  <p><strong>Atividade fisica:</strong> {formatPortalValue(athleteInitialData?.atividadeFisica)}</p>
                  <p><strong>Ingestao de agua:</strong> {formatPortalValue(athleteInitialData?.ingestaoAgua)}</p>
                  <p><strong>Litros por dia:</strong> {formatPortalValue(athleteInitialData?.litrosAguaDia)}</p>
                  <p><strong>Sono:</strong> {formatPortalValue(athleteInitialData?.dificuldadeDormir)}</p>
                </section>

                <section className="athlete-prontuario-section athlete-prontuario-section--risk">
                  <h3>Comorbidades pessoais</h3>
                  {athleteProntuario.comorbidadesPessoais.length === 0 ? (
                    <p>Nenhuma comorbidade pessoal informada.</p>
                  ) : (
                    <div className="athlete-prontuario-chip-list">
                      {athleteProntuario.comorbidadesPessoais.map((item) => (
                        <span key={`pessoal-${item}`} className="athlete-prontuario-chip">{item}</span>
                      ))}
                    </div>
                  )}
                </section>

                <section className="athlete-prontuario-section athlete-prontuario-section--risk">
                  <h3>Comorbidades familiares</h3>
                  {athleteProntuario.comorbidadesFamiliares.length === 0 ? (
                    <p>Nenhuma comorbidade familiar informada.</p>
                  ) : (
                    <div className="athlete-prontuario-chip-list">
                      {athleteProntuario.comorbidadesFamiliares.map((item) => (
                        <span key={`familiar-${item}`} className="athlete-prontuario-chip">{item}</span>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </div>
          </div>

          <div className="athlete-card full" ref={avaliacoesSectionRef}>
            <div className="athlete-card-header">
              <ClipboardList size={18} />
              <span>Avaliações recentes</span>
            </div>
            <EvaluationSummaryStrip
              title="Resumo da avaliação mais recente"
              subtitle="Panorama clínico padronizado do último registro."
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
        onClose={() => setShowOnboarding(false)}
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
    </motion.div>
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
