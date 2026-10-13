import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle, ClipboardList, LogOut
} from 'lucide-react';
import api, { getApiErrorMessage } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { usePacientes } from '../../contexts/PacienteContext';
import { useUiFeedback } from '../../contexts/UiFeedbackContext';
import { getEvaluationTypeLabel } from '../../components/shared/evaluationSummaryUtils';
import { subscribeRealtimeEvent } from '../../services/realtime';
import AthleteOnboardingModal from './AthleteOnboardingModal';
import AthleteOnboardingWizard from '../../components/Atleta/AthleteOnboardingWizard';
import AthleteEbiaModal from './AthleteEbiaModal';
import AthleteSelfEvaluationModal from './AthleteSelfEvaluationModal';
import {
  ATHLETE_SELF_EVALUATION_CONFIGS,
  getAthleteSelfEvaluationRelease,
  isAthleteSelfEvaluationReleased,
  listReleasedAthleteSelfEvaluationConfigs
} from './athleteSelfEvaluations';
import AppointmentModal from '../Student/Patients/AppointmentModal';
import { FeedbackState } from '../../components/ui';
import AthleteTabPendencias from './AthleteTabPendencias';
import AthleteTabCadastro from './AthleteTabCadastro';
import AthleteTabAcompanhamento from './AthleteTabAcompanhamento';
import AthleteVisaoGeral from './AthleteVisaoGeral';
import './AthletePortal.css';

/* ─── Constants ──────────────────────────────────────────── */

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

const ATHLETE_SELF_EVALUATION_TYPES = new Set(
  ATHLETE_SELF_EVALUATION_CONFIGS.map((config) => config.type)
);

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

const compactObject = (record) => Object.fromEntries(
  Object.entries(record).filter(([, value]) => value !== undefined)
);

const toOptionalString = (value) => {
  const text = String(value || '').trim();
  return text || undefined;
};

const toOptionalStringArray = (value) => {
  const items = Array.isArray(value)
    ? value
    : String(value || '').split(',');
  const normalized = items
    .map((item) => String(item || '').trim())
    .filter(Boolean);
  return normalized.length > 0 ? normalized : undefined;
};

