import React, { useMemo } from "react";
import { HelpCircle } from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import { useUiFeedback } from "../../../contexts/UiFeedbackContext";
import NotificationTaskCenter from "../../../components/shared/NotificationTaskCenter";
import { getAcademicTabLabel } from "../../../constants/academicNavigation";
import "./AdminHeader.css";

const AdminHeader = ({ activeTab, activeIcon }) => {
  const { user } = useAuth();
  const { notify } = useUiFeedback();

  const initials = useMemo(() => {
    const rawName = user?.name || user?.nome || user?.displayName || "";
    const rawEmail = user?.email || "";
    const base = rawName || (rawEmail ? rawEmail.split("@")[0].replace(/[._-]+/g, " ") : "");
    const parts = base.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "US";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }, [user]);

  const tabLabels = {
    dashboard: "Início",
    users: "Membros",
    patients: "Atletas",
    reports: "Relatorios",
    research: "Pesquisa",
    ensino: "Ensino",
    extensao: "Extensao",
    comunicacao: "Comunicacao",
    requests: "Solicitacoes",
    settings: "Configuracoes"
  };
  const currentLabel = getAcademicTabLabel(activeTab) || tabLabels[activeTab] || activeTab;

  return (
    <header className="admin-header">
      <div className="header-left">
        <div className="header-page-title-row">
          {activeIcon ? <span className="icon-wrapper">{activeIcon}</span> : null}
          <h1 className="header-page-title">{currentLabel}</h1>
        </div>
        <p className="header-page-subtitle">Painel administrativo</p>
      </div>

      <div className="header-controls">
        <NotificationTaskCenter />

        <button
          type="button"
          className="header-btn help-btn"
          aria-label="Ajuda e suporte"
          onClick={() => {
            notify({
              type: "info",
              title: "Ajuda e suporte",
              message: "Canal de suporte em configuracao. Contate a coordenacao em caso de urgencia."
            });
          }}
        >
          <HelpCircle size={20} aria-hidden="true" />
        </button>

        <div className="user-profile-mini">
          <div className="avatar">{initials}</div>
        </div>
      </div>
    </header>
  );
};

export default AdminHeader;
