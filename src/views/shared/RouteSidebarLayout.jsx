import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  ADMIN_AREA_ROLES,
  PROFESSOR_AREA_ROLES,
  STUDENT_MEMBER_ROLES,
  getPaginaDeOrigem,
  normalizeRole,
  temDoisPapeis
} from '../../constants/roles';
import AdminSidebar from '../admin/SideBar/Sidebar';
import StudentSidebar from '../Student/StudentView/StudentSideBar';
import ProfessorSidebar from '../professor/ProfessorSidebar';
import TeamSidebar from '../Team/TeamSidebar';
import AthleteSidebar from '../Athlete/AthleteSidebar';
import NotificationTaskCenter from '../../components/shared/NotificationTaskCenter';
import '../admin/AdminView/AdminView.css';
import '../admin/AdminView/AdminHeader.css';

const AREA_DA_PAGINA_UNICA = Object.freeze({ '/aluno': 'student', '/professor': 'professor' });

// paginaUnica: página de origem de quem tem dois papéis (WI-015), ou null.
// Essa pessoa não usa mais a barra do painel: um retorno a /admin mostra a
// barra da página única (e /admin a leva para lá, ver App.jsx).
const inferAreaFromContext = (role, pathname, routeState, paginaUnica = null) => {
  const returnTo = String(routeState?.returnTo || '').toLowerCase();

  if (paginaUnica && returnTo.startsWith('/admin')) return AREA_DA_PAGINA_UNICA[paginaUnica];
  if (returnTo.startsWith('/aluno')) return 'student';
  if (returnTo.startsWith('/professor')) return 'professor';
  if (returnTo.startsWith('/admin')) return 'admin';
  if (returnTo.startsWith('/equipe')) return 'team';
  if (returnTo.startsWith('/atleta')) return 'athlete';

  if (pathname.startsWith('/aluno')) return 'student';
  if (pathname.startsWith('/professor')) return 'professor';
  if (pathname.startsWith('/admin')) return 'admin';
  if (pathname.startsWith('/equipe')) return 'team';
  if (pathname.startsWith('/atleta')) return 'athlete';

  if (ADMIN_AREA_ROLES.includes(role)) return 'admin';
  if (PROFESSOR_AREA_ROLES.includes(role)) return 'professor';
  if (role === 'tecnico') return 'team';
  if (role === 'atleta') return 'athlete';
  if (STUDENT_MEMBER_ROLES.includes(role) || role === 'aluno') return 'student';

  return 'student';
};

const getDefaultTabForArea = (area, pathname) => {
  if (area === 'team') return 'atletas';
  if (area === 'athlete') {
    if (pathname.startsWith('/avaliacao')) return 'avaliacoes';
    return 'prontuario';
  }
  return 'patients';
};

const AREA_LABELS = {
  admin: 'Painel administrativo',
  professor: 'Área do professor',
  student: 'Área do aluno',
  team: 'Área da equipe técnica',
  athlete: 'Área do atleta'
};

const PAGE_LABELS = {
  '/avaliacao': 'Avaliação',
  '/planos-alimentares': 'Plano alimentar'
};

