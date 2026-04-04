import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api, { getApiErrorMessage } from '../../../services/api';
import { Edit2, Filter, FlaskConical, Plus, RefreshCw, Search } from 'lucide-react';
import Button from '../../../components/ui/Button';

import { useUiFeedback } from '../../../contexts/UiFeedbackContext';
import Table from '../common/Table';
import ResearchProjectModal from './ResearchProjectModal';
import { logAudit } from '../../../services/audit';
import { useAuth } from '../../../contexts/AuthContext';
import { isStudentMemberRole } from '../../../constants/roles';
import { getUserDisplayName, normalizeUserList } from '../../../utils/userAdapter';

import './ResearchProjects.css';

const resolvePermissionMessage = (error, fallback, forbiddenMessage) => {
  const status = Number(error?.response?.status || 0);
  if (status === 403) return forbiddenMessage;
  return getApiErrorMessage(error, fallback);
};

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

const ResearchProjects = ({
  allowedProjectIds = null,
  allowedCoordinatorId = null,
  readOnly = false,
  showSync = true
}) => {
  const [projects, setProjects] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [avaliacoes, setAvaliacoes] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedProject, setSelectedProject] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [syncingEvaluations, setSyncingEvaluations] = useState(false);
  const { notify } = useUiFeedback();
  const { user } = useAuth();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const usersRequest = readOnly
        ? Promise.resolve({ data: [] })
        : api.get('/users').catch(() => ({ data: [] }));
      const [projectsRes, pacientesRes, avaliacoesRes, usersRes] = await Promise.all([
        api.get('/projetos'),
        api.get('/pacientes'),
        fetchAllAvaliacoes(),
        usersRequest
      ]);
      const projectsData = Array.isArray(projectsRes.data) ? projectsRes.data : [];
      const pacientesData = Array.isArray(pacientesRes.data) ? pacientesRes.data : [];
      const avaliacoesData = Array.isArray(avaliacoesRes) ? avaliacoesRes : [];
      const usersData = normalizeUserList(usersRes.data);
      setProjects(projectsData);
      setPacientes(pacientesData);
      setAvaliacoes(avaliacoesData);
      setStudents(usersData.filter((item) => isStudentMemberRole(item.role)));
    } catch (error) {
      console.error('Erro ao carregar projetos:', error);
      notify({
        type: 'error',
        title: 'Erro ao carregar projetos',
        message: resolvePermissionMessage(
          error,
          'Não foi possível carregar os projetos.',
          'Seu perfil não possui permissão para acessar os dados de pesquisa.'
        )
      });
    } finally {
      setLoading(false);
    }
  }, [notify, readOnly]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = useCallback(async (payload) => {
    try {
      const selectedIds = payload.alunosIds || [];
      if (selectedIds.length > 0) {
        const projectId = selectedProject?.id || null;
        const exceeded = selectedIds.filter((studentId) => {
          const currentProjects = projects.filter((project) => {
            if (projectId && project.id === projectId) return false;
            const ids = project.alunosIds || [];
            return ids.includes(studentId);
          });
          return currentProjects.length >= 2;
        });

        if (exceeded.length > 0) {
          const names = exceeded
            .map((id) => getUserDisplayName(students.find((student) => student.id === id), id))
            .join(', ');
          throw new Error(`Os seguintes alunos já estão em 2 pesquisas: ${names}`);
        }
      }

      const alunosNomes = (payload.alunosIds || []).map(
        (id) => getUserDisplayName(students.find((student) => student.id === id), id)
      );
      const basePayload = {
        ...payload,
        alunosNomes
      };

      if (selectedProject?.id) {
        await api.patch(`/projetos/${selectedProject.id}`, {
          ...basePayload
        });
        logAudit({
          user,
          action: 'projeto_update',
          entity: 'projetos_pesquisa',
          entityId: selectedProject.id,
          meta: { status: payload.status }
        });
      } else {
        const { data } = await api.post('/projetos', {
          ...basePayload,
          coordenadorId: allowedCoordinatorId || payload.coordenadorId || null,
          coordenador: payload.coordenador || user?.name || user?.email || ''
        });
        logAudit({
          user,
          action: 'projeto_create',
          entity: 'projetos_pesquisa',
          entityId: data?.id,
          meta: { status: payload.status }
        });
      }
      setIsModalOpen(false);
      setSelectedProject(null);
      await loadData();
      notify({
        type: 'success',
        title: 'Projeto salvo',
        message: 'Projeto de pesquisa atualizado com sucesso.'
      });
    } catch (error) {
      console.error('Erro ao salvar projeto:', error);
      notify({
        type: 'error',
        title: 'Erro ao salvar projeto',
        message: resolvePermissionMessage(
          error,
          'Não foi possível salvar o projeto.',
          'Seu perfil não possui permissão para criar ou editar projetos.'
        )
      });
    }
  }, [allowedCoordinatorId, loadData, notify, projects, selectedProject, students, user]);

  const handleSyncEvaluations = useCallback(async () => {
    if (syncingEvaluations) return;
    setSyncingEvaluations(true);
    try {
      const pacientesMap = pacientes.reduce((acc, item) => {
        if (item.id) acc[item.id] = item;
        return acc;
      }, {});
      const missing = avaliacoes.filter((item) => {
        if (!item.pacienteId) return false;
        if (item.projetoId) return false;
        const paciente = pacientesMap[item.pacienteId];
        return paciente?.projetoId;
      });

      if (missing.length === 0) {
        notify({
          type: 'info',
          title: 'Nenhuma avaliação pendente',
          message: 'Todas as avaliações já possuem projeto.'
        });
        return;
      }

      const chunkSize = 400;
      let updatedCount = 0;
      for (let i = 0; i < missing.length; i += chunkSize) {
        const chunk = missing.slice(i, i + chunkSize);
        await Promise.all(chunk.map(async (item) => {
          const paciente = pacientesMap[item.pacienteId];
          if (!paciente?.projetoId) return;
          await api.patch(`/avaliacoes/${item.id}`, {
            projetoId: paciente.projetoId,
            projetoNome: paciente.projetoNome || ''
          });
          updatedCount += 1;
        }));
      }

      notify({
        type: 'success',
        title: 'Avaliações atualizadas',
        message: `${updatedCount} avaliação(ões) sincronizadas.`
      });
      logAudit({
        user,
        action: 'avaliacao_sync',
        entity: 'avaliacoes',
        meta: { updatedCount }
      });
      await loadData();
    } catch (error) {
      console.error('Erro ao sincronizar avaliações:', error);
      notify({
        type: 'error',
        title: 'Erro ao sincronizar',
        message: resolvePermissionMessage(
          error,
          'Não foi possível atualizar as avaliações.',
          'Seu perfil não possui permissão para sincronizar avaliações.'
        )
      });
    } finally {
      setSyncingEvaluations(false);
    }
  }, [avaliacoes, notify, pacientes, syncingEvaluations, loadData, user]);

  const scopedProjects = useMemo(() => {
    let base = projects;
    if (allowedCoordinatorId) {
      base = base.filter((project) => project.coordenadorId === allowedCoordinatorId);
    }
    if (!Array.isArray(allowedProjectIds)) return base;
    if (allowedProjectIds.length === 0) return [];
    const allowedSet = new Set(allowedProjectIds);
    return base.filter((project) => allowedSet.has(project.id));
  }, [allowedCoordinatorId, allowedProjectIds, projects]);

  const scopedPacientes = useMemo(() => {
    if (!Array.isArray(allowedProjectIds)) return pacientes;
    if (allowedProjectIds.length === 0) return [];
    const allowedSet = new Set(allowedProjectIds);
    return pacientes.filter((item) => allowedSet.has(item.projetoId));
  }, [allowedProjectIds, pacientes]);

  const scopedAvaliacoes = useMemo(() => {
    if (!Array.isArray(allowedProjectIds)) return avaliacoes;
    if (allowedProjectIds.length === 0) return [];
    const allowedSet = new Set(allowedProjectIds);
    return avaliacoes.filter((item) => allowedSet.has(item.projetoId));
  }, [allowedProjectIds, avaliacoes]);

  const filteredProjects = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    let filtered = scopedProjects;

    if (term) {
      filtered = filtered.filter((project) =>
        project.nome?.toLowerCase().includes(term) ||
        project.coordenador?.toLowerCase().includes(term) ||
        project.area?.toLowerCase().includes(term)
      );
    }

    if (activeFilter !== 'all') {
      filtered = filtered.filter((project) => project.status === activeFilter);
    }

    return filtered;
  }, [scopedProjects, searchTerm, activeFilter]);

  const availableStudents = useMemo(() => {
    if (!allowedCoordinatorId) return students;
    return students.filter((student) => student.supervisorId === allowedCoordinatorId);
  }, [allowedCoordinatorId, students]);

  const stats = useMemo(() => ({
    total: scopedProjects.length,
    planejamento: scopedProjects.filter((project) => project.status === 'planejamento').length,
    em_andamento: scopedProjects.filter((project) => project.status === 'em_andamento').length,
    concluido: scopedProjects.filter((project) => project.status === 'concluido').length,
    pacientes: scopedPacientes.length,
    avaliacoes: scopedAvaliacoes.length
  }), [scopedAvaliacoes.length, scopedPacientes.length, scopedProjects]);

  const projectMetrics = useMemo(() => {
    const pacientesByProject = scopedPacientes.reduce((acc, item) => {
      if (!item.projetoId) return acc;
      acc[item.projetoId] = (acc[item.projetoId] || 0) + 1;
      return acc;
    }, {});
    const avaliacoesByProject = scopedAvaliacoes.reduce((acc, item) => {
      if (!item.projetoId) return acc;
      acc[item.projetoId] = (acc[item.projetoId] || 0) + 1;
      return acc;
    }, {});
    return { pacientesByProject, avaliacoesByProject };
  }, [scopedAvaliacoes, scopedPacientes]);

  const areaStats = useMemo(() => {
    const areas = scopedProjects.reduce((acc, project) => {
      const key = project.area || 'outros';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(areas).map(([area, total]) => ({ area, total }));
  }, [scopedProjects]);

  const columns = useMemo(() => {
    const baseColumns = [
    {
      key: 'project',
      header: 'Projeto',
      width: '40%',
      render: (project) => (
        <div className="project-cell">
          <div className="project-icon">
            <FlaskConical size={18} />
          </div>
          <div>
            <h4>{project.nome || 'Projeto sem título'}</h4>
            <p>{project.descricao || 'Sem descrição registrada.'}</p>
            {project.alunosNomes?.length > 0 && (
              <div className="project-students">
                {project.alunosNomes.map((name) => (
                  <span key={name} className="student-badge">
                    {name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )
    },
    {
      key: 'area',
      header: 'Área',
      width: '15%',
      render: (project) => (
        <span className={`project-tag area-${project.area || 'outros'}`}>
          {project.area || 'outros'}
        </span>
      )
    },
    {
      key: 'status',
      header: 'Status',
      width: '15%',
      render: (project) => (
        <span className={`project-tag status-${project.status || 'planejamento'}`}>
          {project.status || 'planejamento'}
        </span>
      )
    },
    {
      key: 'coordenador',
      header: 'Coordenação',
      width: '18%',
      render: (project) => (
        <div className="project-coord">
          <span>{project.coordenador || 'Não informado'}</span>
          {project.equipe?.length > 0 && (
            <span className="project-team">{project.equipe.length} membros</span>
          )}
        </div>
      )
    },
    {
      key: 'metricas',
      header: 'Impacto',
      width: '17%',
      render: (project) => (
        <div className="project-metrics">
          <span>{projectMetrics.pacientesByProject[project.id] || 0} pacientes</span>
          <span>{projectMetrics.avaliacoesByProject[project.id] || 0} avaliações</span>
        </div>
      )
    }
    ];

    if (!readOnly) {
      baseColumns.push({
        key: 'actions',
        header: 'Ações',
        width: '10%',
        align: 'right',
        render: (project) => (
          <button
            type="button"
            className="project-edit"
            onClick={() => {
              setSelectedProject(project);
              setIsModalOpen(true);
            }}
          >
            <Edit2 size={16} />
            Editar
          </button>
        )
      });
    }

    return baseColumns;
  }, [projectMetrics, readOnly]);

  const filters = [
    { id: 'all', label: 'Todos', count: stats.total },
    { id: 'planejamento', label: 'Planejamento', count: stats.planejamento },
    { id: 'em_andamento', label: 'Em andamento', count: stats.em_andamento },
    { id: 'concluido', label: 'Concluídos', count: stats.concluido }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="research-projects"
    >
      <div className="research-header">
        <div>
          <div className="header-badge">
            <div className="badge-line" />
            <span>PROJETOS</span>
          </div>
          <h1>Projetos de pesquisa</h1>
          <p>
            {readOnly
              ? 'Visualização dos projetos vinculados ao seu perfil. Edição indisponível para este acesso.'
              : 'Gestão de projetos, equipe e status de andamento.'}
          </p>
        </div>
        {!readOnly && (
          <div className="research-actions">
            {showSync && (
              <Button
                type="button"
                variant="secondary"
                onClick={handleSyncEvaluations}
                disabled={syncingEvaluations}
              >
                <RefreshCw size={18} />
                {syncingEvaluations ? 'Sincronizando...' : 'Sincronizar avaliações'}
              </Button>
            )}
            <Button
              type="button"
              variant="primary"
              onClick={() => {
                setSelectedProject(null);
                setIsModalOpen(true);
              }}
            >
              <Plus size={18} />
              Novo projeto
            </Button>
          </div>
        )}
      </div>

      {readOnly && (
        <div className="research-readonly-note" role="note" aria-live="polite">
          Você está em modo de leitura. Para criar ou editar projetos, solicite acesso à coordenação.
        </div>
      )}

      <div className="research-stats">
        <div className="stat-card">
          <div className="stat-label">Total</div>
          <div className="stat-value">{stats.total}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Planejamento</div>
          <div className="stat-value">{stats.planejamento}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Em andamento</div>
          <div className="stat-value">{stats.em_andamento}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Concluídos</div>
          <div className="stat-value">{stats.concluido}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Pacientes vinculados</div>
          <div className="stat-value">{stats.pacientes}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avaliações vinculadas</div>
          <div className="stat-value">{stats.avaliacoes}</div>
        </div>
      </div>

      <div className="research-insights">
        <div className="insight-panel">
          <h3>Distribuição por área</h3>
          <div className="insight-list">
            {areaStats.length === 0 ? (
              <span className="insight-empty">Nenhum projeto cadastrado.</span>
            ) : (
              areaStats.map((item) => (
                <div key={item.area} className="insight-row">
                  <span className="insight-label">{item.area}</span>
                  <span className="insight-value">{item.total}</span>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="insight-panel">
          <h3>Resumo de impacto</h3>
          <div className="insight-summary">
            <div>
              <span className="insight-label">Projetos em andamento</span>
              <span className="insight-value">{stats.em_andamento}</span>
            </div>
            <div>
              <span className="insight-label">Projetos planejados</span>
              <span className="insight-value">{stats.planejamento}</span>
            </div>
            <div>
              <span className="insight-label">Avaliações</span>
              <span className="insight-value">{stats.avaliacoes}</span>
            </div>
            <div>
              <span className="insight-label">Pacientes</span>
              <span className="insight-value">{stats.pacientes}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="research-controls">
        <div className="search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder="Buscar por nome, área, coordenador"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>
        <div className="filters">
          {filters.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setActiveFilter(filter.id)}
              className={`filter-btn ${activeFilter === filter.id ? 'active' : ''}`}
            >
              <span>{filter.label}</span>
              <span className="count">{filter.count}</span>
            </button>
          ))}
        </div>
        <button type="button" className="filter-toggle">
          <Filter size={16} />
          Filtrar
        </button>
      </div>

      <div className="research-table">
        <Table
          columns={columns}
          data={filteredProjects}
          loading={loading}
          emptyMessage="Nenhum projeto cadastrado."
        />
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <ResearchProjectModal
            isOpen={isModalOpen}
            onClose={() => {
              setSelectedProject(null);
              setIsModalOpen(false);
            }}
            onSave={handleSave}
            initialData={selectedProject}
            students={availableStudents}
            projects={projects}
            lockCoordinator={!!allowedCoordinatorId}
            defaultCoordinatorName={user?.name || user?.email || ''}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ResearchProjects;


