import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Users,
  CalendarCheck,
  LayoutGrid,
  List,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  CalendarPlus,
  ClipboardList,
} from 'lucide-react';
import api, { getApiErrorMessage } from '../../../services/api';
import { usePacientes } from '../../../contexts/PacienteContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useUiFeedback } from '../../../contexts/UiFeedbackContext';
import { toDateKey } from '../../../utils/dateUtils';

import ProximasAcoes from '../../../components/Dashboard/ProximasAcoes';
import { FeedbackState } from '../../../components/ui';
import './StudentDashboard.css';

const CalendarWidget = ({ items }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
  const monthName = currentDate.toLocaleString('pt-BR', { month: 'long' });
  const year = currentDate.getFullYear();

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
    (items || []).forEach((item) => {
      if (!item.dateObj) return;
      const key = toDateKey(item.dateObj);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    });
    return map;
  }, [items]);

  const getDayKey = (day) => {
    const month = currentDate.getMonth() + 1;
    const yearValue = currentDate.getFullYear();
    return `${yearValue}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const statusLabel = {
    agendada: 'Agendada',
    remarcada: 'Remarcada',
    falta: 'Falta',
    realizada: 'Realizada'
  };

  return (
    <div className="student-calendar">
      <div className="student-calendar-header">
        <div className="student-calendar-title">
          <span className="month">{monthName}</span>
          <span className="year">{year}</span>
        </div>
        <div className="student-calendar-nav">
          <button type="button" onClick={() => changeMonth(-1)} aria-label="Mês anterior">
            <ChevronLeft size={16} />
          </button>
          <button type="button" onClick={() => changeMonth(1)} aria-label="Próximo mês">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="student-calendar-grid">
        {weekDays.map((day) => (
          <div key={day} className="student-weekday">{day}</div>
        ))}
        {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
        {Array.from({ length: days }).map((_, i) => {
          const day = i + 1;
          const isToday = isCurrentMonth && day === today;
          const key = getDayKey(day);
          const dayAppointments = appointmentsByDay.get(key) || [];
          const hasAppointments = dayAppointments.length > 0;
          const statusCounts = dayAppointments.reduce((acc, item) => {
            const status = item.status || 'agendada';
            acc[status] = (acc[status] || 0) + 1;
            return acc;
          }, {});
          const groupedStatuses = Object.entries(statusCounts).map(([status, count]) => ({
            status,
            count
          }));

          return (
            <div key={day} className={`student-calendar-day ${isToday ? 'today' : ''} ${hasAppointments ? 'has-event' : ''}`}>
              {day}
              {hasAppointments && (
                <>
                  <div className="student-event-dots">
                    {groupedStatuses.slice(0, 3).map((item) => (
                      <span key={item.status} className={`student-event-dot status-${item.status || 'agendada'}`}>
                        {item.count > 1 && <span className="student-dot-count">{item.count}</span>}
                      </span>
                    ))}
                  </div>
                  <div className="student-calendar-tooltip">
                    <strong>{`${dayAppointments.length} compromisso(s)`}</strong>
                    <ul>
                      {groupedStatuses.map((item) => (
                        <li key={item.status} className={`status-${item.status || 'agendada'}`}>
                          {item.count}x {statusLabel[item.status] || item.status}
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
const getCurrentSemester = () => {
  const now = new Date();
  const year = now.getFullYear();
  const semester = now.getMonth() < 6 ? 1 : 2;
  return `${year}.${semester}`;
};

const StudentDashboard = ({ onSelectPatient, onAgendar, defaultViewMode = 'cards', showTips = true }) => {
  const { pacientes, loading, convertFirebaseDate, formatDate } = usePacientes();
  const { user } = useAuth();
  const { notify } = useUiFeedback();
  const [viewMode, setViewMode] = useState(defaultViewMode);
  const [searchTerm, setSearchTerm] = useState('');
  const [appointments, setAppointments] = useState([]);

  const firstName = useMemo(() => {
    const rawName = user?.name || user?.nome || user?.displayName || '';
    const rawEmail = user?.email || '';
    const base = rawName || (rawEmail ? rawEmail.split('@')[0].replace(/[._-]+/g, ' ') : '');
    const first = base.trim().split(/\s+/)[0];
    return first ? `${first.charAt(0).toUpperCase()}${first.slice(1)}` : 'Estudante';
  }, [user]);

  const pacientesOrdenados = useMemo(() => {
    const filtered = pacientes.filter((p) => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        p.nome?.toLowerCase().includes(term) ||
        p.cpf?.replace(/\D/g, '').includes(searchTerm.replace(/\D/g, ''))
      );
    });
    return [...filtered].sort((a, b) => {
      const aDate = a.updatedAt || a.createdAt || a.dataCadastro || 0;
      const bDate = b.updatedAt || b.createdAt || b.dataCadastro || 0;
      return new Date(bDate) - new Date(aDate);
    });
  }, [pacientes, searchTerm]);

  const loadAppointments = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const { data } = await api.get('/agendamentos', { params: { alunoId: user.uid } });
      const items = Array.isArray(data) ? data : [];
      const normalized = items.map((item) => ({
        ...item,
        dateObj: convertFirebaseDate(item.scheduledAt || item.date)
      }));
      setAppointments(normalized);
    } catch (error) {
      setAppointments([]);
      notify({
        type: 'warning',
        title: 'Agenda indisponível',
        message: getApiErrorMessage(error, 'Não foi possível carregar os agendamentos agora.')
      });
    }
  }, [convertFirebaseDate, notify, user]);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  const proximasAcoesItems = useMemo(() => {
    const items = [];
    const now = new Date();

    const upcoming = appointments
      .filter((a) => a.dateObj && a.dateObj >= now && (a.status || 'agendada') === 'agendada')
      .sort((a, b) => a.dateObj - b.dateObj)
      .slice(0, 5);

    for (const apt of upcoming) {
      items.push({
        id: `consulta-${apt.id}`,
        tipo: 'consulta',
        label: 'Consulta agendada',
        pacienteNome: apt.pacienteNome || 'Atleta',
        detalhe: `${formatDate(apt.dateObj)}${apt.time ? ` · ${apt.time}` : ''}`,
        onClick: () => {
          const patient = pacientesOrdenados.find((p) => p.id === apt.pacienteId);
          if (patient) onSelectPatient(patient);
        }
      });
    }

    const pendentes = pacientesOrdenados
      .filter((p) => (p.status || '').toLowerCase() === 'pendente')
      .slice(0, 5);

    for (const p of pendentes) {
      items.push({
        id: `avaliacao-${p.id}`,
        tipo: 'avaliacao',
        label: 'Avaliação pendente',
        pacienteNome: p.nome || 'Atleta',
        detalhe: null,
        onClick: () => onSelectPatient(p)
      });
    }

    return items;
  }, [appointments, pacientesOrdenados, formatDate, onSelectPatient]);

  return (
    <div className="student-dashboard">
      <div className="dashboard-header">
        <div className="welcome-text">
          <h1>Olá, {firstName}</h1>
          <p>Aqui estão seus atletas vinculados.</p>
        </div>
        <div className="header-actions">
          <div className="search-box">
            <input
              type="text"
              placeholder="Buscar atleta..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="view-toggle">
            <button
              className={`toggle-btn ${viewMode === 'cards' ? 'active' : ''}`}
              onClick={() => setViewMode('cards')}
              type="button"
            >
              <LayoutGrid size={16} /> Cards
            </button>
            <button
              className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              type="button"
            >
              <List size={16} /> Lista
            </button>
          </div>
          <div className="semester-badge">
            <CalendarCheck size={18} />
            Semestre {getCurrentSemester()}
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="main-column">
          <div className="section-header">
            <div className="section-icon icon-blue">
              <Users size={20} />
            </div>
            <h3 className="section-title">Meus Atletas</h3>
          </div>

          {loading ? (
            <FeedbackState loading skeletonLines={4} />
          ) : pacientesOrdenados.length === 0 ? (
            <FeedbackState
              empty
              icon={UserPlus}
              title="Nenhum atleta vinculado ainda."
              description='Acesse "Meus Atletas" na barra lateral para adicionar o primeiro.'
            />
          ) : viewMode === 'list' ? (
            <div className="patients-list">
              {pacientesOrdenados.map((p) => (
                <div key={p.id} className="patient-list-item">
                  <button
                    type="button"
                    className="patient-list-item__info"
                    onClick={() => onSelectPatient(p)}
                  >
                    <div className="patient-avatar">
                      {p.nome?.charAt(0).toUpperCase() || 'P'}
                    </div>
                    <div className="patient-list-info">
                      <h4 className="patient-name">{p.nome || 'Atleta'}</h4>
                      <p className="last-visit">
                        {p.modalidade || `Cadastro: ${p.dataCadastroFormatada || '---'}`}
                      </p>
                    </div>
                  </button>
                  <span className={`status-badge ${p.status === 'Ativo' ? 'badge-ok' : 'badge-attention'}`}>
                    {p.status || 'Pendente'}
                  </span>
                  <div className="patient-list-item__actions">
                    <button
                      type="button"
                      className="pat-action-btn"
                      onClick={() => onSelectPatient(p)}
                      title="Abrir prontuário"
                    >
                      <ClipboardList size={14} />
                    </button>
                    {onAgendar && (
                      <button
                        type="button"
                        className="pat-action-btn"
                        onClick={() => onAgendar(p)}
                        title="Agendar consulta"
                      >
                        <CalendarPlus size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="patients-grid">
              {pacientesOrdenados.map((p) => (
                <div key={p.id} className="patient-card">
                  <button
                    type="button"
                    className="patient-card__body"
                    onClick={() => onSelectPatient(p)}
                  >
                    <div className={`card-decoration ${p.status === 'Ativo' ? 'decor-ok' : 'decor-attention'}`} />
                    <div className="card-top">
                      <div className="patient-avatar">
                        {p.nome?.charAt(0).toUpperCase() || 'P'}
                      </div>
                    </div>
                    <h4 className="patient-name">{p.nome || 'Atleta'}</h4>
                    <p className="last-visit">
                      {p.modalidade || `Cadastro: ${p.dataCadastroFormatada || '---'}`}
                    </p>
                    <div className={`status-badge ${p.status === 'Ativo' ? 'badge-ok' : 'badge-attention'}`}>
                      {p.status || 'Pendente'}
                    </div>
                  </button>
                  {onAgendar && (
                    <div className="patient-card__actions">
                      <button
                        type="button"
                        className="pat-action-btn pat-action-btn--labeled"
                        onClick={() => onAgendar(p)}
                      >
                        <CalendarPlus size={13} />
                        <span>Agendar</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {showTips && (
          <div className="side-column">
            <div className="section-header">
              <div className="section-icon icon-blue">
                <CalendarCheck size={20} />
              </div>
              <h3 className="section-title">Agenda</h3>
            </div>

            <CalendarWidget items={appointments} />

            <ProximasAcoes
              items={proximasAcoesItems}
              loading={loading}
              titulo="Próximas ações"
            />

          </div>
        )}
      </div>

    </div>
  );
};

export default StudentDashboard;
