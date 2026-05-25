import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle,
  ArrowRight,
  ArrowUp,
  Eye,
  EyeOff,
  Loader2,
  KeyRound,
  Lock,
  Mail,
  ShieldCheck,
  X
} from 'lucide-react';
import api, { getApiErrorMessage } from '../services/api';
import { isPastDate, isValidCpf, isValidEmail, normalizeCpf } from '../utils/validation';
import { formatCpf } from '../utils/formatters';
import { useModalBodyLock } from '../hooks/useModalBodyLock';
import { useModalFocusTrap } from '../hooks/useModalFocusTrap';
import { getRedirectPathFromRole, normalizeRole } from '../constants/roles';
import logoLaines from '../assets/LogoLaines.webp';
import './LoginPage.css';

const initialRequestForm = {
  nome: '',
  email: '',
  cpf: '',
  dataNascimento: '',
  telefone: '',
  area: 'nutricao',
  cargoSolicitado: 'professor',
  matricula: '',
  conselhoTipo: '',
  conselhoNumero: '',
  instituicao: '',
  diretoria: '',
  projetoId: '',
  projetoNome: '',
  justificativa: ''
};

const initialRecoveryForm = {
  identifier: '',
  cpf: '',
  dataNascimento: '',
  newPassword: '',
  confirmPassword: ''
};

