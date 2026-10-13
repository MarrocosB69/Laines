import React from 'react';
import { Loader2, Paperclip, Trash2, UploadCloud } from 'lucide-react';
import { AttachmentThumbnail, FeedbackState } from '../ui';

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
        <p>{attachments.length === 1 ? '1 arquivo vinculado' : `${attachments.length} arquivos vinculados`} ao prontuário.</p>
      </div>
    </header>

    {podeEnviarAnexo ? (
      <label className="pron-upload">
        <input type="file" onChange={onUpload} disabled={isUploadingAttachment} />
        <UploadCloud size={18} aria-hidden="true" />
        {isUploadingAttachment ? 'Enviando...' : 'Adicionar anexo'}
      </label>
    ) : null}

    {attachmentError ? <div className="pron-error" role="alert">{attachmentError}</div> : null}

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
                <AttachmentThumbnail
                  compact
                  className="pron-attachment-thumbnail"
                  name={item.name || 'Anexo'}
                  description={isRemoving
                    ? 'Removendo...'
                    : isOpening
                      ? 'Abrindo...'
                      : formatDate(item.uploadedAt)}
                />
                {isOpening ? <Loader2 size={16} className="spin" aria-hidden="true" /> : null}
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
                  {isRemoving ? <Loader2 size={16} className="spin" aria-hidden="true" /> : <Trash2 size={16} aria-hidden="true" />}
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

