import React from 'react';
import LogoLaines from '../../assets/LogoLaines.webp';

const SidebarHeader = ({ roleLabel, isCollapsed = false }) => (
  <>
    <div className="sb-header__brand-row">
      <div className="sb-header__logo-box">
        <img src={LogoLaines} alt="LAINES Logo" style={{ width: '18px', height: '18px', objectFit: 'contain' }} />
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
