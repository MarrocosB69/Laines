import React from 'react';
import LogoLainesSidebar from '../../assets/LogoLainesSidebar.png';

const SidebarHeader = ({ roleLabel, isCollapsed = false }) => (
  <>
    <div className="sb-header__brand-row">
      <div className="sb-header__logo-box">
        <img className="sb-header__logo-img" src={LogoLainesSidebar} alt="LAINES Logo" />
      </div>
      {!isCollapsed && (
        <div className="sb-header__brand-text">
          <span className="sb-header__name">LAINES</span>
          <span className="sb-header__sub">
            Liga Acadêmica Interprofissional de Nutrição Esportiva
          </span>
        </div>
      )}
    </div>
    {!isCollapsed && (
      <div className="sb-header__badge" aria-label={`Perfil: ${roleLabel}`}>
        <span className="sb-header__badge-dot" aria-hidden="true" />
        {roleLabel}
      </div>
    )}
  </>
);

export default SidebarHeader;
