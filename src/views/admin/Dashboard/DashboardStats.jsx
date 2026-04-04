import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Users,
  Activity,
  Clock,
  ChevronRight,
  ChevronLeft,
  Zap,
  UserPlus,
  FileCheck,
  GraduationCap,
  ClipboardList,
  TrendingUp,
  Edit2,
  Save
} from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import { useUiFeedback } from "../../../contexts/UiFeedbackContext";
import { toDate } from "../../../utils/dateUtils";
import Button from "../../../components/ui/Button";
import { StatCard as UiStatCard } from "../../../components/ui";
import api, { getApiErrorMessage } from "../../../services/api";
import "./DashboardStats.css";

const DASHBOARD_REFRESH_MS = Number(import.meta.env.VITE_DASHBOARD_REFRESH_MS);
const DASHBOARD_REFRESH_INTERVAL = Number.isFinite(DASHBOARD_REFRESH_MS) && DASHBOARD_REFRESH_MS > 0
  ? DASHBOARD_REFRESH_MS
  : 60_000;

const CalendarWidget = ({ appointments = [] }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
  const monthName = currentDate.toLocaleString("pt-BR", { month: "long" });
  const year = currentDate.getFullYear();
  const statusLabel = {
    agendada: "Agendada",
    remarcada: "Remarcada",
    falta: "Falta",
    realizada: "Realizada"
  };

  const getPerformerName = (item) => (
    item.alunoNome
    || item.alunoResponsavelNome
    || item.alunoResponsavel?.nome
    || "Responsável não informado"
  );

  const getAppointmentTypeLabel = (type) => {
    const normalized = String(type || "").trim().toLowerCase();
    if (!normalized) return "Consulta";
    if (normalized === "primeira_consulta" || normalized === "primeira consulta") {
      return "Primeira consulta";
    }
    if (normalized === "retorno") return "Retorno";
    return normalized
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const getAppointmentTime = (item) => {
    const normalizedTime = String(item.time || "").trim();
    if (normalizedTime) {
      return normalizedTime.length >= 5 ? normalizedTime.slice(0, 5) : normalizedTime;
    }
    const dateObj = toDate(item.scheduledAt || item.date);
    if (!dateObj) return "--:--";
    return dateObj.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  const getDaysInMonth = (date) => {
    const yearValue = date.getFullYear();
    const monthValue = date.getMonth();
    return {
      days: new Date(yearValue, monthValue + 1, 0).getDate(),
      firstDay: new Date(yearValue, monthValue, 1).getDay()
    };
  };

  const { days, firstDay } = getDaysInMonth(currentDate);
  const today = new Date().getDate();
  const isCurrentMonth = new Date().getMonth() === currentDate.getMonth();

  const changeMonth = (offset) => {
    const newDate = new Date(currentDate.setMonth(currentDate.getMonth() + offset));
    setCurrentDate(new Date(newDate));
  };

  const appointmentsByDay = useMemo(() => {
    const map = new Map();
    appointments.forEach((item) => {
      const dateObj = toDate(item.scheduledAt || item.date);
      if (!dateObj) return;
      const key = dateObj.toISOString().split("T")[0];
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    });
    return map;
  }, [appointments]);

  const getDayKey = (day) => {
    const month = currentDate.getMonth() + 1;
    const yearValue = currentDate.getFullYear();
    return `${yearValue}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="calendar-widget"
    >
      <div className="calendar-header">
        <div className="calendar-title">
          <span className="month">{monthName}</span>
          <span className="year">{year}</span>
        </div>
        <div className="calendar-nav">
          <button type="button" onClick={() => changeMonth(-1)} aria-label="Mês anterior">
            <ChevronLeft size={16} />
          </button>
          <button type="button" onClick={() => changeMonth(1)} aria-label="Próximo mês">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="calendar-grid">
        {weekDays.map((day) => (
          <div key={day} className="weekday-label">
            {day}
          </div>
        ))}
        {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
        {Array.from({ length: days }).map((_, i) => {
          const day = i + 1;
          const isToday = isCurrentMonth && day === today;
          const key = getDayKey(day);
          const dayAppointments = appointmentsByDay.get(key) || [];
          const hasAppointments = dayAppointments.length > 0;
          const statusCounts = dayAppointments.reduce((acc, item) => {
            const status = String(item.status || "agendada").trim().toLowerCase();
            acc[status] = (acc[status] || 0) + 1;
            return acc;
          }, {});
          const groupedStatuses = Object.entries(statusCounts).map(([status, count]) => ({
            status,
            count
          }));
          const detailedAppointments = [...dayAppointments]
            .map((item) => ({
              ...item,
              detailDate: toDate(item.scheduledAt || item.date)
            }))
            .sort((a, b) => (a.detailDate?.getTime() || 0) - (b.detailDate?.getTime() || 0));
          return (
            <motion.div
              key={day}
              whileHover={{ scale: 1.1 }}
              className={`calendar-day ${isToday ? "today" : ""} ${hasAppointments ? "has-event" : ""}`}
            >
              {day}
              {isToday && !hasAppointments && (
                <div className="event-dot" />
              )}
              {hasAppointments && (
                <div className="event-dots">
                  {groupedStatuses.slice(0, 3).map((item) => (
                    <span
                      key={item.status}
                      className={`event-dot status-${item.status || "agendada"}`}
                    >
                      {item.count > 1 && <span className="event-dot-count">{item.count}</span>}
                    </span>
                  ))}
                </div>
              )}
              {hasAppointments && (
                <div className="calendar-tooltip">
                  <strong>{`${dayAppointments.length} consulta(s)`}</strong>
                  <ul>
                    {groupedStatuses.map((item) => (
                      <li key={item.status} className={`status-${item.status || "agendada"}`}>
                        {item.count}x {statusLabel[item.status] || item.status}
                      </li>
                    ))}
                  </ul>
                  <div className="calendar-tooltip-divider" />
                  <ul className="calendar-tooltip-consultations">
                    {detailedAppointments.slice(0, 4).map((item) => (
                      <li key={item.id}>
                        <span className="calendar-tooltip-consultation-main">
                          {getAppointmentTime(item)} - {item.pacienteNome || "Atleta"}
                        </span>
                        <span className="calendar-tooltip-consultation-meta">
                          {getAppointmentTypeLabel(item.appointmentType)} | {getPerformerName(item)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {detailedAppointments.length > 4 && (
                    <span className="calendar-tooltip-more">
                      +{detailedAppointments.length - 4} consulta(s)
                    </span>
                  )}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      <div className="calendar-footer">
        <Clock size={12} /> Agenda sincronizada
      </div>
    </motion.div>
  );
};

const StatCard = ({ title, value, icon: Icon, delay }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: delay * 0.1 }}
    className="stat-card"
  >
    <UiStatCard title={title} value={value} icon={Icon} />
  </motion.div>
);

const InsightCard = ({ title, value, subtitle, tone = "primary" }) => (
  <div className={`insight-card insight-${tone}`}>
    <span className="insight-label">{title}</span>
    <strong>{value}</strong>
    {subtitle && <span className="insight-subtitle">{subtitle}</span>}
  </div>
);

const PulseCard = ({ title, value, subtitle, tone = "primary" }) => (
  <div className={`pulse-card pulse-${tone}`}>
    <span className="pulse-label">{title}</span>
    <strong>{value}</strong>
    {subtitle && <span className="pulse-subtitle">{subtitle}</span>}
  </div>
);

const ActivityItem = ({ activity }) => {
  const colors = {
    user: "#2f6fa6",
    link: "#66a38b",
    report: "#1D3350",
    consulta: "#0ea5e9",
    remarcada: "#f59e0b",
    falta: "#ef4444",
    realizada: "#22c55e"
  };
  const color = colors[activity.type] || "#64748b";
  const Icon = activity.type === "user" ? UserPlus : activity.type === "link" ? Users : FileCheck;
  const label = activity.user || activity.patient || activity.label || "Registro";

  return (
    <div className="activity-item">
      <div className="activity-icon" style={{ background: `${color}15`, color }}>
        <Icon size={18} />
      </div>
      <div className="activity-details">
        <h4>{activity.action}</h4>
        <p>{label} - {activity.time} atras</p>
      </div>
      <span className="activity-tag" style={{ color, background: `${color}10` }}>
        {activity.type}
      </span>
    </div>
  );
};

const formatRelativeTime = (date) => {
  if (!date) return "-";
  const diffMs = Math.max(0, Date.now() - date.getTime());
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  return `${days} d`;
};

const DashboardStats = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({ totalPatients: 0, professors: 0, activePatients: 0, waitingList: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [activityFeed, setActivityFeed] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [appointmentMetrics, setAppointmentMetrics] = useState({
    todayCount: 0,
    weekCount: 0,
    noShowRate: 0,
    rescheduleRate: 0,
    completionRate: 0
  });
  const [tasks, setTasks] = useState([]);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskRole, setTaskRole] = useState("todos");
  const [taskStatus, setTaskStatus] = useState("pendente");
  const [taskFilter, setTaskFilter] = useState("all");
  const [taskSearch, setTaskSearch] = useState("");
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");
  const { notify } = useUiFeedback();

  const loadTasks = useCallback(async () => {
    try {
      const { data } = await api.get("/tarefas");
      setTasks(data || []);
    } catch (error) {
      console.warn("DashboardStats: falha ao carregar tarefas", error);
    }
  }, []);

  const loadDashboardData = useCallback(async (silent = false) => {
    if (!user) return;
    if (!silent) setIsLoading(true);
    try {
      const [summaryRes, tarefasRes] = await Promise.all([
        api.get("/analytics/dashboard/summary").catch(() => ({ data: null })),
        api.get("/tarefas").catch(() => ({ data: [] }))
      ]);

      const summary = summaryRes.data || {};
      const summaryMetrics = summary.metrics || {};
      const summaryAppointments = summary.appointments || {};
      const summaryAppointmentItems = Array.isArray(summaryAppointments.items) ? summaryAppointments.items : [];
      const summaryAppointmentMetrics = summaryAppointments.summary || {};
      const summaryActivities = Array.isArray(summary.recentActivities) ? summary.recentActivities : [];

      setStats({
        totalPatients: Number(summaryMetrics.totalPatients || 0),
        professors: Number(summaryMetrics.professors || 0),
        activePatients: Number(summaryMetrics.activePatients || 0),
        waitingList: Number(summaryMetrics.waitingList || 0)
      });

      const sortedAppointments = summaryAppointmentItems
        .map((item) => ({
          ...item,
          dateObj: toDate(item.scheduledAt || item.date)
        }))
        .sort((a, b) => (b.dateObj?.getTime() || 0) - (a.dateObj?.getTime() || 0));
      setAppointments(sortedAppointments);

      setAppointmentMetrics({
        todayCount: Number(summaryAppointmentMetrics.todayCount || 0),
        weekCount: Number(summaryAppointmentMetrics.weekCount || 0),
        noShowRate: Number(summaryAppointmentMetrics.noShowRate || 0),
        rescheduleRate: Number(summaryAppointmentMetrics.rescheduleRate || 0),
        completionRate: Number(summaryAppointmentMetrics.completionRate || 0)
      });

      setActivityFeed(summaryActivities);
      setTasks(tarefasRes.data || []);
    } catch (error) {
      console.warn("DashboardStats: falha ao carregar dados", error);
      if (!silent) {
        notify({
          type: "error",
          title: "Falha ao carregar dados",
          message: getApiErrorMessage(error, "Não foi possível atualizar o dashboard.")
        });
      }
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [notify, user]);

  useEffect(() => {
    loadDashboardData();
    const intervalId = setInterval(() => loadDashboardData(true), DASHBOARD_REFRESH_INTERVAL);
    return () => clearInterval(intervalId);
  }, [loadDashboardData]);

  const recentActivities = useMemo(() => {
    const combined = activityFeed
      .map((item) => {
        const dateObj = toDate(item.occurredAt || item.createdAt);
        return {
          ...item,
          user: item.type === "user" ? item.label : undefined,
          patient: item.type === "user" ? undefined : item.label,
          dateObj,
          time: item.time || formatRelativeTime(dateObj)
        };
      })
      .sort((a, b) => (b.dateObj?.getTime() || 0) - (a.dateObj?.getTime() || 0));
    return combined.slice(0, 6);
  }, [activityFeed]);

  const roleLabel = useMemo(() => {
    const role = user?.role || "aluno";
    return role.toLowerCase();
  }, [user]);

  const visibleTasks = useMemo(() => {
    if (!tasks.length) return [];
    return tasks.filter((task) => {
      if (!task.assignedRole || task.assignedRole === "todos") return true;
      return task.assignedRole === roleLabel;
    })
      .filter((task) => {
        if (taskFilter === "all") return true;
        return task.status === taskFilter;
      })
      .filter((task) => {
        const term = taskSearch.trim().toLowerCase();
        if (!term) return true;
        return task.title?.toLowerCase().includes(term);
      });
  }, [roleLabel, taskFilter, taskSearch, tasks]);

  const taskStats = useMemo(() => {
    const base = tasks.filter((task) => {
      if (!task.assignedRole || task.assignedRole === "todos") return true;
      return task.assignedRole === roleLabel;
    });
    return {
      total: base.length,
      pendente: base.filter((task) => task.status === "pendente").length,
      em_andamento: base.filter((task) => task.status === "em_andamento").length,
      concluida: base.filter((task) => task.status === "concluida").length
    };
  }, [roleLabel, tasks]);

  const handleAddTask = async () => {
    const title = taskTitle.trim();
    if (!title) return;
    try {
      await api.post("/tarefas", {
        title,
        status: taskStatus,
        assignedRole: taskRole,
        createdBy: user?.id || user?.uid || null,
        createdByName: user?.name || user?.nome || user?.email || "Equipe"
      });
      setTaskTitle("");
      setTaskStatus("pendente");
      setTaskRole("todos");
      await loadTasks();
      notify({
        type: "success",
        title: "Tarefa criada",
        message: "A tarefa foi adicionada ao painel."
      });
    } catch (error) {
      console.warn("DashboardStats: falha ao criar tarefa", error);
      notify({
        type: "error",
        title: "Falha ao criar tarefa",
        message: getApiErrorMessage(error, "Não foi possível adicionar a tarefa.")
      });
    }
  };

  const handleToggleTask = async (task) => {
    const nextStatus = task.status === "concluida" ? "pendente" : "concluida";
    try {
      await api.patch(`/tarefas/${task.id}`, { status: nextStatus });
      await loadTasks();
      notify({
        type: "info",
        title: "Status atualizado",
        message: `Tarefa marcada como ${nextStatus}.`
      });
    } catch (error) {
      console.warn("DashboardStats: falha ao atualizar tarefa", error);
      notify({
        type: "error",
        title: "Falha ao atualizar",
        message: getApiErrorMessage(error, "Não foi possível atualizar a tarefa.")
      });
    }
  };

  const handleStartEdit = (task) => {
    setEditingTaskId(task.id);
    setEditingTitle(task.title || "");
  };

  const handleCancelEdit = () => {
    setEditingTaskId(null);
    setEditingTitle("");
  };

  const handleSaveEdit = async (task) => {
    const title = editingTitle.trim();
    if (!title) return;
    try {
      await api.patch(`/tarefas/${task.id}`, { title });
      await loadTasks();
      notify({
        type: "success",
        title: "Tarefa atualizada",
        message: "Título atualizado com sucesso."
      });
      handleCancelEdit();
    } catch (error) {
      console.warn("DashboardStats: falha ao editar tarefa", error);
      notify({
        type: "error",
        title: "Falha ao atualizar",
        message: getApiErrorMessage(error, "Não foi possível salvar a tarefa.")
      });
    }
  };

  const statCards = [
    { id: 1, title: "Total Atletas", value: stats.totalPatients, icon: Users, color: "blue", delay: 1 },
    { id: 2, title: "Professores/Profissionais", value: stats.professors, icon: GraduationCap, color: "purple", delay: 2 },
    { id: 3, title: "Em Atendimento", value: stats.activePatients, icon: Activity, gradient: true, color: "green", description: "Atletas ativos", delay: 3 },
    { id: 4, title: "Fila de Espera", value: stats.waitingList, icon: ClipboardList, color: "orange", delay: 4 }
  ];

  const insights = [
    { id: 1, title: "Consultas hoje", value: appointmentMetrics.todayCount, subtitle: "Agenda do dia", tone: "primary" },
    { id: 2, title: "Consultas 7 dias", value: appointmentMetrics.weekCount, subtitle: "Próxima semana", tone: "info" },
    { id: 3, title: "Taxa de faltas", value: `${appointmentMetrics.noShowRate}%`, subtitle: "Últimos 30 dias", tone: "danger" },
    { id: 4, title: "Taxa de remarcação", value: `${appointmentMetrics.rescheduleRate}%`, subtitle: "Últimos 30 dias", tone: "warning" },
    { id: 5, title: "Consultas realizadas", value: `${appointmentMetrics.completionRate}%`, subtitle: "Últimos 30 dias", tone: "success" }
  ];

  const pulseCards = [
    { id: "pulse-1", title: "Hoje", value: appointmentMetrics.todayCount, subtitle: "Consultas", tone: "primary" },
    { id: "pulse-2", title: "Próximos 7 dias", value: appointmentMetrics.weekCount, subtitle: "Agenda geral", tone: "info" },
    { id: "pulse-3", title: "Conclusão", value: `${appointmentMetrics.completionRate}%`, subtitle: "Últimos 30 dias", tone: "success" },
    { id: "pulse-4", title: "Fila de espera", value: stats.waitingList, subtitle: "Triagem/Espera", tone: "warning" }
  ];

  const firstName = useMemo(() => {
    const rawName = user?.name || user?.nome || user?.displayName || '';
    const rawEmail = user?.email || '';
    const base = rawName || (rawEmail ? rawEmail.split('@')[0].replace(/[._-]+/g, ' ') : '');
    const first = base.trim().split(/\s+/)[0];
    return first ? `${first.charAt(0).toUpperCase()}${first.slice(1)}` : 'Admin';
  }, [user]);

  if (isLoading) {
    return (
      <div className="dashboard-stats">
        <div className="stats-grid">
          {[...Array(4)].map((_, index) => (
            <div key={index} className="skeleton-card" style={{ height: 120 }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-stats">
      <div className="dashboard-top">
        <div className="dashboard-greeting">
          <p className="greeting-label">Bem-vindo</p>
          <h2>Olá, {firstName}</h2>
          <span>Confira os principais indicadores do dia.</span>
        </div>
        <div className="pulse-grid">
          {pulseCards.map((item) => (
            <PulseCard key={item.id} {...item} />
          ))}
        </div>
      </div>

      <section className="kpi-section">
        <div className="section-header minimal">
          <div className="title-box">
            <Zap size={20} className="text-blue" />
            <h3>KPIs Administrativos</h3>
          </div>
        </div>
        <div className="stats-grid">
          {statCards.map((c) => <StatCard key={c.id} {...c} />)}
        </div>
      </section>

      <div className="dashboard-grid">
        <div className="dashboard-left">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="recent-section">
            <div className="section-header">
              <div className="title-box">
                <Activity size={20} className="text-blue" />
                <h3>Atividades recentes</h3>
              </div>
            </div>
            <div className="activities-list">
              {recentActivities.length === 0 ? (
                <div className="history-empty">Sem atividades registradas.</div>
              ) : (
                recentActivities.map((a) => <ActivityItem key={a.id} activity={a} />)
              )}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="tasks-section">
            <div className="section-header">
              <div className="title-box">
                <ClipboardList size={20} className="text-blue" />
                <h3>Tarefas da equipe</h3>
              </div>
            </div>
            <div className="tasks-stats">
              <div>
                <span>Total</span>
                <strong>{taskStats.total}</strong>
              </div>
              <div>
                <span>Pendentes</span>
                <strong>{taskStats.pendente}</strong>
              </div>
              <div>
                <span>Em andamento</span>
                <strong>{taskStats.em_andamento}</strong>
              </div>
              <div>
                <span>Concluídas</span>
                <strong>{taskStats.concluida}</strong>
              </div>
            </div>
            <div className="task-form">
              <input
                type="text"
                placeholder="Nova tarefa..."
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
              />
              <select value={taskRole} onChange={(e) => setTaskRole(e.target.value)}>
                <option value="todos">Todos</option>
                <option value="diretoria_marketing">Diretoria de Marketing</option>
                <option value="diretoria_ensino">Diretoria de Ensino</option>
                <option value="diretoria_pesquisa">Diretoria de Pesquisa</option>
                <option value="diretoria_extensao">Diretoria de Extensão</option>
                <option value="coord_atendimento">Coord. Atendimentos</option>
              </select>
              <select value={taskStatus} onChange={(e) => setTaskStatus(e.target.value)}>
                <option value="pendente">Pendente</option>
                <option value="em_andamento">Em andamento</option>
                <option value="concluida">Concluída</option>
              </select>
              <button type="button" onClick={handleAddTask}>Adicionar</button>
            </div>
            <div className="task-filters">
              <div className="task-filter-group">
                <button type="button" onClick={() => setTaskFilter("all")} className={taskFilter === "all" ? "active" : ""}>Todos</button>
                <button type="button" onClick={() => setTaskFilter("pendente")} className={taskFilter === "pendente" ? "active" : ""}>Pendentes</button>
                <button type="button" onClick={() => setTaskFilter("em_andamento")} className={taskFilter === "em_andamento" ? "active" : ""}>Em andamento</button>
                <button type="button" onClick={() => setTaskFilter("concluida")} className={taskFilter === "concluida" ? "active" : ""}>Concluídas</button>
              </div>
              <input
                type="text"
                placeholder="Buscar tarefa..."
                value={taskSearch}
                onChange={(e) => setTaskSearch(e.target.value)}
              />
            </div>
            <div className="tasks-list">
              {visibleTasks.length === 0 ? (
                <div className="history-empty">Sem tarefas no momento.</div>
              ) : (
                visibleTasks.map((task) => (
                  <div key={task.id} className={`task-item status-${task.status}`}>
                    <div>
                      {editingTaskId === task.id ? (
                        <div className="task-edit">
                          <input
                            type="text"
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                          />
                          <button type="button" onClick={() => handleSaveEdit(task)}>
                            <Save size={14} />
                          </button>
                          <button type="button" onClick={handleCancelEdit}>
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <>
                          <strong>{task.title}</strong>
                          <span>{task.createdByName || "Equipe"} - {task.assignedRole || "todos"}</span>
                        </>
                      )}
                    </div>
                    <div className="task-actions">
                      <button type="button" onClick={() => handleToggleTask(task)} className="task-toggle">
                        {task.status || "pendente"}
                      </button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => handleStartEdit(task)}>
                        <Edit2 size={14} />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </div>

        <div className="dashboard-right">
          <section className="calendar-section">
            <div className="section-header minimal">
              <div className="title-box">
                <Clock size={20} className="text-blue" />
                <h3>Agenda geral</h3>
              </div>
            </div>
            <CalendarWidget appointments={appointments} />
          </section>

          <div className="insights-section">
            <div className="section-header minimal">
              <div className="title-box">
                <TrendingUp size={20} className="text-blue" />
                <h3>Insights operacionais</h3>
              </div>
            </div>
            <div className="insights-grid">
              {insights.map((item) => (
                <InsightCard key={item.id} {...item} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardStats;

