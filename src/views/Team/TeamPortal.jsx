import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, ClipboardList, LogOut, Users } from 'lucide-react';
import api, { getApiErrorMessage } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { usePacientes } from '../../contexts/PacienteContext';
import { useUiFeedback } from '../../contexts/UiFeedbackContext';
import './TeamPortal.css';

const COMPLETED_EVALUATION_STATUSES = new Set(['finalizada', 'concluida', 'concluido']);

const normalizeStatusToken = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, '_');

const isCompletedEvaluationStatus = (status) => COMPLETED_EVALUATION_STATUSES.has(normalizeStatusToken(status));

const TeamPortal = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { notify } = useUiFeedback();
  const { formatDate, convertFirebaseDate } = usePacientes();
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [evaluations, setEvaluations] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;
    const loadPatients = async () => {
      setLoadingPatients(true);
      try {
        const { data } = await api.get('/pacientes');
        const all = Array.isArray(data) ? data : [];
        const filtered = all.filter((item) => Array.isArray(item.equipeTecnicaIds) && item.equipeTecnicaIds.includes(user.uid));
        setPatients(filtered);
        setSelectedPatient((current) => {
          if (current && filtered.find((item) => item.id === current.id)) return current;
          return filtered[0] || null;
        });
      } catch (error) {
        setPatients([]);
        setSelectedPatient(null);
      } finally {
        setLoadingPatients(false);
      }
    };
    loadPatients();
  }, [user?.uid]);

  useEffect(() => {
    if (!selectedPatient?.id) {
      setEvaluations([]);
      setAppointments([]);
      return;
    }

    setLoadingDetails(true);
    const loadDetails = async () => {
      try {
        const [evalRes, appRes] = await Promise.all([
          api.get('/avaliacoes', { params: { pacienteId: selectedPatient.id } }),
          api.get('/agendamentos', { params: { pacienteId: selectedPatient.id } })
        ]);
        setEvaluations(Array.isArray(evalRes.data) ? evalRes.data : []);
        setAppointments(Array.isArray(appRes.data) ? appRes.data : []);
      } catch (error) {
        setEvaluations([]);
        setAppointments([]);
      } finally {
        setLoadingDetails(false);
      }
    };

    loadDetails();
  }, [selectedPatient?.id]);

  const evaluationsSorted = useMemo(() => {
    return [...evaluations].sort((a, b) => {
      const aDate = convertFirebaseDate(a.createdAt || a.data) || 0;
      const bDate = convertFirebaseDate(b.createdAt || b.data) || 0;
      return bDate - aDate;
    });
  }, [evaluations, convertFirebaseDate]);

  const nextAppointment = useMemo(() => {
    const now = new Date();
    return appointments
      .map((item) => ({
        ...item,
        dateObj: convertFirebaseDate(item.scheduledAt || item.date)
      }))
      .filter((item) => item.dateObj && item.dateObj >= now)
      .sort((a, b) => a.dateObj - b.dateObj)[0];
  }, [appointments, convertFirebaseDate]);

  const pendingEvaluations = useMemo(() => {
    return evaluationsSorted.filter((item) => item.status && !isCompletedEvaluationStatus(item.status));
  }, [evaluationsSorted]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      notify({
        type: 'error',
        title: 'Falha ao sair',
        message: getApiErrorMessage(error, 'Não foi possível encerrar sua sessão.')
      });
    }
  };

  return (
    <div className="team-portal laines-page-shell">
      <header className="team-header laines-page-header">
        <div>
          <h1 className="laines-page-title">Equipe técnica</h1>
          <p className="laines-page-subtitle">Acompanhe atletas vinculados e resultados de avaliação.</p>
        </div>
        <div className="team-header-actions">
          <div className="team-badges">
            <span className="team-badge">
              <Users size={14} /> {patients.length} atletas
            </span>
            <span className="team-badge">
              <ClipboardList size={14} /> {evaluationsSorted.length} avaliações
            </span>
          </div>
          <button type="button" className="team-logout-btn" onClick={handleLogout} aria-label="Sair">
            <LogOut size={14} />
            <span>Sair</span>
          </button>
        </div>
      </header>

      <div className="team-body">
        <aside className="team-list">
          <div className="team-list-header">
            <span>Atletas</span>
          </div>
          {loadingPatients ? (
            <div className="team-empty laines-feedback-state">Carregando atletas...</div>
          ) : patients.length === 0 ? (
            <div className="team-empty laines-feedback-state">Nenhum atleta vinculado.</div>
          ) : (
            patients.map((patient) => (
              <button
                key={patient.id}
                type="button"
                className={`team-list-item ${selectedPatient?.id === patient.id ? 'active' : ''}`}
                onClick={() => setSelectedPatient(patient)}
              >
                <strong>{patient.nome || 'Atleta'}</strong>
                <span>{patient.modalidadePrincipal || 'Modalidade'}</span>
              </button>
            ))
          )}
        </aside>

        <section className="team-detail">
          {!selectedPatient ? (
            <div className="team-empty laines-feedback-state">Selecione um atleta para visualizar.</div>
          ) : (
            <>
              <div className="team-detail-header">
                <div>
                  <h2>{selectedPatient.nome}</h2>
                  <p>{selectedPatient.modalidadePrincipal || 'Modalidade não informada'}</p>
                </div>
                <div className="team-status">{selectedPatient.status || 'Ativo'}</div>
              </div>

              <div className="team-cards">
                <div className="team-card">
                  <div className="team-card-header">
                    <ClipboardList size={18} />
                    <span>Resumo clínico</span>
                  </div>
                  <p className="team-text">
                    {selectedPatient.observacoes || 'Sem observações registradas.'}
                  </p>
                  <div className="team-subtext">
                    {selectedPatient.historicoSaude || 'Histórico de saúde não informado.'}
                  </div>
                </div>

                <div className="team-card">
                  <div className="team-card-header">
                    <Calendar size={18} />
                    <span>Próxima consulta</span>
                  </div>
                  {nextAppointment ? (
                    <div className="team-metric">
                      <strong>{formatDate(nextAppointment.dateObj)}</strong>
                      <span>{nextAppointment.time || '--:--'}</span>
                    </div>
                  ) : (
                    <p className="team-text">Sem consultas agendadas.</p>
                  )}
                </div>

                <div className="team-card">
                  <div className="team-card-header">
                    <ClipboardList size={18} />
                    <span>Pendências</span>
                  </div>
                  <div className="team-metric">
                    <strong>{pendingEvaluations.length}</strong>
                    <span>avaliações pendentes</span>
                  </div>
                </div>
              </div>

              <div className="team-card full">
                <div className="team-card-header">
                  <ClipboardList size={18} />
                  <span>Avaliações recentes</span>
                </div>
                {loadingDetails ? (
                  <div className="team-empty laines-feedback-state">Carregando avaliações...</div>
                ) : evaluationsSorted.length === 0 ? (
                  <div className="team-empty laines-feedback-state">Nenhuma avaliação registrada.</div>
                ) : (
                  <div className="team-list-evals">
                    {evaluationsSorted.slice(0, 6).map((item) => (
                      <div key={item.id} className="team-eval-item">
                        <div>
                          <strong>{item.tipo || 'Avaliação'}</strong>
                          <span>{formatDate(convertFirebaseDate(item.createdAt || item.data))}</span>
                        </div>
                        <span className={`team-pill ${isCompletedEvaluationStatus(item.status) ? 'ok' : 'pending'}`}>
                          {item.status || 'pendente'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
};

export default TeamPortal;
