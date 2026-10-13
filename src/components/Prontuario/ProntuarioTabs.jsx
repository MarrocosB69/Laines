import React, { useMemo } from 'react';

const ProntuarioTabs = ({ tabs = [], activeTab, onChange }) => {
  const visibleTabs = useMemo(
    () => tabs.filter((item) => item && item.id && item.label && item.enabled !== false),
    [tabs]
  );

  const handleKeyDown = (event, currentIndex) => {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    if (!visibleTabs.length) return;
    if (event.key === 'Home') {
      onChange?.(visibleTabs[0].id);
      return;
    }
    if (event.key === 'End') {
      onChange?.(visibleTabs[visibleTabs.length - 1].id);
      return;
    }
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = (currentIndex + direction + visibleTabs.length) % visibleTabs.length;
    onChange?.(visibleTabs[nextIndex].id);
  };

  return (
    <nav className="pron-tabs pron-card" role="tablist" aria-label="Navegação do prontuário">
      {visibleTabs.map((tab, index) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            id={`pron-aba-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls="pron-aba-conteudo"
            className={`pron-tab ${isActive ? 'active' : ''}`}
            onClick={() => onChange?.(tab.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            {tab.label}
            {tab.count > 0 ? (
              <span className="pron-tab-count" aria-hidden="true">{tab.count}</span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
};

export default ProntuarioTabs;
