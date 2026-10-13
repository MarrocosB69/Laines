import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  UserCog,
  UserPlus,
  Search,
  Filter,
  Download,
  RefreshCcw,
  Shield,
  Edit,
  Trash2,
  GraduationCap,
  Briefcase,
  Loader2,
  AlertCircle,
  Users,
  X,
  KeyRound,
  UserCheck,
  CheckSquare,
  Square,
  Copy,
  ShieldCheck
} from 'lucide-react';
import api, { getApiErrorMessage } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import { useUiFeedback } from '../../../contexts/UiFeedbackContext';
import { isStudentMemberRole, normalizeDiretoria, normalizeRole } from '../../../constants/roles';
import { normalizeUserList } from '../../../utils/userAdapter';
import UserModal from './UserModal';
import { downloadCsv } from './exportUtils';
import { FeedbackState } from '../../../components/ui';
import './ManagementPages.css';

const ROLE_ORDER = {
  admin: 0,
  coordenacao: 1,
  presidente: 2,
  vice: 3,
  diretoria_marketing: 4,
  diretoria_ensino: 4,
  diretoria_pesquisa: 4,
  diretoria_extensao: 4,
  coord_atendimento: 5,
  tecnico: 6,
  professor: 7,
  profissional: 8,
  pesquisador: 9,
  colaborador: 10,
  aluno: 11,
  atleta: 12,
};

const ROLE_GROUP = {
  admin: 'gestao', coordenacao: 'gestao',
  diretoria_marketing: 'diretoria', diretoria_ensino: 'diretoria',
  diretoria_pesquisa: 'diretoria', diretoria_extensao: 'diretoria',
  coord_atendimento: 'operacoes', tecnico: 'operacoes',
  professor: 'docentes', profissional: 'docentes',
  pesquisador: 'docentes', colaborador: 'docentes',
  presidente: 'alunos', vice: 'alunos', aluno: 'alunos',
  atleta: 'atletas',
};

const GROUP_LABEL = {
  gestao: 'Gestão',
  diretoria: 'Diretoria',
  operacoes: 'Operações',
  docentes: 'Docentes e Pesquisadores',
  alunos: 'Alunos',
  atletas: 'Atletas',
};

const getRoleLabel = (role) => {
  const value = (role || '').toLowerCase();
  const labels = {
    admin: 'Administrador',
    coordenacao: 'Coordenação',
    presidente: 'Presidente',
    vice: 'Vice-presidente',
    diretoria_marketing: 'Diretoria: Marketing/Comunicação',
    diretoria_ensino: 'Diretoria: Ensino',
    diretoria_pesquisa: 'Diretoria: Pesquisa',
    diretoria_extensao: 'Diretoria: Extensão',
    coord_atendimento: 'Coord. Atendimento',
    tecnico: 'Técnico',
    professor: 'Professor',
    profissional: 'Profissional',
    pesquisador: 'Pesquisador',
    colaborador: 'Colaborador',
    aluno: 'Aluno',
    atleta: 'Atleta',
  };
  return labels[value] || role || 'Usuário';
};

const getRoleClassName = (role) => {
  const value = (role || '').toLowerCase();
  if (['admin', 'coordenacao'].includes(value)) return 'admin-role-chip admin-role-chip--admin';
  if (['diretoria_marketing', 'diretoria_ensino', 'diretoria_pesquisa', 'diretoria_extensao', 'coord_atendimento', 'tecnico'].includes(value)) return 'admin-role-chip admin-role-chip--diretoria';
  if (['professor', 'profissional'].includes(value)) return 'admin-role-chip admin-role-chip--professor';
  if (['pesquisador', 'colaborador'].includes(value)) return 'admin-role-chip admin-role-chip--researcher';
  if (value === 'aluno') return 'admin-role-chip admin-role-chip--student';
  if (value === 'atleta') return 'admin-role-chip admin-role-chip--athlete';
  return 'admin-role-chip admin-role-chip--student';
};

const getStatusClassName = (status) => {
  const value = (status || '').toLowerCase();
  if (value === 'ativo') return 'admin-status-chip admin-status-chip--active';
  if (value === 'bloqueado') return 'admin-status-chip admin-status-chip--blocked';
  if (value === 'inativo') return 'admin-status-chip admin-status-chip--inactive';
  return 'admin-status-chip admin-status-chip--warning';
};

