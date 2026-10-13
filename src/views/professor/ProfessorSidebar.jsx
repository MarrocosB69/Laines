import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import LainesSidebar from '../../components/navigation/LainesSidebar';
import { buildSidebarModel } from '../../navigation/sidebarModel';

/**
 * Invólucro fino: monta o modelo de navegação (capabilities do servidor) e
 * repassa para o componente único. Mesmas props de sempre - quem monta este
 * componente (ProfessorView.jsx) não muda.
 * docs/implementacao/sidebars-v2/change-intent.md (decisão 2: Liga com
 * Comunicação, revoga a exclusão de LIGA_ROOTS_PROFESSOR).
 */
const ProfessorSidebar = ({ activeTab, setActiveTab, isOpen, onToggle, isMobile = false }) => {
  const { user } = useAuth();
  const model = buildSidebarModel({
    portal: 'professor',
    user,
    capabilities: user?.capabilities
  });

  return (
    <LainesSidebar
      portal="professor"
      model={model}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      isOpen={isOpen}
      onToggle={onToggle}
      isMobile={isMobile}
    />
  );
};

export default ProfessorSidebar;
