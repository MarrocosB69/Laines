import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen,
  Activity, Calendar, ClipboardList,
  Dumbbell, FlaskConical, Heart, LayoutDashboard, Megaphone, Search, Users, Users2
} from 'lucide-react';
import api, { getApiErrorMessage } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { usePacientes } from '../../contexts/PacienteContext';
import { useUiFeedback } from '../../contexts/UiFeedbackContext';
import { getEvaluationTypeLabel } from '../../components/shared/evaluationSummaryUtils';
import NotificationTaskCenter from '../../components/shared/NotificationTaskCenter';
import TeamSidebar from './TeamSidebar';
import TeamVisaoGeral from './TeamVisaoGeral';
import { FeedbackState } from '../../components/ui';
import ResearchProjects from '../admin/Research/ResearchProjects';
import Ensino from '../admin/Areas/Ensino';
import Extensao from '../admin/Areas/Extensao';
import Comunicacao from '../admin/Areas/Comunicacao';
import {
  getAcademicRootTab,
  getAcademicSectionFromTab,
  getAcademicTabFromSection,
  getAcademicTabLabel,
  getAcademicChildren
} from '../../constants/academicNavigation';
import { useAreaNavegacao } from '../../hooks/useAreaNavegacao';
import '../admin/AdminView/AdminView.css';
import '../admin/AdminView/AdminHeader.css';
import './TeamPortal.css';

const COMPLETED_EVALUATION_STATUSES = new Set(['finalizada', 'concluida', 'concluido']);

const normalizeStatusToken = (value) => String(value || '')
  .trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '_');

const isCompletedEvaluationStatus = (status) =>
  COMPLETED_EVALUATION_STATUSES.has(normalizeStatusToken(status));

const INTENSIDADE_LABELS = {
  leve: 'Leve', moderada: 'Moderada', intensa: 'Intensa', maxima: 'Máxima', nao_informado: 'Não informado'
};
const TIPO_TREINO_LABELS = {
  aerobico: 'Aeróbico', resistencia: 'Resistência', misto: 'Misto', funcional: 'Funcional', nao_informado: 'Não informado'
};
const OBJETIVO_LABELS = {
  performance: 'Performance', saude: 'Saúde', estetica: 'Estética', reabilitacao: 'Reabilitação', nao_informado: 'Não informado'
};

// UX-07 / UPD-18: mesmas áreas que TeamSidebar.jsx (MENU_GROUPS) expõe.
// "comunicacao" incluída em 26/09/2026 (decisão 2,
// docs/implementacao/sidebars-v2/change-intent.md): o servidor já autoriza
// as quatro áreas da liga para todo não atleta (capabilities.liga.areas,
// server/src/auth/authorization.ts) — a exclusão anterior era só do
// cliente. Comunicacao.jsx decide sozinho, por capabilities.liga.gerencia,
// se a equipe técnica edita ou só lê; aqui ela entra exatamente como o
// aluno.
const LIGA_ROOTS_EQUIPE = ['research', 'ensino', 'extensao', 'comunicacao'];
// "dashboard" (Visão geral) é a aba inicial desde 26/09/2026 — decisão 2 de
// docs/implementacao/visao-geral-v2/change-intent.md.
const TEAM_AREAS = [
  'dashboard',
  'atletas',
  ...LIGA_ROOTS_EQUIPE.flatMap((root) => getAcademicChildren(root).map((child) => child.id))
];

const TEAM_TAB_META = {
  dashboard: { title: 'Visão Geral', icon: LayoutDashboard },
  atletas: { title: 'Meus Atletas', icon: Users },
  research: { title: 'Pesquisa', icon: FlaskConical },
  research_repository: { title: 'Repositório', icon: FlaskConical },
  research_projects: { title: 'Projetos', icon: FlaskConical },
  research_ideas: { title: 'Ideias', icon: FlaskConical },
  ensino: { title: 'Ensino', icon: BookOpen },
  ensino_reunioes: { title: 'Reuniões e rodas', icon: BookOpen },
  ensino_materiais: { title: 'Materiais', icon: BookOpen },
  extensao: { title: 'Extensão', icon: Users2 },
  extensao_triagens: { title: 'Triagens', icon: Users2 },
  extensao_capacitacoes: { title: 'Capacitações', icon: Users2 },
  extensao_materiais: { title: 'Materiais', icon: Users2 },
  comunicacao: { title: 'Comunicação', icon: Megaphone },
  comunicacao_comunicados: { title: 'Comunicados', icon: Megaphone },
  comunicacao_materiais: { title: 'Materiais', icon: Megaphone }
};

