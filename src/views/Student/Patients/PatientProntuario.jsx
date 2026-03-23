import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  FileText,
  Activity,
  Droplets,
  Scale,
  AlertTriangle,
  Clock,
  RefreshCcw,
  History,
  PlusCircle,
  UploadCloud,
  Paperclip,
  Trash2,
  FolderKanban,
  Loader2,
  X,
  Download
} from 'lucide-react';
import './PatientProntuario.css';
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
import AppointmentModal from './AppointmentModal';
import BioimpedanciaForm from '../../../components/Avaliacoes/Antropometria/BioimpedanciaForm';
import DobrasCutaneasForm from '../../../components/Avaliacoes/Antropometria/DobrasCutaneasForm';
import PerimetrosCorporaisForm from '../../../components/Avaliacoes/Antropometria/PerimetrosCorporaisForm';
import AvaliacaoAlimentarNOVA from '../../../components/Avaliacoes/avaliacao-alimentar/AvaliacaoAlimentarNOVA';
import AvaliacaoHidratacao from '../../../components/Avaliacoes/avaliacao-hidratacao/AvaliacaoHidratacao';
import AvaliacaoSocioeconomica from '../../../components/Avaliacoes/avaliacao-socioeconomica/AvaliacaoSocioeconomica';

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

const PatientProntuario = ({ patient, onBack }) => {
  const [avaliacoes, setAvaliacoes] = useState([]);
  const [loadingAvaliacoes, setLoadingAvaliacoes] = useState(false);
  const [evaluationsError, setEvaluationsError] = useState('');
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [isAppointmentOpen, setIsAppointmentOpen] = useState(false);
  const [activeModule, setActiveModule] = useState('bioimpedancia');
  const moduleRef = useRef(null);
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
  const [timelineVisibleCount, setTimelineVisibleCount] = useState(8);
  const [timelineFilterType, setTimelineFilterType] = useState('all');
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
  const [sharedAnthropometryDraft, setSharedAnthropometryDraft] = useState({
    pesoKg: '',
    estaturaCm: '',
    idade: '',
    sexo: ''
  });
  const [sharedAnthropometryTouched, setSharedAnthropometryTouched] = useState(false);
  const appointmentsSectionRef = useRef(null);
  const consultationHistoryRef = useRef(null);
  const timelineSectionRef = useRef(null);
  const { isProfessor, user } = useAuth();
  const {
    getAvaliacoesByPacientePaged,
    formatDate,
    convertFirebaseDate,
    updatePaciente,
    salvarAvaliacao
  } = usePacientes();
  const { notify } = useUiFeedback();

  useModalBodyLock(isProjectModalOpen);

  const moduleConfig = useMemo(() => ([
    { id: 'bioimpedancia', label: 'Bioimpedância', icon: <Scale size={20} />, tipo: 'bioimpedancia' },
    { id: 'dobras-cutaneas', label: 'Dobras Cutâneas', icon: <Activity size={20} />, tipo: 'dobras_cutaneas' },
    { id: 'perimetros', label: 'Perímetros', icon: <Scale size={20} />, tipo: 'perimetros' },
    { id: 'alimentar', label: 'Avaliação Alimentar', icon: <AlertTriangle size={20} />, tipo: 'alimentar' },
    { id: 'hidratacao', label: 'Hidratação', icon: <Droplets size={20} />, tipo: 'hidratacao' },
    { id: 'socioeconomica', label: 'EBIA', icon: <FileText size={20} />, tipo: 'avaliacao_socioeconomica' }
  ]), []);
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

  const canManagePatientFlow = isStudentMemberRole(user?.role) && !isProfessor;
  const canLinkProject = PROJECT_LINK_EDITOR_ROLES.has(normalizeRole(user?.role));
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
    { label: 'Nome completo', value: athleteInitialData.nomeCompleto || patient?.nome || '' },
    { label: 'Data de nascimento', value: athleteInitialData.dataNascimento || patient?.dataNascimento || '' },
    { label: 'Pessoas na casa', value: athleteInitialData.pessoasCasa },
    { label: 'Renda média (SM)', value: athleteInitialData.rendaMediaSm },
    { label: 'Escolaridade', value: athleteInitialData.escolaridade },
    { label: 'Atividade física (horário/frequência)', value: athleteInitialData.atividadeFisica },
    { label: 'Motivo do atendimento', value: athleteInitialData.motivoAtendimento },
    { label: 'Usa medicamento/suplemento', value: athleteInitialData.usaMedicamentoSuplemento },
    { label: 'Detalhes do medicamento', value: athleteInitialData.medicamentoDetalhes },
    { label: 'Diagnósticos pessoais', value: athleteInitialData.diagnosticosPessoais },
    { label: 'Histórico familiar', value: athleteInitialData.historicoFamiliar },
    { label: 'Condições gastrointestinais', value: athleteInitialData.condicaoGastrointestinal },
    { label: 'Alergia/intolerância', value: athleteInitialData.alergiaIntolerancia },
    { label: 'Não gosta de comer', value: athleteInitialData.naoGostaComer },
    { label: 'Ingestão de água', value: athleteInitialData.ingestaoAgua },
    { label: 'Litros de água/dia', value: athleteInitialData.litrosAguaDia },
    { label: 'Prepara refeições', value: athleteInitialData.preparaRefeicoes },
    { label: 'Quem prepara', value: athleteInitialData.quemPrepara },
    { label: 'Temperos usados', value: athleteInitialData.temperos },
    { label: 'Óleos e gorduras', value: athleteInitialData.oleosGorduras },
    { label: 'Equipamentos em casa', value: athleteInitialData.equipamentosCasa },
    { label: 'Bebida alcoólica', value: athleteInitialData.bebidaAlcoolica },
    { label: 'Fuma atualmente', value: athleteInitialData.fuma },
    { label: 'Frequência de delivery', value: athleteInitialData.deliveryFrequencia },
    { label: 'Dificuldade para dormir', value: athleteInitialData.dificuldadeDormir },
    { label: 'Rotina manhã', value: athleteInitialData.rotinaManha },
    { label: 'Rotina tarde', value: athleteInitialData.rotinaTarde },
    { label: 'Rotina noite', value: athleteInitialData.rotinaNoite },
    { label: 'Horário que dorme', value: athleteInitialData.horarioDormir },
    { label: 'Horário que acorda', value: athleteInitialData.horarioAcordar }
    ];
  }, [athleteConfirmation?.dados, patient?.dataNascimento, patient?.nome]);

  const loadAvaliacoes = useCallback(async () => {
    if (!patient?.id) {
      setAvaliacoes([]);
      setEvaluationsError('');
      return;
    }
    setLoadingAvaliacoes(true);
    setEvaluationsError('');
    try {
      const { items } = await getAvaliacoesByPacientePaged(patient.id, null, pageSize);
      setAvaliacoes(items || []);
    } catch (error) {
      console.error('Erro ao carregar avaliações:', error);
      const message = getApiErrorMessage(error, 'Não foi possível carregar as avaliações.');
      setEvaluationsError(message);
      setAvaliacoes([]);
      notify({
        type: 'error',
        title: 'Erro ao carregar avaliações',
        message
      });
    } finally {
      setLoadingAvaliacoes(false);
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
    const observacoes = patient?.observacoes || '';
    const historicoSaude = patient?.historicoSaude || '';
    const comorbidadesPessoais = patient?.comorbidadesPessoais || [];
    const comorbidadesFamiliares = patient?.comorbidadesFamiliares || [];
    setSummaryDraft({ observacoes, historicoSaude, comorbidadesPessoais, comorbidadesFamiliares });
    setSummarySaved({ observacoes, historicoSaude, comorbidadesPessoais, comorbidadesFamiliares });
  }, [patient?.observacoes, patient?.historicoSaude, patient?.comorbidadesPessoais, patient?.comorbidadesFamiliares]);

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

  const anthropometryBaseline = useMemo(() => {
    const latestFromEvaluations = (keys = []) => {
      for (const evaluation of avaliacoesOrdenadas) {
        const value = resolveEvaluationField(evaluation, keys);
        if (value !== null && value !== undefined && String(value).trim() !== '') {
          return value;
        }
      }
      return null;
    };

    const weightFromEval = toNumericValue(latestFromEvaluations(['peso', 'weight']));
    const weightFromPatient = toNumericValue(patient?.peso || patient?.weight);
    const heightFromEval = normalizeHeightCm(
      latestFromEvaluations(['estatura', 'altura', 'height', 'estatura_m'])
    );
    const heightFromPatient = normalizeHeightCm(
      patient?.altura || patient?.estatura || patient?.height
    );
    const ageFromEval = toNumericValue(latestFromEvaluations(['idade', 'age']));
    const sexFromEval = normalizeSexLabel(
      latestFromEvaluations(['sexo', 'genero', 'sex'])
    );
    const sexFromPatient = normalizeSexLabel(patient?.sexo || patient?.genero);

    const sourceEvaluation = avaliacoesOrdenadas.find((item) =>
      resolveEvaluationField(item, ['peso', 'weight', 'estatura', 'altura', 'height', 'estatura_m']) !== null
    );

    return {
      pesoKg: weightFromEval ?? weightFromPatient,
      estaturaCm: heightFromEval ?? heightFromPatient,
      idade: ageFromEval ?? patientAge,
      sexo: sexFromEval || sexFromPatient || '',
      sourceType: sourceEvaluation?.tipo || '',
      sourceDate: sourceEvaluation
        ? convertFirebaseDate(sourceEvaluation.updatedAt || sourceEvaluation.createdAt || sourceEvaluation.data)
        : null
    };
  }, [
    avaliacoesOrdenadas,
    convertFirebaseDate,
    patient?.altura,
    patient?.estatura,
    patient?.genero,
    patient?.height,
    patient?.peso,
    patient?.sexo,
    patient?.weight,
    patientAge
  ]);

  const normalizeAnthropometryDraft = useCallback(
    (source) => createAnthropometryDraft(source),
    []
  );

  useEffect(() => {
    setSharedAnthropometryTouched(false);
  }, [patient?.id]);

  useEffect(() => {
    if (sharedAnthropometryTouched) return;
    setSharedAnthropometryDraft(normalizeAnthropometryDraft(anthropometryBaseline));
  }, [anthropometryBaseline, normalizeAnthropometryDraft, sharedAnthropometryTouched]);

  const sharedAnthropometryBaseline = useMemo(() => {
    const draftWeight = toNumericValue(sharedAnthropometryDraft.pesoKg);
    const draftHeight = normalizeHeightCm(sharedAnthropometryDraft.estaturaCm);
    const draftAge = toNumericValue(sharedAnthropometryDraft.idade);
    const draftSex = normalizeSexLabel(sharedAnthropometryDraft.sexo);

    return {
      ...anthropometryBaseline,
      pesoKg: draftWeight ?? anthropometryBaseline?.pesoKg ?? null,
      estaturaCm: draftHeight ?? anthropometryBaseline?.estaturaCm ?? null,
      idade: draftAge ?? anthropometryBaseline?.idade ?? null,
      sexo: draftSex || anthropometryBaseline?.sexo || ''
    };
  }, [
    anthropometryBaseline,
    sharedAnthropometryDraft.estaturaCm,
    sharedAnthropometryDraft.idade,
    sharedAnthropometryDraft.pesoKg,
    sharedAnthropometryDraft.sexo
  ]);

  const sharedAnthropometrySourceLabel = useMemo(() => {
    const sourceType = anthropometryBaseline?.sourceType
      ? getEvaluationTypeLabel(anthropometryBaseline.sourceType)
      : 'cadastro do paciente';
    const sourceDate = anthropometryBaseline?.sourceDate
      ? formatDate(anthropometryBaseline.sourceDate)
      : null;
    return sourceDate ? `${sourceType} em ${sourceDate}` : sourceType;
  }, [anthropometryBaseline?.sourceDate, anthropometryBaseline?.sourceType, formatDate]);

  const handleSharedAnthropometryChange = useCallback((field, value) => {
    setSharedAnthropometryTouched(true);
    setSharedAnthropometryDraft((prev) => ({
      ...prev,
      [field]: field === 'sexo' ? normalizeSexLabel(value) : value
    }));
  }, []);

  const handleRestoreAnthropometryBase = useCallback(() => {
    setSharedAnthropometryTouched(false);
    setSharedAnthropometryDraft(normalizeAnthropometryDraft(anthropometryBaseline));
  }, [anthropometryBaseline, normalizeAnthropometryDraft]);

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

  const bioHistory = useMemo(() => {
    const getValue = (item, primary, secondary) => {
      const dados = item.dados || {};
      const resultados = item.resultados || {};
      const candidates = [dados[primary], dados[secondary], resultados[primary], resultados[secondary], item[primary], item[secondary]];
      for (const value of candidates) {
        if (value !== undefined && value !== null && value !== '') return value;
      }
      return null;
    };

    return avaliacoesOrdenadas
      .filter((item) => item.tipo === 'bioimpedancia')
      .map((item) => {
        const date = convertFirebaseDate(item.createdAt || item.data);
        return {
          id: item.id,
          date,
          peso: getValue(item, 'peso', 'weight'),
          imc: getValue(item, 'imc', 'imc'),
          gordura: getValue(item, 'percentualGordura', 'percentualGordura'),
          massaMagra: getValue(item, 'massaMagra', 'massaMagra')
        };
      })
      .filter((item) => item.date)
      .sort((a, b) => a.date - b.date);
  }, [avaliacoesOrdenadas, convertFirebaseDate]);

  const anthropometricSnapshot = useMemo(() => {
    const byType = avaliacoesOrdenadas.reduce((acc, item) => {
      const type = normalizeEvaluationType(item?.tipo);
      if (!acc[type]) acc[type] = [];
      acc[type].push(item);
      return acc;
    }, {});

    const bioCurrent = byType.bioimpedancia?.[0] || null;
    const bioPrevious = byType.bioimpedancia?.[1] || null;
    const dobrasCurrent = byType.dobras_cutaneas?.[0] || null;
    const dobrasPrevious = byType.dobras_cutaneas?.[1] || null;
    const perimetrosCurrent = byType.perimetros?.[0] || null;

    const sexo = normalizeSexLabel(
      resolveEvaluationField(dobrasCurrent, ['sexo', 'genero', 'sex'])
      || sharedAnthropometryBaseline?.sexo
      || patient?.sexo
      || patient?.genero
    );
    const idade = toNumericValue(
      resolveEvaluationField(dobrasCurrent, ['idade', 'age'])
      ?? sharedAnthropometryBaseline?.idade
      ?? patientAge
    );
    const peso = toNumericValue(
      resolveEvaluationField(dobrasCurrent, ['peso', 'weight'])
      ?? resolveEvaluationField(bioCurrent, ['peso', 'weight'])
      ?? resolveEvaluationField(perimetrosCurrent, ['peso', 'weight'])
      ?? sharedAnthropometryBaseline?.pesoKg
    );
    const estaturaCm = normalizeHeightCm(
      resolveEvaluationField(dobrasCurrent, ['estatura', 'altura', 'height', 'estatura_cm', 'estatura_m'])
      ?? resolveEvaluationField(perimetrosCurrent, ['estatura_cm', 'estatura', 'altura', 'height', 'estatura_m'])
      ?? sharedAnthropometryBaseline?.estaturaCm
    );
    const cintura = toNumericValue(
      resolveEvaluationField(perimetrosCurrent, ['cintura', 'cintura_cm'])
      ?? resolveEvaluationField(dobrasCurrent, ['cintura', 'cintura_cm'])
    );
    const quadril = toNumericValue(
      resolveEvaluationField(perimetrosCurrent, ['quadril', 'quadril_cm'])
      ?? resolveEvaluationField(dobrasCurrent, ['quadril', 'quadril_cm'])
    );

    const somaSeteDobras = resolveSumSevenFolds(dobrasCurrent);
    const densidadeCorporal = calculateBodyDensityJP7({ somaSeteDobras, idade, sexo });
    const percentualGorduraDobras = calculateSiriBodyFat(densidadeCorporal);
    const massaGordaDobras = Number.isFinite(percentualGorduraDobras) && Number.isFinite(peso)
      ? (percentualGorduraDobras / 100) * peso
      : null;
    const massaMagraDobras = Number.isFinite(massaGordaDobras) && Number.isFinite(peso)
      ? peso - massaGordaDobras
      : null;
    const imc = calculateImcFromWeightHeight(peso, estaturaCm);
    const ffmi = Number.isFinite(massaMagraDobras) && Number.isFinite(estaturaCm) && estaturaCm > 0
      ? massaMagraDobras / ((estaturaCm / 100) ** 2)
      : null;
    const whtr = Number.isFinite(cintura) && Number.isFinite(estaturaCm) && estaturaCm > 0
      ? cintura / estaturaCm
      : null;
    const whr = Number.isFinite(cintura) && Number.isFinite(quadril) && quadril > 0
      ? cintura / quadril
      : null;

    const percentualGorduraBia = toNumericValue(resolveEvaluationField(bioCurrent, ['percentual_gordura', 'percentualGordura']));
    const percentualGorduraBiaPrev = toNumericValue(resolveEvaluationField(bioPrevious, ['percentual_gordura', 'percentualGordura']));
    const massaMagraBia = toNumericValue(resolveEvaluationField(bioCurrent, ['massa_magra', 'massaMagra']));
    const massaMagraBiaPrev = toNumericValue(resolveEvaluationField(bioPrevious, ['massa_magra', 'massaMagra']));
    const aguaTotalBia = toNumericValue(resolveEvaluationField(bioCurrent, ['agua_total', 'aguaTotal', 'aguaCorporal']));
    const aguaTotalBiaPrev = toNumericValue(resolveEvaluationField(bioPrevious, ['agua_total', 'aguaTotal', 'aguaCorporal']));
    const tmb = toNumericValue(resolveEvaluationField(bioCurrent, ['taxa_metabolica_basal', 'taxaMetabolicaBasal', 'tmb']));
    const bioresistencia = toNumericValue(resolveEvaluationField(bioCurrent, ['bioresistencia']));
    const reatancia = toNumericValue(resolveEvaluationField(bioCurrent, ['reatancia']));

    const percentualGorduraDobrasPrev = calculateSiriBodyFat(calculateBodyDensityJP7({
      somaSeteDobras: resolveSumSevenFolds(dobrasPrevious),
      idade: toNumericValue(resolveEvaluationField(dobrasPrevious, ['idade', 'age'])) ?? idade,
      sexo: normalizeSexLabel(resolveEvaluationField(dobrasPrevious, ['sexo', 'genero', 'sex']) || sexo)
    }));
    const massaMagraDobrasPrev = (() => {
      const pesoPrev = toNumericValue(resolveEvaluationField(dobrasPrevious, ['peso', 'weight'])) ?? peso;
      if (!Number.isFinite(percentualGorduraDobrasPrev) || !Number.isFinite(pesoPrev)) return null;
      const massaGordaPrev = (percentualGorduraDobrasPrev / 100) * pesoPrev;
      return pesoPrev - massaGordaPrev;
    })();

    const percentualGorduraAtual = Number.isFinite(percentualGorduraBia) ? percentualGorduraBia : percentualGorduraDobras;
    const percentualGorduraPrev = Number.isFinite(percentualGorduraBiaPrev) ? percentualGorduraBiaPrev : percentualGorduraDobrasPrev;
    const massaMagraAtual = Number.isFinite(massaMagraBia) ? massaMagraBia : massaMagraDobras;
    const massaMagraPrev = Number.isFinite(massaMagraBiaPrev) ? massaMagraBiaPrev : massaMagraDobrasPrev;

    return {
      sexo,
      idade,
      peso,
      estaturaCm,
      cintura,
      quadril,
      somaSeteDobras,
      densidadeCorporal,
      percentualGorduraDobras,
      massaGordaDobras,
      massaMagraDobras,
      percentualGorduraBia,
      massaMagraBia,
      aguaTotalBia,
      tmb,
      bioresistencia,
      reatancia,
      imc,
      imcClassificacao: classifyBmi(imc),
      cinturaClassificacao: classifyWaistRisk(cintura, sexo),
      ffmi,
      whtr,
      whr,
      difPercentualGorduraBiaDobras: Number.isFinite(percentualGorduraBia) && Number.isFinite(percentualGorduraDobras)
        ? percentualGorduraBia - percentualGorduraDobras
        : null,
      difMassaMagraBiaDobras: Number.isFinite(massaMagraBia) && Number.isFinite(massaMagraDobras)
        ? massaMagraBia - massaMagraDobras
        : null,
      deltas: {
        percentualGordura: buildNumericDelta(percentualGorduraAtual, percentualGorduraPrev),
        massaMagra: buildNumericDelta(massaMagraAtual, massaMagraPrev),
        aguaTotal: buildNumericDelta(aguaTotalBia, aguaTotalBiaPrev)
      }
    };
  }, [
    avaliacoesOrdenadas,
    patient?.genero,
    patient?.sexo,
    patientAge,
    sharedAnthropometryBaseline?.estaturaCm,
    sharedAnthropometryBaseline?.idade,
    sharedAnthropometryBaseline?.pesoKg,
    sharedAnthropometryBaseline?.sexo
  ]);

  const anthropometricComparisonRows = useMemo(() => ([
    { id: 'sum7', label: 'Σ7 Dobras (JP7)', value: anthropometricSnapshot.somaSeteDobras, unit: 'mm' },
    { id: 'densidade', label: 'Densidade corporal (JP7)', value: anthropometricSnapshot.densidadeCorporal, unit: '', digits: 4 },
    { id: 'massa-gorda-dobras', label: 'Massa gorda (dobras)', value: anthropometricSnapshot.massaGordaDobras, unit: 'kg' },
    { id: 'ffmi', label: 'FFMI (MM/altura²)', value: anthropometricSnapshot.ffmi, unit: '', digits: 2 },
    { id: 'whtr', label: 'WHtR (cintura/estatura)', value: anthropometricSnapshot.whtr, unit: '', digits: 2 },
    { id: 'gordura-bia', label: '% Gordura (BIA)', value: anthropometricSnapshot.percentualGorduraBia, unit: '%' },
    { id: 'massa-magra-bia', label: 'Massa magra (BIA)', value: anthropometricSnapshot.massaMagraBia, unit: 'kg' },
    { id: 'imc', label: 'IMC', value: anthropometricSnapshot.imc, unit: '' },
    { id: 'gordura-siri', label: '% Gordura (Siri)', value: anthropometricSnapshot.percentualGorduraDobras, unit: '%' },
    { id: 'massa-magra-dobras', label: 'Massa magra (dobras)', value: anthropometricSnapshot.massaMagraDobras, unit: 'kg' },
    { id: 'whr', label: 'WHR (cintura/quadril)', value: anthropometricSnapshot.whr, unit: '', digits: 2 },
    { id: 'cintura', label: 'Cintura', value: anthropometricSnapshot.cintura, unit: 'cm' },
    { id: 'dif-gordura', label: 'Dif. %G (BIA - Dobras)', value: anthropometricSnapshot.difPercentualGorduraBiaDobras, unit: 'p.p.' },
    { id: 'dif-mm', label: 'Dif. MM (BIA - Dobras)', value: anthropometricSnapshot.difMassaMagraBiaDobras, unit: 'kg' },
    { id: 'agua', label: 'Agua total (BIA)', value: anthropometricSnapshot.aguaTotalBia, unit: 'L' },
    { id: 'tmb', label: 'TMB', value: anthropometricSnapshot.tmb, unit: 'cal/dia', digits: 0 },
    {
      id: 'bio-reat',
      label: 'Bio R / Reat',
      textValue: Number.isFinite(anthropometricSnapshot.bioresistencia) || Number.isFinite(anthropometricSnapshot.reatancia)
        ? `${formatNumeric(anthropometricSnapshot.bioresistencia, 0, false) || '-'} / ${formatNumeric(anthropometricSnapshot.reatancia, 0, false) || '-'} ohms`
        : ''
    }
  ]), [anthropometricSnapshot]);

  const pendingModules = useMemo(() => {
    const completed = new Set(
      avaliacoesOrdenadas
        .filter((item) => item.status === 'finalizada')
        .map((item) => item.tipo)
    );
    return moduleConfig.filter((mod) => !completed.has(mod.tipo));
  }, [avaliacoesOrdenadas, moduleConfig]);

  const moduleProgress = useMemo(() => {
    return moduleConfig.map((module) => {
      const latest = avaliacoesOrdenadas.find((item) => item.tipo === module.tipo);
      const latestDate = latest ? convertFirebaseDate(latest.updatedAt || latest.createdAt || latest.data) : null;
      const status = latest?.status || 'pendente';
      return {
        ...module,
        status,
        latestDate,
        hasData: Boolean(latest),
        completion: typeof latest?.meta?.completude === 'number' ? latest.meta.completude : null
      };
    });
  }, [avaliacoesOrdenadas, convertFirebaseDate, moduleConfig]);

  const completedModulesCount = useMemo(
    () => moduleProgress.filter((module) => module.status === 'finalizada').length,
    [moduleProgress]
  );

  const moduleCompletionPercent = useMemo(() => {
    if (moduleConfig.length === 0) return 0;
    return Math.round((completedModulesCount / moduleConfig.length) * 100);
  }, [completedModulesCount, moduleConfig.length]);

  const activeModuleProgress = useMemo(
    () => moduleProgress.find((module) => module.id === activeModule) || null,
    [activeModule, moduleProgress]
  );

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
        meta: item.meta,
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

  const timelineStatusOptions = useMemo(() => {
    const statuses = new Set();
    timelineEvents.forEach((event) => {
      if (event.status) statuses.add(event.status);
    });
    return Array.from(statuses);
  }, [timelineEvents]);

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

  const handleOpenModule = (moduleId) => {
    if (!patient?.id) return;
    setActiveModule(moduleId);
    if (moduleRef.current) {
      moduleRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleNovaAvaliacao = () => {
    if (!patient?.id) return;
    handleOpenModule('bioimpedancia');
  };

  const handleSalvarAvaliacao = async (avaliacao) => {
    if (!patient?.id) return;
    try {
      const baselineDados = buildSharedAnthropometryData(sharedAnthropometryBaseline);
      const payloadDados = {
        ...baselineDados,
        ...(avaliacao?.dados && typeof avaliacao.dados === 'object' ? avaliacao.dados : {})
      };
      await salvarAvaliacao({
        ...avaliacao,
        dados: payloadDados,
        pacienteId: patient.id,
        projetoId: patient.projetoId || null,
        projetoNome: patient.projetoNome || '',
        status: 'finalizada'
      });
      const { items } = await getAvaliacoesByPacientePaged(patient.id, null, pageSize);
      setAvaliacoes(items || []);
    } catch (error) {
      console.error('Erro ao salvar avaliação:', error);
      notify({
        type: 'error',
        title: 'Erro ao salvar avaliação',
        message: getApiErrorMessage(error, 'Não foi possível salvar a avaliação.')
      });
    }
  };

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
    scrollToSection(consultationHistoryRef);
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
          ? `Paciente vinculado ao projeto "${selectedProject.nome}".`
          : 'Vinculo de projeto removido do paciente.'
      });
      setIsProjectModalOpen(false);
    } catch (error) {
      notify({
        type: 'error',
        title: 'Erro ao vincular projeto',
        message: getApiErrorMessage(error, 'Não foi possível atualizar o projeto deste paciente.')
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
        title: 'Paciente sem projeto vinculado',
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
    anchor.download = `historico-consultas-${(patient?.nome || 'paciente').toLowerCase().replace(/\s+/g, '-')}.csv`;
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

  const renderModuleForm = () => {
    const formProps = {
      pacienteId: patient?.id,
      onSalvar: handleSalvarAvaliacao,
      readOnly: !podeEditarAvaliacoes,
      patient,
      baselineAnthropometry: sharedAnthropometryBaseline,
      lockSharedAnthropometry: true
    };

    switch (activeModule) {
      case 'bioimpedancia':
        return <BioimpedanciaForm {...formProps} />;
      case 'dobras-cutaneas':
        return <DobrasCutaneasForm {...formProps} />;
      case 'perimetros':
        return <PerimetrosCorporaisForm {...formProps} />;
      case 'alimentar':
        return <AvaliacaoAlimentarNOVA {...formProps} />;
      case 'hidratacao':
        return <AvaliacaoHidratacao {...formProps} />;
      case 'socioeconomica':
        return <AvaliacaoSocioeconomica {...formProps} />;
      default:
        return null;
    }
  };

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
  const formatMetric = (value, suffix = '', digits = 1) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return '-';
    return `${num.toFixed(digits)}${suffix}`;
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
      await updatePaciente(patient.id, {
        observacoes: summaryDraft.observacoes,
        historicoSaude: summaryDraft.historicoSaude,
        comorbidadesPessoais: summaryDraft.comorbidadesPessoais || [],
        comorbidadesFamiliares: summaryDraft.comorbidadesFamiliares || []
      });
      setSummarySaved(summaryDraft);
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
      setAttachments((prev) => {
        const updated = [upload, ...prev.filter((item) => item.path !== upload.path)];
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

  return (
    <>
      <div className="prontuario-container prontuario-v2 prontuario-v4">
      <header className="prontuario-hero">
        <div className="hero-top">
          <div className="hero-left">
            <button onClick={onBack} className="btn-back" aria-label="Voltar">
              <ArrowLeft size={20} />
            </button>
            <div className="hero-title">
              <span className="hero-label">Prontuário do atleta</span>
              <h1>{patient?.nome || 'Paciente'}</h1>
            </div>
          </div>
          <div className="hero-actions">
            {podeEditarAvaliacoes && (
              <button className="btn-new-eval" onClick={handleNovaAvaliacao}>
                <PlusCircle size={16} /> Nova avaliação
              </button>
            )}
            {podeEditarAvaliacoes && (
              <button className="btn-schedule" onClick={() => setIsAppointmentOpen(true)}>
                <Clock size={16} /> Nova consulta
              </button>
            )}
            {canLinkProject && (
              <button type="button" className="btn-schedule" onClick={handleOpenProjectModal}>
                <FolderKanban size={16} /> Projeto
              </button>
            )}
            <button type="button" className="btn-history" onClick={handleOpenHistory}>
              <History size={16} /> Histórico
            </button>
          </div>
        </div>

        <div className="hero-main">
          <div className="patient-card">
            <div className="patient-avatar">{patientInitials}</div>
            <div className="patient-info">
              <div className="patient-tags">
                <span className="tag-active">Prontuário Ativo</span>
                {projectLink?.nome && (
                  <span className="tag-neutral">{projectLink.nome}</span>
                )}
                <span className={`tag-neutral ${athleteHasLogin ? 'tag-ok' : 'tag-warning'}`}>
                  {athleteHasLogin ? 'Cadastro inicial confirmado' : 'Cadastro inicial pendente'}
                </span>
                <span className="tag-neutral">Pendências: {pendingModules.length}</span>
              </div>
              <p className="patient-meta">
                CPF: {patient?.cpf || '---'} - {patient?.dataNascimentoFormatada || patient?.dataNascimento || '---'}
              </p>
              <p className="patient-meta">
                Modalidade: {patient?.modalidadePrincipal || patient?.modalidade || 'Não informado'}
              </p>
              <p className="patient-meta">
                Atualizado: {patientLastUpdate ? formatDate(patientLastUpdate) : 'Sem registro'}
              </p>
            </div>
          </div>

          <div className="patient-stats-grid">
            <div className="patient-stat">
              <span>Idade</span>
              <strong>{patientAge ? `${patientAge} anos` : '---'}</strong>
            </div>
            <div className="patient-stat">
              <span>Avaliações</span>
              <strong>{avaliacoesOrdenadas.length}</strong>
            </div>
            <div className="patient-stat">
              <span>Última avaliação</span>
              <strong>{lastEvaluation ? formatDate(lastEvaluation) : '---'}</strong>
            </div>
            <div className="patient-stat highlight">
              <span>Próxima consulta</span>
              <strong>
                {nextAppointment?.scheduledDate
                  ? formatDate(nextAppointment.scheduledDate)
                  : 'Sem agenda'}
              </strong>
            </div>
          </div>
          <section className="general-card card card-default">
            <div className="general-header">
              <div>
                <h2>Dados gerais</h2>
                <p>Cadastro inicial preenchido pelo atleta no primeiro acesso.</p>
              </div>
              <div className="general-header-actions">
                <span className={`general-status ${athleteHasLogin ? 'filled' : 'pending'}`}>
                  {athleteHasLogin ? 'Cadastro confirmado' : 'Cadastro pendente'}
                </span>
                {podeEditarAvaliacoes && (
                  <button
                    type="button"
                    className="general-ebia-release-btn"
                    onClick={handleReleaseEbiaToAthlete}
                    disabled={isReleasingEbia || ebiaSelfFormEnabled || !athleteHasLogin}
                  >
                    {isReleasingEbia
                      ? 'Liberando...'
                      : ebiaSelfFormEnabled
                        ? 'EBIA liberado ao atleta'
                        : 'Liberar EBIA ao atleta'}
                  </button>
                )}
              </div>
            </div>
            {!athleteHasLogin && (
              <div className="general-warning">
                O atleta ainda não realizou o primeiro login para preencher estes dados.
              </div>
            )}
            {athleteHasLogin && ebiaSelfFormEnabled && (
              <div className="general-warning general-warning--info">
                EBIA liberado para o atleta em {ebiaSelfFormReleasedAt ? formatDate(ebiaSelfFormReleasedAt) : 'instantes atrás'}.
              </div>
            )}
            {athleteHasLogin && !ebiaSelfFormEnabled && ebiaSelfFormConsumedAt && (
              <div className="general-warning general-warning--success">
                Ultimo preenchimento EBIA enviado em {formatDate(ebiaSelfFormConsumedAt)}.
              </div>
            )}
            <div className="general-grid">
              {dadosGeraisFields.map((field) => (
                <div key={field.label} className="general-item">
                  <span className="general-label">{field.label}</span>
                  <span className="general-value">
                    {field.label === 'Data de nascimento'
                      ? formatGeneralDate(field.value)
                      : formatGeneralValue(field.value)}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section ref={appointmentsSectionRef} className="appointments-card compact card card-default">
            <div className="appointments-header">
              <div>
                <h2>Consultas do paciente</h2>
                <p>Acompanhe a agenda vinculada ao prontuário</p>
              </div>
              <div className="appointments-header-actions">
                <button
                  className="appointments-btn appointments-btn--secondary"
                  type="button"
                  onClick={handleRefreshAppointments}
                  disabled={loadingAppointments || isRefreshingAppointments}
                >
                  {isRefreshingAppointments ? <Loader2 size={15} className="spin" /> : <RefreshCcw size={15} />}
                  {isRefreshingAppointments ? 'Atualizando...' : 'Atualizar agenda'}
                </button>
                {podeEditarAvaliacoes && (
                  <button className="appointments-btn" type="button" onClick={() => setIsAppointmentOpen(true)}>
                    <Clock size={16} /> Marcar consulta
                  </button>
                )}
              </div>
            </div>
            <div className="appointments-meta" role="status" aria-live="polite">
              <span>{appointments.length} consulta(s) registradas</span>
              {isRefreshingAppointments && <span>Sincronizando agenda do paciente...</span>}
              <span>{appointmentsSyncLabel}</span>
            </div>

            <div className="appointments-stack">
              <div className="appointments-block">
                {loadingAppointments ? (
                  <div className="appointments-empty appointments-empty--loading" role="status" aria-live="polite">
                    <Loader2 size={14} className="spin" />
                    <span>Carregando agenda...</span>
                  </div>
                ) : appointmentsError ? (
                  <div className="history-inline-error">
                    <p>{appointmentsError}</p>
                    <button type="button" className="history-inline-action" onClick={loadAppointments}>
                      Tentar novamente
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="appointments-next">
                      <span className="label">Próxima consulta</span>
                      <div className="appointments-next-card">
                        {nextAppointment ? (
                          <>
                            <strong>{formatDate(nextAppointment.scheduledDate)}</strong>
                            <span>{nextAppointment.time || '--:--'} {APPOINTMENT_STATUS_LABELS[nextAppointment.status || 'agendada']}</span>
                            <span>{getAppointmentTypeLabel(nextAppointment)}</span>
                          </>
                        ) : (
                          <span>Sem consultas futuras.</span>
                        )}
                      </div>
                    </div>

                    <div className="appointments-list">
                      {(appointments || []).slice(0, 3).map((item) => (
                        <div key={item.id} className="appointments-item">
                          <div>
                            <strong>{formatDate(convertFirebaseDate(item.scheduledAt || item.date))}</strong>
                            <span>{item.time || '--:--'}</span>
                            <span>{getAppointmentTypeLabel(item)}</span>
                          </div>
                          <span className={`appointments-status status-${item.status || 'agendada'}`}>
                            {APPOINTMENT_STATUS_LABELS[item.status || 'agendada']}
                          </span>
                        </div>
                      ))}
                      {appointments.length === 0 && (
                        <div className="appointments-empty">
                          <span>Sem histórico de consultas.</span>
                          {podeEditarAvaliacoes && (
                            <button
                              type="button"
                              className="history-inline-action"
                              onClick={() => setIsAppointmentOpen(true)}
                            >
                              Marcar primeira consulta
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div className="appointments-block">
                <div className="appointments-subheader">
                  <h3>Resultados e comparações</h3>
                  <span>{avaliacoesOrdenadas.length} avaliações</span>
                </div>
                {loadingAvaliacoes ? (
                  <div className="history-empty history-empty--loading" role="status" aria-live="polite">
                    <Loader2 size={14} className="spin" />
                    <span>Carregando avaliações...</span>
                  </div>
                ) : evaluationsError ? (
                  <div className="history-inline-error">
                    <p>{evaluationsError}</p>
                    <button type="button" className="history-inline-action" onClick={loadAvaliacoes}>
                      Tentar novamente
                    </button>
                  </div>
                ) : anthropometricComparisonRows.every((row) => !Number.isFinite(row.value) && !row.textValue) ? (
                  <div className="history-empty">Sem dados suficientes para calcular resultados antropométricos.</div>
                ) : (
                  <div className="results-comparison-shell">
                    <div className="results-highlight-grid">
                      <div className="results-highlight-card">
                        <span className="results-highlight-label">% Gordura atual</span>
                        <strong>{formatMetric(anthropometricSnapshot.percentualGorduraBia ?? anthropometricSnapshot.percentualGorduraDobras, '%')}</strong>
                        <small>{formatDeltaLabel(anthropometricSnapshot.deltas.percentualGordura, '%')}</small>
                      </div>
                      <div className="results-highlight-card">
                        <span className="results-highlight-label">Massa magra atual</span>
                        <strong>{formatMetric(anthropometricSnapshot.massaMagraBia ?? anthropometricSnapshot.massaMagraDobras, ' kg')}</strong>
                        <small>{formatDeltaLabel(anthropometricSnapshot.deltas.massaMagra, 'kg')}</small>
                      </div>
                      <div className="results-highlight-card">
                        <span className="results-highlight-label">Agua total</span>
                        <strong>{formatMetric(anthropometricSnapshot.aguaTotalBia, ' L')}</strong>
                        <small>{formatDeltaLabel(anthropometricSnapshot.deltas.aguaTotal, 'L')}</small>
                      </div>
                      <div className="results-highlight-card">
                        <span className="results-highlight-label">Risco por cintura</span>
                        <strong>{anthropometricSnapshot.cinturaClassificacao}</strong>
                        <small>{Number.isFinite(anthropometricSnapshot.cintura) ? `${anthropometricSnapshot.cintura.toFixed(1)} cm` : 'Sem medida atual'}</small>
                      </div>
                    </div>

                    <div className="results-summary-inline">
                      <span>IMC: <strong>{formatMetric(anthropometricSnapshot.imc, '')}</strong></span>
                      <span>{anthropometricSnapshot.imcClassificacao}</span>
                      <span>WHR: <strong>{formatMetric(anthropometricSnapshot.whr, '')}</strong></span>
                      <span>WHtR: <strong>{formatMetric(anthropometricSnapshot.whtr, '')}</strong></span>
                    </div>

                    <div className="results-comparison-table">
                      <div className="results-comparison-row results-comparison-row--head">
                        <span>Indicador</span>
                        <span>Resultado</span>
                      </div>
                      {anthropometricComparisonRows.map((row) => (
                        <div key={row.id} className="results-comparison-row">
                          <span>{row.label}</span>
                          <span>
                            {row.textValue || formatMetric(row.value, row.unit ? ` ${row.unit}` : '', row.digits ?? 1)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="appointments-block">
                <div className="appointments-subheader">
                  <h3>Anexos do paciente</h3>
                  <span>{attachments.length} arquivos</span>
                </div>

                {podeEnviarAnexo && (
                  <label className="attachments-upload">
                    <input
                      type="file"
                      onChange={handleUploadAttachment}
                      disabled={isUploadingAttachment}
                    />
                    <UploadCloud size={18} />
                    {isUploadingAttachment ? 'Enviando...' : 'Adicionar anexo'}
                  </label>
                )}

                {attachmentError && (
                  <div className="attachments-error">{attachmentError}</div>
                )}

                {attachments.length === 0 ? (
                  <div className="history-empty">Nenhum anexo enviado.</div>
                ) : (
                  <div className="attachments-list attachments-grid">
                    {attachments.slice(0, visibleAttachments).map((item) => (
                      <div
                        key={item.id || item.path || item.url}
                        className="attachments-item attachments-card-item"
                      >
                        <button
                          type="button"
                          className="attachments-open-btn"
                          onClick={() => handleOpenAttachment(item)}
                          disabled={
                            openingAttachmentId === String(item.id || item.path || item.url || '')
                            || removingAttachmentId === String(item.id || item.path || item.url || '')
                          }
                        >
                          <div className="attachments-icon">
                            <Paperclip size={16} />
                          </div>
                          <div className="attachments-main">
                            <strong className="attachments-name">{item.name}</strong>
                            <span className="attachments-date">
                              {removingAttachmentId === String(item.id || item.path || item.url || '')
                                ? 'Removendo...'
                                : openingAttachmentId === String(item.id || item.path || item.url || '')
                                ? 'Abrindo...'
                                : formatDate(item.uploadedAt)}
                            </span>
                          </div>
                        </button>
                        {podeRemoverAnexo && (
                          <button
                            type="button"
                            className="attachments-remove-btn"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              handleRemoveAttachment(item);
                            }}
                            aria-label={`Remover anexo ${item.name || ''}`}
                            disabled={removingAttachmentId === String(item.id || item.path || item.url || '')}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {attachmentsHasMore && (
                  <div className="attachments-more">
                    <button
                      type="button"
                      className="btn-new-eval"
                      onClick={handleLoadMoreAttachments}
                    >
                      Carregar mais
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </header>

      <div className="prontuario-grid">
        <section className="summary-card summary-highlight card card-primary">
            <div className="summary-header">
              <div className="summary-icon-box">
                <FileText size={20} />
              </div>
              <div className="summary-title-box">
                <h2 className="summary-title">Resumo Clinico</h2>
                <p className="summary-subtitle">Atualize as informacoes clinicas</p>
              </div>
              <div className="summary-actions">
                {podeEditarResumo && isEditingSummary ? (
                  <>
                    <button
                      type="button"
                      className="summary-btn secondary"
                      onClick={handleSummaryCancel}
                      disabled={isSavingSummary}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className="summary-btn primary"
                      onClick={handleSummarySave}
                      disabled={isSavingSummary}
                    >
                      {isSavingSummary ? 'Salvando...' : 'Salvar'}
                    </button>
                  </>
                ) : podeEditarResumo ? (
                  <button
                    type="button"
                    className="summary-btn ghost"
                    onClick={() => setIsEditingSummary(true)}
                  >
                    Editar
                  </button>
                ) : (
                  <span className="summary-readonly">Somente leitura</span>
                )}
              </div>
            </div>
            <div className="summary-content">
              <div className="summary-block">
                <label className="summary-label">Queixa Principal</label>
                {isEditingSummary ? (
                  <textarea
                    className="summary-textarea"
                    rows="4"
                    value={summaryDraft.observacoes}
                    onChange={(e) => handleSummaryChange('observacoes', e.target.value)}
                  />
                ) : (
                  <p className="summary-text">
                    {summarySaved.observacoes || 'Sem observacoes registradas.'}
                  </p>
                )}
              </div>

              <div className="divider" />

              <div className="summary-block">
                <label className="summary-label">Histórico de Saúde</label>
                {isEditingSummary ? (
                  <textarea
                    className="summary-textarea"
                    rows="4"
                    value={summaryDraft.historicoSaude}
                    onChange={(e) => handleSummaryChange('historicoSaude', e.target.value)}
                  />
                ) : (
                  <div className="mt-2 space-y-2">
                    <p className="summary-text muted">
                      {summarySaved.historicoSaude || 'Sem histórico detalhado registrado.'}
                    </p>
                  </div>
                )}
              </div>

              <div className="comorbidades-section summary-block">
                <label className="summary-label">Comorbidades pessoais</label>
                {isEditingSummary ? (
                  <div className="comorbidades-grid">
                    {comorbidadesOptions.map((item) => (
                      <label key={item.id} className="comorbidade-item">
                        <input
                          type="checkbox"
                          checked={(summaryDraft.comorbidadesPessoais || []).includes(item.id)}
                          onChange={() => handleToggleComorbidade('comorbidadesPessoais', item.id)}
                        />
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="comorbidades-list">
                    {(summarySaved.comorbidadesPessoais || []).length === 0 ? (
                      <span className="summary-muted">Sem informacao registrada.</span>
                    ) : (
                      summarySaved.comorbidadesPessoais.map((id) => (
                        <span key={id} className="chip">{getComorbidadeLabel(id)}</span>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div className="comorbidades-section summary-block">
                <label className="summary-label">Histórico familiar</label>
                {isEditingSummary ? (
                  <div className="comorbidades-grid">
                    {comorbidadesOptions.map((item) => (
                      <label key={`fam-${item.id}`} className="comorbidade-item">
                        <input
                          type="checkbox"
                          checked={(summaryDraft.comorbidadesFamiliares || []).includes(item.id)}
                          onChange={() => handleToggleComorbidade('comorbidadesFamiliares', item.id)}
                        />
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="comorbidades-list">
                    {(summarySaved.comorbidadesFamiliares || []).length === 0 ? (
                      <span className="summary-muted">Sem informacao registrada.</span>
                    ) : (
                      summarySaved.comorbidadesFamiliares.map((id) => (
                        <span key={`fam-${id}`} className="chip">{getComorbidadeLabel(id)}</span>
                      ))
                    )}
                  </div>
                )}
              </div>
              <div className="note-box summary-block">
                <p className="note-label">Observacao do Aluno</p>
                <p className="note-text">"Atualize as observacoes durante as consultas."</p>
              </div>

              <div className="professor-message-card summary-block">
                <div className="professor-message-header">
                  <span>Mensagens do Professor</span>
                  {isProfessor && <span className="professor-message-tag">Somente professor</span>}
                </div>

                {professorMessages.length === 0 ? (
                  <p className="professor-message-empty">Nenhuma mensagem enviada.</p>
                ) : (
                  <div className="professor-message-list">
                    {professorMessages.map((msg) => (
                      <div key={msg.id} className="professor-message-item">
                        <div>
                          <strong>{msg.professorNome || 'Professor'}</strong>
                          <span>{formatDate(msg.createdAt)}</span>
                        </div>
                        <p>{msg.texto}</p>
                      </div>
                    ))}
                  </div>
                )}

                {isProfessor && (
                  <>
                    <textarea
                      className="professor-message-input"
                      rows="3"
                      value={professorMessage}
                      onChange={(e) => setProfessorMessage(e.target.value)}
                      placeholder="Deixe uma mensagem para o aluno responsável..."
                    />
                    {professorMessageError && (
                      <div className="summary-error">{professorMessageError}</div>
                    )}
                    <button
                      type="button"
                      className="summary-btn primary"
                      onClick={handleSaveProfessorMessage}
                      disabled={isSavingProfessorMessage}
                    >
                      {isSavingProfessorMessage ? 'Salvando...' : 'Enviar mensagem'}
                    </button>
                  </>
                )}
              </div>

              {summaryError && (
                <div className="summary-error">{summaryError}</div>
              )}
            </div>
          </section>

        <section className="avaliacao-panel card card-default" ref={moduleRef}>
          <div className="avaliacao-panel-header">
            <div>
              <h3>Avaliações</h3>
              <p>Escolha o módulo clínico e registre o atendimento de forma contínua.</p>
            </div>
            <div className="avaliacao-panel-kpis">
              <div className="avaliacao-kpi">
                <span>Concluídos</span>
                <strong>{completedModulesCount}/{moduleConfig.length}</strong>
              </div>
              <div className="avaliacao-kpi">
                <span>Progresso</span>
                <strong>{moduleCompletionPercent}%</strong>
              </div>
            </div>
            <button className="btn-new-eval" type="button" onClick={handleNovaAvaliacao}>
              <PlusCircle size={16} /> Nova avaliação
            </button>
          </div>

          <div className="avaliacao-progressbar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={moduleCompletionPercent}>
            <span className="avaliacao-progressbar-fill" style={{ width: `${moduleCompletionPercent}%` }} />
          </div>

          {pendingModules.length > 0 && (
            <div className="avaliacao-pending">
              Pendências: {pendingModules.map((item) => item.label).join(' • ')}
            </div>
          )}

          <div className="avaliacao-baseline-card">
            <div className="avaliacao-baseline-card__header">
              <div>
                <h4>Ficha base da avaliação</h4>
                <p>Peso, estatura, idade e sexo são reaproveitados nos módulos para evitar retrabalho.</p>
              </div>
              <div className="avaliacao-baseline-card__actions">
                <span className="avaliacao-baseline-card__source">Fonte: {sharedAnthropometrySourceLabel}</span>
                {podeEditarAvaliacoes && sharedAnthropometryTouched && (
                  <button
                    type="button"
                    className="avaliacao-baseline-card__reset"
                    onClick={handleRestoreAnthropometryBase}
                  >
                    Restaurar base
                  </button>
                )}
              </div>
            </div>
            <div className="avaliacao-baseline-card__grid">
              <label>
                Peso (kg)
                <input
                  type="number"
                  step="0.1"
                  value={sharedAnthropometryDraft.pesoKg}
                  onChange={(event) => handleSharedAnthropometryChange('pesoKg', event.target.value)}
                  disabled={!podeEditarAvaliacoes}
                  placeholder="Ex.: 72.4"
                />
              </label>
              <label>
                Estatura (cm)
                <input
                  type="number"
                  step="0.1"
                  value={sharedAnthropometryDraft.estaturaCm}
                  onChange={(event) => handleSharedAnthropometryChange('estaturaCm', event.target.value)}
                  disabled={!podeEditarAvaliacoes}
                  placeholder="Ex.: 172"
                />
              </label>
              <label>
                Idade
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={sharedAnthropometryDraft.idade}
                  onChange={(event) => handleSharedAnthropometryChange('idade', event.target.value)}
                  disabled={!podeEditarAvaliacoes}
                  placeholder="Ex.: 23"
                />
              </label>
              <label>
                Sexo biológico
                <select
                  value={sharedAnthropometryDraft.sexo}
                  onChange={(event) => handleSharedAnthropometryChange('sexo', event.target.value)}
                  disabled={!podeEditarAvaliacoes}
                >
                  <option value="">Não informado</option>
                  <option value="MASCULINO">Masculino</option>
                  <option value="FEMININO">Feminino</option>
                </select>
              </label>
            </div>
          </div>

          <div className="avaliacao-module-grid">
            {moduleProgress.map((mod) => (
              <button
                key={mod.id}
                type="button"
                className={`avaliacao-module-tile ${activeModule === mod.id ? 'active' : ''}`}
                onClick={() => handleOpenModule(mod.id)}
              >
                <div className="avaliacao-module-top">
                  <span className="avaliacao-module-icon" aria-hidden="true">{mod.icon}</span>
                  <span className="avaliacao-module-label">{mod.label}</span>
                  <span className={`avaliacao-module-status status-${mod.status}`}>
                    {getEvaluationStatusLabel(mod.status)}
                  </span>
                </div>
                <div className="avaliacao-module-meta">
                  {mod.latestDate ? (
                    <span>Último registro: {formatDate(mod.latestDate)}</span>
                  ) : (
                    <span>Sem registro neste módulo</span>
                  )}
                  {typeof mod.completion === 'number' && (
                    <span>Completude: {mod.completion}%</span>
                  )}
                </div>
              </button>
            ))}
          </div>

          <div className="avaliacao-panel-body">
            <div className="avaliacao-panel-body-head">
              <div>
                <span className="avaliacao-panel-body-label">Módulo ativo</span>
                <strong>{activeModuleProgress?.label || 'Avaliação'}</strong>
                {(sharedAnthropometryBaseline?.pesoKg || sharedAnthropometryBaseline?.estaturaCm) && (
                  <small className="avaliacao-panel-body-hint">
                    Base integrada: peso {sharedAnthropometryBaseline.pesoKg ? `${sharedAnthropometryBaseline.pesoKg.toFixed(1)} kg` : '---'} • estatura {sharedAnthropometryBaseline.estaturaCm ? `${sharedAnthropometryBaseline.estaturaCm.toFixed(1)} cm` : '---'}
                  </small>
                )}
              </div>
              <span className={`avaliacao-module-status status-${activeModuleProgress?.status || 'pendente'}`}>
                {getEvaluationStatusLabel(activeModuleProgress?.status || 'pendente')}
              </span>
            </div>
            {renderModuleForm()}
          </div>
        </section>
      </div>

      <div className="prontuario-bottom">
        <section className="evolucoes-card card card-muted">
          <div className="evolucoes-header">
            <div>
              <h3>Evolucoes</h3>
              <p>Comparativo entre as últimas avaliações registradas.</p>
            </div>
          </div>
          <div className="evolucoes-grid">
            {(() => {
              const evolucaoConfigs = [
                { tipo: 'bioimpedancia', label: 'Bioimpedancia', unit: '%', keys: ['percentualGordura'] },
                { tipo: 'dobras_cutaneas', label: 'Dobras cutaneas', unit: '%', keys: ['percentualGordura'] },
                { tipo: 'perimetros', label: 'Perimetros', unit: 'cm', keys: ['cintura'] },
                { tipo: 'alimentar', label: 'Avaliação alimentar', unit: 'kcal', keys: ['totalDiario'] },
                { tipo: 'hidratacao', label: 'Hidratacao', unit: '%', keys: ['perdaPesoPercentual', 'taxaSudorese'] },
                { tipo: 'avaliacao_socioeconomica', label: 'EBIA', unit: 'pts', keys: ['pontuacaoEBIA'] }
              ];

              const getNumericValue = (item, keys) => {
                if (!item || keys.length === 0) return null;
                for (const key of keys) {
                  const sources = [item.dados?.[key], item.resultados?.[key], item[key]];
                  for (const value of sources) {
                    const num = Number(value);
                    if (Number.isFinite(num)) return num;
                  }
                }
                return null;
              };

              return evolucaoConfigs.map((config) => {
                const items = avaliacoesOrdenadas
                  .filter((item) => item.tipo === config.tipo)
                  .map((item) => ({
                    ...item,
                    dateObj: convertFirebaseDate(item.createdAt || item.data)
                  }))
                  .filter((item) => item.dateObj)
                  .sort((a, b) => a.dateObj - b.dateObj);
                const lastItem = items[items.length - 1] || null;
                const prevItem = items[items.length - 2] || null;
                const lastValue = getNumericValue(lastItem, config.keys);
                const prevValue = getNumericValue(prevItem, config.keys);
                const delta = lastValue !== null && prevValue !== null ? lastValue - prevValue : null;
                const sparkValues = items
                  .slice(-3)
                  .map((item) => getNumericValue(item, config.keys))
                  .filter((value) => Number.isFinite(value));
                const sparkMax = sparkValues.length ? Math.max(...sparkValues) : 1;

                return (
                  <div key={config.tipo} className="evolucao-item">
                    <div className="evolucao-top">
                      <span className="evolucao-title">{config.label}</span>
                      <span className={`evolucao-tag ${items.length ? 'active' : 'empty'}`}>
                        {items.length ? `${items.length} registros` : 'Sem dados'}
                      </span>
                    </div>
                    <div className="evolucao-main">
                      {lastValue !== null ? (
                        <div className="evolucao-metric">
                          <strong>{formatMetric(lastValue, config.unit)}</strong>
                          {delta !== null && (
                            <span className={`evolucao-delta ${delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'}`}>
                              {delta > 0 ? '+' : ''}{delta.toFixed(1)}{config.unit}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="evolucao-metric muted">Sem indicador numerico</div>
                      )}
                      <span className="evolucao-date">
                        Última: {lastItem?.dateObj ? formatDate(lastItem.dateObj) : '---'}
                      </span>
                    </div>
                    {sparkValues.length > 0 && (
                      <div className="evolucao-spark">
                        {sparkValues.map((value, index) => (
                          <span
                            key={`${config.tipo}-${index}`}
                            className="spark-bar"
                            style={{ height: `${Math.max(10, (value / sparkMax) * 100)}%` }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        </section>

        <div className="evolution-card card card-muted">
          <div className="history-header">
            <h3>Evolucao (Bioimpedancia)</h3>
            <span>{bioHistory.length} registros</span>
          </div>
          {bioHistory.length === 0 ? (
            <div className="history-empty">Sem dados de bioimpedancia.</div>
          ) : (
            <div className="evolution-table">
              <div className="evolution-row evolution-head">
                <span>Data</span>
                <span>Peso (kg)</span>
                <span>% Gordura</span>
                <span>Massa magra</span>
                <span>IMC</span>
              </div>
              {bioHistory.slice(-6).map((item) => (
                <div key={item.id} className="evolution-row">
                  <span>{formatDate(item.date)}</span>
                  <span>{formatMetric(item.peso)}</span>
                  <span>{formatMetric(item.gordura)}</span>
                  <span>{formatMetric(item.massaMagra)}</span>
                  <span>{formatMetric(item.imc)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div ref={consultationHistoryRef} className="consultation-history-card card card-muted">
          <div className="history-header">
            <div>
              <h3>Histórico de consultas</h3>
              <p className="consultation-header-subtitle">
                Rastreie atendimentos, remarcações e faltas deste paciente.
              </p>
            </div>
            <div className="consultation-header-actions">
              <span>{filteredConsultationHistory.length} registros</span>
              <button
                type="button"
                className="consultation-export-btn"
                onClick={handleRefreshAppointments}
                disabled={loadingAppointments || isRefreshingAppointments}
              >
                {isRefreshingAppointments ? <Loader2 size={14} className="spin" /> : <RefreshCcw size={14} />}
                {isRefreshingAppointments ? 'Atualizando...' : 'Atualizar'}
              </button>
              <button
                type="button"
                className="consultation-export-btn"
                onClick={exportConsultationHistoryCsv}
                disabled={filteredConsultationHistory.length === 0 || loadingAppointments}
              >
                <Download size={14} />
                Exportar CSV
              </button>
            </div>
          </div>

          <div className="consultation-summary">
            <span className="consultation-summary-chip">
              <strong>{consultationHistory.length}</strong>
              <small>Total</small>
            </span>
            <span className="consultation-summary-chip">
              <strong>{consultationStatusSummary.agendada || 0}</strong>
              <small>Agendadas</small>
            </span>
            <span className="consultation-summary-chip">
              <strong>{consultationStatusSummary.realizada || 0}</strong>
              <small>Realizadas</small>
            </span>
            <span className="consultation-summary-chip">
              <strong>{consultationStatusSummary.remarcada || 0}</strong>
              <small>Remarcadas</small>
            </span>
            <span className="consultation-summary-chip">
              <strong>{consultationStatusSummary.falta || 0}</strong>
              <small>Faltas</small>
            </span>
          </div>

          <div className="consultation-controls">
            <select
              value={consultationStatusFilter}
              onChange={(event) => setConsultationStatusFilter(event.target.value)}
              aria-label="Filtrar histórico de consultas por status"
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
              onChange={(event) => setConsultationTypeFilter(event.target.value)}
              aria-label="Filtrar histórico de consultas por tipo"
            >
              <option value="all">Todos os tipos</option>
              <option value="primeira_consulta">Primeira consulta</option>
              <option value="retorno">Retorno</option>
            </select>
            <select
              value={consultationPeriodFilter}
              onChange={(event) => setConsultationPeriodFilter(event.target.value)}
              aria-label="Filtrar histórico de consultas por período"
            >
              <option value="all">Todos os períodos</option>
              <option value="future">Futuras</option>
              <option value="past">Passadas</option>
            </select>
            <input
              type="text"
              placeholder="Buscar por horário, status ou profissional..."
              value={consultationSearch}
              onChange={(event) => setConsultationSearch(event.target.value)}
              aria-label="Buscar no histórico de consultas"
            />
            <button
              type="button"
              onClick={handleClearConsultationFilters}
              disabled={!hasConsultationFiltersApplied}
            >
              Limpar
            </button>
          </div>
          <div className="consultation-controls-meta" role="status" aria-live="polite">
            <span>{filteredConsultationHistory.length} de {consultationHistory.length} consulta(s) exibida(s)</span>
            {hasConsultationFiltersApplied && (
              <span>Filtros aplicados sobre o histórico completo ({consultationHistory.length})</span>
            )}
            {isRefreshingAppointments && <span>Sincronizando histórico de consultas...</span>}
            <span>{appointmentsSyncLabel}</span>
          </div>

          {loadingAppointments ? (
            <div className="history-empty history-empty--loading" role="status" aria-live="polite">
              <Loader2 size={14} className="spin" />
              <span>Carregando histórico de consultas...</span>
            </div>
          ) : appointmentsError ? (
            <div className="history-inline-error">
              <p>{appointmentsError}</p>
              <button type="button" className="history-inline-action" onClick={loadAppointments}>
                Recarregar histórico
              </button>
            </div>
          ) : filteredConsultationHistory.length === 0 ? (
            <div className="history-empty">
              {hasConsultationFiltersApplied
                ? 'Nenhuma consulta encontrada com os filtros aplicados.'
                : 'Nenhuma consulta registrada para este paciente.'}
              {hasConsultationFiltersApplied && (
                <button type="button" className="history-inline-action" onClick={handleClearConsultationFilters}>
                  Limpar filtros
                </button>
              )}
            </div>
          ) : (
	            <div className="consultation-table">
	              <div className="consultation-row consultation-row-head">
	                <span>Data</span>
	                <span>Horário</span>
	                <span>Tipo</span>
	                <span>Profissional</span>
	                <span>Status</span>
	                <span>Avaliações</span>
	              </div>
	              {visibleConsultationHistory.map((item) => {
	                const remarcadaParaDate = convertFirebaseDate(item.remarcadaPara);
	                return (
	                  <div key={item.id} className="consultation-row">
	                    <span data-label="Data">{item.scheduledDate ? formatDate(item.scheduledDate) : '---'}</span>
	                    <span data-label="Horário">{item.time || '--:--'}</span>
	                    <span data-label="Tipo">{getAppointmentTypeLabel(item)}</span>
	                    <span data-label="Profissional">{item.professionalName || 'Não informado'}</span>
	                    <span data-label="Status">
	                      <span className={`consultation-status status-${item.normalizedStatus || 'agendada'}`}>
	                        {getAppointmentStatusLabel(item.normalizedStatus)}
	                      </span>
                      {item.normalizedStatus === 'remarcada' && remarcadaParaDate && (
                        <small className="consultation-status-meta">
	                          para {formatDate(remarcadaParaDate)}
	                        </small>
	                      )}
	                    </span>
	                    <span data-label="Avaliações">{item.evaluationsCount || 0}</span>
	                  </div>
	                );
	              })}
            </div>
          )}

          {consultationHasMore && (
            <div className="timeline-more">
              <button
                type="button"
                className="btn-new-eval"
                onClick={handleLoadMoreConsultations}
              >
                Carregar mais consultas
              </button>
            </div>
          )}
        </div>

        <div ref={timelineSectionRef} className="timeline-card card card-muted">
          <div className="history-header">
            <h3>Linha do tempo clínica</h3>
            <span>{filteredTimelineEvents.length} eventos</span>
          </div>
          <div className="timeline-controls">
            <select
              value={timelineFilterType}
              onChange={(event) => setTimelineFilterType(event.target.value)}
            >
              <option value="all">Todos os tipos</option>
              <option value="consulta">Consultas</option>
              <option value="avaliacao">Avaliações</option>
              <option value="observacao">Observações</option>
            </select>
            <select
              value={timelineFilterStatus}
              onChange={(event) => setTimelineFilterStatus(event.target.value)}
            >
              <option value="all">Todos os status</option>
              {timelineStatusOptions.map((status) => (
                <option key={status} value={status}>{getTimelineStatusOptionLabel(status)}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Buscar evento, responsável ou status..."
              value={timelineSearch}
              onChange={(event) => setTimelineSearch(event.target.value)}
            />
            <button
              type="button"
              onClick={() => {
                setTimelineFilterType('all');
                setTimelineFilterStatus('all');
                setTimelineSearch('');
              }}
            >
              Limpar
            </button>
          </div>
          {filteredTimelineEvents.length === 0 ? (
            <div className="history-empty">Sem eventos recentes.</div>
          ) : (
            <div className="timeline-list">
              {visibleTimeline.map((event) => (
                <div key={event.id} className={`timeline-item type-${event.type}`}>
                  <div className="timeline-icon" aria-hidden="true">
                    {event.type === 'consulta'
                      ? <Clock size={14} />
                      : event.type === 'avaliacao'
                        ? <Activity size={14} />
                        : <FileText size={14} />}
                  </div>
                  <div className="timeline-info">
                    <strong>{event.title}</strong>
                    {event.description && <span className="timeline-description">{event.description}</span>}
                    <span>{formatDate(event.date)}{event.meta?.hora ? ` - ${event.meta.hora}` : ''}</span>
                  </div>
                  <span className={`timeline-status status-${event.status}`}>{getTimelineStatusLabel(event)}</span>
                </div>
              ))}
              {timelineHasMore && (
                <div className="timeline-more">
                  <button
                    type="button"
                    className="btn-new-eval"
                    onClick={handleLoadMoreTimeline}
                  >
                    Carregar mais
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <section className="prontuario-continuity card card-primary">
          <div className="prontuario-continuity__header">
            <h3>Próximos passos clínicos</h3>
            <p>Priorize os itens abaixo para manter o acompanhamento em continuidade.</p>
          </div>
          <div className="prontuario-continuity__list">
            {continuityItems.map((item) => (
              <div key={item.id} className={`prontuario-continuity__item level-${item.level}`}>
                <strong>{item.title}</strong>
                <p>{item.description}</p>
              </div>
            ))}
          </div>
          <div className="prontuario-continuity__actions">
            {podeEditarAvaliacoes && (
              <button type="button" className="prontuario-continuity__btn" onClick={() => setIsAppointmentOpen(true)}>
                <Clock size={14} />
                Nova consulta
              </button>
            )}
            {podeEditarAvaliacoes && (
              <button type="button" className="prontuario-continuity__btn" onClick={handleNovaAvaliacao}>
                <PlusCircle size={14} />
                Nova avaliação
              </button>
            )}
            <button type="button" className="prontuario-continuity__btn" onClick={handleOpenHistory}>
              <History size={14} />
              Histórico
            </button>
            <button
              type="button"
              className="prontuario-continuity__btn"
              onClick={exportConsultationHistoryCsv}
              disabled={filteredConsultationHistory.length === 0}
            >
              <Download size={14} />
              Exportar CSV
            </button>
          </div>
        </section>

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
                <h2 id="project-link-modal-title" className="app-modal-title">Projeto do paciente</h2>
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
                {loadingProjects ? 'Carregando projetos...' : 'O vinculo sera refletido na area administrativa.'}
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
                      Salvar vinculo
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

export default PatientProntuario;

function normalizeEvaluationType(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');
}

function toNumericValue(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(String(value).replace(',', '.').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeHeightCm(value) {
  const numeric = toNumericValue(value);
  if (!Number.isFinite(numeric)) return null;
  if (numeric > 0 && numeric <= 3) return numeric * 100;
  return numeric;
}

function normalizeSexLabel(value) {
  const token = String(value || '').trim().toLowerCase();
  if (!token) return '';
  if (token.includes('fem')) return 'FEMININO';
  if (token.includes('masc')) return 'MASCULINO';
  if (token === 'f') return 'FEMININO';
  if (token === 'm') return 'MASCULINO';
  return String(value).toUpperCase();
}

function resolveEvaluationField(evaluation, keys = []) {
  if (!evaluation || !Array.isArray(keys)) return null;
  const sources = [evaluation?.dados || {}, evaluation?.resultados || {}, evaluation];
  for (const key of keys) {
    for (const source of sources) {
      if (source && Object.prototype.hasOwnProperty.call(source, key)) {
        const value = source[key];
        if (value !== null && value !== undefined && String(value).trim() !== '') {
          return value;
        }
      }
    }
  }
  return null;
}

function createAnthropometryDraft(source) {
  return {
    pesoKg: Number.isFinite(source?.pesoKg) ? Number(source.pesoKg).toFixed(1) : '',
    estaturaCm: Number.isFinite(source?.estaturaCm) ? Number(source.estaturaCm).toFixed(1) : '',
    idade: Number.isFinite(source?.idade) ? String(Math.round(source.idade)) : '',
    sexo: normalizeSexLabel(source?.sexo)
  };
}

function buildSharedAnthropometryData(source) {
  const payload = {};
  if (!source || typeof source !== 'object') return payload;

  const peso = toNumericValue(source.pesoKg);
  const estaturaCm = normalizeHeightCm(source.estaturaCm);
  const idade = toNumericValue(source.idade);
  const sexo = normalizeSexLabel(source.sexo);

  if (Number.isFinite(peso)) {
    payload.peso = peso;
    payload.weight = peso;
  }
  if (Number.isFinite(estaturaCm)) {
    payload.estatura = estaturaCm;
    payload.altura = estaturaCm;
    payload.height = estaturaCm;
  }
  if (Number.isFinite(idade)) {
    payload.idade = Math.round(idade);
    payload.age = Math.round(idade);
  }
  if (sexo) {
    payload.sexo = sexo;
    payload.genero = sexo;
    payload.sex = sexo;
  }

  return payload;
}

function resolveSumSevenFolds(evaluation) {
  const explicitSum = toNumericValue(resolveEvaluationField(evaluation, [
    'somaSeteDobras',
    'soma_dobras_7',
    'somaDobras'
  ]));
  if (Number.isFinite(explicitSum)) return explicitSum;

  const foldValues = [
    toNumericValue(resolveEvaluationField(evaluation, ['peitoral', 'peitoral_mm'])),
    toNumericValue(resolveEvaluationField(evaluation, ['axilarMedia', 'axilar_media', 'axilar_media_mm'])),
    toNumericValue(resolveEvaluationField(evaluation, ['triceps', 'tricipital', 'tricipital_mm'])),
    toNumericValue(resolveEvaluationField(evaluation, ['subescapular', 'subescapular_mm'])),
    toNumericValue(resolveEvaluationField(evaluation, ['abdominal', 'abdominal_mm'])),
    toNumericValue(resolveEvaluationField(evaluation, ['supraIliaca', 'suprailiaca', 'supra_iliaca_mm'])),
    toNumericValue(resolveEvaluationField(evaluation, ['coxa', 'coxa_mm']))
  ];
  if (foldValues.some((value) => !Number.isFinite(value))) return null;
  return foldValues.reduce((total, value) => total + value, 0);
}

function calculateBodyDensityJP7({ somaSeteDobras, idade, sexo }) {
  if (!Number.isFinite(somaSeteDobras) || !Number.isFinite(idade) || !sexo) return null;
  if (sexo === 'MASCULINO') {
    return 1.112
      - (0.00043499 * somaSeteDobras)
      + (0.00000055 * (somaSeteDobras ** 2))
      - (0.00028826 * idade);
  }
  if (sexo === 'FEMININO') {
    return 1.0970
      - (0.00046971 * somaSeteDobras)
      + (0.00000056 * (somaSeteDobras ** 2))
      - (0.00012828 * idade);
  }
  return null;
}

function calculateSiriBodyFat(densidadeCorporal) {
  if (!Number.isFinite(densidadeCorporal) || densidadeCorporal <= 0) return null;
  return (495 / densidadeCorporal) - 450;
}

function calculateImcFromWeightHeight(pesoKg, estaturaCm) {
  if (!Number.isFinite(pesoKg) || !Number.isFinite(estaturaCm) || estaturaCm <= 0) return null;
  const estaturaM = estaturaCm / 100;
  return pesoKg / (estaturaM * estaturaM);
}

function classifyBmi(imc) {
  if (!Number.isFinite(imc)) return 'IMC não calculado';
  if (imc < 18.5) return 'Baixo peso';
  if (imc < 25) return 'Eutrofia';
  if (imc < 30) return 'Sobrepeso';
  if (imc < 35) return 'Obesidade grau I';
  if (imc < 40) return 'Obesidade grau II';
  return 'Obesidade grau III';
}

function classifyWaistRisk(cintura, sexo) {
  if (!Number.isFinite(cintura)) return 'Sem classificação';
  if (sexo === 'FEMININO') {
    if (cintura < 80) return 'Baixo risco';
    if (cintura < 88) return 'Risco elevado';
    return 'Risco muito elevado';
  }
  if (sexo === 'MASCULINO') {
    if (cintura < 94) return 'Baixo risco';
    if (cintura < 102) return 'Risco elevado';
    return 'Risco muito elevado';
  }
  return 'Risco não classificado';
}

function buildNumericDelta(currentValue, previousValue) {
  if (!Number.isFinite(currentValue) || !Number.isFinite(previousValue)) {
    return { available: false, value: null };
  }
  return {
    available: true,
    value: currentValue - previousValue
  };
}

function formatDeltaLabel(deltaObj, unit = '') {
  if (!deltaObj?.available || !Number.isFinite(deltaObj?.value)) return 'Sem comparativo anterior';
  if (Math.abs(deltaObj.value) < 0.05) return 'Sem variacao relevante';
  const signal = deltaObj.value > 0 ? '+' : '';
  const normalizedUnit = unit ? ` ${unit}` : '';
  return `Variacao ${signal}${deltaObj.value.toFixed(1)}${normalizedUnit}`;
}

function formatNumeric(value, digits = 1, fixed = true) {
  if (!Number.isFinite(value)) return '';
  if (!fixed) {
    if (digits === 0) return String(Math.round(value));
    return String(Number(value.toFixed(digits)));
  }
  return value.toFixed(digits);
}

function buildEvaluationTimelineSummary(evaluation) {
  const type = normalizeEvaluationType(evaluation?.tipo);
  if (type === 'bioimpedancia') {
    const percentualGordura = toNumericValue(resolveEvaluationField(evaluation, ['percentual_gordura', 'percentualGordura']));
    const massaMagra = toNumericValue(resolveEvaluationField(evaluation, ['massa_magra', 'massaMagra']));
    const aguaTotal = toNumericValue(resolveEvaluationField(evaluation, ['agua_total', 'aguaTotal', 'aguaCorporal']));
    const alvoPercentual = toNumericValue(resolveEvaluationField(evaluation, ['alvo_percentual_gordura', 'alvoPercentualGordura']));
    const peso = toNumericValue(resolveEvaluationField(evaluation, ['peso', 'weight']));
    let metaText = '';
    if (Number.isFinite(alvoPercentual) && Number.isFinite(percentualGordura) && Number.isFinite(peso)) {
      const gorduraParaMetaKg = ((percentualGordura - alvoPercentual) / 100) * peso;
      if (gorduraParaMetaKg > 0.1) metaText = ` (↓${gorduraParaMetaKg.toFixed(1)}kg p/ meta)`;
      else if (gorduraParaMetaKg < -0.1) metaText = ` (↑${Math.abs(gorduraParaMetaKg).toFixed(1)}kg abaixo da meta)`;
      else metaText = ' (na meta)';
    }
    const blocks = [];
    if (Number.isFinite(percentualGordura)) blocks.push(`%G ${percentualGordura.toFixed(1)}%${metaText}`);
    if (Number.isFinite(massaMagra)) blocks.push(`MM ${massaMagra.toFixed(1)}kg`);
    if (Number.isFinite(aguaTotal)) blocks.push(`Agua ${aguaTotal.toFixed(1)}L`);
    return blocks.join(' | ');
  }

  if (type === 'dobras_cutaneas') {
    const somaSeteDobras = resolveSumSevenFolds(evaluation);
    const idade = toNumericValue(resolveEvaluationField(evaluation, ['idade', 'age']));
    const sexo = normalizeSexLabel(resolveEvaluationField(evaluation, ['sexo', 'genero', 'sex']));
    const densidade = calculateBodyDensityJP7({ somaSeteDobras, idade, sexo });
    const percentualGordura = toNumericValue(resolveEvaluationField(evaluation, ['percentual_gordura', 'percentualGordura']))
      ?? calculateSiriBodyFat(densidade);
    const massaMagra = toNumericValue(resolveEvaluationField(evaluation, ['massa_magra', 'massaMagra']));
    const blocks = [];
    if (Number.isFinite(percentualGordura)) blocks.push(`%G ${percentualGordura.toFixed(1)}%`);
    if (Number.isFinite(massaMagra)) blocks.push(`MM ${massaMagra.toFixed(1)}kg`);
    if (Number.isFinite(somaSeteDobras)) blocks.push(`Σ7 ${somaSeteDobras.toFixed(1)}mm`);
    return blocks.join(' | ');
  }

  if (type === 'perimetros') {
    const cintura = toNumericValue(resolveEvaluationField(evaluation, ['cintura', 'cintura_cm']));
    const quadril = toNumericValue(resolveEvaluationField(evaluation, ['quadril', 'quadril_cm']));
    const blocks = [];
    if (Number.isFinite(cintura)) blocks.push(`Cintura ${cintura.toFixed(1)}cm`);
    if (Number.isFinite(quadril)) blocks.push(`Quadril ${quadril.toFixed(1)}cm`);
    return blocks.join(' | ');
  }

  return '';
}

















