import React, { useId } from 'react';
import './TaskCompletionEditor.css';

const MAX_NOTE_LENGTH = 1000;

const TaskCompletionEditor = ({ taskTitle, note, onNoteChange, onSubmit, onCancel, isSaving }) => {
  const fieldId = useId();

  return (
    <form
      className="task-completion-editor"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !isSaving) {
          event.preventDefault();
          onCancel();
        }
      }}
      aria-label={`Concluir tarefa ${taskTitle || ''}`.trim()}
    >
      <label htmlFor={fieldId}>Observação da entrega <small>(opcional)</small></label>
      <textarea
        id={fieldId}
        value={note}
        onChange={(event) => onNoteChange(event.target.value)}
        maxLength={MAX_NOTE_LENGTH}
        placeholder="Se quiser, deixe um comentário sobre a conclusão."
        rows={3}
        autoFocus
        disabled={isSaving}
      />
      <div className="task-completion-actions">
        <span>{note.length}/{MAX_NOTE_LENGTH}</span>
        <button type="button" onClick={onCancel} disabled={isSaving}>Cancelar</button>
        <button type="submit" className="task-completion-submit" disabled={isSaving}>
          {isSaving ? 'Salvando...' : 'Concluir tarefa'}
        </button>
      </div>
    </form>
  );
};

export default TaskCompletionEditor;
