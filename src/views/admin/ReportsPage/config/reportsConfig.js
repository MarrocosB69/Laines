import { Database, FileText, Printer } from 'lucide-react';

export const exportOptions = [
  { type: 'excel', label: 'Base consolidada (CSV)', icon: FileText, color: 'export-icon-emerald' },
  { type: 'print', label: 'Imprimir painel', icon: Printer, color: 'export-icon-red' },
  { type: 'analytics', label: 'Dados analíticos (JSON)', icon: Database, color: 'export-icon-blue' },
  { type: 'csv', label: 'Dataset detalhado (CSV)', icon: Database, color: 'export-icon-purple' }
];

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
    label: 'Último trimestre',
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
