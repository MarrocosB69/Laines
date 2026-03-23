import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import '../components/ui/ui.css';

const UiFeedbackContext = createContext({ notify: () => {}, confirm: async () => false });

const buildToast = ({ type = 'info', title, message, duration = 4000 }) => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  type,
  title: title || (type === 'error' ? 'Erro' : type === 'success' ? 'Sucesso' : 'Aviso'),
  message,
  duration
});

export const UiFeedbackProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const [confirmation, setConfirmation] = useState(null);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback((payload) => {
    const toast = buildToast(payload);
    setToasts((prev) => [...prev, toast]);
    if (toast.duration > 0) {
      setTimeout(() => removeToast(toast.id), toast.duration);
    }
    return toast.id;
  }, [removeToast]);

  const confirm = useCallback((payload = {}) => {
    return new Promise((resolve) => {
      setConfirmation({
        title: payload.title || 'Confirmar acao',
        message: payload.message || 'Deseja continuar?',
        confirmLabel: payload.confirmLabel || 'Confirmar',
        cancelLabel: payload.cancelLabel || 'Cancelar',
        variant: payload.variant || 'warning',
        resolve
      });
    });
  }, []);

  const closeConfirmation = useCallback((accepted) => {
    setConfirmation((current) => {
      if (current?.resolve) {
        current.resolve(accepted);
      }
      return null;
    });
  }, []);

  useEffect(() => {
    if (!confirmation) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [confirmation]);

  useEffect(() => {
    if (!confirmation) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeConfirmation(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [confirmation, closeConfirmation]);

  const value = useMemo(() => ({ notify, confirm }), [notify, confirm]);

  return (
    <UiFeedbackContext.Provider value={value}>
      {children}
      <div className="ui-toast-stack" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <div key={toast.id} className={`ui-toast ui-toast-${toast.type}`}>
            <div className="ui-toast-header">
              <strong>{toast.title}</strong>
              <button type="button" onClick={() => removeToast(toast.id)} aria-label="Fechar">
                x
              </button>
            </div>
            {toast.message && <p>{toast.message}</p>}
          </div>
        ))}
      </div>
      {confirmation && (
        <div
          className="ui-confirm-overlay app-modal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeConfirmation(false);
            }
          }}
        >
          <div
            className={`ui-confirm-dialog ui-confirm-${confirmation.variant} app-modal-shell app-modal-shell--sm`}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="ui-confirm-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="ui-confirm-header app-modal-header">
              <h4 id="ui-confirm-title" className="app-modal-title">{confirmation.title}</h4>
            </div>
            <div className="ui-confirm-body app-modal-body">
              <p>{confirmation.message}</p>
            </div>
            <div className="ui-confirm-actions app-modal-footer">
              <div className="app-modal-actions">
                <button
                  type="button"
                  className="app-modal-btn app-modal-btn--secondary"
                  onClick={() => closeConfirmation(false)}
                >
                  {confirmation.cancelLabel}
                </button>
                <button
                  type="button"
                  className="app-modal-btn app-modal-btn--primary"
                  onClick={() => closeConfirmation(true)}
                >
                  {confirmation.confirmLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </UiFeedbackContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useUiFeedback = () => useContext(UiFeedbackContext);
