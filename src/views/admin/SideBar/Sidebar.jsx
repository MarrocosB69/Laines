import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { useUiFeedback } from '../../../contexts/UiFeedbackContext';
import { getApiErrorMessage } from '../../../services/api';
import { getAllowedAdminTabs } from '../../../constants/adminTabs';
import { normalizeRole } from '../../../constants/roles';
import '../../SidebarShell.css';
import '../../shared/sidebar-tokens.css';
import SidebarHeader from '../../shared/SidebarHeader';
import SidebarFooter from '../../shared/SidebarFooter';
import ProfileSwitcher from '../../shared/ProfileSwitcher';

import {
  LayoutDashboard,
  Users,
  UserCircle,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
  Inbox,
  FlaskConical,
  BookOpen,
  Users2,
  GraduationCap
} from 'lucide-react';

const navIcon = (IconComponent) => <IconComponent size={18} strokeWidth={1.8} />;

const ROLE_LABELS = Object.freeze({
  admin:               'Administração',
  coordenacao:         'Coordenação',
  presidente:          'Presidência',
  vice:                'Vice-presidência',
  diretoria_marketing: 'Diretoria de Marketing',
  diretoria_ensino:    'Diretoria de Ensino',
  diretoria_pesquisa:  'Diretoria de Pesquisa',
  diretoria_extensao:  'Diretoria de Extensão',
  coord_atendimento:   'Coordenação de Atendimento'
});

const NAVIGATION_GROUPS = Object.freeze([
  {
    id: 'overview',
    label: 'Visão Geral',
    items: [
      { id: 'dashboard', label: 'Início',      hint: 'Resumo do painel',              icon: navIcon(LayoutDashboard) }
    ]
  },
  {
    id: 'people',
    label: 'Pessoas',
    items: [
      { id: 'users',    label: 'Membros', hint: 'Equipe interna da liga',              icon: navIcon(Users) },
      { id: 'patients', label: 'Atletas', hint: 'Pessoas atendidas e acompanhadas',    icon: navIcon(UserCircle) }
    ]
  },
  {
    id: 'areas',
    label: 'Áreas',
    items: [
      { id: 'research', label: 'Projetos',  hint: 'Pesquisa e iniciativas ativas',     icon: navIcon(FlaskConical) },
      { id: 'ensino',   label: 'Ensino',    hint: 'Trilhas e conteúdos acadêmicos',    icon: navIcon(BookOpen) },
      { id: 'extensao', label: 'Extensão',  hint: 'Ações com a comunidade',            icon: navIcon(Users2) }
    ]
  },
  {
    id: 'management',
    label: 'Gestão',
    items: [
      { id: 'requests', label: 'Solicitações', hint: 'Pedidos e aprovações pendentes', icon: navIcon(Inbox) },
      { id: 'reports',  label: 'Relatórios',   hint: 'Indicadores e histórico',        icon: navIcon(FileText) }
    ]
  },
  {
    id: 'system',
    label: 'Sistema',
    items: [
      { id: 'settings', label: 'Configurações', hint: 'Preferências e parâmetros',    icon: navIcon(Settings) }
    ]
  }
]);