const getAvatarClassName = (role) => {
  const value = (role || '').toLowerCase();
  if (['admin', 'coordenacao'].includes(value)) return 'admin-avatar admin-avatar--slate';
  if (['diretoria_marketing', 'diretoria_ensino', 'diretoria_pesquisa', 'diretoria_extensao', 'coord_atendimento', 'tecnico'].includes(value)) return 'admin-avatar admin-avatar--teal';
  if (['professor', 'profissional'].includes(value)) return 'admin-avatar admin-avatar--purple';
  if (['pesquisador', 'colaborador'].includes(value)) return 'admin-avatar admin-avatar--indigo';
  if (value === 'atleta') return 'admin-avatar admin-avatar--emerald';
  return 'admin-avatar admin-avatar--blue';
};

const getStatusLabel = (status) => {
  const value = String(status || '').trim().toLowerCase();
  if (value === 'ativo') return 'Ativo';
  if (value === 'inativo') return 'Inativo';
  if (value === 'bloqueado') return 'Bloqueado';
  if (!value) return 'Não informado';
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
};

const getDiretoriaLabel = (diretoria) => {
  const normalized = normalizeDiretoria(diretoria);
  const labels = {
    diretoria_marketing: 'Marketing/Comunicação',
    diretoria_ensino: 'Ensino',
    diretoria_pesquisa: 'Pesquisa',
    diretoria_extensao: 'Extensão'
  };
  return labels[normalized] || '';
};

const getStudentSupervisorStatus = (user) => {
  if (!isStudentMemberRole(user?.role)) {
    return null;
  }
  const hasProfessor = Boolean(user?.supervisorId || user?.supervisorNome);
  const hasProfessional = Boolean(user?.profissionalId || user?.profissionalNome);
  return {
    hasProfessor,
    hasProfessional,
    professorName: user?.supervisorNome || 'Professor não vinculado',
    profissionalName: user?.profissionalNome || 'Sem profissional supervisor',
    projectName: user?.projetoNome || 'Sem projeto vinculado',
    diretoriaName: getDiretoriaLabel(user?.diretoria)
  };
};

const PAGE_SIZE = 25;
const USER_FETCH_PAGE_SIZE = 200;

const MANAGED_PERMISSIONS = [
  { key: 'admin:access', label: 'Acesso a administracao', desc: 'Permite acessar o painel administrativo sem mudar o perfil' },
  { key: 'users:manage', label: 'Gerenciar membros', desc: 'Criar, editar e inativar usuarios' },
  { key: 'patients:manage', label: 'Gerenciar atletas', desc: 'Gerenciar cadastros, fila, vinculos e prontuarios de atletas' },
  { key: 'research:manage', label: 'Gerenciar pesquisa', desc: 'Administrar projetos, producoes e ideias de pesquisa' },
  { key: 'research:create', label: 'Criar pesquisa', desc: 'Cadastrar projetos e itens na area de pesquisa' },
  { key: 'research:update-own-area', label: 'Editar pesquisa', desc: 'Editar itens vinculados a propria diretoria de pesquisa' },
  { key: 'extensao:create', label: 'Criar extensao', desc: 'Cadastrar acoes, triagens, capacitacoes e materiais de extensao' },
  { key: 'extensao:update-own-area', label: 'Editar extensao', desc: 'Editar itens vinculados a propria diretoria de extensao' },
  { key: 'ensino:create', label: 'Criar ensino', desc: 'Cadastrar reunioes cientificas, rodas e anexos de ensino' },
  { key: 'ensino:update-own-area', label: 'Editar ensino', desc: 'Editar itens vinculados a propria diretoria de ensino' },
  { key: 'marketing:create', label: 'Criar comunicacao', desc: 'Cadastrar itens da diretoria de marketing/comunicacao' },
  { key: 'marketing:update-own-area', label: 'Editar comunicacao', desc: 'Editar itens da propria diretoria de marketing/comunicacao' },
  { key: 'requests:review', label: 'Revisar solicitacoes', desc: 'Aprovar e recusar solicitacoes de acesso' },
];

