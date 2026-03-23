import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search
} from 'lucide-react';
import api, { getApiErrorMessage } from '../../services/api';
import { toDate, toDateKey, toLocalDateInputValue } from '../../utils/dateUtils';
import { useUiFeedback } from '../../contexts/UiFeedbackContext';
import { guardAction } from '../../utils/actionFeedback';
import ProfessorAgendaDayAppointments from './agenda/ProfessorAgendaDayAppointments';
import {
  STATUS_LABELS,
  TYPE_LABELS,
  WEEKDAY_LABELS,
  formatMonthTitle,
  toMonthPrefix,
  buildMonthCells
} from './agenda/agendaConstants';
import './ProfessorAgenda.css';

const ProfessorAgenda = ({ onSelectPatient, initialState = null, onStateChange = null }) => {
  const { notify } = useUiFeedback();
  const agendaInitialState = initialState || {};
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [searchTerm, setSearchTerm] = useState(() => String(agendaInitialState.searchTerm || ''));
  const [statusFilter, setStatusFilter] = useState(() => String(agendaInitialState.statusFilter || 'all'));
  const [typeFilter, setTypeFilter] = useState(() => String(agendaInitialState.typeFilter || 'all'));
  const [monthCursor, setMonthCursor] = useState(() => {
    const parsed = toDate(agendaInitialState.monthCursor);
    return parsed || new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState(() => (
    String(agendaInitialState.selectedDay || toLocalDateInputValue(new Date()))
  ));
  const [lastSyncedAt, setLastSyncedAt] = useState(null);

  const loadAppointments = useCallback(async ({ silent = false } = {}) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setLoadError('');
    try {
      const { data } = await api.get('/agendamentos');
      const list = Array.isArray(data) ? data : [];
      const normalized = list
        .map((item) => {
          const dateObj = toDate(item.scheduledAt)
            || toDate(item.date && item.time ? `${item.date}T${item.time}:00` : item.date);
          return {
            ...item,
            dateObj,
            dayKey: dateObj ? toDateKey(dateObj) : '',
            statusNorm: String(item.status || 'agendada').trim().toLowerCase(),
            typeNorm: String(item.appointmentType || '').trim().toLowerCase()
          };
        })
        .filter((item) => item.dateObj);

      normalized.sort((a, b) => {
        const aTime = a.dateObj?.getTime() || 0;
        const bTime = b.dateObj?.getTime() || 0;
        if (aTime !== bTime) return aTime - bTime;
        return String(a.time || '').localeCompare(String(b.time || ''));
      });

      setAppointments(normalized);
      setLastSyncedAt(new Date());
    } catch (error) {
      const message = getApiErrorMessage(error, 'Não foi possível carregar a agenda do professor.');
      setAppointments([]);
      setLoadError(message);
      notify({
        type: 'error',
        title: 'Erro ao carregar agenda',
        message
      });
    } finally {
      if (silent) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, [notify]);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  const monthPrefix = useMemo(() => toMonthPrefix(monthCursor), [monthCursor]);
  const monthCells = useMemo(() => buildMonthCells(monthCursor), [monthCursor]);

  const monthAppointments = useMemo(() => (
    appointments.filter((item) => item.dayKey?.startsWith(monthPrefix))
  ), [appointments, monthPrefix]);

  useEffect(() => {
    if (!selectedDay.startsWith(monthPrefix)) {
      const firstAppointmentInMonth = monthAppointments[0]?.dayKey;
      setSelectedDay(firstAppointmentInMonth || `${monthPrefix}-01`);
      return;
    }
    if (!monthAppointments.some((item) => item.dayKey === selectedDay)) {
      const firstAppointmentInMonth = monthAppointments[0]?.dayKey;
      if (firstAppointmentInMonth) {
        setSelectedDay(firstAppointmentInMonth);
      }
    }
  }, [monthAppointments, monthPrefix, selectedDay]);

  const filteredMonthAppointments = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return monthAppointments.filter((item) => {
      if (statusFilter !== 'all' && item.statusNorm !== statusFilter) return false;
      if (typeFilter !== 'all' && item.typeNorm !== typeFilter) return false;
      if (term) {
        const haystack = [
          item.pacienteNome,
          item.alunoNome,
          item.time,
          STATUS_LABELS[item.statusNorm],
          TYPE_LABELS[item.typeNorm]
        ].join(' ').toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [monthAppointments, searchTerm, statusFilter, typeFilter]);

  const appointmentsByDay = useMemo(() => {
    const map = new Map();
    filteredMonthAppointments.forEach((item) => {
      const key = item.dayKey;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    });
    return map;
  }, [filteredMonthAppointments]);

  const dayAppointments = useMemo(() => {
    const list = appointmentsByDay.get(selectedDay) || [];
    return [...list].sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')));
  }, [appointmentsByDay, selectedDay]);

  const monthSummary = useMemo(() => {
    const summary = { agendada: 0, realizada: 0, remarcada: 0, falta: 0 };
    monthAppointments.forEach((item) => {
      const key = item.statusNorm || 'agendada';
      if (Object.prototype.hasOwnProperty.call(summary, key)) {
        summary[key] += 1;
      }
    });
    return summary;
  }, [monthAppointments]);

  const dayKeyToday = toDateKey(new Date());

  const syncLabel = useMemo(() => {
    if (!lastSyncedAt) return 'Sincronização pendente';
    return `Atualizado as ${lastSyncedAt.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    })}`;
  }, [lastSyncedAt]);

  const selectedDayLabel = useMemo(() => {
    const parsed = toDate(selectedDay);
    return parsed ? parsed.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long'
    }) : selectedDay;
  }, [selectedDay]);

  const hasFilters = Boolean(searchTerm.trim()) || statusFilter !== 'all' || typeFilter !== 'all';

  useEffect(() => {
    if (typeof onStateChange !== 'function') return;
    onStateChange({
      searchTerm,
      statusFilter,
      typeFilter,
      selectedDay,
      monthCursor: monthCursor.toISOString()
    });
  }, [monthCursor, onStateChange, searchTerm, selectedDay, statusFilter, typeFilter]);

  const handleOpenProntuario = useCallback((item) => {
    const hasPatient = guardAction(notify, Boolean(item?.pacienteId), {
      actionLabel: 'Abrir prontuário',
      reason: 'Consulta sem paciente vinculado.'
    });
    if (!hasPatient) return;
    onSelectPatient?.(
      {
        id: item.pacienteId,
        nome: item.pacienteNome || 'Paciente'
      },
      {
        source: 'agenda',
        selectedDay,
        monthCursor: monthCursor.toISOString()
      }
    );
  }, [monthCursor, notify, onSelectPatient, selectedDay]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setTypeFilter('all');
  };

  if (loading) {
    return (
      <div className="professor-agenda-loading laines-feedback-state">
        <RefreshCw size={18} className="is-rotating" />
        <span>Carregando agenda do professor...</span>
      </div>
    );
  }

  return (
    <div className="professor-agenda">
      <header className="professor-agenda-header">
        <div>
          <span className="section-label">AGENDA CLINICA</span>
          <h1>Calendario do professor</h1>
          <p>Acompanhe consultas por dia, aluno responsável e status.</p>
        </div>
        <div className="professor-agenda-header-actions">
          <button
            type="button"
            className="professor-agenda-refresh"
            onClick={() => loadAppointments({ silent: true })}
            disabled={refreshing}
          >
            <RefreshCw size={15} className={refreshing ? 'is-rotating' : ''} />
            {refreshing ? 'Atualizando...' : 'Atualizar'}
          </button>
          <span className="professor-agenda-sync">{syncLabel}</span>
        </div>
      </header>

      <section className="professor-agenda-stats">
        <div className="professor-agenda-stat">
          <span>Agendadas</span>
          <strong>{monthSummary.agendada}</strong>
        </div>
        <div className="professor-agenda-stat success">
          <span>Realizadas</span>
          <strong>{monthSummary.realizada}</strong>
        </div>
        <div className="professor-agenda-stat warning">
          <span>Remarcadas</span>
          <strong>{monthSummary.remarcada}</strong>
        </div>
        <div className="professor-agenda-stat danger">
          <span>Faltas</span>
          <strong>{monthSummary.falta}</strong>
        </div>
      </section>

      <section className="professor-agenda-filters">
        <div className="professor-agenda-search">
          <Search size={16} />
          <input
            type="text"
            placeholder="Buscar por paciente, aluno ou horario..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="all">Todos os status</option>
          <option value="agendada">Agendada</option>
          <option value="realizada">Realizada</option>
          <option value="remarcada">Remarcada</option>
          <option value="falta">Falta</option>
        </select>
        <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
          <option value="all">Todos os tipos</option>
          <option value="primeira_consulta">Primeira consulta</option>
          <option value="retorno">Retorno</option>
        </select>
        <button type="button" onClick={handleResetFilters} disabled={!hasFilters}>
          Limpar filtros
        </button>
      </section>

      {loadError && (
        <div className="professor-agenda-error laines-feedback-state laines-feedback-state--error">{loadError}</div>
      )}

      <section className="professor-agenda-layout">
        <article className="professor-agenda-calendar-card">
          <div className="professor-agenda-month-header">
            <button
              type="button"
              className="month-nav-btn"
              onClick={() => setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
              aria-label="Mês anterior"
            >
              <ChevronLeft size={16} />
            </button>
            <h3>{formatMonthTitle(monthCursor)}</h3>
            <button
              type="button"
              className="month-nav-btn"
              onClick={() => setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
              aria-label="Próximo mês"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="professor-agenda-weekdays">
            {WEEKDAY_LABELS.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>

          <div className="professor-agenda-days-grid">
            {monthCells.map((cellDate, index) => {
              if (!cellDate) {
                return <div key={`empty-${index}`} className="calendar-day-empty" />;
              }

              const dayKey = toDateKey(cellDate);
              const dayItems = appointmentsByDay.get(dayKey) || [];
              const isSelected = dayKey === selectedDay;
              const isToday = dayKey === dayKeyToday;
              const hasItems = dayItems.length > 0;

              return (
                <button
                  key={dayKey}
                  type="button"
                  className={`calendar-day-btn ${isSelected ? 'is-selected' : ''} ${isToday ? 'is-today' : ''} ${hasItems ? 'has-items' : ''}`}
                  onClick={() => setSelectedDay(dayKey)}
                >
                  <span className="day-number">{cellDate.getDate()}</span>
                  {hasItems && <span className="day-badge">{dayItems.length}</span>}
                </button>
              );
            })}
          </div>
        </article>

        <ProfessorAgendaDayAppointments
          selectedDayLabel={selectedDayLabel}
          dayAppointments={dayAppointments}
          onOpenProntuario={handleOpenProntuario}
        />
      </section>
    </div>
  );
};

export default ProfessorAgenda;

