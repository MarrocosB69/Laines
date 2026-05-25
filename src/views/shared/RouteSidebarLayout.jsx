import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  ADMIN_AREA_ROLES,
  PROFESSOR_AREA_ROLES,
  STUDENT_MEMBER_ROLES,
  normalizeRole
} from '../../constants/roles';
import AdminSidebar from '../admin/SideBar/Sidebar';
import StudentSidebar from '../Student/StudentView/StudentSideBar';
import ProfessorSidebar from '../professor/ProfessorSidebar';
import TeamSidebar from '../Team/TeamSidebar';
import AthleteSidebar from '../Athlete/AthleteSidebar';
import NotificationTaskCenter from '../../components/shared/NotificationTaskCenter';
import '../admin/AdminView/AdminView.css';
import '../admin/AdminView/AdminHeader.css';

const inferAreaFromContext = (role, pathname, routeState) => {
  const returnTo = String(routeState?.returnTo || '').toLowerCase();

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
  professor: 'Area do professor',
  student: 'Area do aluno',
  team: 'Area da equipe tecnica',
  athlete: 'Area do atleta'
};

const PAGE_LABELS = {
  '/avaliacao': 'Avaliacao',
  '/planos-alimentares': 'Plano alimentar'
};

const RouteSidebarLayout = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [isSidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  const normalizedRole = normalizeRole(user?.role);
  const area = useMemo(
    () => inferAreaFromContext(normalizedRole, location.pathname, location.state),
    [normalizedRole, location.pathname, location.state]
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
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      setSidebarOpen((prev) => {
        if (mobile) return false;
        if (!prev) return true;
        return prev;
      });
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
    if (area === 'professor') {
      navigate('/professor');
      return;
    }
    if (area === 'team') {
      navigate('/equipe');
      return;
    }
    if (area === 'athlete') {
      navigate('/atleta');
      return;
    }
    navigate('/aluno');
  }, [area, navigate]);

  const sidebarProps = {
    activeTab,
    setActiveTab: handleSelectTab,
    isOpen: isSidebarOpen,
    onToggle: () => setSidebarOpen((prev) => !prev)
  };

  let sidebar = <StudentSidebar {...sidebarProps} />;
  if (area === 'admin') {
    sidebar = <AdminSidebar {...sidebarProps} isMobile={isMobile} requestsCount={0} />;
  } else if (area === 'professor') {
    sidebar = <ProfessorSidebar {...sidebarProps} />;
  } else if (area === 'team') {
    sidebar = <TeamSidebar {...sidebarProps} />;
  } else if (area === 'athlete') {
    sidebar = <AthleteSidebar {...sidebarProps} />;
  }

  const mainClassName = `admin-main-content ${!isSidebarOpen ? (isMobile ? 'expanded' : 'collapsed') : ''}`;

  return (
    <motion.div
      className="admin-view light-mode"
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
