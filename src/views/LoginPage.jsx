import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api, { getApiErrorMessage } from '../services/api';
import { isPastDate, isValidCpf, isValidEmail, normalizeCpf } from '../utils/validation';
import { formatCpf } from '../utils/formatters';
import { useModalBodyLock } from '../hooks/useModalBodyLock';
import { useModalFocusTrap } from '../hooks/useModalFocusTrap';
import { getRedirectPathFromRole, normalizeRole } from '../constants/roles';
import PistaCena from './landing/PistaCena';
import HeroCopy from './landing/HeroCopy';
import LoginPanel from './landing/LoginPanel';
import AreasLiga from './landing/AreasLiga';
import SiteFooter from './landing/SiteFooter';
import AccessRequestModal from './landing/AccessRequestModal';
import PasswordRecoveryModal from './landing/PasswordRecoveryModal';
// Uma folha por superficie, para que cada uma seja trabalhada sem colidir com
// as outras. A ordem importa: tokens, base, pecas e, por ultimo, o responsivo.
import './landing/landing-tokens.css';
import './landing/landing-base.css';
import './landing/landing-hero.css';
import './landing/landing-login.css';
import './landing/landing-areas.css';
import './landing/landing-modais.css';
// Sempre por ultimo: as regras de celular precisam vir depois das de desktop.
import './landing/landing-responsivo.css';

