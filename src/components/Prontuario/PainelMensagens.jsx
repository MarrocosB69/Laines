import React from 'react';
import { Loader2, MessageSquare } from 'lucide-react';
import { FeedbackState } from '../ui';

const PainelMensagens = ({
  isProfessor = false,
  canWriteMessage = isProfessor,
  professorMessages = [],
  professorMessage = '',
  professorMessageError = '',
  isSavingProfessorMessage = false,
  formatDate,
  onChangeMessage,
  onSaveMessage
}) => (
  <section className="pron-card pron-panel">
    <header className="pron-panel-header">
      <div className="pron-title-inline">
        <MessageSquare size={18} aria-hidden="true" />
        <h2 id="pron-notas-titulo">Notas da supervisão</h2>
      </div>
      {canWriteMessage ? <span className="pron-badge pron-badge-muted">Supervisão</span> : null}
    </header>

    {professorMessages.length === 0 ? (
      <FeedbackState empty icon={MessageSquare} title="Nenhuma nota registrada." size="sm" />
    ) : (
      <div className="pron-messages-list" role="region" aria-labelledby="pron-notas-titulo" tabIndex={0}>
        {professorMessages.map((msg) => (
          <article key={msg.id} className="pron-message-item">
            <div className="pron-message-head">
              <strong>{msg.supervisorNome || msg.professorNome || 'Supervisão'}</strong>
              <span>{formatDate(msg.createdAt)}</span>
            </div>
            <p>{msg.texto}</p>
          </article>
        ))}
      </div>
    )}

    {canWriteMessage ? (
      <div className="pron-stack-xs">
        <textarea
          className="pron-textarea"
          aria-labelledby="pron-notas-titulo"
          rows="3"
          value={professorMessage}
          onChange={(event) => onChangeMessage?.(event.target.value)}
          placeholder="Deixe uma nota para a equipe responsável..."
        />
        {professorMessageError ? <div className="pron-error" role="alert">{professorMessageError}</div> : null}
        <button
          type="button"
          className="pron-btn pron-btn-primary"
          onClick={onSaveMessage}
          disabled={isSavingProfessorMessage}
        >
          {isSavingProfessorMessage ? <Loader2 size={16} className="spin" aria-hidden="true" /> : null}
          {isSavingProfessorMessage ? 'Salvando...' : 'Enviar mensagem'}
        </button>
      </div>
    ) : null}
  </section>
);

export default PainelMensagens;

