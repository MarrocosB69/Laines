import React, { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Archive, CheckCircle2, Heart, Lightbulb, MessageSquare, Users, X } from 'lucide-react';
import { useModalBodyLock } from '../../../hooks/useModalBodyLock';
import { useModalFocusTrap } from '../../../hooks/useModalFocusTrap';

const statusActions = [
  { status: 'em_discussao', label: 'Em discussão', icon: MessageSquare },
  { status: 'prioridade', label: 'Priorizar', icon: CheckCircle2 },
  { status: 'arquivada', label: 'Arquivar', icon: Archive }
];

const IdeaDetailModal = ({
  isOpen,
  onClose,
  idea,
  areaLabels = {},
  statusLabels = {},
  canShowInterest = false,
  userHasInterest = false,
  onToggleInterest,
  togglingInterest = false,
  canManageResearch = false,
  onStatusChange,
  statusSaving = false
}) => {
  const modalRef = useRef(null);

  useModalBodyLock(isOpen);
  useModalFocusTrap(isOpen, modalRef);

  const handleRequestClose = useCallback(() => {
    if (togglingInterest || statusSaving) return;
    onClose?.();
  }, [onClose, statusSaving, togglingInterest]);

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

  if (!isOpen || !idea) return null;
  if (typeof document === 'undefined') return null;

  const interesses = Array.isArray(idea.interesses) ? idea.interesses : [];
  const currentStatus = idea.status || 'ideia';

  const modalContent = (
    <div
      className="research-project-modal-overlay app-modal-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          handleRequestClose();
        }
      }}
    >
      <section
        ref={modalRef}
        className="research-project-modal app-modal-shell app-modal-shell--lg app-modal-shell--scrollable research-idea-detail-modal"
        onMouseDown={(event) => event.stopPropagation()}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="research-idea-detail-title"
      >
        <div className="app-modal-header research-project-modal__header">
          <div className="app-modal-heading">
            <p className="app-modal-eyebrow">Ideia de pesquisa</p>
            <h3 id="research-idea-detail-title" className="app-modal-title">
              {idea.titulo || 'Ideia sem título'}
            </h3>
            <p className="app-modal-subtitle">
              {idea.criadoPorNome ? `Proposta por ${idea.criadoPorNome}` : 'Proposta disponível para a liga.'}
            </p>
          </div>
          <button
            type="button"
            className="app-modal-close research-project-modal__close"
            onClick={handleRequestClose}
            aria-label="Fechar"
            disabled={togglingInterest || statusSaving}
          >
            <X size={18} />
          </button>
        </div>

        <div className="app-modal-body research-idea-detail">
          <div className="research-idea-detail__summary">
            <span className={`project-tag area-${idea.area || 'outros'}`}>
              {areaLabels[idea.area] || idea.area || 'Multidisciplinar'}
            </span>
            <span className={`project-tag status-${currentStatus}`}>
              {statusLabels[currentStatus] || currentStatus}
            </span>
            <span className="research-interest-pill">
              <Users size={14} />
              {interesses.length} interessado{interesses.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="research-idea-detail__grid">
            <section className="research-idea-detail__block">
              <h4>Problema</h4>
              <p>{idea.problema || 'Nenhum problema registrado.'}</p>
            </section>
            <section className="research-idea-detail__block">
              <h4>Objetivo</h4>
              <p>{idea.objetivo || 'Nenhum objetivo registrado.'}</p>
            </section>
            <section className="research-idea-detail__block research-idea-detail__block--full">
              <h4>Justificativa</h4>
              <p>{idea.justificativa || 'Nenhuma justificativa registrada.'}</p>
            </section>
            {idea.observacoes && (
              <section className="research-idea-detail__block research-idea-detail__block--full">
                <h4>Observações</h4>
                <p>{idea.observacoes}</p>
              </section>
            )}
          </div>

          {Array.isArray(idea.palavrasChave) && idea.palavrasChave.length > 0 && (
            <div className="research-idea-detail__tags">
              {idea.palavrasChave.map((tag, index) => (
                <span key={`${idea.id}-detail-tag-${index}-${tag}`}>{tag}</span>
              ))}
            </div>
          )}

          <section className="research-idea-detail__interests">
            <div className="research-idea-detail__section-title">
              <Users size={16} />
              <h4>Interessados</h4>
            </div>
            {interesses.length === 0 ? (
              <p>Ninguém demonstrou interesse ainda.</p>
            ) : (
              <div className="research-idea-detail__interest-list">
                {interesses.map((entry, index) => (
                  <span key={`${idea.id}-interest-${entry.id || index}`}>
                    {entry.nome || entry.email || 'Membro da liga'}
                  </span>
                ))}
              </div>
            )}
          </section>

          {canManageResearch && (
            <section className="research-idea-detail__workflow">
              <div className="research-idea-detail__section-title">
                <Lightbulb size={16} />
                <h4>Triagem da diretoria</h4>
              </div>
              <div className="research-idea-detail__workflow-actions">
                {statusActions.map(({ status, label, icon: Icon }) => (
                  <button
                    key={status}
                    type="button"
                    className={`research-action-link ${currentStatus === status ? 'research-action-link--strong' : ''}`}
                    onClick={() => onStatusChange?.(idea, status)}
                    disabled={statusSaving || currentStatus === status}
                  >
                    <Icon size={15} />
                    {label}
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="app-modal-footer research-project-modal__footer">
          <div className="app-modal-actions">
            <button
              type="button"
              className="app-modal-btn app-modal-btn--secondary"
              onClick={handleRequestClose}
              disabled={togglingInterest || statusSaving}
            >
              Fechar
            </button>
            {canShowInterest && (
              <button
                type="button"
                className={`app-modal-btn app-modal-btn--primary research-interest-button${userHasInterest ? ' is-active' : ''}`}
                onClick={() => onToggleInterest?.(idea)}
                disabled={togglingInterest}
              >
                <Heart size={16} fill={userHasInterest ? 'currentColor' : 'none'} />
                {togglingInterest
                  ? 'Atualizando...'
                  : userHasInterest
                    ? 'Remover interesse'
                    : 'Tenho interesse'}
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default IdeaDetailModal;
