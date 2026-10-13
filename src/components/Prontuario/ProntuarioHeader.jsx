import React from 'react';
import { ArrowLeft, ArrowRight, FolderKanban, History, AlertTriangle } from 'lucide-react';
import './ProntuarioHeader.css';

const ProntuarioHeader = ({
  onBack, patientName, patientInitials, prontuarioNumber, isActive = true, statusLabel = '',
  projectName = '', athleteLoginEmail = '', hasAthleteAccount = false, subtitle = '',
  profileIncomplete = false, canLinkProject = false, alunoResponsavelNome = '',
  professorSupervisorNome = '', consentimento = null, onOpenProject, onOpenHistory,
  careState = '', primaryAction = null, onPrimaryAction, decisionAlerts = [],
}) => (
  <header className="ph-root pron-card ph-overview">
    <div className="ph-left">
      <button type="button" className="ph-back-btn" onClick={onBack} aria-label="Voltar para lista de atletas"><ArrowLeft size={18} aria-hidden="true" /></button>
      <div className="ph-avatar" aria-hidden="true">{patientInitials || 'PT'}</div>
      <div className="ph-identity">
        <h1 className="ph-name">{patientName || 'Paciente'}</h1>
        <div className="ph-meta">
          {subtitle && <span>{subtitle}</span>}
          {prontuarioNumber && <span className="ph-meta__item--code">{prontuarioNumber}</span>}
        </div>
        <p className="ph-supervision"><strong>Supervisão:</strong> {professorSupervisorNome || 'Sem supervisor vinculado'}</p>
      </div>
    </div>
    <div className="ph-current-care">
      <span className="ph-tag ph-tag--info">{careState}</span>
      {primaryAction && <button type="button" className="ph-btn ph-btn--primary" onClick={onPrimaryAction}>{primaryAction.label}<ArrowRight size={15} aria-hidden="true" /></button>}
    </div>
    {decisionAlerts.length > 0 && (
      <ul className="ph-decision-alerts" aria-label="Alertas para este atendimento">
        {decisionAlerts.map((alert) => <li key={alert.id}><AlertTriangle size={14} aria-hidden="true" /><span>{alert.text}</span></li>)}
      </ul>
    )}
    <details className="ph-case-details">
      <summary>Dados do caso e outras ações</summary>
      <dl className="ph-responsaveis">
        <div className="ph-resp"><dt>Discente responsável</dt><dd>{alunoResponsavelNome || 'Não vinculado'}</dd></div>
        <div className="ph-resp"><dt>Cadastro</dt><dd>{statusLabel || (isActive ? 'Ativo' : 'Inativo')}{profileIncomplete ? ' · Confirmação pendente' : ''}</dd></div>
        <div className="ph-resp"><dt>Acesso do atleta</dt><dd>{hasAthleteAccount ? athleteLoginEmail || 'Conta vinculada' : 'Sem conta vinculada'}</dd></div>
        <div className="ph-resp"><dt>Projeto</dt><dd>{projectName || 'Não vinculado'}</dd></div>
        {consentimento && <div className="ph-resp"><dt>Consentimento para pesquisa</dt><dd>{consentimento.rotulo}{consentimento.detalhe ? ` · ${consentimento.detalhe}` : ''}</dd></div>}
      </dl>
      <div className="ph-actions__group">
        {canLinkProject && <button type="button" className="ph-btn ph-btn--ghost" onClick={onOpenProject}><FolderKanban size={15} aria-hidden="true" />Projeto</button>}
        <button type="button" className="ph-btn ph-btn--ghost" onClick={onOpenHistory}><History size={15} aria-hidden="true" />Histórico de consultas</button>
      </div>
    </details>
  </header>
);

export default ProntuarioHeader;
