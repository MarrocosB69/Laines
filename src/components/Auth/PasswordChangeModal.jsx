import React, { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Lock, ShieldCheck, AlertCircle, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useModalBodyLock } from '../../hooks/useModalBodyLock';
import { useModalFocusTrap } from '../../hooks/useModalFocusTrap';
import { getApiErrorMessage } from '../../services/api';
import './PasswordChangeModal.css';

const PasswordChangeModal = ({ isOpen, user, onClose = null }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const modalRef = useRef(null);
  const { changePassword } = useAuth();

  useModalBodyLock(isOpen);
  useModalFocusTrap(isOpen, modalRef);

  const canClose = typeof onClose === 'function';
  const handleRequestClose = useCallback(() => {
    if (loading || !canClose) return;
    onClose();
  }, [loading, canClose, onClose]);

  useEffect(() => {
    if (!isOpen || !canClose) return;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleRequestClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, canClose, handleRequestClose]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!currentPassword) {
      setError('Informe a senha atual.');
      return;
    }
    const passwordStrong = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!newPassword || !passwordStrong.test(newPassword)) {
      setError('Use ao menos 8 caracteres com maiúscula, minúscula e número.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    try {
      await changePassword(currentPassword, newPassword);

      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      console.error('Erro ao atualizar senha:', err);
      setError(getApiErrorMessage(err, 'Não foi possível atualizar a senha. Tente novamente.'));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !user) return null;
  if (typeof document === 'undefined') return null;

  const modalContent = (
    <div
      className="password-modal-overlay app-modal-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (!canClose) return;
        if (event.target === event.currentTarget) {
          handleRequestClose();
        }
      }}
    >
      <div
        className="password-modal app-modal-shell app-modal-shell--sm"
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="password-change-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="password-modal-header app-modal-header">
          <div className="password-modal-icon app-modal-header-icon">
            <ShieldCheck size={22} />
          </div>
          <div className="app-modal-heading">
            <h3 id="password-change-modal-title" className="app-modal-title">Atualize sua senha</h3>
            <p className="app-modal-subtitle">Primeiro acesso: é necessário definir uma nova senha.</p>
          </div>
          {canClose && (
            <button type="button" className="password-modal-close app-modal-close" onClick={handleRequestClose} aria-label="Fechar">
              <X size={16} />
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="password-modal-form">
          <div className="password-modal-body app-modal-body">
            <label className="password-field">
              <span>Senha atual</span>
              <div className="password-input">
                <Lock size={16} />
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Digite a senha atual"
                  autoComplete="current-password"
                />
              </div>
            </label>
            <label className="password-field">
              <span>Nova senha</span>
              <div className="password-input">
                <Lock size={16} />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Digite a nova senha"
                  autoComplete="new-password"
                />
              </div>
              <small className="password-hint">
                Mínimo 8 caracteres com letra maiúscula, minúscula e número.
              </small>
            </label>
            <label className="password-field">
              <span>Confirmar senha</span>
              <div className="password-input">
                <Lock size={16} />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha"
                  autoComplete="new-password"
                />
              </div>
            </label>

            {error && (
              <div className="password-message error">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="password-message success">
                <ShieldCheck size={16} />
                <span>Senha atualizada com sucesso.</span>
              </div>
            )}
          </div>

          <div className="password-modal-actions app-modal-footer">
            <div className="app-modal-actions">
              {canClose && (
                <button type="button" className="app-modal-btn app-modal-btn--secondary" onClick={handleRequestClose} disabled={loading}>
                  Cancelar
                </button>
              )}
              <button type="submit" className="app-modal-btn app-modal-btn--primary password-submit" disabled={loading}>
                {loading ? 'Salvando...' : 'Salvar nova senha'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default PasswordChangeModal;

