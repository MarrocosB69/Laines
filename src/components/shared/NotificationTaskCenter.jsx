import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bell, Check, ClipboardList } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useUiFeedback } from '../../contexts/UiFeedbackContext';
import api, { getApiErrorMessage } from '../../services/api';
import { subscribeRealtimeEvent } from '../../services/realtime';
import { toDate } from '../../utils/dateUtils';

const CLOSED_TASK_STATUSES = new Set(['concluida', 'concluido', 'resolvida', 'resolvido']);

const formatTime = (date) =>
  date?.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) || '';

const formatDate = (date) =>
  date?.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) || '';

const formatNotificationTypeLabel = (type) => {
  const normalized = String(type || 'info').toLowerCase().trim();
  if (normalized === 'consulta') return 'Consulta';
  if (normalized === 'avaliacao') return 'Avaliacao';
  if (normalized === 'sucesso') return 'Sucesso';
  if (normalized === 'alerta') return 'Alerta';
  if (normalized === 'acao') return 'Acao';
  if (normalized === 'erro') return 'Erro';
  return 'Info';
};

const formatTaskStatusLabel = (status) => {
  const normalized = String(status || 'pendente').toLowerCase().trim();
  if (normalized === 'concluida') return 'Concluida';
  if (normalized === 'em_andamento') return 'Em andamento';
  return 'Pendente';
};

const formatAudienceLabel = (assignedRole) => {
  const normalized = String(assignedRole || 'todos').toLowerCase().trim();
  if (!normalized || normalized === 'todos') return 'Destino: todos';
  return `Destino: ${normalized.replace(/_/g, ' ')}`;
};

const normalizeTask = (task) => {
  const taskDate = toDate(task.updatedAt || task.createdAt || task.data || task.dueDate);
  return {
    ...task,
    dateObj: taskDate,
    status: String(task.status || 'pendente').toLowerCase().trim()
  };
};

const normalizeNotification = (item) => {
  const dateObj = toDate(item.createdAt || item.updatedAt);
  return {
    ...item,
    dateObj,
    tipo: String(item.tipo || 'info').toLowerCase().trim()
  };
};

