import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle,
  ArrowRight,
  ArrowUp,
  Award,
  BookOpenCheck,
  Eye,
  EyeOff,
  FlaskConical,
  HeartPulse,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  Users,
  X
} from 'lucide-react';
import api, { getApiErrorMessage } from '../services/api';
import { isPastDate, isValidCpf, isValidEmail, normalizeCpf } from '../utils/validation';
import { useModalBodyLock } from '../hooks/useModalBodyLock';
import { getRedirectPathFromRole, normalizeRole } from '../constants/roles';
import logoLaines from '../assets/LogoLaines.png';
import logoFacisa from '../assets/facisa.png';
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

const strategicPillars = [
  {
    id: 'ensino',
    title: 'Ensino prático',
    description: 'Formação com rotina real de atendimento, supervisão e evolução clínica.',
    icon: BookOpenCheck
  },
  {
    id: 'pesquisa',
    title: 'Pesquisa aplicada',
    description: 'Projetos ativos com métricas e dados consistentes para tomada de decisão.',
    icon: FlaskConical
  },
  {
    id: 'extensao',
    title: 'Extensão com impacto',
    description: 'Atendimento orientado por cuidado, desempenho e impacto social mensurável.',
    icon: HeartPulse
  }
];

const operatingTracks = [
  {
    id: 'nutricao',
    title: 'Nutrição esportiva',
    description: 'Planejamento nutricional, bioimpedância e acompanhamento longitudinal.'
  },
  {
    id: 'interprofissional',
    title: 'Formação interprofissional',
    description: 'Alunos, professores e profissionais atuando em fluxo colaborativo.'
  },
  {
    id: 'gestao',
    title: 'Gestão acadêmica e clínica',
    description: 'Agenda, prontuário, avaliações e relatórios conectados no mesmo fluxo.'
  }
];

const coreValues = [
  'Colaboração interprofissional',
  'Rigor técnico',
  'Ética no cuidado',
  'Inovação pedagógica',
  'Impacto social mensurável'
];

const landingNavLinks = [
  { id: 'pilares', label: 'Pilares' },
  { id: 'atuacao', label: 'Atuação' },
  { id: 'valores', label: 'Valores' },
  { id: 'parceria', label: 'Parceria' },
  { id: 'faq', label: 'FAQ' }
];

