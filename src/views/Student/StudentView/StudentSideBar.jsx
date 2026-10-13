import React from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import LainesSidebar from '../../../components/navigation/LainesSidebar';
import { buildSidebarModel } from '../../../navigation/sidebarModel';

/**
 * Invólucro fino: monta o modelo de navegação (capabilities do servidor) e
 * repassa para o componente único. Mesmas props de sempre - quem monta este
 * componente (StudentView.jsx) não muda.
 * docs/implementacao/sidebars-v2/change-intent.md.
 */
// requestsCount: selo de Solicitações na seção Direção (WI-015), com a mesma
// prop e o mesmo padrão 0 do invólucro do painel (admin/SideBar/Sidebar.jsx).
const StudentSidebar = ({ activeTab, setActiveTab, isOpen, onToggle, isMobile = false, requestsCount = 0 }) => {
  const { user } = useAuth();
  const model = buildSidebarModel({
    portal: 'aluno',
    user,
    capabilities: user?.capabilities,
    requestsCount
  });

  return (
    <LainesSidebar
      portal="aluno"
      model={model}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      isOpen={isOpen}
      onToggle={onToggle}
      isMobile={isMobile}
    />
  );
};

export default StudentSidebar;
