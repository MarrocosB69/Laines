import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { MotionConfig, motion } from 'framer-motion';
import {
  CheckCircle,
  CheckCircle2,
  Clock,
  Copy,
  Mail,
  Phone,
  UserPlus,
  XCircle
} from 'lucide-react';
import api, { getApiErrorMessage } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import { useUiFeedback } from '../../../contexts/UiFeedbackContext';
import Table from '../common/Table';
import { logAudit } from '../../../services/audit';

import './AccessRequests.css';

const STATUS_LABELS = {
  pendente: 'Pendente',
  aprovado: 'Aprovado',
  recusado: 'Recusado'
};

const AccessRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('pendente');
  const [createdCredentials, setCreatedCredentials] = useState(null);
  const [copiedField, setCopiedField] = useState(null);
  const { user } = useAuth();
  const { notify, confirm } = useUiFeedback();

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/solicitacoes-acesso');
      const items = Array.isArray(data) ? data : [];
      setRequests(items);
    } catch (error) {
      console.error('Erro ao carregar solicitações:', error);
      notify({
        type: 'error',
        title: 'Erro ao carregar solicitações',
        message: getApiErrorMessage(error, 'Não foi possível carregar as solicitações de acesso.')
      });
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const updateStatus = useCallback(async (request, status) => {
    const accepted = await confirm({
      title: status === 'recusado' ? 'Recusar solicitação' : 'Atualizar solicitação',
      message: status === 'recusado'
        ? `Deseja recusar a solicitação de ${request?.nome || 'usuário'}?`
        : 'Deseja atualizar o status desta solicitação?',
      confirmLabel: status === 'recusado' ? 'Recusar' : 'Confirmar',
      cancelLabel: 'Cancelar',
      variant: status === 'recusado' ? 'danger' : 'warning'
    });
    if (!accepted) return;

    try {
      await api.patch(`/solicitacoes-acesso/${request.id}`, {
        status
      });
      setRequests((prev) => prev.map((item) => (
        item.id === request.id ? { ...item, status } : item
      )));
      notify({
        type: 'success',
        title: 'Solicitação atualizada',
        message: `Solicitação marcada como ${STATUS_LABELS[status] || status}.`
      });
    } catch (error) {
      console.error('Erro ao atualizar solicitação:', error);
      notify({
        type: 'error',
        title: 'Erro ao atualizar solicitação',
        message: getApiErrorMessage(error, 'Não foi possível atualizar a solicitação.')
      });
    }
  }, [confirm, notify]);

  const approveAndCreateUser = useCallback(async (request) => {
    if (!request?.email) {
      notify({
        type: 'error',
        title: 'E-mail ausente',
        message: 'Não foi possível criar o acesso sem e-mail.'
      });
      return;
    }

    const accepted = await confirm({
      title: 'Aprovar solicitação',
      message: `Deseja aprovar ${request.nome || request.email || 'esta solicitação'} e criar o usuário de acesso?`,
      confirmLabel: 'Aprovar e criar',
      cancelLabel: 'Cancelar',
      variant: 'warning'
    });
    if (!accepted) return;

    try {
      const { data } = await api.post(`/solicitacoes-acesso/${request.id}/approve`, {
        cargoSolicitado: request.cargoSolicitado || undefined
      });

      setRequests((prev) => prev.map((item) => (
        item.id === request.id ? { ...item, status: 'aprovado' } : item
      )));
      setCreatedCredentials({
        name: request.nome || data?.user?.name || '',
        email: data?.user?.email || request.email,
        role: data?.user?.role || request.cargoSolicitado || 'professor',
        delivery: data?.activation?.delivery,
        existed: Boolean(data?.user?.existed)
      });

      logAudit({
        user,
        action: 'solicitacao_aprovada',
        entity: 'solicitacoes_acesso',
        entityId: request.id,
        meta: {
          createdUserId: data?.user?.id || null,
          assignedRole: data?.user?.role || request.cargoSolicitado || 'professor',
          existingUser: !!data?.user?.existed
        }
      });
      notify({
        type: 'success',
        title: 'Acesso criado',
        message: data?.user?.existed
          ? 'Solicitação aprovada. Usuário existente vinculado pelo e-mail.'
          : 'Solicitação aprovada. Novo usuário criado com credencial provisória ativa.'
      });
    } catch (error) {
      console.error('Erro ao aprovar solicitação:', error);
      notify({
        type: 'error',
        title: 'Erro ao criar acesso',
        message: getApiErrorMessage(error, 'Não foi possível criar o usuário a partir da solicitação.')
      });
    } finally {
      // Sem sessão secundária no backend.
    }
  }, [confirm, notify, user]);

  const handleCopyField = useCallback((field, value) => {
    if (!value) return;
    navigator.clipboard.writeText(value).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    }).catch(() => {
      notify({
        type: 'warning',
        title: 'Copie manualmente',
        message: 'Não foi possível usar a área de transferência deste navegador.'
      });
    });
  }, [notify]);

  const filteredRequests = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    let filtered = requests;

    if (term) {
      filtered = filtered.filter((request) => {
        return (
          request.nome?.toLowerCase().includes(term) ||
          request.email?.toLowerCase().includes(term) ||
          request.instituicao?.toLowerCase().includes(term) ||
          request.area?.toLowerCase().includes(term) ||
          request.cargoSolicitado?.toLowerCase().includes(term)
        );
      });
    }

    if (activeFilter !== 'all') {
      filtered = filtered.filter((request) => request.status === activeFilter);
    }

    return filtered;
  }, [requests, searchTerm, activeFilter]);

  const stats = useMemo(() => ({
    total: requests.length,
    pendentes: requests.filter((request) => request.status === 'pendente').length,
    aprovados: requests.filter((request) => request.status === 'aprovado').length,
    recusados: requests.filter((request) => request.status === 'recusado').length
  }), [requests]);

  const columns = useMemo(() => [
    {
      key: 'requester',
      header: 'Solicitante',
      width: '35%',
      render: (request) => (
        <div className="requester-cell">
          <div className="requester-avatar">
            <UserPlus size={18} />
          </div>
          <div>
            <h4>{request.nome || 'Nome não informado'}</h4>
            <div className="requester-meta">
              <span><Mail size={12} /> {request.email || 'E-mail não informado'}</span>
              {request.telefone && (
                <>
                  <span className="meta-separator" aria-hidden="true">.</span>
                  <span><Phone size={12} /> {request.telefone}</span>
                </>
              )}
            </div>
            <div className="requester-tags">
              {request.cargoSolicitado && (
                <span className="tag">{request.cargoSolicitado}</span>
              )}
              {request.area && (
                <span className="tag">{request.area}</span>
              )}
            </div>
          </div>
        </div>
      )
    },
    {
      key: 'instituicao',
      header: 'Vínculo',
      width: '25%',
      render: (request) => (
        <div className="request-info">
          <span className="info-label">Instituição</span>
          <span className="info-value">{request.instituicao || 'Não informado'}</span>
          {request.justificativa && (
            <p className="info-note">{request.justificativa}</p>
          )}
        </div>
      )
    },
    {
      key: 'status',
      header: 'Status',
      width: '20%',
      render: (request) => {
        const createdAt = request.createdAt
          ? new Date(request.createdAt).toLocaleDateString('pt-BR')
          : '--/--/----';
        return (
          <div className="status-cell">
            <span className={`status-badge ${request.status || 'pendente'}`}>
              <Clock size={12} />
              {STATUS_LABELS[request.status] || 'Pendente'}
            </span>
            <span className="status-date">{createdAt}</span>
          </div>
        );
      }
    },
    {
      key: 'actions',
      header: 'Ações',
      width: '20%',
      align: 'right',
      // O nome acessível começa pelo texto visível e acrescenta a pessoa:
      // numa lista de solicitações, "Recusar" sozinho não diz de quem.
      render: (request) => (
        <div className="request-actions">
          <button
            type="button"
            className="action-btn approve"
            onClick={() => approveAndCreateUser(request)}
            disabled={request.status === 'aprovado'}
            aria-label={`Aprovar e criar: ${request.nome || request.email || 'Nome não informado'}`}
          >
            <CheckCircle size={16} />
            Aprovar e criar
          </button>
          <button
            type="button"
            className="action-btn reject"
            onClick={() => updateStatus(request, 'recusado')}
            disabled={request.status === 'recusado'}
            aria-label={`Recusar: ${request.nome || request.email || 'Nome não informado'}`}
          >
            <XCircle size={16} />
            Recusar
          </button>
        </div>
      )
    }
  ], [approveAndCreateUser, updateStatus]);

  const filters = [
    { id: 'pendente', label: 'Pendentes', count: stats.pendentes },
    { id: 'aprovado', label: 'Aprovados', count: stats.aprovados },
    { id: 'recusado', label: 'Recusados', count: stats.recusados },
    { id: 'all', label: 'Todos', count: stats.total }
  ];

  // MotionConfig: com "reduzir movimento" no sistema, a entrada da página e
  // das linhas da Table não desloca nada (só a opacidade continua).
  return (
    <MotionConfig reducedMotion="user">
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="access-requests"
    >
      {/* h2, não h1: o cabeçalho do portal já tem o h1 com o título da página. */}
      <header className="requests-header">
        <div className="header-left">
          <div className="header-badge">
            <span className="badge-line" aria-hidden="true" />
            <span>SOLICITAÇÕES</span>
          </div>
          <h2>Solicitações de acesso</h2>
          <p>Gerencie novas entradas de professores e parceiros.</p>
        </div>
      </header>

      {createdCredentials && (
        <section className="request-credentials" aria-live="polite">
          <div className="request-credentials__header">
            <div>
              <span className="request-credentials__eyebrow">Credenciais de acesso</span>
              <h2>{createdCredentials.existed ? 'Usuário existente vinculado' : 'Conta criada com senha temporária'}</h2>
            </div>
            <button
              type="button"
              className="request-credentials__close"
              onClick={() => setCreatedCredentials(null)}
            >
              Ocultar
            </button>
          </div>

          <div className="request-credentials__grid">
            <div className="request-credentials__field">
              <span className="request-credentials__label">E-mail de login</span>
              <div className="request-credentials__value">
                <Mail size={15} />
                <span>{createdCredentials.email}</span>
                <button
                  type="button"
                  className="request-credentials__copy"
                  onClick={() => handleCopyField('email', createdCredentials.email)}
                  aria-label={copiedField === 'email' ? 'E-mail copiado' : 'Copiar e-mail'}
                >
                  {copiedField === 'email' ? <CheckCircle2 size={15} /> : <Copy size={15} />}
                </button>
              </div>
            </div>

          </div>
          <p className="request-credentials__warning">
            {createdCredentials.existed
              ? 'Solicitacao vinculada a conta existente. Para recuperar acesso, envie um link pelo cadastro de usuarios.'
              : createdCredentials.delivery === 'sent'
                ? 'Link de ativacao enviado ao contato da solicitacao. Validade: 15 minutos.'
                : 'Conta criada; envio do link pendente. Confira o contato e o servico de email antes de reenviar pelo cadastro de usuarios.'}
          </p>
        </section>
      )}

      <div className="requests-stats">
        <div className="stat-card">
          <div className="stat-label">Pendentes</div>
          <div className="stat-value">{stats.pendentes}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Aprovados</div>
          <div className="stat-value">{stats.aprovados}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Recusados</div>
          <div className="stat-value">{stats.recusados}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total</div>
          <div className="stat-value">{stats.total}</div>
        </div>
      </div>

      <div className="requests-controls">
        <input
          type="text"
          placeholder="Buscar por nome, e-mail, área..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          className="requests-search"
          aria-label="Buscar solicitações por nome, e-mail ou área"
        />
        <div className="requests-filters" role="group" aria-label="Filtrar por status">
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
      </div>

      <div className="requests-table">
        <Table
          columns={columns}
          data={filteredRequests}
          loading={loading}
          emptyMessage="Nenhuma solicitação encontrada."
        />
      </div>
    </motion.div>
    </MotionConfig>
  );
};

export default AccessRequests;
