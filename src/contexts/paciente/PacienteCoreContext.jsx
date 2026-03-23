/* eslint-disable react-refresh/only-export-components */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';
import api, { getApiErrorMessage } from '../../services/api';
import { logAudit } from '../../services/audit';
import { useAuth } from '../AuthContext';
import { useUiFeedback } from '../UiFeedbackContext';
import { isStudentMemberRole } from '../../constants/roles';
import {
  getUserDisplayName,
  normalizeUserList,
  normalizeUserRecord
} from '../../utils/userAdapter';
import {
  convertFirebaseDate,
  formatDate,
  formatDateForFirebase,
  sanitizePacientePayload,
  UUID_REGEX
} from './pacienteUtils';

const PacienteCoreContext = createContext(null);

export const PacienteCoreProvider = ({ children }) => {
  const [pacientes, setPacientes] = useState([]);
  const [todosPacientes, setTodosPacientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filtro, setFiltro] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const { user } = useAuth();
  const { notify, confirm } = useUiFeedback();

  const calcularIdade = useCallback((dataNascimento) => {
    if (!dataNascimento) return null;

    const hoje = new Date();
    const nascimento = convertFirebaseDate(dataNascimento);
    if (!nascimento) return null;

    let idade = hoje.getFullYear() - nascimento.getFullYear();
    const mes = hoje.getMonth() - nascimento.getMonth();

    if (mes < 0 || (mes === 0 && hoje.getDate() < nascimento.getDate())) {
      idade--;
    }

    return idade;
  }, []);

  const mapPaciente = useCallback((data) => {
    if (!data) return null;
    const dataCadastro = convertFirebaseDate(data.dataCadastro);
    const dataNascimento = convertFirebaseDate(data.dataNascimento);
    const linkedAt = convertFirebaseDate(data.linkedAt);
    const createdAt = convertFirebaseDate(data.createdAt);
    const updatedAt = convertFirebaseDate(data.updatedAt);

    const alunoResponsavel = data.alunoResponsavelId
      ? { id: data.alunoResponsavelId, nome: data.alunoResponsavelNome }
      : null;
    const professorSupervisor = data.professorSupervisorId
      ? { id: data.professorSupervisorId, nome: data.professorSupervisorNome }
      : null;

    return {
      ...data,
      alunoResponsavel,
      professorSupervisor,
      dataCadastro,
      dataNascimento,
      linkedAt,
      createdAt,
      updatedAt,
      modalidade: data.modalidade || data.modalidadePrincipal || '',
      dataCadastroFormatada: formatDate(dataCadastro),
      dataNascimentoFormatada: formatDate(dataNascimento),
      idade: dataNascimento ? calcularIdade(dataNascimento) : null
    };
  }, [calcularIdade]);

  const filterPacientesByRole = useCallback((items) => {
    if (!user?.role) return items;
    if (user.role === 'aluno') {
      return items.filter((p) => {
        const isAlunoResponsavel = p.alunoResponsavelId === user.uid || p.alunoResponsavel?.id === user.uid;
        const isTeamMember = Array.isArray(p.equipeTecnicaIds) && p.equipeTecnicaIds.includes(user.uid);
        return isAlunoResponsavel || isTeamMember;
      });
    }
    return items;
  }, [user]);

  const fetchPacientes = useCallback(async () => {
    if (!user) {
      setPacientes([]);
      setTodosPacientes([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data } = await api.get('/pacientes');
      const mapped = Array.isArray(data)
        ? data.map(mapPaciente).filter(Boolean)
        : [];
      setTodosPacientes(mapped);
      setPacientes(filterPacientesByRole(mapped));
      setLoading(false);
    } catch (err) {
      console.error('Erro ao carregar pacientes:', err);
      setError('Erro ao carregar pacientes. Tente novamente.');
      notify({
        type: 'error',
        title: 'Erro ao carregar pacientes',
        message: getApiErrorMessage(err, 'Não foi possível carregar os pacientes. Tente novamente.')
      });
      setLoading(false);
    }
  }, [filterPacientesByRole, mapPaciente, notify, user]);

  useEffect(() => {
    fetchPacientes();
  }, [fetchPacientes]);

  const pacientesFiltrados = useMemo(() => {
    let filtered = pacientes.filter((p) => {
      const searchTerm = filtro.toLowerCase();
      const nomeMatch = p.nome?.toLowerCase().includes(searchTerm);
      const cpfMatch = p.cpf?.replace(/\D/g, '').includes(filtro.replace(/\D/g, ''));
      const alunoMatch = p.alunoResponsavel?.nome?.toLowerCase().includes(searchTerm);

      return nomeMatch || cpfMatch || alunoMatch;
    });

    if (statusFilter !== 'all') {
      filtered = filtered.filter((p) => p.status === statusFilter);
    }

    return filtered;
  }, [pacientes, filtro, statusFilter]);

  const getPacienteById = useCallback(async (id) => {
    try {
      const { data } = await api.get(`/pacientes/${id}`);
      return mapPaciente(data);
    } catch (err) {
      console.error('Erro ao buscar paciente:', err);
      notify({
        type: 'error',
        title: 'Erro ao buscar paciente',
        message: getApiErrorMessage(err, 'Não foi possível obter os dados do paciente.')
      });
      throw err;
    }
  }, [mapPaciente, notify]);

  const addPaciente = useCallback(async (pacienteData) => {
    try {
      const allowedCreatorRoles = new Set([
        'admin',
        'coordenacao',
        'presidente',
        'vice',
        'coord_atendimento',
        'professor',
        'profissional',
        'pesquisador',
        'colaborador',
        'tecnico',
        'aluno'
      ]);
      if (!allowedCreatorRoles.has(user?.role)) {
        throw new Error('Seu perfil não possui permissão para cadastrar pacientes.');
      }
      const shouldAutoLinkAluno = user?.role === 'aluno' && !pacienteData.alunoResponsavel;
      const alunoResponsavel = shouldAutoLinkAluno ? {
        id: user.uid,
        nome: user.name || user.email
      } : pacienteData.alunoResponsavel || null;

      const pacienteToSave = sanitizePacientePayload({
        ...pacienteData,
        status: 'Lista de Espera',
        alunoResponsavelId: alunoResponsavel?.id || null,
        alunoResponsavelNome: alunoResponsavel?.nome || null,
        professorSupervisorId: pacienteData.professorSupervisor?.id || null,
        professorSupervisorNome: pacienteData.professorSupervisor?.nome || null
      });

      const { data } = await api.post('/pacientes', pacienteToSave);
      logAudit({
        user,
        action: 'paciente_create',
        entity: 'pacientes',
        entityId: data?.id,
        meta: {
          alunoId: alunoResponsavel?.id || null,
          professorId: pacienteToSave.professorSupervisorId || null
        }
      });
      await fetchPacientes();
      return data?.id;
    } catch (err) {
      console.error('Erro ao adicionar paciente:', err);
      notify({
        type: 'error',
        title: 'Erro ao adicionar paciente',
        message: getApiErrorMessage(err, 'Não foi possível salvar o paciente.')
      });
      throw err;
    }
  }, [fetchPacientes, notify, user]);

  const updatePaciente = useCallback(async (id, pacienteData) => {
    try {
      const payload = sanitizePacientePayload(pacienteData);

      await api.patch(`/pacientes/${id}`, payload);
      logAudit({
        user,
        action: 'paciente_update',
        entity: 'pacientes',
        entityId: id
      });
      await fetchPacientes();
      return true;
    } catch (err) {
      console.error('Erro ao atualizar paciente:', err);
      notify({
        type: 'error',
        title: 'Erro ao atualizar paciente',
        message: getApiErrorMessage(err, 'Não foi possível atualizar o paciente.')
      });
      throw err;
    }
  }, [fetchPacientes, notify, user]);

  const deletePaciente = useCallback(async (id, options = {}) => {
    try {
      if (options.requireConfirm !== false) {
        const accepted = await confirm({
          title: 'Remover paciente',
          message: 'Tem certeza que deseja remover este paciente?',
          confirmLabel: 'Remover',
          cancelLabel: 'Cancelar',
          variant: 'danger'
        });
        if (!accepted) return false;
      }

      await api.delete(`/pacientes/${id}`);
      logAudit({
        user,
        action: 'paciente_delete',
        entity: 'pacientes',
        entityId: id
      });
      await fetchPacientes();
      return true;
    } catch (err) {
      console.error('Erro ao deletar paciente:', err);
      notify({
        type: 'error',
        title: 'Erro ao remover paciente',
        message: getApiErrorMessage(err, 'Não foi possível remover o paciente.')
      });
      throw err;
    }
  }, [confirm, fetchPacientes, notify, user]);

  const fetchUserById = useCallback(async (id) => {
    if (!id) return null;
    try {
      const { data } = await api.get(`/users/${id}`);
      return normalizeUserRecord(data);
    } catch (err) {
      return null;
    }
  }, []);

  const vincularPaciente = useCallback(async (pacienteId, alunoId, professorId = null) => {
    try {
      const alunoData = await fetchUserById(alunoId);
      const candidateSupervisorId = professorId || alunoData?.supervisorId || null;
      const resolvedSupervisorId = UUID_REGEX.test(String(candidateSupervisorId || ''))
        ? String(candidateSupervisorId)
        : null;
      const professorData = resolvedSupervisorId ? await fetchUserById(resolvedSupervisorId) : null;

      await api.patch(`/pacientes/${pacienteId}`, {
        alunoResponsavelId: alunoId,
        alunoResponsavelNome: getUserDisplayName(alunoData, 'Aluno'),
        professorSupervisorId: resolvedSupervisorId,
        professorSupervisorNome: getUserDisplayName(professorData, null),
        status: 'Ativo'
      });

      logAudit({
        user,
        action: 'paciente_link',
        entity: 'pacientes',
        entityId: pacienteId,
        meta: { alunoId, professorId: resolvedSupervisorId }
      });

      await fetchPacientes();
      return true;
    } catch (err) {
      console.error('Erro ao vincular paciente:', err);
      notify({
        type: 'error',
        title: 'Erro ao vincular paciente',
        message: getApiErrorMessage(err, 'Não foi possível vincular o paciente ao aluno.')
      });
      throw err;
    }
  }, [fetchPacientes, fetchUserById, notify, user]);

  const estatisticas = useMemo(() => {
    const total = pacientes.length;
    const ativos = pacientes.filter((p) => p.status === 'Ativo').length;
    const emEspera = pacientes.filter((p) => p.status === 'Lista de Espera').length;
    const vinculados = pacientes.filter((p) => p.alunoResponsavel).length;

    return {
      total,
      ativos,
      emEspera,
      vinculados,
      naoVinculados: total - vinculados
    };
  }, [pacientes]);

  const getAlunosDisponiveis = useCallback(async () => {
    try {
      const { data } = await api.get('/users');
      const users = normalizeUserList(data);
      return users
        .filter((item) => {
          const status = String(item.status || '').toLowerCase();
          return isStudentMemberRole(item.role) && status === 'ativo';
        })
        .filter((item) => !!item.supervisorId && !!item.projetoId);
    } catch (err) {
      console.error('Erro ao buscar alunos:', err);
      notify({
        type: 'error',
        title: 'Erro ao buscar alunos',
        message: getApiErrorMessage(err, 'Não foi possível carregar os alunos disponíveis.')
      });
      return [];
    }
  }, [notify]);

  const value = useMemo(() => ({
    pacientes: pacientesFiltrados,
    todosPacientes,
    loading,
    error,
    filtro,
    setFiltro,
    statusFilter,
    setStatusFilter,
    estatisticas,
    getPacienteById,
    addPaciente,
    updatePaciente,
    deletePaciente,
    vincularPaciente,
    getAlunosDisponiveis,
    calcularIdade,
    formatDate,
    convertFirebaseDate,
    formatDateForFirebase,
    refreshPacientes: fetchPacientes
  }), [
    pacientesFiltrados,
    todosPacientes,
    loading,
    error,
    filtro,
    statusFilter,
    estatisticas,
    getPacienteById,
    addPaciente,
    updatePaciente,
    deletePaciente,
    vincularPaciente,
    getAlunosDisponiveis,
    calcularIdade,
    fetchPacientes
  ]);

  return (
    <PacienteCoreContext.Provider value={value}>
      {children}
    </PacienteCoreContext.Provider>
  );
};

export const usePacienteCore = () => {
  const context = useContext(PacienteCoreContext);
  if (!context) {
    throw new Error('usePacienteCore deve ser usado dentro de um PacienteCoreProvider');
  }
  return context;
};