const TeamPortal = () => {
  const { user } = useAuth();
  const { formatDate, convertFirebaseDate } = usePacientes();
  const { notify } = useUiFeedback();
  const { area: activeTab, setArea: setActiveTab, searchParams, setParam } = useAreaNavegacao({
    allowedAreas: TEAM_AREAS,
    defaultArea: 'dashboard'
  });
  // Captura o ?paciente= inicial uma única vez (no primeiro render) — usado só
  // para restaurar a seleção após F5; não deve reagir a mudanças posteriores
  // da URL (evita competir com o clique na lista, que já chama setParam).
  const pacienteInicialRef = useRef(searchParams.get('paciente'));
  const [isSidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 768);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [evaluations, setEvaluations] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loadingPatients, setLoadingPatients] = useState(true);
  // Visão geral: distingue erro de "nenhum atleta" e permite repetir a MESMA
  // chamada a /pacientes (o contador só reexecuta o efeito abaixo).
  const [patientsError, setPatientsError] = useState(null);
  const [patientsReload, setPatientsReload] = useState(0);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const isMulti = user?.role === 'profissional';

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
    const handleEscape = (event) => { if (event.key === 'Escape') setSidebarOpen(false); };
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
          (item) =>
            (Array.isArray(item.equipeTecnicaIds) && item.equipeTecnicaIds.includes(user.uid)) ||
            (Array.isArray(item.equipeMultiIds) && item.equipeMultiIds.includes(user.uid)) ||
            (Array.isArray(item.equipeProfissional) &&
              item.equipeProfissional.some((m) => String(m?.userId || '') === user.uid))
        );
        setPatients(filtered);
        setPatientsError(null);
        setSelectedPatient((current) => {
          if (current && filtered.find((item) => item.id === current.id)) return current;
          // UX-07: F5 com ?paciente=<id> reabre o mesmo atleta em vez de
          // sempre cair no primeiro da lista.
          const pacienteId = pacienteInicialRef.current;
          const fromUrl = pacienteId ? filtered.find((item) => item.id === pacienteId) : null;
          return fromUrl || filtered[0] || null;
        });
      } catch (error) {
        setPatients([]);
        setSelectedPatient(null);
        setPatientsError(getApiErrorMessage(error, 'Não foi possível carregar os atletas da equipe.'));
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
  }, [user?.uid, notify, patientsReload]);

  useEffect(() => {
    if (!selectedPatient?.id) { setEvaluations([]); setAppointments([]); return; }
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
      .map((item) => ({ ...item, dateObj: convertFirebaseDate(item.scheduledAt || item.date) }))
      .filter((item) => item.dateObj && item.dateObj >= now &&
        String(item.status || 'agendada').toLowerCase() === 'agendada')
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

  const firstName = useMemo(() => {
    const rawName = user?.name || user?.nome || user?.displayName || '';
    const rawEmail = user?.email || '';
    const base = rawName || (rawEmail ? rawEmail.split('@')[0].replace(/[._-]+/g, ' ') : '');
    const first = base.trim().split(/\s+/)[0];
    return first ? `${first.charAt(0).toUpperCase()}${first.slice(1)}` : 'Equipe';
  }, [user]);

  // Da Visão geral para "Meus Atletas" já com o atleta escolhido. A seleção
  // vai pelo estado, como no clique da lista; ?paciente= não é gravado aqui
  // porque setArea e setParam na mesma volta leem a mesma URL e o segundo
  // descartaria o primeiro (useSearchParams do react-router 7).
  const abrirAtletaDaVisaoGeral = (patient) => {
    setSelectedPatient(patient);
    setActiveTab('atletas');
  };

  const hasHealthData = selectedPatient && (
    selectedPatient.comorbidadesPessoais ||
    selectedPatient.comorbidadesFamiliares ||
    selectedPatient.historicoSaude
  );

  const renderAthletesContent = () => (
    <div className="team-body">
      <aside className="team-list">
        <div className="team-list-header">
          <h2 className="team-list-title">
            <Users size={14} aria-hidden="true" />
            <span>Atletas vinculados</span>
            {patients.length > 0 && (
              <span className="team-list-count">{patients.length}</span>
            )}
          </h2>
          <div className="team-search-box">
            <Search size={13} />
            <input
              type="text"
              placeholder="Nome ou modalidade..."
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
            empty size="sm"
            title={patients.length === 0 ? 'Nenhum atleta vinculado.' : 'Nenhum resultado.'}
          />
        ) : (
          filteredPatients.map((patient) => (
            <button
              key={patient.id}
              type="button"
              className={`team-list-item ${selectedPatient?.id === patient.id ? 'active' : ''}`}
              aria-current={selectedPatient?.id === patient.id ? 'true' : undefined}
              onClick={() => { setSelectedPatient(patient); setParam('paciente', patient.id); }}
            >
              <div className="team-list-item-avatar">
                {(patient.nome || 'A').charAt(0).toUpperCase()}
              </div>
              <div className="team-list-item-info">
                <strong>{patient.nome || 'Atleta'}</strong>
                {patient.modalidadePrincipal ? (
                  <span className="team-sport-badge">{patient.modalidadePrincipal}</span>
                ) : (
                  <span>Modalidade não informada</span>
                )}
              </div>
              {/* UX-08: a cor sozinha (verde/cinza) não é a única pista de
                  status — o ponto carrega um rótulo textual para quem usa
                  leitor de tela, igual ao chip do painel de detalhe. */}
              <span
                className={`team-status-dot ${String(patient.status || '').toLowerCase() === 'ativo' ? 'ok' : 'neutral'}`}
                role="img"
                aria-label={`Status: ${patient.status || 'não informado'}`}
              />
            </button>
          ))
        )}
      </aside>

      <section className="team-detail">
        {!selectedPatient ? (
          <FeedbackState
            empty icon={Users}
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
                <div className="team-detail-meta">
                  {selectedPatient.modalidadePrincipal && (
                    <span className="team-meta-chip team-meta-chip--sport">
                      <Dumbbell size={11} /> {selectedPatient.modalidadePrincipal}
                    </span>
                  )}
                  {selectedPatient.tempoPratica && (
                    <span className="team-meta-chip">{selectedPatient.tempoPratica} de prática</span>
                  )}
                  {selectedPatient.projetoNome && (
                    <span className="team-meta-chip team-meta-chip--project">{selectedPatient.projetoNome}</span>
                  )}
                </div>
              </div>
              <div className={`team-status-chip ${String(selectedPatient.status || '').toLowerCase() === 'ativo' ? 'ok' : 'neutral'}`}>
                {selectedPatient.status || 'Ativo'}
              </div>
            </div>

            <div className="team-kpi-strip">
              <div className="team-kpi-item team-kpi--green">
                <span className="team-kpi__value">
                  {loadingDetails ? <span className="team-kpi__skeleton" /> : evaluationsSorted.length}
                </span>
                <span className="team-kpi__label"><ClipboardList size={11} /> avaliações</span>
              </div>
              <div className={`team-kpi-item ${pendingEvaluations.length > 0 ? 'team-kpi--amber' : 'team-kpi--green'}`}>
                <span className="team-kpi__value">
                  {loadingDetails ? <span className="team-kpi__skeleton" /> : pendingEvaluations.length}
                </span>
                <span className="team-kpi__label"><Activity size={11} /> pendentes</span>
              </div>
              <div className="team-kpi-item team-kpi--blue">
                <span className="team-kpi__value team-kpi__value--date">
                  {loadingDetails ? (
                    <span className="team-kpi__skeleton" />
                  ) : nextAppointment ? (
                    formatDate(nextAppointment.dateObj)
                  ) : '—'}
                </span>
                <span className="team-kpi__label"><Calendar size={11} /> próx. consulta</span>
              </div>
            </div>

            <div className="team-cards">
              <div className="team-card team-card--training">
                <div className="team-card-header">
                  <Dumbbell size={15} aria-hidden="true" />
                  <h3 className="team-card-title">Perfil de treino</h3>
                </div>
                <div className="team-training-grid">
                  <div className="team-training-stat">
                    <span className="team-training-stat__label">Frequência</span>
                    <span className="team-training-stat__value">
                      {selectedPatient.frequenciaSemanal ? `${selectedPatient.frequenciaSemanal}×/sem` : '—'}
                    </span>
                  </div>
                  <div className="team-training-stat">
                    <span className="team-training-stat__label">Duração</span>
                    <span className="team-training-stat__value">
                      {selectedPatient.duracaoSessao ? `${selectedPatient.duracaoSessao} min` : '—'}
                    </span>
                  </div>
                  <div className="team-training-stat">
                    <span className="team-training-stat__label">Tipo</span>
                    <span className="team-training-stat__value">
                      {TIPO_TREINO_LABELS[selectedPatient.tipoTreino] || selectedPatient.tipoTreino || '—'}
                    </span>
                  </div>
                  <div className="team-training-stat">
                    <span className="team-training-stat__label">Intensidade</span>
                    <span className="team-training-stat__value">
                      {INTENSIDADE_LABELS[selectedPatient.intensidade] || selectedPatient.intensidade || '—'}
                    </span>
                  </div>
                  <div className="team-training-stat team-training-stat--full">
                    <span className="team-training-stat__label">Objetivo</span>
                    <span className="team-training-stat__value">
                      {OBJETIVO_LABELS[selectedPatient.objetivo] || selectedPatient.objetivo || '—'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="team-card team-card--health">
                <div className="team-card-header">
                  <Heart size={15} aria-hidden="true" />
                  <h3 className="team-card-title">Saúde</h3>
                </div>
                {hasHealthData ? (
                  <div className="team-health-list">
                    {selectedPatient.comorbidadesPessoais && (
                      <div className="team-health-item">
                        <span className="team-health-item__label">Comorbidades pessoais</span>
                        <p className="team-health-item__value">{selectedPatient.comorbidadesPessoais}</p>
                      </div>
                    )}
                    {selectedPatient.comorbidadesFamiliares && (
                      <div className="team-health-item">
                        <span className="team-health-item__label">Histórico familiar</span>
                        <p className="team-health-item__value">{selectedPatient.comorbidadesFamiliares}</p>
                      </div>
                    )}
                    {selectedPatient.historicoSaude && !selectedPatient.comorbidadesPessoais && (
                      <div className="team-health-item">
                        <span className="team-health-item__label">Histórico de saúde</span>
                        <p className="team-health-item__value">{selectedPatient.historicoSaude}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="team-text">Nenhuma informação clínica registrada.</p>
                )}
              </div>
            </div>

            <div className="team-card full">
              <div className="team-card-header">
                <ClipboardList size={15} aria-hidden="true" />
                <h3 className="team-card-title">Avaliações recentes</h3>
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
                        {/* UX-08: mesmo padrão do ponto de status da lista de
                            atletas (linha ~254) — a cor sozinha não carrega o
                            estado. */}
                        <div
                          className={`team-eval-dot ${completed ? 'ok' : 'pending'}`}
                          role="img"
                          aria-label={`Status: ${item.status || 'pendente'}`}
                        />
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

  const renderContent = () => {
    const rootTab = getAcademicRootTab(activeTab);
    const academicSection = getAcademicSectionFromTab(activeTab);

    if (activeTab === 'dashboard') {
      return (
        <TeamVisaoGeral
          nome={firstName}
          papel={isMulti ? 'Profissional de saúde' : 'Equipe Técnica'}
          patients={patients}
          carregando={loadingPatients}
          erro={patientsError}
          onTentarNovamente={() => setPatientsReload((n) => n + 1)}
          onAbrirAtletas={() => setActiveTab('atletas')}
          onSelecionarAtleta={abrirAtletaDaVisaoGeral}
        />
      );
    }

    if (rootTab === 'research') {
      return (
        <ResearchProjects
          showSync={false}
          section={academicSection}
          hideSectionTabs
          onSectionChange={(nextSection) => setActiveTab(getAcademicTabFromSection('research', nextSection))}
          readOnly
        />
      );
    }

    if (rootTab === 'ensino') {
      return (
        <Ensino
          section={academicSection}
          onSectionChange={(nextSection) => setActiveTab(getAcademicTabFromSection('ensino', nextSection))}
        />
      );
    }

    if (rootTab === 'extensao') {
      return (
        <Extensao
          section={academicSection}
          onSectionChange={(nextSection) => setActiveTab(getAcademicTabFromSection('extensao', nextSection))}
        />
      );
    }

    if (rootTab === 'comunicacao') {
      return (
        <Comunicacao
          section={academicSection}
          onSectionChange={(nextSection) => setActiveTab(getAcademicTabFromSection('comunicacao', nextSection))}
        />
      );
    }

    return renderAthletesContent();
  };

  const activeMeta = TEAM_TAB_META[activeTab] || TEAM_TAB_META[getAcademicRootTab(activeTab)] || TEAM_TAB_META.atletas;
  const ActiveIcon = activeMeta.icon;

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
          isMobile={isMobile}
        />

        {isMobile && isSidebarOpen && (
          <button
            type="button"
            className="sidebar-overlay"
            onClick={() => setSidebarOpen(false)}
            aria-label="Fechar menu"
          />
        )}

        <main className={`admin-main-content ${!isSidebarOpen ? (isMobile ? 'expanded' : 'collapsed') : ''}`}>
          <header className="admin-header">
            <div className="header-left">
              <div className="header-page-title-row">
                <span className="icon-wrapper"><ActiveIcon size={16} /></span>
                <h1 className="header-page-title">{getAcademicTabLabel(activeTab) || activeMeta.title}</h1>
                {activeTab === 'atletas' && patients.length > 0 && (
                  <span className="team-header-count">{patients.length}</span>
                )}
              </div>
              <p className="header-page-subtitle">
                {isMulti ? 'Área do profissional de saúde' : 'Área da equipe técnica'}
              </p>
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
