import React from 'react';
import { ArrowLeft, Clock, FolderKanban, History, PlusCircle } from 'lucide-react';

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
  onOpenHistory
}) => (
  <header className="pron-header pron-card">
    <div className="pron-header-left">
      <button type="button" className="pron-icon-btn" onClick={onBack} aria-label="Voltar para lista de atletas">
        <ArrowLeft size={16} />
      </button>
      <div className="pron-avatar" aria-hidden="true">{patientInitials}</div>
      <div className="pron-header-title">
        <h1>{patientName || 'Atleta'}</h1>
        <div className="pron-header-badges">
          <span className="pron-badge pron-badge-accent">
            PRT-{prontuarioNumber || 'PENDENTE'}
          </span>
          <span className={`pron-badge ${isActive ? 'pron-badge-ok' : 'pron-badge-muted'}`}>
            {isActive ? 'Ativo' : 'Inativo'}
          </span>
          <span className={`pron-badge ${athleteLoginEmail ? 'pron-badge-info' : 'pron-badge-warn'}`}>
            Login atleta: {athleteLoginEmail || 'nao vinculado'}
          </span>
          {projectName ? <span className="pron-badge pron-badge-muted">{projectName}</span> : null}
          {profileIncomplete ? <span className="pron-badge pron-badge-warn">Perfil incompleto</span> : null}
        </div>
        {subtitle ? <p className="pron-header-subtitle">{subtitle}</p> : null}
      </div>
    </div>

    <div className="pron-header-actions">
      {canCreateEvaluation ? (
        <button type="button" className="pron-btn pron-btn-primary" onClick={onCreateEvaluation}>
          <PlusCircle size={16} />
          <span>Nova Avaliacao</span>
        </button>
      ) : null}
      {canCreateAppointment ? (
        <button type="button" className="pron-btn pron-btn-secondary" onClick={onCreateAppointment}>
          <Clock size={16} />
          <span>Nova Consulta</span>
        </button>
      ) : null}
      {canLinkProject ? (
        <button type="button" className="pron-btn pron-btn-secondary" onClick={onOpenProject}>
          <FolderKanban size={16} />
          <span>Projeto</span>
        </button>
      ) : null}
      <button type="button" className="pron-btn pron-btn-secondary" onClick={onOpenHistory}>
        <History size={16} />
        <span>Historico</span>
      </button>
    </div>
  </header>
);

export default ProntuarioHeader;
