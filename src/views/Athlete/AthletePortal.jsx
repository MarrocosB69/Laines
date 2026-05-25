import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity, AlertTriangle, Apple, Calendar, CheckCircle2, ChevronDown,
  ClipboardList, Droplets, Dumbbell, FileText, LogOut, RefreshCw, TrendingUp
} from 'lucide-react';
import api, { getApiErrorMessage } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { usePacientes } from '../../contexts/PacienteContext';
import { useUiFeedback } from '../../contexts/UiFeedbackContext';
import { getEvaluationTypeLabel } from '../../components/shared/evaluationSummaryUtils';
import AthleteOnboardingModal from './AthleteOnboardingModal';
import AthleteOnboardingWizard from '../../components/Atleta/AthleteOnboardingWizard';
import AthleteEbiaModal from './AthleteEbiaModal';
import AthleteSelfEvaluationModal from './AthleteSelfEvaluationModal';
import {
  getAthleteSelfEvaluationRelease,
  isAthleteSelfEvaluationReleased,
  listReleasedAthleteSelfEvaluationConfigs
} from './athleteSelfEvaluations';
import AppointmentModal from '../Student/Patients/AppointmentModal';
import { FeedbackState, Skeleton } from '../../components/ui';
import './AthletePortal.css';

/* ─── Constants ──────────────────────────────────────────── */

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

const FASE_TREINO_LABELS = {
  preparacao_geral: 'Preparação geral',
  pre_temporada: 'Pré-temporada',
  temporada_competitiva: 'Temporada competitiva',
  pos_temporada: 'Pós-temporada',
  ferias: 'Férias',
  lesionado: 'Período de lesão'
};

const TIPOS_COMPOSICAO = new Set([
  'composicao_corporal_integrada', 'bioimpedancia', 'dobras_cutaneas', 'perimetros'
]);

/* ─── Module-level helpers ───────────────────────────────── */

const normalizeStatusToken = (value) => String(value || '')
  .trim().toLowerCase().normalize('NFD')
  .replace(/[̀-ͯ]/g, '').replace(/\s+/g, '_');

const isCompletedEvaluationStatus = (status) =>
  COMPLETED_EVALUATION_STATUSES.has(normalizeStatusToken(status));

const formatPortalValue = (value, fallback = 'Nao informado') => {
  if (Array.isArray(value)) {
    const s = value.map((i) => String(i || '').trim()).filter(Boolean);
    return s.length ? s.join(', ') : fallback;
  }
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
};

const maskCpf = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length < 2) return '---';
  return `***.***.***-${digits.slice(-2)}`;
};

