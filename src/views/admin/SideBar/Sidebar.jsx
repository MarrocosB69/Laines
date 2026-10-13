import React from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import LainesSidebar from '../../../components/navigation/LainesSidebar';
import { buildSidebarModel } from '../../../navigation/sidebarModel';

/**
 * Invólucro fino: monta o modelo de navegação (capabilities do servidor) e
 * repassa para o componente único. Mesmas props de sempre - quem monta este
 * componente (AdminView.jsx) não muda.
 * docs/implementacao/sidebars-v2/change-intent.md.
 */
const Sidebar = ({ activeTab, setActiveTab, isOpen, onToggle, isMobile = false, requestsCount = 0 }) => {
  const { user } = useAuth();
  const model = buildSidebarModel({
    portal: 'admin',
    user,
    capabilities: user?.capabilities,
    requestsCount
  });

  return (
    <LainesSidebar
      portal="admin"
      model={model}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      isOpen={isOpen}
      onToggle={onToggle}
      isMobile={isMobile}
    />
  );
};

export default Sidebar;
