import React, { useId, useMemo, useState } from 'react';
import { ChevronDown, PlusCircle, Trash2 } from 'lucide-react';
import AlimentoBuscador from './AlimentoBuscador';
import './RefeicaoBuilder.css';

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(String(value).replace(',', '.').trim());
  return Number.isFinite(parsed) ? parsed : 0;
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
  if (!metaCaloricaPorRefeicao || metaCaloricaPorRefeicao <= 0) {
    return { status: 'neutro', label: 'Sem meta por refeicao' };
  }
  const deltaPercent = (Math.abs(caloriasRefeicao - metaCaloricaPorRefeicao) / metaCaloricaPorRefeicao) * 100;
  if (deltaPercent <= 10) return { status: 'verde', label: 'Adequada' };
  if (deltaPercent <= 20) return { status: 'amarelo', label: 'Ajuste moderado' };
  return { status: 'vermelho', label: 'Ajuste critico' };
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
        lip: nextTotals.lip
      }
    });
  };

  const addAlimento = (item) => patch({ alimentos: [...alimentos, item] });
  const addSubstituto = (item) => patch({ substitutos: [...substitutos, item] });
  const removeAlimento = (index) => patch({ alimentos: alimentos.filter((_, idx) => idx !== index) });
  const removeSubstituto = (index) => patch({ substitutos: substitutos.filter((_, idx) => idx !== index) });

  const renderItem = (item, index, onRemoveItem) => (
    <li
      key={index}
      className={`alimento-item ${index % 2 === 1 ? 'alimento-zebra' : ''}`}
    >
      <div className="alimento-info">
        <span className="alimento-nome">{item.descricao || 'Alimento'}</span>
        <span className="alimento-macros-row">
          <span className="alimento-macro-tag alimento-macro-cho">CHO {toNumber(item.cho).toFixed(1)}g</span>
          <span className="alimento-macro-sep">-</span>
          <span className="alimento-macro-tag alimento-macro-ptn">PTN {toNumber(item.ptn).toFixed(1)}g</span>
          <span className="alimento-macro-sep">-</span>
          <span className="alimento-macro-tag alimento-macro-lip">LIP {toNumber(item.lip).toFixed(1)}g</span>
        </span>
      </div>
      <span className="alimento-qty">{toNumber(item.quantidadeGramas).toFixed(1)} g</span>
      <span className="alimento-kcal">{toNumber(item.calorias).toFixed(1)} kcal</span>
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
            aria-label={collapsed ? 'Expandir refeicao' : 'Colapsar refeicao'}
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
            <section className="refeicao-col">
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
                  {alimentos.map((item, index) => renderItem(item, index, () => removeAlimento(index)))}
                </ul>
              )}
            </section>

            <div className="refeicao-divider" aria-hidden="true">
              <span className="refeicao-divider-label">ou</span>
            </div>

            <section className="refeicao-col">
              <h5 className="refeicao-col-label">
                Substitutos
                {substitutos.length > 0 && (
                  <span className="refeicao-col-count">{substitutos.length}</span>
                )}
              </h5>
              {!readOnly && (
                <div className="busca-alimento-row">
                  <AlimentoBuscador onAdd={addSubstituto} disabled={readOnly} />
                </div>
              )}
              {substitutos.length === 0 ? (
                <p className="refeicao-empty">Nenhum substituto adicionado.</p>
              ) : (
                <ul className="alimentos-lista">
                  {substitutos.map((item, index) => renderItem(item, index, () => removeSubstituto(index)))}
                </ul>
              )}
            </section>
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
                  <PlusCircle size={12} /> Adicionar orientacoes
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

