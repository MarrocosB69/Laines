import React, { useMemo, useState } from 'react';
import { FileText } from 'lucide-react';
import { FeedbackState } from '../ui';

const isFieldEmpty = (value) => (
  value === null
  || value === undefined
  || value === ''
  || String(value).trim() === ''
  || String(value).trim() === '---'
);

const GROUP_ORDER = ['identificacao', 'socioeconomico', 'clinico', 'alimentar', 'rotina', 'triagem'];

const GROUP_LABELS = {
  identificacao: 'Identificação',
  socioeconomico: 'Contexto Socioeconômico',
  clinico: 'Saúde e Histórico Clínico',
  alimentar: 'Hábitos Alimentares',
  rotina: 'Atividade e Rotina',
  triagem: 'Triagem pública inicial'
};

const ResumoClinico = ({
  dadosGeraisFields = [],
  formatGeneralValue,
  formatGeneralDate,
  // Duas coisas distintas que uma prop so vinha carregando: ter conta de
  // acesso e ter completado a ficha inicial. Um atleta pode ter a primeira
  // sem a segunda — e e exatamente nesse caso que liberar o formulario e o
  // que destrava o preenchimento.
  athleteHasAccount = false,
  athleteRegistrationCompleted = false,
  ebiaSelfFormEnabled = false,
  ebiaSelfFormReleasedAt = null,
  ebiaSelfFormConsumedAt = null,
  formatDate,
  podeEditarAvaliacoes = false,
  handleReleaseEbiaToAthlete,
  isReleasingEbia = false,
  athleteSelfEvaluationConfigs = [],
  athleteFormReleases = {},
  handleToggleAthleteFormAccess,
  togglingAthleteFormType = '',
  podeEditarResumo = false,
  isEditingSummary = false,
  setIsEditingSummary,
  isSavingSummary = false,
  summaryDraft,
  summarySaved,
  summaryError = '',
  handleSummaryChange,
  handleSummarySave,
  handleSummaryCancel,
  comorbidadesOptions = [],
  handleToggleComorbidade,
  getComorbidadeLabel
}) => {
  const [mostrarVazios, setMostrarVazios] = useState(false);

  const formattedFields = useMemo(() => (
    dadosGeraisFields.map((field) => ({
      ...field,
      displayValue: field.label === 'Data de nascimento'
        ? formatGeneralDate(field.value)
        : formatGeneralValue(field.value)
    }))
  ), [dadosGeraisFields, formatGeneralDate, formatGeneralValue]);

  const qtdVazios = useMemo(
    () => formattedFields.filter((field) => isFieldEmpty(field.displayValue)).length,
    [formattedFields]
  );

  const visibleFields = useMemo(() => {
    if (mostrarVazios) return formattedFields;
    return formattedFields.filter((field) => !isFieldEmpty(field.displayValue));
  }, [formattedFields, mostrarVazios]);

  const groupedFields = useMemo(() => {
    const map = new Map();
    GROUP_ORDER.forEach((key) => map.set(key, []));
    visibleFields.forEach((field) => {
      const groupKey = field.group || 'identificacao';
      if (!map.has(groupKey)) map.set(groupKey, []);
      map.get(groupKey).push(field);
    });
    return map;
  }, [visibleFields]);

  const activeGroups = useMemo(
    () => GROUP_ORDER.filter((key) => groupedFields.get(key)?.length > 0),
    [groupedFields]
  );

  return (
    <section className="pron-stack">
      <article className="pron-card pron-panel">
        <header className="pron-panel-header">
          <div>
            <h2>Dados declarados pelo atleta</h2>
            <p>Cadastro inicial preenchido pelo atleta — fonte: autorrelato.</p>
          </div>
          <div className="pron-inline-actions">
            <span className={`pron-badge ${athleteRegistrationCompleted ? 'pron-badge-ok' : 'pron-badge-warn'}`}>
              {athleteRegistrationCompleted ? 'Cadastro confirmado' : 'Cadastro pendente'}
            </span>
            {podeEditarAvaliacoes ? (
              <button
                type="button"
                className="pron-btn pron-btn-secondary"
                onClick={handleReleaseEbiaToAthlete}
                disabled={isReleasingEbia}
              >
                {isReleasingEbia
                  ? 'Atualizando...'
                  : ebiaSelfFormEnabled
                    ? 'Suspender EBIA'
                    : 'Liberar EBIA'}
              </button>
            ) : null}
          </div>
        </header>

        {ebiaSelfFormEnabled || ebiaSelfFormConsumedAt ? (
          <div className="pron-inline-status">
            {ebiaSelfFormEnabled && (
              <span>
                EBIA liberado em {ebiaSelfFormReleasedAt ? formatDate(ebiaSelfFormReleasedAt) : 'instantes atrás'}.
              </span>
            )}
            {!ebiaSelfFormEnabled && ebiaSelfFormConsumedAt && (
              <span>Último envio de EBIA em {formatDate(ebiaSelfFormConsumedAt)}.</span>
            )}
          </div>
        ) : null}

        {podeEditarAvaliacoes && athleteSelfEvaluationConfigs.length > 0 ? (
          <div className="athlete-form-release-panel">
            <div className="athlete-form-release-head">
              <div>
                <h3>Formulários do atleta</h3>
                <p>Ligue ou suspenda o acesso no portal sem apagar rascunhos ou envios ja feitos.</p>
              </div>
              {!athleteHasAccount ? (
                <span className="pron-badge pron-badge-warn" title="A liberação fica registrada e passa a valer quando o acesso for criado">
                  Atleta ainda sem acesso
                </span>
              ) : !athleteRegistrationCompleted ? (
                <span className="pron-badge pron-badge-warn">Cadastro inicial pendente</span>
              ) : null}
            </div>
            <div className="athlete-form-release-grid">
              {athleteSelfEvaluationConfigs.map((item) => {
                const release = athleteFormReleases?.[item.type] || {};
                const enabled = Boolean(release.enabled);
                const isBusy = togglingAthleteFormType === item.type;
                const releasedAt = release.releasedAt ? new Date(release.releasedAt) : null;
                const disabledAt = release.disabledAt ? new Date(release.disabledAt) : null;
                const statusDate = enabled ? releasedAt : disabledAt;
                const statusLabel = enabled ? 'Liberado' : 'Suspenso';
                return (
                  <article key={item.type} className={`athlete-form-release-item${enabled ? ' athlete-form-release-item-enabled' : ''}`}>
                    <div>
                      <strong>{item.title}</strong>
                      <span>{item.subtitle}</span>
                      {statusDate && !Number.isNaN(statusDate.getTime()) ? (
                        <small>
                          {statusLabel} em {formatDate ? formatDate(statusDate) : statusDate.toLocaleDateString('pt-BR')}
                        </small>
                      ) : (
                        <small>
                          {enabled
                            ? athleteHasAccount
                              ? 'Liberado para preenchimento'
                              : 'Liberado; passa a valer quando o acesso for criado'
                            : 'Nao aparece no portal'}
                        </small>
                      )}
                    </div>
                    <button
                      type="button"
                      className={`pron-btn pron-btn-sm ${enabled ? 'pron-btn-secondary' : 'pron-btn-primary'}`}
                      onClick={() => handleToggleAthleteFormAccess?.(item.type)}
                      disabled={Boolean(togglingAthleteFormType)}
                      aria-label={`${isBusy ? 'Atualizando...' : enabled ? 'Suspender acesso' : 'Liberar'}: ${item.title}`}
                    >
                      {isBusy ? 'Atualizando...' : enabled ? 'Suspender acesso' : 'Liberar'}
                    </button>
                  </article>
                );
              })}
            </div>
          </div>
        ) : null}

        {activeGroups.length === 0 ? (
          <FeedbackState empty size="sm" title="Nenhum dado preenchido pelo atleta." />
        ) : (
          <div className="pron-dados-grupos">
            {activeGroups.map((groupKey) => {
              const fields = groupedFields.get(groupKey) || [];
              return (
                <div key={groupKey} className="pron-dados-grupo">
                  <div className="pron-dados-grupo__header">
                    <h3>{GROUP_LABELS[groupKey]}</h3>
                  </div>
                  <dl className="dados-grid">
                    {fields.map((field) => (
                      <div key={field.label}>
                        <dt className="campo-label">{field.label}</dt>
                        <dd className="campo-valor">{field.displayValue || '—'}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              );
            })}
          </div>
        )}

        <footer className="pron-panel-footer">
          <button
            type="button"
            className="pron-btn pron-btn-secondary"
            onClick={() => setMostrarVazios((prev) => !prev)}
          >
            {mostrarVazios
              ? 'Ocultar campos vazios'
              : qtdVazios > 0
                ? `Ver ${qtdVazios} campos não preenchidos`
                : 'Todos os campos recebidos estão preenchidos'}
          </button>
        </footer>
      </article>

      <article className="pron-card pron-panel">
        <header className="pron-panel-header">
          <div className="pron-title-inline">
            <FileText size={18} aria-hidden="true" />
            <h2>Resumo clínico</h2>
          </div>
          <div className="pron-inline-actions">
            <span className="pron-badge pron-badge-info">Interpretação do profissional</span>
            {podeEditarResumo && isEditingSummary ? (
              <>
                <button
                  type="button"
                  className="pron-btn pron-btn-secondary"
                  onClick={handleSummaryCancel}
                  disabled={isSavingSummary}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="pron-btn pron-btn-primary"
                  onClick={handleSummarySave}
                  disabled={isSavingSummary}
                >
                  {isSavingSummary ? 'Salvando...' : 'Salvar'}
                </button>
              </>
            ) : podeEditarResumo ? (
              <button
                type="button"
                className="pron-btn pron-btn-secondary"
                onClick={() => setIsEditingSummary?.(true)}
              >
                Editar
              </button>
            ) : (
              <span className="pron-text-muted pron-readonly-note">Somente leitura</span>
            )}
          </div>
        </header>

        <div className="anamnese-card">
          <div className="campo-label" id="resumo-queixa-rotulo">Queixa principal</div>
          {isEditingSummary ? (
            <textarea
              className="pron-textarea"
              aria-labelledby="resumo-queixa-rotulo"
              rows="4"
              value={summaryDraft.observacoes}
              onChange={(event) => handleSummaryChange('observacoes', event.target.value)}
            />
          ) : (
            <p className="campo-valor">{summarySaved.observacoes || 'Sem observações registradas.'}</p>
          )}
        </div>

        <div className="pron-divider" />

        <div>
          <div className="campo-label" id="resumo-historico-rotulo">Histórico de saúde</div>
          {isEditingSummary ? (
            <textarea
              className="pron-textarea"
              aria-labelledby="resumo-historico-rotulo"
              rows="4"
              value={summaryDraft.historicoSaude}
              onChange={(event) => handleSummaryChange('historicoSaude', event.target.value)}
            />
          ) : (
            <p className="campo-valor">{summarySaved.historicoSaude || 'Sem histórico detalhado registrado.'}</p>
          )}
        </div>

        <div className="pron-divider" />

        <div className="pron-stack-xs">
          <div className="campo-label" id="resumo-comorbidades-rotulo">Comorbidades pessoais</div>
          {isEditingSummary ? (
            <div className="pron-checkbox-grid" role="group" aria-labelledby="resumo-comorbidades-rotulo">
              {comorbidadesOptions.map((item) => (
                <label key={item.id} className="pron-checkbox-item">
                  <input
                    type="checkbox"
                    checked={(summaryDraft.comorbidadesPessoais || []).includes(item.id)}
                    onChange={() => handleToggleComorbidade('comorbidadesPessoais', item.id)}
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
          ) : (
            <div>
              {(summarySaved.comorbidadesPessoais || []).length === 0 ? (
                <span className="pron-text-muted">Sem informação registrada.</span>
              ) : (
                (summarySaved.comorbidadesPessoais || []).map((id) => (
                  <span key={id} className="chip">{getComorbidadeLabel(id)}</span>
                ))
              )}
            </div>
          )}
        </div>

        <div className="pron-stack-xs">
          <div className="campo-label" id="resumo-familiar-rotulo">Histórico familiar</div>
          {isEditingSummary ? (
            <div className="pron-checkbox-grid" role="group" aria-labelledby="resumo-familiar-rotulo">
              {comorbidadesOptions.map((item) => (
                <label key={`fam-${item.id}`} className="pron-checkbox-item">
                  <input
                    type="checkbox"
                    checked={(summaryDraft.comorbidadesFamiliares || []).includes(item.id)}
                    onChange={() => handleToggleComorbidade('comorbidadesFamiliares', item.id)}
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
          ) : (
            <div>
              {(summarySaved.comorbidadesFamiliares || []).length === 0 ? (
                <span className="pron-text-muted">Sem informação registrada.</span>
              ) : (
                (summarySaved.comorbidadesFamiliares || []).map((id) => (
                  <span key={`fam-${id}`} className="chip">{getComorbidadeLabel(id)}</span>
                ))
              )}
            </div>
          )}
        </div>

        {summaryError ? <div className="pron-error" role="alert">{summaryError}</div> : null}
      </article>
    </section>
  );
};

export default ResumoClinico;
