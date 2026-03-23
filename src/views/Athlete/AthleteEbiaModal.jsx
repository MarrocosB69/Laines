import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FileSpreadsheet, X } from 'lucide-react';
import { useModalBodyLock } from '../../hooks/useModalBodyLock';
import { useModalFocusTrap } from '../../hooks/useModalFocusTrap';
import AvaliacaoSocioeconomica from '../../components/Avaliacoes/avaliacao-socioeconomica/AvaliacaoSocioeconomica';
import './AthleteEbiaModal.css';

const AthleteEbiaModal = ({
  isOpen,
  patient,
  release,
  isSubmitting,
  onClose,
  onSubmit
}) => {
  const modalRef = useRef(null);

  useModalBodyLock(isOpen);
  useModalFocusTrap(isOpen, modalRef);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !isSubmitting) {
        event.preventDefault();
        onClose?.();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen || !patient) return null;
  if (typeof document === 'undefined') return null;

  const releaseDate = release?.releasedAt
    ? new Date(release.releasedAt).toLocaleString('pt-BR')
    : 'agora';

  return createPortal(
    <div
      className="athlete-ebia-overlay app-modal-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) {
          onClose?.();
        }
      }}
    >
      <div
        className="athlete-ebia-modal app-modal-shell app-modal-shell--xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="athlete-ebia-modal-title"
        ref={modalRef}
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="app-modal-header athlete-ebia-header">
          <div className="athlete-ebia-header-icon app-modal-header-icon">
            <FileSpreadsheet size={20} />
          </div>
          <div className="app-modal-heading">
            <h2 id="athlete-ebia-modal-title" className="app-modal-title">Preencher EBIA</h2>
            <p className="app-modal-subtitle">
              Formulario liberado pela equipe em {releaseDate}. Complete para registrar no prontuario.
            </p>
          </div>
          <button
            type="button"
            className="app-modal-close"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Fechar modal de EBIA"
          >
            <X size={15} />
          </button>
        </div>

        <div className="app-modal-body athlete-ebia-body">
          <AvaliacaoSocioeconomica
            pacienteId={patient.id}
            onSalvar={onSubmit}
            readOnly={isSubmitting}
          />
        </div>
      </div>
    </div>,
    document.body
  );
};

export default AthleteEbiaModal;
