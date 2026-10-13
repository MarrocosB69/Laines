import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { AvaliacaoImagem } from '../../../components/Avaliacoes/avaliacao-imagem/AvaliacaoImagem';

import StudentSidebar from './StudentSideBar';
import StudentHeader from './StudentHeader';
import StudentDashboard from '../StudentDashboard/StudentDashboard';
import StudentAgenda from '../StudentAgenda/StudentAgenda';
import PatientProntuario from '../Patients/PatientProntuario';
import ResearchProjects from '../../admin/Research/ResearchProjects';
import Ensino from '../../admin/Areas/Ensino';
import Extensao from '../../admin/Areas/Extensao';
import Comunicacao from '../../admin/Areas/Comunicacao';
import { usePacientes } from '../../../contexts/PacienteContext';
import { useAuth } from '../../../contexts/AuthContext';
import { FeedbackState } from '../../../components/ui';
import { getAllowedAdminTabsFromCapabilities } from '../../../constants/adminTabs';
import { ABA_DE_GESTAO_NA_PAGINA_UNICA as ABA_GESTAO, getAbaNaPaginaUnica } from '../../../constants/roles';
import { getAreasDeGestao } from '../../../navigation/sidebarModel';
import {
  getAcademicRootTab,
  getAcademicSectionFromTab,
  getAcademicTabFromSection,
  getAcademicChildren
} from '../../../constants/academicNavigation';
import { useAreaNavegacao } from '../../../hooks/useAreaNavegacao';

import '../../admin/AdminView/AdminView.css';
import './StudentView.css';

// UX-07 / UPD-18: áreas que a Liga publica para todo membro discente, com ou
// sem diretoria (StudentSideBar.jsx, routineItems + ligaMenuItems). Um link
// profundo para qualquer outra string cai no padrão ('dashboard') em
// silêncio — ver useAreaNavegacao.resolveArea.
const LIGA_ROOTS_ALUNO = ['research', 'ensino', 'extensao', 'comunicacao'];
const STUDENT_AREAS = [
  'dashboard', 'patients', 'agenda', 'imagem',
  ...LIGA_ROOTS_ALUNO.flatMap((root) => getAcademicChildren(root).map((child) => child.id))
];

// WI-015: telas de gestão de quem tem dois papéis (aluno presidente ou vice
// com gestão), os mesmos componentes do painel (AdminView.jsx). Sob demanda:
// quem tem um papel só nunca baixa esse código.
const UserManagement = lazy(() => import('../../admin/Registration/UserManagement'));
const PatientManagement = lazy(() => import('../../admin/Registration/PatientManagement'));
const AccessRequests = lazy(() => import('../../admin/Requests/AccessRequests'));
const ReportsPage = lazy(() => import('../../admin/ReportsPage/ReportsPage'));
const SettingsPage = lazy(() => import('../../admin/AdminView/SettingsPage'));
const DashboardStats = lazy(() => import('../../admin/Dashboard/DashboardStats'));
const CARREGANDO_TELA = <FeedbackState loading skeletonLines={4} />;

