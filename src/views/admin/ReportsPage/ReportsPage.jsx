import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { MotionConfig, motion } from 'framer-motion';
import {
  AlertTriangle,
  BarChart3,
  Briefcase,
  CalendarCheck,
  ClipboardCheck,
  Cpu,
  GraduationCap,
  Link2,
  RotateCcw,
  ShieldCheck,
  TrendingUp,
  UserPlus,
  Users
} from 'lucide-react';
import api from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import { useUiFeedback } from '../../../contexts/UiFeedbackContext';
import { PainelIndicadores, PainelVisaoGeral } from '../../../components/painel/Painel';
import StatCard from './components/StatCard';
import ExportPanel from './components/ExportPanel';
import QuarterlyPanel from './components/QuarterlyPanel';
import ReportsFiltersPanel from './components/ReportsFiltersPanel';
import ReportsHeader from './components/ReportsHeader';
import ReportsInfoFooter from './components/ReportsInfoFooter';
import UsagePanel from './components/UsagePanel';
import DriversPanel from './components/DriversPanel';
import CorrelationDrilldownPanel from './components/CorrelationDrilldownPanel';
import PerfilAtletasPanel from './components/PerfilAtletasPanel';
import ProducaoLigaPanel from './components/ProducaoLigaPanel';
import TaskPerformancePanel from './components/TaskPerformancePanel';
import useReportsOverview from './hooks/useReportsOverview';
import { exportOptions, periodOptions, quickFilters } from './config/reportsConfig';
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

// As mesmas palavras de severityLabel em components/DriversPanel.jsx: o
// alerta é um driver de severidade alta ou média. Antes a severidade do
// alerta vinha só na cor; agora vai escrita para o leitor de tela.
const alertSeverityLabel = {
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa'
};

// WI-016: ausência (null, campo que não veio, erro de carga) aparece como
// "—", nunca como 0. Zero só quando o servidor contou e deu zero.
const hasNumber = (value) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
const formatCount = (value) => (hasNumber(value) ? Number(value).toLocaleString('pt-BR') : '—');
const formatPercent = (value) => (hasNumber(value) ? `${Number(value).toLocaleString('pt-BR')}%` : '—');

const formatDay = (day) => {
  const [year, month, date] = String(day || '').split('-');
  return year && month && date ? `${date}/${month}/${year}` : '';
};

const formatPeriod = (period) => (
  period?.startDate && period?.endDate ? `${formatDay(period.startDate)} a ${formatDay(period.endDate)}` : ''
);

// Tendência só dos indicadores de fluxo, contra o período anterior de mesmo
// tamanho. A direção vai escrita; sem base (anterior zero ou ausente), não
// há seta, e a frase diz por quê.
const formatTrend = (trend) => {
  if (!trend || typeof trend !== 'object') return undefined;
  if (!trend.direction) {
    return {
      direction: 'none',
      label: Number(trend.previous) === 0 ? 'Sem base: nenhum registro no período anterior' : 'Sem base de comparação'
    };
  }
  const previous = formatCount(trend.previous);
  if (trend.direction === 'flat') return { direction: 'flat', label: `Igual ao período anterior (${previous})` };
  const variacao = `${Math.abs(Number(trend.deltaPercent)).toLocaleString('pt-BR')}%`;
  return {
    direction: trend.direction,
    label: trend.direction === 'up'
      ? `Alta de ${variacao} sobre o período anterior (${previous})`
      : `Queda de ${variacao} sobre o período anterior (${previous})`
  };
};

