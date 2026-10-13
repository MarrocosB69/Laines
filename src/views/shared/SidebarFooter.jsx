import React from 'react';
import { LogOut } from 'lucide-react';
import { nomeExibicao } from './nomeExibicao';

const SidebarFooter = ({ displayName, userInitials, onLogout, isCollapsed = false }) => (
  <div className={`sb-footer ${isCollapsed ? 'sb-footer--collapsed' : ''}`}>
    <div className="sb-footer__inner">
      <div className="sb-footer__avatar" aria-hidden="true">
        {userInitials}
      </div>
      {!isCollapsed && (
        <div className="sb-footer__info">
          <p className="sb-footer__name" title={displayName}>{nomeExibicao(displayName)}</p>
          <p className="sb-footer__status">
            <span className="sb-footer__status-dot" aria-hidden="true" />
            Sessão ativa
          </p>
        </div>
      )}
      <button
        onClick={onLogout}
        className="sb-footer__logout"
        title="Encerrar sessão"
        aria-label="Encerrar sessão"
      >
        <LogOut size={15} strokeWidth={1.8} />
      </button>
    </div>
  </div>
);

export default SidebarFooter;
