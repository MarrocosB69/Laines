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
import { estadoDoProntuario } from '../../../core/prontuario/estado';
import { buildClinicalSnapshot, buildProntuarioOverview } from '../../../components/Prontuario/prontuarioOverview';
import { useModalBodyLock } from '../../../hooks/useModalBodyLock';
import {
  uploadPatientAttachment,
  downloadPatientAttachment,
  deletePatientAttachment
} from '../../../services/storage';
import api, { getApiErrorMessage } from '../../../services/api';
import { enviarAvaliacaoParaRevisao } from '../../../services/supervisao';
import {
  getEvaluationStatusLabel,
  getEvaluationTypeLabel
} from '../../../components/shared/evaluationSummaryUtils';
import {
  getEditableTypesForUser,
  listEvaluationRegistryByContext,
  getVisibleTypesForUser,
  normalizeAreaToken
} from '../../../constants/evaluationRegistry';
import { ATHLETE_SELF_EVALUATION_CONFIGS } from '../../Athlete/athleteSelfEvaluations';
import { buildEvaluationTimelineSummary } from '../../../components/shared/evaluationResultAdapter';
import AppointmentModal from './AppointmentModal';
import ProntuarioHeader from '../../../components/Prontuario/ProntuarioHeader';
import ProntuarioTabs from '../../../components/Prontuario/ProntuarioTabs';
import ResumoClinico from '../../../components/Prontuario/ResumoClinico';
import PainelDivergencias from '../../../components/Prontuario/PainelDivergencias';
import DashboardAvaliacoes from '../../../components/Prontuario/DashboardAvaliacoes';
import VisaoGeral from '../../../components/Prontuario/VisaoGeral';
import TimelineConsultas from '../../../components/Prontuario/TimelineConsultas';
import PainelAnexos from '../../../components/Prontuario/PainelAnexos';
import PainelMensagens from '../../../components/Prontuario/PainelMensagens';
import ProntuarioPendencias from '../../../components/Prontuario/ProntuarioPendencias';
import ProntuarioAssessmentSidebar from '../../../components/Prontuario/ProntuarioAssessmentSidebar';
import PainelRevisaoAtleta from '../../../components/Prontuario/PainelRevisaoAtleta';
import EvolucaoAnalytics from '../../../components/Prontuario/EvolucaoAnalytics';

// A avaliacao pesa ~460 kB: so carrega quando um modulo e aberto de fato.
const AvaliacaoCompleta = React.lazy(() => import('../../AvaliacaoCompleta'));
import { FeedbackState } from '../../../components/ui';

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
  'professor',
  'profissional',
  'aluno'
]);

const PROJECT_LINK_EDITOR_ROLES = new Set([
  'admin',
  'coordenacao'
]);

const PATIENT_MANAGER_ROLES = PROJECT_LINK_EDITOR_ROLES;

const SUPERVISION_ROLES = new Set([
  'professor',
  'profissional'
]);

const normalizeId = (value) => String(value || '').trim();

const normalizeEvaluationKey = (value) => (
  String(value || '').trim().toLowerCase().replace(/-/g, '_')
);

const EVALUATION_MODULE_ID_BY_KEY = listEvaluationRegistryByContext('avaliacaoCompleta')
  .reduce((map, item) => {
    const moduleId = item.moduleId || item.type;
    map.set(normalizeEvaluationKey(item.type), moduleId);
    map.set(normalizeEvaluationKey(moduleId), moduleId);
    return map;
  }, new Map());

const resolveEvaluationModuleId = (value, fallback = 'anamnese-inicial') => {
  const raw = String(value || '').trim();
  const key = normalizeEvaluationKey(raw || fallback);
  return EVALUATION_MODULE_ID_BY_KEY.get(key) || raw || fallback;
};

const getEvaluationClinicalDate = (evaluation, convertDate) => (
  convertDate(
    evaluation?.measuredAt
    || evaluation?.data
    || evaluation?.dataAvaliacao
    || evaluation?.createdAt
  )
);

const isPatientActiveStatus = (status) => {
  const normalized = String(status || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return normalized === 'ativo' || normalized === 'ativa';
};

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
  if (value && typeof value === 'object') {
    return Object.values(value)
      .flatMap((item) => normalizeStringArray(item))
      .filter(Boolean);
  }
  return [];
};

const asPlainObject = (value) => (
  value && typeof value === 'object' && !Array.isArray(value) ? value : {}
);

const firstFilled = (...values) => values.find((value) => {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return String(value).trim().length > 0;
});

const reportedValue = (value) => value === 'nao_informado' ? undefined : value;

const formatListValue = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (item && typeof item === 'object') {
          return Object.values(item)
            .map((entry) => String(entry || '').trim())
            .filter(Boolean)
            .join(' - ');
        }
        return String(item || '').trim();
      })
      .filter(Boolean)
      .join(', ');
  }
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .map(([key, item]) => {
        if (Array.isArray(item)) {
          const text = item.map((entry) => String(entry || '').trim()).filter(Boolean).join(', ');
          return text ? `${key}: ${text}` : '';
        }
        const text = String(item || '').trim();
        return text ? `${key}: ${text}` : '';
      })
      .filter(Boolean)
      .join(' | ');
  }
  return value;
};

const formatFamilyHistoryValue = (value) => {
  if (Array.isArray(value)) return formatListValue(value);
  const record = asPlainObject(value);
  const groups = [
    ['pai', 'Pai'],
    ['mae', 'Mae'],
    ['legado', 'Historico']
  ];
  return groups
    .map(([key, label]) => {
      const list = normalizeStringArray(record[key]);
      return list.length ? `${label}: ${list.join(', ')}` : '';
    })
    .filter(Boolean)
    .join(' | ');
};

const getPublicTriageData = (confirmation) => {
  const publicInscricao = asPlainObject(confirmation?.inscricaoPublica);
  return asPlainObject(publicInscricao.dados);
};

