import { Database, FileText, Printer } from 'lucide-react';

export const exportOptions = [
  { type: 'excel', label: 'Base consolidada (CSV)', icon: FileText, color: 'export-icon-emerald' },
  { type: 'print', label: 'Imprimir painel', icon: Printer, color: 'export-icon-red' },
  { type: 'analytics', label: 'Dados analíticos (JSON)', icon: Database, color: 'export-icon-blue' },
  { type: 'csv', label: 'Dataset detalhado (CSV)', icon: Database, color: 'export-icon-purple' }
];

// Os mesmos períodos do servidor (resolveReportPeriods, analytics.service.ts),
// no calendário de Brasília e sempre até hoje: "Este mês" começa no dia 1º.
export const periodOptions = [
  { value: 'week', label: 'Últimos 7 dias' },
  { value: 'month', label: 'Este mês' },
  { value: 'quarter', label: 'Este trimestre' },
  { value: 'year', label: 'Este ano' }
];

// Mesmo limite do servidor (MIN_HIGHLIGHT_SAMPLE, analytics.service.ts): um
// grupo menor que isso não vira destaque nem alerta; no detalhe, aparece com
// o aviso "amostra pequena". `smallSample` vem do servidor; o cálculo local
// só cobre resposta antiga, sem o campo.
export const MIN_HIGHLIGHT_SAMPLE = 5;

export const isSmallSample = (row) => (
  typeof row?.smallSample === 'boolean'
    ? row.smallSample
    : Number(row?.sampleSize || 0) < MIN_HIGHLIGHT_SAMPLE
);

export const quickFilters = [
  {
    id: 'visao_geral',
    label: 'Geral',
    preset: {
      range: 'month',
      projectId: 'all',
      anonymize: true,
      searchQuery: ''
    }
  },
  {
    id: 'ultimos_7_dias',
    label: 'Últimos 7 dias',
    preset: {
      range: 'week',
      projectId: 'all',
      anonymize: true,
      searchQuery: ''
    }
  },
  {
    id: 'trimestre',
    label: 'Este trimestre',
    preset: {
      range: 'quarter',
      projectId: 'all',
      anonymize: true,
      searchQuery: ''
    }
  },
  {
    id: 'sem_projeto',
    label: 'Somente sem projeto',
    preset: {
      range: 'month',
      projectId: 'sem',
      anonymize: true,
      searchQuery: ''
    }
  }
];
