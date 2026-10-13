import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ClipboardCheck, LayoutDashboard, TrendingUp, UserRound } from 'lucide-react';
import AthleteSidebar from './AthleteSidebar';
import AthleteHeader from './AthleteHeader';
import AthletePortal from './AthletePortal';
import { useAreaNavegacao } from '../../hooks/useAreaNavegacao';
import '../admin/AdminView/AdminView.css';
import './AthleteView.css';

// UX-07 / UPD-18: mesmas abas que AthleteSidebar.jsx (MENU_ITEMS) expõe.
// "dashboard" (Visão geral) é a aba inicial desde 26/09/2026 — decisão 2 de
// docs/implementacao/visao-geral-v2/change-intent.md.
const ATHLETE_AREAS = ['dashboard', 'pendencias', 'cadastro', 'acompanhamento'];

const AthleteView = () => {
  const { area: activeTab, setArea: setActiveTab } = useAreaNavegacao({
    allowedAreas: ATHLETE_AREAS,
    defaultArea: 'dashboard'
  });
  const [isSidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 768);
  const [darkMode, setDarkMode] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [pendingCount, setPendingCount] = useState(0);

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

  const tabIcons = useMemo(() => ({
    dashboard: <LayoutDashboard size={16} />,
    pendencias: <ClipboardCheck size={16} />,
    cadastro: <UserRound size={16} />,
    acompanhamento: <TrendingUp size={16} />
  }), []);

  return (
    <motion.div
      className={`admin-view athlete-view ${darkMode ? 'dark-mode' : 'light-mode'}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <div className="admin-bg-pattern"><div className="pattern-grid" /></div>

      <div className="admin-container">
        <AthleteSidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isOpen={isSidebarOpen}
          onToggle={() => setSidebarOpen(!isSidebarOpen)}
          isMobile={isMobile}
          pendingCount={pendingCount}
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
          <AthleteHeader
            activeTab={activeTab}
            activeIcon={tabIcons[activeTab]}
            darkMode={darkMode}
            onToggleTheme={() => setDarkMode(!darkMode)}
          />

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
                <AthletePortal
                  activeTab={activeTab}
                  hideInternalHeader
                  onPendingCountChange={setPendingCount}
                  onNavigate={setActiveTab}
                />
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </motion.div>
  );
};

export default AthleteView;