const PatientProntuario = ({ patient, onBack, originPath = '', originView = '', originTab = '' }) => {
  const [avaliacoes, setAvaliacoes] = useState([]);
  const [loadingEvaluations, setLoadingEvaluations] = useState(true);
  const [evaluationsError, setEvaluationsError] = useState('');
  const [planState, setPlanState] = useState({ patientId: '', loading: true, items: [], error: '' });
  const evaluationRequestRef = useRef(0);
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [isAppointmentOpen, setIsAppointmentOpen] = useState(false);
  const [appointments, setAppointments] = useState([]);
  const [loadingAppointments, setLoadingAppointments] = useState(true);
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
  const [togglingAthleteFormType, setTogglingAthleteFormType] = useState(null);
  const [athleteFormReleasesOverride, setAthleteFormReleasesOverride] = useState(null);
  const [isMarkingReviewedId, setIsMarkingReviewedId] = useState(null);
  // UPD-17: formulario inline de "enviar para revisao" no historico de
  // avaliacoes — um item aberto por vez, sem modal.
  const [activeReviewRequestId, setActiveReviewRequestId] = useState(null);
  const [reviewRequestNote, setReviewRequestNote] = useState('');
  const [isSendingReviewRequest, setIsSendingReviewRequest] = useState(false);
  const [projectLink, setProjectLink] = useState({
    id: '',
    nome: ''
  });
  const consultationHistoryRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const {
    getAvaliacoesByPacientePaged,
    formatDate,
    convertFirebaseDate,
    updatePaciente
  } = usePacientes();
  const { notify, confirm } = useUiFeedback();

  useModalBodyLock(isProjectModalOpen);

  const moduleConfig = useMemo(() => {
    const visibleTypes = getVisibleTypesForUser(user, patient);
    return listEvaluationRegistryByContext('prontuario')
      .filter((item) => visibleTypes.has(item.type))
      .map((item) => ({
        id: item.moduleId || item.type,
        label: item.shortLabel || item.label,
        tipo: item.type,
        group: item.macroStageLabel || item.groupLabel || 'Instrumentos'
      }));
  }, [patient, user]);
  const appointmentEvaluationOptions = useMemo(
    () => moduleConfig.map((item) => ({ id: item.tipo, label: item.label })),
    [moduleConfig]
  );
  /**
   * Areas ja presentes na equipe deste caso.
   *
   * Instrumento restrito a uma area (psicologia, fisioterapia) so vira "nao
   * aplicavel" quando o caso ja tem equipe registrada sem ninguem daquela
   * area — nunca por falta de dado. Vem do cadastro de equipe que o caso já
   * tem; nenhum campo novo.
   */
  const patientTeamAreas = useMemo(() => new Set(
    (Array.isArray(patient?.equipeProfissional) ? patient.equipeProfissional : [])
      .map((member) => normalizeAreaToken(member?.area))
      .filter(Boolean)
  ), [patient?.equipeProfissional]);
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
  const currentUserId = normalizeId(user?.uid || user?.id);
  const isPatientManager = PATIENT_MANAGER_ROLES.has(normalizedUserRole);
  const isPatientResponsible = Boolean(
    currentUserId
    && (normalizeId(patient?.alunoResponsavelId) === currentUserId || normalizeId(patient?.alunoResponsavel?.id) === currentUserId)
  );
  const isPatientTeamMember = Boolean(
    currentUserId
    && (
      (Array.isArray(patient?.equipeTecnicaIds) && patient.equipeTecnicaIds.some((id) => normalizeId(id) === currentUserId))
      || (Array.isArray(patient?.equipeMultiIds) && patient.equipeMultiIds.some((id) => normalizeId(id) === currentUserId))
      || (
        Array.isArray(patient?.equipeProfissional)
        && patient.equipeProfissional.some((member) => normalizeId(member?.userId) === currentUserId)
      )
    )
  );
  const isPatientSupervisor = Boolean(
    currentUserId
    && SUPERVISION_ROLES.has(normalizedUserRole)
    && (
      normalizeId(patient?.professorSupervisorId) === currentUserId
      || normalizeId(patient?.professorSupervisor?.id) === currentUserId
      || (
        Array.isArray(patient?.equipeProfissional)
        && patient.equipeProfissional.some((member) => (
          normalizeId(member?.userId) === currentUserId
          && String(member?.papel || '').toLowerCase().includes('super')
        ))
      )
    )
  );
  /**
   * Tipos que este usuario pode preencher neste caso.
   *
   * A decisao e do servidor (`capacidadesDoCaso`, UPD-12): a mesma regra que
   * barra a criacao em `assertCaseAreaEditAccess`. O calculo local so cobre
   * resposta de API antiga, para a tela nao ficar sem acao; quando o servidor
   * fala, o cliente nao rediscute.
   */
  const editableEvaluationTypes = useMemo(() => {
    const doServidor = patient?.capacidadesDoCaso?.tiposEditaveis;
    if (Array.isArray(doServidor)) return new Set(doServidor);
    return getEditableTypesForUser(user, patient);
  }, [patient, user]);
  const isStudentLinkedToPatient = isStudentMemberRole(normalizedUserRole) && (isPatientResponsible || isPatientTeamMember);
  const hasScopedClinicalAccess = isPatientResponsible || isPatientTeamMember || isPatientSupervisor;
  const canCreateEvaluation = isPatientManager || (isStudentLinkedToPatient && editableEvaluationTypes.size > 0);
  const canCreateAppointment = canCreateEvaluation;
  const canManageAthleteForms = isPatientManager || isPatientSupervisor;
  const canReviewAthleteSubmissions = isPatientManager || hasScopedClinicalAccess;
  const canEditClinicalSummary = isPatientManager
    || isPatientSupervisor
    || (isStudentLinkedToPatient && editableEvaluationTypes.has('anamnese_inicial'));
  const canWriteSupervisorMessage = isPatientManager || isPatientSupervisor;
  const canCreateMealPlan = isPatientManager
    || editableEvaluationTypes.has('alimentar')
    || editableEvaluationTypes.has('gasto_energetico_total');
  const canLinkProject = PROJECT_LINK_EDITOR_ROLES.has(normalizedUserRole);
  const podeEditarAvaliacoes = canCreateEvaluation;
  const podeEditarResumo = canEditClinicalSummary;
  // UPD-17: envio para revisao segue o mesmo vinculo que o servidor aceita
  // (responsavel/equipe/gestao) — supervisor revisa, nao envia pelo aluno.
  const podeEnviarParaRevisao = isPatientManager || isPatientResponsible || isPatientTeamMember;
  const podeEnviarAnexo = canManageAthleteForms && ATTACHMENT_EDITOR_ROLES.has(normalizedUserRole);
  const podeRemoverAnexo = (isPatientManager || isPatientSupervisor) && ATTACHMENT_EDITOR_ROLES.has(normalizedUserRole);
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
  const athleteConfirmation = useMemo(() => (
    patient?.confirmacaoAtleta || {}
  ), [patient?.confirmacaoAtleta]);
  const athleteRegistrationCompleted = Boolean(athleteConfirmation?.completed);
  const hasAthleteAccount = Boolean(
    patient?.atletaUserId
    || athleteConfirmation?.atletaUserId
    || athleteConfirmation?.userId
    || athleteConfirmation?.uid
  );
  const athleteLoginEmail = patient?.email || athleteConfirmation?.email || '';

  /**
   * Consentimento para pesquisa, pronto para o cabeçalho.
   *
   * O dado sempre existiu na resposta da API e não aparecia em lugar nenhum do
   * prontuário — só no modal de cadastro. Quem decide usar o caso em pesquisa
   * decide aqui, e precisa do fato aqui.
   */
  const consentimentoResumo = useMemo(() => {
    const bruto = String(patient?.consentimentoPesquisa || '').trim().toLowerCase();
    const versao = patient?.consentimentoVersao ? `v${patient.consentimentoVersao}` : '';
    const data = patient?.consentimentoData ? formatDate(patient.consentimentoData) : '';
    const detalhe = [versao, data].filter(Boolean).join(' · ');

    if (bruto === 'aceito' || bruto === 'assinado' || bruto === 'sim') {
      return { tom: 'ok', rotulo: 'Consentido', detalhe };
    }
    if (bruto === 'recusado' || bruto === 'nao') {
      return { tom: 'warn', rotulo: 'Recusado', detalhe };
    }
    if (!bruto) return { tom: 'muted', rotulo: 'Não registrado', detalhe: '' };
    return { tom: 'warn', rotulo: 'Pendente', detalhe };
  }, [patient?.consentimentoPesquisa, patient?.consentimentoVersao, patient?.consentimentoData, formatDate]);
  const isPatientActive = isPatientActiveStatus(patient?.status);
  const patientStatusLabel = patient?.status || (isPatientActive ? 'Ativo' : 'Sem status');
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

  useEffect(() => {
    setAthleteFormReleasesOverride(null);
  }, [athleteConfirmation?.formulariosLiberados, patient?.id]);

  const athleteFormReleases = useMemo(
    () => athleteFormReleasesOverride || athleteConfirmation?.formulariosLiberados || {},
    [athleteConfirmation?.formulariosLiberados, athleteFormReleasesOverride]
  );
  const dadosGeraisFields = useMemo(() => {
    const publicTriageData = getPublicTriageData(athleteConfirmation);
    const athleteInitialData = {
      ...publicTriageData,
      ...asPlainObject(athleteConfirmation?.dados)
    };
    const ebiaSummary = (() => {
      const respostas = Array.isArray(athleteInitialData.ebia?.respostas)
        ? athleteInitialData.ebia.respostas
        : [];
      if (!respostas.length) return '';
      const positivas = respostas.filter((item) => String(item?.resposta || '').toLowerCase() === 'sim').length;
      return `${positivas}/${respostas.length} respostas positivas`;
    })();
    const redsSummary = athleteInitialData.redsScore !== undefined && athleteInitialData.redsScore !== null
      ? `${athleteInitialData.redsScore} ponto(s)${athleteInitialData.redsInstrumento ? ` - ${athleteInitialData.redsInstrumento}` : ''}`
      : '';
    return [
    { label: 'Nome completo', value: firstFilled(athleteInitialData.nomeCompleto, athleteInitialData.nome, patient?.nome, ''), group: 'identificacao' },
    { label: 'Data de nascimento', value: firstFilled(athleteInitialData.dataNascimento, patient?.dataNascimento, ''), group: 'identificacao' },
    { label: 'Genero', value: firstFilled(athleteInitialData.genero, patient?.genero, ''), group: 'identificacao' },
    { label: 'Sexo biologico', value: firstFilled(athleteInitialData.sexoBiologico, patient?.sexoBiologico, ''), group: 'identificacao' },
    { label: 'Telefone', value: firstFilled(athleteInitialData.telefone, patient?.telefone, ''), group: 'identificacao' },
    { label: 'Cidade/UF', value: [firstFilled(athleteInitialData.cidade, patient?.cidade), firstFilled(athleteInitialData.estado, patient?.estado)].filter(Boolean).join(' / '), group: 'identificacao' },
    { label: 'Pessoas na casa', value: athleteInitialData.pessoasCasa, group: 'socioeconomico' },
    { label: 'Profissao', value: athleteInitialData.profissao, group: 'socioeconomico' },
    { label: 'Renda familiar', value: firstFilled(athleteInitialData.rendaMensal, athleteInitialData.rendaMediaSm), group: 'socioeconomico' },
    { label: 'Escolaridade', value: athleteInitialData.escolaridade, group: 'socioeconomico' },
    { label: 'Motivo do atendimento', value: firstFilled(athleteInitialData.motivoAtendimento, athleteInitialData.queixaPrincipal, athleteInitialData.objetivo, reportedValue(patient?.objetivo)), group: 'clinico' },
    { label: 'Usa medicamento/suplemento', value: athleteInitialData.usaMedicamentoSuplemento, group: 'clinico' },
    { label: 'Detalhes do medicamento', value: firstFilled(athleteInitialData.medicamentoDetalhes, formatListValue(athleteInitialData.medicamentos)), group: 'clinico' },
    { label: 'Suplementos', value: firstFilled(athleteInitialData.suplementoNoDia, formatListValue(athleteInitialData.suplementos)), group: 'clinico' },
    { label: 'Diagnosticos pessoais', value: firstFilled(athleteInitialData.diagnosticosPessoais, formatListValue(athleteInitialData.comorbidadesPessoais), formatListValue(athleteInitialData.patologias)), group: 'clinico' },
    { label: 'Historico familiar', value: firstFilled(athleteInitialData.historicoFamiliar, formatFamilyHistoryValue(athleteInitialData.comorbidadesFamiliares)), group: 'clinico' },
    { label: 'Sinais relatados', value: formatListValue(athleteInitialData.sinaisClinicos), group: 'clinico' },
    { label: 'Condições gastrointestinais', value: athleteInitialData.condicaoGastrointestinal, group: 'clinico' },
    { label: 'Alergia/intolerancia', value: firstFilled(athleteInitialData.alergiaIntolerancia, athleteInitialData.alergias), group: 'clinico' },
    { label: 'Exames informados', value: formatListValue(athleteInitialData.examesRealizados), group: 'clinico' },
    { label: 'Não gosta de comer', value: athleteInitialData.naoGostaComer, group: 'alimentar' },
    { label: 'Ingestão de água', value: firstFilled(athleteInitialData.ingestaoAgua, athleteInitialData.hidratacao ? `${athleteInitialData.hidratacao} L/dia` : ''), group: 'alimentar' },
    { label: 'Litros de água/dia', value: firstFilled(athleteInitialData.litrosAguaDia, athleteInitialData.hidratacao), group: 'alimentar' },
    { label: 'Bristol', value: athleteInitialData.bristol ? `Tipo ${athleteInitialData.bristol}` : '', group: 'alimentar' },
    { label: 'Urina', value: [athleteInitialData.urinaPrimeira ? `primeira: ${athleteInitialData.urinaPrimeira}` : '', athleteInitialData.urinaUltima ? `ultima: ${athleteInitialData.urinaUltima}` : ''].filter(Boolean).join(' | '), group: 'alimentar' },
    { label: 'Prepara refeições', value: athleteInitialData.preparaRefeicoes, group: 'alimentar' },
    { label: 'Quem prepara', value: athleteInitialData.quemPrepara, group: 'alimentar' },
    { label: 'Temperos usados', value: athleteInitialData.temperos, group: 'alimentar' },
    { label: 'Óleos e gorduras', value: athleteInitialData.oleosGorduras, group: 'alimentar' },
    { label: 'Equipamentos em casa', value: athleteInitialData.equipamentosCasa, group: 'alimentar' },
    { label: 'Bebida alcoólica', value: athleteInitialData.bebidaAlcoolica, group: 'alimentar' },
    { label: 'Atividade física (horário/frequência)', value: firstFilled(athleteInitialData.atividadeFisica, patient?.modalidadePrincipal), group: 'rotina' },
    { label: 'Frequencia semanal', value: firstFilled(athleteInitialData.frequenciaSemanal, patient?.frequenciaSemanal), group: 'rotina' },
    { label: 'Duracao da sessão', value: firstFilled(athleteInitialData.duracaoSessao, patient?.duracaoSessao), group: 'rotina' },
    // Coletados no cadastro do atleta e que paravam antes da tela. Tempo de
    // prática é idade de treino — muda a leitura de qualquer marcador de
    // adaptação; tipo de treino muda a prescrição.
    { label: 'Tempo de prática', value: firstFilled(athleteInitialData.tempoPratica, patient?.tempoPratica), group: 'rotina' },
    { label: 'Tipo de treino', value: firstFilled(athleteInitialData.tipoTreino, reportedValue(patient?.tipoTreino)), group: 'rotina' },
    { label: 'Intensidade percebida', value: firstFilled(athleteInitialData.intensidade, reportedValue(patient?.intensidade)), group: 'rotina' },
    { label: 'Outras modalidades', value: firstFilled(athleteInitialData.outrasModalidades, formatListValue(patient?.outrasModalidades)), group: 'rotina' },
    { label: 'Fuma atualmente', value: athleteInitialData.fuma, group: 'rotina' },
    { label: 'Frequência de delivery', value: athleteInitialData.deliveryFrequencia, group: 'rotina' },
    { label: 'Dificuldade para dormir', value: athleteInitialData.dificuldadeDormir, group: 'rotina' },
    { label: 'Rotina manhã', value: athleteInitialData.rotinaManha, group: 'rotina' },
    { label: 'Rotina tarde', value: athleteInitialData.rotinaTarde, group: 'rotina' },
    { label: 'Rotina noite', value: athleteInitialData.rotinaNoite, group: 'rotina' },
    { label: 'Horário que dorme', value: athleteInitialData.horarioDormir, group: 'rotina' },
    { label: 'Horário que acorda', value: athleteInitialData.horarioAcordar, group: 'rotina' },
    { label: 'Avaliacoes solicitadas', value: formatListValue(athleteInitialData.avaliacaoSolicitada), group: 'triagem' },
    { label: 'Rastreio de disponibilidade energética', value: redsSummary, group: 'triagem' },
    { label: 'Rastreamento EBIA', value: ebiaSummary, group: 'triagem' },
    { label: 'Como conheceu a LAINES', value: athleteInitialData.comoSoube, group: 'triagem' },
    { label: 'Responsavel legal', value: [athleteInitialData.nomeResponsavel, athleteInitialData.cpfResponsavel ? `CPF: ${athleteInitialData.cpfResponsavel}` : ''].filter(Boolean).join(' | '), group: 'triagem' },
    { label: 'Observacoes da inscricao', value: athleteInitialData.observacoes, group: 'triagem' }
    ];
  }, [
    athleteConfirmation,
    patient?.cidade,
    patient?.dataNascimento,
    patient?.duracaoSessao,
    patient?.estado,
    patient?.frequenciaSemanal,
    patient?.genero,
    patient?.modalidadePrincipal,
    patient?.tempoPratica,
    patient?.tipoTreino,
    patient?.intensidade,
    patient?.outrasModalidades,
    patient?.nome,
    patient?.objetivo,
    patient?.sexoBiologico,
    patient?.telefone
  ]);

  const loadAvaliacoes = useCallback(async () => {
    const requestId = ++evaluationRequestRef.current;
    if (!patient?.id) {
      setAvaliacoes([]);
      setLoadingEvaluations(false);
      return;
    }
    setLoadingEvaluations(true);
    setEvaluationsError('');
    try {
      const allItems = [];
      let cursor = null;
      let pagesRead = 0;
      do {
        const { items, lastDoc } = await getAvaliacoesByPacientePaged(patient.id, cursor, pageSize);
        allItems.push(...(items || []));
        cursor = lastDoc;
        pagesRead += 1;
      } while (cursor !== null && pagesRead < 10);
      if (requestId !== evaluationRequestRef.current) return;
      setAvaliacoes(allItems);
      if (cursor !== null) setEvaluationsError('Histórico parcial: não foi possível carregar todas as avaliações.');
    } catch (error) {
      if (requestId !== evaluationRequestRef.current) return;
      console.error('Erro ao carregar avaliações:', error);
      const message = getApiErrorMessage(error, 'Não foi possível carregar as avaliações.');
      setAvaliacoes([]);
      setEvaluationsError(message);
      notify({
        type: 'error',
        title: 'Erro ao carregar avaliações',
        message
      });
    }
    finally {
      if (requestId === evaluationRequestRef.current) setLoadingEvaluations(false);
    }
  }, [getAvaliacoesByPacientePaged, notify, pageSize, patient?.id]);

  useEffect(() => {
    loadAvaliacoes();
    return () => { evaluationRequestRef.current += 1; };
  }, [loadAvaliacoes]);

  useEffect(() => {
    if (!patient?.id) return undefined;
    let active = true;
    const patientId = patient.id;
    setPlanState({ patientId, loading: true, items: [], error: '' });
    api.get('/planos-alimentares', { params: { pacienteId: patientId, status: 'ativo', limit: 100 } })
      .then(({ data }) => {
        if (!Array.isArray(data)) throw new Error('Resposta de planos inválida.');
        if (active) setPlanState({ patientId, loading: false, items: data, error: '' });
      })
      .catch((error) => {
        if (active) setPlanState({ patientId, loading: false, items: [], error: getApiErrorMessage(error, 'Não foi possível consultar a conduta vigente.') });
      });
    return () => { active = false; };
  }, [patient?.id]);

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
    if (isEditingSummary) return;
    const publicTriageData = getPublicTriageData(athleteConfirmation);
    const athleteInitialData = {
      ...publicTriageData,
      ...asPlainObject(athleteConfirmation?.dados)
    };
    const observacoes = firstFilled(
      patient?.observacoes,
      athleteInitialData?.observacoes,
      athleteInitialData?.queixaPrincipal,
      athleteInitialData?.motivoAtendimento,
      ''
    );
    const historicoSaude = firstFilled(
      patient?.historicoSaude,
      athleteInitialData?.historicoSaude,
      athleteInitialData?.historicoFamiliar,
      ''
    );
    const comorbidadesPessoais = normalizeStringArray(
      normalizeStringArray(patient?.comorbidadesPessoais).length
        ? patient?.comorbidadesPessoais
        : firstFilled(athleteInitialData?.comorbidadesPessoais, athleteInitialData?.patologias, [])
    );
    const comorbidadesFamiliares = normalizeStringArray(
      normalizeStringArray(patient?.comorbidadesFamiliares).length
        ? patient?.comorbidadesFamiliares
        : athleteInitialData?.comorbidadesFamiliares
    );
    setSummaryDraft({ observacoes, historicoSaude, comorbidadesPessoais, comorbidadesFamiliares });
    setSummarySaved({ observacoes, historicoSaude, comorbidadesPessoais, comorbidadesFamiliares });
  }, [
    athleteConfirmation,
    athleteConfirmation?.dados,
    isEditingSummary,
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
    setModuloEmbutido(null);
    setAvaliacaoEmbutidaId(null);
    setIsEditingSummary(false);
    setSummaryError('');
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
      const aDate = getEvaluationClinicalDate(a, convertFirebaseDate) || 0;
      const bDate = getEvaluationClinicalDate(b, convertFirebaseDate) || 0;
      return bDate - aDate;
    });
  }, [avaliacoes, convertFirebaseDate]);

  const pendingAthleteSubmissions = useMemo(() => (
    avaliacoesOrdenadas
      .filter((item) => (
        Boolean(item?.meta?.aguardandoRevisao)
        && (Boolean(item?.meta?.atletaSelfReport) || item?.meta?.origemPreenchimento === 'atleta')
      ))
      .map((item) => {
        const date = convertFirebaseDate(item.updatedAt || item.createdAt || item.data);
        return { ...item, _resolvedDate: date, _dateLabel: date ? formatDate(date) : null };
      })
  ), [avaliacoesOrdenadas, convertFirebaseDate, formatDate]);

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
  /**
   * Estado do prontuário, calculado uma vez.
   *
   * A faixa de indicadores dizia "16 pendências clínicas" contando módulos sem
   * avaliação finalizada, enquanto o painel de Pendências listava nove itens
   * vindos do backend. Dois números, dois significados, o mesmo rótulo.
   *
   * Aqui a faixa passa a medir o que ela sabe medir com exatidão — o estado
   * das avaliações — e deixa a palavra "pendência" para o painel que a define.
   */
  const estadoProntuario = useMemo(() => estadoDoProntuario({
    avaliacoes: avaliacoesOrdenadas,
    agendamentos: appointments,
    paciente: patient,
    // O autorrelato vive na confirmacao do atleta; o registro, no paciente.
    declarado: {
      ...getPublicTriageData(athleteConfirmation),
      ...asPlainObject(athleteConfirmation?.dados)
    }
  }), [avaliacoesOrdenadas, appointments, patient, athleteConfirmation]);

  /**
   * Pendências do backend, buscadas uma vez pelo container.
   *
   * O painel buscava por conta própria e o selo da aba contava outra coisa —
   * daí "Pendências 16" no selo e nove itens na lista. Uma requisição, um
   * número: o selo e o painel leem a mesma resposta.
   */
  const [pendenciasRemotas, setPendenciasRemotas] = useState(null);
  const [loadingPendencias, setLoadingPendencias] = useState(true);
  const [pendenciasError, setPendenciasError] = useState('');

  useEffect(() => {
    if (!patient?.id) { setPendenciasRemotas(null); return undefined; }
    let vivo = true;
    setLoadingPendencias(true);
    setPendenciasError('');
    api.get(`/avaliacoes/pendencias/${patient.id}`)
      .then((res) => { if (vivo) setPendenciasRemotas(Array.isArray(res.data) ? res.data : null); })
      .catch(() => { if (vivo) { setPendenciasRemotas(null); setPendenciasError('Não foi possível consultar as pendências do atendimento.'); } })
      .finally(() => { if (vivo) setLoadingPendencias(false); });
    return () => { vivo = false; };
  }, [patient?.id]);

  const planLoading = planState.patientId !== patient?.id || planState.loading;
  const overviewLoading = loadingEvaluations || loadingAppointments || loadingPendencias;
  const overviewError = evaluationsError || appointmentsError || pendenciasError;
  const snapshot = useMemo(() => buildClinicalSnapshot(avaliacoesOrdenadas, patient?.id), [avaliacoesOrdenadas, patient?.id]);
  const overview = useMemo(() => buildProntuarioOverview({
    avaliacoes: avaliacoesOrdenadas, agendamentos: appointments, modules: moduleConfig, patientId: patient?.id,
    planos: planState.items, planLoading, planError: planState.error,
    pendencias: pendenciasRemotas || [], loading: overviewLoading, error: overviewError,
    canCreateEvaluation, canCreateAppointment, canCreateMealPlan, canReview: canReviewAthleteSubmissions,
    editableTypes: editableEvaluationTypes, teamAreas: patientTeamAreas,
  }), [avaliacoesOrdenadas, appointments, moduleConfig, patient?.id, planState, planLoading, pendenciasRemotas,
    overviewLoading, overviewError, canCreateEvaluation, canCreateAppointment, canCreateMealPlan,
    canReviewAthleteSubmissions, editableEvaluationTypes, patientTeamAreas]);
  const decisionAlerts = useMemo(() => [
    ...(overviewError ? [{ id: 'dados-indisponiveis', text: overviewError }] : []),
    ...(planState.error ? [{ id: 'conduta-indisponivel', text: 'Conduta vigente indisponível. Consulte os detalhes antes de preparar um plano.' }] : []),
    ...(overview.tasks.some((item) => item.tipo === 'revisao') ? [{ id: 'revisao', text: 'Há envio aguardando revisão; ele ainda não compõe a síntese clínica.' }] : []),
    ...(estadoProntuario.divergencias.length ? [{ id: 'divergencias', text: 'Há divergências entre autorrelato e cadastro. Confira em Dados clínicos.' }] : []),
  ], [overviewError, planState.error, overview.tasks, estadoProntuario.divergencias.length]);

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
        // A data que importa clinicamente e a da medicao, nao a do registro.
        // Tres bioimpedancias de marco, maio e agosto apareciam todas com a data
        // em que foram digitadas — a leitura longitudinal sumia na propria lista.
        date: convertFirebaseDate(item.measuredAt || item.data || item.dataAvaliacao || item.createdAt),
        meta: {
          ...(item.meta || {}),
          tipo: item.tipo,
          avaliacaoId: item.id,
          moduleId: resolveEvaluationModuleId(item.tipo)
        },
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
      const professorName = message.supervisorNome || message.professorNome || 'Supervisão';
      const safeText = text || 'Mensagem sem conteúdo';
      return {
        id: `observacao-professor-${message.id || `${safeText.slice(0, 24)}-${index}`}`,
        type: 'observacao',
        title: 'Observação da supervisão',
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

  // Modulo aberto dentro do prontuario. Null = a aba mostra o historico.
  const [moduloEmbutido, setModuloEmbutido] = useState(null);
  const [sidebarActiveModule, setSidebarActiveModule] = useState(null);
  const [sidebarRequest, setSidebarRequest] = useState(null);
  const [imageOpenRequest, setImageOpenRequest] = useState(0);
  const sidebarRequestSequence = useRef(0);

  const requestSidebarAction = useCallback((action, moduleId = null) => {
    sidebarRequestSequence.current += 1;
    setSidebarRequest({ sequence: sidebarRequestSequence.current, action, moduleId });
  }, []);

  const handleTabChange = useCallback((nextTab) => {
    if (nextTab !== 'avaliacoes' && activeTab === 'avaliacoes' && moduloEmbutido) {
      requestSidebarAction('tab', nextTab);
      return;
    }
    setActiveTab(nextTab);
    if (nextTab === 'avaliacoes') setTimelineFilterType('avaliacao');
  }, [activeTab, moduloEmbutido, requestSidebarAction]);

  // 126px de nome, foto e etiquetas estao certos quando se chega e errados
  // quando se esta digitando. Sentinela observada em vez de listener de scroll:
  // funciona independente de qual container rola.
  const [cabecalhoCompacto, setCabecalhoCompacto] = useState(false);
  const sentinelaTopo = useRef(null);

  useEffect(() => {
    const alvo = sentinelaTopo.current;
    if (!alvo || typeof IntersectionObserver === 'undefined') return undefined;
    const obs = new IntersectionObserver(
      ([entrada]) => setCabecalhoCompacto(!entrada.isIntersecting),
      { threshold: 0 }
    );
    obs.observe(alvo);
    return () => obs.disconnect();
  }, []);
  const [avaliacaoEmbutidaId, setAvaliacaoEmbutidaId] = useState(null);

  const handleFecharModulo = useCallback(() => {
    setModuloEmbutido(null);
    setAvaliacaoEmbutidaId(null);
    setSidebarActiveModule(null);
    setSidebarRequest(null);
  }, []);

  const handleOpenAvaliacaoTab = useCallback((startTab = 'anamnese-inicial', avaliacaoId = null) => {
    if (!patient?.id) return;
    // Antes isto navegava para /avaliacao/:id e tirava a pessoa do prontuario.
    // O formulario agora abre na propria aba de Avaliacoes.
    const moduleId = resolveEvaluationModuleId(startTab);
    setModuloEmbutido(moduleId);
    setSidebarActiveModule(moduleId);
    setSidebarRequest(null);
    setAvaliacaoEmbutidaId(avaliacaoId || null);
    setActiveTab('avaliacoes');
  }, [patient?.id]);

  const handleNovaAvaliacao = useCallback(() => {
    const firstEditable = moduleConfig.find((item) => isPatientManager || editableEvaluationTypes.has(item.tipo));
    if (firstEditable) handleOpenAvaliacaoTab(firstEditable.id);
  }, [editableEvaluationTypes, handleOpenAvaliacaoTab, isPatientManager, moduleConfig]);

  const handleCreateMealPlan = useCallback(() => {
    if (!patient?.id) return;
    const returnTo = originPath || `${location.pathname}${location.search || ''}` || '/aluno';
    navigate(`/prescricao-plano/${patient.id}`, {
      state: {
        returnTo,
        returnView: originView || 'prontuario',
        returnTab: originTab || 'patients'
      }
    });
  }, [
    location.pathname,
    location.search,
    navigate,
    originPath,
    originTab,
    originView,
    patient?.id
  ]);

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
    handleTabChange('evolucao');
    window.requestAnimationFrame(() => {
      scrollToSection(consultationHistoryRef);
    });
  }, [handleTabChange, scrollToSection]);

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
    if (!patient?.id || isReleasingEbia || !canManageAthleteForms) return;
    if (!athleteRegistrationCompleted) {
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

    const willEnable = !ebiaSelfFormEnabled;
    setIsReleasingEbia(true);
    try {
      await updatePaciente(patient.id, {
        confirmacaoAtleta: {
          ebiaSelfForm: {
            ...ebiaSelfFormRelease,
            enabled: willEnable,
            ...(willEnable
              ? {
                releaseId: ebiaSelfFormEnabled
                  ? ebiaSelfFormRelease?.releaseId || generateReleaseId()
                  : generateReleaseId(),
                releasedAt: new Date().toISOString(),
                releasedById: user?.uid || user?.id || '',
                releasedByName: user?.name || user?.email || '',
                disabledAt: null,
                consumedAt: null,
                consumedByAvaliacaoId: null
              }
              : {
                disabledAt: new Date().toISOString(),
                disabledById: user?.uid || user?.id || '',
                disabledByName: user?.name || user?.email || ''
              })
          }
        }
      });
      notify({
        type: 'success',
        title: willEnable ? 'EBIA liberado' : 'EBIA suspenso',
        message: willEnable
          ? 'O atleta ja pode preencher o formulario EBIA no portal.'
          : 'O formulario EBIA foi removido do portal do atleta.'
      });
    } catch (error) {
      notify({
        type: 'error',
        title: 'Erro ao alterar EBIA',
        message: getApiErrorMessage(error, 'Não foi possível atualizar o acesso ao formulário EBIA.')
      });
    } finally {
      setIsReleasingEbia(false);
    }
  }, [
    athleteRegistrationCompleted,
    canManageAthleteForms,
    ebiaSelfFormEnabled,
    ebiaSelfFormRelease,
    isReleasingEbia,
    notify,
    patient?.id,
    updatePaciente,
    user?.email,
    user?.id,
    user?.name,
    user?.uid
  ]);

  const handleToggleAthleteFormAccess = useCallback(async (type) => {
    if (!patient?.id || !canManageAthleteForms || togglingAthleteFormType) return;
    const currentRelease = athleteFormReleases[type] || {};
    const willEnable = !currentRelease.enabled;
    const nextRelease = {
      ...currentRelease,
      enabled: willEnable,
      ...(willEnable
        ? {
          releasedAt: new Date().toISOString(),
          releasedById: user?.uid || user?.id || '',
          releasedByName: user?.name || user?.email || '',
          disabledAt: null
        }
        : {
          disabledAt: new Date().toISOString(),
          enabled: false
        })
    };
    const nextFormReleases = {
      ...athleteFormReleases,
      [type]: nextRelease
    };
    setTogglingAthleteFormType(type);
    try {
      const updatedPatient = await updatePaciente(patient.id, {
        confirmacaoAtleta: {
          formulariosLiberados: nextFormReleases
        }
      });
      setAthleteFormReleasesOverride(
        updatedPatient?.confirmacaoAtleta?.formulariosLiberados || nextFormReleases
      );
      notify({
        type: 'success',
        title: willEnable ? 'Formulário liberado' : 'Acesso suspenso',
        message: willEnable
          ? athleteRegistrationCompleted
            ? 'O atleta pode preencher este formulário no portal.'
            : 'O formulário ficará disponível quando o atleta concluir o cadastro inicial.'
          : 'O formulário foi removido do portal do atleta.'
      });
    } catch (error) {
      notify({ type: 'error', title: 'Erro ao alterar acesso', message: getApiErrorMessage(error, 'Não foi possível atualizar o acesso ao formulário.') });
    } finally {
      setTogglingAthleteFormType(null);
    }
  }, [athleteFormReleases, athleteRegistrationCompleted, canManageAthleteForms, notify, patient?.id, togglingAthleteFormType, updatePaciente, user?.email, user?.id, user?.name, user?.uid]);


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

  const handleMarkAsReviewed = useCallback(async (avaliacaoId) => {
    if (!avaliacaoId || isMarkingReviewedId || !canReviewAthleteSubmissions) return;
    setIsMarkingReviewedId(avaliacaoId);
    try {
      const { data: reviewedEvaluation } = await api.patch(`/avaliacoes/${avaliacaoId}/revisar`);
      notify({ type: 'success', title: 'Revisão registrada', message: 'O envio foi marcado como revisado.' });
      setAvaliacoes((prev) => prev.map((a) =>
        a.id === avaliacaoId
          ? (reviewedEvaluation || { ...a, status: 'finalizada', meta: { ...(a.meta || {}), aguardandoRevisao: false } })
          : a
      ));
    } catch (error) {
      notify({ type: 'error', title: 'Erro ao revisar', message: getApiErrorMessage(error, 'Não foi possível registrar a revisão.') });
    } finally {
      setIsMarkingReviewedId(null);
    }
  }, [
    canReviewAthleteSubmissions, isMarkingReviewedId, notify
  ]);

  // UPD-17: aluno responsavel/equipe (ou gestao) pede revisao de uma
  // avaliacao preenchida no atendimento — envio opcional, nao substitui quem
  // finaliza direto. O servidor e quem decide vinculo e idempotencia; aqui so
  // repassamos o resultado para a lista local, sem duplicar a regra.
  const handleSendForReview = useCallback(async (avaliacaoId) => {
    if (!avaliacaoId || isSendingReviewRequest) return;
    setIsSendingReviewRequest(true);
    try {
      const enviada = await enviarAvaliacaoParaRevisao(avaliacaoId, reviewRequestNote);
      notify({ type: 'success', title: 'Enviado para revisão', message: 'O supervisor foi avisado e vai revisar em breve.' });
      setAvaliacoes((prev) => prev.map((a) => (a.id === avaliacaoId ? (enviada || a) : a)));
      setActiveReviewRequestId(null);
      setReviewRequestNote('');
    } catch (error) {
      notify({ type: 'error', title: 'Erro ao enviar', message: getApiErrorMessage(error, 'Não foi possível enviar para revisão.') });
    } finally {
      setIsSendingReviewRequest(false);
    }
  }, [isSendingReviewRequest, notify, reviewRequestNote]);

  // Consultas nao tem aba propria: a consulta e o eixo do tempo da evolucao, e
  // separa-las obrigava a cruzar duas telas para ler a mesma historia.
  const prontuarioTabs = useMemo(() => ([
    { id: 'visao-geral', label: 'Visão geral', enabled: true },
    { id: 'dados-clinicos', label: 'Dados clínicos', enabled: true },
    { id: 'avaliacoes', label: 'Avaliações', enabled: true, count: avaliacoesOrdenadas.length },
    { id: 'evolucao', label: 'Evoluções', enabled: true, count: consultationHistory.length },
    { id: 'anexos', label: 'Anexos', enabled: true, count: attachments.length },
    { id: 'pendencias', label: 'Pendências', enabled: true, count: overviewLoading || overviewError ? undefined : overview.tasks.length }
  ]), [
    avaliacoesOrdenadas.length,
    attachments.length,
    consultationHistory.length,
    overviewLoading,
    overviewError,
    overview.tasks.length
  ]);

  const headerSubtitle = [patient?.modalidadePrincipal || patient?.modalidade, patientAge ? patientAge + ' anos' : null].filter(Boolean).join(' · ');

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
    if (!patient?.id || !canWriteSupervisorMessage) return;
    const text = professorMessage.trim();
    if (!text) {
      setProfessorMessageError('Informe uma nota para a equipe.');
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
    if (!patient?.id || !podeEnviarAnexo) return;
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
    if (!patient?.id || !attachment || !podeRemoverAnexo) return;
    const currentId = String(attachment.id || attachment.path || attachment.url || '');
    const accepted = await confirm({
      title: 'Remover anexo',
      message: 'O anexo será removido do prontuário. Deseja continuar?',
      confirmLabel: 'Remover',
      cancelLabel: 'Cancelar',
      variant: 'danger'
    });
    if (!accepted) return;
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

  const handleSidebarBack = useCallback(() => {
    if (activeTab === 'avaliacoes' && moduloEmbutido) requestSidebarAction('back');
    else onBack?.();
  }, [activeTab, moduloEmbutido, onBack, requestSidebarAction]);

  const handleSidebarPanel = useCallback(() => {
    if (activeTab === 'avaliacoes' && moduloEmbutido) requestSidebarAction('panel');
    else {
      handleFecharModulo();
      handleTabChange('avaliacoes');
    }
  }, [activeTab, handleFecharModulo, handleTabChange, moduloEmbutido, requestSidebarAction]);

  const handleOpenImagePanel = useCallback(() => {
    handleFecharModulo();
    handleTabChange('avaliacoes');
    setImageOpenRequest((request) => request + 1);
  }, [handleFecharModulo, handleTabChange]);

  const handleLeaveModuleForTab = useCallback((nextTab) => {
    handleFecharModulo();
    setActiveTab(nextTab);
    if (nextTab === 'evolucao') {
      window.requestAnimationFrame(() => scrollToSection(consultationHistoryRef));
    }
  }, [handleFecharModulo, scrollToSection]);

  const handleSidebarModule = useCallback((moduleId) => {
    const module = moduleConfig.find((item) => item.id === moduleId);
    if (!module) return;
    if (module.tipo === 'composicao_corporal_imagem') {
      if (activeTab === 'avaliacoes' && moduloEmbutido) requestSidebarAction('image');
      else handleOpenImagePanel();
      return;
    }
    if (activeTab === 'avaliacoes' && moduloEmbutido) requestSidebarAction('module', moduleId);
    else handleOpenAvaliacaoTab(moduleId);
    window.requestAnimationFrame(() => {
      document.querySelector('.pron-avaliacao-embutida')?.scrollIntoView({ block: 'start' });
    });
  }, [activeTab, handleOpenAvaliacaoTab, handleOpenImagePanel, moduleConfig, moduloEmbutido, requestSidebarAction]);

  return (
    <>
      <div className={`prontuario-root pron-page admin-container${cabecalhoCompacto ? ' is-cabecalho-compacto' : ''}`}>
        <ProntuarioAssessmentSidebar
          modules={moduleConfig}
          activeKey={activeTab === 'avaliacoes'
            ? (moduloEmbutido ? (sidebarActiveModule ? `assessment:${sidebarActiveModule}` : '') : 'panel')
            : ''}
          user={user}
          patientName={patient?.nome}
          portal={originPath === '/aluno' ? 'aluno' : originPath === '/professor' ? 'professor' : 'admin'}
          onBack={handleSidebarBack}
          onOpenPanel={handleSidebarPanel}
          onOpenModule={handleSidebarModule}
        />
        <main className="pron-shell">
        <div ref={sentinelaTopo} aria-hidden="true" style={{ height: 1 }} />

        <ProntuarioHeader
          onBack={handleSidebarBack}
          patientName={patient?.nome}
          patientInitials={patientInitials}
          prontuarioNumber={patient?.prontuario}
          isActive={isPatientActive}
          statusLabel={patientStatusLabel}
          athleteLoginEmail={athleteLoginEmail}
          hasAthleteAccount={hasAthleteAccount}
          projectName={projectLink?.nome}
          subtitle={headerSubtitle}
          profileIncomplete={!athleteRegistrationCompleted}
          canLinkProject={canLinkProject}
          careState={overview.state}
          primaryAction={overview.action}
          decisionAlerts={decisionAlerts}
          onPrimaryAction={() => {
            const action = overview.action;
            if (action?.kind === 'evaluation') handleOpenAvaliacaoTab(action.type, action.id);
            else if (action?.kind === 'review') handleTabChange('dados-clinicos');
            else if (action?.kind === 'plan') handleCreateMealPlan();
            else if (action?.kind === 'appointment') setIsAppointmentOpen(true);
            else if (action?.kind === 'history') handleOpenHistory();
            else if (action?.kind === 'tab') handleTabChange(action.tab);
          }}
          alunoResponsavelNome={patient?.alunoResponsavelNome || patient?.alunoResponsavel?.name || ''}
          professorSupervisorNome={patient?.professorSupervisorNome || patient?.professorSupervisor?.name || ''}
          consentimento={consentimentoResumo}
          onOpenProject={handleOpenProjectModal}
          onOpenHistory={handleOpenHistory}
        />

        {/* REMOVIDO — abas sem conteúdo funcional e seções vazias com placeholder --- — 2026-03-31 */}
        <ProntuarioTabs
          tabs={prontuarioTabs}
          activeTab={activeTab}
          onChange={handleTabChange}
        />

        <div className={`pron-main-grid${moduloEmbutido ? ' is-modulo-aberto' : ''}${activeTab === 'visao-geral' ? ' is-overview' : ''}`}>
          <div className="pron-stack" id="pron-aba-conteudo" role="tabpanel" aria-labelledby={`pron-aba-${activeTab}`}>
            {activeTab === 'visao-geral' && (
              <VisaoGeral
                snapshot={snapshot}
                overview={overview}
                avaliacoes={avaliacoesOrdenadas.filter((item) => String(item.pacienteId) === String(patient?.id))}
                formatDate={formatDate}
                summaryNote={summarySaved.observacoes}
                loading={loadingEvaluations}
                error={evaluationsError}
                planLoading={planLoading}
                planError={planState.error}
                editableTypes={canCreateEvaluation ? editableEvaluationTypes : new Set()}
                onOpenEvaluationType={handleOpenAvaliacaoTab}
                onOpenTab={handleTabChange}
                onOpenAppointment={() => setIsAppointmentOpen(true)}
              />
            )}

            {activeTab === 'dados-clinicos' && (
              <>
                <PainelDivergencias divergencias={estadoProntuario.divergencias} />
                {canReviewAthleteSubmissions && (
                  <PainelRevisaoAtleta
                    pendingSubmissions={pendingAthleteSubmissions}
                    isMarkingReviewedId={isMarkingReviewedId}
                    formatDate={formatDate}
                    onMarkAsReviewed={handleMarkAsReviewed}
                  />
                )}
                <ResumoClinico
                dadosGeraisFields={dadosGeraisFields}
                formatGeneralValue={formatGeneralValue}
                formatGeneralDate={formatGeneralDate}
                athleteHasAccount={hasAthleteAccount}
                athleteRegistrationCompleted={athleteRegistrationCompleted}
                ebiaSelfFormEnabled={ebiaSelfFormEnabled}
                ebiaSelfFormReleasedAt={ebiaSelfFormReleasedAt}
                ebiaSelfFormConsumedAt={ebiaSelfFormConsumedAt}
                formatDate={formatDate}
                podeEditarAvaliacoes={canManageAthleteForms}
                handleReleaseEbiaToAthlete={handleReleaseEbiaToAthlete}
                isReleasingEbia={isReleasingEbia}
                athleteSelfEvaluationConfigs={ATHLETE_SELF_EVALUATION_CONFIGS}
                athleteFormReleases={athleteFormReleases}
                handleToggleAthleteFormAccess={handleToggleAthleteFormAccess}
                togglingAthleteFormType={togglingAthleteFormType}
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
              </>
            )}

            {activeTab === 'evolucao' && (
              <div className="pron-evolucao-stack">
                <EvolucaoAnalytics avaliacoes={avaliacoesOrdenadas} />
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
              </div>
            )}

            {activeTab === 'avaliacoes' && moduloEmbutido && (
              <section className="pron-avaliacao-embutida" aria-label="Formulário de avaliação">
                <React.Suspense fallback={<div className="pron-avaliacao-embutida__carregando" role="status">Carregando módulo…</div>}>
                  <AvaliacaoCompleta
                    key={`${moduloEmbutido}-${avaliacaoEmbutidaId || 'novo'}`}
                    pacienteId={patient?.id}
                    embutido
                    moduloInicial={moduloEmbutido}
                    avaliacaoInicialId={avaliacaoEmbutidaId}
                    aoSair={handleFecharModulo}
                    aoVoltar={onBack}
                    aoAbrirImagem={handleOpenImagePanel}
                    aoAbrirTab={handleLeaveModuleForTab}
                    navigationRequest={sidebarRequest}
                    onActiveModuleChange={setSidebarActiveModule}
                  />
                </React.Suspense>
              </section>
            )}

            {/* Fechar um modulo caia direto no historico — o que ja foi feito —
                sem nenhuma porta para os modulos disponiveis. O painel abaixo
                ja existia no projeto e nunca chegou a ser renderizado. */}
            {activeTab === 'avaliacoes' && !moduloEmbutido && (
              <DashboardAvaliacoes
                patient={patient}
                avaliacoes={avaliacoesOrdenadas}
                editableTypes={editableEvaluationTypes}
                canCreateEvaluation={canCreateEvaluation}
                canManagePatient={isPatientManager}
                consultationStatusSummary={consultationStatusSummary}
                nextAppointment={nextAppointment}
                formatDate={formatDate}
                onOpenEvaluationType={handleOpenAvaliacaoTab}
                onCreateEvaluation={handleNovaAvaliacao}
                openImageRequest={imageOpenRequest}
                onImageClose={() => setImageOpenRequest(0)}
              />
            )}

            {activeTab === 'avaliacoes' && !moduloEmbutido && (
              <section className="pron-card pron-panel">
                <header className="pron-panel-header">
                  <div>
                    <h2>Histórico de avaliações</h2>
                    <p>{filteredTimelineEvents.length === 1 ? '1 evento' : `${filteredTimelineEvents.length} eventos`} de avaliação no prontuário.</p>
                  </div>
                  <div className="pron-inline-actions">
                    {/* O plano segue `canCreateMealPlan`, nao `podeEditarAvaliacoes`:
                        quem edita avaliacao nao necessariamente pode prescrever. */}
                    {canCreateMealPlan && (
                      <button type="button" className="pron-btn" onClick={handleCreateMealPlan}>
                        Plano alimentar
                      </button>
                    )}
                    {podeEditarAvaliacoes && (
                      <button type="button" className="pron-btn pron-btn-primary" onClick={handleNovaAvaliacao}>
                        Nova avaliação
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
                  <FeedbackState
                    empty
                    size="sm"
                    title="Nenhuma avaliação encontrada com os filtros aplicados."
                    action="Limpar filtros"
                    onAction={() => {
                      setTimelineFilterType('avaliacao');
                      setTimelineFilterStatus('all');
                      setTimelineSearch('');
                    }}
                  />
                ) : (
                  <ol className="timeline">
                    {visibleTimeline.map((event) => (
                      <li key={event.id} className="timeline-item">
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
                        {/* UPD-17: o aluno ve a devolucao (quem, quando, o que foi pedido)
                            e o envio para revisao no mesmo lugar onde ve o historico —
                            "aguardando revisao" nunca convive com o botao de enviar de novo. */}
                        {event.type === 'avaliacao' && (
                          <div className="pron-stack-xs">
                            {event.meta?.devolucao ? (
                              <p className="pron-text-secondary">
                                Devolvida por {event.meta.devolucao.porNome || 'supervisão'} em {formatDate(event.meta.devolucao.em)}: "{event.meta.devolucao.observacao}"
                              </p>
                            ) : null}
                            {event.meta?.aguardandoRevisao ? (
                              <span className="pron-badge pron-badge--warn">
                                Aguardando revisão{event.meta?.submittedAt ? ` desde ${formatDate(event.meta.submittedAt)}` : ''}
                              </span>
                            ) : podeEnviarParaRevisao ? (
                              activeReviewRequestId === event.meta?.avaliacaoId ? (
                                <div className="pron-stack-xs">
                                  <textarea
                                    className="pron-textarea"
                                    rows="2"
                                    maxLength={1000}
                                    value={reviewRequestNote}
                                    onChange={(inputEvent) => setReviewRequestNote(inputEvent.target.value)}
                                    placeholder="O que você quer perguntar ao supervisor? (opcional — o aluno vai ler esta pergunta)"
                                    disabled={isSendingReviewRequest}
                                  />
                                  <div className="pron-inline-actions">
                                    <button
                                      type="button"
                                      className="pron-btn pron-btn-primary pron-btn-sm"
                                      disabled={isSendingReviewRequest}
                                      onClick={() => handleSendForReview(event.meta.avaliacaoId)}
                                    >
                                      {isSendingReviewRequest ? 'Enviando...' : 'Confirmar envio'}
                                    </button>
                                    <button
                                      type="button"
                                      className="pron-btn pron-btn-secondary pron-btn-sm"
                                      disabled={isSendingReviewRequest}
                                      onClick={() => { setActiveReviewRequestId(null); setReviewRequestNote(''); }}
                                    >
                                      Cancelar
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  className="pron-link-btn"
                                  onClick={() => { setActiveReviewRequestId(event.meta.avaliacaoId); setReviewRequestNote(''); }}
                                  aria-label={`Enviar para revisão: ${event.title}`}
                                >
                                  Enviar para revisão
                                </button>
                              )
                            ) : null}
                          </div>
                        )}
                        <button
                          type="button"
                          className="pron-link-btn"
                          onClick={() => handleOpenAvaliacaoTab(event.meta?.moduleId || event.meta?.tipo, event.meta?.avaliacaoId)}
                          aria-label={`Ver detalhes: ${event.title}`}
                        >
                          Ver detalhes
                        </button>
                      </li>
                    ))}
                  </ol>
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
                pendenciasExternas={overview.tasks}
                loading={overviewLoading}
                error={overviewError}
                applicabilityNote={overview.applicabilityNote}
                onReview={() => setActiveTab('dados-clinicos')}
                onOpenEvaluationType={handleOpenAvaliacaoTab}
                onOpenAppointment={() => setIsAppointmentOpen(true)}
              />
            )}
          </div>

          <aside className="pron-side-column">
            {activeTab === 'visao-geral' ? (
              <details className="pron-card pron-panel vg-supervision-notes">
                <summary>Notas da supervisão ({professorMessages.length})</summary>
                <PainelMensagens
                  canWriteMessage={canWriteSupervisorMessage}
                  professorMessages={professorMessages}
                  professorMessage={professorMessage}
                  professorMessageError={professorMessageError}
                  isSavingProfessorMessage={isSavingProfessorMessage}
                  formatDate={formatDate}
                  onChangeMessage={setProfessorMessage}
                  onSaveMessage={handleSaveProfessorMessage}
                />
              </details>
            ) : (
            <PainelMensagens
              canWriteMessage={canWriteSupervisorMessage}
              professorMessages={professorMessages}
              professorMessage={professorMessage}
              professorMessageError={professorMessageError}
              isSavingProfessorMessage={isSavingProfessorMessage}
              formatDate={formatDate}
              onChangeMessage={setProfessorMessage}
              onSaveMessage={handleSaveProfessorMessage}
            />
            )}
          </aside>
        </div>
        </main>
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
                <X size={15} aria-hidden="true" />
              </button>
            </div>
            <div className="project-link-modal__body app-modal-body">
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
                      <Loader2 size={14} className="spin" aria-hidden="true" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <FolderKanban size={14} aria-hidden="true" />
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
        evaluationOptions={appointmentEvaluationOptions}
        onSuccess={() => loadAppointments({ preserveCurrent: true })}
      />
    </>
  );
};

// REMOVIDO — cálculo inline de resumo da timeline movido para evaluationResultAdapter — 2026-03-31
export default PatientProntuario;
