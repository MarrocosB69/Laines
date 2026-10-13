import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api, { getApiErrorMessage } from '../../../services/api';
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Clock3,
  Edit2,
  Eye,
  FileText,
  FlaskConical,
  Heart,
  LayoutGrid,
  Lightbulb,
  Link as LinkIcon,
  List,
  MessageSquare,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  Users
} from 'lucide-react';
import Button from '../../../components/ui/Button';
import { AttachmentThumbnail } from '../../../components/ui';
import { PainelIndicadores, PainelLista, PainelSecao, PainelVisaoGeral } from '../../../components/painel/Painel';
import { useUiFeedback } from '../../../contexts/UiFeedbackContext';
import Table from '../common/Table';
import ResearchProjectModal from './ResearchProjectModal';
import ProductionModal from './ProductionModal';
import IdeaModal from './IdeaModal';
import IdeaDetailModal from './IdeaDetailModal';
import { logAudit } from '../../../services/audit';
import { useAuth } from '../../../contexts/AuthContext';
import { ADMIN_ROLES, DIRETORIA_ROLES, getDiretoriaPermissionSource, isStudentMemberRole, normalizeRole } from '../../../constants/roles';
import { getUserDisplayName, normalizeUserList } from '../../../utils/userAdapter';

import './ResearchProjects.css';

const STATUS_LABELS = {
  planejamento: 'Planejamento',
  em_andamento: 'Em andamento',
  concluido: 'Concluído',
  pausado: 'Pausado',
  publicado: 'Publicado',
  em_revisao: 'Em revisão',
  rascunho: 'Rascunho',
  ideia: 'Ideia',
  em_discussao: 'Em discussão',
  prioridade: 'Prioridade',
  arquivada: 'Arquivada'
};

const TIPO_LABELS = {
  artigo: 'Artigo',
  resumo: 'Resumo',
  poster: 'Pôster',
  relatorio: 'Relatório',
  material: 'Material',
  documento: 'Documento'
};

const AREA_LABELS = {
  nutricao: 'Nutrição',
  fisioterapia: 'Fisioterapia',
  psicologia: 'Psicologia',
  multidisciplinar: 'Multidisciplinar',
  outros: 'Outros'
};

const RESEARCH_SECTION_META = {
  overview: {
    title: 'Pesquisa',
    description: 'Projetos, ideias e produções científicas da liga em um só lugar.'
  },
  repository: {
    title: 'Repositório',
    description: 'Produções científicas, arquivos e links validados pela pesquisa.'
  },
  projects: {
    title: 'Projetos de pesquisa',
    description: 'Cadastro, acompanhamento e equipe dos projetos científicos.'
  },
  ideas: {
    title: 'Ideias de pesquisa',
    description: 'Propostas abertas para estudantes criarem, consultarem e demonstrarem interesse.'
  }
};

const IDEA_PROGRESS_STEPS = ['ideia', 'em_discussao', 'prioridade'];

const PROJECT_STATUS_ALIASES = {
  ativo: 'em_andamento',
  ativa: 'em_andamento',
  andamento: 'em_andamento',
  em_andamento: 'em_andamento',
  finalizado: 'concluido',
  finalizada: 'concluido',
  concluido: 'concluido',
  concluida: 'concluido',
  pausado: 'pausado',
  pausada: 'pausado',
  planejamento: 'planejamento'
};

const normalizeProjectStatus = (status) => {
  const value = String(status || '').trim().toLowerCase();
  return PROJECT_STATUS_ALIASES[value] || value || 'planejamento';
};

const getIdeaInteresses = (idea) => (Array.isArray(idea?.interesses) ? idea.interesses : []);
const getIdeaInterestCount = (idea) => getIdeaInteresses(idea).length;

const hasIdeaInterest = (idea, userId) => {
  const normalizedUserId = String(userId || '').trim();
  if (!normalizedUserId) return false;
  return getIdeaInteresses(idea).some((entry) => String(entry?.id || '').trim() === normalizedUserId);
};

const RESEARCH_ADMIN_ROLES = new Set([
  ...ADMIN_ROLES,
  'diretoria_pesquisa'
]);

const resolvePermissionMessage = (error, fallback, forbiddenMessage) => {
  const status = Number(error?.response?.status || 0);
  if (status === 403) return forbiddenMessage;
  return getApiErrorMessage(error, fallback);
};

const AVALIACOES_PAGE_SIZE = 200;
const AVALIACOES_MAX_PAGES = 250;

const EMPTY_PRODUCTION_FORM = {
  titulo: '',
  projetoId: '',
  tipo: 'artigo',
  autores: '',
  ano: new Date().getFullYear(),
  area: '',
  linkExterno: '',
  descricao: '',
  status: 'em_revisao',
  visibilidade: 'interno_laines'
};

const EMPTY_IDEA_FORM = {
  titulo: '',
  area: 'multidisciplinar',
  status: 'ideia',
  problema: '',
  justificativa: '',
  objetivo: '',
  palavrasChave: '',
  responsavelNome: '',
  observacoes: ''
};

