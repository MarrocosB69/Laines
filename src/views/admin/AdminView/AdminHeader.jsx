import React, { useEffect, useMemo, useState, useCallback } from "react";
import { 
  Bell, HelpCircle, Sun, Moon, ChevronRight, ClipboardList
} from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import { useUiFeedback } from "../../../contexts/UiFeedbackContext";
import { toDate } from "../../../utils/dateUtils";
import { normalizeRole } from "../../../constants/roles";
import api from "../../../services/api";
import "./AdminHeader.css";

const AdminHeader = ({ 
  activeTab, activeIcon, darkMode, onToggleTheme 
}) => {
  const { user } = useAuth();
  const { notify } = useUiFeedback();
  const [notifications, setNotifications] = useState([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [pendingTasks, setPendingTasks] = useState(0);
  const canReadNotifications = !!user && !(user?.isTecnico || user?.isAtleta);
  const initials = useMemo(() => {
    const rawName = user?.name || user?.nome || user?.displayName || '';
    const rawEmail = user?.email || '';
    const base = rawName || (rawEmail ? rawEmail.split('@')[0].replace(/[._-]+/g, ' ') : '');
    const parts = base.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'US';
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
    if (!user) return;
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
      setPendingTasks(openTasks.length);
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
    if (!isNotificationsOpen) return undefined;
    const handleClickOutside = (event) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      const panel = document.querySelector(".notifications-panel");
      const trigger = document.querySelector(".notifications-btn");
      if (panel?.contains(target) || trigger?.contains(target)) return;
      setIsNotificationsOpen(false);
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setIsNotificationsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isNotificationsOpen]);

  useEffect(() => {
    setIsNotificationsOpen(false);
  }, [activeTab]);

  const formatTime = (date) =>
    date?.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) || "";
  const formatDate = (date) =>
    date?.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) || "";
  const tabLabels = {
    dashboard: 'Início',
    users: 'Membros',
    patients: 'Participantes',
    reports: 'Relatórios',
    research: 'Projetos',
    ensino: 'Ensino',
    extensao: 'Extensão',
    requests: 'Solicitações',
    settings: 'Configurações'
  };

  return (
    <header className="admin-header">
      <div className="header-left">
        <div className="breadcrumb">
          <div className="breadcrumb-item">
            <span className="breadcrumb-text mute">LAINES</span>
          </div>
          <ChevronRight size={14} className="breadcrumb-separator" />
          <div className="breadcrumb-item active">
            <span className="icon-wrapper">{activeIcon}</span>
            <span className="breadcrumb-text capitalize">{tabLabels[activeTab] || activeTab}</span>
          </div>
        </div>
      </div>

      <div className="header-controls">
        <button type="button" onClick={onToggleTheme} className="header-btn theme-toggle">
          {darkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        <button
          type="button"
          className="header-btn tasks-btn"
          aria-label="Tarefas pendentes"
          onClick={() => {
            notify({
              type: 'info',
              title: 'Tarefas pendentes',
              message: pendingTasks > 0
                ? `Você possui ${pendingTasks} tarefa(s) pendente(s).`
                : 'Não há tarefas pendentes no momento.'
            });
          }}
        >
          <ClipboardList size={20} />
          {pendingTasks > 0 && (
            <span className="task-badge">{pendingTasks}</span>
          )}
        </button>
        
        <button
          type="button"
          className="header-btn notifications-btn"
          onClick={() => setIsNotificationsOpen((prev) => !prev)}
          aria-expanded={isNotificationsOpen}
          aria-label="Notificações"
        >
          <Bell size={20} />
          {notifications.length > 0 && (
            <span className="notification-badge">{notifications.length}</span>
          )}
        </button>
        {isNotificationsOpen && (
          <div className="notifications-panel">
            <div className="panel-header">
              <h4>Notificações recentes</h4>
              <span>{notifications.length} novas</span>
            </div>
            <div className="panel-list">
              {notifications.length === 0 ? (
                <div className="panel-empty">Sem notificações por enquanto.</div>
              ) : (
                notifications.map((item) => (
                  <div key={`${item.tipo}-${item.id}`} className="panel-item">
                    <div className={`panel-tag ${item.tipo}`}>
                      {item.tipo === "consulta" ? "Consulta" : "Avaliação"}
                    </div>
                    <div className="panel-content">
                      <p className="panel-title">
                        {item.tipo === "consulta"
                          ? `${item.pacienteNome || "Consulta"} - ${item.status || "agendada"}`
                          : 'Avaliação registrada'}
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
              type: 'info',
              title: 'Ajuda e suporte',
              message: 'Canal de suporte em configuração. Contate a coordenação em caso de urgência.'
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
