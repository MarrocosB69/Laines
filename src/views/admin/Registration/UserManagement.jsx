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
  Copy,
  Check,
  GraduationCap,
  Briefcase,
  Loader2,
  AlertCircle,
  Users,
  X
} from 'lucide-react';
import api, { getApiErrorMessage } from '../../../services/api';
import { useUiFeedback } from '../../../contexts/UiFeedbackContext';
import { isStudentMemberRole } from '../../../constants/roles';
import { normalizeUserList } from '../../../utils/userAdapter';
import UserModal from './UserModal';
import { downloadCsv } from './exportUtils';
import './ManagementPages.css';

const getRoleLabel = (role) => {
  const value = (role || '').toLowerCase();
  if (value === 'admin' || value === 'tecnico') return 'Administrador';
  if (value === 'coordenacao') return 'Coordenação';
  if (value === 'presidente') return 'Presidente';
  if (value === 'vice') return 'Vice-presidente';
  if (value === 'professor' || value === 'profissional') return 'Professor';
  if (value === 'aluno') return 'Aluno';
  return role || 'Usuário';
};

const getRoleClassName = (role) => {
  const value = (role || '').toLowerCase();
  if (['admin', 'coordenacao', 'presidente', 'vice', 'tecnico'].includes(value)) return 'admin-role-chip admin-role-chip--admin';
  if (value === 'professor' || value === 'profissional') return 'admin-role-chip admin-role-chip--professor';
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
  if (['admin', 'coordenacao', 'presidente', 'vice', 'tecnico'].includes(value)) return 'admin-avatar admin-avatar--slate';
  if (value === 'professor' || value === 'profissional') return 'admin-avatar admin-avatar--purple';
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

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [error, setError] = useState(null);
  const [copiedUserId, setCopiedUserId] = useState(null);
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [resettingUserId, setResettingUserId] = useState(null);
  const [deletingUserId, setDeletingUserId] = useState(null);
  const { notify, confirm } = useUiFeedback();

  const loadUsers = useCallback(async ({ preserveCurrent = false } = {}) => {
    if (preserveCurrent) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const { data } = await api.get('/users');
      const normalized = normalizeUserList(data);
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
      title: 'Remover usuário',
      message: 'Tem certeza que deseja remover este usuário?',
      confirmLabel: 'Remover',
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
        title: 'Usuário removido',
        message: 'Registro removido com sucesso.'
      });
    } catch (deleteError) {
      console.error('Erro ao remover usuário:', deleteError);
      notify({
        type: 'error',
        title: 'Erro ao remover usuário',
        message: getApiErrorMessage(deleteError, 'Não foi possível remover o usuário.')
      });
    } finally {
      setDeletingUserId(null);
    }
  };

  const filteredUsers = users.filter((user) => {
    const query = searchTerm.trim().toLowerCase();
    const normalizedRole = String(user.role || '').toLowerCase();
    const normalizedStatus = String(user.status || '').toLowerCase();

    const matchesSearch = !query
      || user.name?.toLowerCase().includes(query)
      || user.email?.toLowerCase().includes(query)
      || normalizedRole.includes(query);
    const matchesRole = roleFilter === 'all' || normalizedRole === roleFilter;
    const matchesStatus = statusFilter === 'all' || normalizedStatus === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });

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

    const rows = filteredUsers.map((user) => [
      user.name || '',
      user.email || '',
      getRoleLabel(user.role),
      getStatusLabel(user.status),
      user.passwordChanged ? 'Sim' : 'Não',
      user.createdAt ? new Date(user.createdAt).toLocaleDateString('pt-BR') : ''
    ]);

    downloadCsv({
      filename: `usuarios_${new Date().toISOString().slice(0, 10)}.csv`,
      headers: ['Nome', 'Email', 'Função', 'Status', 'Senha alterada', 'Data de cadastro'],
      rows
    });

    notify({
      type: 'success',
      title: 'Exportação concluída',
      message: `${filteredUsers.length} usuários exportados.`
    });
  }, [filteredUsers, notify]);

  const handleCopyTemporaryPassword = useCallback(async (user) => {
    if (!user?.temporaryPassword) return;
    try {
      if (!navigator?.clipboard?.writeText) {
        throw new Error('Clipboard indisponivel');
      }
      await navigator.clipboard.writeText(user.temporaryPassword);
      setCopiedUserId(user.id);
      window.setTimeout(() => {
        setCopiedUserId((current) => (current === user.id ? null : current));
      }, 1600);
      notify({
        type: 'success',
        title: 'Senha copiada',
        message: `Senha provisória de ${user.name || 'usuário'} copiada.`
      });
    } catch (copyError) {
      console.error('Erro ao copiar senha provisória:', copyError);
      notify({
        type: 'error',
        title: 'Não foi possível copiar',
        message: 'Copie manualmente a senha provisória exibida na tabela.'
      });
    }
  }, [notify]);

  const handleResetPassword = useCallback(async (user) => {
    if (!user?.id) return;

    const accepted = await confirm({
      title: 'Redefinir senha provisória',
      message: `Deseja gerar uma nova senha provisória para ${user.name || 'este usuário'}?`,
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

      notify({
        type: 'success',
        title: 'Senha redefinida',
        message: 'Nova senha provisória gerada e exibida na lista de usuários.'
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

  const stats = {
    total: users.length,
    students: users.filter((user) => isStudentMemberRole(user.role)).length,
    professors: users.filter((user) => ['professor', 'profissional'].includes((user.role || '').toLowerCase())).length
  };

  if (loading && users.length === 0) {
    return (
      <div className="admin-loading-state">
        <Loader2 className="spin" size={30} />
        <p>Carregando usuários...</p>
      </div>
    );
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
          <div className="admin-alert-error">
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
              ) : (
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
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="admin-table-header">
              <h3 className="admin-list-title">Lista de Usuários</h3>
              <span className="admin-count-chip">{filteredUsers.length} encontrados</span>
            </div>

            <p className="admin-table-hint">Em telas menores, deslize horizontalmente para ver todas as colunas.</p>

            <div className="admin-management-table-wrap">
              <table className="admin-management-table">
                <thead>
                  <tr>
                    <th>Usuário</th>
                    <th>Email</th>
                    <th>Função</th>
                    <th>Acesso inicial</th>
                    <th>Status</th>
                    <th>Cadastro</th>
                    <th style={{ textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => {
                    const isRowBusy = resettingUserId === user.id || deletingUserId === user.id;
                    return (
                      <tr key={user.id} className={isRowBusy ? 'admin-row-busy' : ''} aria-busy={isRowBusy}>
                      <td className="admin-cell-user">
                        <div className="admin-user-block">
                          <div className={getAvatarClassName(user.role)}>
                            {(user.name || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="admin-user-name">{user.name || 'Não informado'}</p>
                            <p className="admin-user-meta">{user.matricula || user.crn || 'Staff'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="admin-email-text">{user.email || '---'}</td>
                      <td>
                        <span className={getRoleClassName(user.role)}>
                          {getRoleLabel(user.role)}
                        </span>
                      </td>
                      <td className="admin-access-cell">
                        {user.passwordChanged ? (
                          <>
                            <span className="admin-password-state admin-password-state--done">Senha alterada</span>
                            <p className="admin-password-hint">Usuário já definiu a senha pessoal.</p>
                          </>
                        ) : user.temporaryPassword ? (
                          <>
                            <div className="admin-temp-password-row">
                              <code className="admin-temp-password">{user.temporaryPassword}</code>
                              <button
                                type="button"
                                className="admin-temp-copy-btn"
                                onClick={() => handleCopyTemporaryPassword(user)}
                                title="Copiar senha provisória"
                                disabled={isRowBusy}
                              >
                                {copiedUserId === user.id ? <Check size={14} /> : <Copy size={14} />}
                              </button>
                            </div>
                            <p className="admin-password-hint">Senha provisória ativa (primeiro acesso).</p>
                          </>
                        ) : (
                          <>
                            <span className="admin-password-state admin-password-state--pending">Não informada</span>
                            <p className="admin-password-hint">Conta sem registro de senha provisória.</p>
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
                            disabled={isRowBusy}
                          >
                            <Edit size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(user.id)}
                            className="admin-action-btn admin-action-btn--delete"
                            title="Excluir"
                            disabled={isRowBusy}
                          >
                            {deletingUserId === user.id ? <Loader2 size={15} className="spin" /> : <Trash2 size={15} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleResetPassword(user)}
                            className="admin-action-btn admin-action-btn--security"
                            title="Redefinir senha provisória"
                            disabled={isRowBusy}
                          >
                            {resettingUserId === user.id ? <Loader2 size={15} className="spin" /> : <Shield size={15} />}
                          </button>
                        </div>
                      </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <UserModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedUser(null);
        }}
        onSave={() => {
          setIsModalOpen(false);
          setSelectedUser(null);
          loadUsers({ preserveCurrent: true });
        }}
        initialData={selectedUser}
      />
    </div>
  );
};

export default UserManagement;