const StudentView = () => {
  const { user } = useAuth();
  // Ids de gestão que o servidor libera a esta pessoa (vazio com um papel só).
  const areasDeGestao = useMemo(() => getAreasDeGestao(user), [user]);
  const allowedAreas = useMemo(() => [...STUDENT_AREAS, ...areasDeGestao], [areasDeGestao]);
  const { area: view, setArea: setView, searchParams, setParam } = useAreaNavegacao({
    allowedAreas,
    defaultArea: 'dashboard'
  });
  const doisPapeis = areasDeGestao.length > 0;
  // A Pesquisa que a pessoa gere abre como abria no painel (com a
  // sincronização de avaliações), para a página única não perder essa tela.
  const pesquisaComoNoPainel = doisPapeis
    && getAllowedAdminTabsFromCapabilities(user?.capabilities).includes('research');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [agendaState, setAgendaState] = useState(null);
  const [prontuarioReturn, setProntuarioReturn] = useState({ view: 'dashboard' });

  const [avaliacaoImagemPatient, setAvaliacaoImagemPatient] = useState(null);
  const [isSidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 768);
  const [darkMode, setDarkMode] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  const location = useLocation();
  const { getPacienteById } = usePacientes();

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
      if (event.key === 'Escape') {
        setSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isMobile, isSidebarOpen]);

  useEffect(() => {
    const selectedPatientId = location.state?.selectedPatientId;
    if (selectedPatientId) {
      setProntuarioReturn({
        view: String(location.state?.returnView || 'dashboard')
      });
      getPacienteById(selectedPatientId).then((patient) => {
        if (patient) {
          setSelectedPatient(patient);
          setView('patients');
          // Espelha na URL para que F5 logo em seguida não perca o paciente
          // (location.state some ao recarregar; a query string não).
          setParam('paciente', selectedPatientId);
        }
      }).catch(() => {
        // erro ja notificado no contexto
      });
    }
  }, [location.state, getPacienteById, setView, setParam]);

  // UX-07: restaura o paciente aberto a partir de ?paciente=<id> quando a
  // tela monta direto em area=patients (F5, voltar, ou link compartilhado) —
  // sem isso, só o location.state (perdido ao recarregar) trazia o paciente.
  useEffect(() => {
    if (view !== 'patients' || selectedPatient) return;
    const pacienteId = searchParams.get('paciente');
    if (!pacienteId) return;
    getPacienteById(pacienteId).then((patient) => {
      if (patient) setSelectedPatient(patient);
    }).catch(() => {
      // erro ja notificado no contexto
    });
  }, [view, selectedPatient, searchParams, getPacienteById]);

  useEffect(() => {
    if (view !== 'patients' && selectedPatient) {
      setSelectedPatient(null);
      setParam('paciente', null);
    }
  }, [view, selectedPatient, setParam]);

  const handleOpenPatient = async (patient, options = {}) => {
    const sourceView = String(options?.sourceView || view || 'dashboard');
    const context = options?.context || null;
    if (sourceView === 'agenda' && context) {
      setAgendaState((prev) => ({
        ...(prev || {}),
        ...context
      }));
    }
    setProntuarioReturn({ view: sourceView });
    try {
      const fullPatient = patient?.id ? await getPacienteById(patient.id) : null;
      const resolvedPatient = fullPatient || patient;
      setSelectedPatient(resolvedPatient);
      setView('patients');
      if (resolvedPatient?.id) setParam('paciente', resolvedPatient.id);
    } catch {
      // erro ja notificado no contexto
    }
  };

  const handleBackToOrigin = () => {
    setView(prontuarioReturn?.view || 'dashboard');
    setSelectedPatient(null);
    setParam('paciente', null);
  };

  const handleAgendar = (patient) => {
    setAgendaState((prev) => ({
      ...(prev || {}),
      searchTerm: patient?.nome || '',
    }));
    setView('agenda');
  };

  const renderContent = () => {
    const rootView = getAcademicRootTab(view);
    const academicSection = getAcademicSectionFromTab(view);

    if (view === 'dashboard') {
      return (
        <>
          <StudentDashboard
            onSelectPatient={(patient) => handleOpenPatient(patient, { sourceView: 'dashboard' })}
            onAgendar={handleAgendar}
          />
          {/* WI-015: uma Visão geral só — a rotina e, abaixo, a direção. */}
          {doisPapeis && (
            <Suspense fallback={CARREGANDO_TELA}>
              <DashboardStats blocoDeGestao="Direção" onOpenAdminTab={(tab) => setView(getAbaNaPaginaUnica(tab))} />
            </Suspense>
          )}
        </>
      );
    }

    // WI-015: as telas de gestão abrem dentro da página, com as props do
    // painel; o prontuário aberto no Cadastro de atletas volta para ele.
    if (areasDeGestao.includes(view)) {
      const telas = {
        [ABA_GESTAO.users]: <UserManagement />,
        [ABA_GESTAO.patients]: <PatientManagement onOpenPatient={(patient) => handleOpenPatient(patient, { sourceView: view })} />,
        [ABA_GESTAO.requests]: <AccessRequests />,
        [ABA_GESTAO.reports]: <ReportsPage />,
        [ABA_GESTAO.settings]: <SettingsPage />
      };
      return <Suspense fallback={CARREGANDO_TELA}>{telas[view]}</Suspense>;
    }

    if (view === 'patients') {
      return (
        <StudentDashboard
          onSelectPatient={(patient) => handleOpenPatient(patient, { sourceView: 'dashboard' })}
          onAgendar={handleAgendar}
          defaultViewMode="list"
          showTips={false}
        />
      );
    }

    if (view === 'agenda') {
      return (
        <StudentAgenda
          onSelectPatient={(patient, context) => handleOpenPatient(patient, { sourceView: 'agenda', context })}
          initialState={agendaState}
          onStateChange={setAgendaState}
        />
      );
    }

    if (view === 'imagem') {
      return (
        <StudentDashboard
          onSelectPatient={(patient) => setAvaliacaoImagemPatient(patient)}
          imagemMode
        />
      );
    }

    if (rootView === 'research') {
      return (
        <ResearchProjects
          showSync={pesquisaComoNoPainel}
          section={academicSection}
          hideSectionTabs
          onSectionChange={(nextSection) => setView(getAcademicTabFromSection('research', nextSection))}
        />
      );
    }

    if (rootView === 'ensino') {
      return (
        <Ensino
          section={academicSection}
          onSectionChange={(nextSection) => setView(getAcademicTabFromSection('ensino', nextSection))}
        />
      );
    }

    if (rootView === 'extensao') {
      return (
        <Extensao
          section={academicSection}
          onSectionChange={(nextSection) => setView(getAcademicTabFromSection('extensao', nextSection))}
        />
      );
    }

    if (rootView === 'comunicacao') {
      return (
        <Comunicacao
          section={academicSection}
          onSectionChange={(nextSection) => setView(getAcademicTabFromSection('comunicacao', nextSection))}
        />
      );
    }

    return (
      <StudentDashboard
        onSelectPatient={(patient) => handleOpenPatient(patient, { sourceView: view })}
      />
    );
  };

  if (view === 'patients' && selectedPatient) {
    return (
      <PatientProntuario
        patient={selectedPatient}
        onBack={handleBackToOrigin}
        originPath="/aluno"
        originView={prontuarioReturn?.view || 'dashboard'}
        originTab="patients"
      />
    );
  }

  return (
    <motion.div
      className={`admin-view student-view ${darkMode ? 'dark-mode' : 'light-mode'}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <div className="admin-bg-pattern"><div className="pattern-grid"></div></div>

      <div className="admin-container">
        <StudentSidebar
          activeTab={view}
          setActiveTab={setView}
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
          <StudentHeader
            activeTab={view}
            activeIcon={null}
            darkMode={darkMode}
            onToggleTheme={() => setDarkMode(!darkMode)}
          />

          <div className="content-area">
            <AnimatePresence mode="wait">
              <motion.div
                key={view}
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

      <AvaliacaoImagem
        isOpen={!!avaliacaoImagemPatient}
        onClose={() => setAvaliacaoImagemPatient(null)}
        patient={avaliacaoImagemPatient}
      />
    </motion.div>
  );
};

export default StudentView;
