import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  ShieldCheck,
  X
} from 'lucide-react';

/**
 * As quatro etapas do fluxo, na ordem em que existem no sistema — mesmo que
 * uma sessão de navegador não passe pelas quatro em sequência (ex.: quem
 * abre a modal a partir do link do e-mail entra direto em "reset"; quem
 * pede o link fica em "sent" até trocar de aba). RECOVERY_STEPS é só o
 * vocabulário do indicador visual; a etapa real continua vindo de `step`,
 * prop do componente pai — nada aqui decide a navegação.
 */
const RECOVERY_STEPS = [
  { key: 'identify', label: 'Identificar' },
  { key: 'sent', label: 'Enviado' },
  { key: 'reset', label: 'Redefinir' },
  { key: 'done', label: 'Concluído' }
];

/**
 * Modal de recuperação de senha, com as etapas identify -> sent /
 * reset -> done. Estado (step, form, loading, etc.) continua no
 * componente pai porque interage com o modal de solicitação de acesso
 * (abrir um fecha o outro) e com o identificador vindo do painel de login.
 */
const PasswordRecoveryModal = ({
  open,
  modalRef,
  step,
  form,
  onFieldChange,
  loading,
  error,
  showNewPassword,
  showConfirmPassword,
  onToggleNewPassword,
  onToggleConfirmPassword,
  onIdentifySubmit,
  onResetSubmit,
  onBackToIdentify,
  onClose
}) => {
  const currentStepIndex = RECOVERY_STEPS.findIndex((item) => item.key === step);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="request-modal-overlay app-modal-overlay"
          role="presentation"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
        >
          <motion.div
            className="request-modal recovery-modal app-modal-shell"
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="recovery-modal-title"
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
          >
            <div className="request-modal-header app-modal-header">
              <div className="app-modal-heading">
                <h3 id="recovery-modal-title" className="app-modal-title">
                  {step === 'done' ? 'Senha redefinida' : 'Redefinir senha'}
                </h3>
                <p className="app-modal-subtitle">
                  {step === 'identify' && 'Informe seu e-mail ou CPF para começar.'}
                  {step === 'sent' && 'Link enviado — o próximo passo acontece a partir do e-mail.'}
                  {step === 'reset' && 'Crie uma nova senha para sua conta.'}
                  {step === 'done' && 'Tudo certo — você já pode entrar.'}
                </p>
              </div>
              <button type="button" className="app-modal-close request-modal-close" onClick={onClose} aria-label="Fechar">
                <X size={18} />
              </button>
            </div>

            <ol className="recovery-steps" aria-label="Etapas da recuperação de senha">
              {RECOVERY_STEPS.map((item, index) => {
                const status = index < currentStepIndex ? 'done' : index === currentStepIndex ? 'current' : 'upcoming';
                return (
                  <li
                    key={item.key}
                    className={`recovery-steps__item recovery-steps__item--${status}`}
                    aria-current={status === 'current' ? 'step' : undefined}
                  >
                    <span className="recovery-steps__marker" aria-hidden="true">
                      {status === 'done' ? <Check size={12} /> : index + 1}
                    </span>
                    <span className="recovery-steps__label">{item.label}</span>
                  </li>
                );
              })}
            </ol>

            <AnimatePresence mode="wait">

              {step === 'identify' && (
                <motion.form
                  key="identify"
                  onSubmit={onIdentifySubmit}
                  className="request-form app-modal-body"
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="request-grid recovery-grid">
                    <label className="request-field full">
                      <span>E-mail de acesso</span>
                      <input
                        type="text"
                        value={form.identifier}
                        onChange={onFieldChange('identifier')}
                        placeholder="usuario@laines.ufrn.br"
                        autoComplete="username"
                        required
                        autoFocus
                      />
                    </label>
                  </div>

                  {error && (
                    <div className="request-message error" role="alert" aria-live="assertive">
                      {error}
                    </div>
                  )}

                  <div className="request-actions app-modal-footer">
                    <button
                      type="button"
                      className="request-secondary app-modal-btn app-modal-btn--secondary"
                      onClick={onClose}
                    >
                      Cancelar
                    </button>
                    <button type="submit" disabled={loading} className="request-primary app-modal-btn app-modal-btn--primary">
                      {loading ? 'Enviando...' : 'Enviar link'}
                      <ArrowRight size={15} />
                    </button>
                  </div>
                </motion.form>
              )}

              {step === 'sent' && (
                <div className="request-form app-modal-body" role="status">
                  <p>Se houver uma conta ativa com contato cadastrado, o link sera enviado para esse contato. Ele expira em 15 minutos.</p>
                  <p>Verifique a caixa de entrada e o spam. Se nao receber ou nao tiver acesso ao contato, procure a administracao para conferir o cadastro.</p>
                  <button type="button" className="app-modal-btn app-modal-btn--primary" onClick={onClose}>Fechar</button>
                </div>
              )}

              {step === 'reset' && (
                <motion.form
                  key="reset"
                  onSubmit={onResetSubmit}
                  className="request-form app-modal-body"
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="request-grid recovery-grid">
                    <label className="request-field full">
                      <span>Nova senha</span>
                      <div className="field-shell">
                        <Lock size={15} />
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          value={form.newPassword}
                          onChange={onFieldChange('newPassword')}
                          placeholder="Mínimo 8 caracteres"
                          autoComplete="new-password"
                          required
                        />
                        <button
                          type="button"
                          className="password-visibility"
                          onClick={onToggleNewPassword}
                          aria-label={showNewPassword ? 'Ocultar senha' : 'Mostrar senha'}
                        >
                          {showNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                      <small className="recovery-password-hint">
                        Deve ter 8+ caracteres, com maiúscula, minúscula e número.
                      </small>
                    </label>

                    <label className="request-field full">
                      <span>Confirmar nova senha</span>
                      <div className="field-shell">
                        <Lock size={15} />
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={form.confirmPassword}
                          onChange={onFieldChange('confirmPassword')}
                          placeholder="Repita a nova senha"
                          autoComplete="new-password"
                          required
                        />
                        <button
                          type="button"
                          className="password-visibility"
                          onClick={onToggleConfirmPassword}
                          aria-label={showConfirmPassword ? 'Ocultar senha' : 'Mostrar senha'}
                        >
                          {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </label>
                  </div>

                  {error && (
                    <div className="request-message error" role="alert" aria-live="assertive">
                      {error}
                    </div>
                  )}

                  <div className="request-actions app-modal-footer">
                    <button
                      type="button"
                      className="request-secondary app-modal-btn app-modal-btn--secondary"
                      onClick={onBackToIdentify}
                    >
                      <ArrowLeft size={15} />
                      Voltar
                    </button>
                    <button
                      type="submit"
                      className="request-primary app-modal-btn app-modal-btn--primary"
                      disabled={loading}
                    >
                      {loading ? <><Loader2 size={15} className="spin" /> Redefinindo...</> : 'Redefinir senha'}
                    </button>
                  </div>
                </motion.form>
              )}

              {step === 'done' && (
                <motion.div
                  key="done"
                  className="request-form app-modal-body recovery-done"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.25 }}
                >
                  <div className="recovery-done__icon">
                    <CheckCircle2 size={40} />
                  </div>
                  <p className="recovery-done__title">Senha redefinida com sucesso!</p>
                  <p className="recovery-done__desc">
                    Sua nova senha já está ativa. Feche esta janela e entre normalmente.
                  </p>
                  <div className="request-actions app-modal-footer">
                    <button
                      type="button"
                      className="request-primary app-modal-btn app-modal-btn--primary"
                      onClick={onClose}
                    >
                      <ShieldCheck size={15} />
                      Entrar agora
                    </button>
                  </div>
                </motion.div>
              )}

            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PasswordRecoveryModal;
