import React from 'react';
import { Loader2, MessageSquare } from 'lucide-react';

const PainelMensagens = ({
  isProfessor = false,
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
        <MessageSquare size={16} />
        <h2>Mensagens do Professor</h2>
      </div>
      {isProfessor ? <span className="pron-badge pron-badge-muted">Somente professor</span> : null}
    </header>

    {professorMessages.length === 0 ? (
      <div className="pron-empty">Nenhuma mensagem enviada.</div>
    ) : (
      <div className="pron-messages-list">
        {professorMessages.map((msg) => (
          <article key={msg.id} className="pron-message-item">
            <div className="pron-message-head">
              <strong>{msg.professorNome || 'Professor'}</strong>
              <span>{formatDate(msg.createdAt)}</span>
            </div>
            <p>{msg.texto}</p>
          </article>
        ))}
      </div>
    )}

    {isProfessor ? (
      <div className="pron-stack-xs">
        <textarea
          className="pron-textarea"
          rows="3"
          value={professorMessage}
          onChange={(event) => onChangeMessage?.(event.target.value)}
          placeholder="Deixe uma mensagem para o aluno responsável..."
        />
        {professorMessageError ? <div className="pron-error">{professorMessageError}</div> : null}
        <button
          type="button"
          className="pron-btn pron-btn-primary"
          onClick={onSaveMessage}
          disabled={isSavingProfessorMessage}
        >
          {isSavingProfessorMessage ? <Loader2 size={14} className="spin" /> : null}
          {isSavingProfessorMessage ? 'Salvando...' : 'Enviar mensagem'}
        </button>
      </div>
    ) : null}
  </section>
);

export default PainelMensagens;

