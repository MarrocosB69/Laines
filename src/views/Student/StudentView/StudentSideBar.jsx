import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { useUiFeedback } from '../../../contexts/UiFeedbackContext';
import { getApiErrorMessage } from '../../../services/api';
import logoLaines from '../../../assets/LogoLaines.png';
import '../../SidebarShell.css';

import {
  LayoutDashboard,
  Users,
  Calendar,
  LogOut,
  ChevronLeft,
  ChevronRight,
  GraduationCap
} from 'lucide-react';

const StudentSidebar = ({ activeTab, setActiveTab, isOpen, onToggle }) => {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const { notify } = useUiFeedback();

  const getInitials = (name = '') => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'AL';
    const first = parts[0][0] || '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] : (parts[0][1] || '');
    return `${first}${last}`.toUpperCase();
  };

  const displayName = user?.name || user?.nome || '';
  const userInitials = getInitials(displayName);

  const menuItems = [
    {
      id: 'dashboard',
      label: 'Visão Geral',
      icon: <LayoutDashboard size={20} />
    },
    {
      id: 'patients',
      label: 'Meus Pacientes',
      icon: <Users size={20} />
    },
    {
      id: 'agenda',
      label: 'Minha Agenda',
      icon: <Calendar size={20} />
    }
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

  return (
    <>
      <motion.aside
        className="laines-sidebar"
        initial={false}
        animate={{ x: isOpen ? 0 : -280 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        <div className="laines-sidebar__header">
          <div className="laines-sidebar__brand">
            <img src={logoLaines} alt="Logo" className="laines-sidebar__logo" />
            <div>
              <h1 className="laines-sidebar__title">LAINES</h1>
              <p className="laines-sidebar__subtitle">Liga acadêmica interprofissional</p>
            </div>
          </div>
          <button onClick={onToggle} className="laines-sidebar__collapse md:hidden">
            <ChevronLeft size={20} />
          </button>
        </div>

        <div className="laines-sidebar__role-card">
          <div className="laines-sidebar__role-icon">
            <GraduationCap size={20} />
          </div>
          <div>
            <h4 className="laines-sidebar__role-title">Estudante</h4>
            <p className="laines-sidebar__role-subtitle">Membro da Liga</p>
          </div>
        </div>

        <nav className="laines-sidebar__nav custom-scrollbar">
          <div>
            <h3 className="laines-sidebar__section-title">Acadêmico</h3>
            <div className="space-y-0.5">
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    if (window.innerWidth <= 768 && isOpen) onToggle();
                  }}
                  className={`laines-sidebar__item ${activeTab === item.id ? 'laines-sidebar__item--active' : ''}`}
                >
                  <div className="laines-sidebar__item-icon">
                    {item.icon}
                  </div>
                  <span>{item.label}</span>
                  {activeTab === item.id && (
                    <div className="laines-sidebar__item-indicator" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </nav>

        <div className="laines-sidebar__footer">
          <div className="laines-sidebar__user-card">
            <div className="laines-sidebar__user-info">
              <div className="laines-sidebar__avatar">
                {userInitials}
              </div>
              <div>
                <p className="laines-sidebar__user-name">{displayName || 'Aluno'}</p>
                <p className="laines-sidebar__user-status">Online</p>
              </div>
            </div>
            <button onClick={handleLogout} className="laines-sidebar__logout" title="Sair">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </motion.aside>

      {!isOpen && (
        <button onClick={onToggle} className="laines-sidebar__toggle">
          <ChevronRight size={20} />
        </button>
      )}
    </>
  );
};

export default StudentSidebar;
