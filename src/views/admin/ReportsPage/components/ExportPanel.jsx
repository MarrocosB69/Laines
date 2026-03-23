import React from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, Database, Download, ShieldCheck } from 'lucide-react';

const ExportPanel = ({
  exportOptions,
  isExporting,
  onExport,
  isCollapsed = false,
  onToggleCollapse
}) => (
  <div className={`export-panel ${isCollapsed ? 'collapsed' : ''}`}>
    <div className="export-panel-background" />
    <div className="export-panel-content">
      <div className="export-header">
        <div className="export-icon-wrapper">
          <Database size={20} />
        </div>
        <div>
          <h3 className="export-subtitle">Central de exportação</h3>
          <p className="export-title">Arquivos para análise e auditoria</p>
        </div>
        <button
          type="button"
          className={`export-collapse-btn ${isCollapsed ? 'collapsed' : ''}`}
          onClick={onToggleCollapse}
          aria-label={isCollapsed ? 'Expandir painel de exportação' : 'Recolher painel de exportação'}
        >
          <ChevronDown size={16} />
        </button>
      </div>

      <p className="export-description">
        Exporte os dados do recorte atual para uso interno e análise externa.
      </p>

      {!isCollapsed && (
        <div className="export-options">
          {exportOptions.map((option, index) => (
            <motion.button
              type="button"
              key={option.type}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2 + index * 0.1 }}
              onClick={() => onExport(option.type)}
              disabled={isExporting}
              className="export-option-button"
            >
              <div className="export-option-content">
                <div className={`export-option-icon ${option.color}`}>
                  <option.icon size={16} />
                </div>
                <span>{option.label}</span>
              </div>
              <Download size={16} className="export-option-download" />
            </motion.button>
          ))}
        </div>
      )}
    </div>

    <div className="export-footer">
      <div className="export-footer-content">
        <ShieldCheck size={14} />
        <p>Anonimização opcional e trilha de exportação alinhada ao uso institucional.</p>
      </div>
    </div>
  </div>
);

export default ExportPanel;
