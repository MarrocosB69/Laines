import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  FileText,
  Activity,
  Clock,
  History,
  FolderKanban,
  Loader2,
  X,
  Download
} from 'lucide-react';
import './PatientProntuario.css';
import '../../../components/Prontuario/ProntuarioTheme.css';
import '../../../components/Prontuario/ProntuarioPatch.css';
import { usePacientes } from '../../../contexts/PacienteContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useUiFeedback } from '../../../contexts/UiFeedbackContext';
import { isStudentMemberRole, normalizeRole } from '../../../constants/roles';
import { useModalBodyLock } from '../../../hooks/useModalBodyLock';
import {
  uploadPatientAttachment,
  downloadPatientAttachment,
  deletePatientAttachment
} from '../../../services/storage';
import api, { getApiErrorMessage } from '../../../services/api';
import {
  getEvaluationStatusLabel,
  getEvaluationTypeLabel
} from '../../../components/shared/evaluationSummaryUtils';
import { listEvaluationRegistryByContext } from '../../../constants/evaluationRegistry';
import { buildEvaluationTimelineSummary } from '../../../components/shared/evaluationResultAdapter';
import AppointmentModal from './AppointmentModal';
import ProntuarioHeader from '../../../components/Prontuario/ProntuarioHeader';
import ProntuarioTabs from '../../../components/Prontuario/ProntuarioTabs';
import ResumoClinico from '../../../components/Prontuario/ResumoClinico';
import DashboardAvaliacoes from '../../../components/Prontuario/DashboardAvaliacoes';
import TimelineConsultas from '../../../components/Prontuario/TimelineConsultas';
import PainelSituacaoClinica from '../../../components/Prontuario/PainelSituacaoClinica';
import PainelAnexos from '../../../components/Prontuario/PainelAnexos';
import PainelMensagens from '../../../components/Prontuario/PainelMensagens';
import ProximasConsultas from '../../../components/Prontuario/ProximasConsultas';
import ProntuarioPendencias from '../../../components/Prontuario/ProntuarioPendencias';

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

const ATTACHMENT_EDITOR_ROLES = new Set([
  'admin',
  'coordenacao',
  'presidente',
  'vice',
  'coord_atendimento',
  'diretoria_extensao',
  'professor',
  'profissional',
  'aluno'
]);

const PROJECT_LINK_EDITOR_ROLES = new Set([
  'admin',
  'coordenacao',
  'presidente',
  'vice',
  'coord_atendimento',
  'diretoria_extensao',
  'professor',
  'profissional'
]);

