import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { usePacientes } from '../../contexts/PacienteContext';
import api, { getApiErrorMessage } from '../../services/api';
import { toDate } from '../../utils/dateUtils';
import { useUiFeedback } from '../../contexts/UiFeedbackContext';
import {
  Users,
  ClipboardList,
  Eye,
  ChevronRight,
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
import { StatCard as UiStatCard } from '../../components/ui';
import EvaluationSummaryStrip from '../../components/shared/EvaluationSummaryStrip';
import ClinicalEvaluationResultCard from '../../components/shared/ClinicalEvaluationResultCard';
import {
  getEvaluationStatusLabel,
  getEvaluationTypeLabel
} from '../../components/shared/evaluationSummaryUtils';
import { buildEvaluationResultCollection } from '../../components/shared/evaluationResultAdapter';

import './ProfessorView.css';

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

const ProfessorDashboard = ({ onSelectPatient, activeTab: _activeTab = 'dashboard' }) => {
  const { user } = useAuth();
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
      const { data } = await api.get('/pacientes');
      const list = Array.isArray(data) ? data : [];
      const filtered = list.filter((item) => {
        if (item.professorSupervisorId && item.professorSupervisorId === user.uid) return true;
        if (item.professorSupervisor?.id && item.professorSupervisor.id === user.uid) return true;
        return false;
      }).map((item) => {
        const alunoResponsavel = item.alunoResponsavel || (item.alunoResponsavelId ? {
          id: item.alunoResponsavelId,
          nome: item.alunoResponsavelNome || 'Aluno',
          email: item.alunoResponsavelEmail || ''
        } : null);
        return { ...item, alunoResponsavel };
      });

      setSupervisedPatients(filtered);

      const studentMap = new Map();
      filtered.forEach((paciente) => {
        const aluno = paciente.alunoResponsavel;
        if (!aluno?.id) return;
        if (!studentMap.has(aluno.id)) {
          studentMap.set(aluno.id, {
            id: aluno.id,
            nome: aluno.nome || 'Aluno',
            email: aluno.email || ''
          });
        }
      });
      const studentList = Array.from(studentMap.values()).sort((a, b) => a.nome.localeCompare(b.nome));
      setStudents(studentList);
      setLastSyncedAt(new Date());
    } catch (error) {
      console.error('Erro ao buscar pacientes do professor:', error);
      notify({
        type: 'error',
        title: 'Erro ao buscar pacientes',
        message: getApiErrorMessage(error, 'Não foi possível carregar os pacientes supervisionados.')
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
      pacientes: patientsByStudent[aluno.id] || []
    }));

    if (fromStudents.length > 0) {
      return fromStudents.sort((a, b) => a.nome.localeCompare(b.nome));
    }

    const fallback = Object.entries(patientsByStudent).map(([id, list]) => ({
      id,
      nome: list[0]?.alunoResponsavel?.nome || 'Aluno',
      email: list[0]?.alunoResponsavel?.email || '',
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
    if (!alunoSelecionado) return;
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

  return (
    <div className="professor-dashboard">
      <header className="professor-header">
        <div>
          <span className="section-label">PAINEL DO PROFESSOR</span>
          <h1>Área do Professor</h1>
          <p>
            Ola, Prof. {professorFirstName}. Acompanhe o
            progresso da sua turma.
          </p>
        </div>

        <div className="professor-header-actions">
          <div className="professor-status-card">
            <div className="status-icon">
              <UserCheck size={20} />
            </div>
            <div>
              <p className="status-label">Status da turma</p>
              <strong className="status-value">100% supervisionada</strong>
            </div>
          </div>
          <div className="professor-refresh-card">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => loadPatients({ silent: true })}
              disabled={isRefreshing || loadingStudents || loadingPatients}
            >
              <RefreshCw size={16} className={isRefreshing ? 'is-rotating' : ''} />
              {isRefreshing ? 'Atualizando...' : 'Atualizar painel'}
            </Button>
            <span className="professor-refresh-meta">{syncLabel}</span>
          </div>
        </div>
      </header>

      <section className="professor-stats">
        <button
          type="button"
          className={`stat-card-action ${activeMetric === 'patients' ? 'active' : ''}`}
          onClick={() => setActiveMetric(activeMetric === 'patients' ? '' : 'patients')}
        >
          <UiStatCard
            title="Atletas supervisionados"
            value={metricsLoading ? '...' : metrics.totalPatients}
            icon={Users}
            meta={`${alunos.length || 0} alunos`}
          />
        </button>
        <button
          type="button"
          className={`stat-card-action ${activeMetric === 'done' ? 'active' : ''}`}
          onClick={() => setActiveMetric(activeMetric === 'done' ? '' : 'done')}
        >
          <UiStatCard
            title="Avaliações realizadas"
            value={metricsLoading ? '...' : metrics.evaluationsMonth}
            icon={ClipboardList}
            meta="Finalizadas no mês"
          />
        </button>
        <button
          type="button"
          className={`stat-card-action ${activeMetric === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveMetric(activeMetric === 'pending' ? '' : 'pending')}
        >
          <UiStatCard
            title="Avaliações pendentes"
            value={metricsLoading ? '...' : metrics.pendingEvaluations}
            icon={AlertTriangle}
            meta="Com status em aberto"
          />
        </button>
        <UiStatCard
          title="Consultas futuras"
          value={metricsLoading ? '...' : metrics.nextAppointments}
          icon={CalendarCheck}
          meta="Agendadas"
        />
        <UiStatCard
          title="Lista de espera"
          value={metricsLoading ? '...' : metrics.waitlistPatients}
          icon={Hourglass}
          meta="Atletas aguardando"
        />
        <UiStatCard
          title="Taxa de comparecimento"
          value={metricsLoading ? '...' : `${metrics.attendanceRate}%`}
          icon={Percent}
          meta={
            metricsLoading
              ? 'Calculando...'
              : metrics.attendanceTotal
                ? `${metrics.attendanceTotal} atendimentos`
                : 'Sem atendimentos'
          }
        />
      </section>

      {activeMetric && (
        <section className="professor-metric-panel">
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
                <div className="metric-empty laines-feedback-state">Nenhum paciente supervisionado.</div>
              ) : (
                supervisedPatientsList.map((patient) => (
                  <button
                    key={patient.id}
                    type="button"
                    className="metric-item"
                    onClick={() => onSelectPatient?.(patient)}
                  >
                    <div className="metric-main">
                      <strong>{patient.nome || 'Atleta'}</strong>
                      <span>{patient.alunoResponsavel?.nome || 'Aluno não informado'}</span>
                    </div>
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
                    <button
                      key={item.id || `done-result-${index}`}
                      type="button"
                      className="metric-item metric-item--result"
                      onClick={() => patient && onSelectPatient?.(patient)}
                      disabled={!patient}
                    >
                      <div className="metric-main metric-main--result">
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
                        <strong>{getPatientName(item)}</strong>
                      </div>
                      <span className="metric-meta">{formatEvaluationDate(item)}</span>
                    </button>
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
                    <button
                      key={item.id || `pending-result-${index}`}
                      type="button"
                      className="metric-item metric-item--result"
                      onClick={() => patient && onSelectPatient?.(patient)}
                      disabled={!patient}
                    >
                      <div className="metric-main metric-main--result">
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
                        <strong>{getPatientName(item)}</strong>
                      </div>
                      <span className="metric-meta">{getEvaluationStatusLabel(item.status || 'pendente')}</span>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </section>
      )}

      <section className="professor-grid">
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
                    <p>{aluno.pacientes.length} pacientes</p>
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
                  <h2>Pacientes de {alunoSelecionado.nome}</h2>
                  <p className="muted">
                    {alunoSelecionado.email || 'Email não informado'}
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  type="button"
                  onClick={() => setPatientModalOpen(true)}
                >
                  <Plus size={18} />
                  Novo paciente
                </Button>
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
                  <div className="empty-state laines-feedback-state">Nenhum paciente encontrado.</div>
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
                      <p className={`patient-status-pill status-${normalizePatientStatus(paciente.status).replace(/\s+/g, '-')}`}>
                        {getPatientStatusLabel(paciente.status)}
                      </p>
                      <p>
                        Última avaliação: {paciente.ultimaAvaliacao || '---'}
                      </p>
                      <span className="patient-link">
                        Ver evolução clínica <ChevronRight size={14} />
                      </span>
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
      </section>

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
