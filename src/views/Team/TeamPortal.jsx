import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, CheckCircle2, ClipboardList, Search, Users } from 'lucide-react';
import api, { getApiErrorMessage } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { usePacientes } from '../../contexts/PacienteContext';
import { useUiFeedback } from '../../contexts/UiFeedbackContext';
import { getEvaluationTypeLabel } from '../../components/shared/evaluationSummaryUtils';
import NotificationTaskCenter from '../../components/shared/NotificationTaskCenter';
import TeamSidebar from './TeamSidebar';
import { FeedbackState, Skeleton } from '../../components/ui';
import '../admin/AdminView/AdminView.css';
import '../admin/AdminView/AdminHeader.css';
import './TeamPortal.css';

const COMPLETED_EVALUATION_STATUSES = new Set(['finalizada', 'concluida', 'concluido']);

const normalizeStatusToken = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/\s+/g, '_');

const isCompletedEvaluationStatus = (status) => COMPLETED_EVALUATION_STATUSES.has(normalizeStatusToken(status));

const STATUS_LABELS = {
  agendada: 'Agendada',
  realizada: 'Realizada',
  remarcada: 'Remarcada',
  falta: 'Falta'
};

const TeamPortal = () => {
  const { user } = useAuth();
  const { formatDate, convertFirebaseDate } = usePacientes();
  const { notify } = useUiFeedback();
  const [activeTab, setActiveTab] = useState('atletas');
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [evaluations, setEvaluations] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (mobile && isSidebarOpen) setSidebarOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isSidebarOpen]);

  useEffect(() => {
    if (!isMobile || !isSidebarOpen) return;
    const handleEscape = (event) => {
      if (event.key === 'Escape') setSidebarOpen(false);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isMobile, isSidebarOpen]);

  useEffect(() => {
    if (!user?.uid) return;
    const loadPatients = async () => {
      setLoadingPatients(true);
      try {
        const { data } = await api.get('/pacientes');
        const all = Array.isArray(data) ? data : [];
        const filtered = all.filter(
          (item) => Array.isArray(item.equipeTecnicaIds) && item.equipeTecnicaIds.includes(user.uid)
        );
        setPatients(filtered);
        setSelectedPatient((current) => {
          if (current && filtered.find((item) => item.id === current.id)) return current;
          return filtered[0] || null;
        });
      } catch (error) {
        setPatients([]);
        setSelectedPatient(null);
        notify({
          type: 'error',
          title: 'Erro ao carregar atletas',
          message: getApiErrorMessage(error, 'Não foi possível carregar os atletas da equipe.')
        });
      } finally {
        setLoadingPatients(false);
      }
    };
    loadPatients();
  }, [user?.uid, notify]);

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
        notify({
          type: 'warning',
          title: 'Dados parciais',
          message: getApiErrorMessage(error, 'Não foi possível carregar os detalhes do atleta.')
        });
      } finally {
        setLoadingDetails(false);
      }
    };

    loadDetails();
  }, [selectedPatient?.id, notify]);

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
      .filter((item) => item.dateObj && item.dateObj >= now && String(item.status || 'agendada').toLowerCase() === 'agendada')
      .sort((a, b) => a.dateObj - b.dateObj)[0];
  }, [appointments, convertFirebaseDate]);

  const pendingEvaluations = useMemo(() => {
    return evaluationsSorted.filter((item) => item.status && !isCompletedEvaluationStatus(item.status));
  }, [evaluationsSorted]);

  const filteredPatients = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return patients;
    return patients.filter(
      (p) => (p.nome || '').toLowerCase().includes(term) ||
             (p.modalidadePrincipal || '').toLowerCase().includes(term)
    );
  }, [patients, searchTerm]);

  const initials = useMemo(() => {
    const rawName = user?.name || user?.nome || user?.displayName || '';
    const rawEmail = user?.email || '';
    const base = rawName || (rawEmail ? rawEmail.split('@')[0].replace(/[._-]+/g, ' ') : '');
    const parts = base.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'ET';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }, [user]);

  const renderContent = () => (
    <div className="team-body">
      <aside className="team-list">
        <div className="team-list-header">
          <div className="team-list-title">
            <Users size={16} />
            <span>Atletas</span>
            {patients.length > 0 && (
              <span className="team-list-count">{patients.length}</span>
            )}
          </div>
          <div className="team-search-box">
            <Search size={14} />
            <input
              type="text"
              placeholder="Buscar atleta..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Buscar atleta"
            />
          </div>
        </div>
        {loadingPatients ? (
          <FeedbackState loading skeletonLines={4} size="sm" />
        ) : filteredPatients.length === 0 ? (
          <FeedbackState
            empty
            size="sm"
            title={patients.length === 0 ? 'Nenhum atleta vinculado.' : 'Nenhum atleta encontrado.'}
          />
        ) : (
          filteredPatients.map((patient) => (
            <button
              key={patient.id}
              type="button"
              className={`team-list-item ${selectedPatient?.id === patient.id ? 'active' : ''}`}
              onClick={() => setSelectedPatient(patient)}
            >
              <div className="team-list-item-avatar">
                {(patient.nome || 'A').charAt(0).toUpperCase()}
              </div>
              <div className="team-list-item-info">
                <strong>{patient.nome || 'Atleta'}</strong>
                <span>{patient.modalidadePrincipal || 'Modalidade não informada'}</span>
              </div>
              <span className={`team-status-dot ${String(patient.status || 'ativo').toLowerCase() === 'ativo' ? 'ok' : 'neutral'}`} />
            </button>
          ))
        )}
      </aside>

      <section className="team-detail">
        {!selectedPatient ? (
          <FeedbackState
            empty
            icon={Users}
            title="Selecione um atleta"
            description="Escolha um atleta na lista para visualizar os dados."
            size="lg"
          />
        ) : (
          <>
            <div className="team-detail-header">
              <div className="team-detail-avatar">
                {(selectedPatient.nome || 'A').charAt(0).toUpperCase()}
              </div>
              <div className="team-detail-identity">
                <h2>{selectedPatient.nome}</h2>
                <p>{selectedPatient.modalidadePrincipal || 'Modalidade não informada'}</p>
                {selectedPatient.projetoNome && (
                  <span className="team-project-badge">{selectedPatient.projetoNome}</span>
                )}
              </div>
              <div className={`team-status-chip ${String(selectedPatient.status || 'ativo').toLowerCase() === 'ativo' ? 'ok' : 'neutral'}`}>
                {selectedPatient.status || 'Ativo'}
              </div>
            </div>

            <div className="team-cards">
              <div className="team-card">
                <div className="team-card-header">
                  <ClipboardList size={16} />
                  <span>Resumo clínico</span>
                </div>
                <p className="team-text">
                  {selectedPatient.observacoes || 'Sem observações registradas.'}
                </p>
                {selectedPatient.historicoSaude && (
                  <p className="team-subtext">{selectedPatient.historicoSaude}</p>
                )}
              </div>

              <div className="team-card">
                <div className="team-card-header">
                  <Calendar size={16} />
                  <span>Próxima consulta</span>
                </div>
                {loadingDetails ? (
                  <Skeleton lines={2} />
                ) : nextAppointment ? (
                  <div className="team-metric">
                    <strong>{formatDate(nextAppointment.dateObj)}</strong>
                    <span>
                      {nextAppointment.time || '--:--'} — {STATUS_LABELS[String(nextAppointment.status || 'agendada').toLowerCase()] || 'Agendada'}
                    </span>
                  </div>
                ) : (
                  <p className="team-text">Sem consultas agendadas.</p>
                )}
              </div>

              <div className="team-card">
                <div className="team-card-header">
                  <ClipboardList size={16} />
                  <span>Pendências</span>
                </div>
                {pendingEvaluations.length === 0 ? (
                  <div className="team-metric-ok">
                    <CheckCircle2 size={16} />
                    <span>Sem pendências</span>
                  </div>
                ) : (
                  <div className="team-metric">
                    <strong>{pendingEvaluations.length}</strong>
                    <span>avaliação(ões) pendente(s)</span>
                  </div>
                )}
              </div>
            </div>

            <div className="team-card full">
              <div className="team-card-header">
                <ClipboardList size={16} />
                <span>Avaliações recentes</span>
                {evaluationsSorted.length > 0 && (
                  <span className="team-eval-count">{evaluationsSorted.length} no total</span>
                )}
              </div>
              {loadingDetails ? (
                <FeedbackState loading skeletonLines={3} />
              ) : evaluationsSorted.length === 0 ? (
                <FeedbackState empty size="sm" title="Nenhuma avaliação registrada." />
              ) : (
                <div className="team-list-evals">
                  {evaluationsSorted.slice(0, 8).map((item) => {
                    const evalDate = convertFirebaseDate(item.createdAt || item.data);
                    const completed = isCompletedEvaluationStatus(item.status);
                    return (
                      <div key={item.id} className="team-eval-item">
                        <div className={`team-eval-dot ${completed ? 'ok' : 'pending'}`} />
                        <div className="team-eval-info">
                          <strong>{getEvaluationTypeLabel(item.tipo) || item.tipo || 'Avaliação'}</strong>
                          <span>{evalDate ? formatDate(evalDate) : '—'}</span>
                        </div>
                        <span className={`team-pill ${completed ? 'ok' : 'pending'}`}>
                          {item.status || 'pendente'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );

  return (
    <motion.div
      className="admin-view team-view"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <div className="admin-bg-pattern"><div className="pattern-grid" /></div>

      <div className="admin-container">
        <TeamSidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isOpen={isSidebarOpen}
          onToggle={() => setSidebarOpen(!isSidebarOpen)}
        />

        {isMobile && isSidebarOpen && (
          <button
            type="button"
            className="sidebar-overlay"
            onClick={() => setSidebarOpen(false)}
            aria-label="Fechar menu"
          />
        )}

        <main className={`admin-main-content ${!isSidebarOpen ? 'expanded' : ''}`}>
          <header className="admin-header">
            <div className="header-left">
              <div className="header-page-title-row">
                <span className="icon-wrapper"><Users size={16} /></span>
                <h1 className="header-page-title">Atletas</h1>
              </div>
              <p className="header-page-subtitle">Area da equipe tecnica</p>
            </div>

            <div className="header-controls">
              <NotificationTaskCenter />

              <div className="user-profile-mini">
                <div className="avatar">{initials}</div>
              </div>
            </div>
          </header>

          <div className="content-area">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="dynamic-content"
              >
                {renderContent()}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </motion.div>
  );
};

export default TeamPortal;
