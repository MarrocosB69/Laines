import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  BarChart3,
  Briefcase,
  Cpu,
  GraduationCap,
  ShieldCheck,
  TrendingUp,
  Users
} from 'lucide-react';
import api from '../../../services/api';
import { useUiFeedback } from '../../../contexts/UiFeedbackContext';
import StatCard from './components/StatCard';
import ExportPanel from './components/ExportPanel';
import QuarterlyPanel from './components/QuarterlyPanel';
import ReportsFiltersPanel from './components/ReportsFiltersPanel';
import ReportsHeader from './components/ReportsHeader';
import ReportsInfoFooter from './components/ReportsInfoFooter';
import UsagePanel from './components/UsagePanel';
import DriversPanel from './components/DriversPanel';
import CorrelationDrilldownPanel from './components/CorrelationDrilldownPanel';
import useReportsOverview from './hooks/useReportsOverview';
import { exportOptions, quickFilters } from './config/reportsConfig';
import { downloadBlobFile, getFilenameFromDisposition } from './utils/exportUtils';
import './ReportsPage.css';

const exportFormatByType = {
  excel: 'csv',
  csv: 'csv',
  analytics: 'json'
};

const viewOptions = [
  { id: 'all', label: 'Completa', icon: Briefcase },
  { id: 'executive', label: 'Executiva', icon: TrendingUp },
  { id: 'operational', label: 'Operacional', icon: BarChart3 },
  { id: 'analytics', label: 'Acionável', icon: Cpu }
];

const exportLabelByType = {
  excel: 'base consolidada',
  csv: 'dataset detalhado',
  analytics: 'dados analíticos'
};

