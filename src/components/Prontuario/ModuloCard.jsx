import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

const STATUS_CFG = {
  finalizada:  { label: 'Finalizada', cls: 'modulo-status--finalizada' },
  rascunho:    { label: 'Rascunho',   cls: 'modulo-status--rascunho'   },
  pendente:    { label: 'Pendente',   cls: 'modulo-status--pendente'   },
};

/**
 * ModuloCard — card clicável para cada módulo de avaliação.
 * Toggle abre painel de detalhe inline (sem recálculo de completude no frontend).
 *
 * @param {{
 *   modulo: { id: string, label: string, tipo: string },
 *   avaliacao: object|null,
 *   valorPrincipal: string|number|null,
 *   aberto: boolean,
 *   onToggle: () => void,
 *   formatDate: (d: Date) => string,
 * }} props
 */
const ModuloCard = ({ modulo, avaliacao, valorPrincipal, metrics = [], aberto, onToggle, formatDate }) => {
  const status = avaliacao?.status || 'pendente';
  /* Completude sempre do backend — nunca recalculada aqui */
  const completude = avaliacao?.completude ?? null;
  const scfg = STATUS_CFG[status] || { label: status, cls: '' };

  const dataLabel = avaliacao
    ? (() => {
        const raw = avaliacao.createdAt || avaliacao.data;
        if (!raw) return null;
        const d = new Date(raw);
        return isNaN(d.getTime())
          ? raw
          : formatDate
          ? formatDate(d)
          : d.toLocaleDateString('pt-BR');
      })()
    : null;

  return (
    <article
      className={[
        'modulo-card',
        aberto ? 'modulo-card--aberto' : '',
        !avaliacao ? 'modulo-card--vazio' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <button
        type="button"
        className="modulo-card__btn"
        onClick={onToggle}
        aria-expanded={aberto}
        aria-controls={`modulo-detalhe-${modulo.id}`}
      >
        <div className="modulo-card__row">
          <span className="modulo-card__nome">{modulo.label}</span>
          <div className="modulo-card__direita">
            {valorPrincipal != null && (
              <span className="modulo-card__valor">{valorPrincipal}</span>
            )}
            <span className={`modulo-card__status ${scfg.cls}`}>{scfg.label}</span>
            {aberto ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </div>
        </div>

        {completude != null && (
          <div
            className="modulo-card__prog-track"
            role="progressbar"
            aria-valuenow={completude}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Completude ${completude}%`}
          >
            <div
              className="modulo-card__prog-bar"
              style={{ width: `${Math.min(100, Math.max(0, completude))}%` }}
            />
          </div>
        )}
      </button>

      {aberto && (
        <div
          id={`modulo-detalhe-${modulo.id}`}
          className="modulo-card__detalhe"
          role="region"
          aria-label={`Detalhes ${modulo.label}`}
        >
          {avaliacao ? (
            <dl className="modulo-card__dl">
              {metrics.map((m) => (
                <React.Fragment key={m.label}>
                  <dt>{m.label}</dt>
                  <dd>{m.formatted}</dd>
                </React.Fragment>
              ))}
              {metrics.length > 0 && (completude != null || dataLabel || avaliacao.alunoNome) && (
                <div className="modulo-card__dl-divider" role="presentation" />
              )}
              {completude != null && (
                <>
                  <dt>Completude</dt>
                  <dd>{completude}%</dd>
                </>
              )}
              {dataLabel && (
                <>
                  <dt>Data</dt>
                  <dd>{dataLabel}</dd>
                </>
              )}
              {avaliacao.alunoNome && (
                <>
                  <dt>Responsável</dt>
                  <dd>{avaliacao.alunoNome}</dd>
                </>
              )}
              {avaliacao.sessao && (
                <>
                  <dt>Sessão</dt>
                  <dd>{avaliacao.sessao}</dd>
                </>
              )}
            </dl>
          ) : (
            <p className="modulo-card__vazio-msg">Módulo não avaliado ainda.</p>
          )}
        </div>
      )}
    </article>
  );
};

export default ModuloCard;
