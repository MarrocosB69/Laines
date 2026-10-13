import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Users,
  Activity,
  AlertTriangle,
  CalendarDays,
  Clock,
  ChevronRight,
  ChevronLeft,
  UserPlus,
  FileCheck,
  ClipboardList,
  Edit2,
  Plus,
  Save,
  Trash2
} from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import { useUiFeedback } from "../../../contexts/UiFeedbackContext";
import { toDate } from "../../../utils/dateUtils";
import Button from "../../../components/ui/Button";
import TaskCompletionEditor from "../../../components/shared/TaskCompletionEditor";
import TaskDeadline from "../../../components/shared/TaskDeadline";
import {
  PainelVisaoGeral,
  PainelCabecalho,
  PainelIndicadores,
  PainelSecao,
  PainelLista,
  saudacaoPorHorario
} from "../../../components/painel/Painel";
import { buildSidebarModel } from "../../../navigation/sidebarModel";
import api, { getApiErrorMessage } from "../../../services/api";
import "./DashboardStats.css";

const DASHBOARD_REFRESH_MS = Number(import.meta.env.VITE_DASHBOARD_REFRESH_MS);
const DASHBOARD_REFRESH_INTERVAL = Number.isFinite(DASHBOARD_REFRESH_MS) && DASHBOARD_REFRESH_MS > 0
  ? DASHBOARD_REFRESH_MS
  : 60_000;

const CalendarWidget = ({ appointments = [] }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  // Popover do dia: antes só abria com onMouseEnter, o que deixava o detalhe
  // (quais consultas, com quem) fora de alcance de teclado e toque. Agora é
  // estado — abre no foco/toque (onClick) do próprio botão do dia, fecha no
  // Escape ou ao sair do botão.
  const [diaAberto, setDiaAberto] = useState(null);
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
      // Use local date to avoid UTC midnight shift across timezones
      const y = dateObj.getFullYear();
      const m = String(dateObj.getMonth() + 1).padStart(2, "0");
      const d = String(dateObj.getDate()).padStart(2, "0");
      const key = `${y}-${m}-${d}`;
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
          const dayContent = (
            <>
              {day}
              {isToday && !hasAppointments && <div className="event-dot" />}
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
            </>
          );
          return hasAppointments ? (
            <button
              key={day}
              type="button"
              className={`calendar-day has-event${isToday ? " today" : ""}${diaAberto === key ? " is-open" : ""}`}
              aria-label={`${day} — ${dayAppointments.length} consulta(s)`}
              aria-expanded={diaAberto === key}
              onClick={() => setDiaAberto((atual) => (atual === key ? null : key))}
              onFocus={() => setDiaAberto(key)}
              onBlur={() => setDiaAberto((atual) => (atual === key ? null : atual))}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  setDiaAberto(null);
                }
              }}
            >
              {dayContent}
            </button>
          ) : (
            <motion.div
              key={day}
              whileHover={{ scale: 1.05 }}
              className={`calendar-day${isToday ? " today" : ""}`}
              aria-label={isToday ? `${day} — hoje` : undefined}
            >
              {dayContent}
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

const InsightCard = ({ title, value, subtitle, tone = "primary" }) => (
  <div className={`insight-card insight-${tone}`}>
    <span className="insight-label">{title}</span>
    <strong>{value}</strong>
    {subtitle && <span className="insight-subtitle">{subtitle}</span>}
  </div>
);

// Tom só como acento: o tipo continua escrito na linha (meta), então a cor
// nunca carrega o significado sozinha.
const ACTIVITY_TONES = {
  falta: "atencao",
  realizada: "positivo"
};

// Mesmo ícone e mesmo rótulo do antigo ActivityItem, agora como linha de
// PainelLista (contrato em docs/implementacao/visao-geral-v2/contrato-painel.md).
const toActivityListItem = (activity) => {
  const Icon = activity.type === "user" ? UserPlus : activity.type === "link" ? Users : FileCheck;
  const label = activity.user || activity.patient || activity.label || "Registro";
  return {
    id: activity.id,
    titulo: activity.action,
    subtitulo: `${label} — ${activity.time} atrás`,
    meta: activity.type,
    tom: ACTIVITY_TONES[activity.type] || "neutro",
    icone: Icon
  };
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

const TASK_STATUS_FLOW = ["pendente", "em_andamento", "concluida"];

const TASK_STATUS_LABELS = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  bloqueada: "Bloqueada"
};

const TASK_ROLE_LABELS = {
  todos: "Todos",
  diretoria_marketing: "Diretoria de Marketing",
  diretoria_ensino: "Diretoria de Ensino",
  diretoria_pesquisa: "Diretoria de Pesquisa",
  diretoria_extensao: "Diretoria de Extensão",
  coord_atendimento: "Equipe de atendimento"
};

const taskNeedsDueDate = (assignedRole) => (
  String(assignedRole || "").startsWith("diretoria_") || assignedRole === "coord_atendimento"
);

const BOARD_COLUMNS = [
  { id: "entrada", title: "Entrada", subtitle: "triagens, ideias e tarefas novas", tone: "warning" },
  { id: "planejamento", title: "Planejamento", subtitle: "vínculos, equipe e preparação", tone: "info" },
  { id: "andamento", title: "Em andamento", subtitle: "execução clínica e institucional", tone: "primary" },
  { id: "revisao", title: "Revisão", subtitle: "itens esperando decisão", tone: "danger" },
  { id: "concluido", title: "Concluído", subtitle: "fechamentos recentes", tone: "success" }
];

const normalizeBoardKey = (value) => String(value || "")
  .trim()
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^\w\s-]/g, "")
  .replace(/[\s-]+/g, "_")
  .replace(/_+/g, "_")
  .replace(/^_+|_+$/g, "");

