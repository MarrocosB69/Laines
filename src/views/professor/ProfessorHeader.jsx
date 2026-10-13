import React, { useMemo } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import NotificationTaskCenter from '../../components/shared/NotificationTaskCenter';
import { getAcademicTabLabel } from '../../constants/academicNavigation';

import '../admin/AdminView/AdminHeader.css';

const ProfessorHeader = ({ activeTab, activeIcon, darkMode, onToggleTheme }) => {
  const { user } = useAuth();

  const initials = useMemo(() => {
    const rawName = user?.name || user?.nome || user?.displayName || '';
    const rawEmail = user?.email || '';
    const base = rawName || (rawEmail ? rawEmail.split('@')[0].replace(/[._-]+/g, ' ') : '');
    const parts = base.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'PR';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }, [user]);

  const labels = {
    dashboard: 'Visão Geral',
    patients: 'Alunos e atletas',
    agenda: 'Agenda',
    research: 'Pesquisa',
    ensino: 'Ensino',
    extensao: 'Extensão'
  };
  const currentLabel = getAcademicTabLabel(activeTab) || labels[activeTab] || activeTab;

  return (
    <header className="admin-header">
      <div className="header-left">
        <div className="header-page-title-row">
          {activeIcon && <span className="icon-wrapper">{activeIcon}</span>}
          <h1 className="header-page-title">{currentLabel}</h1>
        </div>
        <p className="header-page-subtitle">Area do professor</p>
      </div>

      <div className="header-controls">
        <button
          onClick={onToggleTheme}
          className="header-btn theme-toggle"
          aria-label="Alternar tema"
        >
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <NotificationTaskCenter />

        <div className="user-profile-mini">
          <div className="avatar">{initials}</div>
        </div>
      </div>
    </header>
  );
};

export default ProfessorHeader;
