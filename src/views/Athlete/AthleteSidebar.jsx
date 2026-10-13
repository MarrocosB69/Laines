import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import LainesSidebar from '../../components/navigation/LainesSidebar';
import { buildSidebarModel } from '../../navigation/sidebarModel';

/**
 * Invólucro fino: monta o modelo de navegação (capabilities do servidor) e
 * repassa para o componente único. Mesmas props de sempre - quem monta este
 * componente (AthleteView.jsx) não muda.
 * docs/implementacao/sidebars-v2/change-intent.md.
 */
const AthleteSidebar = ({ activeTab, setActiveTab, isOpen, onToggle, isMobile = false, pendingCount = 0 }) => {
  const { user } = useAuth();
  const model = buildSidebarModel({
    portal: 'atleta',
    user,
    capabilities: user?.capabilities,
    pendingCount
  });

  return (
    <LainesSidebar
      portal="atleta"
      model={model}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      isOpen={isOpen}
      onToggle={onToggle}
      isMobile={isMobile}
    />
  );
};

export default AthleteSidebar;
