import React from 'react';
import { ChevronRight } from 'lucide-react';

const ProfileSwitcher = ({ targetProfileLabel, targetProfileIcon, onClick, show }) => {
  if (!show) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="sb-switcher"
      aria-label={`Ir para ${targetProfileLabel}`}
    >
      <div className="sb-switcher__icon-box" aria-hidden="true">
        {targetProfileIcon}
      </div>
      <span className="sb-switcher__label">Ir para {targetProfileLabel}</span>
      <ChevronRight size={13} className="sb-switcher__chevron" strokeWidth={2} />
    </button>
  );
};

export default ProfileSwitcher;
