import { useEffect, useMemo, useState } from 'react';
import LainesSidebar from '../navigation/LainesSidebar';

const getInitials = (value) => {
  const parts = String(value || '').trim().split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] || 'L'}${parts.length > 1 ? parts.at(-1)[0] : parts[0]?.[1] || 'A'}`.toUpperCase();
};

export default function ProntuarioAssessmentSidebar({
  modules = [], activeKey = '', user, patientName, portal,
  onBack, onOpenPanel, onOpenModule
}) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);
  const [isOpen, setIsOpen] = useState(() => window.innerWidth > 768);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile((previous) => {
        if (previous !== mobile) setIsOpen(!mobile);
        return mobile;
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const model = useMemo(() => {
    const groups = new Map();
    modules.forEach((module) => {
      const group = module.group || 'Instrumentos';
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group).push({
        id: `assessment:${module.id}`,
        rotulo: module.label,
        icone: 'ClipboardCheck'
      });
    });
    const displayName = user?.name || user?.nome || user?.displayName || 'Equipe LAINES';
    return {
      papel: { titulo: 'Prontuário', subtitulo: patientName || 'Atendimento' },
      secoes: [
        { id: 'return', titulo: 'Prontuário', itens: [{ id: 'back', rotulo: 'Voltar', icone: 'ChevronLeft' }] },
        { id: 'assessments', titulo: 'Avaliações', itens: [{ id: 'panel', rotulo: 'Todas as avaliações', icone: 'ClipboardCheck' }] },
        ...[...groups.entries()].map(([group, items]) => ({ id: group, titulo: group, itens: items }))
      ],
      atalhos: [],
      rodape: { nome: displayName, iniciais: getInitials(displayName), tag: 'LAINES · Prontuário' }
    };
  }, [modules, patientName, user?.displayName, user?.name, user?.nome]);

  const handleSelect = (id) => {
    if (id === 'back') onBack?.();
    else if (id === 'panel') onOpenPanel?.();
    else if (id.startsWith('assessment:')) onOpenModule?.(id.slice('assessment:'.length));
  };

  return (
    <>
      <LainesSidebar portal={portal} model={model} activeTab={activeKey}
        setActiveTab={handleSelect} isOpen={isOpen}
        onToggle={() => setIsOpen((open) => !open)} isMobile={isMobile} />
      {isMobile && isOpen && (
        <button type="button" className="sidebar-overlay" aria-label="Fechar menu"
          onClick={() => setIsOpen(false)} />
      )}
    </>
  );
}
