import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarClock,
  ClipboardList,
  User,
  Clock,
  ListChecks,
  CalendarDays,
  RefreshCcw,
  Loader2,
  X
} from 'lucide-react';
import api, { getApiErrorMessage } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import { usePacientes } from '../../../contexts/PacienteContext';
import { useUiFeedback } from '../../../contexts/UiFeedbackContext';
import { toDate, toDateKey, toLocalDateInputValue } from '../../../utils/dateUtils';
import { guardAction } from '../../../utils/actionFeedback';
import AppointmentModal from '../Patients/AppointmentModal';
import './StudentAgenda.css';

const STATUS_LABELS = {
  agendada: 'Agendada',
  remarcada: 'Remarcada',
  falta: 'Falta',
  realizada: 'Realizada'
};

const APPOINTMENT_TYPE_LABELS = {
  primeira_consulta: 'Primeira consulta',
  retorno: 'Retorno'
};

const EVALUATION_LABELS = {
  bioimpedancia: 'Bioimpedância',
  dobras_cutaneas: 'Dobras Cutâneas',
  perimetros: 'Perímetros',
  alimentar: 'Avaliação Alimentar',
  hidratacao: 'Hidratação',
  avaliacao_socioeconomica: 'Socioeconômica'
};

const normalizeTimeToken = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const matched = raw.match(/^([01]\d|2[0-3]):([0-5]\d)/);
  if (!matched) return '';
  return `${matched[1]}:${matched[2]}`;
};

const toMinutes = (value) => {
  const normalized = normalizeTimeToken(value);
  if (!normalized) return Number.POSITIVE_INFINITY;
  const [hour, minute] = normalized.split(':').map((part) => Number(part));
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return Number.POSITIVE_INFINITY;
  return (hour * 60) + minute;
};

