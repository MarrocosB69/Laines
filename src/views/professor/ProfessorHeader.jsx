import React, { useMemo } from 'react';
import { Bell, Sun, Moon, ChevronRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

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
    patients: 'Alunos e Pacientes',
    agenda: 'Agenda',
    research: 'Pesquisas'
  };
  const currentLabel = labels[activeTab] || activeTab;

  return (
    <header className="admin-header">
      <div className="header-left">
        <div className="breadcrumb">
          <div className="breadcrumb-item">
            <span className="breadcrumb-text mute">ÁREA DO PROFESSOR</span>
          </div>
          <ChevronRight size={14} className="breadcrumb-separator" />
          <div className="breadcrumb-item active">
            {activeIcon && <span className="icon-wrapper">{activeIcon}</span>}
            <span className="breadcrumb-text capitalize">{currentLabel}</span>
          </div>
        </div>
      </div>

      <div className="header-controls">
        <button
          onClick={onToggleTheme}
          className="header-btn theme-toggle"
          aria-label="Alternar tema"
        >
          {darkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        <button className="header-btn notifications-btn" aria-label="Notificações">
          <Bell size={20} />
        </button>

        <div className="user-profile-mini">
          <div className="avatar">{initials}</div>
        </div>
      </div>
    </header>
  );
};

export default ProfessorHeader;
