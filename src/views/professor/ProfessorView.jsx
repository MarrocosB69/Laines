import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import {
  BookOpen, CalendarDays, FileText, FlaskConical, Inbox, LayoutDashboard, Megaphone, Settings,
  Stethoscope, UserCog, Users, Users2
} from 'lucide-react';

import ProfessorSidebar from './ProfessorSidebar';
import ProfessorHeader from './ProfessorHeader';
import ProfessorDashboard from './ProfessorDashboard';
import ProfessorAgenda from './ProfessorAgenda';
import PatientProntuario from '../Student/Patients/PatientProntuario';
import { usePacientes } from '../../contexts/PacienteContext';
import { useAuth } from '../../contexts/AuthContext';
import ResearchProjects from '../admin/Research/ResearchProjects';
import Ensino from '../admin/Areas/Ensino';
import Extensao from '../admin/Areas/Extensao';
import Comunicacao from '../admin/Areas/Comunicacao';
import {
  getAcademicRootTab,
  getAcademicSectionFromTab,
  getAcademicTabFromSection,
  getAcademicChildren
} from '../../constants/academicNavigation';
import { useAreaNavegacao } from '../../hooks/useAreaNavegacao';
import { getAllowedAdminTabsFromCapabilities } from '../../constants/adminTabs';
import { ABA_DE_GESTAO_NA_PAGINA_UNICA as ABA_GESTAO, getAbaNaPaginaUnica } from '../../constants/roles';
import { ROTULOS_DE_GESTAO, getAreasDeGestao } from '../../navigation/sidebarModel';
import { FeedbackState } from '../../components/ui';

import '../admin/AdminView/AdminView.css';
import './ProfessorView.css';

// UX-07 / UPD-18: mesmas áreas que ProfessorSidebar.jsx (MENU_GROUPS) expõe.
// "comunicacao" incluída em 26/09/2026 (decisão 2,
// docs/implementacao/sidebars-v2/change-intent.md): o servidor já autoriza
// as quatro áreas da liga para todo não atleta (capabilities.liga.areas,
// server/src/auth/authorization.ts) — a exclusão anterior era só do
// cliente. Comunicacao.jsx decide sozinho, por capabilities.liga.gerencia,
// se o professor edita ou só lê; aqui ele entra exatamente como o aluno.
const LIGA_ROOTS_PROFESSOR = ['research', 'ensino', 'extensao', 'comunicacao'];
const PROFESSOR_AREAS = [
  'dashboard', 'patients', 'agenda',
  ...LIGA_ROOTS_PROFESSOR.flatMap((root) => getAcademicChildren(root).map((child) => child.id))
];

// WI-015: telas de gestão de quem tem dois papéis (professor com o painel),
// os mesmos componentes do painel (AdminView.jsx). Sob demanda: quem tem um
// papel só nunca baixa esse código.
const UserManagement = lazy(() => import('../admin/Registration/UserManagement'));
const PatientManagement = lazy(() => import('../admin/Registration/PatientManagement'));
const AccessRequests = lazy(() => import('../admin/Requests/AccessRequests'));
const ReportsPage = lazy(() => import('../admin/ReportsPage/ReportsPage'));
const SettingsPage = lazy(() => import('../admin/AdminView/SettingsPage'));
const DashboardStats = lazy(() => import('../admin/Dashboard/DashboardStats'));
const CARREGANDO_TELA = <FeedbackState loading skeletonLines={4} />;
// Ícones do cabeçalho, os mesmos do painel (tabIcons de AdminView.jsx).
const ICONES_GESTAO = {
  [ABA_GESTAO.users]: <UserCog size={16} />,
  [ABA_GESTAO.patients]: <Stethoscope size={16} />,
  [ABA_GESTAO.requests]: <Inbox size={16} />,
  [ABA_GESTAO.reports]: <FileText size={16} />,
  [ABA_GESTAO.settings]: <Settings size={16} />
};

