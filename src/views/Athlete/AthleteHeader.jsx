import React, { useMemo } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import NotificationTaskCenter from '../../components/shared/NotificationTaskCenter';
import '../admin/AdminView/AdminHeader.css';

const AthleteHeader = ({ activeTab, activeIcon, darkMode, onToggleTheme }) => {
  const { user } = useAuth();

  const initials = useMemo(() => {
    const rawName = user?.name || user?.nome || user?.displayName || '';
    const rawEmail = user?.email || '';
    const base = rawName || (rawEmail ? rawEmail.split('@')[0].replace(/[._-]+/g, ' ') : '');
    const parts = base.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'AT';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }, [user]);

  const labels = {
    dashboard: 'Início',
    agenda: 'Agenda',
    prontuario: 'Meu dossiê'
  };
  const currentLabel = labels[activeTab] || activeTab;

  return (
    <header className="admin-header">
      <div className="header-left">
        <div className="header-page-title-row">
          {activeIcon && <span className="icon-wrapper">{activeIcon}</span>}
          <h1 className="header-page-title">{currentLabel}</h1>
        </div>
        <p className="header-page-subtitle">Area do atleta</p>
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

export default AthleteHeader;
