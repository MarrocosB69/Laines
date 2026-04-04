import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';

import ProfessorSidebar from './ProfessorSidebar';
import ProfessorHeader from './ProfessorHeader';
import ProfessorDashboard from './ProfessorDashboard';
import ProfessorAgenda from './ProfessorAgenda';
import PatientProntuario from '../Student/Patients/PatientProntuario';
import { usePacientes } from '../../contexts/PacienteContext';
import { useAuth } from '../../contexts/AuthContext';
import ResearchProjects from '../admin/Research/ResearchProjects';

import '../admin/AdminView/AdminView.css';
import './ProfessorView.css';

const ProfessorView = () => {
  const [view, setView] = useState('dashboard');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [agendaState, setAgendaState] = useState(null);
  const [prontuarioReturn, setProntuarioReturn] = useState({ view: 'dashboard' });
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const { getPacienteById } = usePacientes();
  const { user } = useAuth();
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
      }
    }).catch(() => {
      // erro ja notificado no contexto
    });
  }, [location.state, getPacienteById]);

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
      setSelectedPatient(fullPatient || patient);
      setView('patients');
    } catch {
      // erro ja notificado no contexto
    }
  };

  const handleBack = () => {
    setSelectedPatient(null);
    setView(prontuarioReturn?.view || 'dashboard');
  };

  useEffect(() => {
    if (view !== 'patients' && selectedPatient) {
      setSelectedPatient(null);
    }
  }, [view, selectedPatient]);

  const renderContent = () => {
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

    if (view === 'research') {
      const allowedProjectIds = user?.projetoId ? [user.projetoId] : null;
      return (
        <ResearchProjects
          allowedProjectIds={allowedProjectIds}
          allowedCoordinatorId={user?.uid || null}
          showSync={false}
          readOnly
        />
      );
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

    return (
      <ProfessorDashboard
        activeTab={view}
        onSelectPatient={(patient) => handleOpenPatient(patient, { sourceView: view })}
      />
    );
  };

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
          <ProfessorHeader
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
    </motion.div>
  );
};

export default ProfessorView;
