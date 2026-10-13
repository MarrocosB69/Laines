import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, ChevronRight, IdCard, Timer } from 'lucide-react';

// Mensagens de campo vazio (validacao no cliente, nova nesta versao).
const MENSAGEM_VAZIO = {
  identifier: 'Informe seu CPF ou e-mail.',
  password: 'Informe sua senha.'
};

/**
 * Formulario de entrada do painel de login: os dois campos, validacao de
 * campo vazio, erro do servidor e as duas portas secundarias. Porta do
 * .painel__corpo do mockup aprovado
 * (docs/design/landing-v2/a2-energia/index.html). As props sao fixas -
 * quem chama e src/views/LoginPage.jsx, que nao e desta fronteira
 * (docs/implementacao/landing-v2/change-intent.md).
 */
const LoginPanel = ({
  email,
  onEmailChange,
  password,
  onPasswordChange,
  showPassword,
  onToggleShowPassword,
  isLoading,
  error,
  onSubmit,
  onOpenRecovery,
  onOpenRequest
}) => {
  const [fieldErrors, setFieldErrors] = useState({ identifier: false, password: false });
  const identifierRef = useRef(null);
  const passwordRef = useRef(null);
  const formRef = useRef(null);
  const prevErrorRef = useRef(error);

  // Tranco de 320ms (definido em landing-login.css, classe lp-tranco).
  // Remover e recolocar a classe, com um reflow no meio, e o jeito de
  // reiniciar uma animacao que ja rodou - sem isso, o segundo erro seguido
  // nao balanca de novo.
  const triggerShake = () => {
    const node = formRef.current;
    if (!node) return;
    node.classList.remove('lp-tranco');
    void node.offsetWidth;
    node.classList.add('lp-tranco');
  };

  // O tranco dispara na validacao de campo vazio (handleSubmit, abaixo) e
  // tambem quando o erro do servidor chega - por isso este efeito, que
  // observa a prop `error` subir de '' para uma mensagem.
  useEffect(() => {
    if (error && error !== prevErrorRef.current) {
      triggerShake();
    }
    prevErrorRef.current = error;
  }, [error]);

  const handleIdentifierChange = (event) => {
    onEmailChange(event.target.value);
    if (fieldErrors.identifier) setFieldErrors((prev) => ({ ...prev, identifier: false }));
  };

  const handlePasswordChange = (event) => {
    onPasswordChange(event.target.value);
    if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: false }));
  };

  const handleSubmit = (event) => {
    const emptyIdentifier = !email.trim();
    const emptyPassword = !password;
    if (emptyIdentifier || emptyPassword) {
      event.preventDefault();
      setFieldErrors({ identifier: emptyIdentifier, password: emptyPassword });
      triggerShake();
      (emptyIdentifier ? identifierRef : passwordRef).current?.focus();
      return;
    }
    if (fieldErrors.identifier || fieldErrors.password) {
      setFieldErrors({ identifier: false, password: false });
    }
    onSubmit(event);
  };

  // A dica ("Use seu CPF...") descreve o formato do identificador, entao so
  // entra no describedby desse campo; o erro geral do servidor entra nos
  // dois quando presente.
  const identifierDescribedBy = [
    'lp-dica-login',
    fieldErrors.identifier ? 'lp-erro-identifier' : null,
    error ? 'landing-login-error' : null
  ].filter(Boolean).join(' ') || undefined;

  const passwordDescribedBy = [
    fieldErrors.password ? 'lp-erro-password' : null,
    error ? 'landing-login-error' : null
  ].filter(Boolean).join(' ') || undefined;

  return (
    <section className="lp-form" aria-labelledby="lp-form-titulo">
      <h2 id="lp-form-titulo">Entrar</h2>
      <p className="lp-form__dica" id="lp-dica-login">
        Use seu CPF, só os números, ou seu <span className="lp-inteiro">e-mail</span>.
      </p>

      <form ref={formRef} noValidate onSubmit={handleSubmit} className="lp-form__form">
        <div className="lp-campo">
          <label htmlFor="lp-login-id">CPF ou e-mail</label>
          <div className="lp-campo__caixa">
            <input
              id="lp-login-id"
              ref={identifierRef}
              type="text"
              value={email}
              onChange={handleIdentifierChange}
              autoComplete="username"
              data-testid="login-identifier"
              aria-invalid={fieldErrors.identifier || undefined}
              aria-describedby={identifierDescribedBy}
            />
            <span className="lp-campo__raia" aria-hidden="true" />
          </div>
          <p className="lp-campo__erro" id="lp-erro-identifier" hidden={!fieldErrors.identifier}>
            <AlertCircle size={16} aria-hidden="true" />
            <span>{MENSAGEM_VAZIO.identifier}</span>
          </p>
        </div>

        <div className="lp-campo lp-campo--senha">
          <label htmlFor="lp-login-senha">Senha</label>
          <div className="lp-campo__caixa lp-campo__senha">
            <input
              id="lp-login-senha"
              ref={passwordRef}
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={handlePasswordChange}
              autoComplete="current-password"
              data-testid="login-password"
              aria-invalid={fieldErrors.password || undefined}
              aria-describedby={passwordDescribedBy}
            />
            <button
              type="button"
              className="lp-campo__mostrar"
              onClick={onToggleShowPassword}
              aria-pressed={showPassword}
              aria-controls="lp-login-senha"
            >
              {showPassword ? 'Ocultar' : 'Mostrar'}
            </button>
            <span className="lp-campo__raia" aria-hidden="true" />
          </div>
          {/* Depois do campo no DOM (defeito 13/16 do plano): a ordem do Tab
              fica CPF, senha, Mostrar, Esqueci, Entrar; visualmente fica na
              linha do rotulo "Senha" via grid em landing-login.css. */}
          <button type="button" className="lp-link lp-campo__esqueci" onClick={onOpenRecovery}>
            Esqueci minha senha
          </button>
          <p className="lp-campo__erro" id="lp-erro-password" hidden={!fieldErrors.password}>
            <AlertCircle size={16} aria-hidden="true" />
            <span>{MENSAGEM_VAZIO.password}</span>
          </p>
        </div>

        <button
          type="submit"
          className="lp-botao-entrar"
          data-testid="login-submit"
          disabled={isLoading}
          aria-busy={isLoading ? 'true' : undefined}
        >
          {isLoading ? 'Entrando' : 'Entrar'}
        </button>

        {error && (
          <p id="landing-login-error" className="landing-error" role="alert" aria-live="assertive">
            <AlertCircle size={18} aria-hidden="true" />
            <span>{error}</span>
          </p>
        )}
      </form>

      <nav className="lp-portas" aria-label="Outros acessos">
        <a className="lp-porta" href="/inscricao">
          <span className="lp-porta__icone" aria-hidden="true">
            <Timer size={20} strokeWidth={2} />
          </span>
          <span className="lp-porta__texto">
            <span className="lp-porta__pergunta">É atleta e quer ser atendido pela liga?</span>
            <span className="lp-porta__acao">Entrar na lista de espera</span>
          </span>
          <ChevronRight className="lp-porta__seta" size={20} aria-hidden="true" />
        </a>
        <button type="button" className="lp-porta" onClick={onOpenRequest}>
          <span className="lp-porta__icone" aria-hidden="true">
            <IdCard size={20} strokeWidth={2} />
          </span>
          <span className="lp-porta__texto">
            <span className="lp-porta__pergunta">Professor ou profissional de saúde sem conta?</span>
            <span className="lp-porta__acao">Solicitar acesso</span>
          </span>
          <ChevronRight className="lp-porta__seta" size={20} aria-hidden="true" />
        </button>
      </nav>
    </section>
  );
};

export default LoginPanel;
