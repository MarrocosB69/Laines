/* eslint-disable react-refresh/only-export-components */
import React, { useMemo } from 'react';
import {
  PacienteCoreProvider,
  usePacienteCore
} from './paciente/PacienteCoreContext';
import {
  PacienteAvaliacaoProvider,
  usePacienteAvaliacao
} from './paciente/PacienteAvaliacaoContext';
import {
  PacienteAgendamentoProvider,
  usePacienteAgendamento
} from './paciente/PacienteAgendamentoContext';

export const PacienteProvider = ({ children }) => (
  <PacienteCoreProvider>
    <PacienteAvaliacaoProvider>
      <PacienteAgendamentoProvider>
        {children}
      </PacienteAgendamentoProvider>
    </PacienteAvaliacaoProvider>
  </PacienteCoreProvider>
);

export const usePacientes = () => {
  const core = usePacienteCore();
  const avaliacao = usePacienteAvaliacao();
  const agendamento = usePacienteAgendamento();

  return useMemo(() => ({
    ...core,
    ...avaliacao,
    ...agendamento
  }), [core, avaliacao, agendamento]);
};

export { usePacienteCore, usePacienteAvaliacao, usePacienteAgendamento };
