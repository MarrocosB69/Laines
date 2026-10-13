import { useCallback, useEffect, useState } from 'react';
import api, { getApiErrorMessage } from '../../../../services/api';

const AUTO_REFRESH_INTERVAL_MS = 15 * 60 * 1000;

// Sem resposta do servidor, os números ficam null e a tela mostra "—": um
// erro de carga não pode aparecer como zero (WI-016).
const emptyOverview = {
  generatedAt: null,
  filters: {
    range: 'month',
    projectId: 'all'
  },
  period: null,
  previousPeriod: null,
  projects: [],
  metrics: {
    totalAlunos: null,
    professores: null,
    totalPacientes: null,
    avaliacoesPeriodo: null,
    taxaVinculacao: null,
    integridade: null,
    completionRate: null,
    satisfacao: null,
    retencao: null,
    atendimentosRealizados: null,
    novosAtletas: null,
    retornos: null,
    atletasAvaliados: null
  },
  trends: {},
  usageByType: [],
  quarterly: [],
  metricDefinitions: {}
};

const emptyCorrelations = {
  generatedAt: null,
  filters: {
    projectId: 'all'
  },
  period: null,
  dataset: {
    patients: null,
    evaluations: null,
    appointments: null
  },
  absenteeism: {
    byTurn: [],
    byLeadTime: [],
    byAppointmentType: [],
    byProject: [],
    byResponsible: []
  },
  completeness: {
    spearmanFrequency: { coefficient: null, sampleSize: 0, interpretation: 'Sem dados' },
    byEvaluationType: [],
    byProject: [],
    byResponsible: []
  },
  retention: {
    byConsultInterval: [],
    byProject: [],
    byResponsible: []
  },
  drivers: [],
  alerts: []
};

// Sem `habilitado` (perfil sem relatorios.exportacao, WI-016), nada é pedido:
// nem indicadores, nem correlações, nem a atualização automática. O servidor
// responderia 403 a todos.
export const useReportsOverview = ({ range, projectId, notify, habilitado = true }) => {
  const [overview, setOverview] = useState(emptyOverview);
  const [correlations, setCorrelations] = useState(emptyCorrelations);
  const [isLoading, setIsLoading] = useState(habilitado);
  const [loadError, setLoadError] = useState(false);
  const [correlationsError, setCorrelationsError] = useState(false);

  const loadOverview = useCallback(async (forceRefresh = false) => {
    if (!habilitado) {
      setIsLoading(false);
      return;
    }
    if (!forceRefresh) setIsLoading(true);
    try {
      let correlationsFailed = false;
      const [overviewRes, correlationsRes] = await Promise.all([
        api.get('/analytics/reports/overview', {
          params: {
            range,
            projectId,
            forceRefresh
          }
        }),
        api.get('/analytics/correlations', {
          params: {
            range,
            projectId,
            forceRefresh
          }
        }).catch(() => {
          correlationsFailed = true;
          return { data: emptyCorrelations };
        })
      ]);
      const data = overviewRes.data;
      setOverview({
        ...emptyOverview,
        ...(data || {}),
        metrics: {
          ...emptyOverview.metrics,
          ...((data && data.metrics) || {})
        },
        trends: data?.trends && typeof data.trends === 'object' ? data.trends : {},
        usageByType: Array.isArray(data?.usageByType) ? data.usageByType : [],
        quarterly: Array.isArray(data?.quarterly) ? data.quarterly : [],
        projects: Array.isArray(data?.projects) ? data.projects : [],
        metricDefinitions: data?.metricDefinitions && typeof data.metricDefinitions === 'object'
          ? data.metricDefinitions
          : {}
      });
      const correlationData = correlationsRes?.data || emptyCorrelations;
      setCorrelations({
        ...emptyCorrelations,
        ...correlationData
      });
      setLoadError(false);
      setCorrelationsError(correlationsFailed);
    } catch (error) {
      setOverview(emptyOverview);
      setCorrelations(emptyCorrelations);
      setLoadError(true);
      setCorrelationsError(true);
      notify?.({
        type: 'error',
        title: 'Erro ao carregar relatórios',
        message: getApiErrorMessage(error, 'Não foi possível carregar o resumo analítico.')
      });
    } finally {
      setIsLoading(false);
    }
  }, [habilitado, notify, projectId, range]);

  useEffect(() => {
    loadOverview(false);
  }, [loadOverview]);

  useEffect(() => {
    if (!habilitado) return undefined;
    const intervalId = window.setInterval(() => {
      loadOverview(true);
    }, AUTO_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [habilitado, loadOverview]);

  return {
    overview,
    correlations,
    isLoading,
    loadError,
    correlationsError,
    autoRefreshIntervalMs: AUTO_REFRESH_INTERVAL_MS,
    reload: () => loadOverview(true)
  };
};

export default useReportsOverview;
