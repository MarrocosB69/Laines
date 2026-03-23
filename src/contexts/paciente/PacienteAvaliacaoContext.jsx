/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useMemo } from 'react';
import api, { getApiErrorMessage } from '../../services/api';
import { logAudit } from '../../services/audit';
import { useAuth } from '../AuthContext';
import { useUiFeedback } from '../UiFeedbackContext';
import { buildAvaliacaoMeta } from './pacienteUtils';

const PacienteAvaliacaoContext = createContext(null);

export const PacienteAvaliacaoProvider = ({ children }) => {
  const { user } = useAuth();
  const { notify } = useUiFeedback();

  const salvarAvaliacao = useCallback(async (avaliacaoData) => {
    try {
      const meta = buildAvaliacaoMeta(avaliacaoData);
      const payload = {
        ...avaliacaoData,
        meta,
        alunoId: user?.uid || null
      };
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
      console.error('Erro ao salvar avaliação:', err);
      notify({
        type: 'error',
        title: 'Erro ao salvar avaliação',
        message: getApiErrorMessage(err, 'Não foi possível salvar a avaliação.')
      });
      throw err;
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
