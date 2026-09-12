import React, { useId, useMemo, useState } from 'react';
import { ChevronDown, PlusCircle, Repeat, Trash2 } from 'lucide-react';
import AlimentoBuscador from './AlimentoBuscador';
import './RefeicaoBuilder.css';

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(String(value).replace(',', '.').trim());
  return Number.isFinite(parsed) ? parsed : 0;
};

// Um substituto listado com os macros absolutos parece só mais um alimento.
// O que a troca precisa dizer e o que MUDA em relacao ao alimento que ele
// substitui — e isso e aritmetica sobre dados que ja existem, sem depender da
// ancora de equivalencia.
const sinalDelta = (valor, casas = 1) => {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return '—';
  const n = Number(valor);
  if (Math.abs(n) < 0.05) return '=';
  return `${n > 0 ? '+' : '−'}${Math.abs(n).toFixed(casas)}`;
};

const deltaEntre = (substituto, base, campo) => {
  if (!base) return null;
  return toNumber(substituto?.[campo]) - toNumber(base?.[campo]);
};

const computeTotals = (items = []) => {
  const totals = items.reduce((acc, item) => ({
    calorias: acc.calorias + toNumber(item?.calorias),
    cho: acc.cho + toNumber(item?.cho),
    ptn: acc.ptn + toNumber(item?.ptn),
    lip: acc.lip + toNumber(item?.lip),
    fibra: acc.fibra + toNumber(item?.fibra)
  }), { calorias: 0, cho: 0, ptn: 0, lip: 0, fibra: 0 });

  return {
    calorias: Number(totals.calorias.toFixed(2)),
    cho: Number(totals.cho.toFixed(2)),
    ptn: Number(totals.ptn.toFixed(2)),
    lip: Number(totals.lip.toFixed(2)),
    fibra: Number(totals.fibra.toFixed(2))
  };
};

const getSemaforo = (caloriasRefeicao, metaCaloricaPorRefeicao) => {
  // Refeicao sem alimento nao esta errada — ela nao foi comecada. Antes, zero
  // kcal contra a meta dava 100% de desvio e a refeicao nascia "critica",
  // com tarja vermelha, antes de qualquer digitacao.
  if (!Number(caloriasRefeicao)) {
    return { status: 'neutro', label: 'Sem alimentos' };
  }
  if (!metaCaloricaPorRefeicao || metaCaloricaPorRefeicao <= 0) {
    return { status: 'neutro', label: 'Sem meta por refeição' };
  }
  const deltaPercent = (Math.abs(caloriasRefeicao - metaCaloricaPorRefeicao) / metaCaloricaPorRefeicao) * 100;
  if (deltaPercent <= 10) return { status: 'verde', label: 'Adequada' };
  if (deltaPercent <= 20) return { status: 'amarelo', label: 'Ajuste moderado' };
  return { status: 'vermelho', label: 'Ajuste crítico' };
};

const SEMAFORO_COLORS = {
  verde: '#0F6E56',
  amarelo: '#F59E0B',
  vermelho: '#B91C1C',
  neutro: '#1565C0'
};

