import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart3, FileText, Settings, UserCog, Stethoscope, Inbox, FlaskConical, BookOpen, Users2, Megaphone
} from "lucide-react";
import { useLocation, useSearchParams } from "react-router-dom";

// Importação dos componentes
import Sidebar from "../SideBar/Sidebar";
import AdminHeader from "./AdminHeader"; 
import UserManagement from "../Registration/UserManagement";
import PatientManagement from "../Registration/PatientManagement";
import ReportsPage from "../ReportsPage/ReportsPage";
import DashboardStats from "../Dashboard/DashboardStats";
import SettingsPage from "./SettingsPage";
import AccessRequests from "../Requests/AccessRequests";
import ResearchProjects from "../Research/ResearchProjects";
import Ensino from "../Areas/Ensino";
import Extensao from "../Areas/Extensao";
import Comunicacao from "../Areas/Comunicacao";
import { useAuth } from "../../../contexts/AuthContext";
import { usePacientes } from "../../../contexts/PacienteContext";
import { getAllowedAdminTabsFromCapabilities } from "../../../constants/adminTabs";
import {
  getAcademicRootTab,
  getAcademicSectionFromTab,
  getAcademicTabFromSection
} from "../../../constants/academicNavigation";
import PatientProntuario from "../../Student/Patients/PatientProntuario";

import "./AdminView.css";

