import { useState, useEffect, useMemo } from 'react';
import api from '../services/api';

/**
 * Hook centralizado do prontuário do atleta.
 * Todos os fetches em paralelo via Promise.all — nenhum fetch sequencial.
 * Derivados via useMemo.
 *
 * @param {string|null} pacienteId
 * @returns {{ avaliacoes, avaliacoesOrdenadas, avaliacoesPorTipo, ultimaAvaliacaoPorTipo,
 *             planoAtivo, mensagemProfessor, loading, sectionErrors, setAvaliacoes }}
 */
export const useProntuario = (pacienteId) => {
  const [avaliacoes, setAvaliacoes] = useState([]);
  const [planoAtivo, setPlanoAtivo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sectionErrors, setSectionErrors] = useState({});

  useEffect(() => {
    if (!pacienteId) {
      setAvaliacoes([]);
      setPlanoAtivo(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setSectionErrors({});

    const safeResolve = (promise, fallback, key) =>
      promise.catch((err) => {
        setSectionErrors((prev) => ({
          ...prev,
          [key]: String(err?.response?.data?.message || err?.message || 'Erro ao carregar'),
        }));
        return fallback;
      });

    const pAvaliacoes = safeResolve(
      api
        .get('/avaliacoes', { params: { pacienteId, limit: 200 } })
        .then((r) => {
          const raw = r.data;
          if (Array.isArray(raw)) return raw;
          if (Array.isArray(raw?.items)) return raw.items;
          return [];
        }),
      [],
      'avaliacoes'
    );

    const pPlano = safeResolve(
      api
        .get('/planos-alimentares', { params: { pacienteId, status: 'ativo' } })
        .then((r) => {
          const raw = r.data;
          const arr = Array.isArray(raw) ? raw : [];
          return arr[0] ?? null;
        }),
      null,
      'plano'
    );

    Promise.all([pAvaliacoes, pPlano]).then(([av, plano]) => {
      setAvaliacoes(av);
      setPlanoAtivo(plano);
      setLoading(false);
    });
  }, [pacienteId]);

  const avaliacoesOrdenadas = useMemo(
    () =>
      [...avaliacoes].sort((a, b) => {
        const aT = new Date(a.createdAt || a.data || 0).getTime();
        const bT = new Date(b.createdAt || b.data || 0).getTime();
        return bT - aT;
      }),
    [avaliacoes]
  );

  const avaliacoesPorTipo = useMemo(
    () =>
      avaliacoes.reduce((acc, av) => {
        const t = av.tipo || 'sem_tipo';
        if (!acc[t]) acc[t] = [];
        acc[t].push(av);
        return acc;
      }, {}),
    [avaliacoes]
  );

  /** Última avaliação de cada tipo, ordenada por data desc */
  const ultimaAvaliacaoPorTipo = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(avaliacoesPorTipo).map(([tipo, list]) => [
          tipo,
          list
            .slice()
            .sort(
              (a, b) =>
                new Date(b.createdAt || b.data || 0) -
                new Date(a.createdAt || a.data || 0)
            )[0],
        ])
      ),
    [avaliacoesPorTipo]
  );

  return {
    avaliacoes,
    avaliacoesOrdenadas,
    avaliacoesPorTipo,
    ultimaAvaliacaoPorTipo,
    planoAtivo,
    loading,
    sectionErrors,
    setAvaliacoes,
  };
};
