import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, CalendarClock, CheckSquare } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { usePacientes } from '../../../contexts/PacienteContext';
import { useModalBodyLock } from '../../../hooks/useModalBodyLock';
import { useModalFocusTrap } from '../../../hooks/useModalFocusTrap';
import { getApiErrorMessage } from '../../../services/api';
import './AppointmentModal.css';

const evaluationOptions = [
  { id: 'bioimpedancia', label: 'Bioimpedancia' },
  { id: 'dobras_cutaneas', label: 'Dobras Cutâneas' },
  { id: 'perimetros', label: 'Perimetros' },
  { id: 'alimentar', label: 'Avaliação Alimentar' },
  { id: 'hidratacao', label: 'Hidratação' },
  { id: 'avaliacao_socioeconomica', label: 'Socioeconômica' }
];
const appointmentTypeOptions = [
  { value: 'primeira_consulta', label: 'Primeira consulta' },
  { value: 'retorno', label: 'Retorno' }
];

const AppointmentModal = ({
  isOpen,
  onClose,
  patient,
  appointment,
  isReschedule = false,
  lockEvaluations = false,
  onSuccess = null
}) => {
  const { user } = useAuth();
  const { criarAgendamento, updateAgendamento, remarcarAgendamento } = usePacientes();
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [appointmentType, setAppointmentType] = useState('');
  const [selectedEvaluations, setSelectedEvaluations] = useState([]);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const modalRef = useRef(null);

  useModalBodyLock(isOpen);
  useModalFocusTrap(isOpen, modalRef);

  const timeSlots = useMemo(() => {
    const slots = [];
    for (let hour = 7; hour <= 20; hour += 1) {
      const label = `${String(hour).padStart(2, '0')}:00`;
      slots.push(label);
    }
    return slots;
  }, []);

  const minDate = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    if (appointment) {
      setDate(appointment.date || '');
      setTime(appointment.time || '');
      setAppointmentType(appointment.appointmentType || '');
      setSelectedEvaluations(appointment.evaluations || []);
    } else {
      setDate('');
      setTime('');
      setAppointmentType('');
      setSelectedEvaluations([]);
    }
    setError('');
  }, [appointment, isOpen]);

  const handleToggleEvaluation = (id) => {
    setSelectedEvaluations((prev) => (
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    ));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!date || !time || !appointmentType) {
      setError('Selecione data, horário e tipo da consulta.');
      return;
    }
    const selectedEvaluationsSafe = lockEvaluations
      ? (appointment?.evaluations || [])
      : selectedEvaluations;

    if (selectedEvaluationsSafe.length === 0) {
      setError('Selecione ao menos uma avaliação.');
      return;
    }

    const scheduledAt = new Date(`${date}T${time}:00`);
    if (Number.isNaN(scheduledAt.getTime())) {
      setError('Data ou horário inválido.');
      return;
    }
    if ((!appointment?.id || isReschedule) && scheduledAt.getTime() < Date.now()) {
      setError('Não é permitido agendar consulta em horário passado.');
      return;
    }
    if (isReschedule && appointment?.date === date && appointment?.time === time) {
      setError('Novo horário deve ser diferente da consulta original.');
      return;
    }
    const scheduledAtIso = scheduledAt.toISOString();

    setIsSaving(true);
    try {
      if (appointment?.id && isReschedule) {
        await remarcarAgendamento(appointment.id, {
          date,
          time,
          appointmentType,
          evaluations: selectedEvaluationsSafe
        });
      } else if (appointment?.id) {
        await updateAgendamento(appointment.id, {
          date,
          time,
          appointmentType,
          scheduledAt: scheduledAtIso,
          evaluations: selectedEvaluationsSafe,
          pacienteId: appointment.pacienteId || patient?.id || null,
          pacienteNome: appointment.pacienteNome || patient?.nome || 'Paciente'
        });
      } else {
        await criarAgendamento({
          pacienteId: patient?.id || null,
          pacienteNome: patient?.nome || 'Paciente',
          alunoId: user?.uid || null,
          alunoNome: user?.name || user?.nome || user?.email || 'Aluno',
          date,
          time,
          appointmentType,
          scheduledAt: scheduledAtIso,
          evaluations: selectedEvaluationsSafe,
          status: 'agendada'
        });
      }
      if (typeof onSuccess === 'function') {
        await onSuccess();
      }
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Não foi possível salvar o agendamento.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleRequestClose = useCallback(() => {
    if (isSaving) return;
    onClose?.();
  }, [isSaving, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleRequestClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, handleRequestClose]);

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  const modalContent = (
    <div
      className="appointment-overlay app-modal-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          handleRequestClose();
        }
      }}
    >
      <div
        className="appointment-modal app-modal-shell app-modal-shell--lg"
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="appointment-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="appointment-header app-modal-header">
          <div className="title">
            <div className="icon app-modal-header-icon">
              <CalendarClock size={20} />
            </div>
            <div className="app-modal-heading">
              <h2 id="appointment-modal-title" className="app-modal-title">
                {isReschedule ? 'Remarcar consulta' : (appointment ? 'Editar consulta' : 'Marcar consulta')}
              </h2>
              <p className="app-modal-subtitle">{patient?.nome || 'Paciente'}</p>
            </div>
          </div>
          <button className="app-modal-close" onClick={handleRequestClose} type="button" aria-label="Fechar">
            <X size={18} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="appointment-form app-modal-body">
          <div className="form-grid">
            <div className="field">
              <label htmlFor="appointment-date">Data</label>
              <input
                id="appointment-date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                min={minDate}
              />
            </div>
            <div className="field">
              <label htmlFor="appointment-time">Horário</label>
              <select
                id="appointment-time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
              >
                <option value="">Selecione</option>
                {timeSlots.map((slot) => (
                  <option key={slot} value={slot}>
                    {slot}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="appointment-type">Tipo de consulta</label>
              <select
                id="appointment-type"
                value={appointmentType}
                onChange={(event) => setAppointmentType(event.target.value)}
              >
                <option value="">Selecione</option>
                {appointmentTypeOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="evaluations-section">
            <div className="section-title">
              <CheckSquare size={16} />
              <span>Selecione as avaliações</span>
            </div>
            <div className="evaluations-grid">
              {evaluationOptions.map((item) => (
                <label key={item.id} className="evaluation-chip">
                  <input
                    type="checkbox"
                    checked={selectedEvaluations.includes(item.id)}
                    onChange={() => handleToggleEvaluation(item.id)}
                    disabled={lockEvaluations}
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
          </div>

          {error && <div className="form-error">{error}</div>}

          <div className="actions app-modal-footer">
            <div className="app-modal-actions">
              <button
                type="button"
                className="app-modal-btn app-modal-btn--secondary"
                onClick={handleRequestClose}
                disabled={isSaving}
              >
                Cancelar
              </button>
              <button type="submit" className="app-modal-btn app-modal-btn--primary" disabled={isSaving}>
                {isSaving ? 'Salvando...' : 'Confirmar agendamento'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default AppointmentModal;