const buildEmptyBoardColumns = () => BOARD_COLUMNS.map((column) => ({
  ...column,
  total: 0,
  cards: []
}));

const normalizeBoardColumns = (data) => {
  const incomingColumns = Array.isArray(data?.columns) ? data.columns : [];
  if (incomingColumns.length === 0) return buildEmptyBoardColumns();
  const byId = new Map(incomingColumns.map((column) => [column.id, column]));

  return BOARD_COLUMNS.map((column) => {
    const incoming = byId.get(column.id) || {};
    const cards = Array.isArray(incoming.cards) ? incoming.cards : [];
    const parsedTotal = Number(incoming.total);
    return {
      ...incoming,
      ...column,
      total: Number.isFinite(parsedTotal) ? parsedTotal : cards.length,
      cards
    };
  });
};

// Falha do quadro: o aviso "Alguns cartões não puderam ser atualizados
// agora." virou o estado de erro da seção (com "Tentar novamente"), porque
// as colunas voltam vazias nesse caso e "0 cartão(ões)" diria que não há nada.
const OperationalBoard = ({
  columns, onOpenTab, onMoveTask, onCardAction, estado, onTentarNovamente,
  completionTarget, completionNote, onNoteChange, onComplete, onCancelCompletion, isCompleting,
  taskLookup, deadlineNow
}) => {
  const totalCards = columns.reduce((sum, column) => sum + column.total, 0);

  return (
    <PainelSecao
      id="kanban-coordenacao"
      titulo="Kanban da coordenação"
      descricao={estado === "pronto" ? `${totalCards} cartão(ões) operacionais` : undefined}
      estado={estado}
      erro={{ mensagem: "Alguns cartões não puderam ser atualizados agora.", onTentarNovamente }}
    >
      <div className="coord-board" aria-label="Kanban operacional da coordenação">
        {columns.map((column) => (
          <section key={column.id} className={`coord-board-column board-tone-${column.tone}`}>
            <div className="coord-board-column-header">
              <div>
                <strong>{column.title}</strong>
                <span>{column.subtitle}</span>
              </div>
              <span className="coord-board-count">{column.total}</span>
            </div>
            <div className="coord-board-list">
              {column.cards.length === 0 ? (
                <div className="coord-board-empty">Sem cartões.</div>
              ) : (
                column.cards.map((card) => (
                  <article key={card.id} className={`coord-board-card board-card-${card.source}`}>
                    <div className="coord-board-card-top">
                      <span className="coord-board-source">{card.sourceLabel}</span>
                      <span className="coord-board-status">{card.statusLabel}</span>
                    </div>
                    <strong>{card.title}</strong>
                    {card.subtitle && <p>{card.subtitle}</p>}
                    <div className="coord-board-meta">
                      {card.meta && <span>{card.meta}</span>}
                      {card.time && <span>{card.time}</span>}
                    </div>
                    {card.task && taskLookup.get(card.task.id) && (
                      <TaskDeadline task={taskLookup.get(card.task.id)} now={deadlineNow} />
                    )}
                    {card.tags?.length > 0 && (
                      <div className="coord-board-tags">
                        {card.tags.slice(0, 3).map((tag) => (
                          <span key={tag}>{tag}</span>
                        ))}
                      </div>
                    )}
                    <div className="coord-board-actions">
                      {card.task ? (
                        <>
                          <button
                            type="button"
                            onClick={() => onMoveTask({ ...card.task, title: card.title }, -1)}
                            disabled={card.taskStatusIndex <= 0}
                            aria-label="Mover tarefa para status anterior"
                          >
                            <ChevronLeft size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={(event) => onMoveTask({ ...card.task, title: card.title }, 1, event.currentTarget)}
                            disabled={card.taskStatusIndex >= TASK_STATUS_FLOW.length - 1}
                            aria-label={card.taskStatusIndex === TASK_STATUS_FLOW.length - 2
                              ? `Marcar tarefa ${card.title} como feita`
                              : "Mover tarefa para próximo status"}
                          >
                            {card.taskStatusIndex === TASK_STATUS_FLOW.length - 2 ? "Concluir" : <ChevronRight size={13} />}
                          </button>
                        </>
                      ) : (
                        <>
                          {card.action && (
                            <button type="button" className="coord-board-primary-action" onClick={() => onCardAction?.(card)}>
                              {card.action.label} <ChevronRight size={13} />
                            </button>
                          )}
                          <button type="button" onClick={() => onOpenTab?.(card.targetTab)}>
                            Abrir <ChevronRight size={13} />
                          </button>
                        </>
                      )}
                    </div>
                    {card.task && completionTarget?.source === "board" && completionTarget.id === card.task.id && (
                      <TaskCompletionEditor
                        taskTitle={card.title}
                        note={completionNote}
                        onNoteChange={onNoteChange}
                        onSubmit={onComplete}
                        onCancel={onCancelCompletion}
                        isSaving={isCompleting}
                      />
                    )}
                  </article>
                ))
              )}
              {column.total > column.cards.length && (
                <div className="coord-board-more">+{column.total - column.cards.length} item(ns)</div>
              )}
            </div>
          </section>
        ))}
      </div>
    </PainelSecao>
  );
};

