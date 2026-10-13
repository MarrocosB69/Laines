import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X, User, Mail, Lock, Shield, GraduationCap,
  Briefcase, AlertCircle, Save, Copy, CheckCircle2
} from 'lucide-react';
import api, { getApiErrorMessage } from '../../../services/api';
import { isValidCpf, isValidEmail, isPastDate, normalizeCpf } from '../../../utils/validation';
import { formatCpf } from '../../../utils/formatters';
import { generateInstitutionalEmail } from '../../../utils/institutionalEmail';
import { useAuth } from '../../../contexts/AuthContext';
import { useUiFeedback } from '../../../contexts/UiFeedbackContext';
import { useModalBodyLock } from '../../../hooks/useModalBodyLock';
import { useModalFocusTrap } from '../../../hooks/useModalFocusTrap';
import { normalizeUserList, normalizeUserRecord, getUserDisplayName } from '../../../utils/userAdapter';
import { normalizeRole } from '../../../constants/roles';
import './UserModal.css';

const createEmptyFormData = () => ({
  nome: '',
  dataNascimento: '',
  cpf: '',
  matricula: '',
  periodo: '',
  supervisorId: '',
  profissionalId: '',
  diretoria: '',
  curso: '',
  projetoId: '',
  projetoNome: '',
  crn: '',
  conselhoTipo: '',
  conselhoNumero: '',
  lideranca: '',
  email: '',
  recoveryEmail: ''
});

const USER_FIELD_IDS = Object.freeze({
  nome: 'user-nome',
  cpf: 'user-cpf',
  dataNascimento: 'user-data-nascimento',
  matriculaAluno: 'user-matricula-aluno',
  periodo: 'user-periodo',
  supervisorId: 'user-supervisor-id',
  profissionalId: 'user-profissional-id',
  curso: 'user-curso',
  diretoria: 'user-diretoria',
  lideranca: 'user-lideranca',
  funcao: 'user-funcao',
  conselhoTipo: 'user-conselho-tipo',
  conselhoNumero: 'user-conselho-numero',
  matriculaProfessor: 'user-matricula-professor',
  projetoId: 'user-projeto-id'
});

const SUPERVISOR_FETCH_PAGE_SIZE = 200;

const isCredentialedSupervisor = (item) => {
  const itemRole = String(item?.role || '').toLowerCase();
  if (itemRole === 'professor') return true;
  if (itemRole === 'profissional') {
    return Boolean(String(item?.conselhoNumero || item?.crn || '').trim());
  }
  return false;
};

const normalizeSelectToken = (value) => String(value || '')
  .toLowerCase()
  .trim()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^\w\s-]/g, '')
  .replace(/[\s-]+/g, '_')
  .replace(/_+/g, '_')
  .replace(/^_+|_+$/g, '');

const normalizeCursoValue = (curso) => {
  const normalized = normalizeSelectToken(curso);
  if (!normalized) return '';
  if (normalized.includes('fisioterap')) return 'fisioterapia';
  if (normalized.includes('psicolog')) return 'psicologia';
  if (normalized.includes('nutri')) return 'nutricao';
  return normalized;
};

const normalizePeriodoValue = (periodo) => {
  const raw = String(periodo || '').trim();
  const match = raw.match(/\d+/);
  return match ? `${Number(match[0])}º` : raw;
};

