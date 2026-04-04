import { useCallback, useEffect, useState } from 'react';
import api, { getApiErrorMessage } from '../../../../services/api';

const AUTO_REFRESH_INTERVAL_MS = 15 * 60 * 1000;

const emptyOverview = {
  generatedAt: null,
  filters: {
    range: 'month',
    projectId: 'all'
  },
  projects: [],
  metrics: {
    totalAlunos: 0,
    professores: 0,
    totalPacientes: 0,
    avaliacoesPeriodo: 0,
    taxaVinculacao: 0,
    integridade: 0,
    completionRate: 0,
    satisfacao: 0,
    retencao: 0
  },
  usageByType: [],
  quarterly: [],
  metricDefinitions: {}
};

const emptyCorrelations = {
  generatedAt: null,
  filters: {
    projectId: 'all'
  },
  dataset: {
    patients: 0,
    evaluations: 0,
    appointments: 0
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

export const useReportsOverview = ({ range, projectId, notify }) => {
  const [overview, setOverview] = useState(emptyOverview);
  const [correlations, setCorrelations] = useState(emptyCorrelations);
  const [isLoading, setIsLoading] = useState(true);

  const loadOverview = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh) setIsLoading(true);
    try {
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
        }).catch(() => ({ data: emptyCorrelations }))
      ]);
      const data = overviewRes.data;
      setOverview({
        ...emptyOverview,
        ...(data || {}),
        metrics: {
          ...emptyOverview.metrics,
          ...((data && data.metrics) || {})
        },
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
    } catch (error) {
      setOverview(emptyOverview);
      setCorrelations(emptyCorrelations);
      notify?.({
        type: 'error',
        title: 'Erro ao carregar relatorios',
        message: getApiErrorMessage(error, 'Não foi possível carregar o resumo analítico.')
      });
    } finally {
      setIsLoading(false);
    }
  }, [notify, projectId, range]);

  useEffect(() => {
    loadOverview(false);
  }, [loadOverview]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      loadOverview(true);
    }, AUTO_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [loadOverview]);

  return {
    overview,
    correlations,
    isLoading,
    autoRefreshIntervalMs: AUTO_REFRESH_INTERVAL_MS,
    reload: () => loadOverview(true)
  };
};

export default useReportsOverview;
