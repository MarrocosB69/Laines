import React, { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { AttachmentThumbnail } from '../../../components/ui';
import { useModalBodyLock } from '../../../hooks/useModalBodyLock';
import { useModalFocusTrap } from '../../../hooks/useModalFocusTrap';

const ProductionModal = ({
  isOpen,
  onClose,
  onSubmit,
  form,
  setForm,
  file,
  onFileChange,
  saving,
  projects,
  canManageResearch
}) => {
  const modalRef = useRef(null);
  const fileInputRef = useRef(null);

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
        aria-labelledby="research-production-modal-title"
      >
        <div className="app-modal-header research-project-modal__header">
          <div>
            <p className="app-modal-eyebrow">Repositório</p>
            <h3 id="research-production-modal-title" className="app-modal-title">Nova produção</h3>
            <p className="app-modal-subtitle">
              Anexe um arquivo ou registre um link de produção vinculada a uma pesquisa.
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
              <span>Pesquisa vinculada</span>
              <select
                className="app-modal-select"
                value={form.projetoId}
                onChange={(event) => setForm((prev) => ({ ...prev, projetoId: event.target.value }))}
                required={!canManageResearch}
              >
                {canManageResearch && <option value="">Sem projeto específico</option>}
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>{project.nome}</option>
                ))}
              </select>
            </label>
            <label className="app-modal-field">
              <span>Tipo</span>
              <select
                className="app-modal-select"
                value={form.tipo}
                onChange={(event) => setForm((prev) => ({ ...prev, tipo: event.target.value }))}
              >
                <option value="artigo">Artigo</option>
                <option value="resumo">Resumo</option>
                <option value="poster">Pôster</option>
                <option value="relatorio">Relatório</option>
                <option value="material">Material</option>
                <option value="documento">Documento</option>
              </select>
            </label>
            <label className="app-modal-field">
              <span>Autores</span>
              <input
                className="app-modal-input"
                value={form.autores}
                placeholder="Separe por vírgulas"
                onChange={(event) => setForm((prev) => ({ ...prev, autores: event.target.value }))}
              />
            </label>
            <label className="app-modal-field">
              <span>Ano</span>
              <input
                className="app-modal-input"
                type="number"
                min="1900"
                max="2200"
                value={form.ano}
                onChange={(event) => setForm((prev) => ({ ...prev, ano: event.target.value }))}
              />
            </label>
            <label className="app-modal-field">
              <span>Área</span>
              <input
                className="app-modal-input"
                value={form.area}
                onChange={(event) => setForm((prev) => ({ ...prev, area: event.target.value }))}
              />
            </label>
            <label className="app-modal-field">
              <span>Link externo</span>
              <input
                className="app-modal-input"
                type="url"
                placeholder="https://..."
                value={form.linkExterno}
                onChange={(event) => setForm((prev) => ({ ...prev, linkExterno: event.target.value }))}
              />
            </label>
            <label className="app-modal-field">
              <span>Arquivo</span>
              <input
                ref={fileInputRef}
                className="attachment-thumbnail__input"
                type="file"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg"
                onChange={(event) => onFileChange(event.target.files?.[0] || null)}
              />
              <AttachmentThumbnail
                file={file}
                emptyTitle="Selecionar arquivo da producao"
                emptyDescription="PDF, DOC, PPT, XLS, PNG ou JPG"
                description="Clique para trocar o anexo selecionado."
                onRemove={file ? () => {
                  if (fileInputRef.current) fileInputRef.current.value = '';
                  onFileChange(null);
                } : null}
              />
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
                    <option value="publicado">Publicado</option>
                    <option value="em_revisao">Em revisão</option>
                    <option value="rascunho">Rascunho</option>
                  </select>
                </label>
                <label className="app-modal-field">
                  <span>Visibilidade</span>
                  <select
                    className="app-modal-select"
                    value={form.visibilidade}
                    onChange={(event) => setForm((prev) => ({ ...prev, visibilidade: event.target.value }))}
                  >
                    <option value="interno_laines">Interno LAINES</option>
                    <option value="publico">Público</option>
                    <option value="equipe_pesquisa">Equipe da pesquisa</option>
                    <option value="restrito">Restrito</option>
                  </select>
                </label>
              </>
            )}
            <label className="app-modal-field app-modal-field--full">
              <span>Descrição</span>
              <textarea
                className="app-modal-textarea"
                rows={4}
                value={form.descricao}
                onChange={(event) => setForm((prev) => ({ ...prev, descricao: event.target.value }))}
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
              {saving ? 'Salvando...' : 'Salvar produção'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default ProductionModal;
