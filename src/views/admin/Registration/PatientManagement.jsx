import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  Download,
  RefreshCcw,
  Activity,
  CheckCircle,
  Clock,
  Phone,
  Dumbbell,
  Edit,
  Trash2,
  Eye,
  Loader2,
  Link2,
  AlertCircle,
  X
} from 'lucide-react';
import api, { getApiErrorMessage } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import { usePacientes } from '../../../contexts/PacienteContext';
import { useUiFeedback } from '../../../contexts/UiFeedbackContext';
import { logAudit } from '../../../services/audit';
import { useModalBodyLock } from '../../../hooks/useModalBodyLock';
import PatientModal from './PatientModal';
import LinkPatientModal from '../Patients/LinkPatientModal';
import AthleteOnboardingWizard from '../../../components/Atleta/AthleteOnboardingWizard';
import { generateInstitutionalEmail } from '../../../utils/institutionalEmail';
import { downloadCsv } from './exportUtils';
import './ManagementPages.css';

const getStatusClassName = (status) => {
  const value = (status || '').toLowerCase();
  if (value === 'ativo') return 'admin-status-chip admin-status-chip--active';
  if (value === 'inativo' || value === 'alta') return 'admin-status-chip admin-status-chip--inactive';
  return 'admin-status-chip admin-status-chip--warning';
};

const getAvatarClassName = (status) => {
  const value = (status || '').toLowerCase();
  return value === 'ativo' ? 'admin-avatar admin-avatar--green' : 'admin-avatar admin-avatar--neutral';
};

const getInitial = (name) => (name || 'P').trim().charAt(0).toUpperCase();
const getStatusLabel = (status) => {
  const value = String(status || '').trim().toLowerCase();
  if (value === 'ativo') return 'Ativo';
  if (value === 'inativo') return 'Inativo';
  if (value === 'alta') return 'Alta';
  if (value === 'pendente') return 'Pendente';
  if (!value) return 'Sem status';
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
};

const PAGE_SIZE = 25;

