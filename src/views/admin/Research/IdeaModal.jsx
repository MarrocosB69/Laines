import React, { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useModalBodyLock } from '../../../hooks/useModalBodyLock';
import { useModalFocusTrap } from '../../../hooks/useModalFocusTrap';

const IdeaModal = ({
  isOpen,
  onClose,
  onSubmit,
  form,
  setForm,
  saving,
  canManageResearch = false
}) => {
  const modalRef = useRef(null);

  useModalBodyLock(isOpen);
  useModalFocusTrap(isOpen, modalRef);

  const handleRequestClose = useCallback(() => {
    if (saving) return;
    onClose?.();
  }, [saving, onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleRequestClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleRequestClose, isOpen]);

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  const modalContent = (
    <div
      className="research-project-modal-overlay app-modal-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) {
          handleRequestClose();
        }
      }}
    >
      <form
        ref={modalRef}
        className="research-project-modal app-modal-shell app-modal-shell--lg research-lite-modal"
        onSubmit={onSubmit}
        onMouseDown={(event) => event.stopPropagation()}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="research-idea-modal-title"
      >
        <div className="app-modal-header research-project-modal__header">
          <div>
            <p className="app-modal-eyebrow">Ideias de projeto</p>
            <h3 id="research-idea-modal-title" className="app-modal-title">Nova ideia</h3>
            <p className="app-modal-subtitle">
              Registre temas para futuras pesquisas da liga.
            </p>
          </div>
          <button
            type="button"
            className="app-modal-close research-project-modal__close"
            onClick={handleRequestClose}
            aria-label="Fechar"
            disabled={saving}
          >
            <X size={18} />
          </button>
        </div>
        <div className="app-modal-body research-project-modal__form">
          <div className="app-modal-form-grid research-project-modal__grid">
            <label className="app-modal-field app-modal-field--full">
              <span>Título</span>
              <input
                className="app-modal-input"
                value={form.titulo}
                onChange={(event) => setForm((prev) => ({ ...prev, titulo: event.target.value }))}
                required
              />
            </label>
            <label className="app-modal-field">
              <span>Área</span>
              <select
                className="app-modal-select"
                value={form.area}
                onChange={(event) => setForm((prev) => ({ ...prev, area: event.target.value }))}
              >
                <option value="nutricao">Nutrição</option>
                <option value="fisioterapia">Fisioterapia</option>
                <option value="psicologia">Psicologia</option>
                <option value="multidisciplinar">Multidisciplinar</option>
                <option value="outros">Outros</option>
              </select>
            </label>
            {canManageResearch && (
              <>
                <label className="app-modal-field">
                  <span>Status</span>
                  <select
                    className="app-modal-select"
                    value={form.status}
                    onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}
                  >
                    <option value="ideia">Ideia</option>
                    <option value="em_discussao">Em discussão</option>
                    <option value="prioridade">Prioridade</option>
                    <option value="arquivada">Arquivada</option>
                  </select>
                </label>
                <label className="app-modal-field">
                  <span>Responsável sugerido</span>
                  <input
                    className="app-modal-input"
                    value={form.responsavelNome}
                    onChange={(event) => setForm((prev) => ({ ...prev, responsavelNome: event.target.value }))}
                  />
                </label>
              </>
            )}
            <label className="app-modal-field">
              <span>Palavras-chave</span>
              <input
                className="app-modal-input"
                value={form.palavrasChave}
                placeholder="Separe por vírgulas"
                onChange={(event) => setForm((prev) => ({ ...prev, palavrasChave: event.target.value }))}
              />
            </label>
            <label className="app-modal-field app-modal-field--full">
              <span>Problema</span>
              <textarea
                className="app-modal-textarea"
                rows={3}
                value={form.problema}
                onChange={(event) => setForm((prev) => ({ ...prev, problema: event.target.value }))}
              />
            </label>
            <label className="app-modal-field app-modal-field--full">
              <span>Objetivo</span>
              <textarea
                className="app-modal-textarea"
                rows={3}
                value={form.objetivo}
                onChange={(event) => setForm((prev) => ({ ...prev, objetivo: event.target.value }))}
              />
            </label>
            <label className="app-modal-field app-modal-field--full">
              <span>Justificativa / observações</span>
              <textarea
                className="app-modal-textarea"
                rows={4}
                value={form.justificativa}
                onChange={(event) => setForm((prev) => ({ ...prev, justificativa: event.target.value }))}
              />
            </label>
          </div>
        </div>
        <div className="app-modal-footer research-project-modal__footer">
          <div className="app-modal-actions">
            <button
              type="button"
              className="app-modal-btn app-modal-btn--secondary"
              onClick={handleRequestClose}
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="app-modal-btn app-modal-btn--primary"
              disabled={saving}
            >
              {saving ? 'Salvando...' : 'Salvar ideia'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default IdeaModal;
