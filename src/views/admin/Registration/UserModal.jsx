import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X, User, Mail, Lock, Shield, GraduationCap,
  Briefcase, AlertCircle, Save, Key
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

const USER_FIELD_IDS = Object.freeze({
  nome: 'user-nome',
  cpf: 'user-cpf',
  dataNascimento: 'user-data-nascimento',
  matriculaAluno: 'user-matricula-aluno',
  periodo: 'user-periodo',
  supervisorId: 'user-supervisor-id',
  curso: 'user-curso',
  diretoria: 'user-diretoria',
  lideranca: 'user-lideranca',
  coordAtendimento: 'user-coord-atendimento',
  funcao: 'user-funcao',
  conselhoTipo: 'user-conselho-tipo',
  conselhoNumero: 'user-conselho-numero',
  matriculaProfessor: 'user-matricula-professor',
  projetoId: 'user-projeto-id'
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
        throw new Error('E-mail institucional inválido.');
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
          message: 'A conta foi criada com sucesso e está com credencial provisória ativa.'
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
                  >
                    <option value="">Selecione...</option>
                    {[1,2,3,4,5,6,7,8,9,10].map(p => (
                      <option key={p} value={`${p}º`}>{p}º Período</option>
                    ))}
                  </select>
                </div>

                <div className="form-group full-width flex flex-col gap-2 md:col-span-2">
                  <label htmlFor={USER_FIELD_IDS.supervisorId}>Supervisor (Professor) *</label>
                  <select className="user-field-select app-modal-select"
                    id={USER_FIELD_IDS.supervisorId}
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
                    <option value="diretoria_marketing">Diretoria de Marketing</option>
                    <option value="diretoria_ensino">Diretoria de Ensino</option>
                    <option value="diretoria_pesquisa">Diretoria de Pesquisa</option>
                    <option value="diretoria_extensao">Diretoria de Extensão</option>
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
                {formData.diretoria === 'diretoria_extensao' && (
                  <label className="form-group full-width user-coord-toggle" htmlFor={USER_FIELD_IDS.coordAtendimento}>
                    <input
                      id={USER_FIELD_IDS.coordAtendimento}
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
              <div className="readonly-field user-readonly-field">
                <Mail size={16} />
                <span>{formData.email || 'Aguardando nome completo...'}</span>
              </div>
            </div>

            {!initialData && (
              <div className="form-group flex flex-col gap-2">
                <label>Senha Inicial</label>
                <div className="readonly-field highlight user-readonly-field user-readonly-field--highlight">
                  <Key size={16} />
                  <span className="password-display">Gerada automaticamente no cadastro</span>
                </div>
                <small className="field-hint user-field-hint">A senha temporária será exibida apenas após criar o usuário.</small>
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