const PASSWORD_COMPLEXITY_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showScrollTop, setShowScrollTop] = useState(false);

  const [requestOpen, setRequestOpen] = useState(false);
  const [requestForm, setRequestForm] = useState(initialRequestForm);
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestProjects, setRequestProjects] = useState([]);
  const [requestProjectsLoading, setRequestProjectsLoading] = useState(false);
  const [requestError, setRequestError] = useState('');
  const [requestSuccess, setRequestSuccess] = useState('');
  const accessRequestModalRef = useRef(null);
  const [recoverOpen, setRecoverOpen] = useState(false);
  const [recoverForm, setRecoverForm] = useState(initialRecoveryForm);
  const [recoverLoading, setRecoverLoading] = useState(false);
  const [recoverError, setRecoverError] = useState('');
  const [recoverSuccess, setRecoverSuccess] = useState('');
  const [recoverShowPassword, setRecoverShowPassword] = useState(false);
  const [recoverShowConfirmPassword, setRecoverShowConfirmPassword] = useState(false);
  const recoveryModalRef = useRef(null);
  const hasLoadedProjectsRef = useRef(false);
  const loadingProjectsRef = useRef(false);

  const { login, user, signed, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const isProfessorRequest = requestForm.cargoSolicitado === 'professor';
  const isProfissionalRequest = requestForm.cargoSolicitado === 'profissional';
  const canPickProject = isProfessorRequest || isProfissionalRequest;

  const loadPublicProjects = useCallback(async () => {
    if (hasLoadedProjectsRef.current || loadingProjectsRef.current) return;
    loadingProjectsRef.current = true;
    setRequestProjectsLoading(true);
    try {
      const { data } = await api.get('/projetos/public');
      const sorted = Array.isArray(data)
        ? data.slice().sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
        : [];
      setRequestProjects(sorted);
      hasLoadedProjectsRef.current = true;
    } catch (err) {
      console.error('Erro ao carregar projetos:', err);
      setRequestProjects([]);
    } finally {
      loadingProjectsRef.current = false;
      setRequestProjectsLoading(false);
    }
  }, []);

  useModalBodyLock(requestOpen || recoverOpen);
  useModalFocusTrap(requestOpen, accessRequestModalRef);
  useModalFocusTrap(recoverOpen, recoveryModalRef);

  useEffect(() => {
    document.body.classList.add('landing-page');
    return () => document.body.classList.remove('landing-page');
  }, []);

  useEffect(() => {
    if (signed && user && !authLoading) {
      navigate(getRedirectPathFromRole(normalizeRole(user.role)));
    }
  }, [signed, user, authLoading, navigate]);

  useEffect(() => {
    const getScrollTop = () => {
      const scrollingElement = document.scrollingElement || document.documentElement;
      return scrollingElement?.scrollTop ?? window.scrollY ?? 0;
    };

    let rafId = null;

    const handleScroll = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        const nextVisible = getScrollTop() > 360;
        setShowScrollTop((prev) => (prev === nextVisible ? prev : nextVisible));
      });
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, []);

  useEffect(() => {
    if (hasLoadedProjectsRef.current) return undefined;

    let timeoutId = null;
    let idleId = null;

    if (typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(() => {
        loadPublicProjects();
      }, { timeout: 1200 });
    } else {
      timeoutId = window.setTimeout(() => {
        loadPublicProjects();
      }, 320);
    }

    return () => {
      if (idleId !== null && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [loadPublicProjects]);

  const handleOpenRequest = () => {
    if (!hasLoadedProjectsRef.current && !loadingProjectsRef.current) {
      loadPublicProjects();
    }
    setRecoverOpen(false);
    setRequestOpen(true);
    setRequestError('');
    setRequestSuccess('');
  };

  const handleCloseRequest = () => {
    setRequestOpen(false);
    setRequestForm(initialRequestForm);
    setRequestError('');
    setRequestSuccess('');
  };

  const handleOpenRecovery = () => {
    setRequestOpen(false);
    setRecoverOpen(true);
    setRecoverError('');
    setRecoverSuccess('');
    setRecoverShowPassword(false);
    setRecoverShowConfirmPassword(false);
    setRecoverForm((prev) => ({
      ...initialRecoveryForm,
      identifier: email.trim() || prev.identifier
    }));
  };

  const handleCloseRecovery = () => {
    setRecoverOpen(false);
    setRecoverForm(initialRecoveryForm);
    setRecoverError('');
    setRecoverSuccess('');
    setRecoverShowPassword(false);
    setRecoverShowConfirmPassword(false);
  };

  useEffect(() => {
    if (!requestOpen && !recoverOpen) return;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (recoverOpen) {
          handleCloseRecovery();
          return;
        }
        handleCloseRequest();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [recoverOpen, requestOpen]);

  const handleLogin = async (event) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const rawLogin = email.trim();
      const digits = normalizeCpf(rawLogin);
      const loginEmail = !rawLogin.includes('@') && digits.length === 11
        ? `${digits}@laines.ufrn.br`
        : rawLogin;
      await login(loginEmail, password);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Credenciais inválidas ou erro de conexão.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestChange = (field) => (event) => {
    setRequestForm((prev) => ({ ...prev, [field]: event.target.value }));
  };


  const handleRequestCpfChange = (event) => {
    const formatted = formatCpf(event.target.value);
    setRequestForm((prev) => ({ ...prev, cpf: formatted }));
  };

  const handleRequestProjectChange = (event) => {
    const projectId = event.target.value;
    const project = requestProjects.find((item) => item.id === projectId);
    setRequestForm((prev) => ({
      ...prev,
      projetoId: projectId,
      projetoNome: project?.nome || ''
    }));
  };

  const handleRequestSubmit = async (event) => {
    event.preventDefault();
    setRequestError('');
    setRequestSuccess('');

    if (!requestForm.nome.trim() || !requestForm.email.trim() || !requestForm.cpf.trim()) {
      setRequestError('Nome, e-mail e CPF são obrigatórios.');
      return;
    }
    if (!isValidEmail(requestForm.email.trim())) {
      setRequestError('E-mail inválido.');
      return;
    }
    if (!isValidCpf(normalizeCpf(requestForm.cpf))) {
      setRequestError('CPF inválido.');
      return;
    }
    if (!requestForm.dataNascimento || !isPastDate(requestForm.dataNascimento)) {
      setRequestError('Data de nascimento inválida.');
      return;
    }
    if (isProfessorRequest && !requestForm.matricula.trim()) {
      setRequestError('Matrícula obrigatória para professor.');
      return;
    }
    if (isProfissionalRequest && !requestForm.conselhoTipo.trim()) {
      setRequestError('Selecione o conselho profissional.');
      return;
    }
    if (isProfissionalRequest && !requestForm.conselhoNumero.trim()) {
      setRequestError('Número do conselho obrigatório para profissional.');
      return;
    }

    setRequestLoading(true);
    try {
      await api.post('/solicitacoes-acesso', {
        ...requestForm,
        nome: requestForm.nome.trim(),
        email: requestForm.email.trim(),
        cpf: requestForm.cpf.trim()
      });
      setRequestSuccess('Solicitação enviada com sucesso. Você receberá retorno por e-mail após a análise da coordenação.');
      setRequestForm(initialRequestForm);
    } catch (err) {
      console.error('Erro ao enviar solicitação:', err);
      setRequestError(getApiErrorMessage(err, 'Não foi possível enviar a solicitação.'));
    } finally {
      setRequestLoading(false);
    }
  };

  const handleRecoveryChange = (field) => (event) => {
    setRecoverForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleRecoveryCpfChange = (event) => {
    const formatted = formatCpf(event.target.value);
    setRecoverForm((prev) => ({ ...prev, cpf: formatted }));
  };

  const handleRecoverySubmit = async (event) => {
    event.preventDefault();
    setRecoverError('');
    setRecoverSuccess('');

    const identifier = recoverForm.identifier.trim();
    const cpfDigits = normalizeCpf(recoverForm.cpf);

    if (!identifier || !recoverForm.cpf.trim() || !recoverForm.dataNascimento) {
      setRecoverError('Informe identificador, CPF e data de nascimento.');
      return;
    }
    if (identifier.includes('@') && !isValidEmail(identifier)) {
      setRecoverError('Identificador de login invalido.');
      return;
    }
    if (!identifier.includes('@') && normalizeCpf(identifier).length !== 11) {
      setRecoverError('Use e-mail ou CPF (11 digitos) no identificador.');
      return;
    }
    if (!isValidCpf(cpfDigits)) {
      setRecoverError('CPF invalido.');
      return;
    }
    if (!isPastDate(recoverForm.dataNascimento)) {
      setRecoverError('Data de nascimento invalida.');
      return;
    }
    if (!recoverForm.newPassword || recoverForm.newPassword.length < 8) {
      setRecoverError('A nova senha deve ter ao menos 8 caracteres.');
      return;
    }
    if (!PASSWORD_COMPLEXITY_REGEX.test(recoverForm.newPassword)) {
      setRecoverError('A senha deve conter letra maiuscula, minuscula e numero.');
      return;
    }
    if (recoverForm.newPassword !== recoverForm.confirmPassword) {
      setRecoverError('A confirmacao da senha nao confere.');
      return;
    }

    setRecoverLoading(true);
    try {
      await api.post('/auth/recover-password', {
        identifier,
        cpf: recoverForm.cpf.trim(),
        dataNascimento: recoverForm.dataNascimento,
        newPassword: recoverForm.newPassword
      });
      setRecoverSuccess('Senha redefinida com sucesso. Voce ja pode entrar no sistema.');
      setRecoverForm(initialRecoveryForm);
    } catch (err) {
      console.error('Erro ao recuperar senha:', err);
      setRecoverError(getApiErrorMessage(err, 'Nao foi possivel recuperar a senha.'));
    } finally {
      setRecoverLoading(false);
    }
  };

  return (
    <>
      <div className="landing-v2">
        <div className="landing-v2__ambient landing-v2__ambient--one" />
        <div className="landing-v2__ambient landing-v2__ambient--two" />
        <div className="landing-v2__ambient landing-v2__ambient--three" />

        <motion.header
          className="landing-topbar"
          initial={{ opacity: 0, y: -24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="landing-container landing-topbar__inner">
            <a href="#inicio" className="landing-brand">
              <img src={logoLaines} alt="LAINES" width="512" height="512" decoding="async" />
              <div>
                <strong>LAINES</strong>
                <span>Plataforma clínico-educacional</span>
              </div>
            </a>
          </div>
        </motion.header>

        <main id="inicio">
          <section className="landing-hero">
            <div className="landing-container landing-hero__grid">
              <motion.div
                className="landing-hero__copy"
                initial={{ opacity: 0, y: 26 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7 }}
              >
                <h1>Sistema LAINES para acompanhamento clínico-esportivo</h1>
                <p>
                  Liga acadêmica interprofissional de nutrição esportiva - UFRN.
                </p>
              </motion.div>

              <motion.aside
                id="acesso"
                className="landing-login-panel"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.1 }}
              >
                <header>
                  <p>Acesso ao sistema</p>
                  <h2>Entrar na plataforma</h2>
                  <small>Use CPF (somente números) ou e-mail institucional.</small>
                </header>

                <form onSubmit={handleLogin} className="landing-login-form">
                  <label className="landing-field">
                    <span>CPF ou e-mail</span>
                    <div className="field-shell">
                      <Mail size={17} />
                      <input
                        type="text"
                        required
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="usuario@laines.ufrn.br"
                        autoComplete="username"
                      />
                    </div>
                  </label>

                  <label className="landing-field">
                    <span>Senha</span>
                    <div className="field-shell">
                      <Lock size={17} />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="Sua senha"
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        className="password-visibility"
                        onClick={() => setShowPassword((prev) => !prev)}
                        aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      >
                        {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                    </div>
                  </label>

                  <button type="submit" className="landing-submit" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 size={17} className="spin" />
                        Entrando...
                      </>
                    ) : (
                      <>
                        <ShieldCheck size={17} />
                        Entrar agora
                      </>
                    )}
                  </button>

                  <AnimatePresence>
                    {error && (
                      <motion.div
                        className="landing-error"
                        role="alert"
                        aria-live="assertive"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 6 }}
                      >
                        <AlertCircle size={16} />
                        <span>{error}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="landing-login-recovery">
                    <button type="button" onClick={handleOpenRecovery}>
                      <KeyRound size={15} />
                      Esqueci minha senha
                    </button>
                  </div>

                  <div className="landing-login-panel__foot">
                    <p>Não possui acesso?</p>
                    <button type="button" onClick={handleOpenRequest}>
                      Solicitar acesso institucional
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </form>
              </motion.aside>
            </div>
          </section>
        </main>

        <footer className="landing-footer-v2">
          <div className="landing-container landing-footer-v2__inner">
            <div className="landing-footer-v2__brand">
              <img src={logoLaines} alt="LAINES" width="512" height="512" loading="lazy" decoding="async" />
              <div>
                <strong>LAINES</strong>
                <span>Plataforma de gestão clínica e educacional</span>
              </div>
            </div>
            <small>© 2026 LAINES. Ambiente operacional para ensino e cuidado.</small>
          </div>
        </footer>
      </div>

      {showScrollTop && (
        <button
          type="button"
          className="scroll-top-floating"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Voltar ao topo"
        >
          <ArrowUp size={18} />
        </button>
      )}

      <AnimatePresence>
        {requestOpen && (
          <motion.div
            className="request-modal-overlay app-modal-overlay"
            role="presentation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) handleCloseRequest();
            }}
          >
            <motion.div
              className="request-modal app-modal-shell app-modal-shell--lg app-modal-shell--scrollable"
              ref={accessRequestModalRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="request-access-modal-title"
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.98 }}
            >
              <div className="request-modal-header app-modal-header">
                <div className="app-modal-heading">
                  <h3 id="request-access-modal-title" className="app-modal-title">Solicitar acesso</h3>
                  <p className="app-modal-subtitle">Solicitação sujeita à aprovação da coordenação, com retorno por e-mail.</p>
                </div>
                <button type="button" className="app-modal-close" onClick={handleCloseRequest} aria-label="Fechar">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleRequestSubmit} className="request-form app-modal-body">
                <div className="request-grid">
                  <label className="request-field">
                    <span>Nome completo</span>
                    <input
                      type="text"
                      value={requestForm.nome}
                      onChange={handleRequestChange('nome')}
                      placeholder="Seu nome"
                      required
                    />
                  </label>

                  <label className="request-field">
                    <span>CPF</span>
                    <input
                      type="text"
                      value={requestForm.cpf}
                      onChange={handleRequestCpfChange}
                      placeholder="000.000.000-00"
                      maxLength="14"
                      required
                    />
                  </label>

                  <label className="request-field">
                    <span>Data de nascimento</span>
                    <input
                      type="date"
                      value={requestForm.dataNascimento}
                      onChange={handleRequestChange('dataNascimento')}
                      required
                    />
                  </label>

                  <label className="request-field">
                    <span>E-mail</span>
                    <input
                      type="email"
                      value={requestForm.email}
                      onChange={handleRequestChange('email')}
                      placeholder="seu@email.com"
                      required
                    />
                  </label>

                  <label className="request-field">
                    <span>Telefone</span>
                    <input
                      type="tel"
                      value={requestForm.telefone}
                      onChange={handleRequestChange('telefone')}
                      placeholder="(00) 00000-0000"
                    />
                  </label>

                  <label className="request-field">
                    <span>Instituição</span>
                    <input
                      type="text"
                      value={requestForm.instituicao}
                      onChange={handleRequestChange('instituicao')}
                      placeholder="Universidade, secretaria, clube..."
                    />
                  </label>

                  <label className="request-field">
                    <span>Área</span>
                    <select value={requestForm.area} onChange={handleRequestChange('area')}>
                      <option value="nutricao">Nutrição</option>
                      <option value="fisioterapia">Fisioterapia</option>
                      <option value="psicologia">Psicologia</option>
                      <option value="outros">Outros</option>
                    </select>
                  </label>

                  <label className="request-field">
                    <span>Cargo solicitado</span>
                    <select value={requestForm.cargoSolicitado} onChange={handleRequestChange('cargoSolicitado')}>
                      <option value="professor">Professor</option>
                      <option value="profissional">Profissional</option>
                    </select>
                  </label>

                  <label className="request-field">
                    <span>Diretoria (opcional)</span>
                    <select value={requestForm.diretoria} onChange={handleRequestChange('diretoria')}>
                      <option value="">Sem diretoria</option>
                      <option value="diretoria_marketing">Diretoria de Marketing</option>
                      <option value="diretoria_ensino">Diretoria de Ensino</option>
                      <option value="diretoria_pesquisa">Diretoria de Pesquisa</option>
                      <option value="diretoria_extensao">Diretoria de Extensão</option>
                    </select>
                  </label>

                  {isProfessorRequest && (
                    <label className="request-field">
                      <span>Matrícula</span>
                      <input
                        type="text"
                        value={requestForm.matricula}
                        onChange={handleRequestChange('matricula')}
                        placeholder="Sua matrícula"
                        required
                      />
                    </label>
                  )}

                  {isProfissionalRequest && (
                    <>
                      <label className="request-field">
                        <span>Conselho profissional</span>
                        <select
                          value={requestForm.conselhoTipo}
                          onChange={handleRequestChange('conselhoTipo')}
                          required
                        >
                          <option value="">Selecione...</option>
                          <option value="CRN">CRN</option>
                          <option value="CREFITO">CREFITO</option>
                          <option value="CRP">CRP</option>
                          <option value="OUTRO">Outro</option>
                        </select>
                      </label>

                      <label className="request-field">
                        <span>Número do conselho</span>
                        <input
                          type="text"
                          value={requestForm.conselhoNumero}
                          onChange={handleRequestChange('conselhoNumero')}
                          placeholder="Registro profissional"
                          required
                        />
                      </label>
                    </>
                  )}

                  {canPickProject && (
                    <label className="request-field full">
                      <span>Projeto parceiro (opcional)</span>
                      <select
                        value={requestForm.projetoId}
                        onChange={handleRequestProjectChange}
                        disabled={requestProjectsLoading}
                      >
                        <option value="">{requestProjectsLoading ? 'Carregando...' : 'Sem projeto'}</option>
                        {requestProjects.map((project) => (
                          <option key={project.id} value={project.id}>
                            {project.nome}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  <label className="request-field full">
                    <span>Justificativa de uso (opcional)</span>
                    <textarea
                      rows="4"
                      value={requestForm.justificativa}
                      onChange={handleRequestChange('justificativa')}
                      placeholder="Conte, de forma breve, como pretende usar a plataforma."
                    />
                  </label>
                </div>

                {requestError && <div className="request-message error">{requestError}</div>}
                {requestSuccess && <div className="request-message success">{requestSuccess}</div>}

                <div className="request-actions app-modal-footer">
                  <button
                    type="button"
                    className="request-secondary app-modal-btn app-modal-btn--secondary"
                    onClick={handleCloseRequest}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="request-primary app-modal-btn app-modal-btn--primary"
                    disabled={requestLoading}
                  >
                    {requestLoading ? 'Enviando...' : 'Enviar solicitação'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {recoverOpen && (
          <motion.div
            className="request-modal-overlay app-modal-overlay"
            role="presentation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) handleCloseRecovery();
            }}
          >
            <motion.div
              className="request-modal recovery-modal app-modal-shell"
              ref={recoveryModalRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="recovery-modal-title"
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.98 }}
            >
              <div className="request-modal-header app-modal-header">
                <div className="app-modal-heading">
                  <h3 id="recovery-modal-title" className="app-modal-title">Recuperar senha</h3>
                  <p className="app-modal-subtitle">Informe seus dados para redefinir a senha de acesso.</p>
                </div>
                <button type="button" className="app-modal-close" onClick={handleCloseRecovery} aria-label="Fechar">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleRecoverySubmit} className="request-form app-modal-body">
                <div className="request-grid recovery-grid">
                  <label className="request-field full">
                    <span>CPF ou e-mail cadastrado</span>
                    <input
                      type="text"
                      value={recoverForm.identifier}
                      onChange={handleRecoveryChange('identifier')}
                      placeholder="usuario@laines.ufrn.br ou 00000000000"
                      autoComplete="username"
                      required
                    />
                  </label>

                  <label className="request-field">
                    <span>CPF</span>
                    <input
                      type="text"
                      value={recoverForm.cpf}
                      onChange={handleRecoveryCpfChange}
                      placeholder="000.000.000-00"
                      maxLength="14"
                      required
                    />
                  </label>

                  <label className="request-field">
                    <span>Data de nascimento</span>
                    <input
                      type="date"
                      value={recoverForm.dataNascimento}
                      onChange={handleRecoveryChange('dataNascimento')}
                      required
                    />
                  </label>

                  <label className="request-field">
                    <span>Nova senha</span>
                    <div className="field-shell">
                      <Lock size={17} />
                      <input
                        type={recoverShowPassword ? 'text' : 'password'}
                        value={recoverForm.newPassword}
                        onChange={handleRecoveryChange('newPassword')}
                        placeholder="Nova senha"
                        autoComplete="new-password"
                        required
                      />
                      <button
                        type="button"
                        className="password-visibility"
                        onClick={() => setRecoverShowPassword((prev) => !prev)}
                        aria-label={recoverShowPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      >
                        {recoverShowPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                    </div>
                  </label>

                  <label className="request-field">
                    <span>Confirmar nova senha</span>
                    <div className="field-shell">
                      <Lock size={17} />
                      <input
                        type={recoverShowConfirmPassword ? 'text' : 'password'}
                        value={recoverForm.confirmPassword}
                        onChange={handleRecoveryChange('confirmPassword')}
                        placeholder="Repita a nova senha"
                        autoComplete="new-password"
                        required
                      />
                      <button
                        type="button"
                        className="password-visibility"
                        onClick={() => setRecoverShowConfirmPassword((prev) => !prev)}
                        aria-label={recoverShowConfirmPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      >
                        {recoverShowConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                    </div>
                  </label>
                </div>

                {recoverError && <div className="request-message error">{recoverError}</div>}
                {recoverSuccess && <div className="request-message success">{recoverSuccess}</div>}

                <div className="request-actions app-modal-footer">
                  <button
                    type="button"
                    className="request-secondary app-modal-btn app-modal-btn--secondary"
                    onClick={handleCloseRecovery}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="request-primary app-modal-btn app-modal-btn--primary"
                    disabled={recoverLoading}
                  >
                    {recoverLoading ? 'Redefinindo...' : 'Redefinir senha'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default LoginPage;