const RefeicaoBuilder = ({
  value,
  onChange,
  onRemove,
  metaCaloricaPorRefeicao = 0,
  readOnly = false,
  refeicaoNumero = 1
}) => {
  const idPrefix = useId();
  const [orientacoesExpanded, setOrientacoesExpanded] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [opcoesAbertas, setOpcoesAbertas] = useState(() => new Set());

  const alimentos = Array.isArray(value?.alimentos) ? value.alimentos : [];
  const substitutos = Array.isArray(value?.substitutos) ? value.substitutos : [];

  const totalRefeicao = useMemo(() => computeTotals(alimentos), [alimentos]);
  const semaforo = useMemo(
    () => getSemaforo(totalRefeicao.calorias, metaCaloricaPorRefeicao),
    [metaCaloricaPorRefeicao, totalRefeicao.calorias]
  );

  const kcalPct = metaCaloricaPorRefeicao > 0
    ? Math.min((totalRefeicao.calorias / metaCaloricaPorRefeicao) * 100, 100)
    : 0;

  const showOrientacoes = orientacoesExpanded || Boolean(value?.orientacoes);

  const patch = (changes) => {
    const next = { ...(value || {}), ...changes };
    const nextTotals = computeTotals(next.alimentos || []);
    onChange?.({
      ...next,
      totalRefeicao: {
        calorias: nextTotals.calorias,
        cho: nextTotals.cho,
        ptn: nextTotals.ptn,
        lip: nextTotals.lip,
        fibra: nextTotals.fibra
      }
    });
  };

  const addAlimento = (item) => patch({ alimentos: [...alimentos, { ...item, substitutos: [] }] });

  const removeAlimento = (index) => {
    const confirmed = window.confirm('Remover este alimento da refeição? As opções de substituição dele saem junto.');
    if (!confirmed) return;
    patch({ alimentos: alimentos.filter((_, idx) => idx !== index) });
  };

  // O substituto passa a pertencer ao alimento, não à refeição: numa refeição
  // com arroz, feijão e ovo, uma lista solta de substitutos não dizia qual
  // deles trocava qual.
  const addSubstitutoAoItem = (alimentoIndex, item) => {
    patch({
      alimentos: alimentos.map((a, idx) => (
        idx === alimentoIndex
          ? { ...a, substitutos: [...(a.substitutos ?? []), item] }
          : a
      ))
    });
  };

  const removeSubstitutoDoItem = (alimentoIndex, subIndex) => {
    const confirmed = window.confirm('Remover esta opção de substituição?');
    if (!confirmed) return;
    patch({
      alimentos: alimentos.map((a, idx) => (
        idx === alimentoIndex
          ? { ...a, substitutos: (a.substitutos ?? []).filter((_, i) => i !== subIndex) }
          : a
      ))
    });
  };

  // Planos salvos antes desta mudança guardavam substitutos no nível da
  // refeição. Continuam visíveis e removíveis, sem vínculo, para que nenhum
  // dado se perca — mas nada novo é gravado aqui.
  const removeSubstitutoLegado = (index) => {
    const confirmed = window.confirm('Remover este substituto sem vínculo?');
    if (!confirmed) return;
    patch({ substitutos: substitutos.filter((_, idx) => idx !== index) });
  };

  const alternarOpcoes = (index) => {
    setOpcoesAbertas((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(index)) proximo.delete(index);
      else proximo.add(index);
      return proximo;
    });
  };

  const renderItem = (item, index, onRemoveItem, extra = {}) => (
    <li
      key={index}
      className={`alimento-item ${index % 2 === 1 ? 'alimento-zebra' : ''}${extra.prefixo ? ' alimento-item--opcao' : ''}`}
    >
      {extra.prefixo && <span className="alimento-prefixo" aria-hidden="true">{extra.prefixo}</span>}
      <div className="alimento-info">
        <span className="alimento-nome">{item.descricao || 'Alimento'}</span>
        {extra.base ? (
          <span className="alimento-macros-row alimento-macros-row--delta">
            <span className="alimento-delta">CHO {sinalDelta(deltaEntre(item, extra.base, 'cho'))}</span>
            <span className="alimento-macro-sep">·</span>
            <span className="alimento-delta">PTN {sinalDelta(deltaEntre(item, extra.base, 'ptn'))}</span>
            <span className="alimento-macro-sep">·</span>
            <span className="alimento-delta">LIP {sinalDelta(deltaEntre(item, extra.base, 'lip'))}</span>
            <span className="alimento-macro-sep">·</span>
            <span className="alimento-delta">FIB {sinalDelta(deltaEntre(item, extra.base, 'fibra'))}</span>
          </span>
        ) : (
          <span className="alimento-macros-row">
            <span className="alimento-macro-tag alimento-macro-cho">CHO {toNumber(item.cho).toFixed(1)}g</span>
            <span className="alimento-macro-sep">-</span>
            <span className="alimento-macro-tag alimento-macro-ptn">PTN {toNumber(item.ptn).toFixed(1)}g</span>
            <span className="alimento-macro-sep">-</span>
            <span className="alimento-macro-tag alimento-macro-lip">LIP {toNumber(item.lip).toFixed(1)}g</span>
            <span className="alimento-macro-sep">-</span>
            <span className="alimento-macro-tag alimento-macro-fibra">FIB {toNumber(item.fibra).toFixed(1)}g</span>
          </span>
        )}
      </div>
      <span className="alimento-qty">{toNumber(item.quantidadeGramas).toFixed(1)} g</span>
      {extra.base ? (
        <span className="alimento-kcal alimento-kcal--delta">
          {sinalDelta(deltaEntre(item, extra.base, 'calorias'), 0)} kcal
        </span>
      ) : (
        <span className="alimento-kcal">{toNumber(item.calorias).toFixed(1)} kcal</span>
      )}
      {extra.onAlternar && (
        <button
          type="button"
          className={`btn-opcoes-alimento${extra.aberto ? ' aberto' : ''}`}
          onClick={extra.onAlternar}
          aria-expanded={extra.aberto}
          aria-label={`Opções de substituição de ${item.descricao || 'alimento'}`}
          title="Opções de substituição"
        >
          <Repeat size={13} />
          {extra.opcoes > 0 && <span className="btn-opcoes-alimento__n">{extra.opcoes}</span>}
        </button>
      )}
      {!readOnly && (
        <button
          type="button"
          className="btn-remover-alimento"
          onClick={onRemoveItem}
          aria-label={`Remover ${item.descricao || ''}`}
        >
          <Trash2 size={13} />
        </button>
      )}
    </li>
  );

  return (
    <article className="refeicao-card" data-semaforo={semaforo.status}>
      <header className="refeicao-header">
        {/* Linha 1 - identidade + remover */}
        <div className="refeicao-header-top">
          <div className="refeicao-header-left">
            <span className="refeicao-numero">{refeicaoNumero}</span>
            <label className="sr-only" htmlFor={`${idPrefix}-nome`}>Nome da refeicao</label>
            <input
              id={`${idPrefix}-nome`}
              className="refeicao-nome-input"
              type="text"
              value={value?.nome || ''}
              onChange={(event) => patch({ nome: event.target.value })}
              placeholder="Nome da refeicao"
              disabled={readOnly}
              aria-required="true"
            />
            <label className="sr-only" htmlFor={`${idPrefix}-horario`}>Horario da refeicao</label>
            <input
              id={`${idPrefix}-horario`}
              className="refeicao-hora-input"
              type="time"
              value={value?.horario || ''}
              onChange={(event) => patch({ horario: event.target.value })}
              disabled={readOnly}
              aria-required="true"
            />
          </div>
          <button
            type="button"
            className={`btn-collapse-refeicao ${collapsed ? 'collapsed' : ''}`}
            onClick={() => setCollapsed((prev) => !prev)}
            aria-label={collapsed ? 'Expandir refeição' : 'Colapsar refeição'}
          >
            <ChevronDown size={15} />
          </button>
          {!readOnly && (
            <button
              type="button"
              className="btn-remover-refeicao"
              onClick={onRemove}
              aria-label={`Remover refeicao ${refeicaoNumero}`}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>

        {/* Linha 2 - macros + peri-treino + progress bar */}
        <div className="refeicao-header-meta">
          <div className="refeicao-macro-row">
            <span className="macro-chip macro-kcal">{totalRefeicao.calorias.toFixed(1)} kcal</span>
            <span className="macro-chip macro-cho">CHO {totalRefeicao.cho.toFixed(1)}g</span>
            <span className="macro-chip macro-ptn">PTN {totalRefeicao.ptn.toFixed(1)}g</span>
            <span className="macro-chip macro-lip">LIP {totalRefeicao.lip.toFixed(1)}g</span>
            <span className="macro-chip macro-fibra">FIB {totalRefeicao.fibra.toFixed(1)}g</span>
          </div>

          <div className="refeicao-meta-right">
            <label className="toggle-treino" htmlFor={`${idPrefix}-vinculo-treino`}>
              <input
                id={`${idPrefix}-vinculo-treino`}
                type="checkbox"
                checked={Boolean(value?.vinculadoTreino)}
                onChange={(event) => patch({
                  vinculadoTreino: event.target.checked,
                  tipoVinculo: event.target.checked ? (value?.tipoVinculo || 'pre') : null
                })}
                disabled={readOnly}
              />
              Peri-treino
            </label>

            {value?.vinculadoTreino && (
              <>
                <label className="sr-only" htmlFor={`${idPrefix}-tipo-vinculo`}>Tipo de vinculo treino</label>
                <select
                  id={`${idPrefix}-tipo-vinculo`}
                  className="refeicao-hora-input refeicao-vinculo-select"
                  value={value?.tipoVinculo || 'pre'}
                  onChange={(event) => patch({ tipoVinculo: event.target.value })}
                  disabled={readOnly}
                >
                  <option value="pre">Pre</option>
                  <option value="peri">Peri</option>
                  <option value="pos">Pos</option>
                </select>
              </>
            )}

            {metaCaloricaPorRefeicao > 0 && (
              <div
                className="refeicao-kcal-progress"
                title={`${Math.round(kcalPct)}% da meta por refeição (${totalRefeicao.calorias.toFixed(0)} de ${metaCaloricaPorRefeicao.toFixed(0)} kcal)`}
              >
                <span className="refeicao-kcal-pct">{Math.round(kcalPct)}%</span>
                <div className="refeicao-kcal-bar">
                  <div
                    className="refeicao-kcal-fill"
                    style={{
                      width: `${kcalPct}%`,
                      background: SEMAFORO_COLORS[semaforo.status]
                    }}
                  />
                </div>
                <span className="refeicao-kcal-abs">{totalRefeicao.calorias.toFixed(0)}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {!collapsed && (
        <>
          <div className="refeicao-body">
            <section className="refeicao-col refeicao-col--unica">
              <h5 className="refeicao-col-label">
                <PlusCircle size={13} /> Alimentos
                {alimentos.length > 0 && (
                  <span className="refeicao-col-count">{alimentos.length}</span>
                )}
              </h5>
              {!readOnly && (
                <div className="busca-alimento-row">
                  <AlimentoBuscador onAdd={addAlimento} disabled={readOnly} />
                </div>
              )}
              {alimentos.length === 0 ? (
                <p className="refeicao-empty">Nenhum alimento adicionado.</p>
              ) : (
                <ul className="alimentos-lista">
                  {alimentos.map((item, index) => {
                    const opcoes = Array.isArray(item.substitutos) ? item.substitutos : [];
                    const aberto = opcoesAbertas.has(index);
                    return (
                      <React.Fragment key={index}>
                        {renderItem(item, index, () => removeAlimento(index), {
                          opcoes: opcoes.length,
                          aberto,
                          onAlternar: () => alternarOpcoes(index)
                        })}
                        {aberto && (
                          <li className="alimento-opcoes">
                            {opcoes.length === 0 && (
                              <p className="refeicao-empty">Nenhuma opção de substituição para este alimento.</p>
                            )}
                            <ul className="alimentos-lista alimentos-lista--opcoes">
                              {opcoes.map((sub, subIndex) => (
                                <React.Fragment key={subIndex}>
                                  {renderItem(sub, subIndex, () => removeSubstitutoDoItem(index, subIndex), {
                                    prefixo: 'ou',
                                    base: item
                                  })}
                                </React.Fragment>
                              ))}
                            </ul>
                            {!readOnly && (
                              <div className="busca-alimento-row busca-alimento-row--opcao">
                                <AlimentoBuscador
                                  onAdd={(novo) => addSubstitutoAoItem(index, novo)}
                                  disabled={readOnly}
                                />
                              </div>
                            )}
                          </li>
                        )}
                      </React.Fragment>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* Só aparece se o plano vier do modelo antigo, em que o substituto
                pertencia à refeição e não se sabia qual alimento ele trocava. */}
            {substitutos.length > 0 && (
              <section className="refeicao-col refeicao-col--legado">
                <h5 className="refeicao-col-label">
                  Substitutos sem vínculo
                  <span className="refeicao-col-count">{substitutos.length}</span>
                </h5>
                <p className="refeicao-empty">
                  Vieram de um plano anterior, quando o substituto era da refeição inteira.
                  Adicione-os na opção do alimento correspondente e remova daqui.
                </p>
                <ul className="alimentos-lista">
                  {substitutos.map((item, index) => (
                    <React.Fragment key={index}>
                      {renderItem(item, index, () => removeSubstitutoLegado(index))}
                    </React.Fragment>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <footer className="refeicao-footer">
            <div className={`refeicao-semaforo ${semaforo.status}`}>
              <span className="dot" />
              {semaforo.label}
            </div>
          </footer>

          <div className="refeicao-orientacoes">
            {!showOrientacoes ? (
              !readOnly && (
                <button
                  type="button"
                  className="btn-add-orientacoes"
                  onClick={() => setOrientacoesExpanded(true)}
                >
                  <PlusCircle size={12} /> Adicionar orientações
                </button>
              )
            ) : (
              <>
                <label className="form-field-label" htmlFor={`${idPrefix}-orientacoes`}>Orientacoes</label>
                <textarea
                  id={`${idPrefix}-orientacoes`}
                  className="orientacoes-textarea"
                  rows={3}
                  value={value?.orientacoes || ''}
                  onChange={(event) => patch({ orientacoes: event.target.value })}
                  disabled={readOnly}
                  placeholder="Orientacoes especificas para esta refeicao..."
                />
              </>
            )}
          </div>
        </>
      )}
    </article>
  );
};

export default RefeicaoBuilder;

