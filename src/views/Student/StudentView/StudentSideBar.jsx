import React from 'react';
import { motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { useUiFeedback } from '../../../contexts/UiFeedbackContext';
import { getApiErrorMessage } from '../../../services/api';
import { normalizeRole } from '../../../constants/roles';
import '../../SidebarShell.css';
import '../../shared/sidebar-tokens.css';
import SidebarHeader from '../../shared/SidebarHeader';
import SidebarFooter from '../../shared/SidebarFooter';
import ProfileSwitcher from '../../shared/ProfileSwitcher';

import {
  LayoutDashboard,
  Users,
  Calendar,
  ChevronRight,
  ChevronLeft,
  GraduationCap,
  ShieldCheck
} from 'lucide-react';

const StudentSidebar = ({ activeTab, setActiveTab, isOpen, onToggle }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const { notify } = useUiFeedback();

  const normalizedRole        = normalizeRole(user?.role);
  const canReturnToPresidency = normalizedRole === 'presidente' || normalizedRole === 'vice';
  const returnAdminTab        = String(location.state?.returnAdminTab || 'dashboard');

  const getInitials = (name = '') => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'AL';
    const first = parts[0][0] || '';
    const last  = parts.length > 1 ? parts[parts.length - 1][0] : (parts[0][1] || '');
    return `${first}${last}`.toUpperCase();
  };

  const displayName  = user?.name || user?.nome || '';
  const userInitials = getInitials(displayName);

  const menuItems = [
    { id: 'dashboard', label: 'Visão Geral',   icon: <LayoutDashboard size={18} strokeWidth={1.8} /> },
    { id: 'patients',  label: 'Meus Atletas',  icon: <Users           size={18} strokeWidth={1.8} /> },
    { id: 'agenda',    label: 'Minha Agenda',  icon: <Calendar        size={18} strokeWidth={1.8} /> }
  ];

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Erro ao sair', error);
      notify({
        type: 'error',
        title: 'Falha ao sair',
        message: getApiErrorMessage(error, 'Não foi possível sair do sistema.')
      });
    }
  };

  const handleBackToPresidency = () => {
    navigate(`/admin?tab=${encodeURIComponent(returnAdminTab)}`);
    if (window.innerWidth <= 768 && isOpen) onToggle();
  };

  const handleSelectTab = (id) => {
    setActiveTab(id);
    if (window.innerWidth <= 768 && isOpen) onToggle();
  };

  return (
    <>
      <motion.aside
        className="laines-sidebar laines-sidebar--admin laines-sidebar--accent-green"
        initial={false}
        animate={{ x: isOpen ? 0 : -260 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        {/* Header */}
        <div className="laines-sidebar__header laines-sidebar--student-header">
          <div className="laines-sidebar--student-header__top">
            <div className="laines-sidebar__brand">
              <SidebarHeader roleLabel="Estudante" />
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
        </div>

        {/* Profile identity block */}
        <div className="sb-identity">
          <div className="sb-identity__icon-box" aria-hidden="true">
            <GraduationCap size={16} strokeWidth={1.8} color="#34d399" />
          </div>
          <div>
            <p className="sb-identity__role">Estudante</p>
            <p className="sb-identity__profile-name">Aluno da Liga</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="laines-sidebar__nav custom-scrollbar" aria-label="Navegação principal">
          <section className="laines-sidebar__section" aria-label="Acadêmico">
            <h3 className="laines-sidebar__section-title">Acadêmico</h3>
            <div className="laines-sidebar__section-items">
              {menuItems.map((item) => {
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

          <div className="laines-sidebar__group-divider" aria-hidden="true" />

          <ProfileSwitcher
            targetProfileLabel="Presidência"
            targetProfileIcon={<ShieldCheck size={13} strokeWidth={2} color="#34d399" />}
            onClick={handleBackToPresidency}
            show={canReturnToPresidency}
          />
        </nav>

        {/* Footer */}
        <SidebarFooter
          displayName={displayName || 'Aluno'}
          userInitials={userInitials}
          onLogout={handleLogout}
        />

        {/* Bottom tag */}
        <p className="sb-bottom-tag">LAINES · Área do aluno</p>
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

export default StudentSidebar;