const normalizeStringArray = (value) => {
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

const PatientProntuario = ({ patient, onBack, originPath = '', originView = '', originTab = '' }) => {
  const [avaliacoes, setAvaliacoes] = useState([]);
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [isAppointmentOpen, setIsAppointmentOpen] = useState(false);
  const [appointments, setAppointments] = useState([]);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [isRefreshingAppointments, setIsRefreshingAppointments] = useState(false);
  const [appointmentsLastSyncedAt, setAppointmentsLastSyncedAt] = useState(null);
  const [appointmentsError, setAppointmentsError] = useState('');
  const [summaryDraft, setSummaryDraft] = useState({
    observacoes: '',
    historicoSaude: '',
    comorbidadesPessoais: [],
    comorbidadesFamiliares: []
  });
  const [summarySaved, setSummarySaved] = useState({
    observacoes: '',
    historicoSaude: '',
    comorbidadesPessoais: [],
    comorbidadesFamiliares: []
  });
  const [summaryError, setSummaryError] = useState('');
  const [isSavingSummary, setIsSavingSummary] = useState(false);
  const [professorMessage, setProfessorMessage] = useState('');
  const [professorMessages, setProfessorMessages] = useState([]);
  const [professorMessageError, setProfessorMessageError] = useState('');
  const [isSavingProfessorMessage, setIsSavingProfessorMessage] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [openingAttachmentId, setOpeningAttachmentId] = useState('');
  const [removingAttachmentId, setRemovingAttachmentId] = useState('');
  const [attachmentError, setAttachmentError] = useState('');
  const pageSize = 80;
  const [activeTab, setActiveTab] = useState('visao-geral');
  const [timelineVisibleCount, setTimelineVisibleCount] = useState(8);
  const [timelineFilterType, setTimelineFilterType] = useState('avaliacao');
  const [timelineFilterStatus, setTimelineFilterStatus] = useState('all');
  const [timelineSearch, setTimelineSearch] = useState('');
  const [consultationStatusFilter, setConsultationStatusFilter] = useState('all');
  const [consultationTypeFilter, setConsultationTypeFilter] = useState('all');
  const [consultationPeriodFilter, setConsultationPeriodFilter] = useState('all');
  const [consultationSearch, setConsultationSearch] = useState('');
  const [consultationVisibleCount, setConsultationVisibleCount] = useState(10);
  const [attachmentsPageSize] = useState(6);
  const [attachmentsVisibleCount, setAttachmentsVisibleCount] = useState(6);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [isReleasingEbia, setIsReleasingEbia] = useState(false);
  const [projectLink, setProjectLink] = useState({
    id: '',
    nome: ''
  });
  const consultationHistoryRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { isProfessor, user } = useAuth();
  const {
    getAvaliacoesByPacientePaged,
    formatDate,
    convertFirebaseDate,
    updatePaciente
  } = usePacientes();
  const { notify } = useUiFeedback();

  useModalBodyLock(isProjectModalOpen);

  const moduleConfig = useMemo(() => {
    return listEvaluationRegistryByContext('prontuario').map((item) => ({
      id: item.moduleId || item.type,
      label: item.shortLabel || item.label,
      tipo: item.type
    }));
  }, []);
  const comorbidadesOptions = [
    { id: 'diabetes', label: 'Diabetes Mellitus - Tipo 1 ou 2' },
    { id: 'hipertensao', label: 'Hipertensão - Pressão alta' },
    { id: 'anemia', label: 'Anemia' },
    { id: 'cardio', label: 'Doenças cardiovasculares - Doenças do coração (infarto, angina, arritmia...)' },
    { id: 'dislipidemia', label: 'Dislipidemia - Colesterol e/ou triglicerídeos elevados' },
    { id: 'renal_hepatica', label: 'Doença renal ou hepática' },
    { id: 'tireoide', label: 'Doença da tireoide (hipotireoidismo / hipertireoidismo)' },
    { id: 'nenhum', label: 'Não possuo nenhum diagnóstico' }
  ];

  const normalizedUserRole = normalizeRole(user?.role);
  const currentUserId = user?.uid || user?.id || '';
  const isPatientResponsible = Boolean(
    currentUserId
    && (patient?.alunoResponsavelId === currentUserId || patient?.alunoResponsavel?.id === currentUserId)
  );
  const isPatientTeamMember = Boolean(
    currentUserId
    && Array.isArray(patient?.equipeTecnicaIds)
    && patient.equipeTecnicaIds.includes(currentUserId)
  );
  const canManagePatientFlow = isStudentMemberRole(normalizedUserRole) && (isPatientResponsible || isPatientTeamMember);
  const canLinkProject = PROJECT_LINK_EDITOR_ROLES.has(normalizedUserRole);
  const podeEditarAvaliacoes = canManagePatientFlow;
  const podeEditarResumo = canManagePatientFlow;
  const podeEnviarAnexo = ATTACHMENT_EDITOR_ROLES.has(user?.role);
  const podeRemoverAnexo = ATTACHMENT_EDITOR_ROLES.has(user?.role);
  const patientInitials = useMemo(() => {
    const name = patient?.nome || '';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'PT';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }, [patient?.nome]);
  const patientAge = useMemo(() => {
    const birth = convertFirebaseDate(patient?.dataNascimento);
    if (!birth) return null;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age -= 1;
    return age;
  }, [convertFirebaseDate, patient?.dataNascimento]);
  const patientLastUpdate = useMemo(
    () => convertFirebaseDate(patient?.updatedAt || patient?.createdAt || patient?.dataCadastro),
    [convertFirebaseDate, patient?.createdAt, patient?.dataCadastro, patient?.updatedAt]
  );
  const athleteConfirmation = useMemo(() => (
    patient?.confirmacaoAtleta || {}
  ), [patient?.confirmacaoAtleta]);
  const athleteHasLogin = Boolean(athleteConfirmation?.completed);
  const ebiaSelfFormRelease = useMemo(() => (
    athleteConfirmation?.ebiaSelfForm || {}
  ), [athleteConfirmation?.ebiaSelfForm]);
  const ebiaSelfFormEnabled = Boolean(ebiaSelfFormRelease?.enabled);
  const ebiaSelfFormReleasedAt = useMemo(
    () => convertFirebaseDate(ebiaSelfFormRelease?.releasedAt),
    [convertFirebaseDate, ebiaSelfFormRelease?.releasedAt]
  );
  const ebiaSelfFormConsumedAt = useMemo(
    () => convertFirebaseDate(ebiaSelfFormRelease?.consumedAt),
    [convertFirebaseDate, ebiaSelfFormRelease?.consumedAt]
  );
  const dadosGeraisFields = useMemo(() => {
    const athleteInitialData = athleteConfirmation?.dados || {};
    return [
    { label: 'Nome completo', value: athleteInitialData.nomeCompleto || patient?.nome || '', group: 'identificacao' },
    { label: 'Data de nascimento', value: athleteInitialData.dataNascimento || patient?.dataNascimento || '', group: 'identificacao' },
    { label: 'Pessoas na casa', value: athleteInitialData.pessoasCasa, group: 'socioeconomico' },
    { label: 'Renda média (SM)', value: athleteInitialData.rendaMediaSm, group: 'socioeconomico' },
    { label: 'Escolaridade', value: athleteInitialData.escolaridade, group: 'socioeconomico' },
    { label: 'Motivo do atendimento', value: athleteInitialData.motivoAtendimento, group: 'clinico' },
    { label: 'Usa medicamento/suplemento', value: athleteInitialData.usaMedicamentoSuplemento, group: 'clinico' },
    { label: 'Detalhes do medicamento', value: athleteInitialData.medicamentoDetalhes, group: 'clinico' },
    { label: 'Diagnósticos pessoais', value: athleteInitialData.diagnosticosPessoais, group: 'clinico' },
    { label: 'Histórico familiar', value: athleteInitialData.historicoFamiliar, group: 'clinico' },
    { label: 'Condições gastrointestinais', value: athleteInitialData.condicaoGastrointestinal, group: 'clinico' },
    { label: 'Alergia/intolerância', value: athleteInitialData.alergiaIntolerancia, group: 'clinico' },
    { label: 'Não gosta de comer', value: athleteInitialData.naoGostaComer, group: 'alimentar' },
    { label: 'Ingestão de água', value: athleteInitialData.ingestaoAgua, group: 'alimentar' },
    { label: 'Litros de água/dia', value: athleteInitialData.litrosAguaDia, group: 'alimentar' },
    { label: 'Prepara refeições', value: athleteInitialData.preparaRefeicoes, group: 'alimentar' },
    { label: 'Quem prepara', value: athleteInitialData.quemPrepara, group: 'alimentar' },
    { label: 'Temperos usados', value: athleteInitialData.temperos, group: 'alimentar' },
    { label: 'Óleos e gorduras', value: athleteInitialData.oleosGorduras, group: 'alimentar' },
    { label: 'Equipamentos em casa', value: athleteInitialData.equipamentosCasa, group: 'alimentar' },
    { label: 'Bebida alcoólica', value: athleteInitialData.bebidaAlcoolica, group: 'alimentar' },
    { label: 'Atividade física (horário/frequência)', value: athleteInitialData.atividadeFisica, group: 'rotina' },
    { label: 'Fuma atualmente', value: athleteInitialData.fuma, group: 'rotina' },
    { label: 'Frequência de delivery', value: athleteInitialData.deliveryFrequencia, group: 'rotina' },
    { label: 'Dificuldade para dormir', value: athleteInitialData.dificuldadeDormir, group: 'rotina' },
    { label: 'Rotina manhã', value: athleteInitialData.rotinaManha, group: 'rotina' },
    { label: 'Rotina tarde', value: athleteInitialData.rotinaTarde, group: 'rotina' },
    { label: 'Rotina noite', value: athleteInitialData.rotinaNoite, group: 'rotina' },
    { label: 'Horário que dorme', value: athleteInitialData.horarioDormir, group: 'rotina' },
    { label: 'Horário que acorda', value: athleteInitialData.horarioAcordar, group: 'rotina' }
    ];
  }, [athleteConfirmation?.dados, patient?.dataNascimento, patient?.nome]);

  const loadAvaliacoes = useCallback(async () => {
    if (!patient?.id) {
      setAvaliacoes([]);
      return;
    }
    try {
      const { items } = await getAvaliacoesByPacientePaged(patient.id, null, pageSize);
      setAvaliacoes(items || []);
    } catch (error) {
      console.error('Erro ao carregar avaliações:', error);
      const message = getApiErrorMessage(error, 'Não foi possível carregar as avaliações.');
      setAvaliacoes([]);
      notify({
        type: 'error',
        title: 'Erro ao carregar avaliações',
        message
      });
    }
  }, [getAvaliacoesByPacientePaged, notify, pageSize, patient?.id]);

  useEffect(() => {
    loadAvaliacoes();
  }, [loadAvaliacoes]);

  const loadAppointments = useCallback(async ({ preserveCurrent = false } = {}) => {
    if (!patient?.id) {
      setAppointments([]);
      setAppointmentsError('');
      return;
    }

    if (preserveCurrent) {
      setIsRefreshingAppointments(true);
    } else {
      setLoadingAppointments(true);
    }
    setAppointmentsError('');
    try {
      const response = await api.get('/agendamentos', { params: { pacienteId: patient.id, limit: 200 } });
      const data = Array.isArray(response.data) ? response.data : [];
      const sorted = data
        .map((item) => ({
          ...item,
          dateObj: convertFirebaseDate(item.scheduledAt || item.date)
        }))
        .sort((a, b) => (b.dateObj || 0) - (a.dateObj || 0));
      setAppointments(sorted);
      setAppointmentsLastSyncedAt(new Date());
    } catch (error) {
      console.error('Erro ao carregar agenda:', error);
      const message = getApiErrorMessage(error, 'Não foi possível buscar as consultas.');
      setAppointmentsError(message);
      notify({
        type: 'error',
        title: 'Erro ao carregar agenda',
        message
      });
      setAppointments([]);
    } finally {
      if (preserveCurrent) {
        setIsRefreshingAppointments(false);
      } else {
        setLoadingAppointments(false);
      }
    }
  }, [convertFirebaseDate, notify, patient?.id]);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  const handleRefreshAppointments = useCallback(() => {
    loadAppointments({ preserveCurrent: true });
  }, [loadAppointments]);

  useEffect(() => {
    const athleteInitialData = athleteConfirmation?.dados || {};
    const observacoes = patient?.observacoes || athleteInitialData?.observacoes || '';
    const historicoSaude = patient?.historicoSaude || athleteInitialData?.historicoSaude || '';
    const comorbidadesPessoais = normalizeStringArray(
      (patient?.comorbidadesPessoais || []).length
        ? patient?.comorbidadesPessoais
        : athleteInitialData?.comorbidadesPessoais
    );
    const comorbidadesFamiliares = normalizeStringArray(
      (patient?.comorbidadesFamiliares || []).length
        ? patient?.comorbidadesFamiliares
        : athleteInitialData?.comorbidadesFamiliares
    );
    setSummaryDraft({ observacoes, historicoSaude, comorbidadesPessoais, comorbidadesFamiliares });
    setSummarySaved({ observacoes, historicoSaude, comorbidadesPessoais, comorbidadesFamiliares });
  }, [
    athleteConfirmation?.dados,
    patient?.comorbidadesFamiliares,
    patient?.comorbidadesPessoais,
    patient?.historicoSaude,
    patient?.observacoes
  ]);

  useEffect(() => {
    const items = Array.isArray(patient?.anexos) ? patient.anexos : [];
    const normalized = items
      .map((item, index) => ({
        ...item,
        id: item.id || item.path || `${patient?.id || 'anexo'}-${index}`,
        uploadedAt: item.uploadedAt || item.createdAt || item.date
      }))
      .sort((a, b) => {
        const aDate = convertFirebaseDate(a.uploadedAt) || 0;
        const bDate = convertFirebaseDate(b.uploadedAt) || 0;
        return bDate - aDate;
      });
    setAttachments(normalized);
    setAttachmentsVisibleCount(attachmentsPageSize);
  }, [attachmentsPageSize, convertFirebaseDate, patient?.anexos, patient?.id]);

  useEffect(() => {
    const stored = Array.isArray(patient?.mensagensProfessor) ? patient.mensagensProfessor : [];
    setProfessorMessages(stored);
  }, [patient?.mensagensProfessor]);

  useEffect(() => {
    setProjectLink({
      id: patient?.projetoId || '',
      nome: patient?.projetoNome || ''
    });
  }, [patient?.id, patient?.projetoId, patient?.projetoNome]);

  useEffect(() => {
    setTimelineVisibleCount(8);
  }, [patient?.id, timelineFilterType, timelineFilterStatus, timelineSearch]);

  useEffect(() => {
    setActiveTab('visao-geral');
  }, [patient?.id]);

  useEffect(() => {
    setConsultationVisibleCount(10);
  }, [patient?.id, consultationStatusFilter, consultationTypeFilter, consultationPeriodFilter, consultationSearch]);

  useEffect(() => {
    if (!isProjectModalOpen) return;
    let isActive = true;
    setLoadingProjects(true);
    api.get('/projetos')
      .then((response) => {
        if (!isActive) return;
        const rows = Array.isArray(response.data) ? response.data : [];
        const sorted = rows.slice().sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        setProjects(sorted);
      })
      .catch((error) => {
        if (!isActive) return;
        const status = Number(error?.response?.status || 0);
        const message = status === 403
          ? 'Seu perfil não possui permissão para consultar projetos neste prontuário.'
          : getApiErrorMessage(error, 'Não foi possível carregar os projetos.');
        notify({
          type: 'error',
          title: 'Erro ao carregar projetos',
          message
        });
      })
      .finally(() => {
        if (isActive) {
          setLoadingProjects(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [isProjectModalOpen, notify]);

  useEffect(() => {
    if (!isProjectModalOpen) return;
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !isSavingProject) {
        event.preventDefault();
        setIsProjectModalOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isProjectModalOpen, isSavingProject]);

  const avaliacoesOrdenadas = useMemo(() => {
    return [...avaliacoes].sort((a, b) => {
      const aDate = convertFirebaseDate(a.createdAt || a.data) || 0;
      const bDate = convertFirebaseDate(b.createdAt || b.data) || 0;
      return bDate - aDate;
    });
  }, [avaliacoes, convertFirebaseDate]);

  const nextAppointment = useMemo(() => {
    const now = new Date();
    return appointments
      .map((item) => ({
        ...item,
        scheduledDate: convertFirebaseDate(item.scheduledAt || item.date)
      }))
      .filter((item) => item.scheduledDate && item.scheduledDate >= now && (item.status || 'agendada') === 'agendada')
      .sort((a, b) => a.scheduledDate - b.scheduledDate)[0];
  }, [appointments, convertFirebaseDate]);

  const consultationHistory = useMemo(() => (
    appointments.map((item) => {
      const scheduledDate = convertFirebaseDate(item.scheduledAt || item.date);
      const now = new Date();
      const period = scheduledDate && scheduledDate >= now ? 'future' : 'past';
      return {
        ...item,
        scheduledDate,
        period,
        normalizedStatus: String(item.status || 'agendada').toLowerCase(),
        normalizedType: String(item.appointmentType || '').toLowerCase(),
        professionalName: item.alunoNome || item.professorNome || '',
        evaluationsCount: Array.isArray(item.evaluations) ? item.evaluations.length : 0
      };
    })
  ), [appointments, convertFirebaseDate]);

  const consultationStatusOptions = useMemo(() => {
    const statuses = new Set();
    consultationHistory.forEach((item) => {
      if (item.normalizedStatus) statuses.add(item.normalizedStatus);
    });
    const canonicalOrder = ['agendada', 'realizada', 'remarcada', 'falta'];
    return [
      ...canonicalOrder.filter((status) => statuses.has(status)),
      ...Array.from(statuses)
        .filter((status) => !canonicalOrder.includes(status))
        .sort((a, b) => a.localeCompare(b))
    ];
  }, [consultationHistory]);

  const filteredConsultationHistory = useMemo(() => {
    const term = consultationSearch.trim().toLowerCase();
    return consultationHistory.filter((item) => {
      if (consultationStatusFilter !== 'all' && item.normalizedStatus !== consultationStatusFilter) return false;
      if (consultationTypeFilter !== 'all' && item.normalizedType !== consultationTypeFilter) return false;
      if (consultationPeriodFilter !== 'all' && item.period !== consultationPeriodFilter) return false;
      if (term) {
        const haystack = [
          item.pacienteNome,
          item.professionalName,
          item.time,
          APPOINTMENT_STATUS_LABELS[item.normalizedStatus],
          APPOINTMENT_TYPE_LABELS[item.normalizedType]
        ].join(' ').toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [
    consultationHistory,
    consultationSearch,
    consultationStatusFilter,
    consultationTypeFilter,
    consultationPeriodFilter
  ]);

  const visibleConsultationHistory = useMemo(
    () => filteredConsultationHistory.slice(0, consultationVisibleCount),
    [filteredConsultationHistory, consultationVisibleCount]
  );

  const consultationHasMore = filteredConsultationHistory.length > visibleConsultationHistory.length;

  const consultationStatusSummary = useMemo(() => (
    consultationHistory.reduce((acc, item) => {
      const key = item.normalizedStatus || 'agendada';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {})
  ), [consultationHistory]);

  const hasConsultationFiltersApplied = useMemo(() => (
    consultationStatusFilter !== 'all'
    || consultationTypeFilter !== 'all'
    || consultationPeriodFilter !== 'all'
    || consultationSearch.trim().length > 0
  ), [
    consultationStatusFilter,
    consultationTypeFilter,
    consultationPeriodFilter,
    consultationSearch
  ]);

  const appointmentsSyncLabel = useMemo(() => {
    if (!appointmentsLastSyncedAt) return 'Sincronização pendente';
    return `Atualizado às ${appointmentsLastSyncedAt.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })}`;
  }, [appointmentsLastSyncedAt]);

  const getAppointmentTypeLabel = useCallback((appointment) => {
    const key = String(appointment?.appointmentType || '').toLowerCase();
    return APPOINTMENT_TYPE_LABELS[key] || 'Não informado';
  }, []);

  const getAppointmentStatusLabel = useCallback((status) => {
    const key = String(status || '').toLowerCase();
    return APPOINTMENT_STATUS_LABELS[key] || (key ? `${key.charAt(0).toUpperCase()}${key.slice(1)}` : 'Sem status');
  }, []);
  const lastEvaluation = useMemo(() => {
    if (!avaliacoesOrdenadas.length) return null;
    const item = avaliacoesOrdenadas[0];
    return convertFirebaseDate(item.createdAt || item.data) || null;
  }, [avaliacoesOrdenadas, convertFirebaseDate]);

  const pendingModules = useMemo(() => {
    const completed = new Set(
      avaliacoesOrdenadas
        .filter((item) => item.status === 'finalizada')
        .map((item) => item.tipo)
    );
    return moduleConfig.filter((mod) => !completed.has(mod.tipo));
  }, [avaliacoesOrdenadas, moduleConfig]);

  const prontuarioSignals = useMemo(() => {
    const consultasRealizadas = consultationStatusSummary.realizada || 0;
    const consultasAgendadas = consultationStatusSummary.agendada || 0;
    const consultasFalta = consultationStatusSummary.falta || 0;

    return [
      {
        id: 'cadastro',
        label: 'Cadastro inicial',
        value: athleteHasLogin ? 'Confirmado' : 'Pendente',
        tone: athleteHasLogin ? 'ok' : 'warning'
      },
      {
        id: 'pendencias',
        label: 'Pendências clínicas',
        value: `${pendingModules.length} módulo(s)`,
        tone: pendingModules.length === 0 ? 'ok' : pendingModules.length <= 2 ? 'attention' : 'warning'
      },
      {
        id: 'consultas-realizadas',
        label: 'Consultas realizadas',
        value: `${consultasRealizadas}`,
        tone: consultasRealizadas > 0 ? 'ok' : 'neutral'
      },
      {
        id: 'consultas-agendadas',
        label: 'Consultas agendadas',
        value: `${consultasAgendadas}`,
        tone: consultasAgendadas > 0 ? 'attention' : 'neutral'
      },
      {
        id: 'faltas',
        label: 'Faltas registradas',
        value: `${consultasFalta}`,
        tone: consultasFalta > 0 ? 'warning' : 'ok'
      },
      {
        id: 'anexos',
        label: 'Anexos clínicos',
        value: `${attachments.length} arquivo(s)`,
        tone: attachments.length > 0 ? 'ok' : 'neutral'
      },
      {
        id: 'mensagens',
        label: 'Mensagens do professor',
        value: `${professorMessages.length} registro(s)`,
        tone: professorMessages.length > 0 ? 'attention' : 'neutral'
      },
      {
        id: 'ultima-avaliacao',
        label: 'Última avaliação',
        value: lastEvaluation ? formatDate(lastEvaluation) : 'Sem registros',
        tone: lastEvaluation ? 'ok' : 'warning'
      }
    ];
  }, [
    athleteHasLogin,
    attachments.length,
    consultationStatusSummary.agendada,
    consultationStatusSummary.falta,
    consultationStatusSummary.realizada,
    formatDate,
    lastEvaluation,
    pendingModules.length,
    professorMessages.length
  ]);

  const pendingModulesSummary = useMemo(() => {
    if (!pendingModules.length) return 'Sem pendências de avaliação abertas.';
    return pendingModules.map((item) => item.label).join(' • ');
  }, [pendingModules]);

  const timelineEvents = useMemo(() => {
    const evaluationEvents = avaliacoesOrdenadas.map((item) => {
      const typeLabel = getEvaluationTypeLabel(item.tipo);
      const statusLabel = getEvaluationStatusLabel(item.status || 'rascunho');
      const responsible = item.alunoNome || item.createdByName || patient?.alunoResponsavel?.nome || patient?.alunoResponsavelNome || 'Equipe LAINES';
      const metricSummary = buildEvaluationTimelineSummary(item);
      return {
        id: `avaliacao-${item.id}`,
        type: 'avaliacao',
        title: typeLabel,
        description: [
          `Status ${statusLabel}`,
          metricSummary,
          responsible
        ].filter(Boolean).join(' • '),
        status: item.status || 'rascunho',
        date: convertFirebaseDate(item.createdAt || item.data),
        meta: { ...(item.meta || {}), tipo: item.tipo },
        searchText: `${typeLabel} ${statusLabel} ${responsible}`.toLowerCase()
      };
    });

    const appointmentEvents = appointments.map((item) => {
      const normalizedStatus = String(item.status || 'agendada').toLowerCase();
      const appointmentType = getAppointmentTypeLabel(item);
      const professionalName = item.alunoNome || item.professorNome || 'Profissional não informado';
      const statusLabel = getAppointmentStatusLabel(normalizedStatus);
      return {
        id: `consulta-${item.id}`,
        type: 'consulta',
        title: `Consulta ${appointmentType}`,
        description: `${statusLabel} • ${professionalName}${item.time ? ` • ${item.time}` : ''}`,
        status: normalizedStatus,
        date: convertFirebaseDate(item.scheduledAt || item.date),
        meta: { hora: item.time },
        searchText: `${appointmentType} ${statusLabel} ${professionalName} ${item.time || ''}`.toLowerCase()
      };
    });

    const professorMessageEvents = professorMessages.map((message, index) => {
      const text = String(message.texto || '').trim();
      const professorName = message.professorNome || 'Professor';
      const safeText = text || 'Mensagem sem conteúdo';
      return {
        id: `observacao-professor-${message.id || `${safeText.slice(0, 24)}-${index}`}`,
        type: 'observacao',
        title: `Observação do professor`,
        description: `${professorName}: ${safeText}`,
        status: 'registrado',
        date: convertFirebaseDate(message.createdAt),
        meta: {},
        searchText: `${professorName} ${safeText}`.toLowerCase()
      };
    });

    return [...evaluationEvents, ...appointmentEvents, ...professorMessageEvents]
      .filter((item) => item.date)
      .sort((a, b) => b.date - a.date);
  }, [
    avaliacoesOrdenadas,
    appointments,
    convertFirebaseDate,
    getAppointmentStatusLabel,
    getAppointmentTypeLabel,
    patient?.alunoResponsavel?.nome,
    patient?.alunoResponsavelNome,
    professorMessages
  ]);

  const filteredTimelineEvents = useMemo(() => {
    const term = timelineSearch.trim().toLowerCase();
    return timelineEvents.filter((event) => {
      if (timelineFilterType !== 'all' && event.type !== timelineFilterType) return false;
      if (timelineFilterStatus !== 'all' && event.status !== timelineFilterStatus) return false;
      if (term) {
        const title = String(event.title || '').toLowerCase();
        const description = String(event.description || '').toLowerCase();
        const searchText = String(event.searchText || '').toLowerCase();
        if (!title.includes(term) && !description.includes(term) && !searchText.includes(term)) {
          return false;
        }
      }
      return true;
    });
  }, [timelineEvents, timelineFilterStatus, timelineFilterType, timelineSearch]);

  const visibleTimeline = filteredTimelineEvents.slice(0, timelineVisibleCount);
  const timelineHasMore = filteredTimelineEvents.length > visibleTimeline.length;
  const visibleAttachments = Math.min(attachments.length, attachmentsVisibleCount);
  const attachmentsHasMore = attachmentsVisibleCount < attachments.length;

  const handleOpenAvaliacaoTab = useCallback((startTab = 'bioimpedancia') => {
    if (!patient?.id) return;
    const returnTo = originPath || `${location.pathname}${location.search || ''}` || '/aluno';
    navigate(`/avaliacao/${patient.id}`, {
      state: {
        returnTo,
        startTab,
        returnView: originView || 'dashboard',
        returnTab: originTab || 'patients'
      }
    });
  }, [
    navigate,
    originPath,
    originTab,
    originView,
    patient?.id,
    location.pathname,
    location.search
  ]);

  const handleNovaAvaliacao = useCallback(() => {
    handleOpenAvaliacaoTab('bioimpedancia');
  }, [handleOpenAvaliacaoTab]);

  const handleLoadMoreTimeline = () => {
    setTimelineVisibleCount((prev) => prev + 8);
  };

  const handleLoadMoreConsultations = () => {
    setConsultationVisibleCount((prev) => prev + 10);
  };

  const handleClearConsultationFilters = () => {
    setConsultationStatusFilter('all');
    setConsultationTypeFilter('all');
    setConsultationPeriodFilter('all');
    setConsultationSearch('');
  };

  const handleLoadMoreAttachments = () => {
    setAttachmentsVisibleCount((prev) => Math.min(prev + attachmentsPageSize, attachments.length));
  };

  const scrollToSection = useCallback((ref) => {
    if (ref?.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const handleOpenHistory = useCallback(() => {
    setActiveTab('consultas');
    window.requestAnimationFrame(() => {
      scrollToSection(consultationHistoryRef);
    });
  }, [scrollToSection]);

  const handleOpenProjectModal = useCallback(() => {
    if (!canLinkProject) {
      notify({
        type: 'warning',
        title: 'Sem permissão',
        message: 'Apenas equipe responsável pode vincular projeto neste prontuário.'
      });
      return;
    }
    setSelectedProjectId(projectLink.id || '');
    setIsProjectModalOpen(true);
  }, [canLinkProject, notify, projectLink.id]);

  const handleSaveProjectLink = useCallback(async () => {
    if (!patient?.id || isSavingProject) return;

    const selectedProject = projects.find((project) => project.id === selectedProjectId) || null;
    setIsSavingProject(true);
    try {
      await updatePaciente(patient.id, {
        projetoId: selectedProject ? selectedProject.id : null,
        projetoNome: selectedProject ? selectedProject.nome : ''
      });
      setProjectLink({
        id: selectedProject?.id || '',
        nome: selectedProject?.nome || ''
      });
      notify({
        type: 'success',
        title: 'Projeto atualizado',
        message: selectedProject
          ? `Atleta vinculado ao projeto "${selectedProject.nome}".`
          : 'Vínculo de projeto removido do atleta.'
      });
      setIsProjectModalOpen(false);
    } catch (error) {
      notify({
        type: 'error',
        title: 'Erro ao vincular projeto',
        message: getApiErrorMessage(error, 'Não foi possível atualizar o projeto deste atleta.')
      });
    } finally {
      setIsSavingProject(false);
    }
  }, [isSavingProject, notify, patient?.id, projects, selectedProjectId, updatePaciente]);

  const handleReleaseEbiaToAthlete = useCallback(async () => {
    if (!patient?.id || isReleasingEbia || !podeEditarAvaliacoes) return;
    if (!athleteHasLogin) {
      notify({
        type: 'warning',
        title: 'Atleta sem cadastro inicial',
        message: 'O atleta precisa concluir o cadastro inicial antes de responder o EBIA.'
      });
      return;
    }

    const generateReleaseId = () => {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
      }
      return `ebia-${Date.now()}`;
    };

    setIsReleasingEbia(true);
    try {
      await updatePaciente(patient.id, {
        confirmacaoAtleta: {
          ...athleteConfirmation,
          ebiaSelfForm: {
            ...ebiaSelfFormRelease,
            enabled: true,
            releaseId: ebiaSelfFormRelease?.releaseId || generateReleaseId(),
            releasedAt: new Date().toISOString(),
            releasedById: user?.uid || user?.id || '',
            releasedByName: user?.name || user?.email || '',
            consumedAt: null,
            consumedByAvaliacaoId: null
          }
        }
      });
      notify({
        type: 'success',
        title: 'EBIA liberado',
        message: 'O atleta ja pode preencher o formulario EBIA no portal.'
      });
    } catch (error) {
      notify({
        type: 'error',
        title: 'Erro ao liberar EBIA',
        message: getApiErrorMessage(error, 'Não foi possível liberar o formulário EBIA para o atleta.')
      });
    } finally {
      setIsReleasingEbia(false);
    }
  }, [
    athleteHasLogin,
    athleteConfirmation,
    ebiaSelfFormRelease,
    isReleasingEbia,
    notify,
    patient?.id,
    podeEditarAvaliacoes,
    updatePaciente,
    user?.email,
    user?.id,
    user?.name,
    user?.uid
  ]);

  const getTimelineStatusLabel = useCallback((event) => {
    if (event.type === 'consulta') {
      return APPOINTMENT_STATUS_LABELS[event.status] || event.status || 'Sem status';
    }
    if (event.type === 'observacao') {
      return 'Registrado';
    }
    return getEvaluationStatusLabel(event.status || 'pendente');
  }, []);

  const getTimelineStatusOptionLabel = useCallback((status) => {
    if (status === 'registrado') return 'Registrado';
    if (APPOINTMENT_STATUS_LABELS[status]) return APPOINTMENT_STATUS_LABELS[status];
    return getEvaluationStatusLabel(status || 'pendente');
  }, []);

  const continuityItems = useMemo(() => {
    const items = [];

    if (!nextAppointment) {
      items.push({
        id: 'sem-consulta',
        level: 'alto',
        title: 'Sem próxima consulta agendada',
        description: 'Defina o próximo atendimento para manter o acompanhamento ativo.'
      });
    }

    if (pendingModules.length > 0) {
      items.push({
        id: 'modulos-pendentes',
        level: 'medio',
        title: `${pendingModules.length} módulo(s) de avaliação pendente(s)`,
        description: pendingModules.slice(0, 3).map((module) => module.label).join(' • ')
      });
    }

    if (!projectLink?.id) {
      items.push({
        id: 'projeto',
        level: 'medio',
        title: 'Atleta sem projeto vinculado',
        description: 'Vincule o projeto para rastrear indicadores institucionais.'
      });
    }

    if (!summarySaved.observacoes?.trim()) {
      items.push({
        id: 'observacao',
        level: 'medio',
        title: 'Resumo clínico sem queixa principal',
        description: 'Registre a queixa principal para facilitar continuidade do cuidado.'
      });
    }

    if (!athleteHasLogin) {
      items.push({
        id: 'cadastro-inicial',
        level: 'alto',
        title: 'Cadastro inicial do atleta pendente',
        description: 'O atleta ainda não confirmou os dados no primeiro acesso.'
      });
    }

    if ((consultationStatusSummary.falta || 0) > 0) {
      items.push({
        id: 'faltas',
        level: 'atencao',
        title: `${consultationStatusSummary.falta} falta(s) registrada(s)`,
        description: 'Reavalie a estratégia de adesão e remarcações.'
      });
    }

    if (items.length === 0) {
      items.push({
        id: 'fluxo-ok',
        level: 'ok',
        title: 'Fluxo clínico em dia',
        description: 'Consultas, avaliação e contexto clínico estão atualizados.'
      });
    }

    return items;
  }, [
    athleteHasLogin,
    consultationStatusSummary.falta,
    nextAppointment,
    pendingModules,
    projectLink?.id,
    summarySaved.observacoes
  ]);

  const prontuarioTabs = useMemo(() => ([
    { id: 'visao-geral', label: 'Visão Geral', enabled: true },
    { id: 'dados-clinicos', label: 'Dados Clínicos', enabled: true },
    { id: 'avaliacoes', label: 'Avaliações', enabled: true, count: avaliacoesOrdenadas.length },
    { id: 'consultas', label: 'Consultas', enabled: true, count: consultationHistory.length },
    { id: 'anexos', label: 'Anexos', enabled: true, count: attachments.length },
    { id: 'pendencias', label: 'Pendências', enabled: true, count: pendingModules.length }
  ]), [avaliacoesOrdenadas.length, attachments.length, consultationHistory.length, pendingModules.length]);

  const headerSubtitle = useMemo(() => {
    const modalidade = patient?.modalidadePrincipal || patient?.modalidade || 'Modalidade não informada';
    const updatedLabel = patientLastUpdate ? formatDate(patientLastUpdate) : 'Sem atualização';
    const vat = patient?.vat || patient?.vaf || patient?.valorAtendimento;
    const vatLabel = vat ? `VAT ${vat}` : null;
    const ageLabel = patientAge ? `${patientAge} anos` : null;
    return [modalidade, ageLabel, vatLabel, `Modificado ${updatedLabel}`].filter(Boolean).join(' · ');
  }, [
    formatDate,
    patient?.modalidade,
    patient?.modalidadePrincipal,
    patient?.vaf,
    patient?.valorAtendimento,
    patient?.vat,
    patientAge,
    patientLastUpdate
  ]);

  const timelineStatusOptionsEvaluation = useMemo(() => {
    const statuses = new Set();
    timelineEvents
      .filter((event) => event.type === 'avaliacao')
      .forEach((event) => {
        if (event.status) statuses.add(event.status);
      });
    return Array.from(statuses);
  }, [timelineEvents]);

  const exportConsultationHistoryCsv = useCallback(() => {
    if (filteredConsultationHistory.length === 0) {
      notify({
        type: 'warning',
        title: 'Sem consultas para exportar',
        message: 'Ajuste os filtros para exportar o histórico de consultas.'
      });
      return;
    }

    const sanitizeCsvValue = (value) => {
      const raw = value === null || value === undefined ? '' : String(value);
      if (raw.includes(';') || raw.includes('"') || raw.includes('\n')) {
        return `"${raw.replace(/"/g, '""')}"`;
      }
      return raw;
    };

    const headers = ['Data', 'Horario', 'Tipo', 'Status', 'Profissional', 'Avaliacoes'];
    const rows = filteredConsultationHistory.map((item) => [
      item.scheduledDate ? formatDate(item.scheduledDate) : '---',
      item.time || '--:--',
      getAppointmentTypeLabel(item),
      getAppointmentStatusLabel(item.normalizedStatus),
      item.professionalName || '---',
      String(item.evaluationsCount || 0)
    ]);

    const csv = [headers, ...rows]
      .map((line) => line.map(sanitizeCsvValue).join(';'))
      .join('\n');

    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `historico-consultas-${(patient?.nome || 'atleta').toLowerCase().replace(/\s+/g, '-')}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.URL.revokeObjectURL(url);

    notify({
      type: 'success',
      title: 'Histórico exportado',
      message: `${filteredConsultationHistory.length} consultas exportadas em CSV.`
    });
  }, [filteredConsultationHistory, formatDate, getAppointmentStatusLabel, getAppointmentTypeLabel, notify, patient?.nome]);

  const handleSummaryChange = (field, value) => {
    setSummaryDraft((prev) => ({ ...prev, [field]: value }));
  };
  const handleToggleComorbidade = (field, id) => {
    setSummaryDraft((prev) => {
      const current = new Set(prev[field] || []);
      if (id === 'nenhum') {
        if (current.has('nenhum')) {
          current.clear();
        } else {
          current.clear();
          current.add('nenhum');
        }
      } else {
        current.delete('nenhum');
        if (current.has(id)) {
          current.delete(id);
        } else {
          current.add(id);
        }
      }
      return { ...prev, [field]: Array.from(current) };
    });
  };

  const getComorbidadeLabel = (id) => {
    const match = comorbidadesOptions.find((item) => item.id === id);
    return match ? match.label : id;
  };
  const formatGeneralValue = (value) => {
    if (value === null || value === undefined || value === '') return '---';
    return String(value);
  };
  const formatGeneralDate = (value) => {
    if (!value) return '---';
    const dateValue = convertFirebaseDate(value);
    if (dateValue) return formatDate(dateValue);
    return String(value);
  };

  const handleSummaryCancel = () => {
    setSummaryDraft(summarySaved);
    setSummaryError('');
    setIsEditingSummary(false);
  };

  const handleSummarySave = async () => {
    if (!patient?.id || !podeEditarResumo) return;
    setIsSavingSummary(true);
    setSummaryError('');
    try {
      const trimmedDraft = {
        ...summaryDraft,
        observacoes: (summaryDraft.observacoes || '').trim(),
        historicoSaude: (summaryDraft.historicoSaude || '').trim()
      };
      await updatePaciente(patient.id, {
        observacoes: trimmedDraft.observacoes,
        historicoSaude: trimmedDraft.historicoSaude,
        comorbidadesPessoais: trimmedDraft.comorbidadesPessoais || [],
        comorbidadesFamiliares: trimmedDraft.comorbidadesFamiliares || []
      });
      setSummarySaved(trimmedDraft);
      setIsEditingSummary(false);
    } catch (error) {
      setSummaryError(getApiErrorMessage(error, 'Não foi possível salvar o resumo clínico.'));
    } finally {
      setIsSavingSummary(false);
    }
  };

  const handleSaveProfessorMessage = async () => {
    if (!patient?.id) return;
    const text = professorMessage.trim();
    if (!text) {
      setProfessorMessageError('Informe uma mensagem para o aluno.');
      return;
    }
    setProfessorMessageError('');
    setIsSavingProfessorMessage(true);
    try {
      const { data } = await api.post(`/pacientes/${patient.id}/mensagens-professor`, {
        texto: text
      });
      setProfessorMessages((prev) => [data, ...prev].slice(0, 200));
      setProfessorMessage('');
    } catch (error) {
      setProfessorMessageError(getApiErrorMessage(error, 'Não foi possível salvar a mensagem.'));
    } finally {
      setIsSavingProfessorMessage(false);
    }
  };

  const handleUploadAttachment = async (event) => {
    if (!patient?.id) return;
    const file = event.target.files?.[0];
    if (!file) return;
    setAttachmentError('');
    setIsUploadingAttachment(true);
    try {
      const upload = await uploadPatientAttachment(patient.id, file);
      const normalizedUpload = {
        ...upload,
        id: upload.id || upload.path || `${patient.id}-upload-${Date.now()}`
      };
      setAttachments((prev) => {
        const updated = [normalizedUpload, ...prev.filter((item) => item.id !== normalizedUpload.id)];
        setAttachmentsVisibleCount((current) => Math.max(current, Math.min(updated.length, attachmentsPageSize)));
        return updated;
      });
    } catch (error) {
      console.error('Erro ao enviar anexo:', error);
      const apiMessage = getApiErrorMessage(error, 'Não foi possível enviar o anexo.');
      setAttachmentError(apiMessage);
      notify({
        type: 'error',
        title: 'Erro ao enviar anexo',
        message: apiMessage
      });
    } finally {
      setIsUploadingAttachment(false);
      event.target.value = '';
    }
  };

  const handleOpenAttachment = async (attachment) => {
    if (!patient?.id || !attachment) return;
    const currentId = String(attachment.id || attachment.path || attachment.url || '');
    setOpeningAttachmentId(currentId);
    try {
      await downloadPatientAttachment(patient.id, attachment);
    } catch (error) {
      const apiMessage = getApiErrorMessage(error, 'Não foi possível abrir o anexo.');
      notify({
        type: 'error',
        title: 'Erro ao abrir anexo',
        message: apiMessage
      });
    } finally {
      setOpeningAttachmentId('');
    }
  };

  const handleRemoveAttachment = async (attachment) => {
    if (!patient?.id || !attachment) return;
    const currentId = String(attachment.id || attachment.path || attachment.url || '');
    setRemovingAttachmentId(currentId);
    setAttachmentError('');

    try {
      await deletePatientAttachment(patient.id, attachment);
      setAttachments((prev) => prev.filter((item) => {
        const itemId = String(item.id || item.path || item.url || '');
        return itemId !== currentId;
      }));
    } catch (error) {
      console.error('Erro ao remover anexo:', error);
      const apiMessage = getApiErrorMessage(error, 'Não foi possível remover o anexo.');
      setAttachmentError(apiMessage);
      notify({
        type: 'error',
        title: 'Erro ao remover anexo',
        message: apiMessage
      });
    } finally {
      setRemovingAttachmentId('');
    }
  };

  const handleTabChange = useCallback((nextTab) => {
    setActiveTab(nextTab);
    if (nextTab === 'avaliacoes') {
      setTimelineFilterType('avaliacao');
    }
    if (nextTab === 'consultas') {
      window.requestAnimationFrame(() => {
        scrollToSection(consultationHistoryRef);
      });
    }
  }, [scrollToSection]);

  return (
    <>
      <div className="prontuario-root pron-page">
        <div className="pron-shell">
        <ProntuarioHeader
          onBack={onBack}
          patientName={patient?.nome}
          patientInitials={patientInitials}
          prontuarioNumber={patient?.prontuario}
          athleteLoginEmail={patient?.email || ''}
          projectName={projectLink?.nome}
          subtitle={headerSubtitle}
          profileIncomplete={!athleteHasLogin}
          canCreateEvaluation={podeEditarAvaliacoes}
          canCreateAppointment={podeEditarAvaliacoes}
          canLinkProject={canLinkProject}
          onCreateEvaluation={handleNovaAvaliacao}
          onCreateAppointment={() => setIsAppointmentOpen(true)}
          onOpenProject={handleOpenProjectModal}
          onOpenHistory={handleOpenHistory}
        />

        {/* REMOVIDO — abas sem conteúdo funcional e seções vazias com placeholder --- — 2026-03-31 */}
        <ProntuarioTabs
          tabs={prontuarioTabs}
          activeTab={activeTab}
          onChange={handleTabChange}
        />

        <div className="pron-main-grid">
          <main className="pron-stack">
            {activeTab === 'visao-geral' && (
              <DashboardAvaliacoes
                patient={patient}
                avaliacoes={avaliacoesOrdenadas}
                consultationStatusSummary={consultationStatusSummary}
                nextAppointment={nextAppointment}
                formatDate={formatDate}
                onOpenEvaluationType={handleOpenAvaliacaoTab}
                onCreateEvaluation={handleNovaAvaliacao}
              />
            )}

            {activeTab === 'dados-clinicos' && (
              <ResumoClinico
                dadosGeraisFields={dadosGeraisFields}
                formatGeneralValue={formatGeneralValue}
                formatGeneralDate={formatGeneralDate}
                athleteHasLogin={athleteHasLogin}
                ebiaSelfFormEnabled={ebiaSelfFormEnabled}
                ebiaSelfFormReleasedAt={ebiaSelfFormReleasedAt}
                ebiaSelfFormConsumedAt={ebiaSelfFormConsumedAt}
                formatDate={formatDate}
                podeEditarAvaliacoes={podeEditarAvaliacoes}
                handleReleaseEbiaToAthlete={handleReleaseEbiaToAthlete}
                isReleasingEbia={isReleasingEbia}
                podeEditarResumo={podeEditarResumo}
                isEditingSummary={isEditingSummary}
                setIsEditingSummary={setIsEditingSummary}
                isSavingSummary={isSavingSummary}
                summaryDraft={summaryDraft}
                summarySaved={summarySaved}
                summaryError={summaryError}
                handleSummaryChange={handleSummaryChange}
                handleSummarySave={handleSummarySave}
                handleSummaryCancel={handleSummaryCancel}
                comorbidadesOptions={comorbidadesOptions}
                handleToggleComorbidade={handleToggleComorbidade}
                getComorbidadeLabel={getComorbidadeLabel}
              />
            )}

            {activeTab === 'avaliacoes' && (
              <section className="pron-card pron-panel">
                <header className="pron-panel-header">
                  <div>
                    <h2>Histórico de Avaliações</h2>
                    <p>{filteredTimelineEvents.length} evento(s) de avaliação no prontuário.</p>
                  </div>
                  <div className="pron-inline-actions">
                    {podeEditarAvaliacoes && (
                      <button type="button" className="pron-btn pron-btn-primary" onClick={handleNovaAvaliacao}>
                        Nova Avaliação
                      </button>
                    )}
                  </div>
                </header>

                <div className="pron-filters-grid">
                  <select
                    value={timelineFilterStatus}
                    onChange={(event) => setTimelineFilterStatus(event.target.value)}
                    aria-label="Filtrar histórico de avaliações por status"
                  >
                    <option value="all">Todos os status</option>
                    {timelineStatusOptionsEvaluation.map((status) => (
                      <option key={status} value={status}>{getTimelineStatusOptionLabel(status)}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={timelineSearch}
                    onChange={(event) => setTimelineSearch(event.target.value)}
                    placeholder="Buscar por avaliação, responsável ou status..."
                    aria-label="Buscar no histórico de avaliações"
                  />
                  <button
                    type="button"
                    className="pron-btn pron-btn-secondary"
                    onClick={() => {
                      setTimelineFilterType('avaliacao');
                      setTimelineFilterStatus('all');
                      setTimelineSearch('');
                    }}
                  >
                    Limpar
                  </button>
                </div>

                {/* REMOVIDO — recálculo JP7 e cálculo inline na timeline; agora usa evaluationResultAdapter — 2026-03-31 */}
                {filteredTimelineEvents.length === 0 ? (
                  <div className="pron-empty">Nenhuma avaliação encontrada com os filtros aplicados.</div>
                ) : (
                  <div className="timeline">
                    {visibleTimeline.map((event) => (
                      <article key={event.id} className="timeline-item">
                        <div className="timeline-dot" aria-hidden="true" />
                        <div className="timeline-item-head">
                          <strong>{event.title}</strong>
                          <span className={`pron-badge status-${event.status || 'rascunho'}`}>
                            {getTimelineStatusLabel(event)}
                          </span>
                        </div>
                        {event.description ? <p className="pron-text-secondary">{event.description}</p> : null}
                        <p className="pron-text-secondary">
                          {formatDate(event.date)}{event.meta?.hora ? ` · ${event.meta.hora}` : ''}
                        </p>
                        <button
                          type="button"
                          className="pron-link-btn"
                          onClick={() => handleOpenAvaliacaoTab(event.meta?.tipo)}
                        >
                          Ver detalhes
                        </button>
                      </article>
                    ))}
                  </div>
                )}

                {timelineHasMore ? (
                  <div className="pron-panel-footer">
                    <button
                      type="button"
                      className="pron-btn pron-btn-secondary"
                      onClick={handleLoadMoreTimeline}
                    >
                      Carregar mais
                    </button>
                  </div>
                ) : null}
              </section>
            )}

            {activeTab === 'consultas' && (
              <div ref={consultationHistoryRef}>
                <TimelineConsultas
                  consultationHistory={consultationHistory}
                  consultationStatusSummary={consultationStatusSummary}
                  consultationStatusOptions={consultationStatusOptions}
                  filteredConsultationHistory={filteredConsultationHistory}
                  visibleConsultationHistory={visibleConsultationHistory}
                  consultationStatusFilter={consultationStatusFilter}
                  consultationTypeFilter={consultationTypeFilter}
                  consultationPeriodFilter={consultationPeriodFilter}
                  consultationSearch={consultationSearch}
                  hasConsultationFiltersApplied={hasConsultationFiltersApplied}
                  consultationHasMore={consultationHasMore}
                  loadingAppointments={loadingAppointments}
                  isRefreshingAppointments={isRefreshingAppointments}
                  appointmentsError={appointmentsError}
                  appointmentsSyncLabel={appointmentsSyncLabel}
                  formatDate={formatDate}
                  getAppointmentTypeLabel={getAppointmentTypeLabel}
                  getAppointmentStatusLabel={getAppointmentStatusLabel}
                  onChangeStatusFilter={setConsultationStatusFilter}
                  onChangeTypeFilter={setConsultationTypeFilter}
                  onChangePeriodFilter={setConsultationPeriodFilter}
                  onChangeSearch={setConsultationSearch}
                  onClearFilters={handleClearConsultationFilters}
                  onRefresh={handleRefreshAppointments}
                  onExportCsv={exportConsultationHistoryCsv}
                  onLoadMore={handleLoadMoreConsultations}
                  onRetryLoad={loadAppointments}
                />
              </div>
            )}

            {activeTab === 'anexos' && (
              <PainelAnexos
                attachments={attachments}
                visibleAttachments={visibleAttachments}
                attachmentsHasMore={attachmentsHasMore}
                podeEnviarAnexo={podeEnviarAnexo}
                podeRemoverAnexo={podeRemoverAnexo}
                isUploadingAttachment={isUploadingAttachment}
                openingAttachmentId={openingAttachmentId}
                removingAttachmentId={removingAttachmentId}
                attachmentError={attachmentError}
                formatDate={formatDate}
                onUpload={handleUploadAttachment}
                onOpenAttachment={handleOpenAttachment}
                onRemoveAttachment={handleRemoveAttachment}
                onLoadMore={handleLoadMoreAttachments}
              />
            )}

            {activeTab === 'pendencias' && (
              <ProntuarioPendencias
                avaliacoes={avaliacoesOrdenadas}
                agendamentos={appointments}
                paciente={patient}
                onOpenEvaluationType={handleOpenAvaliacaoTab}
                onOpenAppointment={() => setIsAppointmentOpen(true)}
              />
            )}
          </main>

          <aside className="pron-side-column">
            <PainelSituacaoClinica
              prontuarioSignals={prontuarioSignals}
              pendingModulesSummary={pendingModulesSummary}
              canCreateEvaluation={podeEditarAvaliacoes}
              onCreateEvaluation={handleNovaAvaliacao}
              onOpenHistory={handleOpenHistory}
            />

            <ProximasConsultas
              continuityItems={continuityItems}
              canCreateActions={podeEditarAvaliacoes}
              canExport={filteredConsultationHistory.length > 0}
              onOpenAppointmentModal={() => setIsAppointmentOpen(true)}
              onCreateEvaluation={handleNovaAvaliacao}
              onOpenHistory={handleOpenHistory}
              onExportCsv={exportConsultationHistoryCsv}
            />

            {activeTab !== 'pendencias' && (
              <ProntuarioPendencias
                avaliacoes={avaliacoesOrdenadas}
                agendamentos={appointments}
                paciente={patient}
                onOpenEvaluationType={handleOpenAvaliacaoTab}
                onOpenAppointment={() => setIsAppointmentOpen(true)}
              />
            )}

            {activeTab !== 'anexos' && (
              <PainelAnexos
                attachments={attachments}
                visibleAttachments={visibleAttachments}
                attachmentsHasMore={attachmentsHasMore}
                podeEnviarAnexo={podeEnviarAnexo}
                podeRemoverAnexo={podeRemoverAnexo}
                isUploadingAttachment={isUploadingAttachment}
                openingAttachmentId={openingAttachmentId}
                removingAttachmentId={removingAttachmentId}
                attachmentError={attachmentError}
                formatDate={formatDate}
                onUpload={handleUploadAttachment}
                onOpenAttachment={handleOpenAttachment}
                onRemoveAttachment={handleRemoveAttachment}
                onLoadMore={handleLoadMoreAttachments}
              />
            )}

            <PainelMensagens
              isProfessor={isProfessor}
              professorMessages={professorMessages}
              professorMessage={professorMessage}
              professorMessageError={professorMessageError}
              isSavingProfessorMessage={isSavingProfessorMessage}
              formatDate={formatDate}
              onChangeMessage={setProfessorMessage}
              onSaveMessage={handleSaveProfessorMessage}
            />
          </aside>
        </div>
        </div>
      </div>
      {isProjectModalOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="project-link-modal-overlay app-modal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isSavingProject) {
              setIsProjectModalOpen(false);
            }
          }}
        >
          <div
            className="project-link-modal app-modal-shell app-modal-shell--sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="project-link-modal-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="project-link-modal__header app-modal-header">
              <div className="app-modal-heading">
                <h2 id="project-link-modal-title" className="app-modal-title">Projeto do atleta</h2>
                <p className="app-modal-subtitle">Selecione o projeto para este prontuário.</p>
              </div>
              <button
                type="button"
                className="app-modal-close"
                onClick={() => setIsProjectModalOpen(false)}
                disabled={isSavingProject}
                aria-label="Fechar modal de projeto"
              >
                <X size={15} />
              </button>
            </div>
            <div className="project-link-modal__body">
              <label htmlFor="project-link-select">Projeto</label>
              <select
                id="project-link-select"
                value={selectedProjectId}
                onChange={(event) => setSelectedProjectId(event.target.value)}
                disabled={loadingProjects || isSavingProject}
              >
                <option value="">Sem projeto</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.nome}
                  </option>
                ))}
              </select>
              <p className="project-link-modal__hint">
                {loadingProjects ? 'Carregando projetos...' : 'O vínculo será refletido na área administrativa.'}
              </p>
            </div>
            <div className="project-link-modal__footer app-modal-footer">
              <div className="app-modal-actions">
                <button
                  type="button"
                  className="app-modal-btn app-modal-btn--secondary"
                  onClick={() => setIsProjectModalOpen(false)}
                  disabled={isSavingProject}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="app-modal-btn app-modal-btn--primary"
                  onClick={handleSaveProjectLink}
                  disabled={loadingProjects || isSavingProject}
                >
                  {isSavingProject ? (
                    <>
                      <Loader2 size={14} className="spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <FolderKanban size={14} />
                      Salvar vínculo
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
      <AppointmentModal
        isOpen={isAppointmentOpen}
        onClose={() => setIsAppointmentOpen(false)}
        patient={patient}
        onSuccess={() => loadAppointments({ preserveCurrent: true })}
      />
    </>
  );
};

// REMOVIDO — cálculo inline de resumo da timeline movido para evaluationResultAdapter — 2026-03-31
export default PatientProntuario;
