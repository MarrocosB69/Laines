import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePacientes } from '../contexts/PacienteContext';
import { useUiFeedback } from '../contexts/UiFeedbackContext';
import api, { getApiErrorMessage } from '../services/api';

import BioimpedanciaForm from '../components/Avaliacoes/Antropometria/BioimpedanciaForm';
import DobrasCutaneasForm from '../components/Avaliacoes/Antropometria/DobrasCutaneasForm';
import PerimetrosCorporaisForm from '../components/Avaliacoes/Antropometria/PerimetrosCorporaisForm';
import GastoEnergeticoTotalForm from '../components/Avaliacoes/Antropometria/GastoEnergeticoTotalForm';
import AvaliacaoAlimentar from './avaliacoes/AvaliacaoAlimentar';
import AvaliacaoHidratacao from '../components/Avaliacoes/avaliacao-hidratacao/AvaliacaoHidratacao';
import AvaliacaoSocioeconomica from '../components/Avaliacoes/avaliacao-socioeconomica/AvaliacaoSocioeconomica';
import AvaliacaoFisioterapia from '../components/Avaliacoes/avaliacao-fisioterapia/AvaliacaoFisioterapia';
import AvaliacaoPsicologia from '../components/Avaliacoes/avaliacao-psicologia/AvaliacaoPsicologia';
import AvaliacaoExamesLaboratoriais from '../components/Avaliacoes/avaliacao-exames-laboratoriais/AvaliacaoExamesLaboratoriais';
import AvaliacaoEvolucaoRetorno from '../components/Avaliacoes/avaliacao-evolucao-retorno/AvaliacaoEvolucaoRetorno';
import AnamneseInicialForm from '../components/Avaliacoes/anamnese/AnamneseInicialForm';
import AvaliacaoClinicaForm from '../components/Avaliacoes/clinica/AvaliacaoClinicaForm';
import AvaliacaoTriagemREDS from './avaliacoes/AvaliacaoTriagemREDS';
import AvaliacaoCargaTreino from './avaliacoes/AvaliacaoCargaTreino';
import {
  getEvaluationStatusLabel,
  getEvaluationTypeLabel
} from '../components/shared/evaluationSummaryUtils';
import {
  listEvaluationRegistryByContext
} from '../constants/evaluationRegistry';
import { ADMIN_ROLES, isStudentMemberRole, normalizeRole } from '../constants/roles';
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
  Printer,
  RefreshCw
} from 'lucide-react';

import './AvaliacaoCompleta.css';
import '../components/Prontuario/ProntuarioTheme.css';

const MODULE_ICON_MAP = {
  bioimpedancia: Scale,
  dobras_cutaneas: Activity,
  perimetros: Scale,
  gasto_energetico_total: Flame,
  carga_treino: Activity,
  anamnese_inicial: ClipboardList,
  avaliacao_clinica: Heart,
  triagem_reds: ShieldCheck,
  alimentar: Apple,
  hidratacao: Droplets,
  avaliacao_socioeconomica: FileText,
  fisioterapia: Activity,
  psicologia: Heart,
  exames_laboratoriais: FileText,
  evolucao_retorno: Clock
};

const MODULE_CONFIG = [...listEvaluationRegistryByContext('avaliacaoCompleta')]
  .sort((a, b) => (a.ordem ?? Number.MAX_SAFE_INTEGER) - (b.ordem ?? Number.MAX_SAFE_INTEGER))
  .map((item) => ({
    id: item.moduleId || item.type,
    tipo: item.type,
    label: item.label,
    icon: MODULE_ICON_MAP[item.type] || FileText,
    group: item.groupLabel,
    stageId: item.macroStageId || 'triagem',
    stageLabel: item.macroStageLabel || item.groupLabel || 'Triagem',
    description: item.description,
    ordem: item.ordem ?? Number.MAX_SAFE_INTEGER
  }));

const EVALUATION_MANAGER_ROLES = new Set([...ADMIN_ROLES, 'coord_atendimento']);

const MODULE_DEPENDENCIES = Object.freeze({
  'triagem-reds': {
    requires: ['alimentar', 'carga-treino'],
    mode: 'all',
    hint: 'Usa ingestão calórica (Alimentar) e gasto de exercício (Carga de Treino) para calcular a DE. A massa magra é extraída automaticamente de Bioimpedância ou Dobras Cutâneas (a mais recente disponível).'
  },
  'gasto-energetico': {
    requires: ['anamnese-inicial'],
    mode: 'soft',
    hint: 'Usa perfil da Anamnese Inicial (idade, sexo, modalidade) para sugerir o Fator de Atividade adequado.'
  },
});

const CLINICAL_STAGE_CONFIG = Object.freeze([
  {
    id: 'visao_geral',
    label: 'Visão geral',
    description: 'Panorama clínico da sessão e próximos passos'
  },
  {
    id: 'triagem',
    label: 'Triagem',
    description: 'Contexto inicial, sinais vitais e rastreio socioeconômico'
  },
  {
    id: 'composicao_corporal',
    label: 'Composição corporal',
    description: 'Antropometria, perímetros, dobras e bioimpedância'
  },
  {
    id: 'demanda_performance',
    label: 'Demanda e performance',
    description: 'Gasto energético total e carga de treino semanal'
  },
  {
    id: 'rotina_alimentar',
    label: 'Rotina alimentar',
    description: 'Consumo alimentar por grupos NOVA e hidratação'
  },
  {
    id: 'multiprofissional',
    label: 'Multiprofissional',
    description: 'Avaliações de psicologia e fisioterapia'
  },
  {
    id: 'conduta',
    label: 'Conduta',
    description: 'Síntese RED-S, exames laboratoriais e retorno clínico'
  }
]);

const STAGE_SYNTHESIS_HINTS = Object.freeze({
  triagem: 'Registre contexto clínico, sinais vitais e segurança alimentar para embasar todas as etapas seguintes.',
  composicao_corporal: 'Registre ao menos um método de composição corporal (dobras ou BIA) — a massa magra é derivada automaticamente para o cálculo de DE.',
  demanda_performance: 'Calcule o GET e registre a carga semanal antes de avançar para a rotina alimentar.',
  rotina_alimentar: 'Valide ingestão calórica e hidratação — dados essenciais para o cálculo de disponibilidade energética.',
  multiprofissional: 'Registre avaliações de psicologia e fisioterapia para fechar o quadro interprofissional.',
  conduta: 'Calcule a Disponibilidade Energética (RED-S), interprete exames e defina o retorno clínico.',
  visao_geral: 'Use o painel para priorizar pendências críticas e concluir a jornada da sessão.'
});

const ONBOARDING_CONTRACT_FIELDS = Object.freeze([
  { key: 'modalidadePrincipal', label: 'Modalidade principal' },
  { key: 'frequenciaSemanal', label: 'Frequência semanal' },
  { key: 'duracaoSessao', label: 'Duração por sessão' },
  { key: 'genero', label: 'Gênero' },
  { key: 'status', label: 'Status' },
  { key: 'observacoesIniciais', label: 'Observações iniciais' }
]);

const ONBOARDING_NEXT_FIELDS = Object.freeze([
  { key: 'motivoAtendimento', label: 'Motivo do atendimento' },
  { key: 'atividadeFisica', label: 'Atividade física atual' },
  { key: 'rotinaManha', label: 'Rotina da manhã' },
  { key: 'rotinaTarde', label: 'Rotina da tarde' },
  { key: 'rotinaNoite', label: 'Rotina da noite' },
  { key: 'ingestaoAgua', label: 'Percepção de hidratação' },
  { key: 'litrosAguaDia', label: 'Litros de água por dia' },
  { key: 'diagnosticosPessoais', label: 'Diagnósticos pessoais' },
  { key: 'historicoFamiliar', label: 'Histórico familiar' },
  { key: 'alergiaIntolerancia', label: 'Alergias/intolerâncias' }
]);

const getTextValue = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

const getListValue = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => getTextValue(item))
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

const hasValue = (value) => {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  return getTextValue(value).length > 0;
};

const getCurrentDate = () => new Date().toISOString();
const REDS_PRESCRICAO_WARNING = 'Disponibilidade Energética < 30 kcal/kg MLG detectada. Recomenda-se não prescrever plano hipocalórico antes de corrigir o déficit energético.';

const pickNum = (obj, ...keys) => {
  if (!obj || typeof obj !== 'object') return null;
  for (const key of keys) {
    const val = obj[key];
    if (val !== null && val !== undefined && val !== '' && Number.isFinite(Number(val))) return Number(val);
  }
  return null;
};

const pickStr = (obj, ...keys) => {
  if (!obj || typeof obj !== 'object') return null;
  for (const key of keys) {
    const val = String(obj[key] || '').trim();
    if (val) return val;
  }
  return null;
};

const getModuleKeyMetric = (tipo, snapshot) => {
  if (!snapshot) return null;
  const d = snapshot.dados || {};
  const r = snapshot.resultados || {};
  const rc = d.resultados_calculados || {};
  switch (tipo) {
    case 'bioimpedancia': {
      const pg = pickNum(d, 'percentualGordura', 'percentual_gordura') ?? pickNum(r, 'percentualGordura', 'percentual_gordura') ?? pickNum(rc, 'percentualGordura');
      const pha = pickNum(rc, 'phaseAngle') ?? pickNum(d, 'phaseAngle');
      const mm = pickNum(d, 'massaMagra', 'massa_magra') ?? pickNum(r, 'massaMagra', 'massa_magra') ?? pickNum(rc, 'massaMagra', 'massa_magra_kg');
      if (pg != null) {
        if (pha != null) return `${pg.toFixed(1)}%G · PhA ${pha.toFixed(1)}°`;
        if (mm != null) return `${pg.toFixed(1)}%G · ${mm.toFixed(1)} MM`;
        return `${pg.toFixed(1)}%G`;
      }
      break;
    }
    case 'dobras_cutaneas': {
      const pg = pickNum(d, 'percentualGordura', 'percentual_gordura') ?? pickNum(r, 'percentualGordura', 'percentual_gordura');
      if (pg != null) return `${pg.toFixed(1)}% gordura`;
      break;
    }
    case 'perimetros': {
      const c = pickNum(d, 'cinturaCm', 'cintura', 'cintura_cm') ?? pickNum(r, 'cinturaCm', 'cintura') ?? pickNum(rc, 'cinturaCm');
      if (c != null) return `Cintura ${c.toFixed(0)} cm`;
      break;
    }
    case 'gasto_energetico_total': {
      const get = pickNum(rc, 'getEstimadoKcal') ?? pickNum(r, 'get_estimado_kcal', 'getEstimadoKcal', 'gastoEnergeticoTotal') ?? pickNum(d, 'getEstimadoKcal', 'gastoEnergeticoTotal');
      if (get != null) return `GET ${get.toFixed(0)} kcal`;
      break;
    }
    case 'carga_treino': {
      const acwr = pickNum(r, 'acwr') ?? pickNum(d, 'acwr') ?? pickNum(rc, 'acwr');
      if (acwr != null) return `ACWR ${acwr.toFixed(2)}`;
      break;
    }
    case 'alimentar': {
      const kcal = pickNum(r, 'caloriasTotal', 'totalDiario', 'energiaKcal') ?? pickNum(d, 'caloriasTotal', 'energiaKcal') ?? pickNum(rc, 'caloriasTotal', 'energiaKcal');
      if (kcal != null && kcal > 0) return `${kcal.toFixed(0)} kcal`;
      break;
    }
    case 'triagem_reds': {
      const de = pickNum(r, 'disponibilidadeEnergetica') ?? pickNum(d, 'disponibilidadeEnergetica');
      if (de != null) return `DE ${de.toFixed(0)} kcal/kg`;
      break;
    }
    case 'hidratacao': {
      const adesao = pickNum(r, 'adesaoReposicaoPercentual') ?? pickNum(d, 'adesaoReposicaoPercentual');
      if (adesao != null) return `Adesão ${adesao.toFixed(0)}%`;
      break;
    }
    case 'anamnese_inicial': {
      const mod = pickStr(d, 'modalidadePrincipal', 'modalidade');
      if (mod) return mod;
      break;
    }
    case 'exames_laboratoriais': {
      const n = Array.isArray(d.exames) ? d.exames.length : null;
      if (n != null) return `${n} exame${n !== 1 ? 's' : ''}`;
      break;
    }
    case 'evolucao_retorno': {
      const score = pickNum(r, 'scoreAdesaoGeral', 'scoreAdesao') ?? pickNum(d, 'scoreAdesaoGeral', 'scoreAdesao');
      if (score != null) return `Adesão ${score.toFixed(0)}%`;
      break;
    }
    default:
      break;
  }
  return null;
};