const UserModal = ({ isOpen, onClose, onSave, initialData }) => {
  const [role, setRole] = useState('aluno');
  const [formData, setFormData] = useState(createEmptyFormData);

  const [professores, setProfessores] = useState([]);
  const [profissionais, setProfissionais] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingProfs, setLoadingProfs] = useState(false);
  const [error, setError] = useState('');
  const [createdCredentials, setCreatedCredentials] = useState(null);
  const [copiedField, setCopiedField] = useState(null);
  const modalRef = useRef(null);
  const { user } = useAuth();
  const { notify } = useUiFeedback();
  const isStaffRole = role === 'professor' || role === 'profissional';
  const isEditingStudent = Boolean(initialData) && role === 'aluno';
  const allowedStudentCreatorRoles = ['admin', 'coordenacao'];
  const canCreateAluno = allowedStudentCreatorRoles.includes(normalizeRole(user?.role));

  useModalBodyLock(isOpen);
  useModalFocusTrap(isOpen, modalRef);

  useEffect(() => {
    if (!isOpen) {
      setCreatedCredentials(null);
      setCopiedField(null);
      return;
    }
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
        periodo: normalizePeriodoValue(userRecord?.periodo),
        supervisorId: userRecord?.supervisorId || '',
        profissionalId: userRecord?.profissionalId || '',
        diretoria: userRecord?.diretoria || '',
        curso: normalizeCursoValue(userRecord?.curso),
        projetoId: userRecord?.projetoId || '',
        projetoNome: userRecord?.projetoNome || '',
        crn: userRecord?.crn || '',
        conselhoTipo: userRecord?.conselhoTipo || '',
        conselhoNumero: userRecord?.conselhoNumero || '',
        lideranca: isLeadershipRole ? rawRole : '',
        recoveryEmail: userRecord?.recoveryEmail || '',
        email: generateInstitutionalEmail(userRecord?.name || '') || userRecord?.email || ''
      });
    } else {
      setRole('aluno');
      setFormData(createEmptyFormData());
    }
    setError('');
  }, [isOpen, initialData]);

  useEffect(() => {
    const fetchSupervisores = async () => {
      if (role !== 'aluno') return;
      setLoadingProfs(true);
      setProfessores([]);
      setProfissionais([]);
      try {
        const loadSupervisorsFromUsers = async () => {
          const users = [];
          let offset = 0;

          while (true) {
            const { data } = await api.get('/users', {
              params: {
                limit: SUPERVISOR_FETCH_PAGE_SIZE,
                offset
              }
            });
            const page = normalizeUserList(data);
            users.push(...page);

            if (page.length < SUPERVISOR_FETCH_PAGE_SIZE) break;
            offset += SUPERVISOR_FETCH_PAGE_SIZE;
          }

          return users;
        };

        const normalized = await loadSupervisorsFromUsers();
        const supervisores = normalized.filter(isCredentialedSupervisor);
        setProfessores(
          supervisores
            .map((item) => ({ id: item.id, nome: item.name }))
        );
        setProfissionais(
          supervisores
            .filter((item) => String(item.role || '').toLowerCase() === 'profissional' && isCredentialedSupervisor(item))
            .map((item) => ({ id: item.id, nome: item.name }))
        );
      } catch (err) {
        console.error('Erro ao buscar supervisores', err);
      } finally {
        setLoadingProfs(false);
      }
    };
    fetchSupervisores();
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
      profissionalId: nextRole === 'aluno' ? prev.profissionalId : '',
      periodo: nextRole === 'aluno' ? prev.periodo : '',
      curso: nextRole === 'aluno' ? prev.curso : '',
      matricula: nextRole === 'aluno' || nextRole === 'professor' ? prev.matricula : '',
      conselhoTipo: nextRole === 'profissional' ? prev.conselhoTipo : '',
      conselhoNumero: nextRole === 'profissional' ? prev.conselhoNumero : '',
      diretoria: nextRole === 'aluno' ? prev.diretoria : '',
      lideranca: nextRole === 'aluno' ? prev.lideranca : '',
      projetoId: keepVinculos ? prev.projetoId : '',
      projetoNome: keepVinculos ? prev.projetoNome : '',
      email: generateEmail(prev.nome)
    }));
  };

  const handleStaffRoleChange = (event) => {
    handleRoleChange(event.target.value);
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

    if (name === 'cpf') finalValue = formatCpf(value);

    setFormData(prev => {
      return { ...prev, [name]: finalValue };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const initialUserRecord = initialData ? normalizeUserRecord(initialData) : null;
      const initialCpf = normalizeCpf(initialUserRecord?.cpf || '');
      const currentCpf = normalizeCpf(formData.cpf);
      const shouldValidateCpf = !initialUserRecord || currentCpf !== initialCpf;

      if (!formData.nome || !formData.cpf || !formData.dataNascimento) {
        throw new Error('Preencha os campos obrigatórios.');
      }
      const resolvedEmail = generateEmail(formData.nome);
      if (!resolvedEmail || !isValidEmail(resolvedEmail)) {
        throw new Error('E-mail institucional inválido.');
      }
      if (shouldValidateCpf && !isValidCpf(currentCpf)) {
        throw new Error('CPF inválido.');
      }
      if (!isPastDate(formData.dataNascimento)) {
        throw new Error('Data de nascimento inválida.');
      }
      if (role === 'aluno') {
        if (!canCreateAluno && !initialData) {
          throw new Error('Seu perfil não possui permissão para cadastrar alunos.');
        }
        if (!formData.matricula || !formData.periodo || !formData.supervisorId || !formData.curso || !formData.projetoId) {
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
        return 'aluno';
      })();

      const supervisorNome = getUserDisplayName(
        professores.find((prof) => prof.id === formData.supervisorId),
        ''
      );
      const basePayload = {
        name: formData.nome,
        role: roleToSave,
        cpf: formData.cpf,
        dataNascimento: formData.dataNascimento,
        matricula: formData.matricula,
        periodo: formData.periodo,
        supervisorId: formData.supervisorId || null,
        supervisorNome,
        profissionalId: formData.profissionalId || null,
        diretoria: formData.diretoria,
        curso: formData.curso,
        projetoId: formData.projetoId || null,
        projetoNome: formData.projetoNome || '',
        conselhoTipo: formData.conselhoTipo || '',
        conselhoNumero: formData.conselhoNumero || ''
      };

      if (initialData) {
        const editPayload = {};
        const addIfChanged = (key, value, previousValue, normalize = (item) => String(item || '').trim()) => {
          if (normalize(value) !== normalize(previousValue)) {
            editPayload[key] = value;
          }
        };

        addIfChanged('recoveryEmail', formData.recoveryEmail, initialUserRecord?.recoveryEmail);
        addIfChanged('name', basePayload.name, initialUserRecord?.name);
        addIfChanged('role', basePayload.role, initialUserRecord?.role, normalizeRole);
        addIfChanged('cpf', basePayload.cpf, initialUserRecord?.cpf, normalizeCpf);
        addIfChanged('dataNascimento', basePayload.dataNascimento, initialUserRecord?.dataNascimento);
        addIfChanged('matricula', basePayload.matricula, initialUserRecord?.matricula);
        addIfChanged('periodo', basePayload.periodo, normalizePeriodoValue(initialUserRecord?.periodo));
        addIfChanged('supervisorId', basePayload.supervisorId, initialUserRecord?.supervisorId);
        addIfChanged('profissionalId', basePayload.profissionalId, initialUserRecord?.profissionalId);
        addIfChanged('diretoria', basePayload.diretoria, initialUserRecord?.diretoria);
        addIfChanged('curso', basePayload.curso, normalizeCursoValue(initialUserRecord?.curso));
        addIfChanged('projetoId', basePayload.projetoId, initialUserRecord?.projetoId);
        addIfChanged('conselhoTipo', basePayload.conselhoTipo, initialUserRecord?.conselhoTipo);
        addIfChanged('conselhoNumero', basePayload.conselhoNumero, initialUserRecord?.conselhoNumero);

        if (Object.keys(editPayload).length > 0) {
          await api.patch(`/users/${initialData.id}`, editPayload);
        }
        notify({
          type: 'success',
          title: 'Usuário atualizado',
          message: Object.keys(editPayload).length > 0
            ? 'Dados atualizados com sucesso.'
            : 'Nenhuma alteração pendente.'
        });
        onSave();
        onClose();
      } else {
        const payload = {
          ...basePayload,
          email: formData.recoveryEmail,
          status: 'ativo'
        };
        const { data } = await api.post('/users', payload);
        const institutionalEmail = data?.user?.email || generateEmail(formData.nome);
        setCreatedCredentials({ email: institutionalEmail, delivery: data?.activation?.delivery });
        onSave?.({ keepOpen: true });
      }
    } catch (err) {
      console.error('Erro no cadastro:', err);
      const fallback = initialData
        ? 'Erro ao atualizar usuário. Verifique os dados.'
        : 'Erro ao criar usuário. Verifique os dados.';
      const message = err?.response || err?.request
        ? getApiErrorMessage(err, fallback)
        : err?.message || fallback;
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyField = useCallback((field, value) => {
    navigator.clipboard.writeText(value).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    });
  }, []);

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

  const hasSupervisorOptions = professores.length > 0;
  const supervisorPlaceholder = loadingProfs
    ? 'Carregando supervisores...'
    : hasSupervisorOptions
      ? 'Selecione professor ou profissional'
      : 'Nenhum supervisor credenciado encontrado';
  const profissionalPlaceholder = loadingProfs
    ? 'Carregando profissionais...'
    : profissionais.length === 0
      ? 'Nenhum profissional cadastrado'
      : 'Sem profissional complementar';
  const projectPlaceholder = projects.length === 0
    ? 'Nenhum projeto disponível'
    : 'Selecione...';

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
            <div className="user-modal-heading-line">
              <div className="user-modal-header-icon app-modal-header-icon" aria-hidden="true">
                {role === 'aluno' ? <GraduationCap size={20} /> : isStaffRole ? <Briefcase size={20} /> : <Shield size={20} />}
              </div>
              <div className="user-modal-heading-copy">
                <h2 id="user-modal-title" className="app-modal-title">
                  {isEditingStudent ? 'Vínculos do aluno' : initialData ? 'Editar Usuário' : 'Novo Cadastro Acadêmico'}
                </h2>
                <p className="app-modal-subtitle">
                  {isEditingStudent
                    ? 'Defina o supervisor credenciado obrigatório e o projeto do aluno.'
                    : 'Preencha os dados institucionais da LAINES'}
                </p>
              </div>
            </div>
          </div>
          <button type="button" onClick={handleRequestClose} className="app-modal-close" aria-label="Fechar modal de usuário">
            <X size={24} />
          </button>
        </div>

        {createdCredentials && (
          <div className="app-modal-body user-credentials-result">
            <div className="user-credentials-result__icon">
              <CheckCircle2 size={40} />
            </div>
            <h3>Conta criada com sucesso!</h3>
            <p>{createdCredentials.delivery === 'sent'
              ? 'Enviamos um link de ativacao ao contato cadastrado. O membro define a propria senha.'
              : 'Conta criada, mas o link nao foi enviado. Confira o contato e o servico de email e use Enviar link de acesso no cadastro.'}</p>
            <div className="user-credentials-result__fields">
              <div className="user-credentials-result__field">
                <span className="user-credentials-result__label">E-mail institucional</span>
                <div className="user-credentials-result__value">
                  <Mail size={15} />
                  <span>{createdCredentials.email}</span>
                  <button
                    type="button"
                    className="user-credentials-result__copy"
                    onClick={() => handleCopyField('email', createdCredentials.email)}
                    aria-label="Copiar e-mail"
                  >
                    {copiedField === 'email' ? <CheckCircle2 size={15} /> : <Copy size={15} />}
                  </button>
                </div>
              </div>
            </div>
            <p className="user-credentials-result__warning">O link de ativacao expira em 15 minutos. Nenhuma senha e exibida pela administracao.</p>
            <div className="app-modal-footer">
              <button
                type="button"
                className="app-modal-btn app-modal-btn--primary"
                onClick={() => onClose()}
              >
                Fechar
              </button>
            </div>
          </div>
        )}
        <div className="role-selector user-role-selector" role="group" aria-label="Tipo de usuário" style={createdCredentials ? { display: 'none' } : undefined}>
          <button
            type="button"
            className={`role-btn ${role === 'aluno' ? 'active' : ''}`}
            aria-pressed={role === 'aluno'}
            onClick={() => handleRoleChange('aluno')}
            disabled={!!initialData || !canCreateAluno}
            title={!canCreateAluno ? 'Somente Administração ou Coordenação podem criar alunos.' : undefined}
          >
            <GraduationCap size={20} /> <span>Aluno</span>
          </button>
          <button
            type="button"
            className={`role-btn ${isStaffRole ? 'active' : ''}`}
            aria-pressed={isStaffRole}
            onClick={() => handleRoleChange(isStaffRole ? role : 'professor')}
            disabled={!!initialData}
          >
            <Briefcase size={20} /> <span>Docente/Profissional</span>
          </button>
          <button
            type="button"
            className={`role-btn ${role === 'tecnico' ? 'active' : ''}`}
            aria-pressed={role === 'tecnico'}
            onClick={() => handleRoleChange('tecnico')}
            disabled={!!initialData}
          >
            <Shield size={20} /> <span>Equipe</span>
          </button>
          <button
            type="button"
            className={`role-btn ${role === 'coordenacao' ? 'active' : ''}`}
            aria-pressed={role === 'coordenacao'}
            onClick={() => handleRoleChange('coordenacao')}
            disabled={!!initialData}
          >
            <Shield size={20} /> <span>Coordenação</span>
          </button>
          <button
            type="button"
            className={`role-btn ${role === 'admin' ? 'active' : ''}`}
            aria-pressed={role === 'admin'}
            onClick={() => handleRoleChange('admin')}
            disabled={!!initialData}
          >
            <Shield size={20} /> <span>Admin</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="user-modal-form app-modal-body" style={createdCredentials ? { display: 'none' } : undefined}>
          <div className="form-grid app-modal-form-grid user-form-grid">

            <div className="form-section app-modal-form-section">
              <h3><User size={18} /> Identificação</h3>
            </div>

            <div className="form-group full-width flex flex-col gap-2 md:col-span-2">
              <label htmlFor={USER_FIELD_IDS.nome}>Nome Completo *</label>
              <input className="user-field-input app-modal-input"
                type="text"
                name="nome"
                id={USER_FIELD_IDS.nome}
                value={formData.nome}
                onChange={handleNameChange}
                data-modal-initial-focus
                placeholder="Nome completo do usuário"
                required
              />
            </div>

            <div className="form-group flex flex-col gap-2">
              <label htmlFor={USER_FIELD_IDS.cpf}>CPF *</label>
              <input className="user-field-input app-modal-input"
                id={USER_FIELD_IDS.cpf}
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
              <label htmlFor={USER_FIELD_IDS.dataNascimento}>Data de Nascimento *</label>
              <input className="user-field-input app-modal-input"
                id={USER_FIELD_IDS.dataNascimento}
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
                <p className="form-section-note full-width">
                  O vínculo de supervisão é feito no cadastro do aluno: professor ou profissional credenciado é obrigatório.
                </p>

                <div className="form-group flex flex-col gap-2">
                  <label htmlFor={USER_FIELD_IDS.matriculaAluno}>Matrícula *</label>
                  <input className="user-field-input app-modal-input"
                    type="text"
                    name="matricula"
                    id={USER_FIELD_IDS.matriculaAluno}
                    value={formData.matricula}
                    onChange={handleChange}
                    placeholder="Ex: 2023005512"
                    required
                  />
                </div>

                <div className="form-group flex flex-col gap-2">
                  <label htmlFor={USER_FIELD_IDS.periodo}>Período *</label>
                  <select
                    id={USER_FIELD_IDS.periodo}
                    className="user-field-select app-modal-select"
                    name="periodo"
                    value={formData.periodo}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Selecione...</option>
                    {[1,2,3,4,5,6,7,8,9,10].map(p => (
                      <option key={p} value={`${p}º`}>{p}º Período</option>
                    ))}
                  </select>
                </div>

                <div className="form-group full-width flex flex-col gap-2 md:col-span-2">
                  <label htmlFor={USER_FIELD_IDS.supervisorId}>Supervisor credenciado *</label>
                  <select className="user-field-select app-modal-select"
                    id={USER_FIELD_IDS.supervisorId}
                    name="supervisorId"
                    value={formData.supervisorId}
                    onChange={handleChange}
                    disabled={loadingProfs || !hasSupervisorOptions}
                    required
                    aria-describedby={!loadingProfs && !hasSupervisorOptions ? 'user-supervisor-hint' : undefined}
                  >
                    <option value="">
                      {supervisorPlaceholder}
                    </option>
                    {professores.map(prof => (
                      <option key={prof.id} value={prof.id}>{prof.nome}</option>
                    ))}
                  </select>
                  {!loadingProfs && !hasSupervisorOptions && (
                    <small className="field-hint user-field-hint" id="user-supervisor-hint">
                      Cadastre ou ative um professor/profissional credenciado antes de salvar o aluno.
                    </small>
                  )}
                </div>
                <div className="form-group full-width flex flex-col gap-2 md:col-span-2">
                  <label htmlFor={USER_FIELD_IDS.profissionalId}>Profissional complementar (opcional)</label>
                  <select className="user-field-select app-modal-select"
                    id={USER_FIELD_IDS.profissionalId}
                    name="profissionalId"
                    value={formData.profissionalId}
                    onChange={handleChange}
                    disabled={loadingProfs || profissionais.length === 0}
                  >
                    <option value="">
                      {profissionalPlaceholder}
                    </option>
                    {profissionais.map(p => (
                      <option key={p.id} value={p.id}>{p.nome}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group full-width flex flex-col gap-2 md:col-span-2">
                  <label htmlFor={USER_FIELD_IDS.curso}>Curso *</label>
                  <select
                    id={USER_FIELD_IDS.curso}
                    className="user-field-select app-modal-select"
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
                  <label htmlFor={USER_FIELD_IDS.diretoria}>Diretoria (opcional)</label>
                  <select
                    id={USER_FIELD_IDS.diretoria}
                    className="modern-select user-field-select app-modal-select"
                    name="diretoria"
                    value={formData.diretoria}
                    onChange={handleChange}
                  >
                    <option value="">Sem diretoria</option>
                    <option value="diretoria_marketing">Marketing/Comunicação</option>
                    <option value="diretoria_ensino">Ensino</option>
                    <option value="diretoria_pesquisa">Pesquisa</option>
                    <option value="diretoria_extensao">Extensão</option>
                  </select>
                </div>
                <div className="form-group full-width flex flex-col gap-2 md:col-span-2">
                  <label htmlFor={USER_FIELD_IDS.lideranca}>Cargo na Liga (opcional)</label>
                  <select
                    id={USER_FIELD_IDS.lideranca}
                    className="modern-select user-field-select app-modal-select"
                    name="lideranca"
                    value={formData.lideranca}
                    onChange={handleChange}
                  >
                    <option value="">Sem cargo de liderança</option>
                    <option value="presidente">Presidente</option>
                    <option value="vice">Vice-presidente</option>
                  </select>
                </div>
              </>
            )}

            {isStaffRole && (
              <>
                <div className="form-section app-modal-form-section">
                  <h3><Briefcase size={18} /> Tipo de cadastro</h3>
                </div>
                <div className="form-group full-width flex flex-col gap-2 md:col-span-2">
                  <label htmlFor={USER_FIELD_IDS.funcao}>Função *</label>
                  <select
                    id={USER_FIELD_IDS.funcao}
                    className="modern-select user-field-select app-modal-select"
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
                  <label htmlFor={USER_FIELD_IDS.conselhoTipo}>Conselho profissional *</label>
                  <select className="user-field-select app-modal-select"
                    id={USER_FIELD_IDS.conselhoTipo}
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
                  <label htmlFor={USER_FIELD_IDS.conselhoNumero}>Número do conselho *</label>
                  <input className="user-field-input app-modal-input"
                    id={USER_FIELD_IDS.conselhoNumero}
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
                  <label htmlFor={USER_FIELD_IDS.matriculaProfessor}>Matrícula *</label>
                  <input className="user-field-input app-modal-input"
                    id={USER_FIELD_IDS.matriculaProfessor}
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
                  <label htmlFor={USER_FIELD_IDS.projetoId}>
                    {role === 'professor' || role === 'profissional' ? 'Projeto parceiro' : 'Projeto vinculado'}
                  </label>
                  <select
                    id={USER_FIELD_IDS.projetoId}
                    className="user-field-select app-modal-select"
                    value={formData.projetoId}
                    onChange={handleProjectChange}
                    required={role === 'aluno'}
                  >
                    {role === 'aluno' ? (
                      <option value="">{projectPlaceholder}</option>
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
              <div className="readonly-field user-readonly-field">
                <Mail size={16} />
                <span>{formData.email || 'Aguardando nome completo...'}</span>
              </div>
            </div>

            <div className="form-group flex flex-col gap-2">
              <label htmlFor="user-recovery-email">E-mail de contato para ativacao e recuperacao</label>
              <input id="user-recovery-email" type="email" value={formData.recoveryEmail}
                onChange={(event) => setFormData((prev) => ({ ...prev, recoveryEmail: event.target.value }))}
                required={!initialData} autoComplete="email" aria-describedby="user-recovery-email-hint" />
              <small className="field-hint user-field-hint" id="user-recovery-email-hint">Confirme com o membro uma caixa de email acessivel. O login institucional acima identifica a conta.</small>
            </div>

          </div>

          {error && (
            <div className="error-message app-modal-inline-message app-modal-inline-message--error" id="user-modal-error" role="alert">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          <div className="user-modal-footer app-modal-footer">
            <div className="app-modal-actions">
              <button type="button" onClick={handleRequestClose} className="app-modal-btn app-modal-btn--secondary">
                Cancelar
              </button>
              <button type="submit" className="app-modal-btn app-modal-btn--primary" disabled={loading} aria-describedby={error ? 'user-modal-error' : undefined}>
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










