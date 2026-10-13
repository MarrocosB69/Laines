import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import LainesSidebar from '../../components/navigation/LainesSidebar';
import { buildSidebarModel } from '../../navigation/sidebarModel';

/**
 * Invólucro fino: monta o modelo de navegação (capabilities do servidor) e
 * repassa para o componente único. Mesmas props de sempre - quem monta este
 * componente (TeamPortal.jsx) não muda.
 * docs/implementacao/sidebars-v2/change-intent.md (decisão 2: Liga com
 * Comunicação). O ramo "profissional" (isMulti) não é reproduzido: /equipe
 * só aceita tecnico (App.jsx manda profissional para /professor) - ver
 * relatório.
 */
const TeamSidebar = ({ activeTab, setActiveTab, isOpen, onToggle, isMobile = false }) => {
  const { user } = useAuth();
  const model = buildSidebarModel({
    portal: 'equipe',
    user,
    capabilities: user?.capabilities
  });

  return (
    <LainesSidebar
      portal="equipe"
      model={model}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      isOpen={isOpen}
      onToggle={onToggle}
      isMobile={isMobile}
    />
  );
};

export default TeamSidebar;