const ReportsPage = () => {
  const [dateRange, setDateRange] = useState('month');
  const [isExporting, setIsExporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState('all');
  const [anonymize, setAnonymize] = useState(true);
  const [activeQuickFilterId, setActiveQuickFilterId] = useState('visao_geral');
  const [viewMode, setViewMode] = useState('all');
  const [isExportPanelCollapsed, setIsExportPanelCollapsed] = useState(true);
  const { notify } = useUiFeedback();

  const { overview, correlations, isLoading, autoRefreshIntervalMs, reload } = useReportsOverview({
    range: dateRange,
    projectId: selectedProjectId,
    notify
  });

  const metricDefinitions = useMemo(() => (
    overview?.metricDefinitions && typeof overview.metricDefinitions === 'object'
      ? overview.metricDefinitions
      : {}
  ), [overview?.metricDefinitions]);

  const getMetricDescription = useCallback((key, fallback) => {
    const definition = metricDefinitions[key];
    if (!definition || typeof definition !== 'object') return fallback;
    const description = String(definition.description || '').trim();
    const formula = String(definition.formula || '').trim();
    if (!description && !formula) return fallback;
    if (!formula) return description;
    return `${description} - ${formula}`;
  }, [metricDefinitions]);

  const reportsData = useMemo(() => {
    const metrics = overview.metrics || {};
    return {
      totalAlunos: {
        value: Number(metrics.totalAlunos || 0).toLocaleString('pt-BR'),
        trend: { value: `${Number(metrics.totalAlunos || 0)}`, direction: 'up' },
        description: getMetricDescription('totalAlunos', 'Membros estudantis ativos')
      },
      professores: {
        value: Number(metrics.professores || 0).toLocaleString('pt-BR'),
        trend: { value: `${Number(metrics.professores || 0)}`, direction: 'up' },
        description: getMetricDescription('professores', 'Supervisores cadastrados')
      },
      totalPacientes: {
        value: Number(metrics.totalPacientes || 0).toLocaleString('pt-BR'),
        trend: { value: `${Number(metrics.totalPacientes || 0)}`, direction: 'up' },
        description: getMetricDescription('totalPacientes', 'Pacientes monitorados no escopo')
      },
      avaliacoes: {
        value: Number(metrics.avaliacoesPeriodo || 0).toLocaleString('pt-BR'),
        trend: { value: `${Number(metrics.avaliacoesPeriodo || 0)}`, direction: 'up' },
        description: getMetricDescription('avaliacoesPeriodo', 'Avaliações registradas no período')
      },
      taxaVinculacao: {
        value: `${Number(metrics.taxaVinculacao || 0)}%`,
        trend: { value: `${Number(metrics.taxaVinculacao || 0)}%`, direction: 'up' },
        description: getMetricDescription('taxaVinculacao', 'Pacientes com responsável definido')
      },
      integridade: {
        value: `${Number(metrics.integridade || 0)}%`,
        trend: { value: `${Number(metrics.integridade || 0)}%`, direction: 'up' },
        description: getMetricDescription('integridade', 'Avaliações com completude >= 80%')
      },
      satisfacao: {
        value: Number(metrics.satisfacao || 0).toFixed(1),
        trend: { value: `${Number(metrics.completionRate || 0)}%`, direction: 'up' },
        description: getMetricDescription('satisfacao', 'Índice proxy operacional (0-5)')
      },
      retencao: {
        value: `${Number(metrics.retencao || 0)}%`,
        trend: { value: `${Number(metrics.retencao || 0)}%`, direction: 'up' },
        description: getMetricDescription('retencao', 'Pacientes com pelo menos 2 avaliações')
      }
    };
  }, [getMetricDescription, overview.metrics]);

  const usageData = useMemo(() => {
    const items = Array.isArray(overview.usageByType) ? overview.usageByType : [];
    return items.map((item) => ({
      label: item.label,
      value: Number(item.percentage || 0),
      count: Number(item.count || 0),
      color: item.color || 'progress-gradient-blue'
    }));
  }, [overview.usageByType]);

  const quarterlyData = useMemo(() => (
    Array.isArray(overview.quarterly) ? overview.quarterly : []
  ), [overview.quarterly]);

  const projects = useMemo(() => (
    Array.isArray(overview.projects) ? overview.projects : []
  ), [overview.projects]);

  const alerts = useMemo(() => (
    Array.isArray(correlations?.alerts) ? correlations.alerts : []
  ), [correlations?.alerts]);

  const dataset = useMemo(() => (
    correlations?.dataset && typeof correlations.dataset === 'object'
      ? correlations.dataset
      : { patients: 0, evaluations: 0, appointments: 0 }
  ), [correlations?.dataset]);

  const statCards = useMemo(() => [
    {
      title: 'Total de alunos',
      value: reportsData.totalAlunos.value,
      icon: Users,
      color: 'gradient-blue',
      trend: reportsData.totalAlunos.trend,
      description: reportsData.totalAlunos.description
    },
    {
      title: 'Professores/Profissionais',
      value: reportsData.professores.value,
      icon: GraduationCap,
      color: 'gradient-emerald',
      trend: reportsData.professores.trend,
      description: reportsData.professores.description
    },
    {
      title: 'Total de pacientes',
      value: reportsData.totalPacientes.value,
      icon: Users,
      color: 'gradient-indigo',
      trend: reportsData.totalPacientes.trend,
      description: reportsData.totalPacientes.description
    },
    {
      title: 'Avaliações no período',
      value: reportsData.avaliacoes.value,
      icon: BarChart3,
      color: 'gradient-purple',
      trend: reportsData.avaliacoes.trend,
      description: reportsData.avaliacoes.description
    },
    {
      title: 'Taxa de vinculação',
      value: reportsData.taxaVinculacao.value,
      icon: TrendingUp,
      color: 'gradient-amber',
      trend: reportsData.taxaVinculacao.trend,
      description: reportsData.taxaVinculacao.description
    },
    {
      title: 'Integridade de dados',
      value: reportsData.integridade.value,
      icon: ShieldCheck,
      color: 'gradient-green',
      trend: reportsData.integridade.trend,
      description: reportsData.integridade.description
    },
    {
      title: 'Satisfação estimada',
      value: reportsData.satisfacao.value,
      icon: TrendingUp,
      color: 'gradient-rose',
      trend: reportsData.satisfacao.trend,
      description: reportsData.satisfacao.description
    },
    {
      title: 'Retenção',
      value: reportsData.retencao.value,
      icon: TrendingUp,
      color: 'gradient-cyan',
      trend: reportsData.retencao.trend,
      description: reportsData.retencao.description
    }
  ], [reportsData]);

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const visibleStatCards = useMemo(() => {
    if (!normalizedSearch) return statCards;
    return statCards.filter((item) => (
      item.title.toLowerCase().includes(normalizedSearch)
      || item.description.toLowerCase().includes(normalizedSearch)
    ));
  }, [normalizedSearch, statCards]);

  const visibleUsageData = useMemo(() => {
    if (!normalizedSearch) return usageData;
    return usageData.filter((item) => item.label.toLowerCase().includes(normalizedSearch));
  }, [normalizedSearch, usageData]);

  const visibleAlerts = useMemo(() => {
    if (!normalizedSearch) return alerts;
    return alerts.filter((item) => (
      String(item.title || '').toLowerCase().includes(normalizedSearch)
      || String(item.recommendation || '').toLowerCase().includes(normalizedSearch)
    ));
  }, [alerts, normalizedSearch]);

  const handleQuickFilterSelect = useCallback((filterId) => {
    const selectedFilter = quickFilters.find((item) => item.id === filterId);
    if (!selectedFilter?.preset) return;
    const preset = selectedFilter.preset;
    if (preset.range) setDateRange(preset.range);
    if (preset.projectId) setSelectedProjectId(preset.projectId);
    if (typeof preset.anonymize === 'boolean') setAnonymize(preset.anonymize);
    if (typeof preset.searchQuery === 'string') setSearchQuery(preset.searchQuery);
    setActiveQuickFilterId(filterId);
  }, []);

  useEffect(() => {
    const matched = quickFilters.find((filter) => (
      filter.preset?.range === dateRange
      && filter.preset?.projectId === selectedProjectId
      && filter.preset?.anonymize === anonymize
      && String(filter.preset?.searchQuery || '') === searchQuery
    ));
    setActiveQuickFilterId(matched?.id || '');
  }, [anonymize, dateRange, searchQuery, selectedProjectId]);

  const handleExport = useCallback(async (type) => {
    setIsExporting(true);
    try {
      const isPrintAction = type === 'print';
      const projectLabel = selectedProjectId === 'all'
        ? 'todos'
        : selectedProjectId === 'sem'
          ? 'sem-projeto'
          : (projects.find((item) => item.id === selectedProjectId)?.nome || 'projeto');

      if (isPrintAction) {
        window.print();
        notify({
          type: 'info',
          title: 'Impressão iniciada',
          message: 'A visualização de impressão foi aberta no navegador.'
        });
      } else {
        const response = await api.get('/analytics/reports/export', {
          params: {
            range: dateRange,
            projectId: selectedProjectId,
            anonymize,
            format: exportFormatByType[type] || 'csv'
          },
          responseType: 'blob'
        });

        const contentDisposition = response.headers?.['content-disposition'];
        const fallbackExtension = (exportFormatByType[type] || 'csv') === 'json' ? 'json' : 'csv';
        const fallbackName = `relatorio_${projectLabel}.${fallbackExtension}`;
        const filename = getFilenameFromDisposition(contentDisposition, fallbackName);
        downloadBlobFile(response.data, filename);
      }

      if (!isPrintAction) {
        notify({
          type: 'success',
          title: 'Exportação concluída',
          message: `${exportLabelByType[type] || 'arquivo'} exportado com sucesso.`
        });
      }
    } catch (error) {
      notify({
        type: 'error',
        title: 'Falha na exportação',
        message: 'Não foi possível exportar o arquivo. Tente novamente.'
      });
    } finally {
      setIsExporting(false);
    }
  }, [
    anonymize,
    dateRange,
    notify,
    projects,
    selectedProjectId
  ]);

  const handleRefresh = useCallback(() => {
    reload();
  }, [reload]);

  const isExecutiveView = viewMode === 'all' || viewMode === 'executive';
  const isOperationalView = viewMode === 'all' || viewMode === 'operational';
  const isAnalyticsView = viewMode === 'all' || viewMode === 'analytics';

  const statsSkeleton = Array.from({ length: 8 }).map((_, index) => (
    <div key={`skeleton-${index}`} className="report-skeleton-card" />
  ));

  return (
    <div className="reports-container">
      <ReportsHeader
        isLoading={isLoading}
        isExporting={isExporting}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters((prev) => !prev)}
        onRefresh={handleRefresh}
        onExportAll={() => handleExport('csv')}
      />

      <div className="reports-view-switch">
        {viewOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`view-switch-btn ${viewMode === option.id ? 'active' : ''}`}
            onClick={() => setViewMode(option.id)}
          >
            <option.icon size={14} />
            {option.label}
          </button>
        ))}
      </div>

      <ReportsFiltersPanel
        showFilters={showFilters}
        filters={quickFilters}
        activeQuickFilterId={activeQuickFilterId}
        onQuickFilterSelect={handleQuickFilterSelect}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        selectedProjectId={selectedProjectId}
        onProjectChange={setSelectedProjectId}
        projects={projects}
        anonymize={anonymize}
        onAnonymizeChange={setAnonymize}
        onClose={() => setShowFilters(false)}
      />

      <div className="reports-dataset-strip">
        <article>
          <span>Pacientes analisados</span>
          <strong>{Number(dataset.patients || 0).toLocaleString('pt-BR')}</strong>
        </article>
        <article>
          <span>Avaliações analisadas</span>
          <strong>{Number(dataset.evaluations || 0).toLocaleString('pt-BR')}</strong>
        </article>
        <article>
          <span>Consultas analisadas</span>
          <strong>{Number(dataset.appointments || 0).toLocaleString('pt-BR')}</strong>
        </article>
      </div>

      {visibleAlerts.length > 0 && (
        <section className="reports-alerts-strip">
          {visibleAlerts.slice(0, 3).map((alert) => (
            <article key={alert.id} className={`reports-alert alert-${alert.severity || 'low'}`}>
              <AlertTriangle size={14} />
              <div>
                <strong>{alert.title}</strong>
                <p>{alert.recommendation}</p>
              </div>
            </article>
          ))}
        </section>
      )}

      {isExecutiveView && (
        <section className="reports-section">
          <header className="reports-section-header">
            <h3>Resumo executivo</h3>
            <p>Indicadores principais para acompanhamento institucional rápido.</p>
          </header>
          <div className="stats-grid">
            {isLoading
              ? statsSkeleton
              : visibleStatCards.map((card, index) => (
                <motion.div
                  key={card.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1, duration: 0.5 }}
                >
                  <StatCard {...card} />
                </motion.div>
              ))}
            {!isLoading && visibleStatCards.length === 0 && (
              <div className="reports-empty-state laines-feedback-state">
                Nenhum indicador encontrado para a busca atual.
              </div>
            )}
          </div>
        </section>
      )}

      {isOperationalView && (
        <section className="reports-section">
          <header className="reports-section-header">
            <h3>Análise operacional</h3>
            <p>Uso por categoria e comportamento temporal para a rotina da equipe.</p>
          </header>
          <div className="charts-export-grid operational-only-grid">
            <UsagePanel
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
              generatedAt={overview.generatedAt}
              visibleUsageData={visibleUsageData}
            />
            <QuarterlyPanel quarterlyData={quarterlyData} />
          </div>
        </section>
      )}

      {isAnalyticsView && (
        <section className="reports-section">
          <header className="reports-section-header">
            <h3>Drivers e tomada de decisão</h3>
            <p>Fatores associados e detalhamento para orientar ações concretas.</p>
          </header>
          <DriversPanel correlations={correlations} />
          <CorrelationDrilldownPanel correlations={correlations} />
        </section>
      )}

      <section className="reports-section">
        <header className="reports-section-header">
          <h3>Exportação e compartilhamento</h3>
          <p>Arquivos para BI, auditoria e análises externas sem sobrecarregar o painel.</p>
        </header>
        <div className="charts-export-grid export-focused-grid">
          <ExportPanel
            exportOptions={exportOptions}
            isExporting={isExporting}
            onExport={handleExport}
            isCollapsed={isExportPanelCollapsed}
            onToggleCollapse={() => setIsExportPanelCollapsed((prev) => !prev)}
          />
        </div>
      </section>

      <ReportsInfoFooter
        generatedAt={overview.generatedAt}
        autoRefreshMinutes={Math.round(autoRefreshIntervalMs / 60000)}
        hasAutoRefresh
      />
    </div>
  );
};

export default ReportsPage;