// A entrada orquestrada (~2 s) toca uma vez por sessao do navegador: quem sai
// e volta ao login, ou recarrega a pagina, encontra o formulario pronto. Na
// recuperacao de senha o modal abre de imediato, sem entrada por tras.
const ENTRADA_KEY = 'laines:landing-entrada';
const deveTocarEntrada = () => {
  if (window.location.pathname === '/recuperar-senha') return false;
  try {
    return !window.sessionStorage.getItem(ENTRADA_KEY);
  } catch {
    return false;
  }
};

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
  newPassword: '',
  confirmPassword: ''
};

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  // Leitura pura no inicializador (o StrictMode o chama duas vezes); a marca
  // de "ja tocou" e gravada no efeito abaixo.
  const [entrada] = useState(deveTocarEntrada);

  const [requestOpen, setRequestOpen] = useState(false);
  const [requestForm, setRequestForm] = useState(initialRequestForm);
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestProjects, setRequestProjects] = useState([]);
  const [requestProjectsLoading, setRequestProjectsLoading] = useState(false);
  const [requestError, setRequestError] = useState('');
  const [requestSuccess, setRequestSuccess] = useState('');
  const accessRequestModalRef = useRef(null);
  const [recoveryToken, setRecoveryToken] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token') || '');
  const [recoverOpen, setRecoverOpen] = useState(() => window.location.pathname === '/recuperar-senha');
  const [recoverStep, setRecoverStep] = useState(() => /^[a-f0-9]{64}$/.test(recoveryToken) ? 'reset' : 'identify');
  useEffect(() => {
    if (new URLSearchParams(window.location.hash.slice(1)).has('token')) {
      window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
    }
  }, []);
  const [recoverForm, setRecoverForm] = useState(initialRecoveryForm);
  const [recoverLoading, setRecoverLoading] = useState(false);
  const [recoverError, setRecoverError] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const recoveryModalRef = useRef(null);
  const hasLoadedProjectsRef = useRef(false);
  const loadingProjectsRef = useRef(false);

  const { login, logout, user, signed, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const isProfessorRequest = requestForm.cargoSolicitado === 'professor';
  const isProfissionalRequest = requestForm.cargoSolicitado === 'profissional';

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
    if (!entrada) return;
    try {
      window.sessionStorage.setItem(ENTRADA_KEY, '1');
    } catch {
      // Sem sessionStorage a entrada volta a tocar no proximo carregamento;
      // nenhum outro efeito.
    }
  }, [entrada]);

  useEffect(() => {
    if (signed && user && !authLoading && window.location.pathname !== '/recuperar-senha') {
      navigate(getRedirectPathFromRole(normalizeRole(user.role), user));
    }
  }, [signed, user, authLoading, navigate]);

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
    setRecoverStep('identify');
    setRecoverError('');
    setRecoverForm((prev) => ({
      ...initialRecoveryForm,
      identifier: email.trim() || prev.identifier
    }));
  };

  const handleCloseRecovery = () => {
    setRecoveryToken('');
    setRecoverOpen(false);
    setRecoverStep('identify');
    setRecoverForm(initialRecoveryForm);
    setRecoverError('');
    setShowNewPassword(false);
    setShowConfirmPassword(false);
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

  const resolveLoginError = (err) => {
    const status = Number(err?.response?.status || 0);
    if (status === 401) return 'E-mail, CPF ou senha incorretos.';
    if (status === 423 || status === 429) return 'Acesso temporariamente bloqueado. Aguarde alguns minutos e tente novamente.';
    if (status === 503 || !err?.response) return 'Sistema temporariamente indisponível. Tente novamente em alguns minutos.';
    return getApiErrorMessage(err, 'Não foi possível entrar. Tente novamente.');
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const rawLogin = email.trim();
      const digits = normalizeCpf(rawLogin);
      if (!rawLogin.includes('@') && digits.length === 11 && !isValidCpf(digits)) {
        setError('CPF inválido. Verifique os dígitos informados.');
        return;
      }
      const loginEmail = !rawLogin.includes('@') && digits.length === 11
        ? `${digits}@laines.ufrn.br`
        : rawLogin;
      await login(loginEmail, password);
    } catch (err) {
      setError(resolveLoginError(err));
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

  const handleRecoverFieldChange = (field) => (event) => {
    setRecoverForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleRecoveryBackToIdentify = () => {
    setRecoverStep('identify');
    setRecoverError('');
  };

  const handleRecoveryIdentifySubmit = async (event) => {
    event.preventDefault();
    setRecoverError('');
    const identifier = recoverForm.identifier.trim();
    if (!isValidEmail(identifier)) { setRecoverError('Informe seu e-mail de acesso.'); return; }
    setRecoverLoading(true);
    try {
      await api.post('/auth/recovery-request', { identifier });
      setRecoverStep('sent');
    } catch (err) {
      setRecoverError(getApiErrorMessage(err, 'Nao foi possivel solicitar o link. Tente novamente mais tarde.'));
    } finally { setRecoverLoading(false); }
  };

  const handleRecoveryResetSubmit = async (event) => {
    event.preventDefault();
    setRecoverError('');
    const { newPassword, confirmPassword } = recoverForm;
    if (newPassword.length < 8) {
      setRecoverError('A senha deve ter pelo menos 8 caracteres.');
      return;
    }
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
      setRecoverError('A senha deve conter ao menos 1 letra maiúscula, 1 minúscula e 1 número.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setRecoverError('As senhas não coincidem.');
      return;
    }
    setRecoverLoading(true);
    try {
      await api.post('/auth/recover-password', {
        token: recoveryToken,
        newPassword
      });
      await logout();
      setRecoveryToken('');
      setRecoverStep('done');
    } catch (err) {
      const msg = getApiErrorMessage(err, 'Não foi possível redefinir a senha.');
      setRecoverError(msg);
    } finally {
      setRecoverLoading(false);
    }
  };

  return (
    <>
      {/* data-entrada liga a entrada orquestrada; sem ele, o CSS em repouso
          ja e o estado final (docs/implementacao/landing-v2/change-intent.md). */}
      <div className="lp" data-entrada={entrada ? '' : undefined}>
        <main id="inicio">
          <div className="lp-primeira">
            <PistaCena />
            <HeroCopy />
            <div className="lp-painel" id="acesso">
              <LoginPanel
                email={email}
                onEmailChange={setEmail}
                password={password}
                onPasswordChange={setPassword}
                showPassword={showPassword}
                onToggleShowPassword={() => setShowPassword((prev) => !prev)}
                isLoading={isLoading}
                error={error}
                onSubmit={handleLogin}
                onOpenRecovery={handleOpenRecovery}
                onOpenRequest={handleOpenRequest}
              />
            </div>
          </div>
          <AreasLiga />
        </main>

        <SiteFooter />
      </div>

      <AccessRequestModal
        open={requestOpen}
        modalRef={accessRequestModalRef}
        form={requestForm}
        onFieldChange={handleRequestChange}
        onCpfChange={handleRequestCpfChange}
        onProjectChange={handleRequestProjectChange}
        projects={requestProjects}
        projectsLoading={requestProjectsLoading}
        loading={requestLoading}
        error={requestError}
        success={requestSuccess}
        onSubmit={handleRequestSubmit}
        onClose={handleCloseRequest}
      />

      <PasswordRecoveryModal
        open={recoverOpen}
        modalRef={recoveryModalRef}
        step={recoverStep}
        form={recoverForm}
        onFieldChange={handleRecoverFieldChange}
        loading={recoverLoading}
        error={recoverError}
        showNewPassword={showNewPassword}
        showConfirmPassword={showConfirmPassword}
        onToggleNewPassword={() => setShowNewPassword((prev) => !prev)}
        onToggleConfirmPassword={() => setShowConfirmPassword((prev) => !prev)}
        onIdentifySubmit={handleRecoveryIdentifySubmit}
        onResetSubmit={handleRecoveryResetSubmit}
        onBackToIdentify={handleRecoveryBackToIdentify}
        onClose={handleCloseRecovery}
      />
    </>
  );
};

export default LoginPage;