const landingFaq = [
  {
    id: 'faq-acesso',
    question: 'Quem pode solicitar acesso ao sistema?',
    answer: 'Professores, profissionais e parceiros vinculados à operação institucional da LAINES.'
  },
  {
    id: 'faq-seguranca',
    question: 'O acesso é controlado por perfil?',
    answer: 'Sim. Cada perfil acessa apenas as áreas e ações autorizadas, com bloqueios explícitos na interface.'
  },
  {
    id: 'faq-fluxo',
    question: 'Quais fluxos estão integrados hoje?',
    answer: 'Agenda, prontuário, avaliações e pesquisa já operam de forma contínua no escopo atual da versão 1.0.'
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

  const { login, user, signed, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const isProfessorRequest = requestForm.cargoSolicitado === 'professor';
  const isProfissionalRequest = requestForm.cargoSolicitado === 'profissional';
  const canPickProject = isProfessorRequest || isProfissionalRequest;

  useModalBodyLock(requestOpen);

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

    const handleScroll = () => {
      setShowScrollTop(getScrollTop() > 360);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const loadProjects = async () => {
      setRequestProjectsLoading(true);
      try {
        const { data } = await api.get('/projetos/public');
        const sorted = Array.isArray(data)
          ? data.slice().sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
          : [];
        setRequestProjects(sorted);
      } catch (err) {
        console.error('Erro ao carregar projetos:', err);
        setRequestProjects([]);
      } finally {
        setRequestProjectsLoading(false);
      }
    };
    loadProjects();
  }, []);

  const handleOpenRequest = () => {
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

  const formatCpf = (value) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .replace(/(-\d{2})\d+?$/, '$1');
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
      setRequestSuccess('Solicitação enviada. Aguarde aprovação.');
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
              <img src={logoLaines} alt="LAINES" />
              <div>
                <strong>LAINES</strong>
                <span>Liga Acadêmica Interprofissional de Nutrição Esportiva</span>
              </div>
            </a>

            <nav className="landing-topbar__nav" aria-label="Navegação principal da landing">
              {landingNavLinks.map((item) => (
                <a key={item.id} href={`#${item.id}`}>
                  {item.label}
                </a>
              ))}
            </nav>

            <div className="landing-topbar__actions">
              <button type="button" className="btn-ghost" onClick={handleOpenRequest}>
                Solicitar acesso
              </button>
              <a href="#acesso" className="btn-solid">
                Entrar
              </a>
            </div>
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
                <span className="hero-kicker">
                  <Sparkles size={14} />
                  Plataforma institucional LAINES 1.0
                </span>
                <h1>
                  Gestão acadêmica e clínica em um fluxo único
                </h1>
                <p>
                  Conecte agenda, prontuário, avaliações e pesquisa em uma operação contínua,
                  com acesso por perfil e rastreabilidade de ações.
                </p>

                <div className="hero-tag-list">
                  <span>Controle por perfil</span>
                  <span>Fluxos clínicos contínuos</span>
                  <span>Operação auditável</span>
                </div>

                <div className="hero-actions">
                  <a href="#acesso" className="hero-action hero-action--primary">
                    Acessar plataforma
                    <ArrowRight size={16} />
                  </a>
                  <button type="button" className="hero-action hero-action--ghost" onClick={handleOpenRequest}>
                    Solicitar acesso
                  </button>
                </div>

                <div className="hero-metrics">
                  <article>
                    <strong>{requestProjectsLoading ? '...' : String(requestProjects.length || 0).padStart(2, '0')}</strong>
                    <span>projetos disponíveis para vínculo</span>
                  </article>
                  <article>
                    <strong>3 frentes</strong>
                    <span>ensino, pesquisa e extensão</span>
                  </article>
                  <article>
                    <strong>1 fluxo</strong>
                    <span>agenda, prontuário e avaliações</span>
                  </article>
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
                    <p>Docente ou profissional parceiro?</p>
                    <button type="button" onClick={handleOpenRequest}>
                      Solicitar cadastro
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </form>
              </motion.aside>
            </div>
          </section>

          <section id="pilares" className="landing-section">
            <div className="landing-container">
              <header className="section-heading">
                <span>Direção estratégica</span>
                <h2>Pilares que sustentam a operação</h2>
              </header>
              <div className="pillar-grid">
                {strategicPillars.map((pillar, index) => (
                  <motion.article
                    key={pillar.id}
                    className="pillar-card"
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.3 }}
                    transition={{ duration: 0.5, delay: index * 0.08 }}
                  >
                    <div className="pillar-card__icon">
                      <pillar.icon size={20} />
                    </div>
                    <h3>{pillar.title}</h3>
                    <p>{pillar.description}</p>
                  </motion.article>
                ))}
              </div>
            </div>
          </section>

          <section id="atuacao" className="landing-section landing-section--soft">
            <div className="landing-container">
              <header className="section-heading">
                <span>Atuação</span>
                <h2>Frentes operacionais da LAINES</h2>
              </header>
              <div className="track-grid">
                {operatingTracks.map((track, index) => (
                  <motion.article
                    key={track.id}
                    className="track-card"
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.3 }}
                    transition={{ duration: 0.5, delay: index * 0.08 }}
                  >
                    <strong>{track.title}</strong>
                    <p>{track.description}</p>
                  </motion.article>
                ))}
              </div>
            </div>
          </section>

          <section id="valores" className="landing-section">
            <div className="landing-container landing-values">
              <div className="landing-values__copy">
                <header className="section-heading section-heading--left">
                  <span>Cultura</span>
                  <h2>Valores que orientam o cuidado e o ensino</h2>
                </header>
                <p>
                  O ambiente foi desenhado para ser técnico, simples de operar e confiável para toda a equipe.
                </p>
              </div>

              <div className="value-list">
                {coreValues.map((item, index) => (
                  <motion.div
                    key={item}
                    className="value-item"
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, amount: 0.3 }}
                    transition={{ duration: 0.5, delay: index * 0.05 }}
                  >
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <p>{item}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>

          <section id="parceria" className="landing-section landing-section--partner">
            <div className="landing-container partner-panel">
              <div className="partner-panel__copy">
                <Award size={18} />
                <h3>Parceria institucional ativa</h3>
                <p>Operação com apoio acadêmico local para ensino, pesquisa aplicada e extensão.</p>
              </div>
              <div className="partner-panel__logo">
                <img src={logoFacisa} alt="Facisa" />
                <span>Faculdade de Ciências da Saúde do Trairi</span>
              </div>
            </div>
          </section>

          <section id="faq" className="landing-section landing-section--soft">
            <div className="landing-container">
              <header className="section-heading">
                <span>Perguntas frequentes</span>
                <h2>Esclarecimentos rápidos sobre acesso e operação</h2>
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

          <section className="landing-section landing-section--cta">
            <div className="landing-container cta-panel">
              <div>
                <Users size={18} />
                <h3>Pronto para integrar seu time ao ecossistema LAINES?</h3>
              </div>
              <button type="button" onClick={handleOpenRequest}>
                Solicitar acesso institucional
                <ArrowRight size={16} />
              </button>
            </div>
          </section>
        </main>

        <footer className="landing-footer-v2">
          <div className="landing-container landing-footer-v2__inner">
            <div className="landing-footer-v2__brand">
              <img src={logoLaines} alt="LAINES" />
              <div>
                <strong>LAINES</strong>
                <span>Liga Acadêmica Interprofissional de Nutrição Esportiva</span>
              </div>
            </div>
            <small>© 2026 LAINES. Plataforma institucional de ensino, pesquisa e extensão.</small>
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
                  <p className="app-modal-subtitle">Solicitação sujeita à aprovação da coordenação.</p>
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
                    <span>Justificativa</span>
                    <textarea
                      rows="4"
                      value={requestForm.justificativa}
                      onChange={handleRequestChange('justificativa')}
                      placeholder="Conte como pretende usar o ecossistema."
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

