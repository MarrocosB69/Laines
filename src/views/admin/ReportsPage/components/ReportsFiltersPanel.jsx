import React from 'react';
import { periodOptions } from '../config/reportsConfig';

// O painel abre e fecha pela mesma condição (showFilters). A animação de
// altura (AnimatePresence) saiu: `height` não é transform nem opacity. A
// entrada agora é do CSS, só sem preferência por menos movimento.
// Cada rótulo aponta para o seu campo (htmlFor/id); os ids são fixos
// porque a página de relatórios só tem um painel de filtros.
// Anonimização: vale só para os arquivos exportados (a tela é sempre
// agregada). Quem não tem leitura detalhada (capabilities.gestao.relatorios
// .detalhado) não escolhe: o servidor sempre exporta agregado e anônimo para
// esse perfil, então o interruptor fica ligado e travado, e a frase diz isso.
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
  canChooseAnonymize = false,
  onClose
}) => {
  const anonymizeOn = canChooseAnonymize ? anonymize : true;

  return showFilters && (
    <div className="filters-expandable">
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
        <p className="filters-subtitle">
          Use atalhos e filtros para ajustar o recorte exibido. Datas no horário de Brasília.
        </p>
        <div className="filters-tags" role="group" aria-label="Atalhos de recorte">
          {filters.map((filter) => (
            <button
              type="button"
              key={filter.id}
              className={`filter-tag ${activeQuickFilterId === filter.id ? 'active' : ''}`}
              onClick={() => onQuickFilterSelect(filter.id)}
              aria-pressed={activeQuickFilterId === filter.id}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <div className="filters-grid">
          <div className="filter-group">
            <label className="filter-label" htmlFor="relatorios-filtro-periodo">Período de análise</label>
            <select
              id="relatorios-filtro-periodo"
              value={dateRange}
              onChange={(event) => onDateRangeChange(event.target.value)}
              className="filter-select"
            >
              {periodOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label" htmlFor="relatorios-filtro-projeto">Projeto</label>
            <select
              id="relatorios-filtro-projeto"
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
            <label className="filter-label" htmlFor="relatorios-filtro-anonimizar">Anonimizar a exportação</label>
            <label className={`toggle-switch ${canChooseAnonymize ? '' : 'is-locked'}`}>
              <input
                id="relatorios-filtro-anonimizar"
                type="checkbox"
                checked={anonymizeOn}
                disabled={!canChooseAnonymize}
                aria-describedby="relatorios-filtro-anonimizar-ajuda"
                onChange={(event) => onAnonymizeChange(event.target.checked)}
              />
              <span className="toggle-slider" />
              <span className="toggle-text">{anonymizeOn ? 'Ligada' : 'Desligada'}</span>
            </label>
            <p id="relatorios-filtro-anonimizar-ajuda" className="filter-help">
              {canChooseAnonymize
                ? 'Vale só para os arquivos exportados (CSV e JSON). A tela mostra sempre números agregados.'
                : 'Seu perfil exporta só números agregados, sem dados de atletas, e o servidor anonimiza sempre. Por isso a opção fica ligada.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportsFiltersPanel;