const ReportsPage = () => {
  const { user, capabilities } = useAuth();
  const canViewTaskPerformance = ['admin', 'coordenacao'].includes(String(user?.role || '').trim().toLowerCase());
  // Só quem tem leitura detalhada (admin e coordenação) escolhe a
  // anonimização; para os demais o servidor sempre exporta agregado.
  const canChooseAnonymize = Boolean(capabilities?.gestao?.relatorios?.detalhado);
  // A aba abre com relatorios.exportacao ou relatorios.perfilAtletas (WI-016,
  // decisão de 12/10/2026). Sem a exportação (coord_atendimento), a tela não
  // pede indicadores, correlações, exportação nem tarefas, que dariam 403, e
  // mostra só o Perfil dos atletas.
  const canViewIndicators = Boolean(capabilities?.gestao?.relatorios?.exportacao);
  const [refreshKey, setRefreshKey] = useState(0);
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

  const {
    overview,
    correlations,
    isLoading,
    loadError,
    correlationsError,
    autoRefreshIntervalMs,
    reload
  } = useReportsOverview({
    range: dateRange,
    projectId: selectedProjectId,
    notify,
    habilitado: canViewIndicators
  });

  const metricDefinitions = useMemo(() => (
    overview?.metricDefinitions && typeof overview.metricDefinitions === 'object'
      ? overview.metricDefinitions
      : {}
  ), [overview?.metricDefinitions]);

  // A descrição de cada cartão é a definição do servidor (o que o número
  // conta); o texto local só vale para resposta antiga, sem definição.
  const getMetricDescription = useCallback((key, fallback) => {
    const description = String(metricDefinitions[key]?.description || '').trim();
    return description || fallback;
  }, [metricDefinitions]);

  const periodText = useMemo(() => formatPeriod(overview.period), [overview.period]);
  const previousPeriodText = useMemo(() => formatPeriod(overview.previousPeriod), [overview.previousPeriod]);
  const periodLabel = periodOptions.find((option) => option.value === dateRange)?.label || 'Período';

  // Situação atual: o cadastro agora, sem período.
  const currentCards = useMemo(() => {
    const metrics = overview.metrics || {};
    return [
      {
        title: 'Alunos com atleta',
        value: formatCount(metrics.totalAlunos),
        icon: Users,
        description: getMetricDescription('totalAlunos', 'Alunos distintos responsáveis por ao menos um atleta do escopo.')
      },
      {
        title: 'Supervisores com atleta',
        value: formatCount(metrics.professores),
        icon: GraduationCap,
        description: getMetricDescription('professores', 'Professores e profissionais distintos que supervisionam ao menos um atleta do escopo.')
      },
      {
        title: 'Atletas cadastrados',
        value: formatCount(metrics.totalPacientes),
        icon: Users,
        description: getMetricDescription('totalPacientes', 'Atletas cadastrados no escopo, em qualquer situação.')
      },
      {
        title: 'Atletas com aluno responsável',
        value: formatPercent(metrics.taxaVinculacao),
        icon: Link2,
        description: getMetricDescription('taxaVinculacao', 'Parte dos atletas cadastrados que tem aluno responsável definido.')
      }
    ];
  }, [getMetricDescription, overview.metrics]);

  // No período: só os dias do filtro. Os quatro primeiros comparam com o
  // período anterior; as taxas, não.
  const periodCards = useMemo(() => {
    const metrics = overview.metrics || {};
    const trends = overview.trends || {};
    return [
      {
        title: 'Avaliações',
        value: formatCount(metrics.avaliacoesPeriodo),
        icon: BarChart3,
        trend: formatTrend(trends.avaliacoesPeriodo),
        description: getMetricDescription('avaliacoesPeriodo', 'Avaliações registradas nos dias do período.')
      },
      {
        title: 'Atendimentos realizados',
        value: formatCount(metrics.atendimentosRealizados),
        icon: CalendarCheck,
        trend: formatTrend(trends.atendimentosRealizados),
        description: getMetricDescription('atendimentosRealizados', 'Consultas do período registradas como realizadas.')
      },
      {
        title: 'Novos atletas',
        value: formatCount(metrics.novosAtletas),
        icon: UserPlus,
        trend: formatTrend(trends.novosAtletas),
        description: getMetricDescription('novosAtletas', 'Atletas cadastrados nos dias do período.')
      },
      {
        title: 'Retornos',
        value: formatCount(metrics.retornos),
        icon: RotateCcw,
        trend: formatTrend(trends.retornos),
        description: getMetricDescription('retornos', 'Atletas avaliados no período que já tinham outra avaliação.')
      },
      {
        title: 'Taxa de retorno',
        value: formatPercent(metrics.retencao),
        icon: TrendingUp,
        description: getMetricDescription('retencao', 'Parte dos atletas avaliados no período que eram retorno.')
      },
      {
        // Antes "Qualidade operacional", com a métrica "Satisfação estimada"
        // (0 a 5): as duas eram a taxa de consultas realizadas. O cartão
        // agora diz o que mede (WI-016).
        title: 'Consultas realizadas',
        value: formatPercent(metrics.completionRate),
        icon: ClipboardCheck,
        description: getMetricDescription('completionRate', 'Parte das consultas marcadas para o período que foi realizada.')
      },
      {
        title: 'Avaliações completas',
        value: formatPercent(metrics.integridade),
        icon: ShieldCheck,
        description: getMetricDescription('integridade', 'Parte das avaliações do período com completude de 80% ou mais.')
      }
    ];
  }, [getMetricDescription, overview.metrics, overview.trends]);

  const usageData = useMemo(() => {
    const items = Array.isArray(overview.usageByType) ? overview.usageByType : [];
    return items.map((item) => ({
      label: item.label,
      value: hasNumber(item.percentage) ? Number(item.percentage) : null,
      count: hasNumber(item.count) ? Number(item.count) : null,
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
      : { patients: null, evaluations: null, appointments: null }
  ), [correlations?.dataset]);

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const filterCards = useCallback((cards) => {
    if (!normalizedSearch) return cards;
    return cards.filter((item) => (
      item.title.toLowerCase().includes(normalizedSearch)
      || item.description.toLowerCase().includes(normalizedSearch)
    ));
  }, [normalizedSearch]);

  const visibleCurrentCards = useMemo(() => filterCards(currentCards), [currentCards, filterCards]);
  const visiblePeriodCards = useMemo(() => filterCards(periodCards), [filterCards, periodCards]);

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
            anonymize: canChooseAnonymize ? anonymize : true,
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
    canChooseAnonymize,
    dateRange,
    notify,
    projects,
    selectedProjectId
  ]);

  // Atualizar também recarrega o perfil e a produção: a `key` nova remonta os
  // dois painéis, que pedem os dados de novo.
  const handleRefresh = useCallback(() => {
    if (canViewIndicators) reload();
    setRefreshKey((value) => value + 1);
  }, [canViewIndicators, reload]);

  const isExecutiveView = viewMode === 'all' || viewMode === 'executive';
  const isOperationalView = viewMode === 'all' || viewMode === 'operational';
  const isAnalyticsView = viewMode === 'all' || viewMode === 'analytics';

  const renderStatCards = (cards, visibleCards) => (
    <div className="stats-grid" aria-busy={isLoading || undefined}>
      {isLoading
        ? cards.map((card) => (
          <div key={`skeleton-${card.title}`} className="report-skeleton-card" aria-hidden="true" />
        ))
        : visibleCards.map((card, index) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1, duration: 0.5 }}
          >
            <StatCard {...card} />
          </motion.div>
        ))}
      {!isLoading && visibleCards.length === 0 && (
        <div className="reports-empty-state laines-feedback-state">
          Nenhum indicador encontrado para a busca atual.
        </div>
      )}
    </div>
  );

  // Só o perfil dos atletas: período e Atualizar, sem busca, recorte de
  // projeto (o servidor usa o projeto da pessoa) nem exportação.
  if (!canViewIndicators) {
    return (
      <MotionConfig reducedMotion="user">
      <div className="reports-container">
        <ReportsHeader
          isLoading={false}
          onRefresh={handleRefresh}
          subtitle="Perfil agregado dos atletas atendidos, sempre em grupo e nunca por pessoa."
        />

        <div className="reports-view-switch" role="group" aria-label="Período de análise">
          {periodOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`view-switch-btn ${dateRange === option.value ? 'active' : ''}`}
              onClick={() => setDateRange(option.value)}
              aria-pressed={dateRange === option.value}
            >
              {option.label}
            </button>
          ))}
        </div>

        <PerfilAtletasPanel
          key={`perfil-${refreshKey}`}
          range={dateRange}
          projectId={selectedProjectId}
          capabilities={capabilities}
        />
      </div>
      </MotionConfig>
    );
  }

  // MotionConfig: com "reduzir movimento" no sistema, as entradas do
  // framer-motion (cabeçalho, indicadores, trimestres, exportação) não
  // deslocam nada; só a opacidade continua.
  return (
    <MotionConfig reducedMotion="user">
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

      <div className="reports-view-switch" role="group" aria-label="Modo de leitura">
        {viewOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`view-switch-btn ${viewMode === option.id ? 'active' : ''}`}
            onClick={() => setViewMode(option.id)}
            aria-pressed={viewMode === option.id}
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
        canChooseAnonymize={canChooseAnonymize}
        onClose={() => setShowFilters(false)}
      />

      {!isLoading && loadError && (
        <div className="reports-empty-state laines-feedback-state" role="alert">
          Não foi possível carregar os indicadores. Os números aparecem como “—” até a próxima atualização.
        </div>
      )}

      {/* A base analisada com as peças da Visão geral. Os três números são
          do mesmo período: atletas com avaliação ou consulta nele, e as
          avaliações e consultas dele. */}
      <PainelVisaoGeral className="reports-dataset-strip">
        <PainelIndicadores
          rotulo={periodText ? `Base analisada (${periodText})` : 'Base analisada'}
          itens={[
            { id: 'patients', rotulo: 'Atletas com atividade no período', valor: formatCount(dataset.patients) },
            { id: 'evaluations', rotulo: 'Avaliações no período', valor: formatCount(dataset.evaluations) },
            { id: 'appointments', rotulo: 'Consultas no período', valor: formatCount(dataset.appointments) }
          ]}
        />
      </PainelVisaoGeral>

      {visibleAlerts.length > 0 && (
        <section className="reports-alerts-strip" aria-label="Alertas">
          {visibleAlerts.slice(0, 3).map((alert) => (
            <article key={alert.id} className={`reports-alert alert-${alert.severity || 'low'}`}>
              <AlertTriangle size={14} />
              <div>
                <span className="reports-sr">
                  {`Severidade ${(alertSeverityLabel[alert.severity] || alertSeverityLabel.low).toLowerCase()}: `}
                </span>
                <strong>{alert.title}</strong>
                <p>{alert.recommendation}</p>
                {hasNumber(alert.sampleSize) && (
                  <p className="reports-alert-amostra">
                    {`n = ${formatCount(alert.sampleSize)}${alert.sampleUnit ? ` ${alert.sampleUnit}` : ''}`}
                  </p>
                )}
              </div>
            </article>
          ))}
        </section>
      )}

      {isExecutiveView && (
        <section className="reports-section">
          <header className="reports-section-header">
            <h3>Situação atual</h3>
            <p>O cadastro agora, no escopo do projeto. Não muda com o período escolhido.</p>
          </header>
          {renderStatCards(currentCards, visibleCurrentCards)}
        </section>
      )}

      {isExecutiveView && (
        <section className="reports-section">
          <header className="reports-section-header">
            <h3>No período</h3>
            <p>
              {periodText
                ? `${periodLabel}: ${periodText}, no horário de Brasília. A tendência compara com ${previousPeriodText}, com o mesmo número de dias.`
                : `${periodLabel}, no horário de Brasília.`}
            </p>
          </header>
          {renderStatCards(periodCards, visiblePeriodCards)}
        </section>
      )}

      {isOperationalView && (
        <section className="reports-section">
          <header className="reports-section-header">
            <h3>Análise operacional</h3>
            <p>Uso por categoria e trimestres do período, para a rotina da equipe.</p>
          </header>
          <div className="charts-export-grid operational-only-grid">
            <UsagePanel
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
              generatedAt={overview.generatedAt}
              periodText={periodText}
              visibleUsageData={visibleUsageData}
            />
            <QuarterlyPanel quarterlyData={quarterlyData} />
          </div>
        </section>
      )}

      {isOperationalView && canViewTaskPerformance && <TaskPerformancePanel />}

      {/* Depois da direção e do atendimento, o perfil dos atletas (direção e
          atendimento) e a produção da liga (direção). Cada painel confere a
          própria capacidade e não pede nada sem ela. */}
      {(isExecutiveView || isOperationalView) && (
        <PerfilAtletasPanel
          key={`perfil-${refreshKey}`}
          range={dateRange}
          projectId={selectedProjectId}
          capabilities={capabilities}
        />
      )}

      {isExecutiveView && (
        <ProducaoLigaPanel
          key={`producao-${refreshKey}`}
          range={dateRange}
          capabilities={capabilities}
        />
      )}

      {isAnalyticsView && (
        <section className="reports-section">
          <header className="reports-section-header">
            <h3>Drivers e tomada de decisão</h3>
            <p>Fatores associados e detalhamento para orientar ações concretas.</p>
          </header>
          <DriversPanel correlations={correlations} loadError={correlationsError} />
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
            canChooseAnonymize={canChooseAnonymize}
            periodText={periodText}
          />
        </div>
      </section>

      <ReportsInfoFooter
        generatedAt={overview.generatedAt}
        autoRefreshMinutes={Math.round(autoRefreshIntervalMs / 60000)}
        hasAutoRefresh
      />
    </div>
    </MotionConfig>
  );
};

export default ReportsPage;