const ProfessorView = () => {
  const { user } = useAuth();
  // Ids de gestão que o servidor libera a esta pessoa (vazio com um papel só).
  const areasDeGestao = useMemo(() => getAreasDeGestao(user), [user]);
  const allowedAreas = useMemo(() => [...PROFESSOR_AREAS, ...areasDeGestao], [areasDeGestao]);
  const { area: view, setArea: setView, searchParams, setParam } = useAreaNavegacao({
    allowedAreas,
    defaultArea: 'dashboard'
  });
  const doisPapeis = areasDeGestao.length > 0;
  // A Pesquisa que a pessoa gere abre como abria no painel (todos os
  // projetos, sem o modo leitura), para a página única não perder essa tela.
  const pesquisaComoNoPainel = doisPapeis
    && getAllowedAdminTabsFromCapabilities(user?.capabilities).includes('research');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [agendaState, setAgendaState] = useState(null);
  const [prontuarioReturn, setProntuarioReturn] = useState({ view: 'dashboard' });
  const [isSidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 768);
  const [darkMode, setDarkMode] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const { getPacienteById } = usePacientes();
  const location = useLocation();

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
    if (!selectedPatientId) return;
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
  }, [location.state, getPacienteById, setView, setParam]);

  // UX-07: restaura o paciente aberto a partir de ?paciente=<id> quando a
  // tela monta direto em area=patients (F5, voltar, ou link compartilhado).
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

  const handleBack = () => {
    setSelectedPatient(null);
    setParam('paciente', null);
    setView(prontuarioReturn?.view || 'dashboard');
  };

  useEffect(() => {
    if (view !== 'patients' && selectedPatient) {
      setSelectedPatient(null);
      setParam('paciente', null);
    }
  }, [view, selectedPatient, setParam]);

  const renderContent = () => {
    const rootView = getAcademicRootTab(view);
    const academicSection = getAcademicSectionFromTab(view);

    if (rootView === 'research' && pesquisaComoNoPainel) {
      return (
        <ResearchProjects
          section={academicSection}
          hideSectionTabs
          onSectionChange={(nextSection) => setView(getAcademicTabFromSection('research', nextSection))}
        />
      );
    }

    if (rootView === 'research') {
      const allowedProjectIds = user?.projetoId ? [user.projetoId] : null;
      return (
        <ResearchProjects
          allowedProjectIds={allowedProjectIds}
          allowedCoordinatorId={user?.uid || null}
          showSync={false}
          section={academicSection}
          hideSectionTabs
          onSectionChange={(nextSection) => setView(getAcademicTabFromSection('research', nextSection))}
          readOnly
        />
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

    if (view === 'agenda') {
      return (
        <ProfessorAgenda
          onSelectPatient={(patient, context) => handleOpenPatient(patient, { sourceView: 'agenda', context })}
          initialState={agendaState}
          onStateChange={setAgendaState}
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

    const painelDaSupervisao = (
      <ProfessorDashboard
        activeTab={view}
        onSelectPatient={(patient) => handleOpenPatient(patient, { sourceView: view })}
      />
    );
    if (view !== 'dashboard' || !doisPapeis) return painelDaSupervisao;
    // WI-015: uma Visão geral só — a supervisão e, abaixo, a gestão.
    return (
      <>
        {painelDaSupervisao}
        <Suspense fallback={CARREGANDO_TELA}>
          <DashboardStats blocoDeGestao="Gestão" onOpenAdminTab={(tab) => setView(getAbaNaPaginaUnica(tab))} />
        </Suspense>
      </>
    );
  };

  if (view === 'patients' && selectedPatient) {
    return (
      <PatientProntuario
        patient={selectedPatient}
        onBack={handleBack}
        originPath="/professor"
        originView={prontuarioReturn?.view || 'dashboard'}
        originTab="patients"
      />
    );
  }

  return (
    <motion.div
      className={`admin-view professor-view ${darkMode ? 'dark-mode' : 'light-mode'}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <div className="admin-bg-pattern"><div className="pattern-grid"></div></div>

      <div className="admin-container">
        <ProfessorSidebar
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
          <ProfessorHeader
            // O cabeçalho mostra o próprio activeTab quando não conhece o id;
            // para as telas de gestão (WI-015), passa o rótulo da barra.
            activeTab={ROTULOS_DE_GESTAO[view] || view}
            activeIcon={
              ICONES_GESTAO[view] ? ICONES_GESTAO[view]
              : view === 'dashboard' ? <LayoutDashboard size={16} />
              : view === 'patients' ? <Users size={16} />
              : view === 'agenda' ? <CalendarDays size={16} />
              : getAcademicRootTab(view) === 'research' ? <FlaskConical size={16} />
              : getAcademicRootTab(view) === 'ensino' ? <BookOpen size={16} />
              : getAcademicRootTab(view) === 'extensao' ? <Users2 size={16} />
              : getAcademicRootTab(view) === 'comunicacao' ? <Megaphone size={16} />
              : null
            }
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
    </motion.div>
  );
};

export default ProfessorView;
