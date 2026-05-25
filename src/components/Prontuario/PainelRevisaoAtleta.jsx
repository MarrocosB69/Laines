import React from 'react';
import { CheckCircle, ClipboardCheck } from 'lucide-react';
import { getEvaluationTypeLabel } from '../shared/evaluationSummaryUtils';

const DADOS_SNIPPET = {
  alimentar: (d) => [
    d?.adesao != null ? `Adesão: ${d.adesao}/10` : null,
    d?.observacoes ? `"${String(d.observacoes).slice(0, 60)}${String(d.observacoes).length > 60 ? '…' : ''}"` : null
  ].filter(Boolean),
  hidratacao: (d) => [
    d?.perdaPesoPercentual != null ? `Perda: ${d.perdaPesoPercentual}%` : null,
    d?.sedePercebida != null ? `Sede: ${d.sedePercebida}/10` : null,
    d?.liquidos != null ? `Líquidos: ${d.liquidos} ml` : null
  ].filter(Boolean),
  carga_treino: (d) => [
    d?.cargaSemanaAtual != null ? `Carga: ${d.cargaSemanaAtual} UA` : null,
    d?.rpePercebido != null ? `RPE: ${d.rpePercebido}/10` : null,
    d?.faseAtual ? `Fase: ${d.faseAtual}` : null
  ].filter(Boolean),
  fisioterapia: (d) => [
    d?.localDor ? `Local: ${d.localDor}` : null,
    d?.intensidade != null ? `Intensidade: ${d.intensidade}/10` : null,
    d?.tipoSensacao ? `Tipo: ${d.tipoSensacao}` : null
  ].filter(Boolean)
};

const normalizeType = (value) =>
  String(value || '').trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '_');

const PainelRevisaoAtleta = ({
  pendingSubmissions = [],
  isMarkingReviewedId = null,
  formatDate,
  onMarkAsReviewed
}) => {
  if (pendingSubmissions.length === 0) return null;

  return (
    <section className="pron-card pron-panel pron-revisao-atleta">
      <header className="pron-panel-header">
        <div className="pron-title-inline">
          <ClipboardCheck size={16} />
          <div>
            <h2>Envios do atleta para revisão</h2>
            <p>{pendingSubmissions.length} formulário(s) preenchido(s) pelo atleta aguardando revisão da equipe.</p>
          </div>
        </div>
        <span className="pron-badge pron-badge-warn">{pendingSubmissions.length} pendente(s)</span>
      </header>
      <div className="pron-revisao-list">
        {pendingSubmissions.map((item) => {
          const typeNorm = normalizeType(item.tipo);
          const snippetFn = DADOS_SNIPPET[typeNorm];
          const snippets = snippetFn ? snippetFn(item.dados || {}) : [];
          const isBusy = isMarkingReviewedId === item.id;
          return (
            <article key={item.id} className="pron-revisao-item">
              <div className="pron-revisao-item__info">
                <strong>{getEvaluationTypeLabel(item.tipo)}</strong>
                {item._dateLabel && (
                  <span className="pron-text-secondary">Enviado em {item._dateLabel}</span>
                )}
                {snippets.length > 0 && (
                  <span className="pron-revisao-item__snippet">{snippets.join(' · ')}</span>
                )}
              </div>
              <button
                type="button"
                className="pron-btn pron-btn-primary pron-btn-sm"
                onClick={() => onMarkAsReviewed(item.id)}
                disabled={Boolean(isMarkingReviewedId)}
              >
                {isBusy
                  ? 'Salvando...'
                  : <><CheckCircle size={13} /> Marcar como revisado</>}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default PainelRevisaoAtleta;
