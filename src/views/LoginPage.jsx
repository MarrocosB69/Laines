import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle,
  ArrowRight,
  ArrowUp,
  BarChart3,
  BookOpenCheck,
  CalendarDays,
  ClipboardList,
  Eye,
  EyeOff,
  HeartPulse,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
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

const accessGuides = [
  {
    id: 'acesso-existente',
    title: 'Já tenho acesso',
    description: 'Utilize seu e-mail e senha para entrar.',
    icon: ShieldCheck
  },
  {
    id: 'acesso-institucional',
    title: 'Sou aluno / professor',
    description: 'Solicite acesso institucional.',
    icon: BookOpenCheck
  },
  {
    id: 'acesso-atleta',
    title: 'Sou atleta',
    description: 'Acesse com os dados fornecidos pela equipe.',
    icon: HeartPulse
  }
];

const usageCards = [
  {
    id: 'uso-professor',
    title: 'Professor',
    icon: Users,
    points: ['Supervisiona atendimentos', 'Acompanha alunos']
  },
  {
    id: 'uso-aluno',
    title: 'Aluno',
    icon: BookOpenCheck,
    points: ['Registra avaliações', 'Realiza atendimentos']
  },
  {
    id: 'uso-atleta',
    title: 'Atleta',
    icon: HeartPulse,
    points: ['Acompanha evolução', 'Acessa histórico']
  }
];

const systemCapabilities = [
  { icon: ClipboardList, text: 'Registrar avaliações clínicas' },
  { icon: TrendingUp, text: 'Acompanhar evolução dos atletas' },
  { icon: CalendarDays, text: 'Gerenciar agenda e atendimentos' },
  { icon: BarChart3, text: 'Gerar relatórios' }
];

const heroTags = ['Nutrição esportiva', 'Multiprofissional', 'Prontuário digital', 'Web e mobile'];

const heroMetrics = [
  { value: '14+', label: 'Módulos de avaliação' },
  { value: '6', label: 'Perfis de acesso' },
  { value: '100%', label: 'Web e mobile' }
];

const landingNavLinks = [
  { id: 'acesso', label: 'Acesso' },
  { id: 'como-acessar', label: 'Como acessar' },
  { id: 'como-funciona', label: 'Como funciona' },
  { id: 'recursos', label: 'Recursos' },
  { id: 'faq', label: 'FAQ' }
];

const landingFaq = [
  {
    id: 'faq-acesso',
    question: 'Quem deve solicitar acesso institucional?',
    answer: 'Alunos e professores que ainda não possuem credenciais ativas no sistema.'
  },
  {
    id: 'faq-atleta',
    question: 'Atletas precisam solicitar acesso?',
    answer: 'Não. O acesso do atleta é disponibilizado pela equipe responsável pelo acompanhamento.'
  },
  {
    id: 'faq-perfil',
    question: 'O que acontece após entrar?',
    answer: 'Cada utilizador é direcionado automaticamente para a área do seu perfil.'
  }
];

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

  useModalBodyLock(requestOpen);
  useModalFocusTrap(requestOpen, accessRequestModalRef);

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

  useEffect(() => {
    if (!requestOpen) return;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleCloseRequest();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [requestOpen]);

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

            <nav className="landing-topbar__nav" aria-label="Navegação principal da landing">
              {landingNavLinks.map((item) => (
                <a key={item.id} href={`#${item.id}`}>
                  {item.label}
                </a>
              ))}
            </nav>
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
                <div className="hero-kicker">
                  <Sparkles size={13} />
                  Liga Acadêmica Interprofissional de Nutrição Esportiva
                </div>

                <h1>Bem-vindo ao sistema LAINES</h1>
                <p>
                  Gerencie atendimentos, acompanhe atletas e registre avaliações em um
                  ambiente clínico-educacional integrado.
                </p>

                <div className="hero-tag-list">
                  {heroTags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>

                <div className="hero-helper-text">
                  <span>Acesse com seu perfil para visualizar agenda, prontuário e avaliações.</span>
                </div>

                <div className="hero-metrics">
                  {heroMetrics.map((m) => (
                    <article key={m.label}>
                      <strong>{m.value}</strong>
                      <span>{m.label}</span>
                    </article>
                  ))}
                </div>
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

          <section id="como-acessar" className="landing-section landing-section--soft">
            <div className="landing-container">
              <header className="section-heading section-heading--left-md">
                <h2>Como acessar o sistema</h2>
              </header>
              <div className="entry-grid">
                {accessGuides.map((guide, index) => (
                  <motion.article
                    key={guide.id}
                    className="entry-card"
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.3 }}
                    transition={{ duration: 0.5, delay: index * 0.08 }}
                  >
                    <div className="entry-card__icon">
                      <guide.icon size={18} />
                    </div>
                    <h3>{guide.title}</h3>
                    <p>{guide.description}</p>
                  </motion.article>
                ))}
              </div>
            </div>
          </section>

          <section id="como-funciona" className="landing-section">
            <div className="landing-container">
              <header className="section-heading section-heading--left-md">
                <h2>Como o sistema é utilizado</h2>
              </header>
              <div className="workflow-grid">
                {usageCards.map((card, index) => (
                  <motion.article
                    key={card.id}
                    className="workflow-card"
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.3 }}
                    transition={{ duration: 0.5, delay: index * 0.08 }}
                  >
                    <div className="workflow-card__header">
                      <div className="workflow-card__icon">
                        <card.icon size={18} />
                      </div>
                      <h3>{card.title}</h3>
                    </div>
                    <ul className="workflow-list">
                      {card.points.map((point) => (
                        <li key={`${card.id}-${point}`}>{point}</li>
                      ))}
                    </ul>
                  </motion.article>
                ))}
              </div>
            </div>
          </section>

          <section id="recursos" className="landing-section landing-section--soft">
            <div className="landing-container">
              <header className="section-heading section-heading--left-md">
                <h2>O que você pode fazer no sistema</h2>
              </header>
              <div className="feature-grid">
                {systemCapabilities.map((item, index) => (
                  <motion.div
                    key={item.text}
                    className="feature-card"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.3 }}
                    transition={{ duration: 0.45, delay: index * 0.07 }}
                  >
                    <div className="feature-card__icon">
                      <item.icon size={18} />
                    </div>
                    <p>{item.text}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>

          <section id="faq" className="landing-section">
            <div className="landing-container">
              <header className="section-heading section-heading--left-md">
                <h2>Perguntas frequentes</h2>
              </header>
              <div className="faq-grid">
                {landingFaq.map((item) => (
                  <article key={item.id} className="faq-card">
                    <h3>{item.question}</h3>
                    <p>{item.answer}</p>
                  </article>
                ))}
              </div>
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
    </>
  );
};

export default LoginPage;


