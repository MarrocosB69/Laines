import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X, User, Mail, Lock, Shield, GraduationCap,
  Briefcase, AlertCircle, Save, Key
} from 'lucide-react';
import api, { getApiErrorMessage } from '../../../services/api';
import { isValidCpf, isValidEmail, isPastDate, normalizeCpf } from '../../../utils/validation';
import { generateInstitutionalEmail } from '../../../utils/institutionalEmail';
import { useAuth } from '../../../contexts/AuthContext';
import { useUiFeedback } from '../../../contexts/UiFeedbackContext';
import { useModalBodyLock } from '../../../hooks/useModalBodyLock';
import { useModalFocusTrap } from '../../../hooks/useModalFocusTrap';
import { normalizeUserList, normalizeUserRecord, getUserDisplayName } from '../../../utils/userAdapter';
import './UserModal.css';

const createEmptyFormData = () => ({
  nome: '',
  dataNascimento: '',
  cpf: '',
  matricula: '',
  periodo: '',
  supervisorId: '',
  diretoria: '',
  curso: '',
  projetoId: '',
  projetoNome: '',
  crn: '',
  conselhoTipo: '',
  conselhoNumero: '',
  coordAtendimento: false,
  lideranca: '',
  email: ''
});

const UserModal = ({ isOpen, onClose, onSave, initialData }) => {
  const [role, setRole] = useState('aluno');
  const [formData, setFormData] = useState(createEmptyFormData);

  const [professores, setProfessores] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingProfs, setLoadingProfs] = useState(false);
  const [error, setError] = useState('');
  const modalRef = useRef(null);
  const { user } = useAuth();
  const { notify } = useUiFeedback();
  const isStaffRole = role === 'professor' || role === 'profissional';
  const allowedStudentCreatorRoles = ['admin', 'coordenacao', 'presidente', 'vice'];
  const canCreateAluno = allowedStudentCreatorRoles.includes(user?.role);

  useModalBodyLock(isOpen);
  useModalFocusTrap(isOpen, modalRef);

  useEffect(() => {
    if (!isOpen) return;
    if (initialData) {
      const userRecord = normalizeUserRecord(initialData);
      const rawRole = String(userRecord?.role || 'aluno').toLowerCase();
      const isLeadershipRole = rawRole === 'presidente' || rawRole === 'vice';
      const resolvedRole = isLeadershipRole ? 'aluno' : rawRole;
      setRole(resolvedRole);
      setFormData({
        ...createEmptyFormData(),
        nome: userRecord?.name || '',
        dataNascimento: userRecord?.dataNascimento || '',
        cpf: userRecord?.cpf || '',
        matricula: userRecord?.matricula || '',
        periodo: userRecord?.periodo || '',
        supervisorId: userRecord?.supervisorId || '',
        diretoria: userRecord?.diretoria || '',
        curso: userRecord?.curso || '',
        projetoId: userRecord?.projetoId || '',
        projetoNome: userRecord?.projetoNome || '',
        crn: userRecord?.crn || '',
        conselhoTipo: userRecord?.conselhoTipo || '',
        conselhoNumero: userRecord?.conselhoNumero || '',
        coordAtendimento: !!userRecord?.coordAtendimento,
        lideranca: isLeadershipRole ? rawRole : '',
        email: generateInstitutionalEmail(userRecord?.name || '') || userRecord?.email || ''
      });
    } else {
      setRole('aluno');
      setFormData(createEmptyFormData());
    }
    setError('');
  }, [isOpen, initialData]);

  useEffect(() => {
    const fetchProfessors = async () => {
      if (role !== 'aluno') return;
      setLoadingProfs(true);
      try {
        const { data } = await api.get('/users');
        const profList = normalizeUserList(data)
          .filter((item) => String(item.role || '').toLowerCase() === 'professor')
          .map((item) => ({
            id: item.id,
            nome: item.name
          }));
        setProfessores(profList);
      } catch (err) {
        console.error('Erro ao buscar professores', err);
      } finally {
        setLoadingProfs(false);
      }
    };
    fetchProfessors();
  }, [role, isOpen]);

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

  const handleProjectChange = (event) => {
    const projectId = event.target.value;
    const project = projects.find((item) => item.id === projectId);
    setFormData((prev) => ({
      ...prev,
      projetoId: projectId,
      projetoNome: project?.nome || ''
    }));
  };

  function generateEmail(fullName) {
    return generateInstitutionalEmail(fullName);
  }

  const handleRoleChange = (nextRole) => {
    setRole(nextRole);
    const keepVinculos = ['aluno', 'professor', 'profissional'].includes(nextRole);
    setFormData((prev) => ({
      ...prev,
      supervisorId: nextRole === 'aluno' ? prev.supervisorId : '',
      periodo: nextRole === 'aluno' ? prev.periodo : '',
      curso: nextRole === 'aluno' ? prev.curso : '',
      matricula: nextRole === 'aluno' || nextRole === 'professor' ? prev.matricula : '',
      conselhoTipo: nextRole === 'profissional' ? prev.conselhoTipo : '',
      conselhoNumero: nextRole === 'profissional' ? prev.conselhoNumero : '',
      diretoria: nextRole === 'aluno' ? prev.diretoria : '',
      coordAtendimento: nextRole === 'aluno' ? prev.coordAtendimento : false,
      lideranca: nextRole === 'aluno' ? prev.lideranca : '',
      projetoId: keepVinculos ? prev.projetoId : '',
      projetoNome: keepVinculos ? prev.projetoNome : '',
      email: generateEmail(prev.nome)
    }));
  };

  const handleStaffRoleChange = (event) => {
    handleRoleChange(event.target.value);
  };

  const formatCPF = (value) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .replace(/(-\d{2})\d+?$/, '$1');
  };

  const handleNameChange = (e) => {
    const nome = e.target.value;
    setFormData(prev => ({
      ...prev,
      nome: nome,
      email: generateEmail(nome)
    }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    let finalValue = value;

    if (name === 'cpf') finalValue = formatCPF(value);

    setFormData(prev => {
      return { ...prev, [name]: finalValue };
    });
  };

  const handleCoordAtendimentoChange = (event) => {
    const { checked } = event.target;
    setFormData((prev) => ({ ...prev, coordAtendimento: checked }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!formData.nome || !formData.cpf || !formData.dataNascimento) {
        throw new Error('Preencha os campos obrigatórios.');
      }
      const resolvedEmail = generateEmail(formData.nome);
      if (!resolvedEmail || !isValidEmail(resolvedEmail)) {
        throw new Error('Email institucional inválido.');
      }
      if (!isValidCpf(normalizeCpf(formData.cpf))) {
        throw new Error('CPF inválido.');
      }
      if (!isPastDate(formData.dataNascimento)) {
        throw new Error('Data de nascimento inválida.');
      }
      if (role === 'aluno') {
        if (!canCreateAluno && !initialData) {
          throw new Error('Seu perfil não possui permissão para cadastrar alunos.');
        }
        if (!formData.matricula || !formData.supervisorId || !formData.curso || !formData.projetoId) {
          throw new Error('Complete os dados obrigatórios do aluno.');
        }
      }
      if (role === 'professor' && !formData.matricula) {
        throw new Error('Informe a matrícula do professor.');
      }
      if (role === 'profissional' && !formData.conselhoNumero) {
        throw new Error('Informe o número do conselho do profissional.');
      }

      const roleToSave = (() => {
        if (role !== 'aluno') return role;
        if (formData.lideranca === 'presidente' || formData.lideranca === 'vice') {
          return formData.lideranca;
        }
        if (formData.diretoria === 'diretoria_extensao' && formData.coordAtendimento) {
          return 'coord_atendimento';
        }
        return 'aluno';
      })();

      const supervisorNome = getUserDisplayName(
        professores.find((prof) => prof.id === formData.supervisorId),
        ''
      );

      const payload = {
        name: formData.nome,
        email: resolvedEmail,
        role: roleToSave,
        cpf: formData.cpf,
        dataNascimento: formData.dataNascimento,
        matricula: formData.matricula,
        periodo: formData.periodo,
        supervisorId: formData.supervisorId || null,
        supervisorNome,
        diretoria: formData.diretoria,
        coordAtendimento: formData.coordAtendimento,
        curso: formData.curso,
        projetoId: formData.projetoId || null,
        projetoNome: formData.projetoNome || '',
        conselhoTipo: formData.conselhoTipo || '',
        conselhoNumero: formData.conselhoNumero || '',
        status: 'ativo'
      };

      if (initialData) {
        await api.patch(`/users/${initialData.id}`, payload);
        notify({
          type: 'success',
          title: 'Usuário atualizado',
          message: 'Dados atualizados com sucesso.'
        });
      } else {
        await api.post('/users', payload);
        notify({
          type: 'success',
          title: 'Usuário criado',
          message: 'A conta foi criada com sucesso. Consulte a senha provisória na lista de usuários.'
        });
      }

      onSave();
      onClose();
    } catch (err) {
      console.error('Erro no cadastro:', err);
      setError(getApiErrorMessage(err, 'Erro ao criar usuário. Verifique os dados.'));
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
      className="user-modal-overlay app-modal-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          handleRequestClose();
        }
      }}
    >
      <div
        className="user-modal-container user-modal app-modal-shell app-modal-shell--xl"
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="user-modal-header modal-header app-modal-header">
          <div className="header-content app-modal-heading">
            <h2 id="user-modal-title" className="app-modal-title">{initialData ? 'Editar Usuário' : 'Novo Cadastro Acadêmico'}</h2>
            <p className="app-modal-subtitle">Preencha os dados institucionais da LAINES</p>
          </div>
          <button type="button" onClick={handleRequestClose} className="app-modal-close" aria-label="Fechar modal de usuário">
            <X size={24} />
          </button>
        </div>

        <div className="role-selector user-role-selector">
          <button
            type="button"
            className={`role-btn ${role === 'aluno' ? 'active' : ''}`}
            onClick={() => handleRoleChange('aluno')}
            disabled={!!initialData || !canCreateAluno}
            title={!canCreateAluno ? 'Somente Administração, Coordenação, Presidente ou Vice podem criar alunos.' : undefined}
          >
            <GraduationCap size={20} /> Aluno
          </button>
          <button
            type="button"
            className={`role-btn ${isStaffRole ? 'active' : ''}`}
            onClick={() => handleRoleChange(isStaffRole ? role : 'professor')}
            disabled={!!initialData}
          >
            <Briefcase size={20} /> Docente/Profissional
          </button>
          <button
            type="button"
            className={`role-btn ${role === 'tecnico' ? 'active' : ''}`}
            onClick={() => handleRoleChange('tecnico')}
            disabled={!!initialData}
          >
            <Shield size={20} /> Equipe
          </button>
          <button
            type="button"
            className={`role-btn ${role === 'atleta' ? 'active' : ''}`}
            onClick={() => handleRoleChange('atleta')}
            disabled={!!initialData}
          >
            <User size={20} /> Atleta
          </button>
          <button
            type="button"
            className={`role-btn ${role === 'coordenacao' ? 'active' : ''}`}
            onClick={() => handleRoleChange('coordenacao')}
            disabled={!!initialData}
          >
            <Shield size={20} /> Coordenação
          </button>
          <button
            type="button"
            className={`role-btn ${role === 'admin' ? 'active' : ''}`}
            onClick={() => handleRoleChange('admin')}
            disabled={!!initialData}
          >
            <Shield size={20} /> Admin
          </button>
        </div>

        <form onSubmit={handleSubmit} className="user-modal-form app-modal-body">
          <div className="form-grid app-modal-form-grid">

            <div className="form-section app-modal-form-section">
              <h3><User size={18} /> Identificação</h3>
            </div>

            <div className="form-group full-width flex flex-col gap-2 md:col-span-2">
              <label>Nome Completo *</label>
              <input className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 focus:border-[#103355] focus:outline-none focus:ring-2 focus:ring-[#103355]/10"
                type="text"
                name="nome"
                value={formData.nome}
                onChange={handleNameChange}
                placeholder="Nome completo do usuário"
                required
              />
            </div>

            <div className="form-group flex flex-col gap-2">
              <label>CPF *</label>
              <input className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 focus:border-[#103355] focus:outline-none focus:ring-2 focus:ring-[#103355]/10"
                type="text"
                name="cpf"
                value={formData.cpf}
                onChange={handleChange}
                placeholder="000.000.000-00"
                maxLength="14"
                required
              />
            </div>

            <div className="form-group flex flex-col gap-2">
              <label>Data de Nascimento *</label>
              <input className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 focus:border-[#103355] focus:outline-none focus:ring-2 focus:ring-[#103355]/10"
                type="date"
                name="dataNascimento"
                value={formData.dataNascimento}
                onChange={handleChange}
                required
              />
            </div>

            {role === 'aluno' && (
              <>
                <div className="form-section app-modal-form-section">
                  <h3><GraduationCap size={18} /> Dados Acadêmicos</h3>
                </div>

                <div className="form-group flex flex-col gap-2">
                  <label>Matrícula *</label>
                  <input className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 focus:border-[#103355] focus:outline-none focus:ring-2 focus:ring-[#103355]/10"
                    type="text"
                    name="matricula"
                    value={formData.matricula}
                    onChange={handleChange}
                    placeholder="Ex: 2023005512"
                    required
                  />
                </div>

                <div className="form-group flex flex-col gap-2">
                  <label>Período *</label>
                  <select className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 focus:border-[#103355] focus:outline-none focus:ring-2 focus:ring-[#103355]/10" name="periodo" value={formData.periodo} onChange={handleChange}>
                    <option value="">Selecione...</option>
                    {[1,2,3,4,5,6,7,8,9,10].map(p => (
                      <option key={p} value={`${p}º`}>{p}º Período</option>
                    ))}
                  </select>
                </div>

                <div className="form-group full-width flex flex-col gap-2 md:col-span-2">
                  <label>Supervisor (Professor) *</label>
                  <select className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 focus:border-[#103355] focus:outline-none focus:ring-2 focus:ring-[#103355]/10"
                    name="supervisorId"
                    value={formData.supervisorId}
                    onChange={handleChange}
                    disabled={loadingProfs}
                    required
                  >
                    <option value="">
                      {loadingProfs ? 'Carregando...' : 'Selecione o responsável'}
                    </option>
                    {professores.map(prof => (
                      <option key={prof.id} value={prof.id}>{prof.nome}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group full-width flex flex-col gap-2 md:col-span-2">
                  <label>Curso *</label>
                  <select
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 focus:border-[#103355] focus:outline-none focus:ring-2 focus:ring-[#103355]/10"
                    name="curso"
                    value={formData.curso}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Selecione...</option>
                    <option value="nutricao">Nutrição</option>
                    <option value="fisioterapia">Fisioterapia</option>
                    <option value="psicologia">Psicologia</option>
                  </select>
                </div>
                <div className="form-group full-width flex flex-col gap-2 md:col-span-2">
                  <label>Diretoria (opcional)</label>
                  <select
                    className="modern-select w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 focus:border-[#103355] focus:outline-none focus:ring-2 focus:ring-[#103355]/10"
                    name="diretoria"
                    value={formData.diretoria}
                    onChange={handleChange}
                  >
                    <option value="">Sem diretoria</option>
                    <option value="diretoria_marketing">Diretoria de Marketing</option>
                    <option value="diretoria_ensino">Diretoria de Ensino</option>
                    <option value="diretoria_pesquisa">Diretoria de Pesquisa</option>
                    <option value="diretoria_extensao">Diretoria de Extensão</option>
                  </select>
                </div>
                <div className="form-group full-width flex flex-col gap-2 md:col-span-2">
                  <label>Cargo na Liga (opcional)</label>
                  <select
                    className="modern-select w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 focus:border-[#103355] focus:outline-none focus:ring-2 focus:ring-[#103355]/10"
                    name="lideranca"
                    value={formData.lideranca}
                    onChange={handleChange}
                  >
                    <option value="">Sem cargo de liderança</option>
                    <option value="presidente">Presidente</option>
                    <option value="vice">Vice-presidente</option>
                  </select>
                </div>
                {formData.diretoria === 'diretoria_extensao' && (
                  <label className="form-group full-width flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 md:col-span-2">
                    <input
                      type="checkbox"
                      className="modern-checkbox"
                      checked={formData.coordAtendimento}
                      onChange={handleCoordAtendimentoChange}
                    />
                    Coord. Atendimentos
                  </label>
                )}
              </>
            )}

            {isStaffRole && (
              <>
                <div className="form-section app-modal-form-section">
                  <h3><Briefcase size={18} /> Tipo de cadastro</h3>
                </div>
                <div className="form-group full-width flex flex-col gap-2 md:col-span-2">
                  <label>Função *</label>
                  <select
                    className="modern-select w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 focus:border-[#103355] focus:outline-none focus:ring-2 focus:ring-[#103355]/10"
                    value={role}
                    onChange={handleStaffRoleChange}
                    disabled={!!initialData}
                  >
                    <option value="professor">Professor</option>
                    <option value="profissional">Profissional</option>
                  </select>
                </div>
              </>
            )}

            {role === 'profissional' && (
              <>
                <div className="form-section app-modal-form-section">
                  <h3><Briefcase size={18} /> Credenciais Profissionais</h3>
                </div>
                <div className="form-group full-width flex flex-col gap-2 md:col-span-2">
                  <label>Conselho profissional *</label>
                  <select className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 focus:border-[#103355] focus:outline-none focus:ring-2 focus:ring-[#103355]/10"
                    name="conselhoTipo"
                    value={formData.conselhoTipo}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Selecione...</option>
                    <option value="CRN">CRN</option>
                    <option value="CREFITO">CREFITO</option>
                    <option value="CRP">CRP</option>
                    <option value="OUTRO">Outro</option>
                  </select>
                </div>
                <div className="form-group full-width flex flex-col gap-2 md:col-span-2">
                  <label>Número do conselho *</label>
                  <input className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 focus:border-[#103355] focus:outline-none focus:ring-2 focus:ring-[#103355]/10"
                    type="text"
                    name="conselhoNumero"
                    value={formData.conselhoNumero}
                    onChange={handleChange}
                    placeholder="Ex: 12345"
                    required
                  />
                </div>
              </>
            )}

            {role === 'professor' && (
              <>
                <div className="form-section app-modal-form-section">
                  <h3><GraduationCap size={18} /> Dados Acadêmicos</h3>
                </div>
                <div className="form-group flex flex-col gap-2">
                  <label>Matrícula *</label>
                  <input className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 focus:border-[#103355] focus:outline-none focus:ring-2 focus:ring-[#103355]/10"
                    type="text"
                    name="matricula"
                    value={formData.matricula}
                    onChange={handleChange}
                    placeholder="Ex: 2023005512"
                    required
                  />
                </div>
              </>
            )}

            {['aluno', 'professor', 'profissional'].includes(role) && (
              <>
                <div className="form-section app-modal-form-section">
                  <h3><Briefcase size={18} /> Vínculos</h3>
                </div>
                <div className="form-group full-width flex flex-col gap-2 md:col-span-2">
                  <label>{role === 'professor' || role === 'profissional' ? 'Projeto parceiro' : 'Projeto vinculado'}</label>
                  <select
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 focus:border-[#103355] focus:outline-none focus:ring-2 focus:ring-[#103355]/10"
                    value={formData.projetoId}
                    onChange={handleProjectChange}
                    required={role === 'aluno'}
                  >
                    {role === 'aluno' ? (
                      <option value="">Selecione...</option>
                    ) : (
                      <option value="">Sem projeto</option>
                    )}
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <div className="form-section app-modal-form-section">
              <h3><Lock size={18} /> Acesso Gerado</h3>
            </div>

            <div className="form-group flex flex-col gap-2">
              <label>E-mail institucional (automático)</label>
              <div className="readonly-field flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <Mail size={16} />
                <span>{formData.email || 'Aguardando nome completo...'}</span>
              </div>
            </div>

            {!initialData && (
              <div className="form-group flex flex-col gap-2">
                <label>Senha Inicial</label>
                <div className="readonly-field highlight flex items-center gap-2 rounded-xl border border-[#103355] bg-[#103355] px-4 py-3 text-sm font-semibold text-white">
                  <Key size={16} />
                  <span className="password-display">Gerada automaticamente no cadastro</span>
                </div>
                <small className="field-hint text-xs text-slate-400">A senha temporária será exibida apenas após criar o usuário.</small>
              </div>
            )}

          </div>

          {error && (
            <div className="error-message app-modal-inline-message app-modal-inline-message--error">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          <div className="user-modal-footer app-modal-footer">
            <div className="app-modal-actions">
              <button type="button" onClick={handleRequestClose} className="app-modal-btn app-modal-btn--secondary">
                Cancelar
              </button>
              <button type="submit" className="app-modal-btn app-modal-btn--primary" disabled={loading}>
                {loading ? 'Processando...' : (
                  <>
                    <Save size={18} />
                    {initialData ? 'Salvar alterações' : 'Criar acesso'}
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

export default UserModal;









