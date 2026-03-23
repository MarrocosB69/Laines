import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  User,
  Phone,
  MapPin,
  Calendar,
  FileText,
  Users,
  Activity,
  AlertCircle,
  Save
} from 'lucide-react';
import api, { getApiErrorMessage } from '../../../services/api';
import { normalizeStatus } from '../../../utils/dateUtils';
import { isValidCpf, isValidEmail, isPastDate, normalizeCpf } from '../../../utils/validation';
import { generateInstitutionalEmail } from '../../../utils/institutionalEmail';
import { getUserDisplayName, normalizeUserList } from '../../../utils/userAdapter';
import { useUiFeedback } from '../../../contexts/UiFeedbackContext';
import { useModalBodyLock } from '../../../hooks/useModalBodyLock';
import { useModalFocusTrap } from '../../../hooks/useModalFocusTrap';
import './PatientModal.css';

const isForbiddenError = (err) => Number(err?.response?.status || 0) === 403;

const PatientModal = ({ isOpen, onClose, onSave, initialData, onCreate }) => {
  const [formData, setFormData] = useState({
    nome: '',
    cpf: '',
    dataNascimento: '',
    genero: 'nao_informado',
    telefone: '',
    email: '',
    endereco: '',
    bairro: '',
    cidade: '',
    estado: '',
    status: 'Ativo',
    modalidadePrincipal: '',
    tempoPratica: '',
    frequenciaSemanal: '',
    duracaoSessao: '',
    outrasModalidades: '',
    tipoTreino: 'misto',
    intensidade: 'moderada',
    objetivo: 'performance',
    observacoes: '',
    projetoId: '',
    equipeTecnicaIds: [],
    atletaUserId: '',
    consentimentoPesquisa: 'pendente',
    consentimentoData: '',
    consentimentoVersao: ''
  });
  const [projects, setProjects] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [athleteUsers, setAthleteUsers] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const modalRef = useRef(null);
  const { notify } = useUiFeedback();

  useModalBodyLock(isOpen);
  useModalFocusTrap(isOpen, modalRef);

  const buildAthleteEmailFromName = (fullName) => generateInstitutionalEmail(fullName);

  useEffect(() => {
    if (initialData) {
      setFormData({
        nome: initialData.nome || '',
        cpf: initialData.cpf || '',
        dataNascimento: initialData.dataNascimento || '',
        genero: initialData.genero || 'nao_informado',
        telefone: initialData.telefone || '',
        email: initialData.email || '',
        endereco: initialData.endereco || '',
        bairro: initialData.bairro || '',
        cidade: initialData.cidade || '',
        estado: initialData.estado || '',
        status: normalizeStatus(initialData.status),
        modalidadePrincipal: initialData.modalidadePrincipal || '',
        tempoPratica: initialData.tempoPratica || '',
        frequenciaSemanal: initialData.frequenciaSemanal || '',
        duracaoSessao: initialData.duracaoSessao || '',
        outrasModalidades: initialData.outrasModalidades || '',
        tipoTreino: initialData.tipoTreino || 'misto',
        intensidade: initialData.intensidade || 'moderada',
        objetivo: initialData.objetivo || 'performance',
        observacoes: initialData.observacoes || '',
        projetoId: initialData.projetoId || '',
        equipeTecnicaIds: initialData.equipeTecnicaIds || [],
        atletaUserId: initialData.atletaUserId || '',
        consentimentoPesquisa: initialData.consentimentoPesquisa || 'pendente',
        consentimentoData: initialData.consentimentoData || '',
        consentimentoVersao: initialData.consentimentoVersao || ''
      });
    } else {
      setFormData({
        nome: '',
        cpf: '',
        dataNascimento: '',
        genero: 'nao_informado',
        telefone: '',
        email: '',
        endereco: '',
        bairro: '',
        cidade: '',
        estado: '',
        status: 'Ativo',
        modalidadePrincipal: '',
        tempoPratica: '',
        frequenciaSemanal: '',
        duracaoSessao: '',
        outrasModalidades: '',
        tipoTreino: 'misto',
        intensidade: 'moderada',
        objetivo: 'performance',
        observacoes: '',
        projetoId: '',
        equipeTecnicaIds: [],
        atletaUserId: '',
        consentimentoPesquisa: 'pendente',
        consentimentoData: '',
        consentimentoVersao: ''
      });
    }
    setError('');
  }, [initialData, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const loadProjects = async () => {
      try {
        const { data } = await api.get('/projetos');
        const sorted = Array.isArray(data)
          ? data.slice().sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
          : [];
        setProjects(sorted);
      } catch (err) {
        const status = Number(err?.response?.status || 0);
        if (status !== 403) {
          console.error('Erro ao carregar projetos:', err);
        }
        notify({
          type: 'error',
          title: 'Acesso a projetos indisponível',
          message: status === 403
            ? 'Seu perfil não possui permissão para consultar projetos.'
            : getApiErrorMessage(err, 'Não foi possível carregar projetos.')
        });
        setProjects([]);
      }
    };
    loadProjects();
  }, [isOpen, notify]);

  useEffect(() => {
    if (!isOpen) return;
    const loadAccessUsers = async () => {
      try {
        const { data } = await api.get('/users');
        const users = normalizeUserList(data);
        setTeamMembers(users.filter((item) => item.role === 'tecnico'));
        setAthleteUsers(users.filter((item) => item.role === 'atleta'));
      } catch (err) {
        if (!isForbiddenError(err)) {
          console.error('Erro ao carregar equipe técnica:', err);
        }
        setTeamMembers([]);
        setAthleteUsers([]);
      }
    };
    loadAccessUsers();
  }, [isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const next = { ...prev, [name]: value };
      if (name === 'nome') {
        const currentGenerated = buildAthleteEmailFromName(prev.nome);
        const nextGenerated = buildAthleteEmailFromName(value);
        if (!prev.email || prev.email === currentGenerated) {
          next.email = nextGenerated;
        }
      }
      return next;
    });
  };

  const handleToggleEquipe = (id) => {
    setFormData((prev) => {
      const selected = new Set(prev.equipeTecnicaIds || []);
      if (selected.has(id)) {
        selected.delete(id);
      } else {
        selected.add(id);
      }
      return { ...prev, equipeTecnicaIds: Array.from(selected) };
    });
  };

  const requiredFields = useMemo(() => ([
    'nome',
    'cpf',
    'dataNascimento',
    'genero',
    'telefone',
    'modalidadePrincipal'
  ]), []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const missing = requiredFields.filter((field) => !formData[field]);
      if (missing.length > 0) {
        throw new Error('Preencha todos os campos obrigatorios.');
      }
      if (!isValidCpf(normalizeCpf(formData.cpf))) {
        throw new Error('CPF inválido.');
      }
      if (formData.email && !isValidEmail(formData.email)) {
        throw new Error('Email inválido.');
      }
      if (!isPastDate(formData.dataNascimento)) {
        throw new Error('Data de nascimento invalida.');
      }

      const generatedEmail = buildAthleteEmailFromName(formData.nome);
      let athleteEmail = generatedEmail || formData.email || '';
      if (!athleteEmail) {
        throw new Error('Email do atleta não foi gerado. Verifique o nome completo.');
      }

      let athleteUserId = formData.atletaUserId;
      let tempPassword = '';

      if (!athleteUserId) {
        try {
          const { data: usersData } = await api.get('/users');
          const users = normalizeUserList(usersData);
          const athleteCpf = normalizeCpf(formData.cpf || '');
          const existingUserByCpf = users.find((item) => (
            String(item.role || '').toLowerCase() === 'atleta' &&
            normalizeCpf(item.cpf || '') === athleteCpf
          ));
          const existingUserByEmail = users.find(
            (item) => String(item.email || '').toLowerCase() === athleteEmail.toLowerCase()
          );
          const existingUser = existingUserByCpf || existingUserByEmail;

          if (existingUser) {
            if (String(existingUser.role || '').toLowerCase() !== 'atleta') {
              throw new Error('Já existe um usuário com este email, mas não é atleta.');
            }
            const existingCpf = normalizeCpf(existingUser.cpf || '');
            if (existingCpf && athleteCpf && existingCpf !== athleteCpf) {
              throw new Error('Já existe outro usuário com o mesmo email institucional. Ajuste o nome para diferenciar o login.');
            }
            athleteUserId = existingUser.id;
            athleteEmail = existingUser.email || athleteEmail;
          } else {
            const { data: created } = await api.post('/users', {
              name: formData.nome,
              email: athleteEmail,
              role: 'atleta',
              cpf: formData.cpf,
              dataNascimento: formData.dataNascimento,
              telefone: formData.telefone,
              status: 'ativo'
            });

            athleteUserId = created?.user?.id;
            athleteEmail = created?.user?.email || athleteEmail;
            tempPassword = created?.tempPassword || '';
          }
        } catch (userError) {
          if (!isForbiddenError(userError)) {
            throw userError;
          }
        }
      }

      const selectedProject = projects.find((project) => project.id === formData.projetoId) || null;
      const frequenciaSemanal = formData.frequenciaSemanal === ''
        ? null
        : Number(formData.frequenciaSemanal);
      const duracaoSessao = formData.duracaoSessao === ''
        ? null
        : Number(formData.duracaoSessao);
      if (
        (frequenciaSemanal !== null && !Number.isFinite(frequenciaSemanal))
        || (duracaoSessao !== null && !Number.isFinite(duracaoSessao))
      ) {
        throw new Error('Frequencia semanal e duracao da sessao devem ser numeros validos.');
      }

      const patientData = {
        ...formData,
        email: athleteEmail,
        frequenciaSemanal,
        duracaoSessao,
        projetoId: formData.projetoId || null,
        atletaUserId: athleteUserId || formData.atletaUserId || null,
        status: normalizeStatus(formData.status),
        projetoNome: selectedProject?.nome || ''
      };

      if (initialData?.id) {
        await api.patch(`/pacientes/${initialData.id}`, patientData);
      } else if (onCreate) {
        await onCreate(patientData);
      } else {
        await api.post('/pacientes', patientData);
      }

      if (onSave) onSave();
      if (onClose) onClose();

      if (tempPassword) {
        notify({
          type: 'success',
          title: 'Atleta criado',
          message: `Acesso do atleta ${athleteEmail} criado. Consulte a senha provisória na lista de usuários.`
        });
      }
    } catch (err) {
      console.error('Erro ao salvar paciente:', err);
      const apiMessage = getApiErrorMessage(err, 'Erro ao salvar dados.');
      setError(apiMessage);
      notify({
        type: 'error',
        title: 'Erro ao salvar paciente',
        message: apiMessage
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRequestClose = useCallback(() => {
    if (loading) return;
    onClose?.();
  }, [loading, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleRequestClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, handleRequestClose]);
  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  const modalContent = (
    <div
      className="patient-modal-overlay app-modal-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          handleRequestClose();
        }
      }}
    >
      <div
        className="patient-modal-container app-modal-shell app-modal-shell--xl"
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="patient-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="patient-modal-header app-modal-header">
          <div className="app-modal-heading">
            <h2 id="patient-modal-title" className="app-modal-title">{initialData ? 'Editar Paciente' : 'Novo Paciente'}</h2>
            <p className="app-modal-subtitle">Cadastro completo do atleta e rotina esportiva</p>
          </div>
          <button
            onClick={handleRequestClose}
            className="app-modal-close"
            type="button"
            aria-label="Fechar modal de paciente"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="patient-modal-form app-modal-body">
          <div className="patient-form-grid app-modal-form-grid">
            <div className="patient-section-title app-modal-form-section">
              <User size={16} /> Identificacao
            </div>

            <div className="col-span-full space-y-2">
              <label className="text-sm font-bold text-slate-700">Nome completo <span className="text-red-500">*</span></label>
              <input
                type="text"
                name="nome"
                value={formData.nome}
                onChange={handleChange}
                placeholder="Ex: Joao da Silva"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-400"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">CPF <span className="text-red-500">*</span></label>
              <input
                type="text"
                name="cpf"
                value={formData.cpf}
                onChange={handleChange}
                placeholder="000.000.000-00"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-400"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Data de nascimento <span className="text-red-500">*</span></label>
              <input
                type="date"
                name="dataNascimento"
                value={formData.dataNascimento}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Sexo <span className="text-red-500">*</span></label>
              <select
                name="genero"
                value={formData.genero}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none"
                required
              >
                <option value="nao_informado">Prefiro não informar</option>
                <option value="masculino">Masculino</option>
                <option value="feminino">Feminino</option>
                <option value="outro">Outro</option>
              </select>
            </div>

            <div className="patient-section-title app-modal-form-section">
              <Phone size={16} /> Contato e endereco
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Telefone / WhatsApp <span className="text-red-500">*</span></label>
              <input
                type="tel"
                name="telefone"
                value={formData.telefone}
                onChange={handleChange}
                placeholder="(00) 00000-0000"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-400"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="joao@email.com"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-400"
              />
            </div>

            <div className="col-span-full space-y-2">
              <label className="text-sm font-bold text-slate-700">Endereco</label>
              <input
                type="text"
                name="endereco"
                value={formData.endereco}
                onChange={handleChange}
                placeholder="Rua, numero, complemento"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-400"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Bairro</label>
              <input
                type="text"
                name="bairro"
                value={formData.bairro}
                onChange={handleChange}
                placeholder="Centro"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-400"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Cidade</label>
              <input
                type="text"
                name="cidade"
                value={formData.cidade}
                onChange={handleChange}
                placeholder="Natal"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-400"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Estado</label>
              <input
                type="text"
                name="estado"
                value={formData.estado}
                onChange={handleChange}
                placeholder="RN"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-400"
              />
            </div>

            <div className="patient-section-title app-modal-form-section">
              <Activity size={16} /> Esporte e rotina
            </div>

            <div className="col-span-full space-y-2">
              <label className="text-sm font-bold text-slate-700">Modalidade principal <span className="text-red-500">*</span></label>
              <input
                type="text"
                name="modalidadePrincipal"
                value={formData.modalidadePrincipal}
                onChange={handleChange}
                placeholder="Ex: Corrida, Crossfit"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-400"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Tempo de pratica</label>
              <input
                type="text"
                name="tempoPratica"
                value={formData.tempoPratica}
                onChange={handleChange}
                placeholder="Ex: 3 anos"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-400"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Frequencia (dias/semana) <span className="text-red-500">*</span></label>
              <input
                type="number"
                name="frequenciaSemanal"
                value={formData.frequenciaSemanal}
                onChange={handleChange}
                placeholder="Ex: 5"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-400"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Duracao por sessao (min) <span className="text-red-500">*</span></label>
              <input
                type="number"
                name="duracaoSessao"
                value={formData.duracaoSessao}
                onChange={handleChange}
                placeholder="Ex: 60"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-400"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Outras modalidades</label>
              <input
                type="text"
                name="outrasModalidades"
                value={formData.outrasModalidades}
                onChange={handleChange}
                placeholder="Ex: Musculacao, Yoga"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-400"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Tipo de treino</label>
              <select
                name="tipoTreino"
                value={formData.tipoTreino}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none"
              >
                <option value="forca">Forca</option>
                <option value="resistencia">Resistencia</option>
                <option value="tecnico">Tecnico</option>
                <option value="misto">Misto</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Intensidade percebida</label>
              <select
                name="intensidade"
                value={formData.intensidade}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none"
              >
                <option value="leve">Leve</option>
                <option value="moderada">Moderada</option>
                <option value="intensa">Intensa</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Objetivo principal</label>
              <select
                name="objetivo"
                value={formData.objetivo}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none"
              >
                <option value="performance">Performance</option>
                <option value="estetica">Estética</option>
                <option value="saude">Saúde</option>
              </select>
            </div>

            <div className="patient-section-title app-modal-form-section">
              <FileText size={16} /> Vínculo e observações
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Status do atendimento</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none"
              >
                <option value="Ativo">Ativo</option>
                <option value="Lista de Espera">Lista de espera</option>
                <option value="Triagem">Triagem</option>
                <option value="Inativo">Inativo</option>
                <option value="Alta">Alta</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Projeto de pesquisa</label>
              <select
                name="projetoId"
                value={formData.projetoId}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none"
              >
                <option value="">Sem projeto</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="patient-section-title app-modal-form-section">
              <Users size={16} /> Equipe técnica e acesso
            </div>

            <div className="col-span-full space-y-2">
              <label className="text-sm font-bold text-slate-700">Usuário do atleta</label>
              <select
                name="atletaUserId"
                value={formData.atletaUserId}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none"
              >
                <option value="">Sem acesso</option>
                {athleteUsers.map((athlete) => (
                  <option key={athlete.id} value={athlete.id}>
                    {getUserDisplayName(athlete, athlete.id)}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-full space-y-2">
              <label className="text-sm font-bold text-slate-700">Equipe técnica vinculada</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {teamMembers.length === 0 ? (
                  <span className="text-slate-400 text-sm italic">Nenhuma equipe cadastrada.</span>
                ) : (
                  teamMembers.map((member) => (
                    <label key={member.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-white hover:border-blue-300 transition-colors cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={(formData.equipeTecnicaIds || []).includes(member.id)}
                        onChange={() => handleToggleEquipe(member.id)}
                        className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-slate-600 group-hover:text-slate-800">{getUserDisplayName(member, member.id)}</span>
                    </label>
                  ))
                )}
              </div>
            </div>

            <div className="col-span-full space-y-2">
              <label className="text-sm font-bold text-slate-700">Observacoes iniciais</label>
              <textarea
                name="observacoes"
                value={formData.observacoes}
                onChange={handleChange}
                rows="3"
                placeholder="Informacoes adicionais relevantes..."
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-400 resize-none"
              />
            </div>

            <div className="patient-section-title app-modal-form-section">
              <FileText size={16} /> Consentimento para pesquisa
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Status do consentimento</label>
              <select
                name="consentimentoPesquisa"
                value={formData.consentimentoPesquisa}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none"
              >
                <option value="pendente">Pendente</option>
                <option value="aceito">Aceito</option>
                <option value="recusado">Recusado</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Data do consentimento</label>
              <input
                type="date"
                name="consentimentoData"
                value={formData.consentimentoData}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Versao do termo</label>
              <input
                type="text"
                name="consentimentoVersao"
                value={formData.consentimentoVersao}
                onChange={handleChange}
                placeholder="Ex: v1.0"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-400"
              />
            </div>
          </div>

          {error && (
            <div className="patient-modal-error app-modal-inline-message app-modal-inline-message--error">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          <div className="patient-modal-footer app-modal-footer">
            <div className="app-modal-actions">
              <button
                type="button"
                onClick={handleRequestClose}
                className="app-modal-btn app-modal-btn--secondary"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="app-modal-btn app-modal-btn--primary"
                disabled={loading}
              >
                {loading ? (
                  <>Salvando...</>
                ) : (
                  <>
                    <Save size={18} />
                    {initialData ? 'Salvar alteracoes' : 'Cadastrar paciente'}
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default PatientModal;