const splitListInput = (value) => String(value || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

const formatDate = (value) => {
  if (!value) return 'Sem data';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sem data';
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

const getArquivoLabel = (item) => {
  const arquivo = item?.arquivo || {};
  return arquivo.name || arquivo.filename || '';
};

const getProductionAttachmentLabel = (item) => (
  getArquivoLabel(item) || item?.titulo || 'Producao'
);

const getCollectionKey = (prefix, item, index) => {
  const id = String(item?.id || '').trim();
  if (id) return id;
  const label = String(item?.titulo || item?.nome || item?.area || item?.createdAt || 'item').trim();
  return `${prefix}-${index}-${label || 'item'}`;
};

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
  showSync = true,
  section = 'overview',
  hideSectionTabs = false,
  onSectionChange
}) => {
  const [projects, setProjects] = useState([]);
  const [productions, setProductions] = useState([]);
  const [ideas, setIdeas] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [avaliacoes, setAvaliacoes] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [activeSection, setActiveSection] = useState(section || 'overview');
  const [repositoryView, setRepositoryView] = useState('list');
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedIdea, setSelectedIdea] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProductionModalOpen, setIsProductionModalOpen] = useState(false);
  const [isIdeaModalOpen, setIsIdeaModalOpen] = useState(false);
  const [productionForm, setProductionForm] = useState(EMPTY_PRODUCTION_FORM);
  const [ideaForm, setIdeaForm] = useState(EMPTY_IDEA_FORM);
  const [productionFile, setProductionFile] = useState(null);
  const [savingProduction, setSavingProduction] = useState(false);
  const [savingIdea, setSavingIdea] = useState(false);
  const [togglingIdeaInterestId, setTogglingIdeaInterestId] = useState(null);
  const [updatingIdeaStatusId, setUpdatingIdeaStatusId] = useState(null);
  const [syncingEvaluations, setSyncingEvaluations] = useState(false);
  const [expandedProjectStudents, setExpandedProjectStudents] = useState(() => new Set());
  const { notify, confirm } = useUiFeedback();
  const { user } = useAuth();
  const normalizedRole = normalizeRole(user?.role);
  const normalizedDiretoria = getDiretoriaPermissionSource(user || {});
  const canManageResearch = RESEARCH_ADMIN_ROLES.has(normalizedRole)
    || (isStudentMemberRole(normalizedRole) && normalizedDiretoria === 'diretoria_pesquisa');
  const canEditProjects = !readOnly && canManageResearch;
  const canCreateIdea = !readOnly && (canManageResearch || isStudentMemberRole(normalizedRole));
  const canShowIdeaInterest = !readOnly
    && (isStudentMemberRole(normalizedRole) || DIRETORIA_ROLES.includes(normalizedRole));
  const headerMeta = RESEARCH_SECTION_META[activeSection] || RESEARCH_SECTION_META.overview;

  const selectSection = useCallback((nextSection) => {
    const safeSection = String(nextSection || 'overview').trim() || 'overview';
    setActiveSection(safeSection);
    onSectionChange?.(safeSection);
  }, [onSectionChange]);

  useEffect(() => {
    setActiveSection(section || 'overview');
  }, [section]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const usersRequest = !canEditProjects
        ? Promise.resolve({ data: [] })
        : api.get('/users/equipe-atendimento').catch(() => ({ data: [] }));
      const [projectsRes, productionsRes, ideasRes, usersRes] = await Promise.all([
        api.get('/projetos'),
        api.get('/projetos/producoes'),
        api.get('/projetos/ideias'),
        usersRequest
      ]);
      const projectsData = Array.isArray(projectsRes.data) ? projectsRes.data : [];
      const productionsData = Array.isArray(productionsRes.data) ? productionsRes.data : [];
      const ideasData = Array.isArray(ideasRes.data) ? ideasRes.data : [];
      const usersData = normalizeUserList(usersRes.data);
      setProjects(projectsData);
      setProductions(productionsData);
      setIdeas(ideasData);
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
  }, [canEditProjects, notify]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const loadOperationalData = useCallback(async () => {
    const [pacientesRes, avaliacoesRes] = await Promise.all([
      api.get('/pacientes').catch(() => ({ data: [] })),
      fetchAllAvaliacoes().catch(() => [])
    ]);
    const pacientesData = Array.isArray(pacientesRes.data) ? pacientesRes.data : [];
    const avaliacoesData = Array.isArray(avaliacoesRes) ? avaliacoesRes : [];
    setPacientes(pacientesData);
    setAvaliacoes(avaliacoesData);
    return { pacientes: pacientesData, avaliacoes: avaliacoesData };
  }, []);

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
      const { pacientes: pacientesData, avaliacoes: avaliacoesData } = await loadOperationalData();

      const pacientesMap = pacientesData.reduce((acc, item) => {
        if (item.id) acc[item.id] = item;
        return acc;
      }, {});
      const missing = avaliacoesData.filter((item) => {
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
  }, [loadData, loadOperationalData, notify, syncingEvaluations, user]);

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

  const productionProjectOptions = useMemo(() => {
    if (canManageResearch) return scopedProjects;
    return [];
  }, [canManageResearch, scopedProjects]);

  const canSubmitProduction = !readOnly && canManageResearch;

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
      filtered = filtered.filter((project) => normalizeProjectStatus(project.status) === activeFilter);
    }

    return filtered;
  }, [scopedProjects, searchTerm, activeFilter]);

  const filteredProductions = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return productions;
    return productions.filter((item) => {
      const autores = Array.isArray(item.autores) ? item.autores.join(' ') : '';
      return [
        item.titulo,
        item.tipo,
        item.area,
        item.projetoNome,
        item.descricao,
        item.linkExterno,
        autores,
        getArquivoLabel(item)
      ].some((value) => String(value || '').toLowerCase().includes(term));
    });
  }, [productions, searchTerm]);

  const filteredIdeas = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return ideas;
    return ideas.filter((item) => {
      const palavras = Array.isArray(item.palavrasChave) ? item.palavrasChave.join(' ') : '';
      const interessados = getIdeaInteresses(item).map((entry) => entry.nome || entry.email || '').join(' ');
      return [
        item.titulo,
        item.area,
        item.status,
        item.problema,
        item.objetivo,
        item.responsavelNome,
        interessados,
        palavras
      ].some((value) => String(value || '').toLowerCase().includes(term));
    });
  }, [ideas, searchTerm]);

  const availableStudents = useMemo(() => {
    if (!allowedCoordinatorId) return students;
    return students.filter((student) => student.supervisorId === allowedCoordinatorId);
  }, [allowedCoordinatorId, students]);

  const stats = useMemo(() => ({
    total: scopedProjects.length,
    producoes: productions.length,
    ideias: ideas.length,
    planejamento: scopedProjects.filter((project) => normalizeProjectStatus(project.status) === 'planejamento').length,
    em_andamento: scopedProjects.filter((project) => normalizeProjectStatus(project.status) === 'em_andamento').length,
    concluido: scopedProjects.filter((project) => normalizeProjectStatus(project.status) === 'concluido').length,
    pacientes: scopedPacientes.length,
    avaliacoes: scopedAvaliacoes.length
  }), [ideas.length, productions.length, scopedAvaliacoes.length, scopedPacientes.length, scopedProjects]);

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

  const totalIdeaInterests = useMemo(
    () => ideas.reduce((total, idea) => total + getIdeaInterestCount(idea), 0),
    [ideas]
  );

  const productionReviewCount = useMemo(
    () => productions.filter((p) => p.status === 'em_revisao').length,
    [productions]
  );

  const contextualStats = useMemo(() => {
    if (activeSection === 'overview') {
      const novasIdeias = ideas.filter((i) => (i.status || 'ideia') === 'ideia').length;
      return [
        { label: 'Projetos ativos', value: stats.em_andamento },
        { label: 'Ideias abertas', value: novasIdeias },
        { label: 'Interesses', value: totalIdeaInterests },
        { label: 'Em revisão', value: productionReviewCount }
      ];
    }
    if (activeSection === 'repository') {
      const emRevisao = productions.filter((p) => p.status === 'em_revisao').length;
      const publicadas = productions.filter((p) => p.status === 'publicado').length;
      return [
        { label: 'Produções', value: productions.length },
        { label: 'Publicadas', value: publicadas },
        { label: 'Em revisão', value: emRevisao },
        { label: 'Projetos', value: stats.total }
      ];
    }
    if (activeSection === 'ideas') {
      const priorizadas = ideas.filter((i) => i.status === 'prioridade').length;
      const emDiscussao = ideas.filter((i) => i.status === 'em_discussao').length;
      return [
        { label: 'Ideias', value: ideas.length },
        { label: 'Priorizadas', value: priorizadas },
        { label: 'Em discussão', value: emDiscussao },
        { label: 'Produções', value: stats.producoes }
      ];
    }
    return [
      { label: 'Projetos', value: stats.total },
      { label: 'Em andamento', value: stats.em_andamento },
      { label: 'Planejamento', value: stats.planejamento },
      { label: 'Concluídos', value: stats.concluido }
    ];
  }, [activeSection, ideas, productionReviewCount, productions, stats, totalIdeaInterests]);

  const overviewIdeas = useMemo(
    () => ideas.filter((idea) => (idea.status || 'ideia') !== 'arquivada').slice(0, 5),
    [ideas]
  );

  const overviewProjects = useMemo(
    () => scopedProjects
      .filter((project) => normalizeProjectStatus(project.status) === 'em_andamento')
      .slice(0, 5),
    [scopedProjects]
  );

  const overviewProductions = useMemo(
    () => productions
      .filter((item) => ['em_revisao', 'rascunho'].includes(item.status || 'em_revisao'))
      .slice(0, 5),
    [productions]
  );

  const resetProductionForm = useCallback(() => {
    setProductionForm({
      ...EMPTY_PRODUCTION_FORM,
      projetoId: productionProjectOptions[0]?.id || '',
      status: 'em_revisao',
      visibilidade: 'interno_laines'
    });
    setProductionFile(null);
  }, [productionProjectOptions]);

  const resetIdeaForm = useCallback(() => {
    setIdeaForm(EMPTY_IDEA_FORM);
  }, []);

  const handleOpenProductionModal = useCallback(() => {
    resetProductionForm();
    setIsProductionModalOpen(true);
  }, [resetProductionForm]);

  const handleOpenIdeaModal = useCallback(() => {
    resetIdeaForm();
    setIsIdeaModalOpen(true);
  }, [resetIdeaForm]);

  const handleSubmitProduction = useCallback(async (event) => {
    event.preventDefault();
    if (savingProduction) return;

    const titulo = productionForm.titulo.trim();
    const linkExterno = productionForm.linkExterno.trim();
    if (!titulo) {
      notify({
        type: 'info',
        title: 'Titulo obrigatorio',
        message: 'Informe o titulo da producao.'
      });
      return;
    }
    if (!canManageResearch) {
      notify({
        type: 'error',
        title: 'Permissao insuficiente',
        message: 'Apenas coordenacao ou diretoria de pesquisa podem cadastrar producoes.'
      });
      return;
    }
    if (!productionFile && !linkExterno) {
      notify({
        type: 'info',
        title: 'Arquivo ou link obrigatorio',
        message: 'Anexe um arquivo ou informe um link para registrar a producao.'
      });
      return;
    }

    setSavingProduction(true);
    try {
      const body = new FormData();
      body.append('titulo', titulo);
      if (productionForm.projetoId) body.append('projetoId', productionForm.projetoId);
      if (productionForm.tipo) body.append('tipo', productionForm.tipo);
      if (productionForm.descricao.trim()) body.append('descricao', productionForm.descricao.trim());
      if (productionForm.area.trim()) body.append('area', productionForm.area.trim());
      if (linkExterno) body.append('linkExterno', linkExterno);
      if (productionForm.ano) body.append('ano', String(productionForm.ano));
      body.append('autores', JSON.stringify(splitListInput(productionForm.autores)));
      body.append('status', productionForm.status);
      body.append('visibilidade', productionForm.visibilidade);
      if (productionFile) body.append('file', productionFile);

      await api.post('/projetos/producoes', body);
      notify({
        type: 'success',
        title: 'Producao registrada',
        message: 'O item foi adicionado ao repositorio.'
      });
      setIsProductionModalOpen(false);
      resetProductionForm();
      await loadData();
    } catch (error) {
      console.error('Erro ao salvar producao:', error);
      notify({
        type: 'error',
        title: 'Erro ao salvar producao',
        message: resolvePermissionMessage(
          error,
          'Nao foi possivel registrar a producao.',
          'Apenas coordenacao ou diretoria de pesquisa podem cadastrar producoes.'
        )
      });
    } finally {
      setSavingProduction(false);
    }
  }, [
    canManageResearch,
    loadData,
    notify,
    productionFile,
    productionForm,
    resetProductionForm,
    savingProduction
  ]);

  const handleSubmitIdea = useCallback(async (event) => {
    event.preventDefault();
    if (savingIdea) return;
    const titulo = ideaForm.titulo.trim();
    if (!titulo) {
      notify({
        type: 'info',
        title: 'Titulo obrigatorio',
        message: 'Informe o titulo da ideia de projeto.'
      });
      return;
    }

    setSavingIdea(true);
    try {
      await api.post('/projetos/ideias', {
        ...ideaForm,
        titulo,
        palavrasChave: splitListInput(ideaForm.palavrasChave)
      });
      notify({
        type: 'success',
        title: 'Ideia cadastrada',
        message: 'A ideia foi publicada para consulta da liga.'
      });
      setIsIdeaModalOpen(false);
      resetIdeaForm();
      await loadData();
    } catch (error) {
      console.error('Erro ao salvar ideia:', error);
      notify({
        type: 'error',
        title: 'Erro ao salvar ideia',
        message: resolvePermissionMessage(
          error,
          'Nao foi possivel cadastrar a ideia.',
          'Apenas membros da liga podem cadastrar ideias.'
        )
      });
    } finally {
      setSavingIdea(false);
    }
  }, [ideaForm, loadData, notify, resetIdeaForm, savingIdea]);

  const handleToggleIdeaInterest = useCallback(async (idea) => {
    if (!idea?.id || !canShowIdeaInterest) return;
    const alreadyInterested = hasIdeaInterest(idea, user?.id);
    setTogglingIdeaInterestId(idea.id);
    try {
      const { data } = alreadyInterested
        ? await api.delete(`/projetos/ideias/${idea.id}/interesse`)
        : await api.post(`/projetos/ideias/${idea.id}/interesse`);

      setIdeas((current) => current.map((item) => (item.id === idea.id ? data : item)));
      setSelectedIdea((current) => (current?.id === idea.id ? data : current));
      notify({
        type: 'success',
        title: alreadyInterested ? 'Interesse removido' : 'Interesse registrado',
        message: alreadyInterested
          ? 'Seu nome saiu da lista de interessados nessa ideia.'
          : 'Seu nome agora aparece entre os interessados nessa ideia.'
      });
    } catch (error) {
      console.error('Erro ao atualizar interesse na ideia:', error);
      notify({
        type: 'error',
        title: 'Erro ao atualizar interesse',
        message: resolvePermissionMessage(
          error,
          'Nao foi possivel atualizar seu interesse nessa ideia.',
          'Apenas discentes da liga podem demonstrar interesse em ideias.'
        )
      });
    } finally {
      setTogglingIdeaInterestId(null);
    }
  }, [canShowIdeaInterest, notify, user?.id]);

  const handleUpdateIdeaStatus = useCallback(async (idea, status) => {
    if (!idea?.id || !canManageResearch) return;
    setUpdatingIdeaStatusId(idea.id);
    try {
      const { data } = await api.patch(`/projetos/ideias/${idea.id}`, { status });
      setIdeas((current) => current.map((item) => (item.id === idea.id ? data : item)));
      setSelectedIdea((current) => (current?.id === idea.id ? data : current));
      notify({
        type: 'success',
        title: 'Ideia atualizada',
        message: `Status alterado para ${STATUS_LABELS[status] || status}.`
      });
    } catch (error) {
      console.error('Erro ao atualizar status da ideia:', error);
      notify({
        type: 'error',
        title: 'Erro ao atualizar ideia',
        message: resolvePermissionMessage(
          error,
          'Nao foi possivel atualizar a ideia.',
          'Apenas coordenacao ou diretoria de pesquisa podem atualizar ideias.'
        )
      });
    } finally {
      setUpdatingIdeaStatusId(null);
    }
  }, [canManageResearch, notify]);

  const handlePublishProduction = useCallback(async (item) => {
    try {
      await api.patch(`/projetos/producoes/${item.id}`, {
        status: 'publicado',
        visibilidade: item.visibilidade || 'interno_laines'
      });
      notify({
        type: 'success',
        title: 'Producao aprovada',
        message: 'O item agora esta disponivel no repositorio.'
      });
      await loadData();
    } catch (error) {
      console.error('Erro ao aprovar producao:', error);
      notify({
        type: 'error',
        title: 'Erro ao aprovar producao',
        message: getApiErrorMessage(error, 'Nao foi possivel aprovar a producao.')
      });
    }
  }, [loadData, notify]);

  const handleOpenProductionFile = useCallback(async (item) => {
    const url = String(item?.arquivo?.url || '').trim();
    if (!url) return;
    try {
      const response = await api.get(url, { responseType: 'blob' });
      const blobUrl = URL.createObjectURL(response.data);
      const anchor = document.createElement('a');
      anchor.href = blobUrl;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.download = getArquivoLabel(item) || 'producao';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (error) {
      console.error('Erro ao abrir arquivo:', error);
      notify({
        type: 'error',
        title: 'Erro ao abrir arquivo',
        message: getApiErrorMessage(error, 'Nao foi possivel abrir o arquivo.')
      });
    }
  }, [notify]);

  const handleToggleProjectStudents = useCallback((projectId) => {
    setExpandedProjectStudents((current) => {
      const next = new Set(current);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  }, []);

  const handleDeleteProject = useCallback(async (project) => {
    if (!project?.id || !canEditProjects) return;
    const accepted = await confirm({
      title: 'Remover projeto',
      message: `Deseja remover "${project.nome || 'projeto selecionado'}"?`,
      confirmLabel: 'Remover',
      cancelLabel: 'Cancelar',
      variant: 'danger'
    });
    if (!accepted) return;

    try {
      await api.delete(`/projetos/${project.id}`);
      logAudit({
        user,
        action: 'projeto_delete',
        entity: 'projetos_pesquisa',
        entityId: project.id,
        meta: { removed: true }
      });
      setExpandedProjectStudents((current) => {
        const next = new Set(current);
        next.delete(project.id);
        return next;
      });
      await loadData();
      notify({
        type: 'success',
        title: 'Projeto removido',
        message: 'O projeto de pesquisa foi removido.'
      });
    } catch (error) {
      console.error('Erro ao remover projeto:', error);
      notify({
        type: 'error',
        title: 'Erro ao remover projeto',
        message: resolvePermissionMessage(
          error,
          'Nao foi possivel remover o projeto.',
          'Seu perfil nao possui permissao para remover projetos.'
        )
      });
    }
  }, [canEditProjects, confirm, loadData, notify, user]);

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
            {Array.isArray(project.alunosNomes) && project.alunosNomes.length > 0 && (
              <div className="project-students">
                <button
                  type="button"
                  className="project-students-toggle"
                  aria-expanded={expandedProjectStudents.has(project.id)}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleToggleProjectStudents(project.id);
                  }}
                >
                  {expandedProjectStudents.has(project.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span>{project.alunosNomes.length} aluno{project.alunosNomes.length === 1 ? '' : 's'}</span>
                </button>
                {expandedProjectStudents.has(project.id) && (
                  <div className="project-students-panel">
                    {project.alunosNomes.map((name, index) => (
                      <span key={`${project.id}-student-${index}-${name}`} className="student-badge">
                        {name}
                      </span>
                    ))}
                  </div>
                )}
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
          {AREA_LABELS[project.area] || project.area || 'Outros'}
        </span>
      )
    },
    {
      key: 'status',
      header: 'Status',
      width: '15%',
      render: (project) => {
        const projectStatus = normalizeProjectStatus(project.status);
        return (
          <span className={`project-tag status-${projectStatus}`}>
            {STATUS_LABELS[projectStatus] || projectStatus || 'Planejamento'}
          </span>
        );
      }
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

    if (canEditProjects) {
      baseColumns.push({
        key: 'actions',
        header: 'Ações',
        width: '10%',
        align: 'right',
        render: (project) => (
          <div className="project-actions">
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
            <button
              type="button"
              className="project-edit project-edit--danger"
              onClick={(event) => {
                event.stopPropagation();
                handleDeleteProject(project);
              }}
            >
              <Trash2 size={16} />
              Excluir
            </button>
          </div>
        )
      });
    }

    return baseColumns;
  }, [
    canEditProjects,
    expandedProjectStudents,
    handleDeleteProject,
    handleToggleProjectStudents,
    projectMetrics
  ]);

  const filters = [
    { id: 'all', label: 'Todos', count: stats.total },
    { id: 'planejamento', label: 'Planejamento', count: stats.planejamento },
    { id: 'em_andamento', label: 'Em andamento', count: stats.em_andamento },
    { id: 'concluido', label: 'Concluídos', count: stats.concluido }
  ];

  const researchFlowCards = [
    { label: 'Ideias', value: ideas.length, icon: Lightbulb, section: 'ideas' },
    { label: 'Planejamento', value: stats.planejamento, icon: Clock3, section: 'projects' },
    { label: 'Em andamento', value: stats.em_andamento, icon: FlaskConical, section: 'projects' },
    { label: 'Em revisão', value: productionReviewCount, icon: MessageSquare, section: 'repository' },
    { label: 'Concluídos', value: stats.concluido, icon: CheckCircle2, section: 'projects' }
  ];

  const renderIdeaCard = (item, { compact = false, keySuffix = 0 } = {}) => {
    const ideaKey = getCollectionKey(compact ? 'idea-compact' : 'idea', item, keySuffix);
    const stepIndex = item.status === 'arquivada'
      ? -1
      : IDEA_PROGRESS_STEPS.indexOf(item.status || 'ideia');
    const interestCount = getIdeaInterestCount(item);
    const userInterested = hasIdeaInterest(item, user?.id);

    return (
      <article key={ideaKey} className={`research-idea-card${compact ? ' research-idea-card--compact' : ''}`}>
        <div className="research-idea-card__header">
          <div className="research-production-icon research-production-icon--idea">
            <Lightbulb size={18} />
          </div>
          <div>
            <span className={`project-tag area-${item.area || 'outros'}`}>
              {AREA_LABELS[item.area] || item.area || 'Multidisciplinar'}
            </span>
            <h3>{item.titulo || 'Ideia sem título'}</h3>
          </div>
        </div>
        <div className="research-idea-progress" aria-label={`Status: ${STATUS_LABELS[item.status] || item.status}`}>
          {IDEA_PROGRESS_STEPS.map((step, idx) => (
            <React.Fragment key={`${ideaKey}-step-${step}`}>
              {idx > 0 && (
                <div className={`research-idea-step-line${idx <= stepIndex ? ' research-idea-step-line--done' : ''}`} />
              )}
              <div className={`research-idea-step-dot${idx <= stepIndex ? ' research-idea-step-dot--done' : ''}`} title={STATUS_LABELS[step]} />
            </React.Fragment>
          ))}
          <span className={`research-idea-progress__label${item.status === 'arquivada' ? ' research-idea-progress__label--arquivada' : ''}`}>
            {STATUS_LABELS[item.status] || item.status || 'Ideia'}
          </span>
        </div>
        {Array.isArray(item.palavrasChave) && item.palavrasChave.length > 0 && (
          <div className="research-inline-tags">
            {item.palavrasChave.map((tag, index) => (
              <span key={`${ideaKey}-tag-${index}-${tag}`}>{tag}</span>
            ))}
          </div>
        )}
        <div className="research-idea-card__content">
          {item.problema && (
            <p><strong>Problema:</strong> {item.problema}</p>
          )}
          {!compact && item.objetivo && (
            <p><strong>Objetivo:</strong> {item.objetivo}</p>
          )}
          {item.responsavelNome && (
            <p><strong>Responsável:</strong> {item.responsavelNome}</p>
          )}
        </div>
        <div className="research-idea-card__footer">
          <span className="research-interest-pill">
            <Users size={14} />
            {interestCount} interessado{interestCount === 1 ? '' : 's'}
          </span>
          <div className="research-idea-card__actions">
            <button
              type="button"
              className="research-action-link"
              onClick={() => setSelectedIdea(item)}
            >
              <Eye size={15} />
              Abrir
            </button>
            {canShowIdeaInterest && (
              <button
                type="button"
                className={`research-action-link${userInterested ? ' research-action-link--strong' : ''}`}
                onClick={() => handleToggleIdeaInterest(item)}
                disabled={togglingIdeaInterestId === item.id}
              >
                <Heart size={15} fill={userInterested ? 'currentColor' : 'none'} />
                {userInterested ? 'Remover interesse' : 'Tenho interesse'}
              </button>
            )}
          </div>
        </div>
      </article>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="research-projects"
    >
      {/* h2, não h1, como em Ensino: o cabeçalho de cada portal já tem o h1
          com o título da página. */}
      <header className="research-header">
        <div className="research-header__texto">
          <div className="header-badge">
            <span className="badge-line" aria-hidden="true" />
            <span>PESQUISA</span>
          </div>
          <h2>{headerMeta.title}</h2>
          <p>{headerMeta.description}</p>
        </div>
        <div className="research-actions">
          {activeSection === 'overview' && canCreateIdea && (
            <Button
              type="button"
              variant="secondary"
              onClick={handleOpenIdeaModal}
            >
              <Lightbulb size={18} />
              Nova ideia
            </Button>
          )}
          {activeSection === 'overview' && canEditProjects && (
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
          )}
          {activeSection === 'repository' && canSubmitProduction && (
            <Button
              type="button"
              variant="primary"
              onClick={handleOpenProductionModal}
            >
              <Upload size={18} />
              Nova produção
            </Button>
          )}
          {activeSection === 'ideas' && canCreateIdea && (
            <Button
              type="button"
              variant="primary"
              onClick={handleOpenIdeaModal}
            >
              <Lightbulb size={18} />
              Nova ideia
            </Button>
          )}
          {activeSection === 'projects' && canEditProjects && (
            <>
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
            </>
          )}
        </div>
      </header>

      {readOnly && (
        <div className="research-readonly-note" role="note" aria-live="polite">
          Você está em modo de leitura. Para criar ou editar projetos, solicite acesso à coordenação.
        </div>
      )}

      {!hideSectionTabs && (
      <div className="research-section-tabs" role="tablist" aria-label="Seções de pesquisa">
        {[
          { id: 'overview', label: 'Painel', icon: LayoutGrid, count: totalIdeaInterests + productionReviewCount },
          { id: 'repository', label: 'Repositório', icon: FileText, count: productions.length },
          { id: 'projects', label: 'Pesquisas', icon: FlaskConical, count: scopedProjects.length },
          { id: 'ideas', label: 'Ideias', icon: Lightbulb, count: ideas.length }
        ].map((section) => {
          const Icon = section.icon;
          return (
            <button
              key={section.id}
              type="button"
              role="tab"
              aria-selected={activeSection === section.id}
              className={`research-section-tab ${activeSection === section.id ? 'active' : ''}`}
              onClick={() => selectSection(section.id)}
            >
              <Icon size={16} />
              {section.label}
              {section.count > 0 && (
                <span className="research-section-tab__count">{section.count}</span>
              )}
            </button>
          );
        })}
      </div>
      )}

      <div className="research-stats">
        {contextualStats.map((item) => (
          <div key={item.label} className="stat-card">
            <div className="stat-label">{item.label}</div>
            <div className="stat-value">{item.value}</div>
          </div>
        ))}
      </div>

      {/* Painel da área com as peças da Visão geral (src/components/painel/),
          como em Ensino: os cartões de fluxo viram indicadores clicáveis, as
          ideias ocupam a linha e as duas listas compactas viram raias. Mesmos
          dados, textos, destinos, ordem e condições de antes. */}
      {activeSection === 'overview' && (
        <PainelVisaoGeral className="research-painel">
          <PainelSecao
            id="pesquisa-fluxo"
            className="research-painel__largo research-painel__fluxo"
            titulo="Fluxo da pesquisa"
            descricao="Status geral dos projetos, ideias e produções."
          >
            <PainelIndicadores
              rotulo="Fluxo da pesquisa"
              itens={researchFlowCards.map((item) => ({
                id: item.label,
                rotulo: item.label,
                valor: item.value,
                icone: item.icon,
                onClick: () => selectSection(item.section)
              }))}
            />
          </PainelSecao>

          {/* "Carregando ideias..." continua escrito: o estado `carregando`
              da seção trocaria o texto por um esqueleto. */}
          <PainelSecao
            id="pesquisa-ideias-recentes"
            className="research-painel__largo"
            titulo="Ideias recentes"
            descricao="Propostas abertas para consulta e interesse dos discentes."
            acao={{ rotulo: 'Ver ideias', onClick: () => selectSection('ideas') }}
            estado={!loading && overviewIdeas.length === 0 ? 'vazio' : 'pronto'}
            vazio={{ titulo: 'Nenhuma ideia aberta no momento.' }}
          >
            {loading ? (
              <div className="research-empty-panel research-empty-panel--compact" role="status">Carregando ideias...</div>
            ) : (
              <div className="research-overview-list">
                {overviewIdeas.map((item, index) => renderIdeaCard(item, { compact: true, keySuffix: index }))}
              </div>
            )}
          </PainelSecao>

          <PainelSecao
            id="pesquisa-projetos-ativos"
            className="research-painel__raia"
            titulo="Projetos ativos"
            descricao="Pesquisas em execução pela liga."
            acao={{ rotulo: 'Ver projetos', onClick: () => selectSection('projects') }}
            estado={overviewProjects.length === 0 ? 'vazio' : 'pronto'}
            vazio={{ titulo: 'Nenhum projeto em andamento.' }}
          >
            <PainelLista
              rotuloAcessivel="Projetos ativos"
              itens={overviewProjects.map((project, index) => ({
                id: getCollectionKey('overview-project', project, index),
                titulo: project.nome || 'Projeto sem título',
                subtitulo: project.coordenador || 'Coordenação não informada',
                onClick: () => selectSection('projects')
              }))}
            />
          </PainelSecao>

          <PainelSecao
            id="pesquisa-producoes-revisao"
            className="research-painel__raia"
            titulo="Produções em revisão"
            descricao="Itens aguardando validação para o repositório."
            acao={{ rotulo: 'Ver repositório', onClick: () => selectSection('repository') }}
            estado={overviewProductions.length === 0 ? 'vazio' : 'pronto'}
            vazio={{ titulo: 'Nenhuma produção em revisão.' }}
          >
            <PainelLista
              rotuloAcessivel="Produções em revisão"
              itens={overviewProductions.map((item, index) => ({
                id: getCollectionKey('overview-production', item, index),
                titulo: item.titulo || 'Produção sem título',
                meta: STATUS_LABELS[item.status] || item.status || 'Em revisão',
                onClick: () => selectSection('repository')
              }))}
            />
          </PainelSecao>
        </PainelVisaoGeral>
      )}

      {/* Os dois painéis de insights viram seções do Painel, lado a lado a
          partir de 72rem. Mesmos rótulos, valores e condição de vazio. */}
      {activeSection === 'projects' && (
      <PainelVisaoGeral className="research-painel research-insights">
        <PainelSecao
          id="pesquisa-distribuicao-area"
          className="research-painel__raia"
          titulo="Distribuição por área"
          estado={areaStats.length === 0 ? 'vazio' : 'pronto'}
          vazio={{ titulo: 'Nenhum projeto cadastrado.' }}
        >
          <div className="insight-list">
            {areaStats.map((item, index) => (
              <div key={item.area || `area-${index}`} className="insight-row">
                <span className="insight-label">{AREA_LABELS[item.area] || item.area}</span>
                <span className="insight-value">{item.total}</span>
              </div>
            ))}
          </div>
        </PainelSecao>
        <PainelSecao
          id="pesquisa-resumo-impacto"
          className="research-painel__raia"
          titulo="Resumo de impacto"
        >
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
        </PainelSecao>
      </PainelVisaoGeral>
      )}

      {activeSection !== 'overview' && (
      <div className="research-controls">
        <div className="search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder={
              activeSection === 'repository'
                ? 'Buscar por título, autor, arquivo ou link'
                : activeSection === 'ideas'
                  ? 'Buscar por ideia, área, palavra-chave ou responsável'
                  : 'Buscar por nome, área, coordenador'
            }
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>
        {activeSection === 'projects' && (
          <div className="filters">
            {filters.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setActiveFilter(filter.id)}
                className={`filter-btn ${activeFilter === filter.id ? 'active' : ''}`}
                aria-pressed={activeFilter === filter.id}
              >
                <span>{filter.label}</span>
                <span className="count">{filter.count}</span>
              </button>
            ))}
          </div>
        )}
        {activeSection !== 'projects' && (
          <div className="research-view-toggle" role="group" aria-label="Modo de visualização">
            <button
              type="button"
              className={repositoryView === 'list' ? 'active' : ''}
              onClick={() => setRepositoryView('list')}
              aria-label="Visualizar em lista"
              aria-pressed={repositoryView === 'list'}
            >
              <List size={16} />
            </button>
            <button
              type="button"
              className={repositoryView === 'board' ? 'active' : ''}
              onClick={() => setRepositoryView('board')}
              aria-label="Visualizar em quadro"
              aria-pressed={repositoryView === 'board'}
            >
              <LayoutGrid size={16} />
            </button>
          </div>
        )}
      </div>
      )}

      {activeSection === 'repository' && (
        <div className={`research-repository research-repository--${repositoryView}`}>
          {!canSubmitProduction && !readOnly && (
            <div className="research-readonly-note research-readonly-note--inline" role="note">
              Você pode consultar o repositório; cadastro e aprovação de produções ficam com a diretoria de pesquisa.
            </div>
          )}
          {loading ? (
            <div className="research-empty-panel research-empty-panel--center">
              <FileText size={28} className="research-empty-icon" />
              <p>Carregando produções...</p>
            </div>
          ) : filteredProductions.length === 0 ? (
            <div className="research-empty-panel research-empty-panel--center">
              <FileText size={28} className="research-empty-icon" />
              <p>Nenhuma produção registrada ainda.</p>
              <p className="research-empty-hint">A diretoria de pesquisa pode anexar artigos, pôsteres ou relatórios vinculados às pesquisas da liga.</p>
            </div>
          ) : (
            filteredProductions.map((item, index) => (
              <article key={getCollectionKey('production', item, index)} className={`research-production-card research-production-card--${item.tipo || 'documento'}`}>
                <div className="research-production-card__main">
                  <AttachmentThumbnail
                    className="research-production-thumbnail"
                    compact
                    name={getProductionAttachmentLabel(item)}
                    mimeType={item.arquivo?.mimeType || item.arquivo?.type || ''}
                    size={item.arquivo?.size || null}
                  />
                  <div className="research-production-body">
                    <div className="research-production-topline">
                      <span className={`research-tipo-badge research-tipo-badge--${item.tipo || 'documento'}`}>
                        {TIPO_LABELS[item.tipo] || item.tipo || 'Documento'}
                      </span>
                      <span className={`project-tag status-${item.status || 'em_revisao'}`}>
                        {STATUS_LABELS[item.status] || item.status || 'Em revisão'}
                      </span>
                    </div>
                    <h3>{item.titulo || 'Produção sem título'}</h3>
                    <p>{item.descricao || 'Sem descrição registrada.'}</p>
                    <div className="research-production-meta">
                      <span>{item.projetoNome || 'Sem pesquisa vinculada'}</span>
                      {item.ano && <span>{item.ano}</span>}
                      <span>{formatDate(item.createdAt)}</span>
                    </div>
                    {Array.isArray(item.autores) && item.autores.length > 0 && (
                      <div className="research-inline-tags">
                        {item.autores.map((name, authorIndex) => (
                          <span key={`${getCollectionKey('production-author', item, index)}-${authorIndex}-${name}`}>{name}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="research-production-actions">
                  {item.linkExterno && (
                    <a
                      href={item.linkExterno}
                      target="_blank"
                      rel="noreferrer"
                      className="research-action-link"
                    >
                      <LinkIcon size={16} />
                      Link
                    </a>
                  )}
                  {item.arquivo?.url && (
                    <button
                      type="button"
                      className="research-action-link"
                      onClick={() => handleOpenProductionFile(item)}
                    >
                      <Paperclip size={16} />
                      Arquivo
                    </button>
                  )}
                  {canManageResearch && item.status !== 'publicado' && (
                    <button
                      type="button"
                      className="research-action-link research-action-link--primary"
                      onClick={() => handlePublishProduction(item)}
                    >
                      Aprovar
                    </button>
                  )}
                </div>
              </article>
            ))
          )}
        </div>
      )}

      {activeSection === 'projects' && (
        <div className="research-table">
          <Table
            columns={columns}
            data={filteredProjects}
            loading={loading}
            emptyMessage="Nenhum projeto cadastrado."
          />
        </div>
      )}

      {activeSection === 'ideas' && (
        <div className={`research-ideas research-ideas--${repositoryView}`}>
          {loading ? (
            <div className="research-empty-panel research-empty-panel--center">
              <Lightbulb size={28} className="research-empty-icon" />
              <p>Carregando ideias...</p>
            </div>
          ) : filteredIdeas.length === 0 ? (
            <div className="research-empty-panel research-empty-panel--center">
              <Lightbulb size={28} className="research-empty-icon" />
              <p>Nenhuma ideia cadastrada ainda.</p>
              <p className="research-empty-hint">Qualquer discente da liga pode sugerir temas para futuras pesquisas.</p>
            </div>
          ) : (
            filteredIdeas.map((item, index) => renderIdeaCard(item, { keySuffix: index }))
          )}
        </div>
      )}

      <AnimatePresence>
        {isModalOpen && (
          <ResearchProjectModal
            key="research-project-modal"
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
        {isProductionModalOpen && (
          <ProductionModal
            key="research-production-modal"
            isOpen={isProductionModalOpen}
            onClose={() => setIsProductionModalOpen(false)}
            onSubmit={handleSubmitProduction}
            form={productionForm}
            setForm={setProductionForm}
            file={productionFile}
            onFileChange={setProductionFile}
            saving={savingProduction}
            projects={productionProjectOptions}
            canManageResearch={canManageResearch}
          />
        )}
        {isIdeaModalOpen && (
          <IdeaModal
            key="research-idea-modal"
            isOpen={isIdeaModalOpen}
            onClose={() => setIsIdeaModalOpen(false)}
            onSubmit={handleSubmitIdea}
            form={ideaForm}
            setForm={setIdeaForm}
            saving={savingIdea}
            canManageResearch={canManageResearch}
          />
        )}
        {!!selectedIdea && (
          <IdeaDetailModal
            key={`research-idea-detail-${selectedIdea.id || 'selected'}`}
            isOpen={!!selectedIdea}
            onClose={() => setSelectedIdea(null)}
            idea={selectedIdea}
            areaLabels={AREA_LABELS}
            statusLabels={STATUS_LABELS}
            canShowInterest={canShowIdeaInterest}
            userHasInterest={hasIdeaInterest(selectedIdea, user?.id)}
            onToggleInterest={handleToggleIdeaInterest}
            togglingInterest={selectedIdea ? togglingIdeaInterestId === selectedIdea.id : false}
            canManageResearch={canManageResearch}
            onStatusChange={handleUpdateIdeaStatus}
            statusSaving={selectedIdea ? updatingIdeaStatusId === selectedIdea.id : false}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ResearchProjects;
