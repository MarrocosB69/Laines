import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { usePacientes } from '../../contexts/PacienteContext';
import api, { getApiErrorMessage } from '../../services/api';
import { toDate } from '../../utils/dateUtils';
import { useUiFeedback } from '../../contexts/UiFeedbackContext';
import {
  Users,
  ClipboardList,
  Eye,
  Search,
  UserCheck,
  AlertTriangle,
  CalendarCheck,
  Hourglass,
  Percent,
  Plus,
  RefreshCw
} from 'lucide-react';
import PatientModal from '../admin/Registration/PatientModal';
import Button from '../../components/ui/Button';
import {
  PainelVisaoGeral,
  PainelCabecalho,
  PainelIndicadores,
  PainelSecao,
  PainelLista,
  saudacaoPorHorario
} from '../../components/painel/Painel';
import { buildSidebarModel } from '../../navigation/sidebarModel';
import FilaRevisao from '../../components/Supervisao/FilaRevisao';
import EvaluationSummaryStrip from '../../components/shared/EvaluationSummaryStrip';
import ClinicalEvaluationResultCard from '../../components/shared/ClinicalEvaluationResultCard';
import {
  getEvaluationStatusLabel,
  getEvaluationTypeLabel
} from '../../components/shared/evaluationSummaryUtils';
import { buildEvaluationResultCollection } from '../../components/shared/evaluationResultAdapter';

import './ProfessorView.css';
import './ProfessorDashboard.css';

const PATIENT_STATUS_OPTIONS = [
  { value: 'all', label: 'Todos os status' },
  { value: 'ativo', label: 'Ativo' },
  { value: 'lista de espera', label: 'Lista de espera' },
  { value: 'triagem', label: 'Triagem' },
  { value: 'alta', label: 'Alta' },
  { value: 'inativo', label: 'Inativo' }
];

const AVALIACOES_PAGE_SIZE = 200;
const AVALIACOES_MAX_PAGES = 250;

const fetchAllAvaliacoes = async (params = {}) => {
  const mergedParams = { ...params };
  const allItems = [];

  for (let page = 0; page < AVALIACOES_MAX_PAGES; page += 1) {
    const offset = page * AVALIACOES_PAGE_SIZE;
    const { data } = await api.get('/avaliacoes', {
      params: {
        ...mergedParams,
        limit: AVALIACOES_PAGE_SIZE,
        offset
      }
    });
    const chunk = Array.isArray(data) ? data : [];
    allItems.push(...chunk);
    if (chunk.length < AVALIACOES_PAGE_SIZE) {
      break;
    }
  }

  return allItems;
};

const normalizePatientStatus = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return 'ativo';
  if (raw.includes('lista')) return 'lista de espera';
  if (raw.includes('triagem')) return 'triagem';
  if (raw.includes('alta')) return 'alta';
  if (raw.includes('inativo')) return 'inativo';
  return 'ativo';
};

const getPatientStatusLabel = (value) => {
  const normalized = normalizePatientStatus(value);
  const option = PATIENT_STATUS_OPTIONS.find((item) => item.value === normalized);
  return option?.label || 'Ativo';
};

