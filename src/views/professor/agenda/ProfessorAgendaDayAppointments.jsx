import React from 'react';
import { CalendarDays, Clock3, ClipboardList, UserRound, UserSquare2 } from 'lucide-react';
import { STATUS_LABELS, TYPE_LABELS } from './agendaConstants';

const ProfessorAgendaDayAppointments = ({
  selectedDayLabel,
  dayAppointments,
  onOpenProntuario
}) => {
  return (
    <article className="professor-agenda-day-card">
      <header className="day-card-header">
        <div>
          <h3>{selectedDayLabel}</h3>
          <p>{dayAppointments.length} consulta(s) neste dia com os filtros atuais.</p>
        </div>
      </header>

      {dayAppointments.length === 0 ? (
        <div className="day-empty-state">
          <CalendarDays size={20} />
          <p>Nenhuma consulta para este dia com os filtros aplicados.</p>
        </div>
      ) : (
        <div className="day-appointments-list">
          {dayAppointments.map((item) => (
            <div key={item.id} className="day-appointment-item">
              <div className="appointment-item-main">
                <div className="appointment-row">
                  <Clock3 size={14} />
                  <span>{item.time || '--:--'}</span>
                </div>
                <div className="appointment-row">
                  <UserRound size={14} />
                  <strong>{item.pacienteNome || 'Paciente'}</strong>
                </div>
                <div className="appointment-row">
                  <UserSquare2 size={14} />
                  <span>{item.alunoNome || 'Aluno responsável não informado'}</span>
                </div>
                <div className="appointment-meta">
                  <span className={`meta-pill status-${item.statusNorm}`}>{STATUS_LABELS[item.statusNorm] || item.statusNorm}</span>
                  <span className="meta-pill">{TYPE_LABELS[item.typeNorm] || 'Tipo não informado'}</span>
                  <span className="meta-pill">
                    <ClipboardList size={12} />
                    {Array.isArray(item.evaluations) ? item.evaluations.length : 0}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="open-prontuario-btn"
                onClick={() => onOpenProntuario(item)}
              >
                Abrir prontuário
              </button>
            </div>
          ))}
        </div>
      )}
    </article>
  );
};

export default ProfessorAgendaDayAppointments;