const StudentAgenda = ({ onSelectPatient = null, initialState = null, onStateChange = null }) => {
  const { user } = useAuth();
  const { convertFirebaseDate, formatDate, updateAgendamento } = usePacientes();
  const agendaInitialState = initialState || {};
  const [agendamentos, setAgendamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [isRescheduleOpen, setIsRescheduleOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [rangeFilter, setRangeFilter] = useState(() => String(agendaInitialState.rangeFilter || 'week'));
  const [statusFilter, setStatusFilter] = useState(() => String(agendaInitialState.statusFilter || 'all'));
  const [typeFilter, setTypeFilter] = useState(() => String(agendaInitialState.typeFilter || 'all'));
  const [searchTerm, setSearchTerm] = useState(() => String(agendaInitialState.searchTerm || ''));
  const [selectedDay, setSelectedDay] = useState(() => String(agendaInitialState.selectedDay || ''));
  const [selectedDetail, setSelectedDetail] = useState(null);
  const initialSelectedDetailIdRef = useRef(String(agendaInitialState.selectedDetailId || ''));
  const [actionInProgress, setActionInProgress] = useState({ id: '', type: '' });
  const { notify, confirm } = useUiFeedback();

  const baseTimeSlots = useMemo(() => {
    const slots = [];
    for (let hour = 7; hour <= 20; hour += 1) {
      slots.push(`${String(hour).padStart(2, '0')}:00`);
    }
    return slots;
  }, []);

  const loadAgendamentos = useCallback(async ({ preserveCurrent = false } = {}) => {
    if (!user?.uid) return;
    if (preserveCurrent) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }
    setLoadError('');
    try {
      const { data } = await api.get('/agendamentos', { params: { alunoId: user.uid } });
      const items = Array.isArray(data) ? data : [];
      const normalized = items.map((item) => {
        const dateObj = toDate(item.scheduledAt || item.date);
        const dateKey = dateObj ? toDateKey(dateObj) : 'Sem data';
        return { ...item, dateObj, dateKey };
      });
      const sorted = [...normalized].sort((a, b) => (a.dateObj?.getTime() || 0) - (b.dateObj?.getTime() || 0));
      setAgendamentos(sorted);
      setLastSyncedAt(new Date());
    } catch (error) {
      const message = getApiErrorMessage(error, 'Não foi possível carregar os agendamentos.');
      setAgendamentos([]);
      setLoadError(message);
      notify({
        type: 'error',
        title: 'Erro ao carregar agenda',
        message
      });
    } finally {
      if (preserveCurrent) {
        setIsRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, [notify, user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    loadAgendamentos();
  }, [loadAgendamentos, user?.uid]);

  const handleRefresh = useCallback(() => {
    loadAgendamentos({ preserveCurrent: true });
  }, [loadAgendamentos]);

  const filteredAppointments = useMemo(() => {
    if (!agendamentos.length) return [];
    const term = searchTerm.trim().toLowerCase();
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const startOfWeek = new Date(startOfToday);
    const endOfWeek = new Date(startOfToday);
    endOfWeek.setDate(endOfWeek.getDate() + 7);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    return agendamentos.filter((item) => {
      const status = item.status || 'agendada';
      if (statusFilter !== 'all' && status !== statusFilter) return false;
      const appointmentType = String(item.appointmentType || '').toLowerCase();
      if (typeFilter !== 'all' && appointmentType !== typeFilter) return false;
      if (!item.dateObj) {
        if (rangeFilter !== 'all') return false;
      } else {
        if (rangeFilter === 'today' && !(item.dateObj >= startOfToday && item.dateObj < endOfToday)) return false;
        if (rangeFilter === 'week' && !(item.dateObj >= startOfWeek && item.dateObj < endOfWeek)) return false;
        if (rangeFilter === 'month' && !(item.dateObj >= startOfMonth && item.dateObj <= endOfMonth)) return false;
      }
      if (term) {
        const haystack = [
          item.pacienteNome,
          item.time,
          APPOINTMENT_TYPE_LABELS[appointmentType] || appointmentType,
          STATUS_LABELS[status]
        ].join(' ').toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [agendamentos, rangeFilter, searchTerm, statusFilter, typeFilter]);

  const grouped = useMemo(() => {
    const map = new Map();
    filteredAppointments.forEach((item) => {
      const key = item.dateKey || 'Sem data';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    });
    const toSortWeight = (key) => {
      if (!key || key === 'Sem data') return Number.POSITIVE_INFINITY;
      const parsed = toDate(key);
      return parsed ? parsed.getTime() : Number.POSITIVE_INFINITY;
    };
    return Array.from(map.entries()).sort((a, b) => toSortWeight(a[0]) - toSortWeight(b[0]));
  }, [filteredAppointments]);

  const availableDays = useMemo(() => {
    const days = Array.from(
      new Set(filteredAppointments.map((item) => item.dateKey).filter((key) => key && key !== 'Sem data'))
    );
    return days.sort();
  }, [filteredAppointments]);

  useEffect(() => {
    if (availableDays.length === 0) {
      const todayKey = toLocalDateInputValue(new Date());
      setSelectedDay(todayKey);
      return;
    }
    if (!availableDays.includes(selectedDay)) {
      setSelectedDay(availableDays[0]);
    }
  }, [availableDays, selectedDay]);

  useEffect(() => {
    if (filteredAppointments.length === 0) {
      setSelectedDetail(null);
      return;
    }
    const preferredId = selectedDetail?.id || initialSelectedDetailIdRef.current;
    const preferredItem = preferredId
      ? filteredAppointments.find((item) => item.id === preferredId)
      : null;
    if (preferredItem) {
      setSelectedDetail(preferredItem);
      initialSelectedDetailIdRef.current = '';
      return;
    }
    if (!selectedDetail || !filteredAppointments.some((item) => item.id === selectedDetail.id)) {
      setSelectedDetail(filteredAppointments[0]);
      initialSelectedDetailIdRef.current = '';
    }
  }, [filteredAppointments, selectedDetail]);

  useEffect(() => {
    if (typeof onStateChange !== 'function') return;
    onStateChange({
      rangeFilter,
      statusFilter,
      typeFilter,
      searchTerm,
      selectedDay,
      selectedDetailId: selectedDetail?.id || ''
    });
  }, [
    onStateChange,
    rangeFilter,
    statusFilter,
    typeFilter,
    searchTerm,
    selectedDay,
    selectedDetail?.id
  ]);

  const dayAppointments = useMemo(() => {
    return filteredAppointments.filter((item) => item.dateKey === selectedDay);
  }, [filteredAppointments, selectedDay]);

  const selectedDayLabel = useMemo(() => {
    if (!selectedDay || selectedDay === 'Sem data') return 'Sem dia selecionado';
    const parsed = convertFirebaseDate(selectedDay);
    if (!parsed) return 'Sem dia selecionado';
    return formatDate(parsed);
  }, [convertFirebaseDate, formatDate, selectedDay]);

  const appointmentsByTime = useMemo(() => {
    const map = new Map();
    dayAppointments.forEach((item) => {
      const slot = normalizeTimeToken(item.time) || '--:--';
      if (!map.has(slot)) map.set(slot, []);
      map.get(slot).push(item);
    });
    return map;
  }, [dayAppointments]);

  const timelineSlots = useMemo(() => {
    const dynamicSlots = Array.from(appointmentsByTime.keys()).filter((slot) => slot !== '--:--');
    const merged = Array.from(new Set([...baseTimeSlots, ...dynamicSlots]));
    merged.sort((a, b) => toMinutes(a) - toMinutes(b));
    if (appointmentsByTime.has('--:--')) {
      merged.push('--:--');
    }
    return merged;
  }, [appointmentsByTime, baseTimeSlots]);

  const monthSummary = useMemo(() => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    const summary = {
      agendada: 0,
      realizada: 0,
      remarcada: 0,
      falta: 0
    };
    agendamentos.forEach((item) => {
      if (!item.dateObj) return;
      if (item.dateObj.getMonth() !== month || item.dateObj.getFullYear() !== year) return;
      const status = item.status || 'agendada';
      summary[status] = (summary[status] || 0) + 1;
    });
    return summary;
  }, [agendamentos]);

  const nextAppointment = useMemo(() => {
    const now = new Date();
    return [...agendamentos]
      .filter((item) => item.dateObj && item.dateObj >= now && (item.status || 'agendada') === 'agendada')
      .sort((a, b) => (a.dateObj?.getTime() || 0) - (b.dateObj?.getTime() || 0))[0];
  }, [agendamentos]);

  const handleReschedule = (appointment) => {
    setSelectedAppointment(appointment);
    setIsRescheduleOpen(true);
  };

  const handleMarkDone = async (appointment) => {
    if (!appointment?.id) return;
    const accepted = await confirm({
      title: 'Confirmar consulta realizada',
      message: `Marcar a consulta de ${appointment.pacienteNome || 'Atleta'} como realizada?`,
      confirmLabel: 'Confirmar',
      cancelLabel: 'Cancelar',
      variant: 'warning'
    });
    if (!accepted) return;

    setActionInProgress({ id: appointment.id, type: 'done' });
    try {
      await updateAgendamento(appointment.id, {
        status: 'realizada',
        completedAt: new Date().toISOString(),
        pacienteId: appointment.pacienteId,
        pacienteNome: appointment.pacienteNome,
        scheduledAt: appointment.scheduledAt || appointment.date,
        time: appointment.time
      });
      setSelectedDetail((prev) => (prev?.id === appointment.id ? { ...prev, status: 'realizada' } : prev));
      notify({
        type: 'success',
        title: 'Consulta finalizada',
        message: 'Status atualizado para realizada.'
      });
      await loadAgendamentos();
    } catch (error) {
      console.error('Erro ao marcar consulta como realizada:', error);
      notify({
        type: 'error',
        title: 'Erro ao atualizar consulta',
        message: getApiErrorMessage(error, 'Não foi possível marcar a consulta como realizada.')
      });
    } finally {
      setActionInProgress({ id: '', type: '' });
    }
  };

  const handleNoShow = async (appointment) => {
    if (!appointment?.id || !appointment?.pacienteId) return;
    const accepted = await confirm({
      title: 'Confirmar falta',
      message: `Registrar falta para ${appointment.pacienteNome || 'Atleta'} nesta consulta?`,
      confirmLabel: 'Registrar falta',
      cancelLabel: 'Cancelar',
      variant: 'danger'
    });
    if (!accepted) return;

    setActionInProgress({ id: appointment.id, type: 'no_show' });
    try {
      await updateAgendamento(appointment.id, {
        status: 'falta',
        faltouEm: new Date().toISOString(),
        pacienteId: appointment.pacienteId,
        pacienteNome: appointment.pacienteNome,
        scheduledAt: appointment.scheduledAt || appointment.date,
        time: appointment.time
      });
      setSelectedDetail((prev) => (prev?.id === appointment.id ? { ...prev, status: 'falta' } : prev));
      notify({
        type: 'success',
        title: 'Falta registrada',
        message: 'A consulta foi marcada como falta.'
      });
      await loadAgendamentos();
    } catch (error) {
      console.error('Erro ao marcar falta:', error);
      notify({
        type: 'error',
        title: 'Erro ao registrar falta',
        message: getApiErrorMessage(error, 'Não foi possível registrar a falta.')
      });
    } finally {
      setActionInProgress({ id: '', type: '' });
    }
  };

  const handleSelectDetail = (appointment) => {
    setSelectedDetail(appointment);
  };

  const handleOpenProntuario = useCallback((appointment) => {
    const hasPatient = guardAction(notify, Boolean(appointment?.pacienteId), {
      actionLabel: 'Abrir prontuário',
      reason: 'Consulta sem atleta vinculado.'
    });
    if (!hasPatient) return;
    if (typeof onSelectPatient !== 'function') return;
    onSelectPatient(
      {
        id: appointment.pacienteId,
        nome: appointment.pacienteNome || 'Atleta'
      },
      {
        source: 'agenda',
        selectedDay,
        selectedDetailId: appointment.id || ''
      }
    );
  }, [notify, onSelectPatient, selectedDay]);

  const getAppointmentDateTime = useCallback((appointment) => {
    if (!appointment) return null;
    const explicitDate = toDate(appointment.scheduledAt);
    if (explicitDate) return explicitDate;
    if (appointment.date && appointment.time) {
      return toDate(`${appointment.date}T${appointment.time}:00`);
    }
    return toDate(appointment.date);
  }, []);

  const isAppointmentInFuture = useCallback((appointment) => {
    const appointmentDateTime = getAppointmentDateTime(appointment);
    if (!appointmentDateTime) return false;
    const toleranceMs = 60 * 1000;
    return appointmentDateTime.getTime() > Date.now() + toleranceMs;
  }, [getAppointmentDateTime]);

  const canUpdateStatus = (appointment) => {
    const status = appointment?.status || 'agendada';
    if (status === 'realizada' || status === 'remarcada' || status === 'falta') return false;
    if (isAppointmentInFuture(appointment)) return false;
    return true;
  };

  const canReschedule = useCallback((appointment) => {
    const status = appointment?.status || 'agendada';
    if (status === 'realizada' || status === 'remarcada' || status === 'falta') return false;
    return true;
  }, []);

  const isActionBusy = (appointment, type) => (
    actionInProgress.id === appointment?.id && actionInProgress.type === type
  );

  const statusLockReason = useMemo(() => {
    if (selectedDetail && isAppointmentInFuture(selectedDetail)) {
      return 'A consulta ainda não chegou ao horário para concluir ou registrar falta.';
    }
    const status = selectedDetail?.status || 'agendada';
    if (status === 'realizada') return 'Consulta já finalizada.';
    if (status === 'remarcada') return 'Consulta original já remarcada.';
    if (status === 'falta') return 'Falta já registrada para esta consulta.';
    return '';
  }, [isAppointmentInFuture, selectedDetail]);

  const rescheduleLockReason = useMemo(() => {
    if (!selectedDetail) return '';
    const status = selectedDetail?.status || 'agendada';
    if (status === 'realizada') return 'Consulta já finalizada.';
    if (status === 'remarcada') return 'Consulta original já remarcada.';
    if (status === 'falta') return 'Falta já registrada para esta consulta.';
    return '';
  }, [selectedDetail]);

  const hasAppliedFilters = useMemo(() => (
    rangeFilter !== 'week'
    || statusFilter !== 'all'
    || typeFilter !== 'all'
    || searchTerm.trim().length > 0
  ), [rangeFilter, searchTerm, statusFilter, typeFilter]);

  const syncLabel = useMemo(() => {
    if (!lastSyncedAt) return 'Sincronização pendente';
    return `Atualizado às ${lastSyncedAt.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })}`;
  }, [lastSyncedAt]);

  const handleResetFilters = () => {
    setRangeFilter('week');
    setStatusFilter('all');
    setTypeFilter('all');
    setSearchTerm('');
  };

  const formatDateTimeValue = useCallback((value) => {
    if (!value) return '---';
    const parsed = toDate(value);
    if (!parsed) return '---';
    const time = parsed.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `${formatDate(parsed)} ${time}`;
  }, [formatDate]);

  const getAppointmentTypeLabel = useCallback((appointment) => {
    const key = String(appointment?.appointmentType || '').toLowerCase();
    return APPOINTMENT_TYPE_LABELS[key] || 'Não informado';
  }, []);



  // Carregando e erro ficam dentro da raiz `.student-agenda` só para o CSS
  // escopado alcançá-los; o conteúdo é o mesmo de antes.
  if (loading) {
    return (
      <div className="student-agenda">
        <div className="agenda-loading laines-feedback-state" role="status" aria-live="polite">
          <Loader2 size={20} className="spin" aria-hidden="true" />
          <span>Carregando agenda...</span>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="student-agenda">
        <div className="agenda-empty agenda-empty--error laines-feedback-state laines-feedback-state--error">
          <ClipboardList size={32} aria-hidden="true" />
          <p>{loadError}</p>
          <button type="button" className="agenda-empty-action" onClick={loadAgendamentos}>
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  // Só marca o dia de hoje na lista de dias (aria-current e o anel do CSS).
  const todayKey = toLocalDateInputValue(new Date());

  return (
    <>
      <div className="student-agenda">
        <header className="agenda-header">
          <div className="agenda-title">
            <div className="agenda-icon" aria-hidden="true">
              <CalendarClock size={20} />
            </div>
            <div>
              <h1>Minha agenda</h1>
              <p>Consultas e avaliações agendadas</p>
            </div>
          </div>
          <div className="agenda-next">
            <span className="agenda-next-label">Próxima consulta</span>
            {nextAppointment ? (
              <div className="agenda-next-card">
                <span className="agenda-next-date">
                  {formatDate(nextAppointment.dateObj)}
                </span>
                <span className="agenda-next-info">
                  {nextAppointment.time || '--:--'} - {nextAppointment.pacienteNome || 'Atleta'} - {getAppointmentTypeLabel(nextAppointment)}
                </span>
              </div>
            ) : (
              <span className="agenda-next-empty">Sem consultas futuras</span>
            )}
            <button
              type="button"
              className="agenda-refresh-btn"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              {isRefreshing ? <Loader2 size={14} className="spin" aria-hidden="true" /> : <RefreshCcw size={14} aria-hidden="true" />}
              <span>{isRefreshing ? 'Atualizando...' : 'Atualizar agenda'}</span>
            </button>
          </div>
        </header>

        <section className="agenda-summary">
          <div className="summary-card">
            <span className="summary-label">Agendadas</span>
            <strong>{monthSummary.agendada}</strong>
          </div>
          <div className="summary-card success">
            <span className="summary-label">Realizadas</span>
            <strong>{monthSummary.realizada}</strong>
          </div>
          <div className="summary-card warning">
            <span className="summary-label">Remarcadas</span>
            <strong>{monthSummary.remarcada}</strong>
          </div>
          <div className="summary-card danger">
            <span className="summary-label">Faltas</span>
            <strong>{monthSummary.falta}</strong>
          </div>
        </section>

        <section className="agenda-filters">
          <div className="filter-group">
            <span id="agenda-filtro-periodo">Período</span>
            <div className="filter-buttons" role="group" aria-labelledby="agenda-filtro-periodo">
              {['today', 'week', 'month', 'all'].map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`filter-btn ${rangeFilter === item ? 'active' : ''}`}
                  onClick={() => setRangeFilter(item)}
                  aria-pressed={rangeFilter === item}
                >
                  {item === 'today' ? 'Hoje' : item === 'week' ? 'Semana' : item === 'month' ? 'Mês' : 'Tudo'}
                </button>
              ))}
            </div>
          </div>
          <div className="filter-group">
            <span id="agenda-filtro-status">Status</span>
            <div className="filter-buttons" role="group" aria-labelledby="agenda-filtro-status">
              {['all', 'agendada', 'realizada', 'remarcada', 'falta'].map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`filter-btn ${statusFilter === item ? 'active' : ''}`}
                  onClick={() => setStatusFilter(item)}
                  aria-pressed={statusFilter === item}
                >
                  {item === 'all' ? 'Todos' : STATUS_LABELS[item]}
                </button>
              ))}
            </div>
          </div>
          <div className="filter-group">
            <span id="agenda-filtro-tipo">Tipo</span>
            <div className="filter-buttons" role="group" aria-labelledby="agenda-filtro-tipo">
              {['all', 'primeira_consulta', 'retorno'].map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`filter-btn ${typeFilter === item ? 'active' : ''}`}
                  onClick={() => setTypeFilter(item)}
                  aria-pressed={typeFilter === item}
                >
                  {item === 'all' ? 'Todos' : APPOINTMENT_TYPE_LABELS[item]}
                </button>
              ))}
            </div>
          </div>
          <div className="filter-group filter-group-search">
            <span>Busca</span>
            <div className="agenda-search-wrap">
              <input
                className="agenda-search-input"
                type="text"
                placeholder="Buscar por atleta, horário ou status..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                aria-label="Buscar na agenda por atleta, horário ou status"
              />
              {searchTerm && (
                <button
                  type="button"
                  className="agenda-search-clear"
                  onClick={() => setSearchTerm('')}
                  aria-label="Limpar busca da agenda"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>
          <div className="agenda-filter-actions">
            <button
              type="button"
              className="filter-btn"
              onClick={handleResetFilters}
              disabled={!hasAppliedFilters}
            >
              Limpar filtros
            </button>
          </div>
          <div className="filter-group">
            <span id="agenda-filtro-dia">Dia</span>
            <div className="filter-buttons day-buttons" role="group" aria-labelledby="agenda-filtro-dia">
              {availableDays.length === 0 ? (
                <span className="empty-day">Sem agenda</span>
              ) : (
                availableDays.map((day) => (
                  <button
                    key={day}
                    type="button"
                    className={`filter-btn ${selectedDay === day ? 'active' : ''}`}
                    onClick={() => setSelectedDay(day)}
                    aria-pressed={selectedDay === day}
                    aria-current={day === todayKey ? 'date' : undefined}
                  >
                    {formatDate(convertFirebaseDate(day))}
                  </button>
                ))
              )}
            </div>
          </div>
          <div className="agenda-filter-meta" role="status" aria-live="polite">
            <span>
              {filteredAppointments.length} de {agendamentos.length} consulta(s) encontrada(s)
            </span>
            <span>
              Dia selecionado: {selectedDayLabel}
            </span>
            {isRefreshing && (
              <span>Sincronizando dados da agenda...</span>
            )}
            <span>{syncLabel}</span>
          </div>
        </section>

        {filteredAppointments.length === 0 ? (
          <div className="agenda-empty laines-feedback-state">
            <ClipboardList size={32} />
            <p>
              {hasAppliedFilters
                ? 'Nenhuma consulta encontrada com os filtros aplicados.'
                : 'Sem consultas agendadas.'}
            </p>
            {hasAppliedFilters && (
              <button type="button" className="agenda-empty-action" onClick={handleResetFilters}>
                Limpar filtros
              </button>
            )}
          </div>
        ) : (
          <div className="agenda-layout">
            <div className="agenda-main">
              <section className="agenda-timeline">
                <header>
                  <CalendarDays size={16} />
                  <h3>Agenda do dia</h3>
                </header>
                <div className="agenda-slots">
                  {timelineSlots.map((slot) => {
                    const slotAppointments = appointmentsByTime.get(slot) || [];
                    return (
                      <div key={slot} className={`agenda-slot ${slotAppointments.length ? 'has-event' : ''}`}>
                        <div className="agenda-slot-time">{slot}</div>
                        <div className="agenda-slot-body">
                          {slotAppointments.length === 0 ? (
                            <span className="agenda-slot-empty">Livre</span>
                          ) : (
                            slotAppointments.map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                className={`agenda-slot-card status-${item.status || 'agendada'} ${selectedDetail?.id === item.id ? 'is-selected' : ''}`}
                                onClick={() => handleSelectDetail(item)}
                                aria-pressed={selectedDetail?.id === item.id}
                              >
                                <span>{item.pacienteNome || 'Atleta'}</span>
                                <span className="status-pill">{STATUS_LABELS[item.status || 'agendada']}</span>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="agenda-list">
                {grouped.map(([dateKey, items]) => (
                  <section key={dateKey} className="agenda-day">
                    <div className="agenda-day-header">
                      <h2>{formatDate(convertFirebaseDate(dateKey))}</h2>
                      <span>{items.length} consulta(s)</span>
                    </div>
                    <div className="agenda-cards">
                      {items.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={`agenda-card ${selectedDetail?.id === item.id ? 'is-selected' : ''}`}
                          onClick={() => handleSelectDetail(item)}
                          aria-pressed={selectedDetail?.id === item.id}
                        >
                          <div className="agenda-card-top">
                            <div className="agenda-card-patient">
                              <User size={16} />
                              <span>{item.pacienteNome || 'Atleta'}</span>
                            </div>
                            <div className="agenda-card-time">
                              <Clock size={14} />
                              <span>{item.time || 'Horário'}</span>
                            </div>
                          </div>
                          <div className="agenda-card-meta">
                            <span className="agenda-chip muted">
                              {getAppointmentTypeLabel(item)}
                            </span>
                            <span className="agenda-chip">
                              {(item.evaluations || []).length} avaliação(ões)
                            </span>
                            <span className={`agenda-chip muted status-${item.status || 'agendada'}`}>
                              {STATUS_LABELS[item.status || 'agendada']}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </section>
                ))}
              </section>
            </div>

            <aside className="agenda-detail">
              <div className="detail-header">
                <ListChecks size={18} />
                <h3>Detalhe da consulta</h3>
              </div>
              {selectedDetail ? (
                <div className="detail-body">
                  <div className="detail-row">
                    <span>Atleta</span>
                    <strong>{selectedDetail.pacienteNome || 'Atleta'}</strong>
                  </div>
                  <div className="detail-row">
                    <span>Data</span>
                    <strong>{formatDate(selectedDetail.dateObj || convertFirebaseDate(selectedDetail.date))}</strong>
                  </div>
                  <div className="detail-row">
                    <span>Horário</span>
                    <strong>{selectedDetail.time || '--:--'}</strong>
                  </div>
                  <div className="detail-row">
                    <span>Tipo</span>
                    <strong>{getAppointmentTypeLabel(selectedDetail)}</strong>
                  </div>
                  <div className="detail-row">
                    <span>Status</span>
                    <strong className={`status-text status-${selectedDetail.status || 'agendada'}`}>
                      {STATUS_LABELS[selectedDetail.status || 'agendada']}
                    </strong>
                  </div>
                  <div className="detail-section">
                    <span>Rastreabilidade</span>
                    <ul className="detail-trace-list">
                      <li>
                        <strong>Data base:</strong> {selectedDetail.dateObj ? formatDate(selectedDetail.dateObj) : '---'} {selectedDetail.time || '--:--'}
                      </li>
                      {selectedDetail.remarcadaPara && (
                        <li>
                          <strong>Remarcada para:</strong> {formatDateTimeValue(selectedDetail.remarcadaPara)}
                        </li>
                      )}
                      {selectedDetail.remarcadaEm && (
                        <li>
                          <strong>Remarcada em:</strong> {formatDateTimeValue(selectedDetail.remarcadaEm)}
                        </li>
                      )}
                      {selectedDetail.completedAt && (
                        <li>
                          <strong>Finalizada em:</strong> {formatDateTimeValue(selectedDetail.completedAt)}
                        </li>
                      )}
                      {selectedDetail.faltouEm && (
                        <li>
                          <strong>Falta registrada em:</strong> {formatDateTimeValue(selectedDetail.faltouEm)}
                        </li>
                      )}
                    </ul>
                  </div>
                  <div className="detail-section">
                    <span>Avaliações</span>
                    <ul>
                      {(selectedDetail.evaluations || []).map((item) => (
                        <li key={item}>{EVALUATION_LABELS[item] || item}</li>
                      ))}
                      {(!selectedDetail.evaluations || selectedDetail.evaluations.length === 0) && (
                        <li>Sem avaliações</li>
                      )}
                    </ul>
                  </div>
                  <div className="detail-actions">
                    <button
                      className="agenda-action ghost"
                      type="button"
                      onClick={() => handleOpenProntuario(selectedDetail)}
                    >
                      Abrir prontuário
                    </button>
                    <button
                      className="agenda-action ghost"
                      type="button"
                      onClick={() => handleReschedule(selectedDetail)}
                      disabled={!canReschedule(selectedDetail) || actionInProgress.id === selectedDetail.id}
                    >
                      Remarcar
                    </button>
                    <button
                      className="agenda-action ghost"
                      type="button"
                      onClick={() => handleNoShow(selectedDetail)}
                      disabled={!canUpdateStatus(selectedDetail) || actionInProgress.id === selectedDetail.id}
                    >
                      {isActionBusy(selectedDetail, 'no_show') ? 'Registrando...' : 'Falta'}
                    </button>
                    <button
                      className="agenda-action primary"
                      type="button"
                      onClick={() => handleMarkDone(selectedDetail)}
                      disabled={!canUpdateStatus(selectedDetail) || actionInProgress.id === selectedDetail.id}
                    >
                      {isActionBusy(selectedDetail, 'done') ? 'Atualizando...' : 'Consulta realizada'}
                    </button>
                  </div>
                  {!canUpdateStatus(selectedDetail) && (
                    <p className="detail-status-note">{statusLockReason}</p>
                  )}
                  {!canReschedule(selectedDetail) && (
                    <p className="detail-status-note">{rescheduleLockReason}</p>
                  )}
                </div>
              ) : (
                <div className="detail-empty laines-feedback-state">
                  <p>Selecione uma consulta para ver os detalhes.</p>
                </div>
              )}
            </aside>
          </div>
        )}
      </div>
      <AppointmentModal
        isOpen={isRescheduleOpen}
        onClose={() => {
          setIsRescheduleOpen(false);
          setSelectedAppointment(null);
        }}
        patient={selectedAppointment ? { nome: selectedAppointment.pacienteNome, id: selectedAppointment.pacienteId } : null}
        appointment={selectedAppointment}
        isReschedule
        onSuccess={loadAgendamentos}
      />
    </>
  );
};

export default StudentAgenda;



