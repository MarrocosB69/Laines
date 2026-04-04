import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePacientes } from '../contexts/PacienteContext';
import { useUiFeedback } from '../contexts/UiFeedbackContext';
import { getApiErrorMessage } from '../services/api';

import BioimpedanciaForm from '../components/Avaliacoes/Antropometria/BioimpedanciaForm';
import DobrasCutaneasForm from '../components/Avaliacoes/Antropometria/DobrasCutaneasForm';
import PerimetrosCorporaisForm from '../components/Avaliacoes/Antropometria/PerimetrosCorporaisForm';
import ComposicaoCorporalIntegradaForm from '../components/Avaliacoes/Antropometria/ComposicaoCorporalIntegradaForm';
import GastoEnergeticoTotalForm from '../components/Avaliacoes/Antropometria/GastoEnergeticoTotalForm';
import AvaliacaoAlimentarNOVA from '../components/Avaliacoes/avaliacao-alimentar/AvaliacaoAlimentarNOVA';
import AvaliacaoHidratacao from '../components/Avaliacoes/avaliacao-hidratacao/AvaliacaoHidratacao';
import AvaliacaoSocioeconomica from '../components/Avaliacoes/avaliacao-socioeconomica/AvaliacaoSocioeconomica';
import AvaliacaoFisioterapia from '../components/Avaliacoes/avaliacao-fisioterapia/AvaliacaoFisioterapia';
import AvaliacaoPsicologia from '../components/Avaliacoes/avaliacao-psicologia/AvaliacaoPsicologia';
import AvaliacaoExamesLaboratoriais from '../components/Avaliacoes/avaliacao-exames-laboratoriais/AvaliacaoExamesLaboratoriais';
import AvaliacaoEvolucaoRetorno from '../components/Avaliacoes/avaliacao-evolucao-retorno/AvaliacaoEvolucaoRetorno';
import AnamneseInicialForm from '../components/Avaliacoes/anamnese/AnamneseInicialForm';
import AvaliacaoClinicaForm from '../components/Avaliacoes/clinica/AvaliacaoClinicaForm';
import EvaluationSummaryStrip from '../components/shared/EvaluationSummaryStrip';
import {
  getEvaluationStatusLabel,
  getEvaluationTypeLabel
} from '../components/shared/evaluationSummaryUtils';
import {
  listEvaluationRegistryByContext
} from '../constants/evaluationRegistry';
import { isStudentMemberRole, normalizeRole } from '../constants/roles';
import {
  buildClinicalReportModel,
  buildClinicalReportHtml,
  buildReportFilename,
  downloadTextFile
} from '../services/clinicalReportService';

import {
  ArrowLeft,
  FileText,
  Download,
  Scale,
  Layers,
  Flame,
  Activity,
  Apple,
  Droplets,
  Heart,
  ShieldCheck,
  Clock,
  CheckCircle2,
  CircleDashed,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  Printer
} from 'lucide-react';

import './AvaliacaoCompleta.css';

const MODULE_ICON_MAP = {
  bioimpedancia: Scale,
  dobras_cutaneas: Activity,
  perimetros: Scale,
  composicao_corporal_integrada: Layers,
  gasto_energetico_total: Flame,
  anamnese_inicial: ClipboardList,
  avaliacao_clinica: Heart,
  alimentar: Apple,
  hidratacao: Droplets,
  avaliacao_socioeconomica: FileText,
  fisioterapia: Activity,
  psicologia: Heart,
  exames_laboratoriais: FileText,
  evolucao_retorno: Clock
};

const MODULE_CONFIG = listEvaluationRegistryByContext('avaliacaoCompleta').map((item) => ({
  id: item.moduleId || item.type,
  tipo: item.type,
  label: item.label,
  icon: MODULE_ICON_MAP[item.type] || FileText,
  group: item.groupLabel,
  description: item.description
}));

const getCurrentDate = () => new Date().toISOString();

