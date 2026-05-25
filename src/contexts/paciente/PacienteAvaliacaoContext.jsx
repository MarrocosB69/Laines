/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useMemo } from 'react';
import api, { getApiErrorMessage } from '../../services/api';
import { logAudit } from '../../services/audit';
import { useAuth } from '../AuthContext';
import { useUiFeedback } from '../UiFeedbackContext';
import { buildAvaliacaoMeta } from './pacienteUtils';

const PacienteAvaliacaoContext = createContext(null);

const normalizeAvaliacaoTipo = (value) => (
  String(value || '').trim().toLowerCase().replace(/-/g, '_')
);

const getComparableDate = (item) => {
  const value = item?.updatedAt || item?.createdAt || item?.data || '';
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.getTime() : 0;
};

const findExistingAvaliacaoForPayload = async (payload) => {
  const pacienteId = String(payload?.pacienteId || '').trim();
  const tipo = normalizeAvaliacaoTipo(payload?.tipo);
  if (!pacienteId || !tipo) return null;

  const { data } = await api.get('/avaliacoes', {
    params: { pacienteId, tipo, limit: 50 }
  });
  const rows = Array.isArray(data) ? data : [];
  const sameTypeRows = rows.filter((item) => normalizeAvaliacaoTipo(item?.tipo) === tipo);
  if (sameTypeRows.length === 0) return null;

  const sessaoId = String(payload?.sessaoId || '').trim();
  const candidates = sessaoId
    ? sameTypeRows.filter((item) => String(item?.sessaoId || '').trim() === sessaoId)
    : sameTypeRows.filter((item) => String(item?.status || '').toLowerCase() !== 'finalizada');
  const pool = candidates.length > 0 ? candidates : sameTypeRows;

  return [...pool].sort((a, b) => getComparableDate(b) - getComparableDate(a))[0] || null;
};

