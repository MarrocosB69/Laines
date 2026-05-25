import React from 'react';
import { Loader2, Paperclip, Trash2, UploadCloud } from 'lucide-react';
import { FeedbackState } from '../ui';

const PainelAnexos = ({
  attachments = [],
  visibleAttachments = 0,
  attachmentsHasMore = false,
  podeEnviarAnexo = false,
  podeRemoverAnexo = false,
  isUploadingAttachment = false,
  openingAttachmentId = '',
  removingAttachmentId = '',
  attachmentError = '',
  formatDate,
  onUpload,
  onOpenAttachment,
  onRemoveAttachment,
  onLoadMore
}) => (
  <section className="pron-card pron-panel">
    <header className="pron-panel-header">
      <div>
        <h2>Anexos</h2>
        <p>{attachments.length} arquivo(s) vinculados ao prontuário.</p>
      </div>
    </header>

    {podeEnviarAnexo ? (
      <label className="pron-upload">
        <input type="file" onChange={onUpload} disabled={isUploadingAttachment} />
        <UploadCloud size={16} />
        {isUploadingAttachment ? 'Enviando...' : 'Adicionar anexo'}
      </label>
    ) : null}

    {attachmentError ? <div className="pron-error">{attachmentError}</div> : null}

    {attachments.length === 0 ? (
      <FeedbackState empty icon={Paperclip} title="Nenhum anexo enviado." size="sm" />
    ) : (
      <div className="pron-attachments-list">
        {attachments.slice(0, visibleAttachments).map((item) => {
          const currentId = String(item.id || item.path || item.url || '');
          const isOpening = openingAttachmentId === currentId;
          const isRemoving = removingAttachmentId === currentId;
          return (
            <article key={currentId} className="pron-attachment-item">
              <button
                type="button"
                className="pron-attachment-open"
                onClick={() => onOpenAttachment?.(item)}
                disabled={isOpening || isRemoving}
              >
                <Paperclip size={14} />
                <div>
                  <strong>{item.name || 'Anexo'}</strong>
                  <span>
                    {isRemoving
                      ? 'Removendo...'
                      : isOpening
                        ? 'Abrindo...'
                        : formatDate(item.uploadedAt)}
                  </span>
                </div>
                {isOpening ? <Loader2 size={14} className="spin" /> : null}
              </button>
              {podeRemoverAnexo ? (
                <button
                  type="button"
                  className="pron-icon-btn danger"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onRemoveAttachment?.(item);
                  }}
                  disabled={isRemoving}
                  aria-label={`Remover anexo ${item.name || ''}`}
                >
                  {isRemoving ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}
                </button>
              ) : null}
            </article>
          );
        })}
      </div>
    )}

    {attachmentsHasMore ? (
      <div className="pron-panel-footer">
        <button type="button" className="pron-btn pron-btn-secondary" onClick={onLoadMore}>
          Carregar mais
        </button>
      </div>
    ) : null}
  </section>
);

export default PainelAnexos;