const RouteSidebarLayout = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [isSidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  const normalizedRole = normalizeRole(user?.role);
  const paginaUnica = temDoisPapeis(user) ? getPaginaDeOrigem(user?.role) : null;
  const area = useMemo(
    () => inferAreaFromContext(normalizedRole, location.pathname, location.state, paginaUnica),
    [normalizedRole, location.pathname, location.state, paginaUnica]
  );
  const defaultTab = useMemo(
    () => getDefaultTabForArea(area, location.pathname),
    [area, location.pathname]
  );
  const [activeTab, setActiveTab] = useState(defaultTab);

  const initials = useMemo(() => {
    const rawName = user?.name || user?.nome || user?.displayName || '';
    const rawEmail = user?.email || '';
    const base = rawName || (rawEmail ? rawEmail.split('@')[0].replace(/[._-]+/g, ' ') : '');
    const parts = base.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'US';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }, [user]);

  const pageTitle = useMemo(() => {
    const pathname = String(location.pathname || '');
    const matchedPrefix = Object.keys(PAGE_LABELS).find((prefix) => pathname.startsWith(prefix));
    return matchedPrefix ? PAGE_LABELS[matchedPrefix] : 'Sistema LAINES';
  }, [location.pathname]);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  useEffect(() => {
    // UX-01: só fecha ao cruzar para mobile com o menu aberto. A versão
    // anterior reabria a barra lateral em qualquer resize no desktop
    // (`if (!prev) return true`), desfazendo um recolhimento deliberado do
    // usuário a cada redimensionamento — mesmo padrão agora usado em
    // StudentView/ProfessorView/AthleteView/TeamPortal.
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      setSidebarOpen((prev) => (mobile && prev ? false : prev));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isMobile || !isSidebarOpen) return undefined;
    const handleEscape = (event) => {
      if (event.key === 'Escape') setSidebarOpen(false);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isMobile, isSidebarOpen]);

  const handleSelectTab = useCallback((tab) => {
    setActiveTab(tab);

    if (area === 'admin') {
      navigate(`/admin?tab=${encodeURIComponent(tab || 'dashboard')}`);
      return;
    }
    // Os quatro portais aceitam ?area= (useAreaNavegacao): sem ele, clicar
    // "Atletas" a partir da prescrição levava à aba inicial, que agora é a
    // Visão Geral (revisão de 27/09/2026). Aba inválida cai no padrão.
    const comArea = (rota) => (tab ? `${rota}?area=${encodeURIComponent(tab)}` : rota);
    if (area === 'professor') {
      navigate(comArea('/professor'));
      return;
    }
    if (area === 'team') {
      navigate(comArea('/equipe'));
      return;
    }
    if (area === 'athlete') {
      navigate(comArea('/atleta'));
      return;
    }
    navigate(comArea('/aluno'));
  }, [area, navigate]);

  const sidebarProps = {
    activeTab,
    setActiveTab: handleSelectTab,
    isOpen: isSidebarOpen,
    onToggle: () => setSidebarOpen((prev) => !prev),
    isMobile
  };

  let sidebar = <StudentSidebar {...sidebarProps} />;
  if (area === 'admin') {
    sidebar = <AdminSidebar {...sidebarProps} requestsCount={0} />;
  } else if (area === 'professor') {
    sidebar = <ProfessorSidebar {...sidebarProps} />;
  } else if (area === 'team') {
    sidebar = <TeamSidebar {...sidebarProps} />;
  } else if (area === 'athlete') {
    sidebar = <AthleteSidebar {...sidebarProps} />;
  }

  const mainClassName = `admin-main-content ${!isSidebarOpen ? (isMobile ? 'expanded' : 'collapsed') : ''}`;
  const shellClassName = `admin-view light-mode route-shell route-shell--${area} ${isMobile ? 'route-shell--mobile' : 'route-shell--desktop'}`;

  return (
    <motion.div
      className={shellClassName}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <div className="admin-bg-pattern">
        <div className="pattern-grid" />
      </div>

      <div className="admin-container">
        {sidebar}

        {isMobile && isSidebarOpen && (
          <button
            type="button"
            className="sidebar-overlay"
            onClick={() => setSidebarOpen(false)}
            aria-label="Fechar menu"
          />
        )}

        <main className={mainClassName}>
          <header className="admin-header">
            <div className="header-left">
              <div className="header-page-title-row">
                <h1 className="header-page-title">{pageTitle}</h1>
              </div>
              <p className="header-page-subtitle">{AREA_LABELS[area] || 'Sistema LAINES'}</p>
            </div>

            <div className="header-controls">
              <NotificationTaskCenter />

              <div className="user-profile-mini">
                <div className="avatar">{initials}</div>
              </div>
            </div>
          </header>

          <div className="content-area">
            <div className="dynamic-content">{children}</div>
          </div>
        </main>
      </div>
    </motion.div>
  );
};

export default RouteSidebarLayout;