const NotificationTaskCenter = ({ showTasks = true, showNotifications = true }) => {
  const { user } = useAuth();
  const { notify } = useUiFeedback();
  const [notifications, setNotifications] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [openPanel, setOpenPanel] = useState(null);
  const [resolvingNotifications, setResolvingNotifications] = useState(() => new Set());
  const [resolvingTasks, setResolvingTasks] = useState(() => new Set());

  const notificationsButtonRef = useRef(null);
  const notificationsPanelRef = useRef(null);
  const tasksButtonRef = useRef(null);
  const tasksPanelRef = useRef(null);

  const loadNotifications = useCallback(async () => {
    if (!user || !showNotifications) {
      setNotifications([]);
      return;
    }

    try {
      const { data } = await api.get('/notificacoes');
      const normalized = (Array.isArray(data) ? data : [])
        .map(normalizeNotification)
        .filter((item) => item.dateObj && !item.readAt)
        .sort((a, b) => b.dateObj - a.dateObj)
        .slice(0, 8);
      setNotifications(normalized);
    } catch (error) {
      console.warn('NotificationTaskCenter: falha ao carregar notificacoes', error);
    }
  }, [showNotifications, user]);

  const loadTasks = useCallback(async () => {
    if (!user || !showTasks) {
      setTasks([]);
      return;
    }

    try {
      const { data } = await api.get('/tarefas');
      const normalized = (Array.isArray(data) ? data : [])
        .map(normalizeTask)
        .filter((task) => !CLOSED_TASK_STATUSES.has(task.status))
        .sort((a, b) => (b.dateObj?.getTime?.() || 0) - (a.dateObj?.getTime?.() || 0))
        .slice(0, 8);
      setTasks(normalized);
    } catch (error) {
      console.warn('NotificationTaskCenter: falha ao carregar tarefas', error);
    }
  }, [showTasks, user]);

  const refreshAll = useCallback(() => {
    loadNotifications();
    loadTasks();
  }, [loadNotifications, loadTasks]);

  useEffect(() => {
    refreshAll();
    if (!user) return undefined;
    const intervalId = setInterval(refreshAll, 60000);
    return () => clearInterval(intervalId);
  }, [refreshAll, user]);

  useEffect(() => {
    if (!user) return undefined;
    const unsubscribers = [
      subscribeRealtimeEvent('notificacoes.created', loadNotifications),
      subscribeRealtimeEvent('notificacoes.updated', loadNotifications),
      subscribeRealtimeEvent('notificacoes.deleted', loadNotifications),
      subscribeRealtimeEvent('tarefas.created', loadTasks),
      subscribeRealtimeEvent('tarefas.updated', loadTasks),
      subscribeRealtimeEvent('tarefas.deleted', loadTasks)
    ];
    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [loadNotifications, loadTasks, user]);

  useEffect(() => {
    if (!openPanel) return undefined;

    const handleClickOutside = (event) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (
        notificationsPanelRef.current?.contains(target)
        || notificationsButtonRef.current?.contains(target)
        || tasksPanelRef.current?.contains(target)
        || tasksButtonRef.current?.contains(target)
      ) {
        return;
      }
      setOpenPanel(null);
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') setOpenPanel(null);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [openPanel]);

  const handleResolveNotification = useCallback(async (item) => {
    if (!item?.id || resolvingNotifications.has(item.id)) return;
    setResolvingNotifications((current) => new Set(current).add(item.id));
    try {
      await api.patch(`/notificacoes/${item.id}/resolver`);
      setNotifications((current) => current.filter((notification) => notification.id !== item.id));
    } catch (error) {
      notify({
        type: 'error',
        title: 'Falha ao resolver notificacao',
        message: getApiErrorMessage(error, 'Nao foi possivel atualizar a notificacao.')
      });
    } finally {
      setResolvingNotifications((current) => {
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });
    }
  }, [notify, resolvingNotifications]);

  const handleResolveTask = useCallback(async (task) => {
    if (!task?.id || resolvingTasks.has(task.id)) return;
    setResolvingTasks((current) => new Set(current).add(task.id));
    try {
      await api.patch(`/tarefas/${task.id}/resolver`);
      setTasks((current) => current.filter((item) => item.id !== task.id));
    } catch (error) {
      notify({
        type: 'error',
        title: 'Falha ao concluir tarefa',
        message: getApiErrorMessage(error, 'Nao foi possivel atualizar a tarefa.')
      });
    } finally {
      setResolvingTasks((current) => {
        const next = new Set(current);
        next.delete(task.id);
        return next;
      });
    }
  }, [notify, resolvingTasks]);

  const notificationCount = notifications.length;
  const taskCount = tasks.length;

  const panels = useMemo(() => ({
    notifications: openPanel === 'notifications',
    tasks: openPanel === 'tasks'
  }), [openPanel]);

  if (!user) return null;

  return (
    <>
      {showTasks && (
        <>
          <button
            type="button"
            className="header-btn tasks-btn"
            ref={tasksButtonRef}
            aria-label="Tarefas pendentes"
            aria-expanded={panels.tasks}
            onClick={() => setOpenPanel((current) => (current === 'tasks' ? null : 'tasks'))}
          >
            <ClipboardList size={18} />
            {taskCount > 0 && !panels.tasks && (
              <span className="task-badge">{taskCount}</span>
            )}
          </button>

          {panels.tasks && (
            <div ref={tasksPanelRef} className="notifications-panel tasks-panel">
              <div className="panel-header">
                <h4>Tarefas pendentes</h4>
                <span>{taskCount} abertas</span>
              </div>
              <div className="panel-list">
                {tasks.length === 0 ? (
                  <div className="panel-empty">Sem tarefas pendentes no momento.</div>
                ) : (
                  tasks.map((task) => (
                    <div key={task.id || task.title} className="panel-item panel-item-task">
                      <div className={`panel-tag tarefa status-${task.status || 'pendente'}`}>
                        {formatTaskStatusLabel(task.status)}
                      </div>
                      <div className="panel-content">
                        <p className="panel-title">{task.title || 'Tarefa sem titulo'}</p>
                        <span className="panel-meta">{formatAudienceLabel(task.assignedRole)}</span>
                        <span className="panel-meta">
                          {task.dateObj ? `${formatDate(task.dateObj)} ${formatTime(task.dateObj)}` : '--/-- --:--'}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="panel-resolve-btn"
                        aria-label="Marcar tarefa como concluida"
                        title="Marcar como concluida"
                        disabled={resolvingTasks.has(task.id)}
                        onClick={() => handleResolveTask(task)}
                      >
                        <Check size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </>
      )}

      {showNotifications && (
        <>
          <button
            type="button"
            className="header-btn notifications-btn"
            ref={notificationsButtonRef}
            aria-label="Notificacoes"
            aria-expanded={panels.notifications}
            onClick={() => setOpenPanel((current) => (current === 'notifications' ? null : 'notifications'))}
          >
            <Bell size={18} />
            {notificationCount > 0 && !panels.notifications && (
              <span className="notification-badge">{notificationCount}</span>
            )}
          </button>

          {panels.notifications && (
            <div ref={notificationsPanelRef} className="notifications-panel">
              <div className="panel-header">
                <h4>Notificacoes recentes</h4>
                <span>{notificationCount} itens</span>
              </div>
              <div className="panel-list">
                {notifications.length === 0 ? (
                  <div className="panel-empty">Sem notificacoes por enquanto.</div>
                ) : (
                  notifications.map((item, index) => (
                    <div key={`${item.tipo || 'item'}-${item.id || index}`} className="panel-item">
                      <div className={`panel-tag ${item.tipo || 'info'}`}>
                        {formatNotificationTypeLabel(item.tipo)}
                      </div>
                      <div className="panel-content">
                        <p className="panel-title">{item.titulo || 'Notificacao'}</p>
                        {item.mensagem ? <span className="panel-meta">{item.mensagem}</span> : null}
                        <span className="panel-meta">
                          {item.dateObj ? `${formatDate(item.dateObj)} ${formatTime(item.dateObj)}` : '--/-- --:--'}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="panel-resolve-btn"
                        aria-label="Marcar notificacao como resolvida"
                        title="Marcar como resolvida"
                        disabled={resolvingNotifications.has(item.id)}
                        onClick={() => handleResolveNotification(item)}
                      >
                        <Check size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
};

export default NotificationTaskCenter;