// blocoDeGestao ("Direção" ou "Gestão"): WI-015, página única de quem tem
// dois papéis. O painel vira um bloco da Visão geral do portal de origem, que
// já tem o cabeçalho com a saudação e a própria agenda — por isso, aqui, sem
// os dois e com ids que não colidem com os daquela página.
const DashboardStats = ({ onOpenAdminTab, blocoDeGestao = null }) => {
  const { user, capabilities } = useAuth();
  const [stats, setStats] = useState({ totalPatients: 0, professors: 0, activePatients: 0, waitingList: 0, semResponsavel: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [summaryError, setSummaryError] = useState(false);
  // Distingue "ainda não carregou / falhou" de "carregou e o valor é zero".
  // Sem isto, uma falha de rede reiniciava os indicadores para 0 e a tela
  // comunicava normalidade (ou atraso) que não foi apurada.
  const [metricsLoaded, setMetricsLoaded] = useState(false);
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
  const [deadlineNow, setDeadlineNow] = useState(() => new Date());
  const [operationalBoardColumns, setOperationalBoardColumns] = useState(() => buildEmptyBoardColumns());
  const [boardError, setBoardError] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskRole, setTaskRole] = useState("todos");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskStatus, setTaskStatus] = useState("pendente");
  const [taskFilter, setTaskFilter] = useState("all");
  const [taskSearch, setTaskSearch] = useState("");
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingDueDate, setEditingDueDate] = useState("");
  const [completionTarget, setCompletionTarget] = useState(null);
  const [completionNote, setCompletionNote] = useState("");
  const [isCompleting, setIsCompleting] = useState(false);
  const completionTriggerRef = React.useRef(null);
  const { notify, confirm } = useUiFeedback();

  const loadDashboardData = useCallback(async (silent = false, options = {}) => {
    if (!user) return;
    if (!silent) setIsLoading(true);
    try {
      const normalizedRole = String(user?.role || "").toLowerCase();
      const canLoadCoordBoard = normalizedRole === "admin" || normalizedRole === "coordenacao";
      const boardRequest = canLoadCoordBoard
        ? api.get("/analytics/dashboard/operational-board", {
          params: options.forceRefreshBoard ? { forceRefresh: "true" } : undefined
        })
          .then((res) => ({ ok: true, data: res.data }))
          .catch(() => ({ ok: false, data: null }))
        : Promise.resolve({ ok: true, data: null });

      const [summaryRes, tarefasRes, boardResult] = await Promise.all([
        api.get("/analytics/dashboard/summary").catch(() => ({ data: null })),
        api.get("/tarefas").catch(() => ({ data: null })),
        boardRequest
      ]);

      const summaryOk = Boolean(summaryRes?.data);
      setSummaryError(!summaryOk);

      // Uma falha de rede não pode "zerar" indicadores que já mostravam um
      // valor real — isso leria como "zero atletas" em vez de "não atualizou
      // agora". Só troca o que está na tela quando o servidor de fato respondeu.
      if (summaryOk) {
        const summary = summaryRes.data;
        const summaryMetrics = summary.metrics || {};
        const summaryAppointments = summary.appointments || {};
        const summaryAppointmentItems = Array.isArray(summaryAppointments.items) ? summaryAppointments.items : [];
        const summaryAppointmentMetrics = summaryAppointments.summary || {};
        const summaryActivities = Array.isArray(summary.recentActivities) ? summary.recentActivities : [];

        setStats({
          totalPatients: Number(summaryMetrics.totalPatients || 0),
          professors: Number(summaryMetrics.professors || 0),
          activePatients: Number(summaryMetrics.activePatients || 0),
          waitingList: Number(summaryMetrics.waitingList || 0),
          semResponsavel: Number(summaryMetrics.semResponsavel || 0)
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
        setMetricsLoaded(true);
      }

      if (Array.isArray(tarefasRes?.data)) {
        setTasks(tarefasRes.data);
      }

      if (canLoadCoordBoard) {
        setOperationalBoardColumns(normalizeBoardColumns(boardResult?.data));
        setBoardError(!boardResult?.ok);
      } else {
        setOperationalBoardColumns(buildEmptyBoardColumns());
        setBoardError(false);
      }
    } catch (error) {
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

  useEffect(() => {
    const intervalId = setInterval(() => setDeadlineNow(new Date()), 60_000);
    return () => clearInterval(intervalId);
  }, []);

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

  const isElevatedRole = useMemo(() => {
    const r = roleLabel;
    return r === "admin" || r === "coordenacao";
  }, [roleLabel]);

  const visibleTasks = useMemo(() => {
    return tasks.filter((task) => {
        if (taskFilter === "all") return true;
        return task.status === taskFilter;
      })
      .filter((task) => {
        const term = taskSearch.trim().toLowerCase();
        if (!term) return true;
        return task.title?.toLowerCase().includes(term);
      });
  }, [taskFilter, taskSearch, tasks]);

  const taskStats = useMemo(() => {
    return {
      total: tasks.length,
      pendente: tasks.filter((task) => task.status === "pendente").length,
      em_andamento: tasks.filter((task) => task.status === "em_andamento").length,
      concluida: tasks.filter((task) => task.status === "concluida").length
    };
  }, [tasks]);

  const taskLookup = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);

  const handleAddTask = async () => {
    const title = taskTitle.trim();
    if (!title) return;
    if (taskNeedsDueDate(taskRole) && !taskDueDate) {
      notify({ type: "error", title: "Prazo necessário", message: "Informe a data de término da tarefa da equipe." });
      return;
    }
    try {
      await api.post("/tarefas", {
        title,
        status: taskStatus,
        assignedRole: taskRole,
        dueDate: taskDueDate || null
      });
      setTaskTitle("");
      setTaskStatus("pendente");
      setTaskRole("todos");
      setTaskDueDate("");
      await loadDashboardData(true, { forceRefreshBoard: true });
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

  const handleReopenTask = async (task, nextStatus = "pendente") => {
    try {
      await api.patch(`/tarefas/${task.id}`, { status: nextStatus });
      await loadDashboardData(true, { forceRefreshBoard: true });
      notify({
        type: "info",
        title: "Status atualizado",
        message: "A tarefa foi reaberta para a equipe."
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

  const openCompletion = (task, source, trigger) => {
    completionTriggerRef.current = trigger || null;
    setCompletionTarget({ id: task.id, title: task.title, source });
    setCompletionNote("");
  };

  const closeCompletion = () => {
    setCompletionTarget(null);
    setCompletionNote("");
    completionTriggerRef.current?.focus();
  };

  const handleCompleteTask = async () => {
    if (!completionTarget || isCompleting) return;
    setIsCompleting(true);
    try {
      await api.patch(`/tarefas/${completionTarget.id}/resolver`, { completionNote: completionNote.trim() });
      closeCompletion();
      await loadDashboardData(true, { forceRefreshBoard: true });
      notify({ type: "success", title: "Tarefa concluída", message: "Entrega registrada para toda a equipe." });
    } catch (error) {
      notify({
        type: "error",
        title: "Falha ao concluir tarefa",
        message: getApiErrorMessage(error, "Não foi possível registrar a entrega.")
      });
    } finally {
      setIsCompleting(false);
    }
  };

  const handleMoveTaskStatus = async (task, direction, trigger) => {
    const currentStatus = normalizeBoardKey(task.status || "pendente");
    const currentIndex = Math.max(0, TASK_STATUS_FLOW.indexOf(currentStatus));
    const nextIndex = Math.max(0, Math.min(TASK_STATUS_FLOW.length - 1, currentIndex + direction));
    const nextStatus = TASK_STATUS_FLOW[nextIndex];
    if (!nextStatus || nextStatus === currentStatus) return;
    if (nextStatus === "concluida") {
      openCompletion(task, "board", trigger);
      return;
    }
    if (currentStatus === "concluida") {
      await handleReopenTask(task, nextStatus);
      return;
    }

    try {
      await api.patch(`/tarefas/${task.id}`, { status: nextStatus });
      await loadDashboardData(true, { forceRefreshBoard: true });
      notify({
        type: "info",
        title: "Kanban atualizado",
        message: `Tarefa movida para ${TASK_STATUS_LABELS[nextStatus] || nextStatus}.`
      });
    } catch (error) {
      notify({
        type: "error",
        title: "Falha ao mover tarefa",
        message: getApiErrorMessage(error, "Não foi possível atualizar o cartão.")
      });
    }
  };

  const handleBoardCardAction = async (card) => {
    const action = card?.action;
    if (!action) return;

    if (action.openOnly) {
      onOpenAdminTab?.(card.targetTab);
      return;
    }

    if (action.confirmTitle || action.confirmMessage) {
      const accepted = await confirm({
        title: action.confirmTitle || "Atualizar cartão",
        message: action.confirmMessage || `Atualizar "${card.title}"?`,
        confirmLabel: action.label || "Confirmar",
        cancelLabel: "Cancelar"
      });
      if (!accepted) return;
    }

    try {
      const method = String(action.method || "patch").toLowerCase();
      if (method === "post") {
        await api.post(action.url, action.payload || {});
      } else if (method === "delete") {
        await api.delete(action.url);
      } else {
        await api.patch(action.url, action.payload || {});
      }
      await loadDashboardData(true, { forceRefreshBoard: true });
      notify({
        type: "success",
        title: "Kanban atualizado",
        message: action.successMessage || "Cartão atualizado."
      });
    } catch (error) {
      notify({
        type: "error",
        title: "Falha ao atualizar cartão",
        message: getApiErrorMessage(error, "Não foi possível executar esta ação.")
      });
    }
  };

  const handleStartEdit = (task) => {
    setEditingTaskId(task.id);
    setEditingTitle(task.title || "");
    setEditingDueDate(task.dueDate || "");
  };

  const handleCancelEdit = () => {
    setEditingTaskId(null);
    setEditingTitle("");
    setEditingDueDate("");
  };

  const handleSaveEdit = async (task) => {
    const title = editingTitle.trim();
    if (!title) return;
    if (task.status !== "concluida" && taskNeedsDueDate(task.assignedRole) && !editingDueDate) {
      notify({ type: "error", title: "Prazo necessário", message: "Informe a data de término da tarefa da equipe." });
      return;
    }
    try {
      await api.patch(`/tarefas/${task.id}`, task.status === "concluida"
        ? { title }
        : { title, dueDate: editingDueDate || null });
      await loadDashboardData(true, { forceRefreshBoard: true });
      notify({
        type: "success",
        title: "Tarefa atualizada",
        message: task.status === "concluida" ? "Título atualizado." : "Título e prazo atualizados."
      });
      handleCancelEdit();
    } catch (error) {
      notify({
        type: "error",
        title: "Falha ao atualizar",
        message: getApiErrorMessage(error, "Não foi possível salvar a tarefa.")
      });
    }
  };

  const handleArchiveTask = async (task) => {
    const confirmed = await confirm({
      title: "Arquivar tarefa",
      message: `Deseja arquivar "${task.title}"? Ela sairá da lista ativa, mas o histórico de entrega continuará nos relatórios.`,
      confirmLabel: "Arquivar",
      cancelLabel: "Cancelar"
    });
    if (!confirmed) return;
    try {
      await api.delete(`/tarefas/${task.id}`);
      await loadDashboardData(true, { forceRefreshBoard: true });
      notify({
        type: "success",
        title: "Tarefa arquivada",
        message: "A tarefa saiu da lista ativa."
      });
    } catch (error) {
      notify({
        type: "error",
        title: "Falha ao arquivar",
        message: getApiErrorMessage(error, "Não foi possível arquivar a tarefa.")
      });
    }
  };

  // "—" é indisponível (ainda não carregou ou a última tentativa falhou);
  // "0" só aparece quando o servidor confirmou um valor real igual a zero.
  // As duas coisas não podem parecer iguais na tela.
  const formatCount = (value) => (metricsLoaded ? value : "—");
  const formatRate = (value) => (metricsLoaded ? `${value}%` : "—");

  // Na faixa, o indisponível vai como null: PainelIndicadores desenha o
  // mesmo "—" de formatCount e ainda anuncia "sem dado" ao leitor de tela.
  // Carregado, o valor é o mesmo número que formatCount mostraria.
  const formatIndicador = (value) => (metricsLoaded ? value : null);

  // Faixa da Visão geral: os quatro números mais acionáveis. O tom de
  // atenção só acende com valor confirmado pelo servidor e maior que zero.
  const indicadores = [
    { id: "hoje", rotulo: "Hoje", valor: formatIndicador(appointmentMetrics.todayCount), detalhe: "Consultas agendadas", icone: CalendarDays, tom: "neutro" },
    { id: "fila-espera", rotulo: "Fila de espera", valor: formatIndicador(stats.waitingList), detalhe: "Triagem / aguardando vaga", icone: ClipboardList, tom: metricsLoaded && stats.waitingList > 0 ? "atencao" : "neutro" },
    { id: "pacientes-ativos", rotulo: "Pacientes Ativos", valor: formatIndicador(stats.activePatients), detalhe: "Status ativo no sistema", icone: Activity, tom: "neutro" },
    { id: "sem-responsavel", rotulo: "Sem responsável", valor: formatIndicador(stats.semResponsavel), detalhe: "Paciente(s) ativo(s) sem responsável atribuído", icone: AlertTriangle, tom: metricsLoaded && stats.semResponsavel > 0 ? "atencao" : "neutro" }
  ];

  // Os dois KPIs de cadastro que não entram na faixa continuam visíveis no
  // bloco "KPIs Administrativos".
  const kpiCards = [
    { id: 1, title: "Total Atletas", value: formatCount(stats.totalPatients), tone: "primary" },
    { id: 2, title: "Professores/Profissionais", value: formatCount(stats.professors), tone: "info" }
  ];

  const insights = [
    { id: 2, title: "Consultas agendadas", value: formatCount(appointmentMetrics.weekCount), subtitle: "Próximos 7 dias", tone: "info" },
    { id: 3, title: "Taxa de faltas", value: formatRate(appointmentMetrics.noShowRate), subtitle: "Agendamentos dos últimos 30 dias", tone: "danger" },
    { id: 4, title: "Taxa de remarcação", value: formatRate(appointmentMetrics.rescheduleRate), subtitle: "Agendamentos dos últimos 30 dias", tone: "warning" },
    { id: 5, title: "Consultas realizadas", value: formatRate(appointmentMetrics.completionRate), subtitle: "Agendamentos dos últimos 30 dias", tone: "success" }
  ];

  const firstName = useMemo(() => {
    const rawName = user?.name || user?.nome || user?.displayName || '';
    const rawEmail = user?.email || '';
    const base = rawName || (rawEmail ? rawEmail.split('@')[0].replace(/[._-]+/g, ' ') : '');
    const first = base.trim().split(/\s+/)[0];
    return first ? `${first.charAt(0).toUpperCase()}${first.slice(1)}` : 'Admin';
  }, [user]);

  // Mesmo rótulo do cartão de papel da sidebar (buildSidebarModel é JS puro
  // e só lê user/capabilities; não decide acesso).
  const papel = useMemo(
    () => buildSidebarModel({ portal: "admin", user, capabilities }).papel.titulo,
    [capabilities, user]
  );

  // Carga inicial: cada bloco mostra o próprio esqueleto em vez de a página
  // inteira trocar por cartões vazios.
  const estadoBloco = isLoading ? "carregando" : "pronto";

  // Blocos que dependem do resumo: se ele falhou antes de qualquer carga bem
  // sucedida, o calendário vazio e "Sem atividades" diriam "não há" quando
  // o certo é "não carregou". Com dado anterior na tela, segue "pronto" e o
  // aviso de desatualizado explica. "Tentar novamente" reusa a mesma carga.
  const estadoResumo = isLoading ? "carregando" : summaryError && !metricsLoaded ? "erro" : "pronto";
  const erroResumo = {
    mensagem: "Não foi possível carregar este bloco agora.",
    onTentarNovamente: () => loadDashboardData()
  };

  // O quadro volta vazio sempre que a chamada falha (normalizeBoardColumns
  // de null), então o erro substitui as colunas vazias.
  const estadoQuadro = isLoading ? "carregando" : boardError ? "erro" : "pronto";

  const embutido = Boolean(blocoDeGestao);
  const nomeDoBloco = embutido ? String(blocoDeGestao).toLowerCase() : "";
  // Atalho para as solicitações, só no bloco e só com a capacidade do servidor.
  const acaoSolicitacoes = embutido && capabilities?.gestao?.solicitacoes && onOpenAdminTab
    ? { rotulo: "Ver solicitações", onClick: () => onOpenAdminTab("requests") }
    : undefined;

  const painel = (
    <PainelVisaoGeral>
      {embutido ? (
        <div className="dash-bloco-gestao-cabeca">
          <h2 id="bloco-gestao-titulo" className="dash-bloco-gestao-titulo">{blocoDeGestao}</h2>
          <p className="dash-bloco-gestao-apoio">Indicadores da liga e o que precisa da sua ação.</p>
        </div>
      ) : (
        <PainelCabecalho
          saudacao={saudacaoPorHorario(new Date())}
          nome={firstName}
          papel={papel}
          data={new Date()}
        />
      )}

      <PainelIndicadores
        rotulo={embutido ? `Indicadores da ${nomeDoBloco}` : "Principais indicadores do dia"}
        carregando={isLoading}
        itens={indicadores}
      />

      {summaryError && (
        <div className="dashboard-stale-banner" role="alert">
          <AlertTriangle size={14} aria-hidden="true" />
          {metricsLoaded
            ? "Não foi possível atualizar os indicadores. Exibindo última versão disponível."
            : "Não foi possível carregar os indicadores agora."}
        </div>
      )}

      <PainelSecao
        id={embutido ? "gestao-precisa-de-voce" : "precisa-de-voce"}
        titulo={embutido ? `O que precisa da ${nomeDoBloco}` : "O que precisa de você"}
        acao={acaoSolicitacoes}
        estado={estadoBloco}
      >
        {stats.semResponsavel > 0 && (
          <div className="dashboard-risk-bar" role="status">
            <AlertTriangle size={14} aria-hidden="true" />
            <span>
              <strong>{stats.semResponsavel}</strong> paciente(s) ativo(s) sem responsável atribuído
            </span>
          </div>
        )}

        <div className="tasks-section">
          <div className="tasks-header">
            <h3 className="dash-subtitulo">Tarefas da equipe</h3>
            {isElevatedRole && (
              <button
                type="button"
                className="task-form-toggle"
                onClick={() => setIsTaskFormOpen((v) => !v)}
                aria-expanded={isTaskFormOpen}
              >
                <Plus size={14} aria-hidden="true" />
                {isTaskFormOpen ? "Cancelar" : "Nova tarefa"}
              </button>
            )}
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
          {isElevatedRole && isTaskFormOpen && (
            <div className="task-form">
              <input
                type="text"
                placeholder="Nova tarefa..."
                aria-label="Título da nova tarefa"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
              />
              <select value={taskRole} onChange={(e) => setTaskRole(e.target.value)} aria-label="Responsável pela tarefa">
                <option value="todos">Todos</option>
                <option value="diretoria_marketing">Diretoria de Marketing</option>
                <option value="diretoria_ensino">Diretoria de Ensino</option>
                <option value="diretoria_pesquisa">Diretoria de Pesquisa</option>
                <option value="diretoria_extensao">Diretoria de Extensão</option>
                <option value="coord_atendimento">Equipe de atendimento</option>
              </select>
              <label className="task-date-field">
                <span>Data de término {taskNeedsDueDate(taskRole) ? "*" : "(opcional)"}</span>
                <input
                  type="date"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                  required={taskNeedsDueDate(taskRole)}
                />
              </label>
              <select value={taskStatus} onChange={(e) => setTaskStatus(e.target.value)} aria-label="Status da tarefa">
                <option value="pendente">Pendente</option>
                <option value="em_andamento">Em andamento</option>
              </select>
              <button type="button" onClick={handleAddTask}>Adicionar</button>
            </div>
          )}
          <div className="task-filters">
            <div className="task-filter-group" role="group" aria-label="Filtrar tarefas por status">
              <button type="button" onClick={() => setTaskFilter("all")} className={taskFilter === "all" ? "active" : ""} aria-pressed={taskFilter === "all"}>Todos</button>
              <button type="button" onClick={() => setTaskFilter("pendente")} className={taskFilter === "pendente" ? "active" : ""} aria-pressed={taskFilter === "pendente"}>Pendentes</button>
              <button type="button" onClick={() => setTaskFilter("em_andamento")} className={taskFilter === "em_andamento" ? "active" : ""} aria-pressed={taskFilter === "em_andamento"}>Em andamento</button>
              <button type="button" onClick={() => setTaskFilter("concluida")} className={taskFilter === "concluida" ? "active" : ""} aria-pressed={taskFilter === "concluida"}>Concluídas</button>
            </div>
            <input
              type="text"
              placeholder="Buscar tarefa..."
              aria-label="Buscar tarefa"
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
                          aria-label="Título da tarefa"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                        />
                        <input
                          type="date"
                          aria-label={task.status === "concluida" ? "Prazo da tarefa; reabra para alterar" : "Data de término da tarefa"}
                          value={editingDueDate}
                          onChange={(e) => setEditingDueDate(e.target.value)}
                          disabled={task.status === "concluida"}
                        />
                         <button type="button" onClick={() => handleSaveEdit(task)} aria-label="Salvar título e prazo">
                          <Save size={14} aria-hidden="true" />
                        </button>
                        <button type="button" onClick={handleCancelEdit}>
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <>
                        <strong>{task.title}</strong>
                        <span>{TASK_STATUS_LABELS[task.status] || task.status || "Pendente"} · {TASK_ROLE_LABELS[task.assignedRole] || task.assignedRole || "Todos"} · Criada por {task.createdByName || "Equipe"}</span>
                        <TaskDeadline task={task} now={deadlineNow} />
                        {task.status === "concluida" && task.completedByName && (
                          <span>Concluída por {task.completedByName}</span>
                        )}
                        {task.status === "concluida" && task.completionNote && (
                          <p className="task-completion-note">Observação da entrega: {task.completionNote}</p>
                        )}
                      </>
                    )}
                  </div>
                  <div className="task-actions">
                    {(task.status !== "concluida" || isElevatedRole) && (
                      <button
                        type="button"
                        onClick={(event) => task.status === "concluida"
                          ? handleReopenTask(task)
                          : openCompletion(task, "list", event.currentTarget)}
                        className="task-toggle"
                      >
                        {task.status === "concluida" ? "Reabrir" : "Marcar como feita"}
                      </button>
                    )}
                    {isElevatedRole && (
                      <>
                        <Button type="button" variant="ghost" size="sm" onClick={() => handleStartEdit(task)} aria-label="Editar tarefa">
                          <Edit2 size={14} />
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => handleArchiveTask(task)} aria-label="Arquivar tarefa">
                          <Trash2 size={14} />
                        </Button>
                      </>
                    )}
                  </div>
                  {completionTarget?.source === "list" && completionTarget.id === task.id && (
                    <TaskCompletionEditor
                      taskTitle={task.title}
                      note={completionNote}
                      onNoteChange={setCompletionNote}
                      onSubmit={handleCompleteTask}
                      onCancel={closeCompletion}
                      isSaving={isCompleting}
                    />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </PainelSecao>
      {!embutido && (
        <PainelSecao
          id="agenda"
          titulo="Agenda"
          descricao="Agenda geral"
          estado={estadoResumo}
          erro={erroResumo}
        >
          <CalendarWidget appointments={appointments} />
        </PainelSecao>
      )}

      {isElevatedRole && (
        <OperationalBoard
          columns={operationalBoardColumns}
          onOpenTab={onOpenAdminTab}
          onMoveTask={handleMoveTaskStatus}
          onCardAction={handleBoardCardAction}
          completionTarget={completionTarget}
          completionNote={completionNote}
          onNoteChange={setCompletionNote}
          onComplete={handleCompleteTask}
          onCancelCompletion={closeCompletion}
          isCompleting={isCompleting}
          taskLookup={taskLookup}
          deadlineNow={deadlineNow}
          estado={estadoQuadro}
          onTentarNovamente={() => loadDashboardData()}
        />
      )}

      <PainelSecao
        id="atividades-recentes"
        titulo="Atividades recentes"
        estado={estadoResumo !== "pronto" ? estadoResumo : recentActivities.length === 0 ? "vazio" : "pronto"}
        vazio={{ titulo: "Sem atividades registradas." }}
        erro={erroResumo}
      >
        <PainelLista
          rotuloAcessivel="Atividades recentes"
          itens={recentActivities.map(toActivityListItem)}
        />
      </PainelSecao>

      {/* Insights e KPIs ficam "pronto" mesmo sem resumo: cada número já
          mostra "—" (formatCount/formatRate), e o aviso acima explica. */}
      <PainelSecao
        id="insights-operacionais"
        titulo="Insights operacionais"
        descricao="Taxa de falta, remarcação e realização consideram os agendamentos com data nos últimos 30 dias, de qualquer status."
        estado={estadoBloco}
      >
        <div className="insights-grid">
          {insights.map((item) => (
            <InsightCard key={item.id} {...item} />
          ))}
        </div>
      </PainelSecao>

      <PainelSecao
        id="kpis-administrativos"
        titulo="KPIs Administrativos"
        estado={estadoBloco}
      >
        <div className="insights-grid">
          {kpiCards.map((item) => (
            <InsightCard key={item.id} {...item} />
          ))}
        </div>
      </PainelSecao>
    </PainelVisaoGeral>
  );

  return embutido ? (
    <section className="dashboard-stats dashboard-stats-embutido" aria-labelledby="bloco-gestao-titulo">
      {painel}
    </section>
  ) : (
    <div className="dashboard-stats">{painel}</div>
  );
};

export default DashboardStats;