export const PacienteAvaliacaoProvider = ({ children }) => {
  const { user } = useAuth();
  const { notify } = useUiFeedback();

  const salvarAvaliacao = useCallback(async (avaliacaoData) => {
    const meta = buildAvaliacaoMeta(avaliacaoData);
    const payload = {
      ...avaliacaoData,
      meta
    };
    if (user?.isAluno) {
      payload.alunoId = user?.uid || user?.id || null;
    }
    try {
      const { data } = await api.post('/avaliacoes', payload);
      logAudit({
        user,
        action: 'avaliacao_create',
        entity: 'avaliacoes',
        entityId: data?.id,
        meta: {
          pacienteId: avaliacaoData?.pacienteId || null,
          tipo: avaliacaoData?.tipo || null,
          projetoId: avaliacaoData?.projetoId || null
        }
      });
      return data?.id;
    } catch (err) {
      let recoveryErrorToReport = null;
      if (err?.response?.status === 409) {
        try {
          const existing = await findExistingAvaliacaoForPayload(payload);
          const existingStatus = String(existing?.status || '').toLowerCase();
          const payloadStatus = String(payload?.status || '').toLowerCase();
          const hasExplicitSession = String(payload?.sessaoId || '').trim().length > 0;
          const isAutosaveFinalizedConflict = avaliacaoData?.autoSave
            && existingStatus === 'finalizada';
          const wouldReopenFinalized = existingStatus === 'finalizada' && payloadStatus !== 'finalizada';
          const couldBePreviousSession = existingStatus === 'finalizada' && !hasExplicitSession;
          if (existing?.id && !isAutosaveFinalizedConflict && !wouldReopenFinalized && !couldBePreviousSession) {
            const { data } = await api.patch(`/avaliacoes/${existing.id}`, payload);
            logAudit({
              user,
              action: 'avaliacao_update_after_create_conflict',
              entity: 'avaliacoes',
              entityId: existing.id,
              meta: {
                pacienteId: avaliacaoData?.pacienteId || null,
                tipo: avaliacaoData?.tipo || null,
                projetoId: avaliacaoData?.projetoId || null,
                sessaoId: avaliacaoData?.sessaoId || existing?.sessaoId || null
              }
            });
            return data?.id || existing.id;
          }
        } catch (recoveryError) {
          recoveryErrorToReport = recoveryError;
          console.error('Erro ao recuperar rascunho existente:', recoveryError);
        }
      }
      console.error('Erro ao salvar avaliação:', err);
      const isConflict = err?.response?.status === 409;
      const reportedError = recoveryErrorToReport || err;
      notify({
        type: 'error',
        title: isConflict ? 'Avaliação já existe nesta sessão' : 'Erro ao salvar avaliação',
        message: isConflict
          ? getApiErrorMessage(reportedError, 'Já existe uma avaliação deste tipo nesta sessão. Continue preenchendo pelo rascunho já criado.')
          : getApiErrorMessage(reportedError, 'Não foi possível salvar a avaliação.')
      });
      throw reportedError;
    }
  }, [notify, user]);

  const updateAvaliacao = useCallback(async (id, avaliacaoData) => {
    try {
      if (!id) return false;
      const meta = buildAvaliacaoMeta(avaliacaoData);
      const payload = {
        ...avaliacaoData,
        meta
      };
      await api.patch(`/avaliacoes/${id}`, payload);
      logAudit({
        user,
        action: 'avaliacao_update',
        entity: 'avaliacoes',
        entityId: id,
        meta: {
          pacienteId: avaliacaoData?.pacienteId || null,
          tipo: avaliacaoData?.tipo || null,
          projetoId: avaliacaoData?.projetoId || null
        }
      });
      return true;
    } catch (err) {
      console.error('Erro ao atualizar avaliação:', err);
      notify({
        type: 'error',
        title: 'Erro ao atualizar avaliação',
        message: getApiErrorMessage(err, 'Não foi possível atualizar a avaliação.')
      });
      throw err;
    }
  }, [notify, user]);

  const getAvaliacoesByPaciente = useCallback(async (pacienteId) => {
    try {
      const { data } = await api.get('/avaliacoes', { params: { pacienteId } });
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.error('Erro ao buscar avaliações:', err);
      notify({
        type: 'error',
        title: 'Erro ao buscar avaliações',
        message: getApiErrorMessage(err, 'Não foi possível carregar as avaliações.')
      });
      return [];
    }
  }, [notify]);

  const getAvaliacoesByPacientePaged = useCallback(async (pacienteId, lastDocRef, pageSize = 10) => {
    try {
      const offset = typeof lastDocRef === 'number' ? lastDocRef : 0;
      const { data } = await api.get('/avaliacoes', {
        params: { pacienteId, limit: pageSize, offset }
      });
      const items = Array.isArray(data) ? data : [];
      const nextOffset = items.length === pageSize ? offset + items.length : null;
      return { items, lastDoc: nextOffset };
    } catch (err) {
      console.error('Erro ao buscar avaliações:', err);
      notify({
        type: 'error',
        title: 'Erro ao buscar avaliações',
        message: getApiErrorMessage(err, 'Não foi possível carregar as avaliações.')
      });
      return { items: [], lastDoc: null };
    }
  }, [notify]);

  const value = useMemo(() => ({
    salvarAvaliacao,
    updateAvaliacao,
    getAvaliacoesByPaciente,
    getAvaliacoesByPacientePaged
  }), [
    salvarAvaliacao,
    updateAvaliacao,
    getAvaliacoesByPaciente,
    getAvaliacoesByPacientePaged
  ]);

  return (
    <PacienteAvaliacaoContext.Provider value={value}>
      {children}
    </PacienteAvaliacaoContext.Provider>
  );
};

export const usePacienteAvaliacao = () => {
  const context = useContext(PacienteAvaliacaoContext);
  if (!context) {
    throw new Error('usePacienteAvaliacao deve ser usado dentro de um PacienteAvaliacaoProvider');
  }
  return context;
};
