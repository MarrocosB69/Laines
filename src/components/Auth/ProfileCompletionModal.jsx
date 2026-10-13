import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CheckCircle2, LogOut, Save, UserRound, X } from 'lucide-react';
import api, { getApiErrorMessage } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { isStudentMemberRole, normalizeRole } from '../../constants/roles';
import { useModalBodyLock } from '../../hooks/useModalBodyLock';
import { useModalFocusTrap } from '../../hooks/useModalFocusTrap';
import {
  getProfileCompletionState,
  getRequiredFieldLabel
} from '../../utils/profileCompletion';
import './ProfileCompletionModal.css';

const buildInitialForm = (user) => ({
  name: user?.name || '',
  cpf: user?.cpf || '',
  telefone: user?.telefone || '',
  dataNascimento: user?.dataNascimento || '',
  matricula: user?.matricula || '',
  curso: user?.curso || '',
  periodo: user?.periodo || '',
  supervisorId: user?.supervisorId || '',
  projetoId: user?.projetoId || ''
});

const ProfileCompletionModal = ({ isOpen, user }) => {
  const { updateProfile, listSupervisors, logout } = useAuth();
  const [form, setForm] = useState(() => buildInitialForm(user));
  const [supervisors, setSupervisors] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const modalRef = useRef(null);

  useModalBodyLock(isOpen);
  useModalFocusTrap(isOpen, modalRef);

  const role = normalizeRole(user?.role);
  const isStudent = isStudentMemberRole(role);
  const completionState = useMemo(() => getProfileCompletionState({
    ...user,
    ...form
  }), [form, user]);

  useEffect(() => {
    if (!isOpen) return;
    setForm(buildInitialForm(user));
    setError('');
  }, [isOpen, user]);

  useEffect(() => {
    if (!isOpen || !isStudent) return;
    let active = true;

    const loadOptions = async () => {
      setLoadingOptions(true);
      try {
        const [supervisorsResponse, projectsResponse] = await Promise.all([
          listSupervisors(),
          api.get('/projetos')
        ]);
        if (!active) return;
        setSupervisors(Array.isArray(supervisorsResponse) ? supervisorsResponse : []);
        const rows = Array.isArray(projectsResponse.data) ? projectsResponse.data : [];
        setProjects(rows);
      } catch (loadError) {
        if (!active) return;
        setError(getApiErrorMessage(loadError, 'Não foi possível carregar professores e projetos.'));
      } finally {
        if (active) {
          setLoadingOptions(false);
        }
      }
    };

    loadOptions();
    return () => {
      active = false;
    };
  }, [isOpen, isStudent, listSupervisors]);

  const handleFieldChange = (field) => (event) => {
    const nextValue = event.target.value;
    setError('');
    setForm((prev) => ({
      ...prev,
      [field]: nextValue
    }));
  };

  const handleSubmit = async (event) => {
    event?.preventDefault?.();
    setError('');

    if (completionState.missingFields.length > 0) {
      const firstMissing = completionState.missingFields[0];
      setError(`Preencha o campo obrigatório: ${getRequiredFieldLabel(firstMissing)}.`);
      return;
    }

    setSaving(true);
    try {
      await updateProfile({
        name: form.name,
        cpf: form.cpf,
        telefone: form.telefone,
        dataNascimento: form.dataNascimento,
        matricula: form.matricula,
        curso: form.curso,
        periodo: form.periodo,
        supervisorId: isStudent ? form.supervisorId : undefined,
        projetoId: isStudent ? form.projetoId : undefined
      });
    } catch (submitError) {
      setError(getApiErrorMessage(submitError, 'Não foi possível atualizar o cadastro obrigatório.'));
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !user) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="profile-completion-overlay app-modal-overlay" role="presentation">
      <div
        className="profile-completion-modal app-modal-shell app-modal-shell--lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-completion-title"
        tabIndex={-1}
        ref={modalRef}
      >
        <div className="app-modal-header profile-completion-header">
          <div className="profile-completion-icon app-modal-header-icon" aria-hidden="true">
            <UserRound size={20} />
          </div>
          <div className="app-modal-heading">
            <h2 id="profile-completion-title" className="app-modal-title">Complete seu cadastro</h2>
            <p className="app-modal-subtitle">
              Precisamos dos dados obrigatórios para liberar o uso completo do sistema.
            </p>
          </div>
          <button
            type="button"
            className="app-modal-close"
            onClick={logout}
            disabled={saving}
            aria-label="Sair da sessão"
            title="Sair"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <form className="app-modal-body profile-completion-form" onSubmit={handleSubmit} noValidate>
          <div className="profile-completion-required">
            <strong>Campos obrigatórios</strong>
            <div className="profile-completion-required-list">
              {completionState.requiredFields.map((field) => {
                const missing = completionState.missingFields.includes(field);
                return (
                  <span key={field} className={`profile-completion-required-item ${missing ? 'pending' : 'ok'}`}>
                    {missing ? <AlertCircle size={13} aria-hidden="true" /> : <CheckCircle2 size={13} aria-hidden="true" />}
                    {getRequiredFieldLabel(field)}
                    <span className="profile-completion-sr">{missing ? ' (pendente)' : ' (preenchido)'}</span>
                  </span>
                );
              })}
            </div>
          </div>

          <div className="profile-completion-grid">
            <label className="profile-completion-field">
              <span>Nome completo *</span>
              <input value={form.name} onChange={handleFieldChange('name')} required />
            </label>
            <label className="profile-completion-field">
              <span>CPF *</span>
              <input value={form.cpf} onChange={handleFieldChange('cpf')} required />
            </label>
            <label className="profile-completion-field">
              <span>Telefone *</span>
              <input value={form.telefone} onChange={handleFieldChange('telefone')} required />
            </label>
            <label className="profile-completion-field">
              <span>Data de nascimento *</span>
              <input
                type="date"
                value={form.dataNascimento}
                onChange={handleFieldChange('dataNascimento')}
                required
              />
            </label>

            {isStudent && (
              <>
                <label className="profile-completion-field">
                  <span>Matrícula *</span>
                  <input value={form.matricula} onChange={handleFieldChange('matricula')} required />
                </label>
                <label className="profile-completion-field">
                  <span>Curso *</span>
                  <input value={form.curso} onChange={handleFieldChange('curso')} required />
                </label>
                <label className="profile-completion-field">
                  <span>Período *</span>
                  <input value={form.periodo} onChange={handleFieldChange('periodo')} required />
                </label>
                <label className="profile-completion-field">
                  <span>Professor supervisor <small>(necessário para atender; não bloqueia a Liga)</small></span>
                  <select
                    value={form.supervisorId}
                    onChange={handleFieldChange('supervisorId')}
                    disabled={loadingOptions}
                  >
                    <option value="">Selecione</option>
                    {supervisors.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="profile-completion-field profile-completion-field--full">
                  <span>Projeto <small>(necessário para atender; não bloqueia a Liga)</small></span>
                  <select
                    value={form.projetoId}
                    onChange={handleFieldChange('projetoId')}
                    disabled={loadingOptions}
                  >
                    <option value="">Selecione</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.nome}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
          </div>

          {error && (
            <div className="profile-completion-error" role="alert">
              <AlertCircle size={14} aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}
        </form>

        <div className="app-modal-footer">
          <div className="app-modal-actions">
            <button
              type="button"
              className="app-modal-btn app-modal-btn--secondary"
              onClick={logout}
              disabled={saving}
            >
              <LogOut size={14} aria-hidden="true" />
              Sair
            </button>
            <button
              type="button"
              className="app-modal-btn app-modal-btn--primary"
              onClick={handleSubmit}
              disabled={saving || loadingOptions}
            >
              <Save size={14} aria-hidden="true" />
              {saving ? 'Salvando...' : 'Salvar cadastro'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ProfileCompletionModal;