const getRelativeDateLabel = (date) => {
  if (!date) return null;
  const diffMs = Date.now() - new Date(date).getTime();
  if (diffMs < 0) return null;
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return 'hoje';
  if (diffDays === 1) return 'ontem';
  if (diffDays < 30) return `${diffDays}d`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}m`;
  return `${Math.floor(diffDays / 365)}a`;
};

const MODULE_CONTEXT_FIELDS = Object.freeze({
  bioimpedancia: [
    { label: 'Peso', paths: [['d', 'pesoTotal'], ['d', 'peso'], ['d', 'pesoKg']], unit: 'kg', dec: 1 },
    { label: '%Gordura', paths: [['d', 'percentualGordura'], ['d', 'percentual_gordura'], ['r', 'percentualGordura']], unit: '%', dec: 1 },
    { label: 'Massa Magra', paths: [['d', 'massaMagra'], ['d', 'massa_magra'], ['r', 'massaMagra']], unit: 'kg', dec: 1 },
    { label: 'PhA', paths: [['rc', 'phaseAngle']], unit: '°', dec: 1 },
    { label: 'ECW/ICW', paths: [['rc', 'ecwIcwRatio']], unit: '', dec: 2 },
    { label: 'FFMI', paths: [['rc', 'ffmi']], unit: '', dec: 1 },
    { label: 'TMB', paths: [['d', 'taxaMetabolicaBasal'], ['d', 'tmb'], ['r', 'tmb_kcal']], unit: 'kcal', dec: 0 },
  ],
  dobras_cutaneas: [
    { label: '%Gordura', paths: [['d', 'percentualGordura'], ['r', 'percentualGordura']], unit: '%', dec: 1 },
    { label: 'Soma Dobras', paths: [['d', 'somaDobrasCm'], ['d', 'somaDobras']], unit: 'mm', dec: 1 },
    { label: 'Protocolo', paths: [['d', 'protocolo']], isText: true },
  ],
  perimetros: [
    { label: 'Cintura', paths: [['d', 'cinturaCm'], ['r', 'cinturaCm'], ['rc', 'cinturaCm']], unit: 'cm', dec: 0 },
    { label: 'Quadril', paths: [['d', 'quadrilCm'], ['r', 'quadrilCm']], unit: 'cm', dec: 0 },
    { label: 'Pescoço', paths: [['d', 'pescocoCm'], ['r', 'pescocoCm']], unit: 'cm', dec: 0 },
    { label: 'RCQ', paths: [['d', 'rcq'], ['r', 'rcq'], ['rc', 'rcq']], unit: '', dec: 2 },
  ],
  composicao_corporal_integrada: [
    { label: '%G Oficial', paths: [['r', 'percentualGorduraOficial'], ['d', 'percentualGorduraOficial']], unit: '%', dec: 1 },
    { label: 'Massa Magra', paths: [['r', 'massaMagraOficialKg'], ['d', 'massaMagraOficialKg']], unit: 'kg', dec: 1 },
    { label: 'Fonte', paths: [['r', 'fonteOficial'], ['d', 'fonteOficial']], isText: true },
  ],
  gasto_energetico_total: [
    { label: 'GET', paths: [['rc', 'getEstimadoKcal'], ['r', 'get_estimado_kcal'], ['r', 'getEstimadoKcal'], ['d', 'getEstimadoKcal']], unit: 'kcal', dec: 0 },
    { label: 'TMB', paths: [['rc', 'tmbBaseKcal'], ['r', 'tmb_kcal'], ['r', 'tmbBaseKcal']], unit: 'kcal', dec: 0 },
    { label: 'Fator Ativ.', paths: [['d', 'fatorAtividade'], ['r', 'fator_atividade']], unit: '×', dec: 2 },
  ],
  carga_treino: [
    { label: 'ACWR', paths: [['r', 'acwr']], unit: '', dec: 2 },
    { label: 'Monotonia', paths: [['r', 'monotonia']], unit: '', dec: 2 },
    { label: 'Strain', paths: [['r', 'strain']], unit: '', dec: 0 },
  ],
  alimentar: [
    { label: 'Kcal', paths: [['r', 'caloriasTotal'], ['r', 'totalDiario'], ['r', 'energiaKcal']], unit: 'kcal', dec: 0 },
    { label: 'CHO', paths: [['r', 'cho'], ['r', 'carboidrato']], unit: 'g', dec: 0 },
    { label: 'PTN', paths: [['r', 'ptn'], ['r', 'proteina']], unit: 'g', dec: 0 },
    { label: 'LIP', paths: [['r', 'lip'], ['r', 'lipidios']], unit: 'g', dec: 0 },
    { label: 'Fibras', paths: [['r', 'fibra']], unit: 'g', dec: 0 },
  ],
  triagem_reds: [
    { label: 'DE', paths: [['r', 'disponibilidadeEnergetica'], ['d', 'disponibilidadeEnergetica']], unit: 'kcal/kg', dec: 0 },
    { label: 'Ingestão', paths: [['r', 'ingestaoKcalR24hAuto'], ['d', 'ingestaoKcalR24hAuto']], unit: 'kcal', dec: 0 },
    { label: 'Classif.', paths: [['r', 'classificacaoLabel'], ['d', 'classificacaoLabel']], isText: true },
  ],
  hidratacao: [
    { label: 'Adesão hídrica', paths: [['r', 'adesaoReposicaoPercentual']], unit: '%', dec: 0 },
    { label: 'Consumo', paths: [['d', 'consumoHidricoL'], ['d', 'litrosAguaDia']], unit: 'L', dec: 1 },
  ],
  anamnese_inicial: [
    { label: 'Modalidade', paths: [['d', 'modalidadePrincipal'], ['d', 'modalidade']], isText: true },
    { label: 'Freq. semanal', paths: [['d', 'frequenciaSemanal']], isText: true },
    { label: 'Sexo', paths: [['d', 'genero'], ['d', 'sexo']], isText: true },
  ],
  avaliacao_clinica: [
    { label: 'PA', paths: [['d', 'pressaoArterial'], ['d', 'pa']], isText: true },
    { label: 'FC', paths: [['d', 'frequenciaCardiaca'], ['d', 'fc']], unit: 'bpm', dec: 0 },
    { label: 'Peso', paths: [['d', 'pesoKg'], ['d', 'peso']], unit: 'kg', dec: 1 },
  ],
  exames_laboratoriais: [
    { label: 'Exames', paths: [], isCustom: 'examesCount' },
  ],
  evolucao_retorno: [
    { label: 'Adesão', paths: [['r', 'scoreAdesaoGeral'], ['r', 'scoreAdesao'], ['d', 'scoreAdesaoGeral']], unit: '%', dec: 0 },
  ],
});

const getModuleContextCards = (tipo, snapshot) => {
  if (!snapshot) return [];
  const fields = MODULE_CONTEXT_FIELDS[tipo];
  if (!fields || !fields.length) return [];

  const d = snapshot.dados || {};
  const r = snapshot.resultados || {};
  const rc = d.resultados_calculados || {};
  const src = { d, r, rc };

  const cards = [];
  for (const field of fields) {
    if (field.isCustom === 'examesCount') {
      const n = Array.isArray(d.exames) ? d.exames.length : null;
      if (n != null) cards.push({ label: field.label, value: String(n) });
      continue;
    }
    if (field.isText) {
      let val = null;
      for (const [s, key] of field.paths) {
        const v = String(src[s]?.[key] || '').trim();
        if (v) { val = v; break; }
      }
      if (val) cards.push({ label: field.label, value: val });
    } else {
      let val = null;
      for (const [s, key] of field.paths) {
        const v = pickNum(src[s], key);
        if (v != null) { val = v; break; }
      }
      if (val != null) {
        const fmt = field.dec === 0 ? String(Math.round(val)) : val.toFixed(field.dec);
        const unit = field.unit ? ` ${field.unit}` : '';
        cards.push({ label: field.label, value: `${fmt}${unit}` });
      }
    }
  }
  return cards;
};

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
  const { notify, confirm } = useUiFeedback();

  const [activeTab, setActiveTab] = useState(() => location.state?.startTab || MODULE_CONFIG[0]?.id || 'anamnese-inicial');
  const [isNewSessionMode, setIsNewSessionMode] = useState(() => Boolean(location.state?.newSession));
  const [activeSessionId, setActiveSessionId] = useState(() => String(location.state?.sessionId || '').trim());
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [patient, setPatient] = useState(null);
  const [draftIds, setDraftIds] = useState({});
  const [moduleSnapshots, setModuleSnapshots] = useState({});
  const [evaluationHistory, setEvaluationHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [autoSaveError, setAutoSaveError] = useState('');
  const [isFinalizingModule, setIsFinalizingModule] = useState(false);
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

      const pinnedSessionId = isNewSessionMode ? String(activeSessionId || '').trim() : '';
      sorted.forEach((item) => {
        const typeKey = normalizeType(item.tipo);
        if (!typeKey) return;
        const itemStatus = String(item.status || '').toLowerCase();
        const isOpenDraft = itemStatus !== 'finalizada';
        const isInPinnedSession = pinnedSessionId
          && String(item?.sessaoId || '').trim() === pinnedSessionId;
        if ((!isNewSessionMode || isOpenDraft || isInPinnedSession) && !grouped[typeKey]) grouped[typeKey] = item;
        if (isOpenDraft && item.id && !nextDraftIds[typeKey]) {
          nextDraftIds[typeKey] = item.id;
        }
      });

      setModuleSnapshots(grouped);
      setDraftIds(nextDraftIds);
      setEvaluationHistory(sorted);
      return sorted;
    } catch (error) {
      setHistoryError(getApiErrorMessage(error, 'Não foi possível carregar o histórico da avaliação.'));
      return [];
    } finally {
      setLoadingHistory(false);
    }
  }, [activeSessionId, getAvaliacoesByPaciente, getRecordDate, id, isNewSessionMode, normalizeType]);

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
    if (activeTab === 'visao_geral') return;
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

  const resolveClinicalStage = useCallback((module) => (
    module?.stageId || 'triagem'
  ), []);

  const stageSummaries = useMemo(() => {
    return CLINICAL_STAGE_CONFIG
      .filter((stage) => stage.id !== 'visao_geral')
      .map((stage) => {
        const modules = moduleStates.filter((item) => resolveClinicalStage(item) === stage.id);
        const total = modules.length;
        const finalized = modules.filter((item) => item.status === 'finalizada').length;
        const inProgress = modules.filter((item) => item.status === 'rascunho').length;
        const completion = total
          ? Math.round(modules.reduce((sum, item) => sum + item.completion, 0) / total)
          : 0;
        return {
          ...stage,
          modules,
          total,
          finalized,
          inProgress,
          pending: Math.max(total - finalized - inProgress, 0),
          completion
        };
      });
  }, [moduleStates, resolveClinicalStage]);

  const stageSummaryById = useMemo(() => stageSummaries.reduce((acc, stage) => {
    acc[stage.id] = stage;
    return acc;
  }, {}), [stageSummaries]);

  const activeModule = useMemo(
    () => activeTab === 'visao_geral' ? null : (moduleStates.find((item) => item.id === activeTab) || moduleStates[0]),
    [activeTab, moduleStates]
  );

  const activeClinicalStageId = useMemo(() => {
    if (!activeModule) return 'visao_geral';
    return resolveClinicalStage(activeModule);
  }, [activeModule, resolveClinicalStage]);

  const activeClinicalStage = useMemo(
    () => stageSummaryById[activeClinicalStageId] || null,
    [activeClinicalStageId, stageSummaryById]
  );

  const nextPendingModule = useMemo(
    () => moduleStates.find((item) => item.status !== 'finalizada') || null,
    [moduleStates]
  );

  const stageTabs = useMemo(() => {
    const overviewStage = {
      id: 'visao_geral',
      label: 'Visão geral',
      description: 'Panorama clínico da sessão e próximos passos',
      total: progress.total,
      finalized: progress.finalized
    };
    return [overviewStage, ...stageSummaries];
  }, [progress.finalized, progress.total, stageSummaries]);

  const sidebarModuleGroups = useMemo(() => (
    stageSummaries
      .filter((stage) => stage.modules.length > 0)
      .map((stage) => ({
        group: stage.label,
        items: stage.modules
      }))
  ), [stageSummaries]);

  const moduleById = useMemo(() => moduleStates.reduce((acc, item) => {
    acc[item.id] = item;
    return acc;
  }, {}), [moduleStates]);

  const moduleIdByType = useMemo(() => moduleStates.reduce((acc, item) => {
    const typeKey = normalizeType(item.tipo);
    if (typeKey && !acc[typeKey]) {
      acc[typeKey] = item.id;
    }
    return acc;
  }, {}), [moduleStates, normalizeType]);

  const sortedHistory = useMemo(() => {
    return [...evaluationHistory].sort((a, b) => {
      const aDate = getRecordDate(a) || 0;
      const bDate = getRecordDate(b) || 0;
      return bDate - aDate;
    });
  }, [evaluationHistory, getRecordDate]);

  const currentSessionId = useMemo(() => {
    const pinnedSessionId = isNewSessionMode ? String(activeSessionId || '').trim() : '';
    if (pinnedSessionId) return pinnedSessionId;

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
  }, [activeSessionId, getRecordDate, isNewSessionMode, sortedHistory]);

  const workingSessionHistory = useMemo(() => {
    const normalizedSessionId = String(currentSessionId || '').trim();
    if (normalizedSessionId) {
      return sortedHistory.filter((item) => String(item?.sessaoId || '').trim() === normalizedSessionId);
    }
    return isNewSessionMode ? [] : sortedHistory;
  }, [currentSessionId, isNewSessionMode, sortedHistory]);

  const triagemRedsSnapshot = useMemo(() => {
    const fromGrouped = moduleSnapshots[normalizeType('triagem_reds')] || null;
    if (fromGrouped) return fromGrouped;
    return workingSessionHistory.find((item) => normalizeType(item?.tipo) === 'triagem_reds') || null;
  }, [moduleSnapshots, normalizeType, workingSessionHistory]);

  const triagemRedsClassificacao = useMemo(
    () => resolveTriagemRedsClassificacao(triagemRedsSnapshot),
    [triagemRedsSnapshot]
  );

  const shouldWarnRedsPrescricao = triagemRedsClassificacao === 'reds_estabelecido';

  const hasOpenSessionDrafts = useMemo(() => (
    sortedHistory.some((item) => {
      const status = String(item?.status || '').toLowerCase();
      return Boolean(item?.sessaoId) && status !== 'finalizada';
    })
  ), [sortedHistory]);

  const hasFinalizedEvaluationHistory = useMemo(() => (
    sortedHistory.some((item) => String(item?.status || '').toLowerCase() === 'finalizada')
  ), [sortedHistory]);

  const condutaContext = useMemo(() => {
    const latestExames = resolveLatestSnapshotByType({
      moduleSnapshots,
      sortedHistory: workingSessionHistory,
      tipo: 'exames_laboratoriais',
      currentSessionId,
      normalizeType
    });
    const latestEvolucao = resolveLatestSnapshotByType({
      moduleSnapshots,
      sortedHistory: workingSessionHistory,
      tipo: 'evolucao_retorno',
      currentSessionId,
      normalizeType
    });

    const examesStatus = resolveFirstToken([
      latestExames?.resultados?.output?.statusPainel,
      latestExames?.dados?.classificacoes?.statusPainel,
      latestExames?.classificacaoLabel,
      latestExames?.classificacao
    ]);
    const evolucaoPrioridade = resolveFirstToken([
      latestEvolucao?.resultados?.prioridade_cuidado,
      latestEvolucao?.resultados?.output?.prioridadeRetorno,
      latestEvolucao?.dados?.classificacoes?.prioridadeRetorno,
      latestEvolucao?.classificacaoLabel,
      latestEvolucao?.classificacao
    ]);
    const evolucaoScore = toNumericValue(
      latestEvolucao?.resultados?.score_adesao_geral
      ?? latestEvolucao?.dados?.resultados_calculados?.scoreAdesaoGeral
      ?? latestEvolucao?.dados?.resultados_calculados?.score_adesao_geral
    );
    const metasAtivas = resolveCondutaGoalsCount(latestEvolucao);
    const redsOverrideCount = Array.isArray(triagemRedsSnapshot?.dados?.overrides?.prescricaoDieta)
      ? triagemRedsSnapshot.dados.overrides.prescricaoDieta.length
      : 0;
    const redsReviewed = !shouldWarnRedsPrescricao || redsOverrideCount > 0;

    const examesReady = Boolean(latestExames?.id);
    const evolucaoReady = Boolean(latestEvolucao?.id);
    const readyForPlano = examesReady && evolucaoReady && redsReviewed;

    const checklist = [
      { id: 'exames', label: 'Exames laboratoriais registrados', done: examesReady },
      { id: 'evolucao', label: 'Evolução e retorno registrados', done: evolucaoReady },
      { id: 'metas', label: 'Metas clínicas registradas na evolução', done: metasAtivas > 0 },
      {
        id: 'reds',
        label: shouldWarnRedsPrescricao
          ? 'Risco RED-S revisado para conduta'
          : 'Risco RED-S sem bloqueio para conduta',
        done: redsReviewed
      }
    ];

    const pendingCount = checklist.filter((item) => !item.done).length;
    const tone = readyForPlano ? 'success' : (shouldWarnRedsPrescricao && !redsReviewed ? 'danger' : 'warning');
    const statusLabel = readyForPlano
      ? 'Conduta pronta para plano alimentar'
      : `${pendingCount} pendência(s) para fechar conduta`;

    return {
      latestExames,
      latestEvolucao,
      examesReady,
      evolucaoReady,
      metasAtivas,
      redsReviewed,
      redsOverrideCount,
      readyForPlano,
      examesStatus,
      evolucaoPrioridade,
      evolucaoScore,
      checklist,
      hasAnyData: examesReady || evolucaoReady || metasAtivas > 0,
      pendingCount,
      tone,
      statusLabel
    };
  }, [
    currentSessionId,
    moduleSnapshots,
    normalizeType,
    shouldWarnRedsPrescricao,
    triagemRedsSnapshot,
    workingSessionHistory
  ]);

  const crossLayerInconsistencies = useMemo(() => {
    const signals = [];
    const latestGet = resolveLatestSnapshotByType({
      moduleSnapshots,
      sortedHistory: workingSessionHistory,
      tipo: 'gasto_energetico_total',
      currentSessionId,
      normalizeType
    });
    const latestAlimentar = resolveLatestSnapshotByType({
      moduleSnapshots,
      sortedHistory: workingSessionHistory,
      tipo: 'alimentar',
      currentSessionId,
      normalizeType
    });
    const latestBia = resolveLatestSnapshotByType({ moduleSnapshots, sortedHistory: workingSessionHistory, tipo: 'bioimpedancia', currentSessionId, normalizeType });
    const latestDobras = resolveLatestSnapshotByType({ moduleSnapshots, sortedHistory: workingSessionHistory, tipo: 'dobras_cutaneas', currentSessionId, normalizeType });
    const latestComposicao = (() => {
      if (!latestBia?.id) return latestDobras;
      if (!latestDobras?.id) return latestBia;
      return new Date(latestBia.createdAt || 0) >= new Date(latestDobras.createdAt || 0) ? latestBia : latestDobras;
    })();
    const latestEvolucao = resolveLatestSnapshotByType({
      moduleSnapshots,
      sortedHistory: workingSessionHistory,
      tipo: 'evolucao_retorno',
      currentSessionId,
      normalizeType
    });
    const latestReds = triagemRedsSnapshot || resolveLatestSnapshotByType({
      moduleSnapshots,
      sortedHistory: workingSessionHistory,
      tipo: 'triagem_reds',
      currentSessionId,
      normalizeType
    });
    const latestExames = resolveLatestSnapshotByType({
      moduleSnapshots,
      sortedHistory: workingSessionHistory,
      tipo: 'exames_laboratoriais',
      currentSessionId,
      normalizeType
    });

    const redsClassificacao = resolveTriagemRedsClassificacao(latestReds);
    if (latestReds?.id && !redsClassificacao) {
      signals.push({
        id: 'reds-no-classification',
        tone: 'danger',
        title: 'Triagem RED-S sem classificação final',
        message: 'O módulo RED-S foi salvo sem classificação de DE. Revise cálculo e persistência do resultado.',
        targetType: 'triagem_reds'
      });
    }

    const redsNeeds = resolveStringArray([
      latestReds?.resultados?.precisaDadosExtras,
      latestReds?.dados?.precisaDadosExtras,
      latestReds?.dados?.dados_brutos?.precisaDadosExtras
    ]);
    if (latestReds?.id && redsNeeds.length > 0) {
      const reconciledModules = redsNeeds.filter((tipo) => {
        const state = moduleStates.find((item) => item.tipo === normalizeType(tipo));
        return state?.status === 'finalizada';
      });
      if (reconciledModules.length > 0) {
        signals.push({
          id: 'reds-needs-extras-with-finalized',
          tone: 'warning',
          title: 'RED-S ainda pede dados já finalizados',
          message: `Pendência RED-S para ${reconciledModules.join(', ')} mesmo após finalização do(s) módulo(s).`,
          targetType: 'triagem_reds'
        });
      }
    }

    const getWeekly = resolveNumericFromPaths(latestGet, [
      'resultados.gastoExercicioSemanal',
      'resultados.gastoExercicioSemanalKcal',
      'resultados.calculated.totalGastoSemanalKcal',
      'dados.resultados_calculados.totalGastoSemanalKcal',
      'dados.esportivo.totalGastoSemanalKcal'
    ]);
    const getRows = resolveArrayFromPaths(latestGet, [
      'dados.esportivo.registroAtividadesSemana',
      'dados.dados_brutos.esportivo.registroAtividadesSemana',
      'dados.input.esportivo.registroAtividadesSemana'
    ]);
    const getRowsFilled = getRows.filter((row) => {
      const met = toNumericValue(row?.metValue ?? row?.met_value);
      const duracao = toNumericValue(row?.duracaoHoras ?? row?.duracao_horas);
      return Number.isFinite(met) && Number.isFinite(duracao) && duracao > 0;
    }).length;
    if (latestGet?.id && getRowsFilled >= 3 && !Number.isFinite(getWeekly)) {
      signals.push({
        id: 'get-weekly-missing',
        tone: 'warning',
        title: 'GET sem total semanal consistente',
        message: 'Há atividades semanais preenchidas, mas o total energético semanal não foi consolidado.',
        targetType: 'gasto_energetico_total'
      });
    }

    const alimentarKcal = resolveNumericFromPaths(latestAlimentar, [
      'resultados.caloriasTotal',
      'resultados.totalDiario',
      'resultados.calculated.totalDiario',
      'dados.totalDiario',
      'dados.total_diario'
    ]);
    const redsIngestaoAuto = resolveNumericFromPaths(latestReds, [
      'dados.ingestaoKcalR24hAuto',
      'resultados.calculated.ingestaoKcalR24hAuto'
    ]);
    if (latestAlimentar?.id && latestReds?.id && Number.isFinite(alimentarKcal) && !Number.isFinite(redsIngestaoAuto)) {
      signals.push({
        id: 'reds-ingestao-not-linked',
        tone: 'warning',
        title: 'RED-S sem ingestão automática da Alimentar',
        message: 'A avaliação alimentar possui calorias totais, mas a triagem RED-S não refletiu o valor automático.',
        targetType: 'triagem_reds'
      });
    }

    const massaMagraOficial = resolveNumericFromPaths(latestComposicao, [
      'resultados.massaMagra',
      'resultados.massaMagraKg',
      'resultados.calculated.massaMagra',
      'dados.massaMagra',
      'dados.massa_magra',
      'dados.massaMagraKg'
    ]);
    const redsMassaMagraAuto = resolveNumericFromPaths(latestReds, [
      'dados.massaMagraKgAuto',
      'resultados.calculated.massaMagraKgAuto'
    ]);
    if (latestComposicao?.id && latestReds?.id && Number.isFinite(massaMagraOficial) && !Number.isFinite(redsMassaMagraAuto)) {
      signals.push({
        id: 'reds-masslean-not-linked',
        tone: 'warning',
        title: 'RED-S sem massa magra automática',
        message: 'Bioimpedância ou Dobras Cutâneas já têm massa magra calculada, mas a triagem RED-S não consumiu esse dado.',
        targetType: 'triagem_reds'
      });
    }

    if (condutaContext.readyForPlano && condutaContext.metasAtivas === 0) {
      signals.push({
        id: 'conduta-no-goals',
        tone: 'warning',
        title: 'Plano liberado sem metas clínicas',
        message: 'A conduta foi marcada como pronta sem metas explícitas na evolução/retorno.',
        targetType: 'evolucao_retorno'
      });
    }

    if (
      condutaContext.readyForPlano
      && Number.isFinite(condutaContext.evolucaoScore)
      && condutaContext.evolucaoScore < 60
      && latestEvolucao?.id
    ) {
      signals.push({
        id: 'conduta-low-adherence',
        tone: 'warning',
        title: 'Plano liberado com adesão baixa',
        message: `Score de adesão em ${Math.round(condutaContext.evolucaoScore)}%. Reavalie estratégia antes da prescrição.`,
        targetType: 'evolucao_retorno'
      });
    }

    if (latestExames?.id) {
      const analitos = Array.isArray(latestExames?.dados?.analitos) ? latestExames.dados.analitos : [];
      const alterados = analitos.filter((a) => String(a?.status || '') === 'alterado').map((a) => String(a?.nome || '')).filter(Boolean);
      const limitrofes = analitos.filter((a) => String(a?.status || '') === 'limitrofe').map((a) => String(a?.nome || '')).filter(Boolean);
      if (alterados.length > 0) {
        signals.push({
          id: 'exames-laboratoriais-alterados',
          tone: 'danger',
          title: `${alterados.length} exame(s) fora da referência`,
          message: `Alterações: ${alterados.slice(0, 3).join(', ')}${alterados.length > 3 ? ` +${alterados.length - 3} mais` : ''}.`,
          targetType: 'exames_laboratoriais'
        });
      } else if (limitrofes.length > 0) {
        signals.push({
          id: 'exames-laboratoriais-limitrofes',
          tone: 'warning',
          title: `${limitrofes.length} exame(s) limítrofe(s)`,
          message: `Valores limítrofes: ${limitrofes.slice(0, 3).join(', ')}.`,
          targetType: 'exames_laboratoriais'
        });
      }
    }

    const kcalAlimentar = resolveNumericFromPaths(latestAlimentar, [
      'resultados.caloriasTotal', 'resultados.totalDiario', 'resultados.energiaKcal',
      'dados.caloriasTotal', 'dados.totalDiario'
    ]);
    const getEstimado = resolveNumericFromPaths(latestGet, [
      'dados.resultados_calculados.getEstimadoKcal',
      'resultados.get_estimado_kcal', 'resultados.getEstimadoKcal',
      'dados.getEstimadoKcal'
    ]);
    if (latestAlimentar?.id && latestGet?.id && Number.isFinite(kcalAlimentar) && Number.isFinite(getEstimado)) {
      const balanco = Math.round(kcalAlimentar - getEstimado);
      if (balanco < -500) {
        signals.push({
          id: 'balanco-energetico-deficit',
          tone: 'danger',
          title: 'Déficit energético elevado',
          message: `Ingestão ${Math.round(kcalAlimentar)} kcal vs GET ${Math.round(getEstimado)} kcal — déficit de ${Math.abs(balanco)} kcal.`,
          targetType: 'alimentar'
        });
      } else if (balanco > 500) {
        signals.push({
          id: 'balanco-energetico-surplus',
          tone: 'warning',
          title: 'Superávit energético elevado',
          message: `Ingestão ${Math.round(kcalAlimentar)} kcal vs GET ${Math.round(getEstimado)} kcal — superávit de ${balanco} kcal.`,
          targetType: 'gasto_energetico_total'
        });
      }
    }

    return signals.slice(0, 8);
  }, [
    condutaContext.evolucaoScore,
    condutaContext.metasAtivas,
    condutaContext.readyForPlano,
    currentSessionId,
    moduleSnapshots,
    moduleStates,
    normalizeType,
    triagemRedsSnapshot,
    workingSessionHistory
  ]);

  const moduleSmartStatus = useMemo(() => {
    const issueCountByType = crossLayerInconsistencies.reduce((acc, issue) => {
      const typeKey = normalizeType(issue?.targetType || '');
      if (!typeKey) return acc;
      acc[typeKey] = (acc[typeKey] || 0) + 1;
      return acc;
    }, {});

    const byId = {};
    const counts = {
      completo: 0,
      precisa_atencao: 0,
      pendente: 0
    };

    moduleStates.forEach((module) => {
      const issueCount = issueCountByType[module.tipo] || 0;
      let key = 'pendente';
      if (module.status === 'pendente') {
        key = 'pendente';
      } else if (issueCount > 0 || module.status === 'rascunho') {
        key = 'precisa_atencao';
      } else {
        key = 'completo';
      }

      counts[key] += 1;
      byId[module.id] = {
        key,
        tone: key === 'completo' ? 'success' : key === 'precisa_atencao' ? 'warning' : 'neutral',
        label: key === 'completo' ? 'Completo' : key === 'precisa_atencao' ? 'Precisa atenção' : 'Pendente',
        issueCount
      };
    });

    const attentionModules = moduleStates
      .filter((module) => byId[module.id]?.key === 'precisa_atencao')
      .map((module) => ({
        id: module.id,
        tipo: module.tipo,
        label: module.label,
        issueCount: byId[module.id]?.issueCount || 0
      }));

    return { byId, counts, attentionModules };
  }, [crossLayerInconsistencies, moduleStates, normalizeType]);

  const balancoEnergetico = useMemo(() => {
    const alimentarSnap = moduleSnapshots[normalizeType('alimentar')];
    const getSnap = moduleSnapshots[normalizeType('gasto_energetico_total')];
    const kcalIngerida = resolveNumericFromPaths(alimentarSnap, [
      'resultados.caloriasTotal', 'resultados.totalDiario', 'resultados.energiaKcal',
      'dados.caloriasTotal', 'dados.totalDiario'
    ]);
    const getEstimado = resolveNumericFromPaths(getSnap, [
      'dados.resultados_calculados.getEstimadoKcal',
      'resultados.get_estimado_kcal', 'resultados.getEstimadoKcal',
      'dados.getEstimadoKcal'
    ]);
    if (!Number.isFinite(kcalIngerida) || !Number.isFinite(getEstimado)) return null;
    const balanco = Math.round(kcalIngerida - getEstimado);
    return {
      kcalIngerida: Math.round(kcalIngerida),
      getEstimado: Math.round(getEstimado),
      balanco,
      tone: Math.abs(balanco) <= 200 ? 'success' : Math.abs(balanco) <= 500 ? 'warning' : 'danger',
      label: balanco >= 0 ? `+${balanco} kcal superávit` : `${balanco} kcal déficit`
    };
  }, [moduleSnapshots, normalizeType]);

  const examesInsights = useMemo(() => {
    const snap = moduleSnapshots[normalizeType('exames_laboratoriais')];
    if (!snap?.id) return null;
    const analitos = Array.isArray(snap?.dados?.analitos) ? snap.dados.analitos : [];
    const alterados = analitos.filter((a) => String(a?.status || '') === 'alterado').map((a) => String(a?.nome || '')).filter(Boolean);
    const limitrofes = analitos.filter((a) => String(a?.status || '') === 'limitrofe').map((a) => String(a?.nome || '')).filter(Boolean);
    if (!alterados.length && !limitrofes.length) return null;
    return { alterados, limitrofes };
  }, [moduleSnapshots, normalizeType]);

  const normalizedUserRole = useMemo(() => normalizeRole(user?.role), [user?.role]);
  const currentUserId = user?.uid || user?.id || '';
  const hasEvaluationManagerRole = useMemo(
    () => EVALUATION_MANAGER_ROLES.has(normalizedUserRole),
    [normalizedUserRole]
  );
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
    () => hasEvaluationManagerRole || (
      isStudentMemberRole(normalizedUserRole) && (isPatientResponsible || isPatientTeamMember)
    ),
    [hasEvaluationManagerRole, isPatientResponsible, isPatientTeamMember, normalizedUserRole]
  );
  const canStartNewSession = canManagePatientFlow
    && !isNewSessionMode
    && hasFinalizedEvaluationHistory
    && !hasOpenSessionDrafts;

  const handleStartNewSession = useCallback(() => {
    if (!canStartNewSession) return;
    setIsNewSessionMode(true);
    setActiveSessionId('');
    setModuleSnapshots({});
    setDraftIds({});
    setActiveTab(MODULE_CONFIG[0]?.id || 'anamnese-inicial');
    notify({
      type: 'success',
      title: 'Nova sessão iniciada',
      message: 'As avaliações finalizadas anteriores continuam no histórico. Esta tela agora registra uma nova sessão.'
    });
  }, [canStartNewSession, notify]);

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

  const onboardingContext = useMemo(() => {
    const onboardingRoot = patient?.confirmacaoAtleta
      && typeof patient.confirmacaoAtleta === 'object'
      && !Array.isArray(patient.confirmacaoAtleta)
      ? patient.confirmacaoAtleta
      : {};
    const onboardingData = onboardingRoot?.dados
      && typeof onboardingRoot.dados === 'object'
      && !Array.isArray(onboardingRoot.dados)
      ? onboardingRoot.dados
      : {};

    const modalidadePrincipal = getTextValue(
      patient?.modalidadePrincipal
      || patient?.modalidade
      || onboardingData?.atividadeFisica
    );
    const frequenciaSemanalRaw = patient?.frequenciaSemanal ?? onboardingData?.frequenciaSemanal;
    const duracaoSessaoRaw = patient?.duracaoSessao ?? onboardingData?.duracaoSessao;
    const frequenciaSemanal = hasValue(frequenciaSemanalRaw) && Number.isFinite(Number(frequenciaSemanalRaw))
      ? Number(frequenciaSemanalRaw)
      : null;
    const duracaoSessao = hasValue(duracaoSessaoRaw) && Number.isFinite(Number(duracaoSessaoRaw))
      ? Number(duracaoSessaoRaw)
      : null;
    const genero = getTextValue(patient?.genero || patient?.sexo || onboardingData?.sexoBiologico);
    const status = getTextValue(patient?.status || onboardingRoot?.status);
    const observacoesIniciais = getTextValue(
      patient?.observacoes
      || onboardingData?.observacoes
      || onboardingData?.motivoAtendimento
    );
    const historicoSaude = getTextValue(
      patient?.historicoSaude
      || onboardingData?.historicoSaude
      || onboardingData?.diagnosticosPessoais
    );
    const comorbidadesPessoais = getListValue(
      patient?.comorbidadesPessoais ?? onboardingData?.comorbidadesPessoais
    );
    const comorbidadesFamiliares = getListValue(
      patient?.comorbidadesFamiliares ?? onboardingData?.comorbidadesFamiliares
    );

    const contractValues = {
      modalidadePrincipal,
      frequenciaSemanal: frequenciaSemanalRaw,
      duracaoSessao: duracaoSessaoRaw,
      genero,
      status,
      observacoesIniciais
    };

    const contractStatus = ONBOARDING_CONTRACT_FIELDS.map((field) => ({
      ...field,
      value: contractValues[field.key],
      filled: hasValue(contractValues[field.key])
    }));
    const missingContractFields = contractStatus.filter((field) => !field.filled);

    const nextFieldStatus = ONBOARDING_NEXT_FIELDS.map((field) => ({
      ...field,
      value: onboardingData[field.key],
      filled: hasValue(onboardingData[field.key])
    }));
    const missingNextFieldLabels = nextFieldStatus
      .filter((field) => !field.filled)
      .map((field) => field.label);

    return {
      modalidadePrincipal,
      frequenciaSemanal,
      duracaoSessao,
      genero,
      status,
      observacoesIniciais,
      historicoSaude,
      comorbidadesPessoais,
      comorbidadesFamiliares,
      raw: onboardingData,
      contractStatus,
      missingContractFields,
      nextFieldStatus,
      missingNextFieldLabels
    };
  }, [
    patient?.comorbidadesFamiliares,
    patient?.comorbidadesPessoais,
    patient?.confirmacaoAtleta,
    patient?.duracaoSessao,
    patient?.frequenciaSemanal,
    patient?.genero,
    patient?.historicoSaude,
    patient?.modalidade,
    patient?.modalidadePrincipal,
    patient?.observacoes,
    patient?.sexo,
    patient?.status
  ]);

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
      {
        label: 'Status inteligente',
        value: activeModule ? (moduleSmartStatus.byId[activeModule.id]?.label || 'Pendente') : 'Não informado'
      },
      { label: 'Responsável', value: responsible },
      { label: 'Data', value: moduleDate ? formatDate(moduleDate) : 'Não informada' },
      {
        label: 'Completude',
        value: `${progress.completion}% (${progress.finalized}/${progress.total} módulos finalizados)`
      },
      {
        label: 'Contexto esportivo',
        value: onboardingContext.modalidadePrincipal
          ? `${onboardingContext.modalidadePrincipal} · ${onboardingContext.frequenciaSemanal || '-'}x/sem`
          : 'Onboarding pendente'
      },
      { label: 'Projeto', value: patient?.projetoNome || 'Não vinculado' },
      { label: 'Última atualização', value: overallLastUpdatedAt ? formatDate(overallLastUpdatedAt) : 'Não informada' }
    ];
  }, [
    activeModule,
    formatDate,
    getRecordDate,
    onboardingContext.frequenciaSemanal,
    onboardingContext.modalidadePrincipal,
    overallLastUpdatedAt,
    moduleSmartStatus.byId,
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
      const payloadSessionId = avaliacao?.sessaoId || currentSessionId || undefined;
      const payload = {
        ...attachSharedAnthropometryToPayload(avaliacao),
        tipo,
        pacienteId: id,
        projetoId: patient?.projetoId || null,
        projetoNome: patient?.projetoNome || '',
        sessaoId: payloadSessionId,
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

      const refreshedRows = await loadEvaluationContext();
      if (isNewSessionMode) {
        const savedRow = Array.isArray(refreshedRows)
          ? refreshedRows.find((item) => String(item?.id || '') === String(savedId || ''))
          : null;
        const nextSessionId = String(savedRow?.sessaoId || payloadSessionId || '').trim();
        if (nextSessionId) setActiveSessionId(nextSessionId);
      }
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
    currentSessionId,
    isNewSessionMode
  ]);

  const handleAutoSave = useCallback(async (avaliacao) => {
    if (!avaliacao?.tipo || !podeEditar) return;
    setAutoSaveError('');
    try {
      const tipo = normalizeType(avaliacao.tipo);
      const payloadSessionId = avaliacao?.sessaoId || currentSessionId || undefined;
      const payload = {
        ...attachSharedAnthropometryToPayload(avaliacao),
        tipo,
        pacienteId: id,
        projetoId: patient?.projetoId || null,
        projetoNome: patient?.projetoNome || '',
        sessaoId: payloadSessionId,
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
      if (isNewSessionMode && !existingDraftId) {
        const refreshedRows = await loadEvaluationContext();
        const savedRow = Array.isArray(refreshedRows)
          ? refreshedRows.find((item) => String(item?.id || '') === String(savedId || ''))
          : null;
        const nextSessionId = String(savedRow?.sessaoId || payloadSessionId || '').trim();
        if (nextSessionId) setActiveSessionId(nextSessionId);
      }
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
    currentSessionId,
    isNewSessionMode,
    loadEvaluationContext
  ]);

  const registerRedsPrescricaoOverride = useCallback(async () => {
    if (!triagemRedsSnapshot?.id) {
      notify({
        type: 'error',
        title: 'Override nao registrado',
        message: 'A triagem RED-S precisa estar salva para registrar o override de prescricao.'
      });
      return false;
    }

    const previousDados = triagemRedsSnapshot?.dados
      && typeof triagemRedsSnapshot.dados === 'object'
      && !Array.isArray(triagemRedsSnapshot.dados)
      ? triagemRedsSnapshot.dados
      : {};
    const previousOverrides = previousDados?.overrides
      && typeof previousDados.overrides === 'object'
      && !Array.isArray(previousDados.overrides)
      ? previousDados.overrides
      : {};
    const existingPrescricaoOverrides = Array.isArray(previousOverrides.prescricaoDieta)
      ? previousOverrides.prescricaoDieta
      : [];
    const nowIso = new Date().toISOString();
    const nextOverride = {
      triggeredAt: nowIso,
      classificacaoDE: triagemRedsClassificacao,
      actorId: user?.uid || user?.id || null,
      actorName: user?.name || user?.nome || user?.email || 'Equipe',
      reason: 'prescricao_dieta_override_reds_estabelecido'
    };
    const nextDados = {
      ...previousDados,
      overrides: {
        ...previousOverrides,
        prescricaoDieta: [...existingPrescricaoOverrides, nextOverride]
      }
    };

    try {
      await api.patch(`/avaliacoes/${triagemRedsSnapshot.id}`, {
        dados: nextDados
      });

      setModuleSnapshots((prev) => {
        const key = normalizeType('triagem_reds');
        const current = prev[key] || {};
        return {
          ...prev,
          [key]: {
            ...current,
            ...triagemRedsSnapshot,
            dados: nextDados,
            updatedAt: nowIso
          }
        };
      });
      setEvaluationHistory((prev) => prev.map((item) => (
        item?.id === triagemRedsSnapshot.id
          ? { ...item, dados: nextDados, updatedAt: nowIso }
          : item
      )));
      return true;
    } catch (error) {
      notify({
        type: 'error',
        title: 'Falha ao registrar override',
        message: getApiErrorMessage(error, 'Nao foi possivel registrar o override de RED-S para prescricao.')
      });
      return false;
    }
  }, [
    normalizeType,
    notify,
    triagemRedsClassificacao,
    triagemRedsSnapshot,
    user?.email,
    user?.id,
    user?.name,
    user?.nome,
    user?.uid
  ]);

  const handleTabChange = useCallback(async (nextTabId) => {
    if (!nextTabId) return;
    const target = moduleById[nextTabId];
    if (!target) {
      setActiveTab(nextTabId);
      return;
    }

    const targetType = normalizeType(target.tipo || '');
    const isPrescricaoModule = targetType === 'prescricao_dieta';
    if (isPrescricaoModule && shouldWarnRedsPrescricao) {
      const proceed = await confirm({
        title: 'Alerta RED-S — Disponibilidade Energética Crítica',
        message: REDS_PRESCRICAO_WARNING,
        confirmLabel: 'Prosseguir mesmo assim',
        cancelLabel: 'Cancelar',
        variant: 'danger'
      });
      if (!proceed) return;
      const overrideRegistered = await registerRedsPrescricaoOverride();
      if (!overrideRegistered) return;
    }

    setActiveTab(nextTabId);
  }, [
    confirm,
    moduleById,
    normalizeType,
    registerRedsPrescricaoOverride,
    shouldWarnRedsPrescricao
  ]);

  const openModuleById = useCallback((nextTabId) => {
    if (!nextTabId) return;
    void handleTabChange(nextTabId);
  }, [handleTabChange]);

  const openModuleByType = useCallback((tipo) => {
    const typeKey = normalizeType(tipo);
    const targetModuleId = moduleIdByType[typeKey];
    if (!targetModuleId) return;
    void handleTabChange(targetModuleId);
  }, [handleTabChange, moduleIdByType, normalizeType]);

  const handleModuleShortcutClick = useCallback((event) => {
    const targetModuleId = event.currentTarget.dataset.moduleId;
    if (!targetModuleId) return;
    void handleTabChange(targetModuleId);
  }, [handleTabChange]);

  const handleIssueShortcutClick = useCallback((event) => {
    const targetType = event.currentTarget.dataset.targetType;
    if (!targetType) return;
    openModuleByType(targetType);
  }, [openModuleByType]);

  const activeTabIndex = useMemo(
    () => moduleStates.findIndex((item) => item.id === activeTab),
    [activeTab, moduleStates]
  );

  const getStageTargetModule = useCallback((stageId) => {
    if (stageId === 'visao_geral') {
      return nextPendingModule || moduleStates[0] || null;
    }
    const stage = stageSummaryById[stageId];
    if (!stage?.modules?.length) return null;
    return stage.modules.find((module) => module.status !== 'finalizada') || stage.modules[0];
  }, [moduleStates, nextPendingModule, stageSummaryById]);

  const handleStageTabChange = useCallback((stageId) => {
    if (stageId === 'visao_geral') {
      setActiveTab('visao_geral');
      return;
    }
    const targetModule = getStageTargetModule(stageId);
    if (!targetModule?.id) return;
    void handleTabChange(targetModule.id);
  }, [getStageTargetModule, handleTabChange]);

  const handleStageTabButtonClick = useCallback((event) => {
    const stageId = event.currentTarget.dataset.stageId;
    if (!stageId) return;
    handleStageTabChange(stageId);
  }, [handleStageTabChange]);

  const handleGoBack = useCallback(() => {
    navigate(returnToPath, { state: returnState });
  }, [navigate, returnState, returnToPath]);

  const handleReloadEvaluationContext = useCallback(() => {
    void loadEvaluationContext();
  }, [loadEvaluationContext]);

  const handlePrintPage = useCallback(() => {
    window.print();
  }, []);

  const handleOpenPlanoAlimentar = useCallback(async () => {
    if (!id) return;

    if (shouldWarnRedsPrescricao) {
      const proceed = await confirm({
        title: 'Alerta RED-S — Disponibilidade Energética Crítica',
        message: REDS_PRESCRICAO_WARNING,
        confirmLabel: 'Abrir plano mesmo assim',
        cancelLabel: 'Cancelar',
        variant: 'danger'
      });
      if (!proceed) return;
      const overrideRegistered = await registerRedsPrescricaoOverride();
      if (!overrideRegistered) return;
    }

    navigate(`/planos-alimentares/${id}`, {
      state: {
        returnTo: returnToPath,
        returnView: returnState.returnView,
        returnTab: returnState.returnTab
      }
    });
  }, [
    confirm,
    id,
    navigate,
    registerRedsPrescricaoOverride,
    returnToPath,
    returnState.returnTab,
    returnState.returnView,
    shouldWarnRedsPrescricao
  ]);

  const handleNextStepAction = useCallback((step) => {
    if (!step?.action) return;
    if (step.action === 'open-anamnese') {
      openModuleByType('anamnese_inicial');
      return;
    }
    if (step.action === 'open-next-pending' && step.targetModuleId) {
      openModuleById(step.targetModuleId);
      return;
    }
    if (step.action === 'open-smart-attention' && step.targetModuleId) {
      openModuleById(step.targetModuleId);
      return;
    }
    if (step.action === 'open-triagem-reds') {
      openModuleByType('triagem_reds');
      return;
    }
    if (step.action === 'open-exames') {
      openModuleByType('exames_laboratoriais');
      return;
    }
    if (step.action === 'open-evolucao') {
      openModuleByType('evolucao_retorno');
      return;
    }
    if (step.action === 'open-inconsistency' && step.targetModuleType) {
      openModuleByType(step.targetModuleType);
      return;
    }
    if (step.action === 'open-plano') {
      void handleOpenPlanoAlimentar();
    }
  }, [handleOpenPlanoAlimentar, openModuleById, openModuleByType]);

  const goToPreviousModule = useCallback(() => {
    if (activeTabIndex <= 0) return;
    void handleTabChange(moduleStates[activeTabIndex - 1].id);
  }, [activeTabIndex, handleTabChange, moduleStates]);

  const goToNextModule = useCallback(() => {
    if (activeTabIndex < 0 || activeTabIndex >= moduleStates.length - 1) return;
    void handleTabChange(moduleStates[activeTabIndex + 1].id);
  }, [activeTabIndex, handleTabChange, moduleStates]);

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

    const validationMessage = getModuleFinalizationBlocker({
      module: activeModule,
      patient
    });
    if (validationMessage) {
      notify({
        type: 'warning',
        title: 'Finalize pendências obrigatórias',
        message: validationMessage
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
    patient,
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
      onboardingContext,
      onAutoSave: handleAutoSave,
      baselineAnthropometry: sharedAnthropometryBaseline,
      lockSharedAnthropometry: true,
      moduleSnapshot: activeModule?.snapshot || null,
      currentSessionId: currentSessionId || undefined,
      moduleHistory: activeModuleTimeline,
      allEvaluationHistory: workingSessionHistory
    };

    switch (activeTab) {
      case 'bioimpedancia':
        return <BioimpedanciaForm {...formProps} />;
      case 'dobras-cutaneas':
        return <DobrasCutaneasForm {...formProps} />;
      case 'perimetros':
        return <PerimetrosCorporaisForm {...formProps} />;
      case 'gasto-energetico':
        return <GastoEnergeticoTotalForm {...formProps} />;
      case 'carga-treino':
        return <AvaliacaoCargaTreino {...formProps} />;
      case 'anamnese-inicial':
        return <AnamneseInicialForm {...formProps} />;
      case 'avaliacao-clinica':
        return <AvaliacaoClinicaForm {...formProps} />;
      case 'triagem-reds':
        return <AvaliacaoTriagemREDS {...formProps} />;
      case 'alimentar':
        return <AvaliacaoAlimentar {...formProps} />;
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
  const activeStageLabel = activeClinicalStage?.label || 'Visão geral';
  const activeStageProgressLabel = activeClinicalStage
    ? `${activeClinicalStage.finalized}/${activeClinicalStage.total || 0} módulos finalizados`
    : `${progress.finalized}/${progress.total} módulos finalizados`;
  const planCtaLabel = shouldWarnRedsPrescricao
    ? 'Plano alimentar com alerta RED-S'
    : 'Plano alimentar liberado para conduta';
  const activeStageHint = STAGE_SYNTHESIS_HINTS[activeClinicalStageId] || STAGE_SYNTHESIS_HINTS.visao_geral;

  const pendingModules = useMemo(
    () => moduleStates.filter((item) => item.status !== 'finalizada'),
    [moduleStates]
  );

  const clinicalAlerts = useMemo(() => {
    const alerts = [];
    if (crossLayerInconsistencies.length > 0) {
      const topIssue = crossLayerInconsistencies[0];
      alerts.push({
        id: 'cross-layer',
        tone: 'warning',
        title: 'Inconsistências entre módulos',
        message: `${crossLayerInconsistencies.length} inconsistência(s) cruzada(s) detectada(s) entre avaliação, cálculo e conduta.`,
        targetType: topIssue?.targetType || ''
      });
    }
    if (shouldWarnRedsPrescricao) {
      alerts.push({
        id: 'reds',
        tone: 'danger',
        title: 'Risco energético elevado',
        message: 'Triagem RED-S em estado estabelecido. Avalie conduta nutricional com cautela antes de prescrição hipocalórica.',
        targetType: 'triagem_reds'
      });
    }
    if (onboardingContext.missingContractFields.length > 0) {
      alerts.push({
        id: 'onboarding',
        tone: 'warning',
        title: 'Cadastro base incompleto',
        message: `${onboardingContext.missingContractFields.length} campo(s) do onboarding ainda não foram consolidados na sessão.`,
        targetType: 'anamnese_inicial'
      });
    }
    if (pendingModules.length > 0) {
      alerts.push({
        id: 'progress',
        tone: 'info',
        title: 'Sessão em andamento',
        message: `${pendingModules.length} módulo(s) ainda pendente(s) para fechamento completo da jornada clínica.`,
        targetType: nextPendingModule?.tipo || ''
      });
    } else {
      alerts.push({
        id: 'ready',
        tone: 'success',
        title: 'Jornada completa',
        message: 'Todos os módulos previstos nesta sessão foram finalizados.'
      });
    }
    return alerts.slice(0, 4);
  }, [
    crossLayerInconsistencies,
    nextPendingModule?.tipo,
    onboardingContext.missingContractFields.length,
    pendingModules.length,
    shouldWarnRedsPrescricao
  ]);

  const stageSynthesisItems = useMemo(() => {
    const stageModules = activeClinicalStage?.modules || [];
    const completed = stageModules.filter((item) => item.status === 'finalizada');
    const inDraft = stageModules.filter((item) => item.status === 'rascunho');
    const pending = stageModules.filter((item) => item.status === 'pendente');
    return {
      total: stageModules.length,
      completed: completed.length,
      inDraft: inDraft.length,
      pending: pending.length,
      completion: activeClinicalStage?.completion || 0,
      topCompleted: completed.slice(0, 3),
      topPending: pending.slice(0, 3)
    };
  }, [activeClinicalStage]);

  const nextSteps = useMemo(() => {
    const steps = [];
    if (onboardingContext.missingContractFields.length > 0) {
      steps.push({
        id: 'complete-onboarding',
        priority: 'high',
        label: 'Completar onboarding base',
        description: 'Atualizar os campos de cadastro essenciais para manter consistência entre avaliação e prontuário.',
        action: 'open-anamnese'
      });
    }
    if (crossLayerInconsistencies.length > 0) {
      const topIssue = crossLayerInconsistencies[0];
      steps.push({
        id: 'cross-layer-fix',
        priority: 'high',
        label: `Corrigir inconsistência: ${topIssue.title}`,
        description: topIssue.message,
        action: 'open-inconsistency',
        targetModuleType: topIssue.targetType
      });
    }
    if (moduleSmartStatus.attentionModules.length > 0) {
      const topAttention = moduleSmartStatus.attentionModules[0];
      steps.push({
        id: 'smart-status-attention',
        priority: 'medium',
        label: `Revisar módulo em atenção: ${topAttention.label}`,
        description: topAttention.issueCount > 0
          ? `${topAttention.issueCount} inconsistência(s) cruzada(s) vinculada(s) ao módulo.`
          : 'Módulo em rascunho que precisa fechamento para concluir a etapa.',
        action: 'open-smart-attention',
        targetModuleId: topAttention.id
      });
    }
    if (nextPendingModule) {
      steps.push({
        id: 'next-module',
        priority: 'medium',
        label: `Avançar para ${nextPendingModule.label}`,
        description: 'Seguir fluxo clínico da etapa atual e reduzir pendências operacionais.',
        action: 'open-next-pending',
        targetModuleId: nextPendingModule.id
      });
    }
    if (shouldWarnRedsPrescricao) {
      steps.push({
        id: 'reds-review',
        priority: 'high',
        label: 'Reavaliar risco RED-S antes da conduta',
        description: 'Registrar justificativa clínica e revisar disponibilidade energética.',
        action: 'open-triagem-reds'
      });
    }
    if (activeClinicalStageId === 'conduta' && !condutaContext.examesReady) {
      steps.push({
        id: 'conduta-exames',
        priority: 'high',
        label: 'Registrar exames laboratoriais',
        description: 'Consolidar o painel laboratorial para suportar a decisão clínica final.',
        action: 'open-exames'
      });
    }
    if (activeClinicalStageId === 'conduta' && !condutaContext.evolucaoReady) {
      steps.push({
        id: 'conduta-evolucao',
        priority: 'high',
        label: 'Registrar evolução e retorno',
        description: 'Definir resposta clínica, metas e prioridade de acompanhamento.',
        action: 'open-evolucao'
      });
    }
    if (activeClinicalStageId === 'conduta' && condutaContext.readyForPlano) {
      steps.push({
        id: 'conduta-plano',
        priority: 'low',
        label: 'Seguir para plano alimentar',
        description: 'Com conduta consolidada, prossiga para prescrição nutricional.',
        action: 'open-plano'
      });
    } else if (!nextPendingModule) {
      steps.push({
        id: 'plan-ready',
        priority: 'low',
        label: 'Abrir plano alimentar',
        description: 'Com sessão consolidada, seguir para prescrição e exportação de conduta.',
        action: 'open-plano'
      });
    }
    return steps.slice(0, 4);
  }, [
    activeClinicalStageId,
    condutaContext.evolucaoReady,
    condutaContext.examesReady,
    condutaContext.readyForPlano,
    crossLayerInconsistencies,
    moduleSmartStatus.attentionModules,
    nextPendingModule,
    onboardingContext.missingContractFields.length,
    shouldWarnRedsPrescricao
  ]);

  const nextStepById = useMemo(() => nextSteps.reduce((acc, step) => {
    acc[step.id] = step;
    return acc;
  }, {}), [nextSteps]);

  const handleNextStepButtonClick = useCallback((event) => {
    const stepId = event.currentTarget.dataset.stepId;
    if (!stepId) return;
    const step = nextStepById[stepId];
    if (!step) return;
    handleNextStepAction(step);
  }, [handleNextStepAction, nextStepById]);

  const stageModuleIndex = useMemo(() => {
    if (!activeClinicalStage?.modules?.length || !activeModule) return -1;
    return activeClinicalStage.modules.findIndex((m) => m.id === activeTab);
  }, [activeClinicalStage?.modules, activeModule, activeTab]);
  const stageModuleCount = activeClinicalStage?.modules?.length ?? moduleStates.length;

  return (
    <div className="avaliacao-completa" aria-busy={loadingHistory ? 'true' : undefined}>
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
          {canStartNewSession && (
            <button
              type="button"
              className="tab-btn tab-btn--secondary"
              onClick={handleStartNewSession}
            >
              Nova sessão
            </button>
          )}
          <button
            type="button"
            className="tab-btn tab-btn--primary avaliacao-header-plan-btn"
            onClick={handleOpenPlanoAlimentar}
            title={planCtaLabel}
          >
            Plano alimentar
          </button>
          {isNewSessionMode && (
            <span className="eval-status-badge eval-status-badge--andamento">
              <span className="eval-status-badge__dot" />
              Nova sessão
            </span>
          )}
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

      <nav className="avaliacao-stage-tabs" aria-label="Macroetapas da jornada clínica">
        {stageTabs.map((stage) => {
          const isActive = stage.id === activeClinicalStageId;
          const hasModules = (stage.total || 0) > 0;
          const pct = hasModules ? Math.round(((stage.finalized || 0) / stage.total) * 100) : 0;
          const isComplete = pct === 100;
          return (
            <button
              key={stage.id}
              type="button"
              className={`avaliacao-stage-tab ${isActive ? 'avaliacao-stage-tab--active' : ''} ${isComplete ? 'avaliacao-stage-tab--complete' : ''}`}
              onClick={handleStageTabButtonClick}
              title={stage.description}
              disabled={!hasModules}
              aria-current={isActive ? 'page' : undefined}
              aria-label={`${stage.label}: ${stage.finalized || 0} de ${stage.total || 0} módulos finalizados`}
              data-stage-id={stage.id}
              style={{ '--ac-stage-pct': `${pct}%` }}
            >
              <span className="avaliacao-stage-tab__title">{stage.label}</span>
              <span className="avaliacao-stage-tab__meta">
                {stage.finalized || 0}/{stage.total || 0}
              </span>
            </button>
          );
        })}
      </nav>

      {shouldWarnRedsPrescricao && (
        <div className="avaliacao-reds-banner" role="alert">
          <ShieldCheck size={16} />
          <span>Risco RED-S estabelecido — revise disponibilidade energética antes de prescrever.</span>
          <button type="button" className="tab-btn tab-btn--secondary" onClick={() => openModuleByType('triagem_reds')}>
            Revisar
          </button>
        </div>
      )}

      {(activeClinicalStageId === 'conduta' || condutaContext.hasAnyData) && (
        <section className="avaliacao-conduta-bridge" aria-label="Síntese de conduta clínica">
          <header className="avaliacao-conduta-bridge__header">
            <div>
              <h3>Prontidão para prescrição</h3>
              <p>Consolidação de exames, evolução, metas e prontidão para plano alimentar.</p>
            </div>
            <span className={`avaliacao-conduta-chip tone-${condutaContext.tone}`}>
              {condutaContext.statusLabel}
            </span>
          </header>

          <div className="avaliacao-conduta-grid">
            <article className="avaliacao-conduta-card">
              <small>Exames laboratoriais</small>
              <strong>{condutaContext.examesReady ? 'Registrado' : 'Pendente'}</strong>
              <span>{condutaContext.examesStatus || 'Sem classificação de painel'}</span>
            </article>
            <article className="avaliacao-conduta-card">
              <small>Evolução/retorno</small>
              <strong>{condutaContext.evolucaoReady ? 'Registrado' : 'Pendente'}</strong>
              <span>
                {condutaContext.evolucaoPrioridade || 'Sem prioridade definida'}
                {Number.isFinite(condutaContext.evolucaoScore) ? ` · Adesão ${Math.round(condutaContext.evolucaoScore)}%` : ''}
              </span>
            </article>
            <article className="avaliacao-conduta-card">
              <small>Metas clínicas</small>
              <strong>{condutaContext.metasAtivas}</strong>
              <span>{condutaContext.metasAtivas > 0 ? 'Meta(s) ativa(s) na evolução' : 'Nenhuma meta registrada'}</span>
            </article>
            <article className="avaliacao-conduta-card">
              <small>Plano alimentar</small>
              <strong>{condutaContext.readyForPlano ? 'Liberado' : 'Aguardando conduta'}</strong>
              <span>
                {shouldWarnRedsPrescricao
                  ? `RED-S exige revisão${condutaContext.redsOverrideCount ? ` (${condutaContext.redsOverrideCount} override)` : ''}`
                  : 'Sem bloqueio de risco RED-S'}
              </span>
            </article>
          </div>
        </section>
      )}

      {autoSaveError && (
        <div className="avaliacao-helper avaliacao-helper--error" role="alert" aria-live="assertive">
          <ShieldCheck size={18} />
          <p>{autoSaveError}</p>
        </div>
      )}

      {historyError && (
        <div className="avaliacao-helper avaliacao-helper--error" role="alert" aria-live="assertive">
          <ShieldCheck size={18} />
          <p>{historyError}</p>
          <button type="button" className="tab-btn tab-btn--secondary" onClick={handleReloadEvaluationContext}>
            <RefreshCw size={14} />
            Recarregar
          </button>
        </div>
      )}

      <div className="avaliacao-layout-grid">
        <aside className="avaliacao-sidebar" aria-label="Navegação de módulos">

          {/* Mini status — clica e abre painel */}
          <section className="avaliacao-sidebar-card avaliacao-sidebar-mini-status">
            <div className="sidebar-mini-status__row">
              <div className="sidebar-mini-status__progress">
                <strong>{progress.finalized}</strong>
                <span>/{progress.total}</span>
                <small>módulos</small>
              </div>
              {crossLayerInconsistencies.length > 0 && (
                <button
                  type="button"
                  className="sidebar-mini-status__alert-btn"
                  onClick={() => handleStageTabChange('visao_geral')}
                  title="Ver painel de monitoramento"
                >
                  {crossLayerInconsistencies.length} alerta{crossLayerInconsistencies.length !== 1 ? 's' : ''}
                </button>
              )}
            </div>
            <div className="sidebar-mini-status__bar">
              <div className="sidebar-mini-status__bar-fill" style={{ width: `${progress.completion}%` }} />
            </div>
          </section>

          <section className="avaliacao-sidebar-card avaliacao-sidebar-card--wide">
            <div className="avaliacao-sidebar-card__header">
              <h3>Módulos</h3>
              <span>{stageModuleIndex >= 0 ? stageModuleIndex + 1 : activeTabIndex + 1}/{stageModuleCount}</span>
            </div>
            {sidebarModuleGroups.length > 0 ? (
              <div className="avaliacao-module-groups">
                {sidebarModuleGroups.map((group) => (
                  <div key={group.group} className="avaliacao-module-group">
                    <p className="avaliacao-module-group__title">{group.group}</p>
                    <div className="avaliacao-module-group__list">
                      {group.items.map((module) => {
                        const dateLabel = getRelativeDateLabel(module.updatedAt);
                        const staleDays = module.updatedAt
                          ? Math.floor((Date.now() - new Date(module.updatedAt).getTime()) / 86400000)
                          : null;
                        const isStale = module.status !== 'pendente' && staleDays != null && staleDays > 30;
                        const keyMetric = getModuleKeyMetric(module.tipo, module.snapshot);
                        return (
                          <button
                            key={module.id}
                            type="button"
                            className={`avaliacao-module-btn ${module.id === activeTab ? 'active' : ''} status-${module.status}`}
                            onClick={handleModuleShortcutClick}
                            data-module-id={module.id}
                            title={module.label}
                            aria-label={module.label}
                            aria-current={module.id === activeTab ? 'page' : undefined}
                          >
                            <div className="avaliacao-module-btn__top">
                              <div className="avaliacao-module-btn__main">
                                <module.icon size={13} />
                                <span>{module.label}</span>
                              </div>
                              <div className="avaliacao-module-btn__right">
                                {dateLabel && (
                                  <span className={`avaliacao-module-btn__date${isStale ? ' stale' : ''}`}>
                                    {dateLabel}
                                  </span>
                                )}
                                {module.status === 'finalizada'
                                  ? <CheckCircle2 size={12} className="module-icon-finalizada" />
                                  : module.status === 'rascunho'
                                    ? <CircleDashed size={12} className="module-icon-rascunho" />
                                    : <Clock size={12} className="module-icon-pendente" />}
                              </div>
                            </div>
                            {keyMetric && (
                              <div className="avaliacao-module-btn__info">{keyMetric}</div>
                            )}
                            {module.id === activeTab && <span className="sr-only">Módulo ativo</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="avaliacao-sidebar-empty">Nenhum módulo configurado para esta etapa.</p>
            )}
          </section>

          <section className="avaliacao-sidebar-card avaliacao-sidebar-card--wide">
            <div className="avaliacao-sidebar-card__header">
              <h3>Histórico do módulo</h3>
              <span>{activeModuleTimeline.length}</span>
            </div>
            {activeModuleComparison?.previous && (
              <p className="avaliacao-sidebar-empty">
                Último registro: {formatDate(getRecordDate(activeModuleComparison.latest))} · anterior: {formatDate(getRecordDate(activeModuleComparison.previous))}
              </p>
            )}
            {activeModuleTimeline.length === 0 ? (
              <p className="avaliacao-sidebar-empty">Nenhum registro anterior para este módulo.</p>
            ) : (
              <div className="avaliacao-history-list">
                {activeModuleTimeline.slice(0, 6).map((item, index) => {
                  const itemDate = getRecordDate(item);
                  return (
                    <div key={item.id || index} className="avaliacao-history-item">
                      <div>
                        <strong>{itemDate ? formatDate(itemDate) : '—'}</strong>
                        <span>{item.createdByName || item.alunoNome || 'Equipe'}</span>
                      </div>
                      <span className={`module-status status-${String(item.status || 'pendente').toLowerCase()}`}>
                        {getEvaluationStatusLabel(item.status || 'pendente')}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="avaliacao-sidebar-card avaliacao-report-card">
            <div className="avaliacao-sidebar-card__header">
              <h3>Relatório</h3>
            </div>
            <p className="avaliacao-report-card__description">
              Período avaliado: {reportPeriodLabel}
            </p>
            <div className="avaliacao-report-card__meta">
              {summaryItems.slice(0, 4).map((item) => (
                <div key={item.label}>
                  <small>{item.label}</small>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
            <div className="avaliacao-report-card__actions">
              <button
                type="button"
                className="tab-btn tab-btn--primary"
                onClick={handleExportClinicalReportHtml}
              >
                <Download size={15} />
                Exportar HTML
              </button>
              <button
                type="button"
                className="tab-btn tab-btn--secondary"
                onClick={handleExportClinicalReportJson}
              >
                <FileText size={15} />
                Exportar JSON
              </button>
              <button
                type="button"
                className="tab-btn tab-btn--secondary"
                onClick={handleReloadEvaluationContext}
              >
                <RefreshCw size={15} />
                Atualizar dados
              </button>
              <button
                type="button"
                className="tab-btn tab-btn--secondary"
                onClick={handlePrintPage}
              >
                <Printer size={15} />
                Imprimir tela
              </button>
            </div>
            <p className="avaliacao-report-card__hint">Abra no navegador e salve como PDF.</p>
          </section>
        </aside>

        <section className="avaliacao-main">
          <div className="avaliacao-main-toolbar">
            <div className="avaliacao-main-toolbar__title">
              {activeTab !== 'visao_geral' && activeStageLabel && (
                <p className="avaliacao-module-breadcrumb">
                  {activeStageLabel}
                  <span aria-hidden="true"> / </span>
                  {stageModuleIndex >= 0 ? stageModuleIndex + 1 : activeTabIndex + 1} de {stageModuleCount}
                </p>
              )}
              <h3>{activeTab === 'visao_geral' ? 'Visão geral' : (activeModule ? activeModule.label : 'Módulo clínico')}</h3>
              <p>{activeTab === 'visao_geral' ? 'Panorama clínico da sessão e próximos passos' : (activeModule?.description || 'Preencha e salve os dados clínicos deste módulo.')}</p>
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
              {canManagePatientFlow && activeModule && activeModuleStatus !== 'finalizada' && (
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
              {canManagePatientFlow && activeModule && activeModuleStatus === 'finalizada' && (
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

          {activeModule?.snapshot && (() => {
            const ctxCards = getModuleContextCards(activeModule.tipo, activeModule.snapshot);
            if (!ctxCards.length) return null;
            const ctxDateLabel = getRelativeDateLabel(activeModule.updatedAt);
            const ctxStaleDays = activeModule.updatedAt
              ? Math.floor((Date.now() - new Date(activeModule.updatedAt).getTime()) / 86400000)
              : null;
            const ctxIsStale = ctxStaleDays != null && ctxStaleDays > 30;
            return (
              <div className="avaliacao-context-strip">
                <div className="avaliacao-context-strip__header">
                  <span className="avaliacao-context-strip__label">Última sessão</span>
                  {ctxDateLabel && (
                    <span className={`avaliacao-context-strip__date${ctxIsStale ? ' stale' : ''}`}>
                      {ctxDateLabel}
                    </span>
                  )}
                  <span className={`module-status status-${activeModule.status}`}>
                    {activeModule.status === 'finalizada' ? 'Finalizada' : activeModule.status === 'rascunho' ? 'Rascunho' : 'Pendente'}
                  </span>
                </div>
                <div className="avaliacao-context-strip__cards">
                  {ctxCards.map((card) => (
                    <div key={card.label} className="avaliacao-context-strip__card">
                      <span>{card.label}</span>
                      <strong>{card.value}</strong>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          <div className="avaliacao-body">
            {activeTab === 'visao_geral' ? (
              <section className="avaliacao-monitor" aria-label="Painel de monitoramento clínico">

                {/* Contexto do atleta */}
                <div className="monitor-athlete-bar">
                  {onboardingContext.modalidadePrincipal && (
                    <span className="monitor-athlete-pill">{onboardingContext.modalidadePrincipal}</span>
                  )}
                  {Number.isFinite(onboardingContext.frequenciaSemanal) && (
                    <span className="monitor-athlete-pill">
                      {onboardingContext.frequenciaSemanal}×/sem{Number.isFinite(onboardingContext.duracaoSessao) ? ` · ${onboardingContext.duracaoSessao} min` : ''}
                    </span>
                  )}
                  {onboardingContext.genero && (
                    <span className="monitor-athlete-pill">{onboardingContext.genero}</span>
                  )}
                  {onboardingContext.status && (
                    <span className="monitor-athlete-pill monitor-athlete-pill--status">{onboardingContext.status}</span>
                  )}
                  {onboardingContext.observacoesIniciais && (
                    <span className="monitor-athlete-pill monitor-athlete-pill--obs" title={onboardingContext.observacoesIniciais}>
                      {onboardingContext.observacoesIniciais.length > 48
                        ? `${onboardingContext.observacoesIniciais.slice(0, 48)}…`
                        : onboardingContext.observacoesIniciais}
                    </span>
                  )}
                </div>

                {/* Progresso + insights de dados */}
                <div className="monitor-top-row">
                  <div className="monitor-progress-card">
                    <div className="monitor-progress-card__headline">
                      <strong>{progress.finalized}</strong>
                      <span>/{progress.total} módulos</span>
                      <em>{progress.completion}%</em>
                    </div>
                    <div className="monitor-progress-card__bar">
                      <div className="monitor-progress-card__fill" style={{ width: `${progress.completion}%` }} />
                    </div>
                    <div className="monitor-progress-card__stages">
                      {stageSummaries.map((stage) => (
                        <div key={stage.id} className="monitor-stage-stat">
                          <span>{stage.label}</span>
                          <strong>{stage.finalized}/{stage.total}</strong>
                        </div>
                      ))}
                    </div>
                  </div>

                  {balancoEnergetico && (
                    <div className={`monitor-insight-card tone-${balancoEnergetico.tone}`}>
                      <span className="monitor-insight-card__label">Balanço energético</span>
                      <strong className="monitor-insight-card__value">{balancoEnergetico.label}</strong>
                      <small className="monitor-insight-card__sub">
                        {balancoEnergetico.kcalIngerida} kcal ingeridas · GET {balancoEnergetico.getEstimado} kcal
                      </small>
                    </div>
                  )}

                  {examesInsights && (
                    <div className={`monitor-insight-card${examesInsights.alterados.length > 0 ? ' tone-danger' : ' tone-warning'}`}>
                      <span className="monitor-insight-card__label">Exames laboratoriais</span>
                      <strong className="monitor-insight-card__value">
                        {examesInsights.alterados.length > 0
                          ? `${examesInsights.alterados.length} fora da referência`
                          : `${examesInsights.limitrofes.length} limítrofe(s)`}
                      </strong>
                      <small className="monitor-insight-card__sub">
                        {[...examesInsights.alterados, ...examesInsights.limitrofes].slice(0, 3).join(', ')}
                        {examesInsights.alterados.length + examesInsights.limitrofes.length > 3 && ' …'}
                      </small>
                    </div>
                  )}
                </div>

                {/* Alertas clínicos detalhados */}
                {crossLayerInconsistencies.length > 0 && (
                  <div className="monitor-section">
                    <h4 className="monitor-section__title">
                      Alertas clínicos
                      <span className="monitor-count-badge">{crossLayerInconsistencies.length}</span>
                    </h4>
                    <div className="monitor-alerts-grid">
                      {crossLayerInconsistencies.map((issue) => (
                        <div key={issue.id} className={`monitor-alert tone-${issue.tone}`}>
                          <div className="monitor-alert__content">
                            <strong>{issue.title}</strong>
                            <p>{issue.message}</p>
                          </div>
                          {issue.targetType && (
                            <button
                              type="button"
                              className="monitor-alert__btn"
                              data-target-type={issue.targetType}
                              onClick={handleIssueShortcutClick}
                            >
                              Abrir
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Próximos passos */}
                {nextSteps.length > 0 && (
                  <div className="monitor-section">
                    <h4 className="monitor-section__title">
                      Próximos passos
                      <span className="monitor-count-badge monitor-count-badge--neutral">{nextSteps.length}</span>
                    </h4>
                    <div className="monitor-steps-list">
                      {nextSteps.map((step) => (
                        <div key={step.id} className={`monitor-step priority-${step.priority}`}>
                          <div className="monitor-step__body">
                            <strong>{step.label}</strong>
                            <p>{step.description}</p>
                          </div>
                          <button
                            type="button"
                            className="tab-btn tab-btn--secondary monitor-step__btn"
                            data-step-id={step.id}
                            onClick={handleNextStepButtonClick}
                          >
                            Abrir
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Mapa de módulos */}
                <div className="monitor-section">
                  <h4 className="monitor-section__title">Mapa de módulos</h4>
                  <div className="avaliacao-overview-map__stages">
                    {stageSummaries.map((stage) => (
                      <div key={stage.id} className="avaliacao-overview-map__stage">
                        <div className="avaliacao-overview-map__stage-header">
                          <span className="avaliacao-overview-map__stage-label">{stage.label}</span>
                          <span className="avaliacao-overview-map__stage-count">{stage.finalized}/{stage.total}</span>
                        </div>
                        <div className="avaliacao-overview-map__stage-modules">
                          {stage.modules.map((module) => {
                            const dateLabel = getRelativeDateLabel(module.updatedAt);
                            const staleDays = module.updatedAt
                              ? Math.floor((Date.now() - new Date(module.updatedAt).getTime()) / 86400000)
                              : null;
                            const isStale = module.status !== 'pendente' && staleDays != null && staleDays > 30;
                            const keyMetric = getModuleKeyMetric(module.tipo, module.snapshot);
                            const ModuleIcon = module.icon;
                            return (
                              <button
                                key={module.id}
                                type="button"
                                className={`avaliacao-overview-module-card status-${module.status}`}
                                onClick={handleModuleShortcutClick}
                                data-module-id={module.id}
                                aria-label={`${module.label} — ${module.status}`}
                              >
                                <div className="avaliacao-overview-module-card__top">
                                  <ModuleIcon size={13} />
                                  <span>{module.label}</span>
                                  <div className="avaliacao-overview-module-card__badge">
                                    {module.status === 'finalizada'
                                      ? <CheckCircle2 size={11} className="module-icon-finalizada" />
                                      : module.status === 'rascunho'
                                        ? <CircleDashed size={11} className="module-icon-rascunho" />
                                        : <Clock size={11} className="module-icon-pendente" />}
                                  </div>
                                </div>
                                {(keyMetric || dateLabel) && (
                                  <div className="avaliacao-overview-module-card__meta">
                                    {keyMetric && <span className="avaliacao-overview-module-card__metric">{keyMetric}</span>}
                                    {dateLabel && (
                                      <span className={`avaliacao-overview-module-card__date${isStale ? ' stale' : ''}`}>
                                        {dateLabel}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </section>
            ) : (
              <>
                {activeModule && MODULE_DEPENDENCIES[activeTab] && (() => {
                  const dep = MODULE_DEPENDENCIES[activeTab];
                  const statuses = dep.requires.map((reqId) => {
                    const m = moduleStates.find((s) => s.id === reqId);
                    return { id: reqId, label: m?.label || reqId, filled: !!m && m.status !== 'pendente' };
                  });
                  const anyMissing = dep.mode === 'all'
                    ? statuses.some((s) => !s.filled)
                    : dep.mode === 'any'
                      ? statuses.every((s) => !s.filled)
                      : false;
                  if (!anyMissing) return null;
                  return (
                    <div className="avaliacao-dep-notice">
                      <strong>Módulos de suporte</strong>
                      <p>{dep.hint}</p>
                      <ul>
                        {statuses.map((s) => (
                          <li key={s.id} className={s.filled ? 'dep-ok' : 'dep-pending'}>
                            <span className="dep-dot" />
                            {s.label} — {s.filled ? 'preenchido' : 'pendente nesta sessão'}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })()}
                {activeModule ? (
                  renderForm()
                ) : (
                  <section className="avaliacao-empty-module" aria-label="Módulo indisponível">
                    <h4>Módulo indisponível</h4>
                    <p>O módulo selecionado não está acessível nesta sessão.</p>
                    {moduleStates.length > 0 ? (
                      <button
                        type="button"
                        className="tab-btn tab-btn--primary"
                        onClick={handleModuleShortcutClick}
                        data-module-id={moduleStates[0].id}
                      >
                        Abrir primeiro módulo disponível
                      </button>
                    ) : (
                      <p>Não há módulos configurados para este fluxo de avaliação.</p>
                    )}
                  </section>
                )}
              </>
            )}
          </div>

          <div className="avaliacao-footer-actions">
            <button type="button" className="tab-btn tab-btn--secondary" onClick={handleGoBack}>
              <ArrowLeft size={15} />
              Voltar ao prontuário
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AvaliacaoCompleta;

function resolveTriagemRedsClassificacao(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return '';
  const resultSources = [
    snapshot?.resultados?.classificacaoDE,
    snapshot?.resultados?.output?.classificacaoDE,
    snapshot?.resultados?.calculated?.classificacaoDE,
    snapshot?.dados?.classificacaoDE,
    snapshot?.classificacao
  ];
  for (const value of resultSources) {
    const token = String(value || '').trim().toLowerCase();
    if (!token) continue;
    return token;
  }
  return '';
}

function getModuleFinalizationBlocker({ module, patient }) {
  const tipo = String(module?.tipo || '').trim().toLowerCase().replace(/-/g, '_');
  if (tipo === 'triagem_reds') {
    return getTriagemRedsFinalizationBlocker(module?.snapshot, patient);
  }
  return '';
}

function getTriagemRedsFinalizationBlocker(snapshot, patient) {
  const dados = snapshot?.dados || {};
  const resultados = snapshot?.resultados || {};
  const calculated = resultados?.calculated || {};
  const output = resultados?.output || {};

  const sexo = normalizeRedsSex(
    dados.sexoBiologico
    || dados.sexo
    || patient?.sexoBiologico
    || patient?.sexo
    || patient?.genero
  );
  const disponibilidadeEnergetica = toNumericValue(
    dados.disponibilidadeEnergetica
    ?? dados.DE
    ?? resultados.disponibilidadeEnergetica
    ?? resultados.DE
    ?? calculated.disponibilidadeEnergetica
    ?? calculated.DE
    ?? snapshot?.disponibilidadeEnergetica
    ?? snapshot?.DE
  );
  const scoreRastreio = toNumericValue(
    dados.scoreLeafQ
    ?? dados.scoreLeaQ13
    ?? resultados.scoreLeafQ
    ?? resultados.scoreLeaQ13
    ?? calculated.scoreLeafQ
    ?? calculated.scoreLeaQ13
    ?? snapshot?.scoreLeafQ
    ?? snapshot?.scoreLeaQ13
  );
  const classificacao = String(
    dados.classificacaoDE
    || resultados.classificacaoDE
    || calculated.classificacaoDE
    || output.classificacaoDE
    || snapshot?.classificacao
    || ''
  ).trim();

  if (!Number.isFinite(disponibilidadeEnergetica) || !Number.isFinite(scoreRastreio) || !classificacao) {
    return 'Complete disponibilidade energetica, score de rastreio e classificacao RED-S antes de finalizar.';
  }
  if (!sexo) {
    return 'Informe o sexo biologico para validar o questionario RED-S antes de finalizar.';
  }
  if (sexo === 'female' && !isRedsQuestionnaireComplete(dados.leafQRespostas, 12, 'leaf_q')) {
    return 'Complete todas as 12 respostas do LEAF-Q antes de finalizar RED-S.';
  }
  if (sexo === 'male' && !isRedsQuestionnaireComplete(dados.leaQ13Respostas, 13, 'lea_q')) {
    return 'Complete todas as 13 respostas do LEA-Q13 antes de finalizar RED-S.';
  }
  return '';
}

function normalizeRedsSex(value) {
  const token = String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (!token) return '';
  if (token === 'f' || token.includes('fem')) return 'female';
  if (token === 'm' || token.includes('masc')) return 'male';
  return '';
}

function isRedsQuestionnaireComplete(value, total, prefix) {
  if (Array.isArray(value)) {
    return value.length >= total
      && value.slice(0, total).every((item) => isAnsweredChoice(item));
  }
  if (!value || typeof value !== 'object') return false;
  return Array.from({ length: total }, (_, index) => `${prefix}${index + 1}`)
    .every((key) => isAnsweredChoice(value[key]));
}

function isAnsweredChoice(value) {
  if (typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  const token = String(value ?? '').trim().toLowerCase();
  if (!token) return false;
  return ['true', 'false', '1', '0', 'sim', 'nao', 'não', 'yes', 'no'].includes(token);
}

function resolveLatestSnapshotByType({
  moduleSnapshots,
  sortedHistory,
  tipo,
  currentSessionId,
  normalizeType
}) {
  const normalizedTipo = normalizeType(tipo);
  const fromGrouped = moduleSnapshots?.[normalizedTipo] || null;
  if (fromGrouped) return fromGrouped;

  const rows = Array.isArray(sortedHistory) ? sortedHistory : [];
  const normalizedSessionId = String(currentSessionId || '').trim();
  if (normalizedSessionId) {
    const inSession = rows.find((item) => (
      normalizeType(item?.tipo) === normalizedTipo
      && String(item?.sessaoId || '').trim() === normalizedSessionId
    ));
    if (inSession) return inSession;
  }
  return rows.find((item) => normalizeType(item?.tipo) === normalizedTipo) || null;
}

function resolveFirstToken(values = []) {
  for (const value of values) {
    const token = String(value || '').trim();
    if (token) return token.replace(/_/g, ' ');
  }
  return '';
}

function resolveCondutaGoalsCount(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return 0;
  const goalsSources = [
    snapshot?.dados?.dados_brutos?.objetivos,
    snapshot?.dados?.input?.objetivos,
    snapshot?.dados?.objetivos
  ];
  for (const source of goalsSources) {
    if (Array.isArray(source)) {
      return source.map((item) => String(item || '').trim()).filter(Boolean).length;
    }
    if (typeof source === 'string') {
      return source
        .split(/[\n,;]+/g)
        .map((item) => item.trim())
        .filter(Boolean)
        .length;
    }
  }
  return 0;
}

function resolvePathValue(source, path) {
  if (!source || !path) return undefined;
  return String(path)
    .split('.')
    .reduce((acc, key) => (acc === null || acc === undefined ? undefined : acc[key]), source);
}

function resolveNumericFromPaths(source, paths = []) {
  for (const path of paths) {
    const value = resolvePathValue(source, path);
    const numeric = toNumericValue(value);
    if (Number.isFinite(numeric)) return numeric;
  }
  return null;
}

function resolveArrayFromPaths(source, paths = []) {
  for (const path of paths) {
    const value = resolvePathValue(source, path);
    if (Array.isArray(value)) return value;
  }
  return [];
}

function resolveStringArray(values = []) {
  for (const value of values) {
    if (Array.isArray(value)) {
      const normalized = value
        .map((item) => String(item || '').trim().toLowerCase().replace(/-/g, '_'))
        .filter(Boolean);
      if (normalized.length > 0) return normalized;
      continue;
    }
    if (typeof value === 'string') {
      const normalized = value
        .split(/[,\n;]+/g)
        .map((item) => item.trim().toLowerCase().replace(/-/g, '_'))
        .filter(Boolean);
      if (normalized.length > 0) return normalized;
    }
  }
  return [];
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
