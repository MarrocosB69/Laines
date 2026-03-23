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

const ReportsHeader = ({
  isLoading,
  isExporting,
  searchQuery,
  onSearchChange,
  showFilters,
  onToggleFilters,
  onRefresh,
  onExportAll
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
        Visão executiva, operacional e acionável do LAINES.
      </p>
    </div>

    <div className="header-controls">
      <div className="search-wrapper">
        <Search className="search-icon" size={18} />
        <input
          type="text"
          placeholder="Buscar indicador, alerta ou dimensão..."
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          className="search-input"
        />
      </div>

      <motion.button
        type="button"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onToggleFilters}
        className="filter-button"
      >
        <Filter size={16} />
        Refinar
        <ChevronDown size={16} className={`filter-chevron ${showFilters ? 'rotate-180' : ''}`} />
      </motion.button>

      <motion.button
        type="button"
        whileHover={{ rotate: 180 }}
        onClick={onRefresh}
        className="refresh-button"
        aria-label="Atualizar dados"
      >
        <RefreshCw size={18} className={isLoading ? 'spin' : ''} />
      </motion.button>

      <motion.button
        type="button"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onExportAll}
        disabled={isExporting || isLoading}
        className="export-button"
      >
        {isExporting ? <Loader2 className="loader-icon" /> : <Download size={16} />}
        {isExporting ? 'Exportando...' : 'Exportar CSV'}
      </motion.button>
    </div>
  </motion.div>
);

export default ReportsHeader;
