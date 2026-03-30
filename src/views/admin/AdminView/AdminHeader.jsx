import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Bell, HelpCircle, ClipboardList } from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import { useUiFeedback } from "../../../contexts/UiFeedbackContext";
import { toDate } from "../../../utils/dateUtils";
import { normalizeRole } from "../../../constants/roles";
import api from "../../../services/api";
import "./AdminHeader.css";

const AdminHeader = ({ activeTab, activeIcon }) => {
  const { user } = useAuth();
  const { notify } = useUiFeedback();

  const [notifications, setNotifications] = useState([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [pendingTasks, setPendingTasks] = useState(0);
  const [pendingTasksList, setPendingTasksList] = useState([]);
  const [isTasksOpen, setIsTasksOpen] = useState(false);

  const notificationsButtonRef = useRef(null);
  const notificationsPanelRef = useRef(null);
  const tasksButtonRef = useRef(null);
  const tasksPanelRef = useRef(null);

  const canReadNotifications = !!user && !(user?.isTecnico || user?.isAtleta);

  const initials = useMemo(() => {
    const rawName = user?.name || user?.nome || user?.displayName || "";
    const rawEmail = user?.email || "";
    const base = rawName || (rawEmail ? rawEmail.split("@")[0].replace(/[._-]+/g, " ") : "");
    const parts = base.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "US";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }, [user]);

  useEffect(() => {
    if (!canReadNotifications) {
      setNotifications([]);
      return;
    }

    const normalize = (items) =>
      items
        .map((item) => {
          const dateObj = toDate(item.createdAt || item.data || item.scheduledAt);
          return { ...item, dateObj };
        })
        .filter((item) => item.dateObj);

    const loadNotifications = async () => {
      try {
        const [appointmentsRes, evaluationsRes] = await Promise.all([
          api.get("/agendamentos", { params: { limit: 6 } }),
          api.get("/avaliacoes", { params: { limit: 6 } })
        ]);

        const appointments = (appointmentsRes.data || []).map((item) => ({
          ...item,
          tipo: "consulta"
        }));
        const evaluations = (evaluationsRes.data || []).map((item) => ({
          ...item,
          tipo: "avaliacao"
        }));

        const merged = [...normalize(appointments), ...normalize(evaluations)]
          .sort((a, b) => b.dateObj - a.dateObj)
          .slice(0, 8);

        setNotifications(merged);
      } catch (error) {
        console.warn("AdminHeader: falha ao carregar notificacoes", error);
      }
    };

    loadNotifications();
    const intervalId = setInterval(loadNotifications, 60000);
    return () => clearInterval(intervalId);
  }, [canReadNotifications]);

  const loadPendingTasks = useCallback(async () => {
    if (!user) {
      setPendingTasks(0);
      setPendingTasksList([]);
      return;
    }

    const role = normalizeRole(user?.role || "aluno");
    const adminRoles = ["admin", "coordenacao", "presidente", "vice"];

    try {
      const { data } = await api.get("/tarefas");
      const tasks = data || [];
      const visible = tasks.filter((task) => {
        if (adminRoles.includes(role)) return true;
        if (!task.assignedRole || task.assignedRole === "todos") return true;
        return task.assignedRole === role;
      });

      const openTasks = visible.filter((task) => task.status !== "concluida");
      const sortedOpenTasks = [...openTasks].sort((a, b) => {
        const aDate = toDate(a.updatedAt || a.createdAt || a.data || a.dueDate);
        const bDate = toDate(b.updatedAt || b.createdAt || b.data || b.dueDate);
        return (bDate?.getTime?.() || 0) - (aDate?.getTime?.() || 0);
      });

      setPendingTasks(openTasks.length);
      setPendingTasksList(sortedOpenTasks.slice(0, 8));
    } catch (error) {
      console.warn("AdminHeader: falha ao carregar tarefas", error);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    loadPendingTasks();
    const intervalId = setInterval(loadPendingTasks, 60000);
    return () => clearInterval(intervalId);
  }, [loadPendingTasks, user]);

  useEffect(() => {
    if (!isNotificationsOpen && !isTasksOpen) return undefined;

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

      setIsNotificationsOpen(false);
      setIsTasksOpen(false);
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setIsNotificationsOpen(false);
        setIsTasksOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isNotificationsOpen, isTasksOpen]);

  useEffect(() => {
    setIsNotificationsOpen(false);
    setIsTasksOpen(false);
  }, [activeTab]);

  const formatTime = (date) =>
    date?.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) || "";

  const formatDate = (date) =>
    date?.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) || "";

  const formatTaskStatusLabel = (status) => {
    const normalized = String(status || "pendente").toLowerCase();
    if (normalized === "concluida") return "Concluida";
    if (normalized === "em_andamento") return "Em andamento";
    return "Pendente";
  };

  const tabLabels = {
    dashboard: "Inicio",
    users: "Membros",
    patients: "Participantes",
    reports: "Relatorios",
    research: "Projetos",
    ensino: "Ensino",
    extensao: "Extensao",
    requests: "Solicitacoes",
    settings: "Configuracoes"
  };

  return (
    <header className="admin-header">
      <div className="header-left">
        <div className="header-page-title-row">
          {activeIcon ? <span className="icon-wrapper">{activeIcon}</span> : null}
          <h1 className="header-page-title">{tabLabels[activeTab] || activeTab}</h1>
        </div>
        <p className="header-page-subtitle">Painel administrativo</p>
      </div>

      <div className="header-controls">
        <button
          type="button"
          className="header-btn tasks-btn"
          ref={tasksButtonRef}
          aria-label="Tarefas pendentes"
          aria-expanded={isTasksOpen}
          onClick={() => {
            setIsTasksOpen((prev) => {
              const next = !prev;
              if (next) setIsNotificationsOpen(false);
              return next;
            });
          }}
        >
          <ClipboardList size={20} />
          {pendingTasks > 0 && !isTasksOpen && (
            <span className="task-badge">{pendingTasks}</span>
          )}
        </button>

        {isTasksOpen && (
          <div ref={tasksPanelRef} className="notifications-panel tasks-panel">
            <div className="panel-header">
              <h4>Tarefas pendentes</h4>
              <span>{pendingTasks} abertas</span>
            </div>
            <div className="panel-list">
              {pendingTasksList.length === 0 ? (
                <div className="panel-empty">Sem tarefas pendentes no momento.</div>
              ) : (
                pendingTasksList.map((task) => {
                  const taskDate = toDate(task.updatedAt || task.createdAt || task.data || task.dueDate);
                  return (
                    <div key={task.id || `${task.title}-${taskDate?.getTime?.() || "task"}`} className="panel-item panel-item-task">
                      <div className={`panel-tag tarefa status-${String(task.status || "pendente").toLowerCase()}`}>
                        {formatTaskStatusLabel(task.status)}
                      </div>
                      <div className="panel-content">
                        <p className="panel-title">{task.title || "Tarefa sem titulo"}</p>
                        <span className="panel-meta">
                          {task.assignedRole && task.assignedRole !== "todos"
                            ? `Destino: ${task.assignedRole}`
                            : "Destino: todos"}
                        </span>
                        <span className="panel-meta">
                          {taskDate ? `${formatDate(taskDate)} ${formatTime(taskDate)}` : "--/-- --:--"}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        <button
          type="button"
          className="header-btn notifications-btn"
          ref={notificationsButtonRef}
          onClick={() => {
            setIsNotificationsOpen((prev) => {
              const next = !prev;
              if (next) setIsTasksOpen(false);
              return next;
            });
          }}
          aria-expanded={isNotificationsOpen}
          aria-label="Notificacoes"
        >
          <Bell size={20} />
          {notifications.length > 0 && !isNotificationsOpen && (
            <span className="notification-badge">{notifications.length}</span>
          )}
        </button>

        {isNotificationsOpen && (
          <div ref={notificationsPanelRef} className="notifications-panel">
            <div className="panel-header">
              <h4>Notificacoes recentes</h4>
              <span>{notifications.length} itens</span>
            </div>
            <div className="panel-list">
              {notifications.length === 0 ? (
                <div className="panel-empty">Sem notificacoes por enquanto.</div>
              ) : (
                notifications.map((item, index) => (
                  <div key={`${item.tipo || "item"}-${item.id || index}`} className="panel-item">
                    <div className={`panel-tag ${item.tipo}`}>
                      {item.tipo === "consulta" ? "Consulta" : "Avaliacao"}
                    </div>
                    <div className="panel-content">
                      <p className="panel-title">
                        {item.tipo === "consulta"
                          ? `${item.pacienteNome || "Consulta"} - ${item.status || "agendada"}`
                          : "Avaliacao registrada"}
                      </p>
                      <span className={`panel-meta status-${item.status || "agendada"}`}>
                        {item.dateObj ? `${formatDate(item.dateObj)} ${formatTime(item.dateObj)}` : "--/-- --:--"}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        <button
          type="button"
          className="header-btn help-btn"
          onClick={() => {
            notify({
              type: "info",
              title: "Ajuda e suporte",
              message: "Canal de suporte em configuracao. Contate a coordenacao em caso de urgencia."
            });
          }}
        >
          <HelpCircle size={20} />
        </button>

        <div className="user-profile-mini">
          <div className="avatar">{initials}</div>
        </div>
      </div>
    </header>
  );
};

export default AdminHeader;