const Sidebar = ({ activeTab, setActiveTab, isOpen, onToggle, isMobile = false, requestsCount = 0 }) => {
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

  const displayName  = user?.name || user?.nome || '';
  const userInitials = getInitials(displayName);

  const allowedTabs          = getAllowedAdminTabs(user?.role);
  const normalizedRole       = normalizeRole(user?.role);
  const canAccessStudentPortal = normalizedRole === 'presidente' || normalizedRole === 'vice';
  const roleLabel            = ROLE_LABELS[normalizedRole] || 'Administração';
  const isCollapsed          = !isOpen && !isMobile;
  const shouldRenderSidebar  = isMobile ? isOpen : true;

  const navigationGroups = useMemo(() => (
    NAVIGATION_GROUPS
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => allowedTabs.includes(item.id))
      }))
      .filter((group) => group.items.length > 0)
  ), [allowedTabs]);

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
    if (window.innerWidth <= 768 && isOpen) onToggle();
  };

  const handleOpenStudentArea = () => {
    navigate('/aluno', { state: { returnAdminTab: activeTab || 'dashboard' } });
    if (window.innerWidth <= 768 && isOpen) onToggle();
  };

  return (
    <>
      <motion.aside
        className={`laines-sidebar laines-sidebar--admin laines-sidebar--accent-blue ${isCollapsed ? 'laines-sidebar--collapsed' : ''}`}
        initial={false}
        animate={{ x: shouldRenderSidebar ? 0 : -264 }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      >
        {/* Header */}
        <div className="laines-sidebar__header">
          <div className="laines-sidebar__brand">
            <SidebarHeader roleLabel={roleLabel} isCollapsed={isCollapsed} />
          </div>
          <button
            onClick={onToggle}
            className="laines-sidebar__collapse"
            aria-label={
              isMobile ? 'Fechar menu'
              : isCollapsed ? 'Expandir barra lateral'
              : 'Recolher barra lateral'
            }
            title={
              isMobile ? 'Fechar menu'
              : isCollapsed ? 'Expandir barra lateral'
              : 'Recolher barra lateral'
            }
          >
            {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="laines-sidebar__nav custom-scrollbar" aria-label="Navegação principal">
          {navigationGroups.map((group, groupIndex) => (
            <React.Fragment key={group.id}>
              <section className="laines-sidebar__section" aria-label={group.label}>
                {!isCollapsed && (
                  <h3 className="laines-sidebar__section-title">{group.label}</h3>
                )}
                {isCollapsed && (
                  <div className="laines-sidebar__section-divider" aria-hidden="true" />
                )}
                <div className="laines-sidebar__section-items">
                  {group.items.map((item) => {
                    const isActive       = activeTab === item.id;
                    const tooltipText    = item.hint ? `${item.label}: ${item.hint}` : item.label;
                    const hasRequestsBadge = (
                      item.id === 'requests'
                      && Number.isFinite(requestsCount)
                      && requestsCount > 0
                    );

                    return (
                      <button
                        key={item.id}
                        onClick={() => handleSelectTab(item.id)}
                        className={`laines-sidebar__item ${isActive ? 'laines-sidebar__item--active' : ''}`}
                        aria-label={isCollapsed ? tooltipText : item.label}
                        title={isCollapsed ? tooltipText : item.label}
                        data-tooltip={isCollapsed ? tooltipText : undefined}
                      >
                        <div className="laines-sidebar__item-icon" aria-hidden="true">
                          {item.icon}
                        </div>
                        {!isCollapsed && (
                          <span className="laines-sidebar__item-label">{item.label}</span>
                        )}
                        {!isCollapsed && hasRequestsBadge && (
                          <span
                            className={`laines-sidebar__requests-badge ${isActive ? 'laines-sidebar__requests-badge--active' : ''}`}
                            aria-label={`${Math.trunc(requestsCount)} solicitações pendentes`}
                          >
                            {Math.trunc(requestsCount)}
                          </span>
                        )}
                        {isActive && (
                          <div className="laines-sidebar__item-indicator" aria-hidden="true" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>
              {!isCollapsed && groupIndex < navigationGroups.length - 1 && (
                <div className="laines-sidebar__group-divider" aria-hidden="true" />
              )}
            </React.Fragment>
          ))}

          {/* Área acadêmica */}
          {canAccessStudentPortal && (
            <>
              {!isCollapsed && (
                <div className="laines-sidebar__group-divider" aria-hidden="true" />
              )}
              <section className="laines-sidebar__section" aria-label="Área acadêmica">
                {!isCollapsed && (
                  <h3 className="laines-sidebar__section-title">Área Acadêmica</h3>
                )}
                {isCollapsed && (
                  <div className="laines-sidebar__section-divider" aria-hidden="true" />
                )}
                <div className="laines-sidebar__section-items">
                  <button
                    type="button"
                    onClick={handleOpenStudentArea}
                    className="laines-sidebar__item"
                    aria-label={isCollapsed ? 'Abrir área do aluno' : 'Área do aluno'}
                    title="Abrir área do aluno"
                    data-tooltip={isCollapsed ? 'Abrir área do aluno' : undefined}
                  >
                    <div className="laines-sidebar__item-icon" aria-hidden="true">
                      <GraduationCap size={18} strokeWidth={1.8} />
                    </div>
                    {!isCollapsed && (
                      <span className="laines-sidebar__item-label">Área do aluno</span>
                    )}
                  </button>
                </div>
              </section>
              {!isCollapsed && (
                <>
                  <div className="laines-sidebar__group-divider" aria-hidden="true" />
                  <ProfileSwitcher
                    targetProfileLabel="Área do Aluno"
                    targetProfileIcon={<GraduationCap size={13} strokeWidth={2} color="#60a5fa" />}
                    onClick={handleOpenStudentArea}
                    show={canAccessStudentPortal}
                  />
                </>
              )}
            </>
          )}
        </nav>

        {/* Footer */}
        <SidebarFooter
          displayName={displayName || 'Admin'}
          userInitials={userInitials}
          onLogout={handleLogout}
          isCollapsed={isCollapsed}
        />
      </motion.aside>

      {isMobile && !isOpen && (
        <button
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

export default Sidebar;