const buildAthleteNutritionOnboardingPayload = (formData, patient) => {
  const currentConfirmation = patient?.confirmacaoAtleta && typeof patient.confirmacaoAtleta === 'object'
    ? patient.confirmacaoAtleta
    : {};
  const currentDados = currentConfirmation?.dados && typeof currentConfirmation.dados === 'object'
    ? currentConfirmation.dados
    : {};

  return compactObject({
    dataNascimento: toOptionalString(formData.dataNascimento),
    queixaPrincipal: toOptionalString(formData.observacoes || formData.motivoAtendimento),
    patologias: toOptionalStringArray(formData.comorbidadesPessoais),
    alergias: toOptionalString(formData.alergiaIntolerancia),
    alcoolUso: toOptionalString(formData.bebidaAlcoolica),
    tabacoUso: toOptionalString(formData.fuma),
    comorbidadesFamiliares: toOptionalStringArray(formData.comorbidadesFamiliares),
    confirmacaoAtleta: {
      ...currentConfirmation,
      dados: {
        ...currentDados,
        ...formData
      }
    }
  });
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

const AthletePortal = ({
  activeTab = 'dashboard',
  hideInternalHeader = false,
  onPendingCountChange,
  onNavigate
}) => {
  const { user, logout } = useAuth();
  const { notify } = useUiFeedback();
  const { formatDate, convertFirebaseDate } = usePacientes();
  const currentUserId = user?.uid || user?.id || '';

  const [patient, setPatient] = useState(null);
  const [evaluations, setEvaluations] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loadingPatient, setLoadingPatient] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  // Visão geral: separa "falhou ao carregar" de "sem registro". As chamadas
  // de loadAthleteDetails não mudam.
  const [detailsError, setDetailsError] = useState(false);
  const [showClinicalOnboarding, setShowClinicalOnboarding] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showEbiaModal, setShowEbiaModal] = useState(false);
  const [isSubmittingEbia, setIsSubmittingEbia] = useState(false);
  const [activeSelfEvaluationType, setActiveSelfEvaluationType] = useState(null);
  const [isSubmittingSelfEvaluation, setIsSubmittingSelfEvaluation] = useState(false);
  const [isRescheduleOpen, setIsRescheduleOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [isNoShowLoading, setIsNoShowLoading] = useState(false);

  /* ── Data loading ── */

  const loadLinkedPatient = useCallback(async (options = {}) => {
    const silent = Boolean(options?.silent);
    if (!currentUserId) { setPatient(null); return; }
    if (!silent) setLoadingPatient(true);
    try {
      const { data } = await api.get('/pacientes');
      const list = Array.isArray(data) ? data : [];
      const linkedPatient = (
        list.find((item) => item.atletaUserId === currentUserId)
        || list[0]
        || null
      );
      setPatient(linkedPatient);
      return linkedPatient;
    } catch {
      setPatient(null);
      return null;
    } finally {
      if (!silent) setLoadingPatient(false);
    }
  }, [currentUserId]);

  useEffect(() => { loadLinkedPatient(); }, [loadLinkedPatient]);

  useEffect(() => {
    if (!patient) {
      setShowOnboarding(false);
      setShowEbiaModal(false);
      setActiveSelfEvaluationType(null);
      return;
    }
    const clinicalDone = Boolean(
      patient.confirmacaoAtleta?.completadoEm
      || patient.confirmacaoAtleta?.submittedAt
      || patient.confirmacaoAtleta?.completed
    );
    const nutritionDone = Boolean(patient.confirmacaoAtleta?.completed);
    const ca = patient?.cadastroAtleta;
    const ebiaReleased = ca
      ? Boolean(ca.ebiaSelfForm?.enabled)
      : Boolean(patient.confirmacaoAtleta?.ebiaSelfForm?.enabled);
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
        api.get('/agendamentos', { params: { limit: 200 } })
      ]);
      setEvaluations(Array.isArray(evalRes.data) ? evalRes.data : []);
      setAppointments(Array.isArray(appRes.data) ? appRes.data : []);
      setDetailsError(false);
    } catch (error) {
      setEvaluations([]);
      setAppointments([]);
      setDetailsError(true);
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

  useEffect(() => {
    if (!patient?.id) return undefined;
    const refreshPortalData = () => {
      loadLinkedPatient({ silent: true });
      loadAthleteDetails();
    };
    const intervalId = window.setInterval(refreshPortalData, 60000);
    const handleFocus = refreshPortalData;
    window.addEventListener('focus', handleFocus);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
    };
  }, [loadAthleteDetails, loadLinkedPatient, patient?.id]);

  useEffect(() => {
    if (!patient?.id) return undefined;
    const refreshDetails = () => loadAthleteDetails();
    const refreshPatient = (updatedPatient) => {
      if (!updatedPatient?.id || updatedPatient.id === patient.id) {
        loadLinkedPatient({ silent: true });
      }
    };
    const refreshPortalData = () => {
      loadLinkedPatient({ silent: true });
      loadAthleteDetails();
    };
    const unsubscribers = [
      subscribeRealtimeEvent('agendamentos.created', refreshDetails),
      subscribeRealtimeEvent('agendamentos.updated', refreshDetails),
      subscribeRealtimeEvent('agendamentos.deleted', refreshDetails),
      subscribeRealtimeEvent('notificacoes.created', refreshPortalData),
      subscribeRealtimeEvent('pacientes.updated', refreshPatient)
    ];
    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [loadAthleteDetails, loadLinkedPatient, patient?.id]);

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
      aguardando: Boolean(latest?.meta?.aguardandoRevisao) && !latest?.revisadoEm,
      revisado: Boolean(latest?.revisadoEm) || (isCompletedEvaluationStatus(latest.status) && !latest?.meta?.aguardandoRevisao),
      date,
      dateLabel: date ? formatDate(date) : null
    };
  }, [evaluationsSorted, convertFirebaseDate, formatDate]);

  const alimentacaoPanel = useMemo(() => {
    const latest = evaluationsSorted.find((e) => normalizeType(e?.tipo) === 'alimentar');
    if (!latest) return null;
    const d = latest.dados || {};
    const aguardando = Boolean(latest?.meta?.aguardandoRevisao) && !latest?.revisadoEm;
    const date = convertFirebaseDate(latest.updatedAt || latest.createdAt || latest.data);
    return {
      isAtletaReport: Boolean(latest?.meta?.atletaSelfReport),
      adesao: safeNum(d.adesao),
      aguardando,
      revisado: Boolean(latest?.revisadoEm) || (isCompletedEvaluationStatus(latest.status) && !aguardando),
      date,
      dateLabel: date ? formatDate(date) : null
    };
  }, [evaluationsSorted, convertFirebaseDate, formatDate]);

  const treinoPanel = useMemo(() => {
    const latest = evaluationsSorted.find((e) => normalizeType(e?.tipo) === 'carga_treino');
    if (!latest) return null;
    const d = latest.dados || {};
    const aguardando = Boolean(latest?.meta?.aguardandoRevisao) && !latest?.revisadoEm;
    const date = convertFirebaseDate(latest.updatedAt || latest.createdAt || latest.data);
    return {
      carga: safeNum(d.cargaSemanaAtual),
      rpe: safeNum(d.rpePercebido),
      faseLabel: FASE_TREINO_LABELS[d.faseAtual] || d.faseAtual || null,
      aguardando,
      revisado: Boolean(latest?.revisadoEm) || (isCompletedEvaluationStatus(latest.status) && !aguardando),
      date,
      dateLabel: date ? formatDate(date) : null
    };
  }, [evaluationsSorted, convertFirebaseDate, formatDate]);

  /* ── cadastroAtleta — fonte preferencial do backend consolidado ── */

  const cadastroAtleta = useMemo(() => {
    const raw = patient?.cadastroAtleta;
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : null;
  }, [patient?.cadastroAtleta]);

  const formulariosLiberados = useMemo(() => (
    cadastroAtleta?.formulariosLiberados
    || patient?.confirmacaoAtleta?.formulariosLiberados
    || {}
  ), [cadastroAtleta, patient?.confirmacaoAtleta?.formulariosLiberados]);

  /* ── Self-evaluation helpers ── */

  const canSubmitSelfEvaluations = cadastroAtleta
    ? !cadastroAtleta.cadastroPendente
    : Boolean(patient?.confirmacaoAtleta?.completed);

  const plannedSelfEvaluationTypes = useMemo(() => {
    const types = new Set();
    upcomingAppointments.forEach((appointment) => {
      const plannedTypes = Array.isArray(appointment.evaluations) ? appointment.evaluations : [];
      plannedTypes.forEach((evaluationType) => {
        const normalizedType = normalizeType(evaluationType);
        if (ATHLETE_SELF_EVALUATION_TYPES.has(normalizedType)) {
          types.add(normalizedType);
        }
      });
    });
    return types;
  }, [upcomingAppointments]);

  const releasedSelfEvaluationConfigs = useMemo(() => {
    const configsByType = new Map();
    listReleasedAthleteSelfEvaluationConfigs(formulariosLiberados).forEach((config) => {
      configsByType.set(config.type, { ...config, releaseSource: 'manual' });
    });
    ATHLETE_SELF_EVALUATION_CONFIGS.forEach((config) => {
      if (plannedSelfEvaluationTypes.has(config.type) && !configsByType.has(config.type)) {
        configsByType.set(config.type, { ...config, releaseSource: 'appointment' });
      }
    });
    return Array.from(configsByType.values());
  }, [formulariosLiberados, plannedSelfEvaluationTypes]);

  const athleteSelfEvaluationCards = useMemo(() => (
    releasedSelfEvaluationConfigs.map((config) => {
      const explicitRelease = getAthleteSelfEvaluationRelease(formulariosLiberados, config.type);
      const isPlannedForAppointment = plannedSelfEvaluationTypes.has(config.type);
      const release = explicitRelease?.enabled
        ? explicitRelease
        : {
          enabled: isPlannedForAppointment,
          source: isPlannedForAppointment ? 'appointment' : null
        };
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
        releaseSource: config.releaseSource || (isPlannedForAppointment ? 'appointment' : 'manual'),
        latest,
        latestDateLabel: latestDate ? formatDate(latestDate) : null
      };
    })
  ), [
    convertFirebaseDate,
    evaluationsSorted,
    formatDate,
    formulariosLiberados,
    plannedSelfEvaluationTypes,
    releasedSelfEvaluationConfigs
  ]);

  /* ── Pending items (unified action list) ── */

  const plannedEvaluationItems = useMemo(() => {
    const items = [];
    upcomingAppointments.forEach((appointment) => {
      const types = Array.isArray(appointment.evaluations) ? appointment.evaluations : [];
      types.forEach((evaluationType, index) => {
        const normalizedType = normalizeType(evaluationType);
        if (ATHLETE_SELF_EVALUATION_TYPES.has(normalizedType)) return;
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

    if (!canSubmitSelfEvaluations && athleteSelfEvaluationCards.length > 0) {
      items.push({
        id: 'forms-gate',
        title: `${athleteSelfEvaluationCards.length} formulário${athleteSelfEvaluationCards.length > 1 ? 's' : ''} disponível${athleteSelfEvaluationCards.length > 1 ? 'eis' : ''} para resposta`,
        description: 'Conclua o cadastro inicial para poder preenchê-los.',
        level: 'medium'
      });
    } else if (canSubmitSelfEvaluations) {
      athleteSelfEvaluationCards.forEach((card) => {
        const isNew = card.release?.releasedAt
          && (Date.now() - new Date(card.release.releasedAt).getTime()) < 48 * 3600 * 1000;
        const releasedLabel = card.release?.releasedAt
          ? `Liberado ${formatDate(new Date(card.release.releasedAt))}`
          : card.releaseSource === 'appointment'
            ? 'Solicitado em consulta agendada'
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
          const aguardando = Boolean(card.latest?.meta?.aguardandoRevisao) && !card.latest?.revisadoEm;
          const revisado = Boolean(card.latest?.revisadoEm) || (isCompletedEvaluationStatus(card.latest?.status) && !aguardando);
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

    const consentStatus = String(patient.consentimentoPesquisa || '').toLowerCase();
    if (consentStatus !== 'aceito' && consentStatus !== 'aceite') {
      const consentRejected = consentStatus === 'recusado';
      items.push({
        id: 'consentimento',
        title: consentRejected ? 'Consentimento de pesquisa recusado' : 'Consentimento de pesquisa pendente',
        description: consentRejected
          ? 'Sua participação em pesquisa nao esta autorizada.'
          : 'A assinatura do termo ainda não foi registrada.',
        level: 'medium'
      });
    }

    plannedEvaluationItems.forEach((item) => items.push(item));

    if (!nextAppointment) {
      items.push({
        id: 'agenda',
        title: 'Sem próxima consulta agendada',
        description: 'Solicite um novo horário para manter o acompanhamento em dia.',
        level: 'info'
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
    athleteSelfEvaluationCards,
    canSubmitSelfEvaluations,
    formatDate,
    nextAppointment,
    patient,
    plannedEvaluationItems,
    showOnboarding
  ]);

  const hasCriticalPending = pendingItems.some((i) => i.level === 'high' || i.level === 'medium');

  /* ── Notify parent of pending count changes ── */

  useEffect(() => {
    if (onPendingCountChange) onPendingCountChange(pendingItems.length);
  }, [onPendingCountChange, pendingItems.length]);

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
    const isExplicitlyReleased = isAthleteSelfEvaluationReleased(formulariosLiberados, requestedType);
    const isAppointmentPlanned = plannedSelfEvaluationTypes.has(requestedType);
    if (!isExplicitlyReleased && !isAppointmentPlanned) {
      notify({ type: 'warning', title: 'Formulario indisponivel', message: 'A equipe suspendeu este formulario.' });
      setActiveSelfEvaluationType(null);
      return;
    }
    const release = getAthleteSelfEvaluationRelease(formulariosLiberados, requestedType);
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
          releaseId: release?.releaseId || null,
          origemLiberacao: isExplicitlyReleased ? 'formularios_liberados' : 'consulta_planejada'
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
    notify, formulariosLiberados, patient?.id, patient?.projetoId, patient?.projetoNome,
    plannedSelfEvaluationTypes
  ]);

  const handleCompleteOnboarding = useCallback(() => {
    const hasSomeClinicalData = Boolean(
      patient?.confirmacaoAtleta?.completadoEm
      || patient?.confirmacaoAtleta?.submittedAt
    );
    if (hasSomeClinicalData) {
      setShowOnboarding(true);
    } else {
      setShowClinicalOnboarding(true);
    }
  }, [patient]);

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
    if (!patient?.id) throw new Error('Atleta vinculado nao encontrado.');
    try {
      const onboardingPayload = buildAthleteNutritionOnboardingPayload(payload, patient);
      await api.patch(`/pacientes/${patient.id}/onboarding`, onboardingPayload);
      notify({ type: 'success', title: 'Cadastro concluído', message: 'Seus dados foram salvos.' });
      setShowOnboarding(false);
      await loadLinkedPatient();
    } catch (error) {
      notify({ type: 'error', title: 'Erro ao salvar cadastro', message: getApiErrorMessage(error, 'Não foi possível salvar o cadastro.') });
      throw error;
    }
  }, [patient, notify, loadLinkedPatient]);

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
        <>
          {activeTab === 'dashboard' && (
            <AthleteVisaoGeral
              nome={athleteDisplayName.split(/\s+/)[0]}
              pendingItems={pendingItems}
              hasCriticalPending={hasCriticalPending}
              onPendingItemClick={handlePendingItemClick}
              nextAppointment={nextAppointment}
              upcomingAppointments={upcomingAppointments}
              getAppointmentTypeLabel={getAppointmentTypeLabel}
              evaluationsCount={evaluationsSorted.length}
              latestEvaluationDateLabel={latestEvaluationDateLabel}
              composicaoPanel={composicaoPanel}
              hidratacaoPanel={hidratacaoPanel}
              alimentacaoPanel={alimentacaoPanel}
              treinoPanel={treinoPanel}
              loadingDetails={loadingDetails}
              detailsError={detailsError}
              onTentarNovamente={loadAthleteDetails}
              formatDate={formatDate}
              onNavigate={onNavigate}
            />
          )}
          {activeTab === 'pendencias' && (
            <AthleteTabPendencias
              patient={patient}
              pendingItems={pendingItems}
              hasCriticalPending={hasCriticalPending}
              nextAppointment={nextAppointment}
              nextAppointmentDeadline={nextAppointmentDeadline}
              canRescheduleNextAppointment={canRescheduleNextAppointment}
              loadingDetails={loadingDetails}
              isNoShowLoading={isNoShowLoading}
              formatDate={formatDate}
              getAppointmentTypeLabel={getAppointmentTypeLabel}
              onOpenReschedule={handleOpenReschedule}
              onMarkNoShow={handleMarkNoShow}
              onPendingItemClick={handlePendingItemClick}
              onPendingItemKeyDown={handlePendingItemKeyDown}
              releasedSelfEvaluationCards={athleteSelfEvaluationCards}
              canSubmitSelfEvaluations={canSubmitSelfEvaluations}
            />
          )}
          {activeTab === 'cadastro' && (
            <AthleteTabCadastro
              patient={patient}
              cadastroAtleta={cadastroAtleta}
              athleteInitials={athleteInitials}
              athleteDisplayName={athleteDisplayName}
              athleteAge={athleteAge}
              athleteInitialData={athleteInitialData}
              prontuarioIdentityItems={prontuarioIdentityItems}
              evaluationsSorted={evaluationsSorted}
              latestEvaluationDateLabel={latestEvaluationDateLabel}
              onCompleteOnboarding={handleCompleteOnboarding}
            />
          )}
          {activeTab === 'acompanhamento' && (
            <AthleteTabAcompanhamento
              patient={patient}
              evaluationsSorted={evaluationsSorted}
              upcomingAppointments={upcomingAppointments}
              composicaoPanel={composicaoPanel}
              hidratacaoPanel={hidratacaoPanel}
              alimentacaoPanel={alimentacaoPanel}
              treinoPanel={treinoPanel}
              loadingDetails={loadingDetails}
              formatDate={formatDate}
            />
          )}
        </>
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
        release={cadastroAtleta?.ebiaSelfForm || patient?.confirmacaoAtleta?.ebiaSelfForm || null}
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

/* ─── normalizeType ──────────────────────────────────────── */

function normalizeType(value) {
  return String(value || '')
    .trim().toLowerCase().normalize('NFD')
    .replace(/[̀-ͯ]/g, '').replace(/\s+/g, '_');
}