const EXPLICIT_PERMISSION_ROLES = [
  'aluno',
  'presidente',
  'vice',
  'diretoria_marketing',
  'diretoria_ensino',
  'diretoria_pesquisa',
  'diretoria_extensao',
  'professor',
  'profissional',
  'pesquisador',
  'colaborador'
];
const USER_MUTATION_ROLES = ['admin', 'coordenacao'];

const PermissionsModal = ({ user: targetUser, onClose, onSaved }) => {
  const [selected, setSelected] = useState(Array.isArray(targetUser?.permissions) ? targetUser.permissions : []);
  const [saving, setSaving] = useState(false);
  const { notify } = useUiFeedback();

  const toggle = (key) => {
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch(`/users/${targetUser.id}/permissions`, { permissions: selected });
      notify({ type: 'success', title: 'Permissões salvas', message: `Permissões de ${targetUser.name} atualizadas.` });
      onSaved(targetUser.id, selected);
      onClose();
    } catch (err) {
      notify({ type: 'error', title: 'Erro', message: getApiErrorMessage(err, 'Não foi possível salvar as permissões.') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="app-modal-overlay admin-perm-overlay" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="app-modal-shell admin-perm-modal" role="dialog" aria-modal="true" aria-labelledby="perm-modal-title">
        <div className="app-modal-header">
          <div className="app-modal-heading">
            <h3 id="perm-modal-title" className="app-modal-title">Permissões extras</h3>
            <p className="app-modal-subtitle">{targetUser.name} · {targetUser.role}</p>
          </div>
          <button type="button" className="app-modal-close" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </div>
        <div className="app-modal-body">
          <p className="admin-perm-modal__intro">
            Permissões são cumulativas ao perfil do usuário. Marque apenas o que for necessário.
          </p>
          <div className="admin-perm-list">
            {MANAGED_PERMISSIONS.map(({ key, label, desc }) => {
              const active = selected.includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggle(key)}
                  className="admin-perm-option"
                  aria-pressed={active}
                >
                  <span className="admin-perm-option__icon">
                    {active ? <CheckSquare size={16} /> : <Square size={16} />}
                  </span>
                  <span className="admin-perm-option__text">
                    <span className="admin-perm-option__label">{label}</span>
                    <span className="admin-perm-option__desc">{desc}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="app-modal-footer">
          <div className="app-modal-actions">
            <button type="button" className="app-modal-btn app-modal-btn--secondary" onClick={onClose} disabled={saving}>Cancelar</button>
            <button type="button" className="app-modal-btn app-modal-btn--primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar permissões'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const UserManagement = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [error, setError] = useState(null);
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [resettingUserId, setResettingUserId] = useState(null);
  const [deletingUserId, setDeletingUserId] = useState(null);
  const [visibleUserCount, setVisibleUserCount] = useState(PAGE_SIZE);
  const [permissionsTarget, setPermissionsTarget] = useState(null);
  const [resetResult, setResetResult] = useState(null);
  const { notify, confirm } = useUiFeedback();
  const canMutateUsers = USER_MUTATION_ROLES.includes(normalizeRole(currentUser?.role));

  const loadUsers = useCallback(async ({ preserveCurrent = false } = {}) => {
    if (preserveCurrent) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const allUsers = [];
      let offset = 0;

      while (true) {
        const { data } = await api.get('/users', {
          params: {
            limit: USER_FETCH_PAGE_SIZE,
            offset
          }
        });
        const page = normalizeUserList(data);
        allUsers.push(...page);

        if (page.length < USER_FETCH_PAGE_SIZE) break;
        offset += USER_FETCH_PAGE_SIZE;
      }

      const normalized = allUsers;
      setUsers(normalized);
      setLastSyncedAt(new Date());
      setError(null);
    } catch (err) {
      console.error('Erro ao carregar usuários:', err);
      setError(getApiErrorMessage(err, 'Erro ao carregar dados.'));
    } finally {
      if (preserveCurrent) {
        setIsRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleDelete = async (id) => {
    const accepted = await confirm({
      title: 'Inativar usuário',
      message: 'Este usuário sairá das listagens ativas e terá as sessões revogadas, mas o histórico será preservado. Deseja continuar?',
      confirmLabel: 'Inativar',
      cancelLabel: 'Cancelar',
      variant: 'danger'
    });
    if (!accepted) return;

    setDeletingUserId(id);
    try {
      await api.delete(`/users/${id}`);
      setUsers((prev) => prev.filter((item) => item.id !== id));
      notify({
        type: 'success',
        title: 'Usuário inativado',
        message: 'Registro preservado e ocultado das listagens ativas.'
      });
    } catch (deleteError) {
      console.error('Erro ao inativar usuário:', deleteError);
      notify({
        type: 'error',
        title: 'Erro ao inativar usuário',
        message: getApiErrorMessage(deleteError, 'Não foi possível inativar o usuário.')
      });
    } finally {
      setDeletingUserId(null);
    }
  };

  const filteredUsers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return users
      .filter((user) => {
        const normalizedRole = String(user.role || '').toLowerCase();
        const normalizedStatus = String(user.status || '').toLowerCase();
        const matchesSearch = !query
          || user.name?.toLowerCase().includes(query)
          || user.email?.toLowerCase().includes(query)
          || normalizedRole.includes(query);
        const matchesRole = roleFilter === 'all' || normalizedRole === roleFilter;
        const matchesStatus = statusFilter === 'all' || normalizedStatus === statusFilter;
        return matchesSearch && matchesRole && matchesStatus;
      })
      .sort((a, b) => {
        const aOrder = ROLE_ORDER[String(a.role || '').toLowerCase()] ?? 99;
        const bOrder = ROLE_ORDER[String(b.role || '').toLowerCase()] ?? 99;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR');
      });
  }, [users, searchTerm, roleFilter, statusFilter]);

  const visibleUsers = useMemo(
    () => filteredUsers.slice(0, visibleUserCount),
    [filteredUsers, visibleUserCount]
  );

  const canLoadMoreUsers = visibleUsers.length < filteredUsers.length;

  const roleOptions = Array.from(
    new Set(
      users
        .map((user) => String(user.role || '').toLowerCase())
        .filter(Boolean)
    )
  ).sort((a, b) => getRoleLabel(a).localeCompare(getRoleLabel(b), 'pt-BR'));

  const statusOptions = Array.from(
    new Set(
      users
        .map((user) => String(user.status || '').toLowerCase())
        .filter(Boolean)
    )
  ).sort((a, b) => getStatusLabel(a).localeCompare(getStatusLabel(b), 'pt-BR'));

  const activeFilterCount = (roleFilter !== 'all' ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0);
  const hasSearchTerm = searchTerm.trim().length > 0;
  const hasActiveCriteria = hasSearchTerm || activeFilterCount > 0;

  const handleRefresh = useCallback(() => {
    loadUsers({ preserveCurrent: true });
  }, [loadUsers]);

  const handleClearFilters = useCallback(() => {
    setRoleFilter('all');
    setStatusFilter('all');
  }, []);

  const handleClearSearchAndFilters = useCallback(() => {
    setSearchTerm('');
    setRoleFilter('all');
    setStatusFilter('all');
  }, []);

  useEffect(() => {
    setVisibleUserCount(PAGE_SIZE);
  }, [roleFilter, searchTerm, statusFilter, users.length]);

  const syncLabel = useMemo(() => {
    if (!lastSyncedAt) return 'Sincronização pendente';
    return `Atualizado às ${lastSyncedAt.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })}`;
  }, [lastSyncedAt]);

  const handleExportUsers = useCallback(() => {
    if (filteredUsers.length === 0) {
      notify({
        type: 'warning',
        title: 'Sem dados para exportar',
        message: 'Ajuste os filtros para exportar a lista de usuários.'
      });
      return;
    }

    const rows = filteredUsers.map((user) => {
      const supervisorStatus = getStudentSupervisorStatus(user);
      return [
      user.name || '',
      user.email || '',
      getRoleLabel(user.role),
      supervisorStatus?.professorName || '',
      supervisorStatus?.profissionalName || '',
      supervisorStatus?.projectName || '',
      supervisorStatus?.diretoriaName || '',
      getStatusLabel(user.status),
      user.passwordChanged ? 'Sim' : 'Não',
      user.createdAt ? new Date(user.createdAt).toLocaleDateString('pt-BR') : ''
      ];
    });

    downloadCsv({
      filename: `usuarios_${new Date().toISOString().slice(0, 10)}.csv`,
      headers: ['Nome', 'E-mail', 'Função', 'Professor supervisor', 'Profissional supervisor', 'Projeto', 'Diretoria', 'Status', 'Senha alterada', 'Data de cadastro'],
      rows
    });

    notify({
      type: 'success',
      title: 'Exportação concluída',
      message: `${filteredUsers.length} usuários exportados.`
    });
  }, [filteredUsers, notify]);

  const handleResetPassword = useCallback(async (user) => {
    if (!user?.id) return;

    const accepted = await confirm({
      title: 'Redefinir senha provisória',
      message: `Deseja gerar uma nova senha provisória para ${user.name || 'este usuário'}? A senha atual será invalidada.`,
      confirmLabel: 'Redefinir',
      cancelLabel: 'Cancelar',
      variant: 'warning'
    });
    if (!accepted) return;

    setResettingUserId(user.id);
    try {
      const { data } = await api.patch(`/users/${user.id}/reset-password`);
      const normalizedResult = normalizeUserList([data?.user || data]);
      const updatedUser = normalizedResult[0] || null;
      if (!updatedUser) {
        await loadUsers();
      } else {
        setUsers((prev) => prev.map((item) => (item.id === user.id ? updatedUser : item)));
      }
      setResetResult({
        name: user.name || '', loginEmail: updatedUser?.email || user.email || '',
        delivery: data?.activation?.delivery
      });
    } catch (resetError) {
      console.error('Erro ao redefinir senha:', resetError);
      notify({
        type: 'error',
        title: 'Falha ao redefinir senha',
        message: getApiErrorMessage(resetError, 'Não foi possível redefinir a senha provisória.')
      });
    } finally {
      setResettingUserId(null);
    }
  }, [confirm, loadUsers, notify]);

  const handlePermissionsSaved = useCallback((userId, newPermissions) => {
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, permissions: newPermissions } : u));
  }, []);

  const stats = {
    total: users.length,
    students: users.filter((user) => isStudentMemberRole(user.role)).length,
    professors: users.filter((user) => ['professor', 'profissional'].includes((user.role || '').toLowerCase())).length
  };

  if (loading && users.length === 0) {
    return <FeedbackState loading skeletonLines={5} />;
  }

  return (
    <div className="admin-management-page">
      <section className="admin-management-hero admin-management-hero--users">
        <div className="hero-glow hero-glow--primary" />
        <div className="hero-glow hero-glow--secondary" />
        <div className="admin-management-hero__row">
          <div className="admin-management-hero__content">
            <span className="admin-management-badge">Institucional</span>
            <h1 className="admin-management-title">Gestão de Usuários</h1>
            <p className="admin-management-subtitle">
              Administração centralizada de alunos, professores e equipe técnica da LAINES.
            </p>
          </div>
          <div className="admin-management-hero__actions">
            {canMutateUsers && (
              <button
                type="button"
                onClick={() => {
                  setSelectedUser(null);
                  setIsModalOpen(true);
                }}
                className="admin-btn admin-btn--primary"
              >
                <UserPlus size={18} />
                <span>Novo Usuário</span>
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="admin-management-stats admin-management-stats--three">
        <article className="admin-stat-card">
          <div className="admin-stat-icon admin-stat-icon--blue">
            <Users size={24} />
          </div>
          <div className="admin-stat-content">
            <p className="admin-stat-value">{stats.total}</p>
            <p className="admin-stat-label">Total Usuários</p>
          </div>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-icon admin-stat-icon--green">
            <GraduationCap size={24} />
          </div>
          <div className="admin-stat-content">
            <p className="admin-stat-value">{stats.students}</p>
            <p className="admin-stat-label">Alunos Ativos</p>
          </div>
        </article>

        <article className="admin-stat-card">
          <div className="admin-stat-icon admin-stat-icon--purple">
            <Briefcase size={24} />
          </div>
          <div className="admin-stat-content">
            <p className="admin-stat-value">{stats.professors}</p>
            <p className="admin-stat-label">Docentes</p>
          </div>
        </article>
      </section>

      <section className="admin-management-toolbar">
        <div className="admin-management-search">
          <Search size={18} className="admin-search-icon" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="admin-search-input"
              placeholder="Buscar por nome, e-mail ou cargo..."
              aria-label="Buscar usuários por nome, e-mail ou cargo"
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
            aria-expanded={isFilterPanelOpen}
          >
            <Filter size={16} />
            <span>{activeFilterCount > 0 ? `Filtros (${activeFilterCount})` : 'Filtrar'}</span>
          </button>
          <button
            type="button"
            className="admin-btn admin-btn--surface"
            onClick={handleExportUsers}
            disabled={filteredUsers.length === 0}
          >
            <Download size={16} />
            <span>Exportar</span>
          </button>
          <button
            type="button"
            className="admin-btn admin-btn--surface"
            onClick={handleRefresh}
            disabled={isRefreshing}
            aria-label="Atualizar lista de usuários"
          >
            {isRefreshing ? <Loader2 size={16} className="spin" /> : <RefreshCcw size={16} />}
            <span>{isRefreshing ? 'Atualizando...' : 'Atualizar'}</span>
          </button>
        </div>
      </section>
      <div className="admin-toolbar-meta" role="status" aria-live="polite">
        <span>{filteredUsers.length} de {users.length} resultado(s) exibido(s)</span>
        {hasActiveCriteria && <span>Critérios de busca/filtro ativos</span>}
        {isRefreshing && <span>Sincronizando dados...</span>}
        <span>{syncLabel}</span>
      </div>

      {isFilterPanelOpen && (
        <section className="admin-inline-filters">
          <div className="admin-inline-filter-group">
            <div className="admin-inline-field">
              <label htmlFor="users-filter-role">Função</label>
              <select
                id="users-filter-role"
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value)}
                className="admin-select"
              >
                <option value="all">Todas</option>
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {getRoleLabel(role)}
                  </option>
                ))}
              </select>
            </div>
            <div className="admin-inline-field">
              <label htmlFor="users-filter-status">Status</label>
              <select
                id="users-filter-status"
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
          <div className="admin-alert-error" role="alert">
            <AlertCircle size={18} />
            <p>{error}</p>
            <div className="admin-alert-error__actions">
              <button type="button" className="admin-btn admin-btn--ghost" onClick={loadUsers}>
                Tentar novamente
              </button>
            </div>
          </div>
        )}

        {filteredUsers.length === 0 ? (
          <div className="admin-empty-state">
            <div className="admin-empty-icon">
              <UserCog size={30} />
            </div>
            <h3 className="admin-empty-title">Nenhum usuário encontrado</h3>
            <p className="admin-empty-text">
              {hasActiveCriteria
                ? 'Ajuste a busca ou filtros para encontrar usuários.'
                : 'Comece cadastrando um novo usuário.'}
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
              ) : canMutateUsers ? (
                <button
                  type="button"
                  className="admin-btn admin-btn--primary"
                  onClick={() => {
                    setSelectedUser(null);
                    setIsModalOpen(true);
                  }}
                >
                  <UserPlus size={16} />
                  <span>Cadastrar usuário</span>
                </button>
              ) : (
                <span className="admin-readonly-note">Você possui acesso de visualização aos membros.</span>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="admin-table-header">
              <h3 id="users-list-title" className="admin-list-title">Lista de Usuários</h3>
              <span className="admin-count-chip">{visibleUsers.length} de {filteredUsers.length} encontrados</span>
            </div>

            <p className="admin-table-hint">Em telas menores, deslize horizontalmente para ver todas as colunas.</p>

            {/* Focável para o teclado rolar a tabela quando ela passa da
                largura; o nome vem do título da lista. */}
            <div
              className="admin-management-table-wrap"
              role="region"
              aria-labelledby="users-list-title"
              tabIndex={0}
            >
              <table className="admin-management-table">
                <thead>
                  <tr>
                    <th scope="col">Usuário</th>
                    <th scope="col">E-mail</th>
                    <th scope="col">Função</th>
                    <th scope="col">Supervisão</th>
                    <th scope="col">Acesso inicial</th>
                    <th scope="col">Status</th>
                    <th scope="col">Cadastro</th>
                    {canMutateUsers && <th scope="col" className="admin-th-actions">Ações</th>}
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    let lastGroup = null;
                    return visibleUsers.flatMap((user) => {
                    const isRowBusy = resettingUserId === user.id || deletingUserId === user.id;
                    const supervisorStatus = getStudentSupervisorStatus(user);
                    const group = ROLE_GROUP[String(user.role || '').toLowerCase()] ?? 'outros';
                    const rows = [];
                    if (group !== lastGroup) {
                      lastGroup = group;
                      rows.push(
                        <tr key={`sep-${group}`} className="admin-group-separator">
                          <td colSpan={canMutateUsers ? 8 : 7}>
                            <span className="admin-group-label">{GROUP_LABEL[group] ?? group}</span>
                          </td>
                        </tr>
                      );
                    }
                    rows.push(
                      <tr key={user.id} className={isRowBusy ? 'admin-row-busy' : ''} aria-busy={isRowBusy}>
                      <th scope="row" className="admin-cell-user">
                        <div className="admin-user-block">
                          <div className={getAvatarClassName(user.role)} aria-hidden="true">
                            {(user.name || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="admin-user-name">{user.name || 'Não informado'}</p>
                            <p className="admin-user-meta">{user.matricula || user.crn || 'Staff'}</p>
                          </div>
                        </div>
                      </th>
                      <td className="admin-email-text">{user.email || '---'}</td>
                      <td>
                        <span className={getRoleClassName(user.role)}>
                          {getRoleLabel(user.role)}
                        </span>
                      </td>
                      <td className="admin-supervision-cell">
                        {supervisorStatus ? (
                          <>
                            <span className={`admin-supervision-state ${supervisorStatus.hasProfessor ? 'admin-supervision-state--ok' : 'admin-supervision-state--missing'}`}>
                              {supervisorStatus.hasProfessor ? 'Professor vinculado' : 'Sem professor'}
                            </span>
                            <p className="admin-supervision-line">
                              Prof.: {supervisorStatus.professorName}
                            </p>
                            <p className="admin-supervision-line">
                              Profissional: {supervisorStatus.profissionalName}
                            </p>
                            <p className="admin-supervision-line">
                              Projeto: {supervisorStatus.projectName}
                            </p>
                            {supervisorStatus.diretoriaName && (
                              <p className="admin-supervision-line">
                                Diretoria: {supervisorStatus.diretoriaName}
                              </p>
                            )}
                          </>
                        ) : (
                          <span className="admin-supervision-empty">Não aplicável</span>
                        )}
                      </td>
                      <td className="admin-access-cell">
                        {user.passwordChanged ? (
                          <>
                            <span className="admin-password-state admin-password-state--done">Senha alterada</span>
                            <p className="admin-password-hint">Usuário já definiu a própria senha.</p>
                          </>
                        ) : (
                          <>
                            <span className="admin-password-state admin-password-state--pending">Ativacao pendente</span>
                            <p className="admin-password-hint">Envie um link ao contato cadastrado para o membro definir a senha.</p>
                          </>
                        )}
                      </td>
                      <td>
                        <span className={getStatusClassName(user.status)}>
                          <span className="admin-status-dot" />
                          {getStatusLabel(user.status)}
                        </span>
                      </td>
                      <td className="admin-date-text">
                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString('pt-BR') : '---'}
                      </td>
                      {canMutateUsers && (
                        <td>
                          <div className="admin-table-actions">
                            <button
                              type="button"
                              onClick={() => {
                                if (isRowBusy) return;
                                setSelectedUser(user);
                                setIsModalOpen(true);
                              }}
                              className="admin-action-btn admin-action-btn--edit"
                              title="Editar"
                              aria-label={`Editar usuário ${user.name || ''}`}
                              disabled={isRowBusy}
                            >
                              <Edit size={15} />
                            </button>
                            {isStudentMemberRole(user.role) && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (isRowBusy) return;
                                  setSelectedUser(user);
                                  setIsModalOpen(true);
                                }}
                                className="admin-action-btn admin-action-btn--link"
                                title="Vincular supervisores"
                                aria-label={`Vincular supervisores de ${user.name || ''}`}
                                disabled={isRowBusy}
                              >
                                <UserCheck size={15} />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDelete(user.id)}
                              className="admin-action-btn admin-action-btn--delete"
                              title="Inativar"
                              aria-label={`Inativar usuário ${user.name || ''}`}
                              disabled={isRowBusy}
                            >
                              {deletingUserId === user.id ? <Loader2 size={15} className="spin" /> : <Trash2 size={15} />}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleResetPassword(user)}
                              className="admin-action-btn admin-action-btn--security"
                              title="Redefinir senha provisória"
                              aria-label={`Redefinir senha provisória de ${user.name || ''}`}
                              disabled={isRowBusy}
                            >
                              {resettingUserId === user.id ? <Loader2 size={15} className="spin" /> : <Shield size={15} />}
                            </button>
                            {EXPLICIT_PERMISSION_ROLES.includes(normalizeRole(user.role)) && (
                              <button
                                type="button"
                                onClick={() => setPermissionsTarget(user)}
                                className={`admin-action-btn admin-action-btn--security${(user.permissions?.length > 0) ? ' admin-action-btn--has-extra' : ''}`}
                                title="Gerenciar permissões extras"
                                aria-label={`Gerenciar permissões extras de ${user.name || ''}${(user.permissions?.length > 0) ? ' (com permissões extras)' : ''}`}
                                disabled={isRowBusy}
                              >
                                <KeyRound size={15} />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                      </tr>
                    );
                    return rows;
                  });
                  })()}
                </tbody>
              </table>
            </div>

            {canLoadMoreUsers && (
              <div className="admin-loadmore-row">
                <div className="admin-loadmore-wrap">
                  {filteredUsers.length > 0 ? (
                    <p className="admin-loadmore-meta">
                      A mostrar {visibleUsers.length} de {filteredUsers.length}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    className="admin-btn admin-btn--surface"
                    onClick={() => setVisibleUserCount((prev) => Math.min(prev + PAGE_SIZE, filteredUsers.length))}
                  >
                    Carregar mais ({filteredUsers.length - visibleUsers.length} restantes)
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      <UserModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedUser(null);
        }}
        onSave={(options = {}) => {
          if (!options?.keepOpen) {
            setIsModalOpen(false);
            setSelectedUser(null);
          }
          loadUsers({ preserveCurrent: true });
        }}
        initialData={selectedUser}
      />

      {permissionsTarget && (
        <PermissionsModal
          user={permissionsTarget}
          onClose={() => setPermissionsTarget(null)}
          onSaved={handlePermissionsSaved}
        />
      )}

      {resetResult && (
        <div
          className="app-modal-overlay admin-cred-overlay"
          role="presentation"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setResetResult(null); }}
        >
          <div className="app-modal-shell admin-cred-card" role="dialog" aria-modal="true" aria-labelledby="cred-card-title">
            <div className="app-modal-header">
              <div className="app-modal-heading">
                <h3 id="cred-card-title" className="app-modal-title admin-cred-card__title">
                  <ShieldCheck size={17} className="admin-cred-card__title-icon" />
                  Link de acesso
                </h3>
                <p className="app-modal-subtitle">Repasse ao usuário — anote antes de fechar.</p>
              </div>
              <button type="button" className="app-modal-close" onClick={() => setResetResult(null)} aria-label="Fechar"><X size={18} /></button>
            </div>
            <div className="app-modal-body admin-cred-card__body">
              <p className="admin-cred-card__name">{resetResult.name}</p>
              <div className="admin-cred-card__field">
                <span className="admin-cred-card__label">Login</span>
                <div className="admin-cred-card__value-row">
                  <code className="admin-cred-card__value">{resetResult.loginEmail}</code>
                  <button
                    type="button"
                    className="admin-temp-copy-btn"
                    title="Copiar login"
                    onClick={() => {
                      navigator.clipboard.writeText(resetResult.loginEmail);
                      notify({ type: 'success', title: 'Copiado', message: 'Login copiado.' });
                    }}
                  >
                    <Copy size={13} />
                  </button>
                </div>
              </div>
              <p className="admin-cred-card__notice">
                {resetResult.delivery === 'sent'
                  ? 'Link enviado ao contato cadastrado. Expira em 15 minutos e pode ser usado uma vez.'
                  : 'O link nao foi enviado. Confira o e-mail de contato no cadastro e a configuracao do servico de email antes de tentar novamente.'}
              </p>
            </div>
            <div className="app-modal-footer">
              <div className="app-modal-actions">
                <button type="button" className="app-modal-btn app-modal-btn--primary" onClick={() => setResetResult(null)}>
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