const ProfessorDashboard = ({ onSelectPatient, activeTab = 'dashboard' }) => {
  const { user, capabilities } = useAuth();
  const { formatDate, addPaciente } = usePacientes();
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [supervisedPatients, setSupervisedPatients] = useState([]);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [alunoSelecionado, setAlunoSelecionado] = useState(null);
  const [patientSearch, setPatientSearch] = useState('');
  const [patientSort, setPatientSort] = useState('recent');
  const [patientStatusFilter, setPatientStatusFilter] = useState('all');
  const [isPatientModalOpen, setPatientModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [metrics, setMetrics] = useState({
    totalPatients: 0,
    evaluationsMonth: 0,
    pendingEvaluations: 0,
    nextAppointments: 0,
    waitlistPatients: 0,
    attendanceRate: 0,
    attendanceTotal: 0
  });
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [activeMetric, setActiveMetric] = useState('');
  const [evaluationItems, setEvaluationItems] = useState([]);
  const { notify } = useUiFeedback();
  const professorDisplayName = user?.name || user?.nome || user?.email || 'Professor';
  const professorFirstName = String(professorDisplayName).split(' ')[0] || 'Docente';

  const loadPatients = useCallback(async ({ silent = false } = {}) => {
    if (!user?.uid) return;
    if (silent) {
      setIsRefreshing(true);
    } else {
      setLoadingStudents(true);
      setLoadingPatients(true);
    }
    try {
      const { data } = await api.get('/users/meus-supervisionados');
      const supervisionados = Array.isArray(data) ? data : [];

      const studentList = supervisionados
        .map((aluno) => ({
          id: aluno.id,
          nome: aluno.nome || 'Aluno',
          email: aluno.email || '',
          supervisaoTipo: aluno.supervisaoTipo || 'professor'
        }))
        .sort((a, b) => a.nome.localeCompare(b.nome));

      const patientList = supervisionados.flatMap((aluno) =>
        (aluno.pacientes || []).map((paciente) => ({
          ...paciente,
          alunoResponsavel: {
            id: aluno.id,
            nome: aluno.nome || 'Aluno',
            email: aluno.email || ''
          },
          alunoResponsavelId: aluno.id,
          alunoResponsavelNome: aluno.nome,
          professorSupervisorId: user.uid,
          supervisaoTipo: aluno.supervisaoTipo || 'professor'
        }))
      );

      setSupervisedPatients(patientList);
      setStudents(studentList);
      setLastSyncedAt(new Date());
    } catch (error) {
      console.error('Erro ao buscar supervisionados:', error);
      notify({
        type: 'error',
        title: 'Erro ao buscar supervisionados',
        message: getApiErrorMessage(error, 'Não foi possível carregar os alunos supervisionados.')
      });
      setSupervisedPatients([]);
      setStudents([]);
    } finally {
      if (silent) {
        setIsRefreshing(false);
      } else {
        setLoadingStudents(false);
        setLoadingPatients(false);
      }
    }
  }, [notify, user?.uid]);

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  const alunos = useMemo(() => {
    const patientsByStudent = supervisedPatients.reduce((acc, paciente) => {
      const alunoId = paciente.alunoResponsavel?.id;
      if (!alunoId) return acc;
      if (!acc[alunoId]) acc[alunoId] = [];
      const rawDate = paciente.updatedAt || paciente.dataCadastro || paciente.linkedAt;
      acc[alunoId].push({
        id: paciente.id,
        nome: paciente.nome || 'Atleta',
        ultimaAvaliacao:
          paciente.ultimaAvaliacao || formatDate(rawDate),
        ultimaAvaliacaoDate: toDate(rawDate),
        status: paciente.status || 'Ativo'
      });
      return acc;
    }, {});

    const fromStudents = students.map((aluno) => ({
      id: aluno.id,
      nome: aluno.nome || 'Aluno',
      email: aluno.email || '',
      supervisaoTipo: aluno.supervisaoTipo || 'professor',
      pacientes: patientsByStudent[aluno.id] || []
    }));

    if (fromStudents.length > 0) {
      return fromStudents.sort((a, b) => a.nome.localeCompare(b.nome));
    }

    const fallback = Object.entries(patientsByStudent).map(([id, list]) => ({
      id,
      nome: list[0]?.alunoResponsavel?.nome || 'Aluno',
      email: list[0]?.alunoResponsavel?.email || '',
      supervisaoTipo: list[0]?.supervisaoTipo || 'professor',
      pacientes: list
    }));

    return fallback.sort((a, b) => a.nome.localeCompare(b.nome));
  }, [formatDate, supervisedPatients, students]);

  useEffect(() => {
    if (!alunos.length) {
      setAlunoSelecionado(null);
      return;
    }
    if (!alunoSelecionado || !alunos.some((a) => a.id === alunoSelecionado.id)) {
      setAlunoSelecionado(alunos[0]);
    }
  }, [alunos, alunoSelecionado]);

  const alunosFiltrados = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return alunos;
    return alunos.filter((aluno) => aluno.nome.toLowerCase().includes(term));
  }, [alunos, searchTerm]);

  const patientMap = useMemo(
    () => new Map(supervisedPatients.map((patient) => [patient.id, patient])),
    [supervisedPatients]
  );

  const studentMap = useMemo(
    () => new Map(students.map((student) => [student.id, student])),
    [students]
  );

  useEffect(() => {
    const patientIds = supervisedPatients.map((p) => p.id).filter(Boolean);
    const waitlistCount = supervisedPatients.filter((p) => (p.status || '').toLowerCase() === 'lista de espera').length;

    if (!patientIds.length) {
      setMetrics({
        totalPatients: 0,
        evaluationsMonth: 0,
        pendingEvaluations: 0,
        nextAppointments: 0,
        waitlistPatients: waitlistCount,
        attendanceRate: 0,
        attendanceTotal: 0
      });
      setEvaluationItems([]);
      return;
    }

    let isActive = true;
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    const patientSet = new Set(patientIds);

    const fetchMetrics = async () => {
      setMetricsLoading(true);
      try {
        const [evalRes, appRes] = await Promise.all([
          fetchAllAvaliacoes(),
          api.get('/agendamentos')
        ]);
        const evaluations = (Array.isArray(evalRes) ? evalRes : []).filter((item) => patientSet.has(item.pacienteId));
        const appointments = (Array.isArray(appRes.data) ? appRes.data : []).filter((item) => patientSet.has(item.pacienteId));
        if (isActive) setEvaluationItems(evaluations);

        const evaluationsMonth = evaluations.filter((item) => {
          if (item.status !== 'finalizada') return false;
          const date = toDate(item.createdAt || item.data);
          return date && date.getMonth() === month && date.getFullYear() === year;
        }).length;

        const pendingEvaluations = evaluations.filter(
          (item) => item.status && item.status !== 'finalizada'
        ).length;

        const upcoming = appointments
          .map((item) => ({
            ...item,
            dateObj: toDate(item.scheduledAt || item.date)
          }))
          .filter((item) => item.dateObj && item.dateObj >= now && (item.status || 'agendada') !== 'falta');

        const realized = appointments.filter((item) => item.status === 'realizada').length;
        const missed = appointments.filter((item) => item.status === 'falta').length;
        const attendanceTotal = realized + missed;
        const attendanceRate = attendanceTotal ? Math.round((realized / attendanceTotal) * 100) : 0;

        if (isActive) {
          setMetrics({
            totalPatients: patientIds.length,
            evaluationsMonth,
            pendingEvaluations,
            nextAppointments: upcoming.length,
            waitlistPatients: waitlistCount,
            attendanceRate,
            attendanceTotal
          });
        }
      } catch (error) {
        console.error('Erro ao carregar métricas:', error);
        notify({
          type: 'error',
          title: 'Erro ao carregar métricas',
          message: getApiErrorMessage(error, 'Não foi possível atualizar as métricas do painel.')
        });
      } finally {
        if (isActive) setMetricsLoading(false);
      }
    };

    fetchMetrics();
    return () => {
      isActive = false;
    };
  }, [notify, supervisedPatients]);

  const evaluationsMonthList = useMemo(() => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    return evaluationItems
      .filter((item) => {
        if (item.status !== 'finalizada') return false;
        const date = toDate(item.createdAt || item.data);
        return date && date.getMonth() === month && date.getFullYear() === year;
      })
      .sort((a, b) => {
        const aDate = toDate(a.createdAt || a.data) || 0;
        const bDate = toDate(b.createdAt || b.data) || 0;
        return bDate - aDate;
      });
  }, [evaluationItems]);

  const pendingEvaluationsList = useMemo(() => {
    return evaluationItems
      .filter((item) => item.status && item.status !== 'finalizada')
      .sort((a, b) => {
        const aDate = toDate(a.createdAt || a.data) || 0;
        const bDate = toDate(b.createdAt || b.data) || 0;
        return bDate - aDate;
      });
  }, [evaluationItems]);

  const evaluationsMonthResultCollection = useMemo(() => (
    buildEvaluationResultCollection(evaluationsMonthList, {
      groupBy: (item) => `${item?.pacienteId || 'paciente'}::${normalizeEvaluationType(item?.tipo)}`,
      getDateValue: (item) => item?.updatedAt || item?.createdAt || item?.data
    })
  ), [evaluationsMonthList]);

  const pendingEvaluationResultCollection = useMemo(() => (
    buildEvaluationResultCollection(pendingEvaluationsList, {
      groupBy: (item) => `${item?.pacienteId || 'paciente'}::${normalizeEvaluationType(item?.tipo)}`,
      getDateValue: (item) => item?.updatedAt || item?.createdAt || item?.data
    })
  ), [pendingEvaluationsList]);

  const getEvaluatorName = useCallback((item) => {
    if (!item?.alunoId) return 'Equipe';
    if (item.alunoId === user?.uid) return professorDisplayName;
    return studentMap.get(item.alunoId)?.nome || item.createdByName || 'Equipe';
  }, [professorDisplayName, studentMap, user?.uid]);

  const getPatientName = useCallback((item) => {
    if (!item?.pacienteId) return 'Atleta';
    return patientMap.get(item.pacienteId)?.nome || 'Atleta';
  }, [patientMap]);

  const supervisedPatientsList = useMemo(() => {
    return [...supervisedPatients].sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  }, [supervisedPatients]);

  const formatEvaluationDate = useCallback((item) => {
    const date = toDate(item?.createdAt || item?.data);
    return date ? formatDate(date) : 'Sem data';
  }, [formatDate]);

  const activeEvaluationSummary = useMemo(() => {
    if (activeMetric !== 'done' && activeMetric !== 'pending') return null;

    const source = activeMetric === 'done' ? evaluationsMonthList : pendingEvaluationsList;
    if (!source.length) {
      return {
        empty: true,
        status: activeMetric === 'done' ? 'finalizada' : 'pendente',
        items: [],
        title: activeMetric === 'done'
          ? 'Resumo clínico das avaliações realizadas'
          : 'Resumo clínico das avaliações pendentes',
        subtitle: activeMetric === 'done'
          ? 'Consolidado do mes atual.'
          : 'Consolidado das avaliações em aberto.'
      };
    }

    const latest = source[0];
    const completionValues = source
      .map((item) => Number(item?.meta?.completude))
      .filter((value) => Number.isFinite(value));
    const averageCompletion = completionValues.length
      ? `${Math.round(completionValues.reduce((total, value) => total + value, 0) / completionValues.length)}%`
      : 'Não informada';
    const typeLabels = Array.from(
      new Set(source.map((item) => getEvaluationTypeLabel(item.tipo)).filter(Boolean))
    );
    const projectLabels = Array.from(
      new Set(
        source
          .map((item) => item.projetoNome || patientMap.get(item.pacienteId)?.projetoNome || '')
          .filter(Boolean)
      )
    );
    const latestUpdatedAt = toDate(latest.updatedAt || latest.createdAt || latest.data);

    return {
      empty: false,
      status: latest.status || (activeMetric === 'done' ? 'finalizada' : 'pendente'),
      title: activeMetric === 'done'
        ? 'Resumo clínico das avaliações realizadas'
        : 'Resumo clínico das avaliações pendentes',
      subtitle: activeMetric === 'done'
        ? 'Consolidado do mes atual.'
        : 'Consolidado das avaliações em aberto.',
      items: [
        {
          label: 'Tipo',
          value: typeLabels.length <= 1 ? typeLabels[0] : `${typeLabels.length} tipos`
        },
        { label: 'Responsavel', value: getEvaluatorName(latest) },
        { label: 'Data', value: formatEvaluationDate(latest) },
        { label: 'Completude media', value: averageCompletion },
        {
          label: 'Projeto',
          value: projectLabels.length <= 1
            ? (projectLabels[0] || 'Não vinculado')
            : `${projectLabels.length} projetos`
        },
        {
          label: 'Última atualização',
          value: latestUpdatedAt ? formatDate(latestUpdatedAt) : 'Não informada'
        }
      ]
    };
  }, [
    activeMetric,
    evaluationsMonthList,
    formatDate,
    formatEvaluationDate,
    getEvaluatorName,
    patientMap,
    pendingEvaluationsList
  ]);

  const pacientesFiltrados = useMemo(() => {
    if (!alunoSelecionado) return [];
    const term = patientSearch.trim().toLowerCase();
    const filtered = alunoSelecionado.pacientes.filter((paciente) => {
      const matchesTerm = paciente.nome.toLowerCase().includes(term);
      const matchesStatus = patientStatusFilter === 'all'
        || normalizePatientStatus(paciente.status) === patientStatusFilter;
      return matchesTerm && matchesStatus;
    });

    const sorted = [...filtered].sort((a, b) => {
      if (patientSort === 'name') {
        return a.nome.localeCompare(b.nome);
      }
      const dateA = a.ultimaAvaliacaoDate ? a.ultimaAvaliacaoDate.getTime() : 0;
      const dateB = b.ultimaAvaliacaoDate ? b.ultimaAvaliacaoDate.getTime() : 0;
      if (patientSort === 'oldest') {
        return dateA - dateB;
      }
      return dateB - dateA;
    });

    return sorted;
  }, [alunoSelecionado, patientSearch, patientSort, patientStatusFilter]);

  const selectedStudentStatusSummary = useMemo(() => {
    if (!alunoSelecionado) {
      return {
        total: 0,
        ativo: 0,
        espera: 0,
        triagem: 0,
        alta: 0,
        inativo: 0
      };
    }
    const summary = {
      total: alunoSelecionado.pacientes.length,
      ativo: 0,
      espera: 0,
      triagem: 0,
      alta: 0,
      inativo: 0
    };
    alunoSelecionado.pacientes.forEach((paciente) => {
      const normalized = normalizePatientStatus(paciente.status);
      if (normalized === 'ativo') summary.ativo += 1;
      if (normalized === 'lista de espera') summary.espera += 1;
      if (normalized === 'triagem') summary.triagem += 1;
      if (normalized === 'alta') summary.alta += 1;
      if (normalized === 'inativo') summary.inativo += 1;
    });
    return summary;
  }, [alunoSelecionado]);

  const supervisionCoverage = useMemo(() => {
    if (!alunos.length) return null;
    const withPatients = alunos.filter((a) => a.pacientes.length > 0).length;
    const pct = Math.round((withPatients / alunos.length) * 100);
    return { pct, withPatients, total: alunos.length };
  }, [alunos]);

  const syncLabel = useMemo(() => {
    if (!lastSyncedAt) return 'Sincronização pendente';
    return `Atualizado às ${lastSyncedAt.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    })}`;
  }, [lastSyncedAt]);

  const hasPatientFilters = Boolean(patientSearch.trim())
    || patientSort !== 'recent'
    || patientStatusFilter !== 'all';

  const handleResetPatientFilters = () => {
    setPatientSearch('');
    setPatientSort('recent');
    setPatientStatusFilter('all');
  };

  useEffect(() => {
    setPatientSearch('');
    setPatientSort('recent');
    setPatientStatusFilter('all');
  }, [alunoSelecionado?.id]);

  const handleCreatePatient = async (patientData) => {
    if (!alunoSelecionado || alunoSelecionado.supervisaoTipo !== 'professor') return;
    const payload = {
      ...patientData,
      alunoResponsavel: {
        id: alunoSelecionado.id,
        nome: alunoSelecionado.nome,
        email: alunoSelecionado.email || ''
      },
      professorSupervisor: {
        id: user?.uid || null,
        nome: professorDisplayName
      }
    };
    await addPaciente(payload);
    await loadPatients({ silent: true });
  };

  const canCreatePatientForSelectedStudent = alunoSelecionado?.supervisaoTipo === 'professor';

  // ── Visão geral (apresentação apenas; dados e cálculos acima intactos) ──
  // Mesmo rótulo do cartão de papel da sidebar do professor.
  const papel = useMemo(
    () => buildSidebarModel({ portal: 'professor', user, capabilities }).papel.titulo,
    [capabilities, user]
  );

  // Enquanto os supervisionados ainda não chegaram, as métricas valem 0 só
  // por serem o estado inicial: a faixa mostra esqueleto, não zero.
  const carregandoNumeros = metricsLoading || loadingStudents || loadingPatients;
  const metaNumero = (valor) => (carregandoNumeros ? 'Carregando…' : String(valor));

  // Mesmo alternar dos antigos cartões clicáveis.
  const alternarMetrica = (metric) => setActiveMetric(activeMetric === metric ? '' : metric);

  // O detalhe de uma métrica abre dentro do bloco a que pertence, que pode
  // estar abaixo da dobra: leva o detalhe à vista (sem animação se o
  // sistema pede movimento reduzido).
  const metricPanelRef = useRef(null);
  useEffect(() => {
    const painel = metricPanelRef.current;
    if (!activeMetric || !painel || typeof painel.scrollIntoView !== 'function') return;
    const reduzir = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    painel.scrollIntoView({ behavior: reduzir ? 'auto' : 'smooth', block: 'nearest' });
  }, [activeMetric]);

  const indicadores = [
    { id: 'pendentes', rotulo: 'Avaliações pendentes', valor: metrics.pendingEvaluations, detalhe: 'Com status em aberto', icone: AlertTriangle, tom: metrics.pendingEvaluations > 0 ? 'atencao' : 'neutro', onClick: () => alternarMetrica('pending'), expandido: activeMetric === 'pending' },
    { id: 'supervisionados', rotulo: 'Atletas supervisionados', valor: metrics.totalPatients, detalhe: `${alunos.length || 0} ${alunos.length === 1 ? 'aluno' : 'alunos'}`, icone: Users, onClick: () => alternarMetrica('patients'), expandido: activeMetric === 'patients' },
    { id: 'realizadas', rotulo: 'Avaliações realizadas', valor: metrics.evaluationsMonth, detalhe: 'Finalizadas no mês', icone: ClipboardList, onClick: () => alternarMetrica('done'), expandido: activeMetric === 'done' },
    { id: 'consultas-futuras', rotulo: 'Consultas futuras', valor: metrics.nextAppointments, detalhe: 'Agendadas', icone: CalendarCheck }
  ];

  const pendenciasItens = [
    { id: 'pendentes', titulo: 'Avaliações pendentes', subtitulo: 'Avaliações em aberto com responsável.', meta: metaNumero(metrics.pendingEvaluations), icone: AlertTriangle, tom: !carregandoNumeros && metrics.pendingEvaluations > 0 ? 'atencao' : 'neutro', onClick: () => alternarMetrica('pending'), expandido: activeMetric === 'pending' }
  ];

  const agendaItens = [
    { id: 'consultas-futuras', titulo: 'Consultas futuras', subtitulo: 'Agendadas', meta: String(metrics.nextAppointments), icone: CalendarCheck },
    { id: 'comparecimento', titulo: 'Taxa de comparecimento', subtitulo: metrics.attendanceTotal ? `${metrics.attendanceTotal} atendimentos` : 'Sem atendimentos', meta: `${metrics.attendanceRate}%`, icone: Percent }
  ];

  const supervisaoItens = [
    { id: 'supervisionados', titulo: 'Atletas supervisionados', subtitulo: `${alunos.length || 0} ${alunos.length === 1 ? 'aluno' : 'alunos'}`, meta: metaNumero(metrics.totalPatients), icone: Users, onClick: () => alternarMetrica('patients'), expandido: activeMetric === 'patients' },
    supervisionCoverage && { id: 'cobertura', titulo: `${supervisionCoverage.pct}% com atletas`, subtitulo: `(${supervisionCoverage.withPatients}/${supervisionCoverage.total} alunos)`, icone: UserCheck },
    { id: 'realizadas', titulo: 'Avaliações realizadas', subtitulo: 'Finalizadas no mês', meta: metaNumero(metrics.evaluationsMonth), icone: ClipboardList, onClick: () => alternarMetrica('done'), expandido: activeMetric === 'done' },
    { id: 'lista-espera', titulo: 'Lista de espera', subtitulo: 'Atletas aguardando', meta: metaNumero(metrics.waitlistPatients), icone: Hourglass }
  ].filter(Boolean);

  // Detalhe da métrica ativa: o mesmo painel de antes, agora renderizado
  // dentro do bloco a que pertence (pendentes em "O que precisa de você",
  // supervisionados e realizadas no bloco dos atletas supervisionados).
  const metricPanel = activeMetric ? (
    <section className="professor-metric-panel" ref={metricPanelRef}>
      <div className="metric-panel-header">
        <div>
          <h3>
            {activeMetric === 'patients' && 'Atletas supervisionados'}
            {activeMetric === 'done' && 'Avaliações realizadas (mês)'}
            {activeMetric === 'pending' && 'Avaliações pendentes'}
          </h3>
          <p>
            {activeMetric === 'patients' && 'Clique em um atleta para abrir o prontuário.'}
            {activeMetric === 'done' && 'Avaliações finalizadas no mês atual.'}
            {activeMetric === 'pending' && 'Avaliações em aberto com responsável.'}
          </p>
        </div>
        <button type="button" onClick={() => setActiveMetric('')} className="metric-close">
          Fechar
        </button>
      </div>

      {activeEvaluationSummary && (
        <EvaluationSummaryStrip
          title={activeEvaluationSummary.title}
          subtitle={activeEvaluationSummary.subtitle}
          status={activeEvaluationSummary.status}
          empty={activeEvaluationSummary.empty}
          emptyMessage="Sem avaliação para consolidar resumo clínico."
          items={activeEvaluationSummary.items}
        />
      )}

      {activeMetric === 'patients' && (
        <div className="metric-list">
          {supervisedPatientsList.length === 0 ? (
            <div className="metric-empty laines-feedback-state">Nenhum atleta supervisionado.</div>
          ) : (
            supervisedPatientsList.map((patient) => (
              <button
                key={patient.id}
                type="button"
                className="metric-item"
                onClick={() => onSelectPatient?.(patient)}
              >
                <span className="metric-main">
                  <strong>{patient.nome || 'Atleta'}</strong>
                  <span>{patient.alunoResponsavel?.nome || 'Aluno não informado'}</span>
                </span>
                <span className="metric-meta">{patient.status || '---'}</span>
              </button>
            ))
          )}
        </div>
      )}

      {activeMetric === 'done' && (
        <div className="metric-list">
          {evaluationsMonthResultCollection.length === 0 ? (
            <div className="metric-empty laines-feedback-state">Nenhuma avaliação finalizada neste mês.</div>
          ) : (
            evaluationsMonthResultCollection.map(({ evaluation: item, result }, index) => {
              const patient = patientMap.get(item.pacienteId);
              const evaluationDate = toDate(item.createdAt || item.data);
              return (
                // O cartão tem botão próprio ("Ver detalhes completos"): fica
                // fora do botão da linha, que só abre o prontuário.
                <div key={item.id || `done-result-${index}`} className="metric-result">
                  <button
                    type="button"
                    className="metric-item metric-item--result"
                    onClick={() => patient && onSelectPatient?.(patient)}
                    disabled={!patient}
                  >
                    <span className="metric-main metric-main--result">
                      <strong>{getPatientName(item)}</strong>
                    </span>
                    <span className="metric-meta">{formatEvaluationDate(item)}</span>
                  </button>
                  <ClinicalEvaluationResultCard
                    result={result}
                    status={item.status || 'finalizada'}
                    typeLabel={getEvaluationTypeLabel(item.tipo)}
                    responsible={getEvaluatorName(item)}
                    completion={item?.meta?.completude}
                    dateLabel={evaluationDate ? formatDate(evaluationDate) : 'Sem data'}
                    project={item.projetoNome || patient?.projetoNome || 'Não vinculado'}
                    className="professor-clinical-result"
                    compact
                  />
                </div>
              );
            })
          )}
        </div>
      )}

      {activeMetric === 'pending' && (
        <div className="metric-list">
          {pendingEvaluationResultCollection.length === 0 ? (
            <div className="metric-empty laines-feedback-state">Nenhuma avaliação pendente.</div>
          ) : (
            pendingEvaluationResultCollection.map(({ evaluation: item, result }, index) => {
              const patient = patientMap.get(item.pacienteId);
              const evaluationDate = toDate(item.createdAt || item.data);
              return (
                <div key={item.id || `pending-result-${index}`} className="metric-result">
                  <button
                    type="button"
                    className="metric-item metric-item--result"
                    onClick={() => patient && onSelectPatient?.(patient)}
                    disabled={!patient}
                  >
                    <span className="metric-main metric-main--result">
                      <strong>{getPatientName(item)}</strong>
                    </span>
                    <span className="metric-meta">{getEvaluationStatusLabel(item.status || 'pendente')}</span>
                  </button>
                  <ClinicalEvaluationResultCard
                    result={result}
                    status={item.status || 'pendente'}
                    typeLabel={getEvaluationTypeLabel(item.tipo)}
                    responsible={getEvaluatorName(item)}
                    completion={item?.meta?.completude}
                    dateLabel={evaluationDate ? formatDate(evaluationDate) : 'Sem data'}
                    project={item.projetoNome || patient?.projetoNome || 'Não vinculado'}
                    className="professor-clinical-result"
                    compact
                  />
                </div>
              );
            })
          )}
        </div>
      )}
    </section>
  ) : null;

  return (
    <div className="professor-dashboard">
      {/* Na aba "Alunos e Atletas" a barra de contexto continua igual; na
          Visão geral, o que ela mostrava (saudação, sincronização, cobertura
          e Atualizar) foi para o cabeçalho e para o bloco dos supervisionados. */}
      {activeTab !== 'dashboard' && (
        <div className="prof-context-bar">
          <div className="prof-context-bar__left">
            <span className="prof-context-bar__greeting">
              Olá, Prof. {professorFirstName}
            </span>
            <span className="prof-context-bar__sync">{syncLabel}</span>
          </div>
          <div className="prof-context-bar__right">
            {supervisionCoverage && (
              <span className="prof-context-bar__chip">
                <UserCheck size={13} />
                {supervisionCoverage.pct}% com atletas
                <span className="prof-context-bar__chip-sub">
                  ({supervisionCoverage.withPatients}/{supervisionCoverage.total} alunos)
                </span>
              </span>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => loadPatients({ silent: true })}
              disabled={isRefreshing || loadingStudents || loadingPatients}
            >
              <RefreshCw size={14} className={isRefreshing ? 'is-rotating' : ''} />
              {isRefreshing ? 'Atualizando...' : 'Atualizar'}
            </Button>
          </div>
        </div>
      )}

      {activeTab === 'dashboard' && (
        <div className="prof-visao-geral">
          <PainelVisaoGeral>
            <PainelCabecalho
              saudacao={saudacaoPorHorario(new Date())}
              nome={professorFirstName}
              papel={papel}
              data={new Date()}
              acoes={(
                <div className="prof-painel-acoes">
                  <span className="prof-painel-acoes__sync">{syncLabel}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => loadPatients({ silent: true })}
                    disabled={isRefreshing || loadingStudents || loadingPatients}
                  >
                    <RefreshCw size={14} className={isRefreshing ? 'is-rotating' : ''} aria-hidden="true" />
                    {isRefreshing ? 'Atualizando...' : 'Atualizar'}
                  </Button>
                </div>
              )}
            />

            <PainelIndicadores
              rotulo="Indicadores da supervisão"
              carregando={carregandoNumeros}
              itens={indicadores}
            />
            <PainelSecao id="precisa-de-voce" titulo="O que precisa de você">
              {/* UX-06: fila de revisao primeiro — quem revisa trabalha nisso
                  todo dia; quem nao revisa (sem capabilities.atendimento.revisaPlano)
                  nunca ve o bloco, nem uma fila vazia. */}
              {capabilities?.atendimento?.revisaPlano && <FilaRevisao />}
              {/* A linha fica e o detalhe abre abaixo dela: trocar a linha pelo
                  painel tirava do DOM o botão focado, e o foco caía no body
                  (revisão de 27/09/2026). */}
              <PainelLista rotuloAcessivel="Avaliações pendentes" itens={pendenciasItens} />
              {activeMetric === 'pending' && metricPanel}
            </PainelSecao>

            <PainelSecao
              id="agenda"
              titulo="Agenda"
              estado={carregandoNumeros ? 'carregando' : 'pronto'}
            >
              <PainelLista rotuloAcessivel="Agendamentos" itens={agendaItens} />
            </PainelSecao>

            <PainelSecao id="supervisionados" titulo="Atletas supervisionados">
              <PainelLista rotuloAcessivel="Supervisão" itens={supervisaoItens} />
              {(activeMetric === 'patients' || activeMetric === 'done') && metricPanel}
            </PainelSecao>
          </PainelVisaoGeral>
        </div>
      )}

      {activeTab === 'patients' && <section className="professor-grid">
        <div className="professor-students">
          <div className="section-header">
            <h2>Turma</h2>
            <span className="chip">2026.1</span>
          </div>

          <div className="search-box">
            <Search size={18} />
            <input
              type="text"
              placeholder="Buscar aluno..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="student-list">
            {loadingStudents || loadingPatients ? (
              <div className="empty-state laines-feedback-state">Carregando alunos...</div>
            ) : alunosFiltrados.length === 0 ? (
              <div className="empty-state laines-feedback-state">Nenhum aluno encontrado.</div>
            ) : (
              alunosFiltrados.map((aluno) => (
                <button
                  key={aluno.id}
                  type="button"
                  onClick={() => setAlunoSelecionado(aluno)}
                  className={`student-card ${alunoSelecionado?.id === aluno.id ? 'active' : ''}`}
                >
                  <div className="student-avatar">
                    {aluno.nome.charAt(0)}
                  </div>
                  <div>
                    <h3>{aluno.nome}</h3>
                    <p>{aluno.pacientes.length} atletas</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="professor-patients">
          {alunoSelecionado ? (
            <>
              <div className="section-header">
                <div>
                  <h2>Atletas de {alunoSelecionado.nome}</h2>
                  <p className="muted">
                    {alunoSelecionado.email || 'Email não informado'}
                  </p>
                </div>
                {canCreatePatientForSelectedStudent && (
                  <Button
                    variant="primary"
                    size="sm"
                    type="button"
                    onClick={() => setPatientModalOpen(true)}
                  >
                    <Plus size={18} />
                    Novo atleta
                  </Button>
                )}
              </div>

              <div className="patient-summary-row">
                <span className="patient-summary-chip">Total: {selectedStudentStatusSummary.total}</span>
                <span className="patient-summary-chip">Ativos: {selectedStudentStatusSummary.ativo}</span>
                <span className="patient-summary-chip warning">Espera: {selectedStudentStatusSummary.espera}</span>
                <span className="patient-summary-chip">Triagem: {selectedStudentStatusSummary.triagem}</span>
                <span className="patient-summary-chip">Alta: {selectedStudentStatusSummary.alta}</span>
                <span className="patient-summary-chip muted">Inativos: {selectedStudentStatusSummary.inativo}</span>
              </div>

              <div className="patient-controls">
                <div className="search-box">
                  <Search size={18} />
                  <input
                    type="text"
                    placeholder="Buscar paciente..."
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                  />
                </div>
                <div className="patient-sort">
                  <label htmlFor="patientStatusFilter">Status</label>
                  <select
                    id="patientStatusFilter"
                    className="prof-select"
                    value={patientStatusFilter}
                    onChange={(e) => setPatientStatusFilter(e.target.value)}
                  >
                    {PATIENT_STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="patient-sort">
                  <label htmlFor="patientSort">Ordenar por</label>
                  <select
                    id="patientSort"
                    className="prof-select"
                    value={patientSort}
                    onChange={(e) => setPatientSort(e.target.value)}
                  >
                    <option value="recent">Mais recentes</option>
                    <option value="oldest">Mais antigos</option>
                    <option value="name">Nome (A-Z)</option>
                  </select>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleResetPatientFilters}
                  disabled={!hasPatientFilters}
                >
                  Limpar filtros
                </Button>
              </div>

              <div className="patient-grid">
                {pacientesFiltrados.length === 0 ? (
                  <div className="empty-state laines-feedback-state">Nenhum atleta encontrado.</div>
                ) : (
                  pacientesFiltrados.map((paciente) => (
                    <button
                      key={paciente.id}
                      type="button"
                      onClick={() => onSelectPatient?.(paciente)}
                      className="patient-card"
                    >
                      <div className="patient-card-top">
                        <div className="patient-avatar">
                          {paciente.nome.charAt(0)}
                        </div>
                        <div className="patient-action">
                          <Eye size={18} />
                        </div>
                      </div>
                      <h3>{paciente.nome}</h3>
                      <span className={`patient-status-pill status-${normalizePatientStatus(paciente.status).replace(/\s+/g, '-')}`}>
                        {getPatientStatusLabel(paciente.status)}
                      </span>
                      <p>
                        Última avaliação: {paciente.ultimaAvaliacao || '---'}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="empty-panel">
              <div className="empty-icon">
                <Users size={32} />
              </div>
              <h3>Selecione um aluno</h3>
              <p>Escolha um aluno ao lado para visualizar os pacientes.</p>
            </div>
          )}
        </div>
      </section>}

      <PatientModal
        isOpen={isPatientModalOpen}
        onClose={() => setPatientModalOpen(false)}
        onCreate={handleCreatePatient}
        onSave={() => setPatientModalOpen(false)}
      />
    </div>
  );
};

export default ProfessorDashboard;

function normalizeEvaluationType(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');
}
