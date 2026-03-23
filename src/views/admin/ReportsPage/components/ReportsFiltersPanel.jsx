import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const ReportsFiltersPanel = ({
  showFilters,
  filters,
  activeQuickFilterId,
  onQuickFilterSelect,
  dateRange,
  onDateRangeChange,
  selectedProjectId,
  onProjectChange,
  projects,
  anonymize,
  onAnonymizeChange,
  onClose
}) => (
  <AnimatePresence>
    {showFilters && (
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        className="filters-expandable"
      >
        <div className="filters-panel">
          <div className="filters-header">
            <h3 className="filters-title">Recorte dos dados</h3>
            <button
              type="button"
              onClick={onClose}
              className="filters-close"
              aria-label="Fechar painel de filtros"
            >
              X
            </button>
          </div>
          <p className="filters-subtitle">Use atalhos e filtros para ajustar o recorte exibido.</p>
          <div className="filters-tags">
            {filters.map((filter) => (
              <button
                type="button"
                key={filter.id}
                className={`filter-tag ${activeQuickFilterId === filter.id ? 'active' : ''}`}
                onClick={() => onQuickFilterSelect(filter.id)}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <div className="filters-grid">
            <div className="filter-group">
              <label className="filter-label">Período de análise</label>
              <select
                value={dateRange}
                onChange={(event) => onDateRangeChange(event.target.value)}
                className="filter-select"
              >
                <option value="week">Últimos 7 dias</option>
                <option value="month">Últimos 30 dias</option>
                <option value="quarter">Último trimestre</option>
                <option value="year">Últimos 12 meses</option>
              </select>
            </div>
            <div className="filter-group">
              <label className="filter-label">Projeto</label>
              <select
                value={selectedProjectId}
                onChange={(event) => onProjectChange(event.target.value)}
                className="filter-select"
              >
                <option value="all">Todos os projetos</option>
                <option value="sem">Sem projeto</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <label className="filter-label">Privacidade na exportação</label>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={anonymize}
                  onChange={(event) => onAnonymizeChange(event.target.checked)}
                />
                <span className="toggle-slider" />
                <span className="toggle-text">{anonymize ? 'Ligada' : 'Desligada'}</span>
              </label>
            </div>
          </div>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);

export default ReportsFiltersPanel;