const AvaliacaoCompleta = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    salvarAvaliacao,
    updateAvaliacao,
    getPacienteById,
    getAvaliacoesByPaciente,
    convertFirebaseDate,
    formatDate
  } = usePacientes();
  const { user } = useAuth();
  const { notify } = useUiFeedback();

  const [activeTab, setActiveTab] = useState(() => location.state?.startTab || 'bioimpedancia');
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [patient, setPatient] = useState(null);
  const [draftIds, setDraftIds] = useState({});
  const [moduleSnapshots, setModuleSnapshots] = useState({});
  const [evaluationHistory, setEvaluationHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [autoSaveError, setAutoSaveError] = useState('');
  const [isFinalizingModule, setIsFinalizingModule] = useState(false);
  const [historyFilterType, setHistoryFilterType] = useState('all');
  const [historyFilterStatus, setHistoryFilterStatus] = useState('all');
  const [historySearch, setHistorySearch] = useState('');
  const [sharedAnthropometryDraft, setSharedAnthropometryDraft] = useState({
    pesoKg: '',
    estaturaCm: '',
    idade: '',
    sexo: ''
  });
  const [sharedAnthropometryTouched, setSharedAnthropometryTouched] = useState(false);

  const normalizeType = useCallback(
    (value) => String(value || '').trim().toLowerCase().replace(/-/g, '_'),
    []
  );

  const getRecordDate = useCallback(
    (record) => convertFirebaseDate(record?.updatedAt || record?.createdAt || record?.data),
    [convertFirebaseDate]
  );

  const returnToPath = location.state?.returnTo || '/aluno';
  const returnState = useMemo(() => ({
    selectedPatientId: id,
    returnView: String(location.state?.returnView || 'dashboard'),
    returnTab: String(location.state?.returnTab || 'patients')
  }), [id, location.state?.returnTab, location.state?.returnView]);

  const loadEvaluationContext = useCallback(async () => {
    if (!id) return;
    setLoadingHistory(true);
    setHistoryError('');
    try {
      const rows = await getAvaliacoesByPaciente(id);
      const sorted = [...(Array.isArray(rows) ? rows : [])].sort((a, b) => {
        const aDate = getRecordDate(a) || 0;
        const bDate = getRecordDate(b) || 0;
        return bDate - aDate;
      });

      const grouped = {};
      const nextDraftIds = {};

      sorted.forEach((item) => {
        const typeKey = normalizeType(item.tipo);
        if (!typeKey) return;
        if (!grouped[typeKey]) grouped[typeKey] = item;
        if (item.status !== 'finalizada' && item.id && !nextDraftIds[typeKey]) {
          nextDraftIds[typeKey] = item.id;
        }
      });

      setModuleSnapshots(grouped);
      setDraftIds(nextDraftIds);
      setEvaluationHistory(sorted);
    } catch (error) {
      setHistoryError(getApiErrorMessage(error, 'Não foi possível carregar o histórico da avaliação.'));
    } finally {
      setLoadingHistory(false);
    }
  }, [getAvaliacoesByPaciente, getRecordDate, id, normalizeType]);

  useEffect(() => {
    let isMounted = true;
    if (!id) return () => {};
    getPacienteById(id).then((data) => {
      if (isMounted) setPatient(data || null);
    });
    return () => {
      isMounted = false;
    };
  }, [id, getPacienteById]);

  useEffect(() => {
    loadEvaluationContext();
  }, [loadEvaluationContext]);

  useEffect(() => {
    if (MODULE_CONFIG.some((item) => item.id === activeTab)) return;
    setActiveTab(MODULE_CONFIG[0].id);
  }, [activeTab]);

  const moduleStates = useMemo(() => {
    return MODULE_CONFIG.map((tab) => {
      const snapshot = moduleSnapshots[normalizeType(tab.tipo)] || null;
      const rawStatus = String(snapshot?.status || '').toLowerCase();
      const status = rawStatus === 'finalizada' ? 'finalizada' : snapshot ? 'rascunho' : 'pendente';
      const completion = typeof snapshot?.meta?.completude === 'number'
        ? snapshot.meta.completude
        : status === 'finalizada'
          ? 100
          : status === 'rascunho'
            ? 55
            : 0;
      return {
        ...tab,
        snapshot,
        status,
        completion,
        updatedAt: getRecordDate(snapshot)
      };
    });
  }, [getRecordDate, moduleSnapshots, normalizeType]);

  const progress = useMemo(() => {
    const total = moduleStates.length || 1;
    const finalized = moduleStates.filter((item) => item.status === 'finalizada').length;
    const inProgress = moduleStates.filter((item) => item.status === 'rascunho').length;
    const completion = Math.round(
      moduleStates.reduce((sum, item) => sum + item.completion, 0) / total
    );
    const overallStatus = finalized === total ? 'finalizada' : (finalized > 0 || inProgress > 0 ? 'em_analise' : 'pendente');

    return {
      total,
      finalized,
      inProgress,
      pending: total - finalized - inProgress,
      completion,
      overallStatus
    };
  }, [moduleStates]);

  const groupedModules = useMemo(() => {
    const grouped = moduleStates.reduce((acc, item) => {
      if (!acc[item.group]) acc[item.group] = [];
      acc[item.group].push(item);
      return acc;
    }, {});
    return Object.entries(grouped).map(([group, items]) => ({ group, items }));
  }, [moduleStates]);

  const activeModule = useMemo(
    () => moduleStates.find((item) => item.id === activeTab) || moduleStates[0],
    [activeTab, moduleStates]
  );

  const sortedHistory = useMemo(() => {
    return [...evaluationHistory].sort((a, b) => {
      const aDate = getRecordDate(a) || 0;
      const bDate = getRecordDate(b) || 0;
      return bDate - aDate;
    });
  }, [evaluationHistory, getRecordDate]);

  const currentSessionId = useMemo(() => {
    const draftRows = sortedHistory.filter((item) => {
      const status = String(item?.status || '').toLowerCase();
      return Boolean(item?.sessaoId) && status !== 'finalizada';
    });
    if (!draftRows.length) return '';
    const sorted = [...draftRows].sort((a, b) => {
      const aDate = getRecordDate(a) || 0;
      const bDate = getRecordDate(b) || 0;
      return bDate - aDate;
    });
    return sorted[0]?.sessaoId || '';
  }, [getRecordDate, sortedHistory]);

  const normalizedUserRole = useMemo(() => normalizeRole(user?.role), [user?.role]);
  const currentUserId = user?.uid || user?.id || '';
  const isPatientResponsible = useMemo(
    () => Boolean(
      currentUserId
      && (patient?.alunoResponsavelId === currentUserId || patient?.alunoResponsavel?.id === currentUserId)
    ),
    [currentUserId, patient?.alunoResponsavel?.id, patient?.alunoResponsavelId]
  );
  const isPatientTeamMember = useMemo(
    () => Boolean(
      currentUserId
      && Array.isArray(patient?.equipeTecnicaIds)
      && patient.equipeTecnicaIds.includes(currentUserId)
    ),
    [currentUserId, patient?.equipeTecnicaIds]
  );
  const canManagePatientFlow = useMemo(
    () => isStudentMemberRole(normalizedUserRole) && (isPatientResponsible || isPatientTeamMember),
    [isPatientResponsible, isPatientTeamMember, normalizedUserRole]
  );

  const activeModuleStatus = activeModule?.status || 'pendente';
  const podeEditar = canManagePatientFlow && activeModuleStatus !== 'finalizada';
  const somenteLeitura = !canManagePatientFlow || activeModuleStatus === 'finalizada';

  const anthropometryBaseline = useMemo(() => {
    const latestFromEvaluations = (keys = []) => {
      for (const evaluation of sortedHistory) {
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
    const ageFromPatient = calculateAge(patient?.dataNascimento);
    const sexFromEval = normalizeSexLabel(latestFromEvaluations(['sexo', 'genero', 'sex']));
    const sexFromPatient = normalizeSexLabel(patient?.sexo || patient?.genero);

    return {
      pesoKg: weightFromEval ?? weightFromPatient,
      estaturaCm: heightFromEval ?? heightFromPatient,
      idade: ageFromEval ?? ageFromPatient,
      sexo: sexFromEval || sexFromPatient || ''
    };
  }, [
    patient?.altura,
    patient?.dataNascimento,
    patient?.estatura,
    patient?.genero,
    patient?.height,
    patient?.peso,
    patient?.sexo,
    patient?.weight,
    sortedHistory
  ]);

  const normalizeAnthropometryDraft = useCallback(
    (source) => createAnthropometryDraft(source),
    []
  );

  useEffect(() => {
    setSharedAnthropometryTouched(false);
  }, [id]);

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

  const attachSharedAnthropometryToPayload = useCallback((avaliacao) => ({
    ...avaliacao,
    dados: {
      ...buildSharedAnthropometryData(sharedAnthropometryBaseline),
      ...(avaliacao?.dados && typeof avaliacao.dados === 'object' ? avaliacao.dados : {})
    }
  }), [sharedAnthropometryBaseline]);

  const overallLastUpdatedAt = useMemo(() => {
    return sortedHistory.length ? getRecordDate(sortedHistory[0]) : null;
  }, [getRecordDate, sortedHistory]);

  const activeModuleTimeline = useMemo(() => {
    if (!activeModule) return [];
    const moduleType = normalizeType(activeModule.tipo);
    return sortedHistory.filter((item) => normalizeType(item.tipo) === moduleType);
  }, [activeModule, normalizeType, sortedHistory]);

  const activeModuleComparison = useMemo(() => {
    if (!activeModuleTimeline.length) return null;
    const latest = activeModuleTimeline[0];
    const previous = activeModuleTimeline[1] || null;
    return { latest, previous };
  }, [activeModuleTimeline]);

  const historyTypeOptions = useMemo(() => {
    const set = new Set();
    sortedHistory.forEach((item) => {
      set.add(normalizeType(item.tipo));
    });
    return Array.from(set);
  }, [normalizeType, sortedHistory]);

  const historyStatusOptions = useMemo(() => {
    const set = new Set();
    sortedHistory.forEach((item) => {
      if (item.status) set.add(String(item.status).toLowerCase());
    });
    return Array.from(set);
  }, [sortedHistory]);

  const filteredHistory = useMemo(() => {
    const term = historySearch.trim().toLowerCase();
    return sortedHistory.filter((item) => {
      const typeKey = normalizeType(item.tipo);
      const statusKey = String(item.status || '').toLowerCase();
      if (historyFilterType !== 'all' && typeKey !== historyFilterType) return false;
      if (historyFilterStatus !== 'all' && statusKey !== historyFilterStatus) return false;
      if (!term) return true;
      const evaluator = item.createdByName || item.alunoNome || '';
      const haystack = `${getEvaluationTypeLabel(item.tipo)} ${getEvaluationStatusLabel(item.status)} ${evaluator}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [historyFilterStatus, historyFilterType, historySearch, normalizeType, sortedHistory]);

  const summaryItems = useMemo(() => {
    const moduleRecord = activeModule?.snapshot || null;
    const responsible = moduleRecord?.createdByName
      || moduleRecord?.alunoNome
      || user?.name
      || user?.nome
      || user?.email
      || 'Equipe LAINES';
    const moduleDate = getRecordDate(moduleRecord);

    return [
      { label: 'Tipo', value: activeModule ? getEvaluationTypeLabel(activeModule.tipo) : 'Não informado' },
      { label: 'Responsável', value: responsible },
      { label: 'Data', value: moduleDate ? formatDate(moduleDate) : 'Não informada' },
      {
        label: 'Completude',
        value: `${progress.completion}% (${progress.finalized}/${progress.total} módulos finalizados)`
      },
      { label: 'Projeto', value: patient?.projetoNome || 'Não vinculado' },
      { label: 'Última atualização', value: overallLastUpdatedAt ? formatDate(overallLastUpdatedAt) : 'Não informada' }
    ];
  }, [
    activeModule,
    formatDate,
    getRecordDate,
    overallLastUpdatedAt,
    patient?.projetoNome,
    progress.completion,
    progress.finalized,
    progress.total,
    user?.email,
    user?.name,
    user?.nome
  ]);

  const reportPeriodLabel = useMemo(() => {
    if (!sortedHistory.length) return 'Sem registros avaliativos.';
    const latest = getRecordDate(sortedHistory[0]);
    const oldest = getRecordDate(sortedHistory[sortedHistory.length - 1]);
    if (!latest || !oldest) return 'Periodo nao identificado.';
    const firstLabel = formatDate(oldest);
    const lastLabel = formatDate(latest);
    return firstLabel === lastLabel ? firstLabel : `${firstLabel} a ${lastLabel}`;
  }, [formatDate, getRecordDate, sortedHistory]);

  const reportModel = useMemo(() => buildClinicalReportModel({
    patient,
    patientId: id,
    user,
    activeModule,
    moduleStates,
    progress,
    sortedHistory,
    baseline: sharedAnthropometryBaseline,
    getRecordDate,
    formatDate
  }), [
    activeModule,
    formatDate,
    getRecordDate,
    id,
    moduleStates,
    patient,
    progress,
    sharedAnthropometryBaseline,
    sortedHistory,
    user
  ]);

  const handleExportClinicalReportHtml = useCallback(() => {
    try {
      const filename = buildReportFilename(patient?.nome || id, 'html');
      const html = buildClinicalReportHtml(reportModel);
      downloadTextFile(html, filename, 'text/html;charset=utf-8;');
      notify({
        type: 'success',
        title: 'Relatorio exportado',
        message: 'Modelo clinico exportado em HTML com sucesso.'
      });
    } catch (error) {
      notify({
        type: 'error',
        title: 'Falha na exportacao',
        message: getApiErrorMessage(error, 'Nao foi possivel exportar o relatorio clinico.')
      });
    }
  }, [id, notify, patient?.nome, reportModel]);

  const handleExportClinicalReportJson = useCallback(() => {
    try {
      const filename = buildReportFilename(patient?.nome || id, 'json');
      const payload = `${JSON.stringify(reportModel, null, 2)}\n`;
      downloadTextFile(payload, filename, 'application/json;charset=utf-8;');
      notify({
        type: 'success',
        title: 'Modelo tecnico exportado',
        message: 'Estrutura do relatorio exportada em JSON.'
      });
    } catch (error) {
      notify({
        type: 'error',
        title: 'Falha na exportacao',
        message: getApiErrorMessage(error, 'Nao foi possivel exportar o modelo tecnico.')
      });
    }
  }, [id, notify, patient?.nome, reportModel]);

  const updateLocalModuleSnapshot = useCallback((tipo, changes) => {
    const key = normalizeType(tipo);
    if (!key) return;
    setModuleSnapshots((prev) => {
      const current = prev[key] || {};
      return {
        ...prev,
        [key]: {
          ...current,
          ...changes,
          tipo: key
        }
      };
    });
  }, [normalizeType]);

  const handleSalvarAvaliacao = useCallback(async (avaliacao, finalizar = false) => {
    try {
      if (!avaliacao?.tipo) return;
      const tipo = normalizeType(avaliacao.tipo);
      const payload = {
        ...attachSharedAnthropometryToPayload(avaliacao),
        tipo,
        pacienteId: id,
        projetoId: patient?.projetoId || null,
        projetoNome: patient?.projetoNome || '',
        sessaoId: avaliacao?.sessaoId || currentSessionId || undefined,
        status: finalizar ? 'finalizada' : 'rascunho'
      };

      const existingDraftId = draftIds[tipo];
      let savedId = existingDraftId;
      if (existingDraftId) {
        await updateAvaliacao(existingDraftId, payload);
      } else {
        savedId = await salvarAvaliacao(payload);
        setDraftIds((prev) => ({ ...prev, [tipo]: savedId }));
      }

      setLastSavedAt(new Date());
      updateLocalModuleSnapshot(tipo, {
        ...payload,
        id: savedId,
        updatedAt: getCurrentDate(),
        createdByName: user?.name || user?.nome || user?.email || 'Equipe'
      });

      notify({
        type: 'success',
        title: finalizar ? 'Módulo finalizado' : 'Rascunho salvo',
        message: finalizar
          ? `${getEvaluationTypeLabel(tipo)} finalizado com sucesso.`
          : `${getEvaluationTypeLabel(tipo)} salvo como rascunho.`
      });

      await loadEvaluationContext();
    } catch (error) {
      notify({
        type: 'error',
        title: 'Erro ao salvar avaliação',
        message: getApiErrorMessage(error, 'Não foi possível salvar a avaliação.')
      });
    }
  }, [
    normalizeType,
    id,
    patient?.projetoId,
    patient?.projetoNome,
    draftIds,
    updateAvaliacao,
    salvarAvaliacao,
    updateLocalModuleSnapshot,
    user?.email,
    user?.name,
    user?.nome,
    notify,
    loadEvaluationContext,
    attachSharedAnthropometryToPayload,
    currentSessionId
  ]);

  const handleAutoSave = useCallback(async (avaliacao) => {
    if (!avaliacao?.tipo || !podeEditar) return;
    setAutoSaveError('');
    try {
      const tipo = normalizeType(avaliacao.tipo);
      const payload = {
        ...attachSharedAnthropometryToPayload(avaliacao),
        tipo,
        pacienteId: id,
        projetoId: patient?.projetoId || null,
        projetoNome: patient?.projetoNome || '',
        sessaoId: avaliacao?.sessaoId || currentSessionId || undefined,
        status: 'rascunho',
        autoSave: true
      };
      const existingDraftId = draftIds[tipo];
      let savedId = existingDraftId;
      if (existingDraftId) {
        await updateAvaliacao(existingDraftId, payload);
      } else {
        savedId = await salvarAvaliacao(payload);
        setDraftIds((prev) => ({ ...prev, [tipo]: savedId }));
      }
      setLastSavedAt(new Date());
      updateLocalModuleSnapshot(tipo, {
        ...payload,
        id: savedId,
        updatedAt: getCurrentDate(),
        createdByName: user?.name || user?.nome || user?.email || 'Equipe'
      });
    } catch (error) {
      setAutoSaveError(getApiErrorMessage(error, 'Falha ao salvar rascunho automático.'));
    }
  }, [
    podeEditar,
    normalizeType,
    id,
    patient?.projetoId,
    patient?.projetoNome,
    draftIds,
    updateAvaliacao,
    salvarAvaliacao,
    updateLocalModuleSnapshot,
    user?.email,
    user?.name,
    user?.nome,
    attachSharedAnthropometryToPayload,
    currentSessionId
  ]);

  const activeTabIndex = useMemo(
    () => moduleStates.findIndex((item) => item.id === activeTab),
    [activeTab, moduleStates]
  );

  const handleGoBack = useCallback(() => {
    navigate(returnToPath, { state: returnState });
  }, [navigate, returnState, returnToPath]);

  const goToPreviousModule = useCallback(() => {
    if (activeTabIndex <= 0) return;
    setActiveTab(moduleStates[activeTabIndex - 1].id);
  }, [activeTabIndex, moduleStates]);

  const goToNextModule = useCallback(() => {
    if (activeTabIndex < 0 || activeTabIndex >= moduleStates.length - 1) return;
    setActiveTab(moduleStates[activeTabIndex + 1].id);
  }, [activeTabIndex, moduleStates]);

  const handleFinalizeCurrentModule = useCallback(async () => {
    if (!canManagePatientFlow || !activeModule) return;
    if (!activeModule.snapshot?.id) {
      notify({
        type: 'warning',
        title: 'Salve antes de finalizar',
        message: 'Salve este módulo ao menos uma vez antes de marcar como finalizado.'
      });
      return;
    }

    setIsFinalizingModule(true);
    try {
      const payload = { status: 'finalizada' };
      await updateAvaliacao(activeModule.snapshot.id, payload);
      notify({
        type: 'success',
        title: 'Módulo finalizado',
        message: `${getEvaluationTypeLabel(activeModule.tipo)} marcado como finalizado.`
      });
      await loadEvaluationContext();
    } catch (error) {
      notify({
        type: 'error',
        title: 'Erro ao finalizar módulo',
        message: getApiErrorMessage(error, 'Não foi possível finalizar este módulo.')
      });
    } finally {
      setIsFinalizingModule(false);
    }
  }, [
    canManagePatientFlow,
    activeModule,
    notify,
    updateAvaliacao,
    loadEvaluationContext
  ]);

  const handleReopenCurrentModule = useCallback(async () => {
    if (!canManagePatientFlow || !activeModule?.snapshot?.id) return;
    setIsFinalizingModule(true);
    try {
      const payload = { status: 'rascunho' };
      await updateAvaliacao(activeModule.snapshot.id, payload);
      notify({
        type: 'success',
        title: 'Módulo reaberto',
        message: `${getEvaluationTypeLabel(activeModule.tipo)} voltou para rascunho.`
      });
      await loadEvaluationContext();
    } catch (error) {
      notify({
        type: 'error',
        title: 'Erro ao reabrir módulo',
        message: getApiErrorMessage(error, 'Não foi possível reabrir este módulo.')
      });
    } finally {
      setIsFinalizingModule(false);
    }
  }, [
    canManagePatientFlow,
    activeModule,
    notify,
    updateAvaliacao,
    loadEvaluationContext
  ]);

  const renderForm = () => {
    const formProps = {
      pacienteId: id,
      onSalvar: handleSalvarAvaliacao,
      readOnly: !podeEditar,
      patient,
      onAutoSave: handleAutoSave,
      baselineAnthropometry: sharedAnthropometryBaseline,
      lockSharedAnthropometry: true,
      moduleSnapshot: activeModule?.snapshot || null,
      currentSessionId: currentSessionId || undefined,
      moduleHistory: activeModuleTimeline,
      allEvaluationHistory: sortedHistory
    };

    switch (activeTab) {
      case 'bioimpedancia':
        return <BioimpedanciaForm {...formProps} />;
      case 'dobras-cutaneas':
        return <DobrasCutaneasForm {...formProps} />;
      case 'perimetros':
        return <PerimetrosCorporaisForm {...formProps} />;
      case 'composicao-integrada':
        return <ComposicaoCorporalIntegradaForm {...formProps} />;
      case 'gasto-energetico':
        return <GastoEnergeticoTotalForm {...formProps} />;
      case 'anamnese-inicial':
        return <AnamneseInicialForm {...formProps} />;
      case 'avaliacao-clinica':
        return <AvaliacaoClinicaForm {...formProps} />;
      case 'alimentar':
        return <AvaliacaoAlimentarNOVA {...formProps} />;
      case 'hidratacao':
        return <AvaliacaoHidratacao {...formProps} />;
      case 'socioeconomica':
        return <AvaliacaoSocioeconomica {...formProps} />;
      case 'fisioterapia':
        return <AvaliacaoFisioterapia {...formProps} />;
      case 'psicologia':
        return <AvaliacaoPsicologia {...formProps} />;
      case 'exames-laboratoriais':
        return <AvaliacaoExamesLaboratoriais {...formProps} />;
      case 'evolucao-retorno':
        return <AvaliacaoEvolucaoRetorno {...formProps} />;
      default:
        return null;
    }
  };

  const overallStatusLabel = progress.overallStatus === 'em_analise'
    ? 'Em andamento'
    : getEvaluationStatusLabel(progress.overallStatus);

  const activeSummaryStatus = activeModule?.status || 'pendente';

  return (
    <div className="avaliacao-completa">
      <header className="avaliacao-header">
        <div className="avaliacao-header-left">
          <button
            className="btn-back"
            onClick={handleGoBack}
            type="button"
            aria-label="Voltar"
            title="Voltar"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="avaliacao-title">
            <h2>Avaliação completa</h2>
            <p className="sub">Atleta: {patient?.nome || id}</p>
            {patient?.projetoNome && (
              <span className="sub">Projeto: {patient.projetoNome}</span>
            )}
          </div>
        </div>
        <div className="avaliacao-header-meta">
          <span className={`eval-status-badge ${progress.overallStatus === 'finalizada' ? 'eval-status-badge--finalizada' : 'eval-status-badge--andamento'}`}>
            <span className="eval-status-badge__dot" />
            {overallStatusLabel}
          </span>
          {somenteLeitura && (
            <span className="eval-status-badge eval-status-badge--leitura">
              <span className="eval-status-badge__dot" />
              Somente leitura
            </span>
          )}
          {lastSavedAt && (
            <span className="status-pill status-saved">
              <Clock size={14} />
              Último salvamento: {lastSavedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </header>

      <EvaluationSummaryStrip
        title="Resumo clínico da avaliação"
        subtitle={`Módulo ativo: ${activeModule ? getEvaluationTypeLabel(activeModule.tipo) : 'Não informado'}`}
        status={activeSummaryStatus}
        empty={!activeModule}
        emptyMessage="Não há módulo selecionado."
        items={summaryItems}
      />

      <div className="avaliacao-helper">
        <FileText size={18} />
        <p>
          Preencha os módulos em sequência clínica. Cada módulo possui salvamento próprio e pode ser finalizado quando estiver completo.
        </p>
      </div>

      {autoSaveError && (
        <div className="avaliacao-helper avaliacao-helper--error">
          <ShieldCheck size={18} />
          <p>{autoSaveError}</p>
        </div>
      )}

      {historyError && (
        <div className="avaliacao-helper avaliacao-helper--error">
          <ShieldCheck size={18} />
          <p>{historyError}</p>
        </div>
      )}

      <div className="avaliacao-layout-grid">
        <aside className="avaliacao-sidebar">
          <section className="avaliacao-sidebar-card avaliacao-progress-card">
            <div className="avaliacao-sidebar-card__header">
              <h3>Progresso clínico</h3>
            </div>
            <div className="avaliacao-progress-kpi">
              <span className="avaliacao-progress-kpi__number">{progress.completion}%</span>
              <span className="avaliacao-progress-kpi__label">concluído</span>
            </div>
            <div className="avaliacao-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.completion}>
              <span style={{ width: `${progress.completion}%` }} />
            </div>
            <div className="avaliacao-progress-meta">
              <span><CheckCircle2 size={13} /> {progress.finalized} finalizado{progress.finalized !== 1 ? 's' : ''}</span>
              <span><CircleDashed size={13} /> {progress.inProgress} em andamento</span>
              <span><Clock size={13} /> {progress.pending} pendente{progress.pending !== 1 ? 's' : ''}</span>
            </div>
          </section>

          <section className="avaliacao-sidebar-card">
            <div className="avaliacao-sidebar-card__header">
              <h3>Módulos da avaliação</h3>
              <span>{activeTabIndex + 1}/{moduleStates.length}</span>
            </div>
            <div className="avaliacao-module-groups">
              {groupedModules.map((group) => (
                <div key={group.group} className="avaliacao-module-group">
                  <p className="avaliacao-module-group__title">{group.group}</p>
                  <div className="avaliacao-module-group__list">
                    {group.items.map((module) => (
                      <button
                        key={module.id}
                        type="button"
                        className={`avaliacao-module-btn ${module.id === activeTab ? 'active' : ''} status-${module.status}`}
                        style={{ '--fill': `${module.completion}%` }}
                        onClick={() => setActiveTab(module.id)}
                        title={`${module.label} — ${module.completion}% completo`}
                      >
                        <div className="avaliacao-module-btn__main">
                          <module.icon size={14} />
                          <span>{module.label}</span>
                        </div>
                        <div className="avaliacao-module-btn__meta">
                          <small>{module.completion}%</small>
                          {module.status === 'finalizada'
                            ? <CheckCircle2 size={13} className="module-icon-status module-icon-finalizada" />
                            : module.status === 'rascunho'
                              ? <CircleDashed size={13} className="module-icon-status module-icon-rascunho" />
                              : <Clock size={13} className="module-icon-status module-icon-pendente" />}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="avaliacao-sidebar-card">
            <div className="avaliacao-sidebar-card__header">
              <h3>Evolução e histórico</h3>
              <span>{filteredHistory.length}</span>
            </div>

            <div className="avaliacao-history-filters">
              <select
                value={historyFilterType}
                onChange={(event) => setHistoryFilterType(event.target.value)}
                aria-label="Filtrar histórico por tipo"
              >
                <option value="all">Todos os tipos</option>
                {historyTypeOptions.map((typeKey) => (
                  <option key={typeKey} value={typeKey}>
                    {getEvaluationTypeLabel(typeKey)}
                  </option>
                ))}
              </select>
              <select
                value={historyFilterStatus}
                onChange={(event) => setHistoryFilterStatus(event.target.value)}
                aria-label="Filtrar histórico por status"
              >
                <option value="all">Todos os status</option>
                {historyStatusOptions.map((statusOption) => (
                  <option key={statusOption} value={statusOption}>
                    {getEvaluationStatusLabel(statusOption)}
                  </option>
                ))}
              </select>
              <input
                type="search"
                value={historySearch}
                onChange={(event) => setHistorySearch(event.target.value)}
                placeholder="Buscar por tipo, status ou responsável"
                aria-label="Buscar no histórico"
              />
            </div>

            {loadingHistory ? (
              <div className="avaliacao-history-empty">Carregando histórico...</div>
            ) : filteredHistory.length === 0 ? (
              <div className="avaliacao-history-empty">Sem registros para os filtros selecionados.</div>
            ) : (
              <div className="avaliacao-history-list">
                {filteredHistory.slice(0, 8).map((item, index) => {
                  const itemDate = getRecordDate(item);
                  return (
                    <div key={item.id || `${item.tipo}-${index}`} className="avaliacao-history-item">
                      <div>
                        <strong>{getEvaluationTypeLabel(item.tipo)}</strong>
                        <span>{itemDate ? formatDate(itemDate) : 'Sem data'}</span>
                      </div>
                      <span className={`module-status status-${String(item.status || 'pendente').toLowerCase()}`}>
                        {getEvaluationStatusLabel(item.status || 'pendente')}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="avaliacao-comparison">
              <h4>Comparativo rápido do módulo ativo</h4>
              {!activeModuleComparison ? (
                <p>Sem avaliações anteriores para comparar.</p>
              ) : (
                <>
                  <div className="avaliacao-comparison-row">
                    <span>Última</span>
                    <strong>{formatDate(getRecordDate(activeModuleComparison.latest) || activeModuleComparison.latest.data)}</strong>
                    <small>{getEvaluationStatusLabel(activeModuleComparison.latest.status || 'pendente')}</small>
                  </div>
                  <div className="avaliacao-comparison-row">
                    <span>Anterior</span>
                    <strong>
                      {activeModuleComparison.previous
                        ? formatDate(getRecordDate(activeModuleComparison.previous) || activeModuleComparison.previous.data)
                        : 'Sem registro'}
                    </strong>
                    <small>
                      {activeModuleComparison.previous
                        ? getEvaluationStatusLabel(activeModuleComparison.previous.status || 'pendente')
                        : '---'}
                    </small>
                  </div>
                </>
              )}
            </div>
          </section>

          <section className="avaliacao-sidebar-card avaliacao-report-card">
            <div className="avaliacao-sidebar-card__header">
              <h3>Relatorio clinico</h3>
              <span>v1</span>
            </div>
            <p className="avaliacao-report-card__description">
              Exporte um relatorio estruturado com cabecalho clinico, progresso dos modulos, ficha base e historico.
            </p>
            <div className="avaliacao-report-card__meta">
              <div>
                <small>Periodo</small>
                <strong>{reportPeriodLabel}</strong>
              </div>
              <div>
                <small>Registros</small>
                <strong>{sortedHistory.length}</strong>
              </div>
              <div>
                <small>Status geral</small>
                <strong>{overallStatusLabel}</strong>
              </div>
            </div>
            <div className="avaliacao-report-card__actions">
              <button
                type="button"
                className="tab-btn tab-btn--primary"
                onClick={handleExportClinicalReportHtml}
              >
                <Download size={15} />
                Exportar relatorio HTML
              </button>
              <button
                type="button"
                className="tab-btn tab-btn--secondary"
                onClick={handleExportClinicalReportJson}
              >
                <FileText size={15} />
                Exportar modelo JSON
              </button>
            </div>
            <p className="avaliacao-report-card__hint">
              O arquivo HTML pode ser aberto no navegador e salvo como PDF.
            </p>
          </section>
        </aside>

        <section className="avaliacao-main">
          <div className="avaliacao-main-toolbar">
            <div className="avaliacao-main-toolbar__title">
              {activeModule?.group && (
                <p className="avaliacao-module-breadcrumb">
                  {activeModule.group}
                  <span aria-hidden="true"> / </span>
                  {activeTabIndex + 1} de {moduleStates.length}
                </p>
              )}
              <h3>{activeModule ? activeModule.label : 'Módulo clínico'}</h3>
              <p>{activeModule?.description || 'Preencha e salve os dados clínicos deste módulo.'}</p>
            </div>
            <div className="avaliacao-main-toolbar__actions">
              <button
                type="button"
                className="tab-btn"
                onClick={goToPreviousModule}
                disabled={activeTabIndex <= 0}
              >
                <ChevronLeft size={15} />
                Módulo anterior
              </button>
              <button
                type="button"
                className="tab-btn"
                onClick={goToNextModule}
                disabled={activeTabIndex < 0 || activeTabIndex >= moduleStates.length - 1}
              >
                Próximo módulo
                <ChevronRight size={15} />
              </button>
              {canManagePatientFlow && activeModuleStatus !== 'finalizada' && (
                <button
                  type="button"
                  className="tab-btn tab-btn--primary"
                  onClick={handleFinalizeCurrentModule}
                  disabled={isFinalizingModule}
                >
                  <CheckCircle2 size={15} />
                  {isFinalizingModule ? 'Finalizando...' : 'Finalizar módulo'}
                </button>
              )}
              {canManagePatientFlow && activeModuleStatus === 'finalizada' && (
                <button
                  type="button"
                  className="tab-btn tab-btn--secondary"
                  onClick={handleReopenCurrentModule}
                  disabled={isFinalizingModule}
                >
                  <CircleDashed size={15} />
                  {isFinalizingModule ? 'Reabrindo...' : 'Reabrir módulo'}
                </button>
              )}
            </div>
          </div>

          <div className="avaliacao-shared-baseline">
            <div className="avaliacao-shared-baseline__header">
              <div>
                <h4>Ficha base da avaliação</h4>
                <p>Dados compartilhados entre módulos para evitar preenchimento repetido.</p>
              </div>
              {podeEditar && sharedAnthropometryTouched && (
                <button
                  type="button"
                  className="tab-btn tab-btn--secondary"
                  onClick={handleRestoreAnthropometryBase}
                >
                  Restaurar base
                </button>
              )}
            </div>
            <div className="avaliacao-shared-baseline__grid">
              <label>
                Peso (kg)
                <input
                  type="number"
                  step="0.1"
                  value={sharedAnthropometryDraft.pesoKg}
                  onChange={(event) => handleSharedAnthropometryChange('pesoKg', event.target.value)}
                  disabled={!podeEditar}
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
                  disabled={!podeEditar}
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
                  disabled={!podeEditar}
                  placeholder="Ex.: 23"
                />
              </label>
              <label>
                Sexo biológico
                <select
                  value={sharedAnthropometryDraft.sexo}
                  onChange={(event) => handleSharedAnthropometryChange('sexo', event.target.value)}
                  disabled={!podeEditar}
                >
                  <option value="">Não informado</option>
                  <option value="MASCULINO">Masculino</option>
                  <option value="FEMININO">Feminino</option>
                </select>
              </label>
            </div>
          </div>

          <div className="avaliacao-body">
            {renderForm()}
          </div>

          <div className="avaliacao-footer-actions">
            <button type="button" className="tab-btn tab-btn--secondary" onClick={handleGoBack}>
              <ArrowLeft size={15} />
              Voltar ao prontuário
            </button>
            <button type="button" className="tab-btn tab-btn--secondary" onClick={() => window.print()}>
              <Printer size={15} />
              Imprimir avaliação
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AvaliacaoCompleta;

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
  if (token.includes('fem') || token === 'f') return 'FEMININO';
  if (token.includes('masc') || token === 'm') return 'MASCULINO';
  return String(value).toUpperCase();
}

function calculateAge(value) {
  if (!value) return null;
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const monthDiff = today.getMonth() - date.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) age -= 1;
  return age;
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