const parseProfileDate = (value) => {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) return direct;
  if (typeof value === 'string') {
    const m = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) {
      const d = new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00`);
      if (!Number.isNaN(d.getTime())) return d;
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
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < parsed.getDate())) age -= 1;
  return age >= 0 ? age : null;
};

const buildInitials = (fullName = '') => {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'AT';
  const first = parts[0][0] || '';
  const last = parts.length > 1 ? (parts[parts.length - 1][0] || '') : (parts[0][1] || '');
  return `${first}${last}`.toUpperCase() || 'AT';
};

const safeNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);

/* ─── AthletePortal ──────────────────────────────────────── */

const AthletePortal = ({ focusSection = 'dashboard', hideInternalHeader = false }) => {
  const { user, logout } = useAuth();
  const { notify } = useUiFeedback();
  const { formatDate, convertFirebaseDate } = usePacientes();

  const [patient, setPatient] = useState(null);
  const [evaluations, setEvaluations] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loadingPatient, setLoadingPatient] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [showClinicalOnboarding, setShowClinicalOnboarding] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showEbiaModal, setShowEbiaModal] = useState(false);
  const [isSubmittingEbia, setIsSubmittingEbia] = useState(false);
  const [activeSelfEvaluationType, setActiveSelfEvaluationType] = useState(null);
  const [isSubmittingSelfEvaluation, setIsSubmittingSelfEvaluation] = useState(false);
  const [isRescheduleOpen, setIsRescheduleOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [isNoShowLoading, setIsNoShowLoading] = useState(false);
  const [isDossieOpen, setIsDossieOpen] = useState(false);

  const overviewSectionRef = useRef(null);
  const agendaSectionRef = useRef(null);
  const pendingSectionRef = useRef(null);
  const prontuarioSectionRef = useRef(null);
  const avaliacoesSectionRef = useRef(null);

  /* ── Data loading ── */

  const loadLinkedPatient = useCallback(async () => {
    if (!user?.uid) { setPatient(null); return; }
    setLoadingPatient(true);
    try {
      const { data } = await api.get('/pacientes');
      const list = Array.isArray(data) ? data : [];
      setPatient(list.find((item) => item.atletaUserId === user.uid) || null);
    } catch {
      setPatient(null);
    } finally {
      setLoadingPatient(false);
    }
  }, [user?.uid]);

  useEffect(() => { loadLinkedPatient(); }, [loadLinkedPatient]);

  useEffect(() => {
    if (!patient) {
      setShowOnboarding(false);
      setShowEbiaModal(false);
      setActiveSelfEvaluationType(null);
      return;
    }
    const clinicalDone = Boolean(patient.confirmacaoAtleta?.completadoEm);
    const nutritionDone = Boolean(patient.confirmacaoAtleta?.completed);
    const ebiaReleased = Boolean(patient.confirmacaoAtleta?.ebiaSelfForm?.enabled);
    const ebiaDismissed = Boolean(sessionStorage.getItem('laines_ebia_dismissed'));
    setShowClinicalOnboarding(!clinicalDone);
    setShowOnboarding(clinicalDone && !nutritionDone);
    setShowEbiaModal(clinicalDone && nutritionDone && ebiaReleased && !ebiaDismissed);
  }, [patient]);

  const loadAthleteDetails = useCallback(async () => {
    if (!patient?.id) { setEvaluations([]); setAppointments([]); return; }
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
        message: getApiErrorMessage(error, 'Não foi possível carregar agenda e avaliações.')
      });
    } finally {
      setLoadingDetails(false);
    }
  }, [notify, patient?.id]);

  useEffect(() => { loadAthleteDetails(); }, [loadAthleteDetails]);

  /* ── Derived data ── */

  const evaluationsSorted = useMemo(() => (
    [...evaluations].sort((a, b) => {
      const aD = convertFirebaseDate(a.createdAt || a.data) || 0;
      const bD = convertFirebaseDate(b.createdAt || b.data) || 0;
      return bD - aD;
    })
  ), [evaluations, convertFirebaseDate]);

  const upcomingAppointments = useMemo(() => {
    const now = new Date();
    return appointments
      .map((item) => ({
        ...item,
        dateObj: convertFirebaseDate(item.scheduledAt || item.date),
        statusNorm: String(item.status || 'agendada').toLowerCase()
      }))
      .filter((item) => item.dateObj && item.dateObj >= now && item.statusNorm === 'agendada')
      .sort((a, b) => a.dateObj - b.dateObj);
  }, [appointments, convertFirebaseDate]);

  const nextAppointment = useMemo(() => upcomingAppointments[0], [upcomingAppointments]);

  const athleteInitialData = useMemo(() => {
    const raw = patient?.confirmacaoAtleta?.dados;
    return (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
  }, [patient?.confirmacaoAtleta?.dados]);

  const prontuarioIdentityItems = useMemo(() => ([
    { label: 'Prontuario', value: formatPortalValue(patient?.prontuario, 'Em geracao') },
    { label: 'Nome completo', value: formatPortalValue(athleteInitialData?.nomeCompleto || patient?.nome) },
    { label: 'Data de nascimento', value: formatPortalValue(athleteInitialData?.dataNascimento || patient?.dataNascimento) },
    { label: 'CPF', value: maskCpf(patient?.cpf) },
    { label: 'Genero', value: formatPortalValue(patient?.genero) },
    { label: 'Modalidade principal', value: formatPortalValue(patient?.modalidadePrincipal) },
    { label: 'Projeto', value: formatPortalValue(patient?.projetoNome, 'Nao vinculado') },
    { label: 'Status do atendimento', value: formatPortalValue(patient?.status) }
  ]), [
    athleteInitialData?.dataNascimento, athleteInitialData?.nomeCompleto,
    patient?.cpf, patient?.dataNascimento, patient?.genero,
    patient?.modalidadePrincipal, patient?.nome, patient?.projetoNome,
    patient?.prontuario, patient?.status
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

  /* ── Domain panels ── */

  const composicaoPanel = useMemo(() => {
    const latest = evaluationsSorted.find((e) => TIPOS_COMPOSICAO.has(normalizeType(e?.tipo)));
    if (!latest) return null;
    const d = latest.dados || {};
    const tipo = normalizeType(latest.tipo);

    let peso = null;
    let percGordura = null;
    let massaMagra = null;

    if (tipo === 'composicao_corporal_integrada') {
      percGordura = safeNum(d.percentualGorduraOficial);
      massaMagra = safeNum(d.massaMagraOficialKg);
    } else if (tipo === 'bioimpedancia') {
      percGordura = safeNum(d.percentualGordura);
      massaMagra = safeNum(d.massaMagra);
      peso = safeNum(d.peso);
    } else if (tipo === 'dobras_cutaneas') {
      percGordura = safeNum(d.percentualGordura) ?? safeNum(d.percentualGorduraSiri);
      peso = safeNum(d.peso);
    } else if (tipo === 'perimetros') {
      peso = safeNum(d.peso);
    }

    const latestIdx = latest.id
      ? evaluationsSorted.findIndex((e) => e.id === latest.id)
      : -1;
    const prev = latestIdx >= 0
      ? evaluationsSorted.slice(latestIdx + 1).find((e) => TIPOS_COMPOSICAO.has(normalizeType(e?.tipo)))
      : null;

    let deltaPercGordura = null;
    if (prev?.dados && percGordura !== null) {
      const pd = prev.dados;
      const prevGC = safeNum(pd.percentualGorduraOficial) ?? safeNum(pd.percentualGordura) ?? safeNum(pd.percentualGorduraSiri);
      if (prevGC !== null) deltaPercGordura = +(percGordura - prevGC).toFixed(1);
    }

    const date = convertFirebaseDate(latest.updatedAt || latest.createdAt || latest.data);
    return { peso, percGordura, massaMagra, deltaPercGordura, date, dateLabel: date ? formatDate(date) : null };
  }, [evaluationsSorted, convertFirebaseDate, formatDate]);

  const hidratacaoPanel = useMemo(() => {
    const latest = evaluationsSorted.find((e) => normalizeType(e?.tipo) === 'hidratacao');
    if (!latest) return null;
    const d = latest.dados || {};
    const perda = safeNum(d.perdaPesoPercentual);
    const status = perda === null ? 'sem_dado'
      : perda < 2 ? 'ok'
      : perda < 3 ? 'atencao'
      : 'critico';
    const statusLabel = { ok: 'Adequada', atencao: 'Atenção', critico: 'Crítica', sem_dado: '—' }[status];
    const date = convertFirebaseDate(latest.updatedAt || latest.createdAt || latest.data);
    return {
      perda,
      status,
      statusLabel,
      sedePercebida: safeNum(d.sedePercebida),
      aguardando: Boolean(latest?.meta?.aguardandoRevisao),
      revisado: isCompletedEvaluationStatus(latest.status) && !latest?.meta?.aguardandoRevisao,
      date,
      dateLabel: date ? formatDate(date) : null
    };
  }, [evaluationsSorted, convertFirebaseDate, formatDate]);

  const alimentacaoPanel = useMemo(() => {
    const latest = evaluationsSorted.find((e) => normalizeType(e?.tipo) === 'alimentar');
    if (!latest) return null;
    const d = latest.dados || {};
    const aguardando = Boolean(latest?.meta?.aguardandoRevisao);
    const date = convertFirebaseDate(latest.updatedAt || latest.createdAt || latest.data);
    return {
      isAtletaReport: Boolean(latest?.meta?.atletaSelfReport),
      adesao: safeNum(d.adesao),
      aguardando,
      revisado: isCompletedEvaluationStatus(latest.status) && !aguardando,
      date,
      dateLabel: date ? formatDate(date) : null
    };
  }, [evaluationsSorted, convertFirebaseDate, formatDate]);

  const treinoPanel = useMemo(() => {
    const latest = evaluationsSorted.find((e) => normalizeType(e?.tipo) === 'carga_treino');
    if (!latest) return null;
    const d = latest.dados || {};
    const aguardando = Boolean(latest?.meta?.aguardandoRevisao);
    const date = convertFirebaseDate(latest.updatedAt || latest.createdAt || latest.data);
    return {
      carga: safeNum(d.cargaSemanaAtual),
      rpe: safeNum(d.rpePercebido),
      faseLabel: FASE_TREINO_LABELS[d.faseAtual] || d.faseAtual || null,
      aguardando,
      revisado: isCompletedEvaluationStatus(latest.status) && !aguardando,
      date,
      dateLabel: date ? formatDate(date) : null
    };
  }, [evaluationsSorted, convertFirebaseDate, formatDate]);

  /* ── Self-evaluation helpers ── */

  const canSubmitSelfEvaluations = Boolean(patient?.confirmacaoAtleta?.completed);

  const releasedSelfEvaluationConfigs = useMemo(
    () => listReleasedAthleteSelfEvaluationConfigs(patient?.confirmacaoAtleta),
    [patient?.confirmacaoAtleta]
  );

  const athleteSelfEvaluationCards = useMemo(() => (
    releasedSelfEvaluationConfigs.map((config) => {
      const release = getAthleteSelfEvaluationRelease(patient?.confirmacaoAtleta, config.type);
      const latest = evaluationsSorted.find((item) => (
        normalizeType(item?.tipo) === config.type
        && (normalizeType(item?.meta?.origemPreenchimento) === 'atleta' || item?.meta?.atletaSelfReport === true)
      ));
      const latestDate = latest
        ? convertFirebaseDate(latest.updatedAt || latest.createdAt || latest.data)
        : null;
      return {
        ...config,
        release,
        latest,
        latestDateLabel: latestDate ? formatDate(latestDate) : null
      };
    })
  ), [convertFirebaseDate, evaluationsSorted, formatDate, patient?.confirmacaoAtleta, releasedSelfEvaluationConfigs]);

  /* ── Pending items (unified action list) ── */

  const plannedEvaluationItems = useMemo(() => {
    const items = [];
    upcomingAppointments.forEach((appointment) => {
      const types = Array.isArray(appointment.evaluations) ? appointment.evaluations : [];
      types.forEach((evaluationType, index) => {
        const normalizedType = String(evaluationType || '').toLowerCase().trim();
        const scheduledDate = appointment.dateObj || null;
        items.push({
          id: `agenda-${appointment.id || 'consulta'}-${normalizedType || index}`,
          title: `Avaliação planejada: ${getEvaluationTypeLabel(normalizedType)}`,
          description: `Consulta ${scheduledDate ? formatDate(scheduledDate) : 'sem data'}${appointment.time ? ` — ${appointment.time}` : ''}`,
          level: 'info'
        });
      });
    });
    return items;
  }, [formatDate, upcomingAppointments]);

  const pendingItems = useMemo(() => {
    if (!patient) return [];
    const items = [];

    // Bloqueantes
    if (showOnboarding) {
      items.push({
        id: 'onboarding',
        title: 'Complete seu cadastro inicial',
        description: 'Necessário para liberar o acompanhamento completo.',
        level: 'high'
      });
    }

    if (patient.confirmacaoAtleta?.ebiaSelfForm?.enabled) {
      items.push({
        id: 'ebia-liberado',
        title: 'Avaliação de segurança alimentar disponível',
        description: 'A equipe liberou este formulário. Toque para preencher.',
        level: 'high',
        action: 'open_ebia'
      });
    }

    // Formulários liberados: se onboarding pendente, avisa; se completo, mostra ações
    if (!canSubmitSelfEvaluations && releasedSelfEvaluationConfigs.length > 0) {
      items.push({
        id: 'forms-gate',
        title: `${releasedSelfEvaluationConfigs.length} formulário${releasedSelfEvaluationConfigs.length > 1 ? 's' : ''} liberado${releasedSelfEvaluationConfigs.length > 1 ? 's' : ''} pela equipe`,
        description: 'Conclua o cadastro inicial para poder preenchê-los.',
        level: 'medium'
      });
    } else if (canSubmitSelfEvaluations) {
      athleteSelfEvaluationCards.forEach((card) => {
        const isNew = card.release?.releasedAt
          && (Date.now() - new Date(card.release.releasedAt).getTime()) < 48 * 3600 * 1000;
        const releasedLabel = card.release?.releasedAt
          ? `Liberado ${formatDate(new Date(card.release.releasedAt))}`
          : 'Liberado pela equipe';

        if (!card.latest) {
          items.push({
            id: `form-${card.type}`,
            title: card.title,
            description: `${releasedLabel}${isNew ? ' · Novo' : ''}`,
            level: 'medium',
            action: 'open_form',
            formType: card.type
          });
        } else {
          const aguardando = Boolean(card.latest?.meta?.aguardandoRevisao);
          const revisado = isCompletedEvaluationStatus(card.latest?.status) && !aguardando;
          if (!revisado) {
            items.push({
              id: `form-enviado-${card.type}`,
              title: `${card.title} — enviado`,
              description: `Enviado ${card.latestDateLabel || ''}${aguardando ? ' · Aguardando revisão da equipe' : ''}`,
              level: 'info'
            });
          }
        }
      });
    }

    // Consentimento
    if (String(patient.consentimentoPesquisa || '').toLowerCase() === 'pendente') {
      items.push({
        id: 'consentimento',
        title: 'Consentimento de pesquisa pendente',
        description: 'A assinatura do termo ainda não foi registrada.',
        level: 'medium'
      });
    }

    // Avaliações planejadas na próxima consulta
    plannedEvaluationItems.forEach((item) => items.push(item));

    // Sem consulta agendada
    if (!nextAppointment) {
      items.push({
        id: 'agenda',
        title: 'Sem próxima consulta agendada',
        description: 'Solicite um novo horário para manter o acompanhamento em dia.',
        level: 'info'
      });
    }

    // Lista de espera
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
    athleteSelfEvaluationCards,
    canSubmitSelfEvaluations,
    formatDate,
    nextAppointment,
    patient,
    plannedEvaluationItems,
    releasedSelfEvaluationConfigs,
    showOnboarding
  ]);

  const hasCriticalPending = pendingItems.some((i) => i.level === 'high' || i.level === 'medium');

  /* ── Appointment helpers ── */

  const getAthleteRescheduleDeadline = useCallback((appointment) => {
    const appointmentDate = appointment?.dateObj
      || convertFirebaseDate(appointment?.scheduledAt || appointment?.date);
    if (!appointmentDate) return null;
    const d = new Date(appointmentDate.getFullYear(), appointmentDate.getMonth(), appointmentDate.getDate());
    do { d.setDate(d.getDate() - 1); } while (d.getDay() === 0 || d.getDay() === 6);
    d.setHours(23, 59, 59, 999);
    return d;
  }, [convertFirebaseDate]);

  const canAthleteReschedule = useCallback((appointment) => {
    const deadline = getAthleteRescheduleDeadline(appointment);
    return deadline ? Date.now() <= deadline.getTime() : false;
  }, [getAthleteRescheduleDeadline]);

  const nextAppointmentDeadline = useMemo(
    () => (nextAppointment ? getAthleteRescheduleDeadline(nextAppointment) : null),
    [getAthleteRescheduleDeadline, nextAppointment]
  );

  const canRescheduleNextAppointment = useMemo(
    () => (nextAppointment ? canAthleteReschedule(nextAppointment) : false),
    [canAthleteReschedule, nextAppointment]
  );

  const getAppointmentTypeLabel = useCallback((appointment) => (
    APPOINTMENT_TYPE_LABELS[String(appointment?.appointmentType || '').toLowerCase()] || 'Não informado'
  ), []);

  /* ── Handlers ── */

  const handleLogout = async () => { await logout(); };

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
      notify({ type: 'success', title: 'Falta registrada', message: 'A consulta foi marcada como falta.' });
      await loadAthleteDetails();
    } catch (error) {
      notify({ type: 'error', title: 'Erro ao registrar falta', message: getApiErrorMessage(error, 'Não foi possível registrar a falta.') });
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
      notify({ type: 'success', title: 'EBIA enviada', message: 'A avaliação foi registrada no prontuário.' });
      setShowEbiaModal(false);
      await Promise.all([loadAthleteDetails(), loadLinkedPatient()]);
    } catch (error) {
      notify({ type: 'error', title: 'Erro ao enviar EBIA', message: getApiErrorMessage(error, 'Não foi possível salvar a avaliação EBIA.') });
    } finally {
      setIsSubmittingEbia(false);
    }
  }, [isSubmittingEbia, loadAthleteDetails, loadLinkedPatient, notify, patient?.id, patient?.projetoId, patient?.projetoNome]);

  const handleSubmitSelfEvaluation = useCallback(async (payload) => {
    if (!patient?.id || isSubmittingSelfEvaluation) return;
    const requestedType = normalizeType(activeSelfEvaluationType || payload?.tipo);
    if (!isAthleteSelfEvaluationReleased(patient?.confirmacaoAtleta, requestedType)) {
      notify({ type: 'warning', title: 'Formulario indisponivel', message: 'A equipe suspendeu este formulario.' });
      setActiveSelfEvaluationType(null);
      return;
    }
    const release = getAthleteSelfEvaluationRelease(patient?.confirmacaoAtleta, requestedType);
    setIsSubmittingSelfEvaluation(true);
    try {
      await api.post('/avaliacoes', {
        ...payload,
        pacienteId: patient.id,
        projetoId: patient.projetoId || undefined,
        projetoNome: patient.projetoNome || undefined,
        status: 'rascunho',
        sourceSystem: 'portal_atleta',
        meta: {
          ...(payload?.meta || {}),
          origemPreenchimento: 'atleta',
          atletaSelfReport: true,
          aguardandoRevisao: true,
          formularioLiberado: requestedType,
          releaseId: release?.releaseId || null
        }
      });
      notify({ type: 'success', title: 'Formulario enviado', message: 'Seu envio está disponível para revisão da equipe.' });
      setActiveSelfEvaluationType(null);
      await loadAthleteDetails();
    } catch (error) {
      notify({ type: 'error', title: 'Erro ao enviar', message: getApiErrorMessage(error, 'Nao foi possivel enviar o formulario.') });
    } finally {
      setIsSubmittingSelfEvaluation(false);
    }
  }, [
    isSubmittingSelfEvaluation, activeSelfEvaluationType, loadAthleteDetails,
    notify, patient?.confirmacaoAtleta, patient?.id, patient?.projetoId, patient?.projetoNome
  ]);

  /* ── Focus scroll effect ── */

  useEffect(() => {
    if (!patient || loadingPatient || !focusSection || focusSection === 'dashboard') return;
    const map = {
      resumo: overviewSectionRef, agenda: agendaSectionRef, pendencias: pendingSectionRef,
      prontuario: prontuarioSectionRef, avaliacoes: avaliacoesSectionRef
    };
    map[focusSection]?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [focusSection, loadingPatient, patient]);

  /* ── Pending item interaction handler ── */

  const handlePendingItemClick = useCallback((item) => {
    if (item.action === 'open_ebia') {
      sessionStorage.removeItem('laines_ebia_dismissed');
      setShowEbiaModal(true);
    } else if (item.action === 'open_form') {
      setActiveSelfEvaluationType(item.formType);
    }
  }, []);

  const handlePendingItemKeyDown = useCallback((e, item) => {
    if (e.key === 'Enter' || e.key === ' ') handlePendingItemClick(item);
  }, [handlePendingItemClick]);

  const handleSaveOnboarding = useCallback(async (payload) => {
    if (!patient?.id) return;
    try {
      await api.patch(`/pacientes/${patient.id}`, payload);
      notify({ type: 'success', title: 'Cadastro concluído', message: 'Seus dados foram salvos.' });
      setShowOnboarding(false);
      await loadLinkedPatient();
    } catch (error) {
      notify({ type: 'error', title: 'Erro ao salvar cadastro', message: getApiErrorMessage(error, 'Não foi possível salvar o cadastro.') });
    }
  }, [patient?.id, notify, loadLinkedPatient]);

  /* ── Render ── */

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
                <AlertTriangle size={14} /> {pendingItems.filter((i) => i.level !== 'info').length} pendências
              </span>
            </div>
            <button type="button" className="athlete-logout-btn" onClick={handleLogout}>
              <LogOut size={14} /><span>Sair</span>
            </button>
          </div>
        </header>
      )}

      {loadingPatient ? (
        <FeedbackState loading skeletonLines={4} className="ap-page-loading" />
      ) : !patient ? (
        <FeedbackState
          empty
          title="Nenhum atleta vinculado"
          description="Este acesso não está vinculado a um perfil de atleta. Entre em contato com a equipe LAINES."
          size="lg"
        />
      ) : (
        <div className="ap-body">

          {/* 1 — Hero */}
          <section className="ap-hero" ref={overviewSectionRef}>
            <div className="ap-hero__profile">
              <div className="ap-hero__avatar">{athleteInitials}</div>
              <div className="ap-hero__meta">
                <h2 className="ap-hero__name">{athleteDisplayName}</h2>
                <p className="ap-hero__sub">{patient.modalidadePrincipal || 'Modalidade não informada'}</p>
                <p className="ap-hero__sub">{formatPortalValue(patient?.alunoResponsavelNome || patient?.alunoResponsavel?.nome, 'Equipe LAINES')}</p>
                {athleteAge != null && <span className="ap-hero__age">{athleteAge} anos</span>}
              </div>
            </div>
            <div className="ap-hero__stats">
              <div className="ap-hero__stat">
                <span>Avaliações</span>
                <strong>{evaluationsSorted.length}</strong>
              </div>
              <div className="ap-hero__stat">
                <span>Última avaliação</span>
                <strong>{latestEvaluationDateLabel}</strong>
              </div>
              <div className={`ap-hero__stat ${patient?.confirmacaoAtleta?.completed ? 'ap-hero__stat--ok' : 'ap-hero__stat--warn'}`}>
                <span>Cadastro</span>
                <strong>{patient?.confirmacaoAtleta?.completed ? 'Concluído' : 'Pendente'}</strong>
              </div>
              <div className={`ap-hero__stat ${String(patient?.consentimentoPesquisa || '').toLowerCase() === 'aceito' ? 'ap-hero__stat--ok' : 'ap-hero__stat--warn'}`}>
                <span>Consentimento</span>
                <strong>{String(patient?.consentimentoPesquisa || '').toLowerCase() === 'aceito' ? 'Aceito' : 'Pendente'}</strong>
              </div>
            </div>
            {hideInternalHeader && (
              <button type="button" className="athlete-logout-btn ap-hero__logout" onClick={handleLogout}>
                <LogOut size={14} /><span>Sair</span>
              </button>
            )}
          </section>

          {/* 2 — Agenda + Ações unificadas */}
          <div className="ap-row-2">

            <section className="ap-card ap-card--agenda" ref={agendaSectionRef}>
              <div className="ap-card__header">
                <Calendar size={16} /><span>Próxima consulta</span>
              </div>
              {loadingDetails ? (
                <Skeleton lines={3} />
              ) : nextAppointment ? (
                <div className="athlete-metric">
                  <strong>{formatDate(nextAppointment.dateObj)}</strong>
                  <span>{nextAppointment.time || '--:--'} · {APPOINTMENT_STATUS_LABELS[nextAppointment.statusNorm] || 'Agendada'}</span>
                  <small>Tipo: {getAppointmentTypeLabel(nextAppointment)}</small>
                  <small>{(nextAppointment.evaluations || []).length} avaliação(ões) planejada(s)</small>
                  {nextAppointmentDeadline && (
                    <small className="athlete-deadline-note">
                      Remarcação até {formatDate(nextAppointmentDeadline)}
                    </small>
                  )}
                  <div className="athlete-appointment-actions">
                    {canRescheduleNextAppointment ? (
                      <button type="button" className="athlete-action-btn" onClick={handleOpenReschedule}>
                        <RefreshCw size={14} /><span>Remarcar</span>
                      </button>
                    ) : (
                      <button type="button" className="athlete-action-btn athlete-action-btn--danger"
                        onClick={handleMarkNoShow} disabled={isNoShowLoading}>
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

            <section className="ap-card" ref={pendingSectionRef}>
              <div className="ap-card__header">
                <AlertTriangle size={16} /><span>O que fazer agora</span>
              </div>
              {loadingDetails ? (
                <Skeleton lines={3} />
              ) : (
                <>
                  {!hasCriticalPending && (
                    <div className="athlete-empty-inline">
                      <CheckCircle2 size={16} />
                      <span>
                        Tudo em dia{nextAppointment
                          ? ` — próxima consulta ${formatDate(nextAppointment.dateObj)}`
                          : ''}.
                      </span>
                    </div>
                  )}
                  {pendingItems.length > 0 && (
                    <div className="athlete-pending-list">
                      {pendingItems.map((item) => (
                        <div
                          key={item.id}
                          className={`athlete-pending-item ${item.level}${item.action ? ' athlete-pending-item--action' : ''}`}
                          onClick={item.action ? () => handlePendingItemClick(item) : undefined}
                          role={item.action ? 'button' : undefined}
                          tabIndex={item.action ? 0 : undefined}
                          onKeyDown={item.action ? (e) => handlePendingItemKeyDown(e, item) : undefined}
                        >
                          <AlertTriangle size={15} />
                          <div>
                            <strong>{item.title}</strong>
                            <span>{item.description}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </section>

          </div>

          {/* 3 — Minha evolução: painéis de domínio */}
          <section className="ap-card ap-card--full" ref={avaliacoesSectionRef}>
            <div className="ap-card__header">
              <TrendingUp size={16} /><span>Minha evolução</span>
            </div>
            <div className="ap-evolution-grid">

              <DomainPanel icon={Activity} title="Composição corporal" empty={!composicaoPanel}>
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

              <DomainPanel icon={Droplets} title="Hidratação" empty={!hidratacaoPanel}>
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

              <DomainPanel icon={Apple} title="Alimentação" empty={!alimentacaoPanel}>
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

              <DomainPanel icon={Dumbbell} title="Treino" empty={!treinoPanel}>
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

          {/* 4 — Meu dossiê: identidade */}
          <section className="ap-card ap-card--full ap-dossie" ref={prontuarioSectionRef}>
            <button type="button" className="ap-dossie__toggle" onClick={() => setIsDossieOpen((v) => !v)}>
              <FileText size={16} />
              <span>Meu dossiê</span>
              <span className="ap-dossie__subtitle">identificação · vínculo · status</span>
              <ChevronDown size={15} className={`ap-dossie__chevron${isDossieOpen ? ' ap-dossie__chevron--open' : ''}`} />
            </button>
            {isDossieOpen && (
              <div className="ap-dossie__body">
                <div className="ap-dossie__pills">
                  <span className="athlete-pill neutral">Nº {formatPortalValue(patient?.prontuario, 'Pendente')}</span>
                  <span className={`athlete-pill ${patient?.confirmacaoAtleta?.completed ? 'ok' : 'pending'}`}>
                    {patient?.confirmacaoAtleta?.completed ? 'Cadastro concluído' : 'Cadastro pendente'}
                  </span>
                  <span className={`athlete-pill ${String(patient?.consentimentoPesquisa || '').toLowerCase() === 'aceito' ? 'ok' : 'pending'}`}>
                    {String(patient?.consentimentoPesquisa || '').toLowerCase() === 'aceito' ? 'Consentimento aceito' : 'Consentimento pendente'}
                  </span>
                </div>
                <div className="ap-dossie__section">
                  <h3>Identificação</h3>
                  <div className="athlete-prontuario-grid">
                    {prontuarioIdentityItems.map((item) => (
                      <div key={item.label} className="athlete-prontuario-item">
                        <span>{item.label}</span>
                        <strong>{item.value}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>

        </div>
      )}

      {showClinicalOnboarding && patient && (
        <AthleteOnboardingWizard
          pacienteId={patient.id}
          patientName={patient.nome}
          onComplete={loadLinkedPatient}
        />
      )}

      <AthleteOnboardingModal
        isOpen={showOnboarding}
        patient={patient}
        onSave={handleSaveOnboarding}
        onClose={() => setShowOnboarding(false)}
      />
      <AppointmentModal
        isOpen={isRescheduleOpen}
        onClose={() => { setIsRescheduleOpen(false); setSelectedAppointment(null); }}
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
        onClose={() => { sessionStorage.setItem('laines_ebia_dismissed', '1'); setShowEbiaModal(false); }}
        onSubmit={handleSubmitEbia}
      />
      <AthleteSelfEvaluationModal
        isOpen={Boolean(activeSelfEvaluationType)}
        type={activeSelfEvaluationType}
        patient={patient}
        isSubmitting={isSubmittingSelfEvaluation}
        onClose={() => setActiveSelfEvaluationType(null)}
        onSubmit={handleSubmitSelfEvaluation}
      />
    </motion.div>
  );
};

export default AthletePortal;

/* ─── Sub-components ─────────────────────────────────────── */

function DomainPanel({ icon: Icon, title, empty, children }) {
  return (
    <div className="ap-domain-panel">
      <div className="ap-domain-panel__header">
        <Icon size={14} />
        <span>{title}</span>
      </div>
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
  if (aguardando) {
    return <p className="ap-domain-panel__waiting">Seu relato está aguardando revisão</p>;
  }
  if (revisado) {
    return <p className="ap-domain-panel__ok">Revisado pela equipe</p>;
  }
  return null;
}

/* ─── normalizeType ──────────────────────────────────────── */

function normalizeType(value) {
  return String(value || '')
    .trim().toLowerCase().normalize('NFD')
    .replace(/[̀-ͯ]/g, '').replace(/\s+/g, '_');
}
