import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Users,
  CalendarCheck,
  LayoutGrid,
  List,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import api from '../../../services/api';
import { usePacientes } from '../../../contexts/PacienteContext';
import { useAuth } from '../../../contexts/AuthContext';
import { toDateKey } from '../../../utils/dateUtils';

import './StudentDashboard.css';

const StudentDashboard = ({ onSelectPatient, defaultViewMode = 'cards', showTips = true }) => {
  const { pacientes, loading, convertFirebaseDate, formatDate } = usePacientes();
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState(defaultViewMode);
  const [searchTerm, setSearchTerm] = useState('');
  const [nextAppointment, setNextAppointment] = useState(null);
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
      const upcoming = normalized
        .filter((item) => item.dateObj && item.dateObj >= new Date() && (item.status || 'agendada') === 'agendada')
        .sort((a, b) => a.dateObj - b.dateObj)[0];
      setAppointments(normalized);
      setNextAppointment(upcoming || null);
    } catch (error) {
      setAppointments([]);
      setNextAppointment(null);
    }
  }, [convertFirebaseDate, user?.uid]);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

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
            <button type="button" onClick={() => changeMonth(-1)}>
              <ChevronLeft size={16} />
            </button>
            <button type="button" onClick={() => changeMonth(1)}>
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

  return (
    <div className="student-dashboard">
      <div className="dashboard-header">
        <div className="welcome-text">
          <h1>Ola, {firstName}</h1>
          <p>Aqui estao seus pacientes vinculados.</p>
        </div>
        <div className="header-actions">
          <div className="search-box">
            <input
              type="text"
              placeholder="Buscar paciente..."
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
            Semestre 2026.1
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="main-column">
          <div className="section-header">
            <div className="section-icon icon-blue">
              <Users size={20} />
            </div>
            <h3 className="section-title">Meus Pacientes</h3>
          </div>

          {loading ? (
            <div className="loading-state laines-feedback-state">Carregando pacientes...</div>
          ) : pacientesOrdenados.length === 0 ? (
            <div className="empty-state laines-feedback-state">Nenhum paciente vinculado ainda.</div>
          ) : viewMode === 'list' ? (
            <div className="patients-list">
              {pacientesOrdenados.map((p) => (
                <button
                  key={p.id}
                  className="patient-list-item"
                  onClick={() => onSelectPatient(p)}
                  type="button"
                >
                  <div className="patient-list-main">
                    <div className="patient-avatar">
                      {p.nome?.charAt(0).toUpperCase() || 'P'}
                    </div>
                    <div className="patient-list-info">
                      <h4 className="patient-name">{p.nome || 'Paciente'}</h4>
                      <p className="last-visit">
                        Cadastro: {p.dataCadastroFormatada || p.dataCadastro || '---'}
                      </p>
                    </div>
                  </div>
                  <span className={`status-badge ${p.status === 'Ativo' ? 'badge-ok' : 'badge-attention'}`}>
                    {p.status || 'Pendente'}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="patients-grid">
              {pacientesOrdenados.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onSelectPatient(p)}
                  className="patient-card"
                  type="button"
                >
                  <div className={`card-decoration ${p.status === 'Ativo' ? 'decor-ok' : 'decor-attention'}`} />
                  <div className="card-top">
                    <div className="patient-avatar">
                      {p.nome?.charAt(0).toUpperCase() || 'P'}
                    </div>
                  </div>
                  <h4 className="patient-name">{p.nome || 'Paciente'}</h4>
                  <p className="last-visit">
                    Cadastro: {p.dataCadastroFormatada || p.dataCadastro || '---'}
                  </p>
                  <div className={`status-badge ${p.status === 'Ativo' ? 'badge-ok' : 'badge-attention'}`}>
                    {p.status || 'Pendente'}
                  </div>
                </button>
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

            <div className="section-header">
              <div className="section-icon icon-green">
                <CalendarCheck size={20} />
              </div>
              <h3 className="section-title">Próxima ação</h3>
            </div>

            <div className="next-action-card">
              {nextAppointment ? (
                <>
                  <p className="next-action-label">Consulta agendada</p>
                  <h4 className="next-action-title">{nextAppointment.pacienteNome || 'Paciente'}</h4>
                  <p className="next-action-meta">
                    {formatDate(nextAppointment.dateObj)} - {nextAppointment.time || '--:--'}
                  </p>
                </>
              ) : (
                <>
                  <p className="next-action-label">Sem consultas futuras</p>
                  <h4 className="next-action-title">Agenda livre</h4>
                  <p className="next-action-meta">Organize novos atendimentos</p>
                </>
              )}
            </div>

          </div>
        )}
      </div>

    </div>
  );
};

export default StudentDashboard;