const PatientManagement = ({ onOpenPatient = null }) => {
  const [patients, setPatients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [error, setError] = useState(null);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [linkingPatient, setLinkingPatient] = useState(null);
  const [students, setStudents] = useState([]);
  const [selectedPatients, setSelectedPatients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkProjectId, setBulkProjectId] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [deletingPatientId, setDeletingPatientId] = useState('');
  const [openingPatientId, setOpeningPatientId] = useState('');
  const [visiblePatientCount, setVisiblePatientCount] = useState(PAGE_SIZE);
  const { notify, confirm } = useUiFeedback();

  const { user } = useAuth();
  const { vincularPaciente, getAlunosDisponiveis } = usePacientes();

  useModalBodyLock(bulkModalOpen);

  const fetchPatients = useCallback(async ({ preserveCurrent = false } = {}) => {
    try {
      if (preserveCurrent) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }
      const { data } = await api.get('/pacientes');
      const list = Array.isArray(data) ? data : [];
      const sorted = list.slice().sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
      setPatients(sorted);
      setLastSyncedAt(new Date());
      setError(null);
    } catch (error) {
      console.error('Erro ao carregar atletas:', error);
      const message = getApiErrorMessage(error, 'Não foi possível carregar a lista de atletas.');
      notify({
        type: 'error',
        title: 'Erro ao carregar atletas',
        message
      });
      setError(message);
      setPatients([]);
    } finally {
      if (preserveCurrent) {
        setIsRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, [notify]);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  useEffect(() => {
    const loadProjects = async () => {
      try {
        const { data } = await api.get('/projetos');
        const sorted = Array.isArray(data)
          ? data.slice().sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
          : [];
        setProjects(sorted);
      } catch (error) {
        console.error('Erro ao carregar projetos:', error);
        setProjects([]);
      }
    };
    loadProjects();
  }, []);

  const stats = {
    total: patients.length,
    inTreatment: patients.filter((patient) => patient.status?.toLowerCase() === 'ativo').length,
    discharged: patients.filter((patient) => ['alta', 'concluido'].includes(patient.status?.toLowerCase())).length,
    waiting: patients.filter((patient) => ['espera', 'triagem', 'pendente', 'lista de espera'].includes(patient.status?.toLowerCase())).length
  };

  const loadStudents = useCallback(async () => {
    try {
      const alunos = await getAlunosDisponiveis();
      const patientsByAluno = patients.reduce((accumulator, patient) => {
        const alunoId = patient.alunoResponsavel?.id || patient.alunoResponsavelId;
        if (alunoId) accumulator[alunoId] = (accumulator[alunoId] || 0) + 1;
        return accumulator;
      }, {});

      const limit = 5;
      const mapped = alunos.map((aluno) => {
        const count = patientsByAluno[aluno.id] || 0;
        const disponivel = Math.max(0, limit - count);
        return {
          ...aluno,
          pacientesAtuais: count,
          disponivel,
          limiteAtingido: disponivel === 0,
          professor: aluno.supervisorNome || aluno.professorSupervisor?.nome || aluno.professor || ''
        };
      });
      setStudents(mapped);
    } catch (error) {
      console.error('Erro ao buscar alunos:', error);
      notify({
        type: 'error',
        title: 'Erro ao buscar alunos',
        message: getApiErrorMessage(error, 'Não foi possível carregar os alunos disponíveis.')
      });
      setStudents([]);
    }
  }, [getAlunosDisponiveis, notify, patients]);

  const handleOpenLinkModal = (patient) => {
    setLinkingPatient(patient);
    setIsLinkModalOpen(true);
  };

  const handleOpenPatientProntuario = async (patient) => {
    setOpeningPatientId(patient?.id || '');
    if (typeof onOpenPatient !== 'function') {
      notify({
        type: 'info',
        title: 'Prontuário indisponível',
        message: 'A visualização do prontuário não está disponível nesta tela.'
      });
      setOpeningPatientId('');
      return;
    }
    try {
      await onOpenPatient(patient);
    } finally {
      setOpeningPatientId('');
    }
  };

  const handleLinkPatient = async (patientId, studentId) => {
    await vincularPaciente(patientId, studentId);
    await loadStudents();
  };

  useEffect(() => {
    if (isLinkModalOpen) {
      loadStudents();
    }
  }, [isLinkModalOpen, loadStudents]);

  useEffect(() => {
    if (!bulkModalOpen) return;
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !bulkLoading) {
        event.preventDefault();
        setBulkModalOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [bulkModalOpen, bulkLoading]);

  const statCards = [
    { id: 'total', label: 'Total de Atletas', value: stats.total, icon: Users, tone: 'blue' },
    { id: 'active', label: 'Em Atendimento', value: stats.inTreatment, icon: Activity, tone: 'green' },
    { id: 'discharged', label: 'Altas Realizadas', value: stats.discharged, icon: CheckCircle, tone: 'purple' },
    { id: 'waiting', label: 'Fila de Espera', value: stats.waiting, icon: Clock, tone: 'amber' }
  ];

  const filteredPatients = patients.filter((patient) => {
    const term = searchTerm.trim().toLowerCase();
    const normalizedStatus = String(patient.status || '').toLowerCase();
    const normalizedProject = String(patient.projetoId || '').toLowerCase();

    const matchesSearch = !term
      || patient.nome?.toLowerCase().includes(term)
      || patient.modalidade?.toLowerCase().includes(term)
      || patient.modalidadePrincipal?.toLowerCase().includes(term);
    const matchesStatus = statusFilter === 'all' || normalizedStatus === statusFilter;
    const matchesProject = projectFilter === 'all' || normalizedProject === projectFilter;

    return matchesSearch && matchesStatus && matchesProject;
  });

  const visiblePatients = useMemo(
    () => filteredPatients.slice(0, visiblePatientCount),
    [filteredPatients, visiblePatientCount]
  );

  const canLoadMorePatients = visiblePatients.length < filteredPatients.length;

  const statusOptions = Array.from(
    new Set(
      patients
        .map((patient) => String(patient.status || '').toLowerCase())
        .filter(Boolean)
    )
  ).sort((a, b) => getStatusLabel(a).localeCompare(getStatusLabel(b), 'pt-BR'));

  const activeFilterCount = (statusFilter !== 'all' ? 1 : 0) + (projectFilter !== 'all' ? 1 : 0);
  const hasSearchTerm = searchTerm.trim().length > 0;
  const hasActiveCriteria = hasSearchTerm || activeFilterCount > 0;

  useEffect(() => {
    setSelectedPatients((prev) => prev.filter((id) => patients.some((patient) => patient.id === id)));
  }, [patients]);

  useEffect(() => {
    setVisiblePatientCount(PAGE_SIZE);
  }, [patients.length, projectFilter, searchTerm, statusFilter]);

  const allFilteredIds = filteredPatients.map((patient) => patient.id);
  const isAllSelected = filteredPatients.length > 0 && allFilteredIds.every((id) => selectedPatients.includes(id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedPatients((prev) => prev.filter((id) => !allFilteredIds.includes(id)));
      return;
    }
    setSelectedPatients((prev) => Array.from(new Set([...prev, ...allFilteredIds])));
  };

  const toggleSelectPatient = (id) => {
    setSelectedPatients((prev) => (
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    ));
  };

  const handleRefresh = useCallback(() => {
    fetchPatients({ preserveCurrent: true });
  }, [fetchPatients]);

  const handleWizardComplete = useCallback(async (dados) => {
    try {
      const nome = dados.nomeCompleto.trim();
      const generatedEmail = generateInstitutionalEmail(nome);
      let atletaUserId = null;

      try {
        const { data: created } = await api.post('/users', {
          name: nome,
          role: 'atleta',
          cpf: dados.cpf || undefined,
          dataNascimento: dados.dataNascimento || undefined,
          telefone: dados.telefone || undefined,
          status: 'ativo'
        });
        atletaUserId = created?.user?.id || null;
        if (created?.tempPassword) {
          notify({ type: 'info', title: 'Senha temporária gerada', message: `Login: ${generatedEmail} — Senha: ${created.tempPassword}`, duration: 12000 });
        }
      } catch (userErr) {
        if (![403, 409].includes(Number(userErr?.response?.status))) throw userErr;
      }

      const observacoesParts = [
        dados.alergiasIntolerancias && `Alergias/intolerâncias: ${dados.alergiasIntolerancias}`,
        dados.medicamentosUso && `Medicamentos em uso: ${dados.medicamentosUso}`,
        dados.observacoesGerais
      ].filter(Boolean);

      await api.post('/pacientes', {
        nome,
        cpf: dados.cpf || '',
        dataNascimento: dados.dataNascimento || '',
        genero: dados.sexoBiologico || 'nao_informado',
        telefone: dados.telefone || '',
        email: generatedEmail || dados.email || '',
        modalidadePrincipal: dados.modalidadePrincipal || '',
        tempoPratica: dados.anosPratica ? String(dados.anosPratica) : '',
        observacoes: observacoesParts.join('\n'),
        atletaUserId,
        status: 'Ativo'
      });

      notify({ type: 'success', title: 'Atleta cadastrado', message: `${nome} foi adicionado com sucesso.` });
      setIsWizardOpen(false);
      fetchPatients({ preserveCurrent: true });
    } catch (err) {
      notify({ type: 'error', title: 'Erro ao cadastrar atleta', message: getApiErrorMessage(err, 'Não foi possível cadastrar o atleta.') });
    }
  }, [notify, fetchPatients]);

  const handleClearFilters = useCallback(() => {
    setStatusFilter('all');
    setProjectFilter('all');
  }, []);

  const handleClearSearchAndFilters = useCallback(() => {
    setSearchTerm('');
    setStatusFilter('all');
    setProjectFilter('all');
  }, []);

  const syncLabel = useMemo(() => {
    if (!lastSyncedAt) return 'Sincronização pendente';
    return `Atualizado às ${lastSyncedAt.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })}`;
  }, [lastSyncedAt]);

  const handleExportPatients = useCallback(() => {
    if (filteredPatients.length === 0) {
      notify({
        type: 'warning',
        title: 'Sem dados para exportar',
        message: 'Ajuste os filtros para exportar o relatório de atletas.'
      });
      return;
    }

    const rows = filteredPatients.map((patient) => [
      patient.nome || '',
      patient.prontuario || '',
      patient.modalidade || patient.modalidadePrincipal || '',
      patient.telefone || '',
      getStatusLabel(patient.status),
      patient.projetoNome || '',
      patient.alunoResponsavel?.nome || patient.alunoResponsavelNome || ''
    ]);

    downloadCsv({
      filename: `atletas_${new Date().toISOString().slice(0, 10)}.csv`,
      headers: ['Nome', 'Prontuário', 'Modalidade', 'Telefone', 'Status', 'Projeto', 'Aluno responsável'],
      rows
    });

    notify({
      type: 'success',
      title: 'Relatório exportado',
      message: `${filteredPatients.length} atletas exportados.`
    });
  }, [filteredPatients, notify]);

  const handleBulkLink = async () => {
    if (selectedPatients.length === 0) return;
    const selectedProject = projects.find((project) => project.id === bulkProjectId) || null;
    const accepted = await confirm({
      title: 'Confirmar vínculo em massa',
      message: selectedProject
        ? `Vincular ${selectedPatients.length} atletas ao projeto "${selectedProject.nome}"?`
        : `Remover o vínculo de projeto de ${selectedPatients.length} atletas?`,
      confirmLabel: 'Aplicar',
      cancelLabel: 'Cancelar',
      variant: 'warning'
    });
    if (!accepted) return;

    setBulkLoading(true);
    try {
      await Promise.all(
        selectedPatients.map(async (patientId) => {
          await api.patch(`/pacientes/${patientId}`, {
            projetoId: selectedProject ? selectedProject.id : null,
            projetoNome: selectedProject ? selectedProject.nome : ''
          });
        })
      );
      notify({
        type: 'success',
        title: 'Projetos atualizados',
        message: 'Vinculo em massa concluido.'
      });
      logAudit({
        user,
        action: 'paciente_bulk_project',
        entity: 'pacientes',
        meta: {
          count: selectedPatients.length,
          projetoId: selectedProject?.id || null
        }
      });
      setSelectedPatients([]);
      setBulkProjectId('');
      setBulkModalOpen(false);
      handleRefresh();
    } catch (error) {
      console.error('Erro ao vincular projetos:', error);
      notify({
        type: 'error',
        title: 'Erro ao vincular projetos',
        message: getApiErrorMessage(error, 'Não foi possível atualizar os atletas.')
      });
    } finally {
      setBulkLoading(false);
    }
  };

  const handleDelete = async (id) => {
    const accepted = await confirm({
      title: 'Inativar atleta',
      message: 'Este atleta sairá das listagens ativas, mas prontuário, avaliações e anexos serão preservados. Deseja continuar?',
      confirmLabel: 'Inativar',
      cancelLabel: 'Cancelar',
      variant: 'danger'
    });
    if (!accepted) return;

    setDeletingPatientId(id);
    try {
      await api.delete(`/pacientes/${id}`);
      setPatients((prev) => prev.filter((item) => item.id !== id));
      setSelectedPatients((prev) => prev.filter((item) => item !== id));
      notify({
        type: 'success',
        title: 'Atleta inativado',
        message: 'Prontuário preservado e ocultado das listagens ativas.'
      });
    } catch (error) {
      console.error('Erro ao inativar atleta:', error);
      notify({
        type: 'error',
        title: 'Erro ao inativar atleta',
        message: getApiErrorMessage(error, 'Não foi possível inativar o atleta.')
      });
    } finally {
      setDeletingPatientId('');
    }
  };

  if (loading && patients.length === 0) {
    return (
      <div className="admin-loading-state">
        <Loader2 className="spin" size={30} />
        <p>Carregando dados...</p>
      </div>
    );
  }

  return (
    <div className="admin-management-page">
      <section className="admin-management-hero admin-management-hero--patients">
        <div className="hero-glow hero-glow--primary" />
        <div className="hero-glow hero-glow--secondary" />
        <div className="admin-management-hero__row">
          <div className="admin-management-hero__content">
            <span className="admin-management-badge">Área do Professor</span>
            <h1 className="admin-management-title">Meus Atletas</h1>
            <p className="admin-management-subtitle">
              Gestão clínica, acompanhamento de modalidades e vínculos de pesquisa.
            </p>
          </div>
          <div className="admin-management-hero__actions">
            <button
              type="button"
              onClick={() => setBulkModalOpen(true)}
              disabled={selectedPatients.length === 0}
              className={`admin-btn ${
                selectedPatients.length > 0 ? 'admin-btn--soft-success' : 'admin-btn--surface'
              }`}
            >
              <Link2 size={17} />
              <span>Vincular ({selectedPatients.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setIsWizardOpen(true)}
              className="admin-btn admin-btn--success"
            >
              <UserPlus size={18} />
              <span>Novo Atleta</span>
            </button>
          </div>
        </div>
      </section>

      <section className="admin-management-stats">
        {statCards.map((card) => (
          <article key={card.id} className="admin-stat-card">
            <div className={`admin-stat-icon admin-stat-icon--${card.tone}`}>
              <card.icon size={24} />
            </div>
            <div className="admin-stat-content">
              <p className="admin-stat-value">{card.value}</p>
              <p className="admin-stat-label">{card.label}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="admin-management-toolbar">
        <div className="admin-management-search">
          <Search size={18} className="admin-search-icon" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="admin-search-input"
              placeholder="Buscar por nome ou modalidade..."
              aria-label="Buscar atletas por nome ou modalidade"
            />
          {searchTerm && (
            <button
              type="button"
              className="admin-search-clear"
              onClick={() => setSearchTerm('')}
              aria-label="Limpar busca"
            >
              <X size={13} />
            </button>
          )}
        </div>
        <div className="admin-toolbar-actions">
          <button
            type="button"
            className={`admin-btn ${(isFilterPanelOpen || activeFilterCount > 0) ? 'admin-btn--soft-success' : 'admin-btn--surface'}`}
            onClick={() => setIsFilterPanelOpen((prev) => !prev)}
          >
            <Filter size={16} />
            <span>{activeFilterCount > 0 ? `Filtros (${activeFilterCount})` : 'Filtrar'}</span>
          </button>
          <button
            type="button"
            className="admin-btn admin-btn--surface"
            onClick={handleExportPatients}
            disabled={filteredPatients.length === 0}
          >
            <Download size={16} />
            <span>Relatório</span>
          </button>
          <button
            type="button"
            className="admin-btn admin-btn--surface"
            onClick={handleRefresh}
            disabled={isRefreshing}
            aria-label="Atualizar lista de atletas"
          >
            {isRefreshing ? <Loader2 size={16} className="spin" /> : <RefreshCcw size={16} />}
            <span>{isRefreshing ? 'Atualizando...' : 'Atualizar'}</span>
          </button>
        </div>
      </section>
      <div className="admin-toolbar-meta" role="status" aria-live="polite">
        <span>{filteredPatients.length} de {patients.length} resultado(s) exibido(s)</span>
        {hasActiveCriteria && <span>Critérios de busca/filtro ativos</span>}
        {isRefreshing && <span>Sincronizando dados...</span>}
        <span>{syncLabel}</span>
      </div>

      {isFilterPanelOpen && (
        <section className="admin-inline-filters">
          <div className="admin-inline-filter-group">
            <div className="admin-inline-field">
              <label htmlFor="patients-filter-status">Status</label>
              <select
                id="patients-filter-status"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="admin-select"
              >
                <option value="all">Todos</option>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {getStatusLabel(status)}
                  </option>
                ))}
              </select>
            </div>
            <div className="admin-inline-field">
              <label htmlFor="patients-filter-project">Projeto</label>
              <select
                id="patients-filter-project"
                value={projectFilter}
                onChange={(event) => setProjectFilter(event.target.value)}
                className="admin-select"
              >
                <option value="all">Todos</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="admin-inline-filter-actions">
            <button
              type="button"
              className="admin-btn admin-btn--ghost"
              onClick={handleClearFilters}
              disabled={activeFilterCount === 0}
            >
              Limpar filtros
            </button>
          </div>
        </section>
      )}

      <section className="admin-management-panel">
        {error && (
          <div className="admin-alert-error">
            <AlertCircle size={18} />
            <p>{error}</p>
            <div className="admin-alert-error__actions">
              <button type="button" className="admin-btn admin-btn--ghost" onClick={fetchPatients}>
                Tentar novamente
              </button>
            </div>
          </div>
        )}

        {filteredPatients.length === 0 ? (
          <div className="admin-empty-state">
            <div className="admin-empty-icon">
              <Users size={30} />
            </div>
            <h3 className="admin-empty-title">Nenhum atleta encontrado</h3>
            <p className="admin-empty-text">
              {hasActiveCriteria
                ? 'Ajuste a busca ou filtros para localizar atletas.'
                : 'Cadastre um novo atleta para iniciar o acompanhamento.'}
            </p>
            <div className="admin-empty-actions">
              {hasActiveCriteria ? (
                <button
                  type="button"
                  className="admin-btn admin-btn--ghost"
                  onClick={handleClearSearchAndFilters}
                >
                  Limpar busca e filtros
                </button>
              ) : (
                <button
                  type="button"
                  className="admin-btn admin-btn--success"
                  onClick={() => setIsWizardOpen(true)}
                >
                  <UserPlus size={16} />
                  <span>Cadastrar atleta</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="admin-table-header">
              <h3 className="admin-list-title">Lista de Atletas</h3>
              <span className="admin-count-chip">{visiblePatients.length} de {filteredPatients.length} encontrados</span>
            </div>

            <p className="admin-table-hint">Em telas menores, deslize horizontalmente para ver todas as colunas.</p>

            <div className="admin-management-table-wrap">
              <table className="admin-management-table">
                <thead>
                  <tr>
                    <th className="admin-select-col">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={toggleSelectAll}
                        className="admin-check-input"
                        aria-label="Selecionar todos os atletas filtrados"
                      />
                    </th>
                    <th>Atleta</th>
                    <th>Modalidade</th>
                    <th>Contato</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {visiblePatients.map((patient) => {
                    const isRowBusy = deletingPatientId === patient.id || openingPatientId === patient.id;
                    return (
                      <tr key={patient.id} className={isRowBusy ? 'admin-row-busy' : ''} aria-busy={isRowBusy}>
                      <td className="admin-select-col">
                        <input
                          type="checkbox"
                          checked={selectedPatients.includes(patient.id)}
                          onChange={() => toggleSelectPatient(patient.id)}
                          className="admin-check-input"
                          disabled={isRowBusy}
                          aria-label={`Selecionar atleta ${patient.nome || ''}`}
                        />
                      </td>
                      <td className="admin-cell-user">
                        <div className="admin-user-block">
                          <div className={getAvatarClassName(patient.status)}>
                            {getInitial(patient.nome)}
                          </div>
                          <div>
                            <p className="admin-user-name">{patient.nome || 'Atleta sem nome'}</p>
                            <p className="admin-user-meta">Prontuário: {patient.prontuario || '---'}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="admin-row-muted" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Dumbbell size={14} />
                          <span>{patient.modalidade || patient.modalidadePrincipal || 'Clínica Geral'}</span>
                        </div>
                      </td>
                      <td>
                        <div className="admin-row-muted" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Phone size={13} />
                          <span>{patient.telefone || 'Não informado'}</span>
                        </div>
                      </td>
                      <td>
                        <span className={getStatusClassName(patient.status)}>
                          <span className="admin-status-dot" />
                          {getStatusLabel(patient.status)}
                        </span>
                      </td>
                      <td>
                        <div className="admin-table-actions">
                          <button
                            type="button"
                            onClick={() => handleOpenLinkModal(patient)}
                            className="admin-action-btn admin-action-btn--link"
                            title="Vincular"
                            disabled={isRowBusy}
                          >
                            <Link2 size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (isRowBusy) return;
                              setSelectedPatient(patient);
                              setIsModalOpen(true);
                            }}
                            className="admin-action-btn admin-action-btn--edit"
                            title="Editar"
                            disabled={isRowBusy}
                          >
                            <Edit size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(patient.id)}
                            className="admin-action-btn admin-action-btn--delete"
                            title="Inativar"
                            disabled={isRowBusy}
                          >
                            {deletingPatientId === patient.id ? <Loader2 size={15} className="spin" /> : <Trash2 size={15} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenPatientProntuario(patient)}
                            className="admin-action-btn admin-action-btn--view"
                            title="Visualizar"
                            disabled={isRowBusy}
                          >
                            {openingPatientId === patient.id ? <Loader2 size={15} className="spin" /> : <Eye size={15} />}
                          </button>
                        </div>
                      </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {canLoadMorePatients && (
              <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '0.9rem' }}>
                <div className="admin-loadmore-wrap">
                  {filteredPatients.length > 0 ? (
                    <p className="admin-loadmore-meta">
                      A mostrar {visiblePatients.length} de {filteredPatients.length}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    className="admin-btn admin-btn--surface"
                    onClick={() => setVisiblePatientCount((prev) => Math.min(prev + PAGE_SIZE, filteredPatients.length))}
                  >
                    Carregar mais ({filteredPatients.length - visiblePatients.length} restantes)
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      <PatientModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedPatient(null);
        }}
        onSave={() => {
          setIsModalOpen(false);
          setSelectedPatient(null);
          handleRefresh();
        }}
        initialData={selectedPatient}
      />

      {isWizardOpen && (
        <AthleteOnboardingWizard
          onComplete={handleWizardComplete}
          onClose={() => setIsWizardOpen(false)}
        />
      )}

      <LinkPatientModal
        isOpen={isLinkModalOpen}
        onClose={() => {
          setIsLinkModalOpen(false);
          setLinkingPatient(null);
        }}
        onLink={handleLinkPatient}
        patient={linkingPatient}
        students={students}
      />

      {bulkModalOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="admin-bulk-modal-backdrop app-modal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !bulkLoading) {
              setBulkModalOpen(false);
            }
          }}
        >
          <div
            className="admin-bulk-modal app-modal-shell app-modal-shell--sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="bulk-project-modal-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="admin-bulk-modal__header app-modal-header">
              <div className="app-modal-heading">
                <h2 id="bulk-project-modal-title" className="admin-bulk-modal__title app-modal-title">Vincular projeto</h2>
                <p className="admin-bulk-modal__subtitle app-modal-subtitle">
                  Selecione o projeto para {selectedPatients.length} atletas.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBulkModalOpen(false)}
                className="app-modal-close"
                title="Fechar"
                aria-label="Fechar modal de vínculo de projeto"
                disabled={bulkLoading}
              >
                <X size={16} />
              </button>
            </div>

            <div className="admin-bulk-modal__body app-modal-body">
              <div className="admin-bulk-modal__field">
                <label className="admin-bulk-modal__label">Projeto de pesquisa</label>
                <select
                  value={bulkProjectId}
                  onChange={(event) => setBulkProjectId(event.target.value)}
                  className="admin-select"
                  disabled={bulkLoading}
                >
                  <option value="">Sem projeto</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="admin-bulk-modal__footer app-modal-footer">
              <div className="app-modal-actions">
                <button
                  type="button"
                  onClick={() => setBulkModalOpen(false)}
                  className="app-modal-btn app-modal-btn--secondary"
                  disabled={bulkLoading}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleBulkLink}
                  disabled={bulkLoading}
                  className="app-modal-btn app-modal-btn--primary"
                >
                  {bulkLoading ? 'Atualizando...' : 'Vincular projeto'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default PatientManagement;

