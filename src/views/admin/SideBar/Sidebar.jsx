import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { useUiFeedback } from '../../../contexts/UiFeedbackContext';
import { getApiErrorMessage } from '../../../services/api';
import { getAllowedAdminTabs } from '../../../constants/adminTabs';
import { normalizeRole } from '../../../constants/roles';
import logoLaines from '../../../assets/LogoLaines.png';
import '../../SidebarShell.css';

import {
  LayoutDashboard,
  Users,
  UserCircle,
  FileText,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Inbox,
  FlaskConical,
  BookOpen,
  Users2
} from 'lucide-react';

const ROLE_LABELS = Object.freeze({
  admin: 'Administração',
  coordenacao: 'Coordenação',
  presidente: 'Presidência',
  vice: 'Vice-presidência',
  diretoria_marketing: 'Diretoria de Marketing',
  diretoria_ensino: 'Diretoria de Ensino',
  diretoria_pesquisa: 'Diretoria de Pesquisa',
  diretoria_extensao: 'Diretoria de Extensão',
  coord_atendimento: 'Coordenação de Atendimento'
});

const NAVIGATION_GROUPS = Object.freeze([
  {
    id: 'overview',
    label: 'Visão geral',
    items: [
      {
        id: 'dashboard',
        label: 'Início',
        hint: 'Resumo do painel',
        icon: <LayoutDashboard size={18} />
      }
    ]
  },
  {
    id: 'people',
    label: 'Pessoas',
    items: [
      {
        id: 'users',
        label: 'Membros',
        hint: 'Equipe interna da liga',
        icon: <Users size={18} />
      },
      {
        id: 'patients',
        label: 'Participantes',
        hint: 'Pessoas atendidas e acompanhadas',
        icon: <UserCircle size={18} />
      },
      {
        id: 'requests',
        label: 'Solicitações',
        hint: 'Pedidos e aprovações pendentes',
        icon: <Inbox size={18} />
      }
    ]
  },
  {
    id: 'areas',
    label: 'Áreas',
    items: [
      {
        id: 'research',
        label: 'Projetos',
        hint: 'Pesquisa e iniciativas ativas',
        icon: <FlaskConical size={18} />
      },
      {
        id: 'ensino',
        label: 'Ensino',
        hint: 'Trilhas e conteúdos acadêmicos',
        icon: <BookOpen size={18} />
      },
      {
        id: 'extensao',
        label: 'Extensão',
        hint: 'Ações com a comunidade',
        icon: <Users2 size={18} />
      }
    ]
  },
  {
    id: 'management',
    label: 'Gestão',
    items: [
      {
        id: 'reports',
        label: 'Relatórios',
        hint: 'Indicadores e histórico',
        icon: <FileText size={18} />
      }
    ]
  },
  {
    id: 'system',
    label: 'Sistema',
    items: [
      {
        id: 'settings',
        label: 'Configurações',
        hint: 'Preferências e parâmetros',
        icon: <Settings size={18} />
      }
    ]
  }
]);

const Sidebar = ({ activeTab, setActiveTab, isOpen, onToggle, isMobile = false }) => {
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
  const normalizedRole = normalizeRole(user?.role);
  const roleLabel = ROLE_LABELS[normalizedRole] || 'Administração';
  const isCollapsed = !isOpen && !isMobile;
  const shouldRenderSidebar = isMobile ? isOpen : true;

  const navigationGroups = useMemo(() => {
    return NAVIGATION_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) => allowedTabs.includes(item.id))
    })).filter((group) => group.items.length > 0);
  }, [allowedTabs]);

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
        className={`laines-sidebar laines-sidebar--admin ${isCollapsed ? 'laines-sidebar--collapsed' : ''}`}
        initial={false}
        animate={{ x: shouldRenderSidebar ? 0 : -264 }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      >
        <div className="laines-sidebar__header">
          <div className="laines-sidebar__brand">
            <span className="laines-sidebar__logo-mark" aria-hidden="true">
              <img src={logoLaines} alt="" />
            </span>
            {!isCollapsed && (
              <div>
                <h1 className="laines-sidebar__title">LAINES</h1>
                <p className="laines-sidebar__profile-inline">Perfil: {roleLabel}</p>
              </div>
            )}
          </div>
          <button
            onClick={onToggle}
            className="laines-sidebar__collapse"
            aria-label={
              isMobile
                ? 'Fechar menu'
                : isCollapsed
                  ? 'Expandir barra lateral'
                  : 'Recolher barra lateral'
            }
            title={
              isMobile
                ? 'Fechar menu'
                : isCollapsed
                  ? 'Expandir barra lateral'
                  : 'Recolher barra lateral'
            }
          >
            {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        <nav className="laines-sidebar__nav custom-scrollbar" aria-label="Navegação principal">
          {navigationGroups.map((group) => (
            <section className="laines-sidebar__section" key={group.id} aria-label={group.label}>
              {!isCollapsed && <h3 className="laines-sidebar__section-title">{group.label}</h3>}
              {isCollapsed && <div className="laines-sidebar__section-divider" aria-hidden="true" />}
              <div className="laines-sidebar__section-items">
                {group.items.map((item) => {
                  const isActive = activeTab === item.id;
                  const tooltipText = item.hint ? `${item.label}: ${item.hint}` : item.label;

                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelectTab(item.id)}
                      className={`laines-sidebar__item ${isActive ? 'laines-sidebar__item--active' : ''}`}
                      aria-label={isCollapsed ? tooltipText : item.label}
                      title={isCollapsed ? tooltipText : item.label}
                      data-tooltip={isCollapsed ? tooltipText : undefined}
                    >
                      <div className="laines-sidebar__item-icon" aria-hidden="true">{item.icon}</div>
                      {!isCollapsed && (
                        <span className="laines-sidebar__item-label">{item.label}</span>
                      )}
                      {isActive && <div className="laines-sidebar__item-indicator" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </nav>

        <div className="laines-sidebar__footer">
          <div className={`laines-sidebar__user-card ${isCollapsed ? 'laines-sidebar__user-card--collapsed' : ''}`}>
            <div className="laines-sidebar__user-info">
              <div className="laines-sidebar__avatar">{userInitials}</div>
              {!isCollapsed && (
                <div>
                  <p className="laines-sidebar__user-name">{displayName || 'Admin'}</p>
                  <p className="laines-sidebar__user-status">Sessão ativa</p>
                </div>
              )}
            </div>
            <button onClick={handleLogout} className="laines-sidebar__logout" title="Encerrar sessão" aria-label="Encerrar sessão">
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </motion.aside>

      {isMobile && !isOpen && (
        <button
          onClick={onToggle}
          className="laines-sidebar__toggle"
          aria-label="Abrir menu"
        >
          <ChevronRight size={20} />
        </button>
      )}
    </>
  );
};

export default Sidebar;
