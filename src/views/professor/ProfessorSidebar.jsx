import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useUiFeedback } from '../../contexts/UiFeedbackContext';
import { getApiErrorMessage } from '../../services/api';
import '../SidebarShell.css';
import '../shared/sidebar-tokens.css';
import SidebarHeader from '../shared/SidebarHeader';
import SidebarFooter from '../shared/SidebarFooter';

import {
  LayoutDashboard,
  Users,
  CalendarDays,
  FlaskConical,
  GraduationCap,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

const navIcon = (Icon) => <Icon size={18} strokeWidth={1.8} />;

const MENU_ITEMS = [
  { id: 'dashboard', label: 'Visão Geral',        icon: navIcon(LayoutDashboard) },
  { id: 'patients',  label: 'Alunos e Atletas',   icon: navIcon(Users) },
  { id: 'agenda',    label: 'Agenda',              icon: navIcon(CalendarDays) },
  { id: 'research',  label: 'Projetos vinculados', icon: navIcon(FlaskConical) }
];

const ProfessorSidebar = ({ activeTab, setActiveTab, isOpen, onToggle }) => {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const { notify } = useUiFeedback();

  const getInitials = (name = '') => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'PR';
    const first = parts[0][0] || '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] : (parts[0][1] || '');
    return `${first}${last}`.toUpperCase();
  };

  const displayName  = user?.name || user?.nome || '';
  const userInitials = getInitials(displayName);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      notify({
        type: 'error',
        title: 'Falha ao sair',
        message: getApiErrorMessage(error, 'Não foi possível sair do sistema.')
      });
    }
  };

  const handleSelectTab = (id) => {
    setActiveTab(id);
    if (window.innerWidth <= 768 && isOpen) onToggle();
  };

  return (
    <>
      <motion.aside
        className="laines-sidebar laines-sidebar--admin"
        initial={false}
        animate={{ x: isOpen ? 0 : -260 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        <div className="laines-sidebar__header">
          <div className="laines-sidebar__brand">
            <SidebarHeader roleLabel="Professor" />
          </div>
          <button
            type="button"
            onClick={onToggle}
            className="laines-sidebar__collapse"
            aria-label="Fechar menu"
          >
            <ChevronLeft size={18} strokeWidth={1.8} />
          </button>
        </div>

        <div className="sb-identity">
          <div className="sb-identity__icon-box" aria-hidden="true">
            <GraduationCap size={16} strokeWidth={1.8} color="#60a5fa" />
          </div>
          <div>
            <p className="sb-identity__role">Professor</p>
            <p className="sb-identity__profile-name">Supervisão ativa</p>
          </div>
        </div>

        <nav className="laines-sidebar__nav custom-scrollbar" aria-label="Navegação principal">
          <section className="laines-sidebar__section" aria-label="Acadêmico">
            <h3 className="laines-sidebar__section-title">Acadêmico</h3>
            <div className="laines-sidebar__section-items">
              {MENU_ITEMS.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectTab(item.id)}
                    className={`laines-sidebar__item ${isActive ? 'laines-sidebar__item--active' : ''}`}
                    aria-label={item.label}
                    title={item.label}
                  >
                    <div className="laines-sidebar__item-icon" aria-hidden="true">
                      {item.icon}
                    </div>
                    <span className="laines-sidebar__item-label">{item.label}</span>
                    {isActive && (
                      <div className="laines-sidebar__item-indicator" aria-hidden="true" />
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        </nav>

        <SidebarFooter
          displayName={displayName || 'Professor'}
          userInitials={userInitials}
          onLogout={handleLogout}
        />

        <p className="sb-bottom-tag">LAINES · Área do professor</p>
      </motion.aside>

      {!isOpen && (
        <button
          type="button"
          onClick={onToggle}
          className="laines-sidebar__toggle"
          aria-label="Abrir menu"
        >
          <ChevronRight size={20} strokeWidth={1.8} />
        </button>
      )}
    </>
  );
};

export default ProfessorSidebar;
