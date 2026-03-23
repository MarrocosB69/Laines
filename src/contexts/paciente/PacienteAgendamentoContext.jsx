/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useMemo } from 'react';
import api, { getApiErrorMessage } from '../../services/api';
import { logAudit } from '../../services/audit';
import { useAuth } from '../AuthContext';
import { useUiFeedback } from '../UiFeedbackContext';

const PacienteAgendamentoContext = createContext(null);

export const PacienteAgendamentoProvider = ({ children }) => {
  const { user } = useAuth();
  const { notify } = useUiFeedback();

  const criarAgendamento = useCallback(async (agendamentoData) => {
    try {
      const payload = {
        ...agendamentoData,
        alunoId: user?.uid || null,
        alunoNome: user?.name || user?.email || 'Aluno'
      };
      const { data } = await api.post('/agendamentos', payload);
      logAudit({
        user,
        action: 'agendamento_create',
        entity: 'agendamentos',
        entityId: data?.id,
        meta: { pacienteId: agendamentoData?.pacienteId || null }
      });
      return data?.id;
    } catch (err) {
      console.error('Erro ao criar agendamento:', err);
      notify({
        type: 'error',
        title: 'Erro ao criar agendamento',
        message: getApiErrorMessage(err, 'Não foi possível criar o agendamento.')
      });
      throw err;
    }
  }, [notify, user]);

  const updateAgendamento = useCallback(async (id, agendamentoData) => {
    try {
      await api.patch(`/agendamentos/${id}`, agendamentoData);
      logAudit({
        user,
        action: 'agendamento_update',
        entity: 'agendamentos',
        entityId: id,
        meta: { pacienteId: agendamentoData?.pacienteId || null }
      });
      return true;
    } catch (err) {
      console.error('Erro ao atualizar agendamento:', err);
      notify({
        type: 'error',
        title: 'Erro ao atualizar agendamento',
        message: getApiErrorMessage(err, 'Não foi possível atualizar o agendamento.')
      });
      throw err;
    }
  }, [notify, user]);

  const remarcarAgendamento = useCallback(async (id, payload) => {
    try {
      const { data } = await api.post(`/agendamentos/${id}/remarcar`, payload);
      logAudit({
        user,
        action: 'agendamento_reschedule',
        entity: 'agendamentos',
        entityId: id,
        meta: {
          newDate: payload?.date || null,
          newTime: payload?.time || null
        }
      });
      return data;
    } catch (err) {
      console.error('Erro ao remarcar agendamento:', err);
      notify({
        type: 'error',
        title: 'Erro ao remarcar consulta',
        message: getApiErrorMessage(err, 'Não foi possível remarcar o agendamento.')
      });
      throw err;
    }
  }, [notify, user]);

  const value = useMemo(() => ({
    criarAgendamento,
    updateAgendamento,
    remarcarAgendamento
  }), [criarAgendamento, updateAgendamento, remarcarAgendamento]);

  return (
    <PacienteAgendamentoContext.Provider value={value}>
      {children}
    </PacienteAgendamentoContext.Provider>
  );
};

export const usePacienteAgendamento = () => {
  const context = useContext(PacienteAgendamentoContext);
  if (!context) {
    throw new Error('usePacienteAgendamento deve ser usado dentro de um PacienteAgendamentoProvider');
  }
  return context;
};
