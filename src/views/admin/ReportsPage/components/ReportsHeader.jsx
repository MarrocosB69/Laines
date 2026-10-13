import React from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3,
  ChevronDown,
  Download,
  Filter,
  Loader2,
  RefreshCw,
  Search
} from 'lucide-react';

// Os botões deixaram de crescer e girar no hover (motion.button): o
// desenho novo não mexe no alvo sob o ponteiro. A entrada do cabeçalho
// continua, e o MotionConfig da página a corta com "reduzir movimento".
// Busca, Refinar e Exportar só aparecem com o próprio manipulador: quem só
// vê o perfil dos atletas (WI-016) não tem indicadores nem exportação.
const ReportsHeader = ({
  isLoading,
  isExporting,
  searchQuery,
  onSearchChange,
  showFilters,
  onToggleFilters,
  onRefresh,
  onExportAll,
  subtitle = 'Visão executiva, operacional e acionável do LAINES.'
}) => (
  <motion.div
    initial={{ y: -20, opacity: 0 }}
    animate={{ y: 0, opacity: 1 }}
    className="reports-header"
  >
    <div className="header-left">
      <div className="header-title-wrapper">
        <div className="header-icon">
          <BarChart3 size={24} />
        </div>
        <h2 className="header-title">Relatórios</h2>
      </div>
      <p className="header-subtitle">
        {subtitle}
      </p>
    </div>

    <div className="header-controls">
      {onSearchChange && (
        <div className="search-wrapper">
          <Search className="search-icon" size={18} />
          <input
            type="text"
            placeholder="Buscar indicador, alerta ou dimensão..."
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            className="search-input"
            aria-label="Buscar indicador, alerta ou dimensão"
          />
        </div>
      )}

      {onToggleFilters && (
        <button
          type="button"
          onClick={onToggleFilters}
          className="filter-button"
          aria-expanded={showFilters}
        >
          <Filter size={16} />
          Refinar
          <ChevronDown size={16} className={`filter-chevron ${showFilters ? 'rotate-180' : ''}`} />
        </button>
      )}

      <button
        type="button"
        onClick={onRefresh}
        className="refresh-button"
        aria-label="Atualizar dados"
      >
        <RefreshCw size={18} className={isLoading ? 'spin' : ''} />
      </button>

      {onExportAll && (
        <button
          type="button"
          onClick={onExportAll}
          disabled={isExporting || isLoading}
          className="export-button"
        >
          {isExporting ? <Loader2 className="loader-icon" /> : <Download size={16} />}
          {isExporting ? 'Exportando...' : 'Exportar CSV'}
        </button>
      )}
    </div>
  </motion.div>
);

export default ReportsHeader;
