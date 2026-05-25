import React from 'react';
import {
  ArrowLeft,
  CalendarPlus,
  FolderKanban,
  History,
  PlusCircle,
  Mail,
  AlertTriangle,
} from 'lucide-react';
import './ProntuarioHeader.css';

const ProntuarioHeader = ({
  onBack,
  patientName,
  patientInitials,
  prontuarioNumber,
  isActive = true,
  projectName = '',
  athleteLoginEmail = '',
  subtitle = '',
  profileIncomplete = false,
  canCreateEvaluation = false,
  canCreateAppointment = false,
  canLinkProject = false,
  onCreateEvaluation,
  onCreateAppointment,
  onOpenProject,
  onOpenHistory,
}) => {
  const nameParts   = (patientName || '').trim().split(/\s+/);
  const firstName   = nameParts[0] || 'Atleta';
  const restOfName  = nameParts.slice(1).join(' ');

  return (
    <header className="ph-root pron-card">
      {/* accent bar */}
      <div className="ph-accent-bar" aria-hidden="true" />

      {/* ── left: back + identity ── */}
      <div className="ph-left">
        <button
          type="button"
          className="ph-back-btn"
          onClick={onBack}
          aria-label="Voltar para lista de atletas"
        >
          <ArrowLeft size={15} />
        </button>

        <div className="ph-avatar" aria-hidden="true">
          {patientInitials || '??'}
          {isActive && <span className="ph-avatar__dot" title="Atleta ativo" />}
        </div>

        <div className="ph-identity">
          <h1 className="ph-name">
            <span className="ph-name__first">{firstName}</span>
            {restOfName && <span className="ph-name__rest"> {restOfName}</span>}
          </h1>

          <div className="ph-meta">
            {subtitle && <span className="ph-meta__item">{subtitle}</span>}
            {prontuarioNumber && (
              <span className="ph-meta__item ph-meta__item--code">
                {prontuarioNumber}
              </span>
            )}
            {projectName && (
              <span className="ph-meta__item ph-meta__item--project">
                <FolderKanban size={11} />
                {projectName}
              </span>
            )}
          </div>

          <div className="ph-tags">
            <span className={`ph-tag ${isActive ? 'ph-tag--ok' : 'ph-tag--muted'}`}>
              {isActive ? 'Ativo' : 'Inativo'}
            </span>
            {athleteLoginEmail ? (
              <span className="ph-tag ph-tag--info" title={athleteLoginEmail}>
                <Mail size={10} />
                {athleteLoginEmail}
              </span>
            ) : (
              <span className="ph-tag ph-tag--warn">
                <AlertTriangle size={10} />
                Sem login do atleta
              </span>
            )}
            {profileIncomplete && (
              <span className="ph-tag ph-tag--warn">
                <AlertTriangle size={10} />
                Perfil incompleto
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── right: actions ── */}
      <div className="ph-actions">
        {canCreateEvaluation && (
          <button
            type="button"
            className="ph-btn ph-btn--primary"
            onClick={onCreateEvaluation}
          >
            <PlusCircle size={15} />
            Nova Avaliação
          </button>
        )}

        <div className="ph-actions__group">
          {canCreateAppointment && (
            <button
              type="button"
              className="ph-btn ph-btn--ghost"
              onClick={onCreateAppointment}
              title="Agendar consulta"
            >
              <CalendarPlus size={15} />
              <span>Agendar</span>
            </button>
          )}
          {canLinkProject && (
            <button
              type="button"
              className="ph-btn ph-btn--ghost"
              onClick={onOpenProject}
              title="Vincular projeto"
            >
              <FolderKanban size={15} />
              <span>Projeto</span>
            </button>
          )}
          <button
            type="button"
            className="ph-btn ph-btn--ghost"
            onClick={onOpenHistory}
            title="Ver histórico de consultas"
          >
            <History size={15} />
            <span>Histórico</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default ProntuarioHeader;