const AdminView = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isSidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 768);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const wasMobileRef = useRef(window.innerWidth <= 768);
  const pendingTabRef = useRef(null);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [prontuarioReturnTab, setProntuarioReturnTab] = useState('patients');
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const { user } = useAuth();
  const { getPacienteById } = usePacientes();

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      const wasMobile = wasMobileRef.current;
      setIsMobile(mobile);
      setSidebarOpen((previous) => {
        if (mobile) return false;
        if (wasMobile && !mobile) return true;
        return previous;
      });
      wasMobileRef.current = mobile;
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
    const returnTab = String(location.state?.returnTab || 'patients');
    getPacienteById(selectedPatientId).then((patient) => {
      if (patient) {
        setProntuarioReturnTab(returnTab);
        setSelectedPatient(patient);
        setActiveTab('patients');
      }
    }).catch(() => {
      // Erro ja tratado no contexto com notificacao.
    });
  }, [location.state, getPacienteById]);

  const handleTabChange = useCallback((tab) => {
    pendingTabRef.current = tab;
    setActiveTab(tab);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', tab);
      return next;
    });
  }, [setSearchParams]);
  const toggleSidebar = useCallback(() => setSidebarOpen(prev => !prev), []);

  const handleOpenPatientProntuario = useCallback(async (patient) => {
    const patientId = patient?.id || null;
    if (!patientId) return;

    try {
      const fullPatient = await getPacienteById(patientId);
      setProntuarioReturnTab(activeTab || 'patients');
      setSelectedPatient(fullPatient || patient);
      setActiveTab('patients');
    } catch {
      // Erro ja tratado no contexto com notificacao.
    }
  }, [activeTab, getPacienteById]);

  const handleBackFromProntuario = useCallback(() => {
    setSelectedPatient(null);
    const targetTab = prontuarioReturnTab || 'patients';
    setActiveTab(targetTab);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', targetTab);
      return next;
    });
  }, [prontuarioReturnTab, setSearchParams]);

  const renderActiveComponent = useCallback(() => {
    const rootTab = getAcademicRootTab(activeTab);
    const academicSection = getAcademicSectionFromTab(activeTab);

    const components = {
      dashboard: <DashboardStats onOpenAdminTab={handleTabChange} />,
      users: <UserManagement />,
      patients: <PatientManagement onOpenPatient={handleOpenPatientProntuario} />,
      reports: <ReportsPage />,
      research: (
        <ResearchProjects
          section={academicSection}
          hideSectionTabs
          onSectionChange={(nextSection) => handleTabChange(getAcademicTabFromSection('research', nextSection))}
        />
      ),
      ensino: (
        <Ensino
          section={academicSection}
          onSectionChange={(nextSection) => handleTabChange(getAcademicTabFromSection('ensino', nextSection))}
        />
      ),
      extensao: (
        <Extensao
          section={academicSection}
          onSectionChange={(nextSection) => handleTabChange(getAcademicTabFromSection('extensao', nextSection))}
        />
      ),
      comunicacao: (
        <Comunicacao
          section={academicSection}
          onSectionChange={(nextSection) => handleTabChange(getAcademicTabFromSection('comunicacao', nextSection))}
        />
      ),
      requests: <AccessRequests />,
      settings: <SettingsPage />,
    };
    return components[rootTab] || components.dashboard;
  }, [activeTab, handleOpenPatientProntuario, handleTabChange]);

  const tabIcons = {
    dashboard: <BarChart3 size={16} />,
    users: <UserCog size={16} />,
    patients: <Stethoscope size={16} />,
    reports: <FileText size={16} />,
    research: <FlaskConical size={16} />,
    ensino: <BookOpen size={16} />,
    extensao: <Users2 size={16} />,
    comunicacao: <Megaphone size={16} />,
    requests: <Inbox size={16} />,
    settings: <Settings size={16} />
  };

  const allowedTabs = useMemo(() => {
    return getAllowedAdminTabsFromCapabilities(user?.capabilities);
  }, [user]);

  const isAllowedTab = useCallback((tab) => {
    const rootTab = getAcademicRootTab(tab);
    return allowedTabs.includes(rootTab);
  }, [allowedTabs]);

  useEffect(() => {
    const requestedTab = String(searchParams.get('tab') || '').trim();

    if (pendingTabRef.current) {
      if (requestedTab === pendingTabRef.current) {
        pendingTabRef.current = null;
      } else if (activeTab === pendingTabRef.current) {
        return;
      }
    }

    if (requestedTab && isAllowedTab(requestedTab) && requestedTab !== activeTab) {
      setActiveTab(requestedTab);
      return;
    }

    if (!isAllowedTab(activeTab)) {
      const fallback = allowedTabs[0] || 'dashboard';
      setActiveTab(fallback);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('tab', fallback);
        return next;
      });
    }
  }, [activeTab, allowedTabs, isAllowedTab, searchParams, setSearchParams]);

  useEffect(() => {
    if (activeTab !== 'patients' && selectedPatient) {
      setSelectedPatient(null);
    }
  }, [activeTab, selectedPatient]);

  const mainContentClassName = `admin-main-content ${
    !isSidebarOpen ? (isMobile ? 'expanded' : 'collapsed') : ''
  }`;

  if (activeTab === 'patients' && selectedPatient) {
    return (
      <PatientProntuario
        patient={selectedPatient}
        onBack={handleBackFromProntuario}
        originPath="/admin"
        originView="patients"
        originTab={prontuarioReturnTab || 'patients'}
      />
    );
  }

  return (
    <motion.div
      className="admin-view light-mode"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <div className="admin-bg-pattern">
        <div className="pattern-grid"></div>
      </div>

      <div className="admin-container">
        <Sidebar 
          activeTab={activeTab}
          setActiveTab={handleTabChange}
          isOpen={isSidebarOpen}
          onToggle={toggleSidebar}
          isMobile={isMobile}
        />

        {/* Overlay para Mobile (Melhoria de UX) */}
        {isMobile && isSidebarOpen && (
          <button
            type="button"
            className="sidebar-overlay"
            onClick={toggleSidebar}
            aria-label="Fechar menu"
          />
        )}

        <main className={mainContentClassName}>
          <AdminHeader 
            isSidebarOpen={isSidebarOpen}
            onToggleSidebar={toggleSidebar}
            activeTab={activeTab}
            activeIcon={tabIcons[getAcademicRootTab(activeTab)]}
          />

          <div className="content-area">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="dynamic-content"
              >
                {renderActiveComponent()}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </motion.div>
  );
};

export default AdminView;

