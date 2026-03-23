import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { useUiFeedback } from '../../../contexts/UiFeedbackContext';
import { getApiErrorMessage } from '../../../services/api';
import { getAllowedAdminTabs } from '../../../constants/adminTabs';
import '../../SidebarShell.css';

import logoLaines from '../../../assets/LogoLaines.png';
import {
  LayoutDashboard,
  Users,
  UserCircle,
  FileText,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Shield,
  Inbox,
  FlaskConical,
  BookOpen,
  Users2
} from 'lucide-react';

const Sidebar = ({ activeTab, setActiveTab, isOpen, onToggle, darkMode }) => {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const { notify } = useUiFeedback();

  const getInitials = (name = '') => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'AD';
    const first = parts[0][0] || '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] : (parts[0][1] || '');
    return `${first}${last}`.toUpperCase();
  };

  const displayName = user?.name || user?.nome || '';
  const userInitials = getInitials(displayName);

  const allowedTabs = getAllowedAdminTabs(user?.role);

  const menuItems = [
    {
      id: 'dashboard',
      label: 'Início',
      icon: <LayoutDashboard size={20} />,
      section: 'gestao'
    },
    {
      id: 'users',
      label: 'Membros',
      icon: <Users size={20} />,
      section: 'gestao'
    },
    {
      id: 'patients',
      label: 'Participantes',
      icon: <UserCircle size={20} />,
      section: 'gestao'
    },
    {
      id: 'reports',
      label: 'Relatórios',
      icon: <FileText size={20} />,
      section: 'gestao'
    },
    {
      id: 'requests',
      label: 'Solicitações',
      icon: <Inbox size={20} />,
      section: 'gestao'
    },
    {
      id: 'settings',
      label: 'Configurações',
      icon: <Settings size={20} />,
      section: 'gestao'
    },
    {
      id: 'research',
      label: 'Projetos',
      icon: <FlaskConical size={20} />,
      section: 'areas'
    },
    {
      id: 'ensino',
      label: 'Ensino',
      icon: <BookOpen size={20} />,
      section: 'areas'
    },
    {
      id: 'extensao',
      label: 'Extensão',
      icon: <Users2 size={20} />,
      section: 'areas'
    }
  ];

  const filteredGestao = menuItems.filter((item) => item.section === 'gestao' && allowedTabs.includes(item.id));
  const filteredAreas = menuItems.filter((item) => item.section === 'areas' && allowedTabs.includes(item.id));

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      notify({
        type: 'error',
        title: 'Falha ao sair',
        message: getApiErrorMessage(error, 'Não foi possível sair do sistema.')
      });
    }
  };

  const handleSelectTab = (tabId) => {
    setActiveTab(tabId);
    if (window.innerWidth <= 768 && isOpen) {
      onToggle();
    }
  };

  return (
    <>
      <motion.aside
        className={`laines-sidebar ${darkMode ? 'laines-sidebar--dark' : ''}`}
        initial={false}
        animate={{ x: isOpen ? 0 : -286 }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      >
        <div className="laines-sidebar__header">
          <div className="laines-sidebar__brand">
            <img src={logoLaines} alt="Logo Laines" className="laines-sidebar__logo" />
            <div>
              <h1 className="laines-sidebar__title">LAINES</h1>
              <p className="laines-sidebar__subtitle">Liga acadêmica interprofissional</p>
            </div>
          </div>
          <button onClick={onToggle} className="laines-sidebar__collapse md:hidden" aria-label="Fechar menu">
            <ChevronLeft size={18} />
          </button>
        </div>

        <div className="laines-sidebar__role-card">
          <div className="laines-sidebar__role-icon">
            <Shield size={18} />
          </div>
          <div>
            <h4 className="laines-sidebar__role-title">Perfil</h4>
            <p className="laines-sidebar__role-subtitle">Administração</p>
          </div>
        </div>

        <nav className="laines-sidebar__nav custom-scrollbar">
          <div>
            <h3 className="laines-sidebar__section-title">Gestão</h3>
            <div className="space-y-0.5">
              {filteredGestao.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSelectTab(item.id)}
                  className={`laines-sidebar__item ${activeTab === item.id ? 'laines-sidebar__item--active' : ''}`}
                >
                  <div className="laines-sidebar__item-icon">{item.icon}</div>
                  <span>{item.label}</span>
                  {activeTab === item.id && <div className="laines-sidebar__item-indicator" />}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="laines-sidebar__section-title">Áreas</h3>
            <div className="space-y-0.5">
              {filteredAreas.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSelectTab(item.id)}
                  className={`laines-sidebar__item ${activeTab === item.id ? 'laines-sidebar__item--active' : ''}`}
                >
                  <div className="laines-sidebar__item-icon">{item.icon}</div>
                  <span>{item.label}</span>
                  {activeTab === item.id && <div className="laines-sidebar__item-indicator" />}
                </button>
              ))}
            </div>
          </div>
        </nav>

        <div className="laines-sidebar__footer">
          <div className="laines-sidebar__user-card">
            <div className="laines-sidebar__user-info">
              <div className="laines-sidebar__avatar">{userInitials}</div>
              <div>
                <p className="laines-sidebar__user-name">{displayName || 'Admin'}</p>
                <p className="laines-sidebar__user-status">Sessão ativa</p>
              </div>
            </div>
            <button onClick={handleLogout} className="laines-sidebar__logout" title="Sair" aria-label="Sair">
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </motion.aside>

      {!isOpen && (
        <button
          onClick={onToggle}
          className={`laines-sidebar__toggle ${darkMode ? 'laines-sidebar--dark' : ''}`}
          aria-label="Abrir menu"
        >
          <ChevronRight size={20} />
        </button>
      )}
    </>
  );
};

export default Sidebar;
