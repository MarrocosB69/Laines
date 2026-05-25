import React, { useMemo } from 'react';
import { AlertTriangle, Plus, Calendar, FileText, ChevronRight } from 'lucide-react';
import { FeedbackState } from '../ui';
import { EVALUATION_REGISTRY } from '../../constants/evaluationRegistry';
import SparkLine from './SparkLine';

/* ── helpers ───────────────────────────────────────────── */

const ALVO_GC = {
  futebol_feminino:  { min: 14, max: 22 },
  futebol_masculino: { min:  8, max: 14 },
  natacao_feminino:  { min: 14, max: 24 },
  natacao_masculino: { min:  8, max: 15 },
  default:           { min: 18, max: 25 },
};

const getAlvoGC = (modalidade = '', sexo = '') => {
  const m = String(modalidade).toLowerCase().replace(/\s+/g, '_');
  const s = String(sexo).toLowerCase();
  return ALVO_GC[`${m}_${s}`] || ALVO_GC[m] || ALVO_GC.default;
};

const formatRedsLabel = (v) =>
  String(v || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const getRedsTone = (v) => {
  const t = String(v || '').toLowerCase();
  if (t.includes('estabelecido') || t.includes('reds')) return 'risk';
  if (t.includes('risco_relativo') || t.includes('baixa')) return 'alert';
  if (t.includes('otima') || t.includes('ótima')) return 'ok';
  return 'neutral';
};

const pick = (obj, keys) => {
  for (const k of keys) { if (obj?.[k] != null) return obj[k]; }
  return null;
};

const MACRO_STAGE_ORDER = ['triagem', 'composicao_corporal', 'demanda_performance', 'rotina_alimentar', 'multiprofissional', 'conduta'];

/* ── component ─────────────────────────────────────────── */

const VisaoGeral = ({
  patient,
  avaliacoes = [],
  moduleConfig: _moduleConfig = [],
  pendingModules = [],
  consultationStatusSummary: _consultationStatusSummary = {},
  nextAppointment,
  formatDate,
  podeEditarAvaliacoes,
  onOpenEvaluationType,
  onCreateEvaluation,
  onCreateAppointment,
  onCreateMealPlan,
}) => {

  /* group by tipo → latest first */
  const avaliacoesPorTipo = useMemo(() => {
    const map = {};
    for (const av of avaliacoes) {
      if (!map[av.tipo]) map[av.tipo] = [];
      map[av.tipo].push(av);
    }
    return map;
  }, [avaliacoes]);

  const ultimaPorTipo = useMemo(() => {
    const result = {};
    for (const [tipo, list] of Object.entries(avaliacoesPorTipo)) {
      result[tipo] = list.slice().sort(
        (a, b) => new Date(b.createdAt || b.data || 0) - new Date(a.createdAt || a.data || 0)
      )[0];
    }
    return result;
  }, [avaliacoesPorTipo]);

  /* ── clinical snapshot ── */
  const composicao = useMemo(() => {
    const r = ultimaPorTipo['bioimpedancia']?.resultados
           || ultimaPorTipo['dobras_cutaneas']?.resultados;
    if (!r) return null;
    return {
      pesoKg:            pick(r, ['pesoKg', 'pesoTotal', 'weightKg', 'peso_kg']),
      percentualGordura: pick(r, ['percentualGordura', 'percentual_gordura', 'percentFat']),
      massaMagraKg:      pick(r, ['massaMagraKg', 'massaMagra', 'massa_magra_kg', 'leanMassKg']),
    };
  }, [ultimaPorTipo]);

  const energetica = useMemo(() => {
    const r = ultimaPorTipo['gasto_energetico_total']?.resultados;
    if (!r) return {};
    return {
      get: pick(r, ['getEstimadoKcal', 'get_estimado_kcal', 'get_kcal']),
      ger: pick(r, ['tmbBaseKcal', 'ger_kcal', 'gerKcal']),
      de:  pick(r, ['disponibilidadeEnergetica', 'disponibilidade_energetica', 'DE']),
    };
  }, [ultimaPorTipo]);

  const vitais = useMemo(() => {
    const r = ultimaPorTipo['avaliacao_clinica']?.resultados;
    if (!r) return {};
    return {
      paSistolica:  pick(r, ['pressaoSistolica', 'pressao_sistolica']),
      paDiastolica: pick(r, ['pressaoDiastolica', 'pressao_diastolica']),
      fc:           pick(r, ['frequenciaCardiaca', 'frequencia_cardiaca', 'fc']),
      temperatura:  pick(r, ['temperaturaCorporal', 'temperatura_corporal', 'temperatura']),
      glicemia:     pick(r, ['glicemia', 'glicemia_mg_dl']),
    };
  }, [ultimaPorTipo]);

  const redsAtual = useMemo(() => {
    const r = ultimaPorTipo['triagem_reds']?.resultados;
    return pick(r || {}, ['classificacaoDE', 'output.classificacaoDE']) || null;
  }, [ultimaPorTipo]);

  const adesao = useMemo(() => {
    const r = ultimaPorTipo['evolucao_retorno']?.resultados;
    return pick(r || {}, ['scoreAdesaoGeral', 'score_adesao_geral']);
  }, [ultimaPorTipo]);

  const alvoGC = useMemo(() =>
    getAlvoGC(
      patient?.modalidadePrincipal || patient?.modalidade || '',
      patient?.sexo || patient?.sexoBiologico || ''
    ),
  [patient]);

  const alertas = useMemo(() => {
    const signals = [];
    const kcalR = ultimaPorTipo['alimentar']?.resultados;
    const kcalIngerida = kcalR
      ? (pick(kcalR, ['caloriasTotal', 'totalDiario', 'energiaTotalKcal', 'energiaKcal'])
          ?? pick(kcalR?.calculated || {}, ['totalDiario', 'caloriasTotal']))
      : null;
    const getKcal = energetica.get != null ? Number(energetica.get) : null;
    if (kcalIngerida != null && getKcal != null) {
      const num = Number(kcalIngerida);
      if (Number.isFinite(num) && Number.isFinite(getKcal)) {
        const balanco = Math.round(num - getKcal);
        if (balanco < -500) signals.push({ id: 'deficit', tone: 'danger', title: 'Déficit energético elevado', msg: `Ingestão ${Math.round(num)} kcal vs GET ${Math.round(getKcal)} kcal (${balanco} kcal)` });
        else if (balanco > 500) signals.push({ id: 'surplus', tone: 'warn', title: 'Superávit energético elevado', msg: `Ingestão ${Math.round(num)} kcal vs GET ${Math.round(getKcal)} kcal (+${balanco} kcal)` });
      }
    }
    const examesSnap = ultimaPorTipo['exames_laboratoriais'];
    if (examesSnap) {
      const analitos = Array.isArray(examesSnap.dados?.analitos) ? examesSnap.dados.analitos : [];
      const alterados = analitos.filter((a) => String(a?.status || '') === 'alterado').map((a) => String(a?.nome || '')).filter(Boolean);
      const limitrofes = analitos.filter((a) => String(a?.status || '') === 'limitrofe').map((a) => String(a?.nome || '')).filter(Boolean);
      if (alterados.length > 0) {
        signals.push({ id: 'exames-alt', tone: 'danger', title: `${alterados.length} exame(s) fora da referência`, msg: alterados.slice(0, 3).join(', ') + (alterados.length > 3 ? ` +${alterados.length - 3}` : '') });
      } else if (limitrofes.length > 0) {
        signals.push({ id: 'exames-lim', tone: 'warn', title: `${limitrofes.length} exame(s) limítrofe(s)`, msg: limitrofes.slice(0, 3).join(', ') + (limitrofes.length > 3 ? ` +${limitrofes.length - 3}` : '') });
      }
    }
    if (redsAtual && getRedsTone(redsAtual) === 'risk') {
      signals.push({ id: 'reds-risk', tone: 'danger', title: 'RED-S: Deficiência Energética estabelecida', msg: formatRedsLabel(redsAtual) });
    }
    if (energetica.de != null && Number(energetica.de) < 30) {
      signals.push({ id: 'de-critica', tone: 'danger', title: 'Disponibilidade energética crítica', msg: `DE: ${Number(energetica.de).toFixed(1)} kcal/kg MLG` });
    }
    if (adesao != null && Number(adesao) < 50) {
      signals.push({ id: 'adesao-baixa', tone: 'warn', title: 'Adesão baixa ao plano', msg: `Score de adesão: ${adesao}%` });
    }
    return signals.slice(0, 6);
  }, [adesao, energetica.de, energetica.get, redsAtual, ultimaPorTipo]);

  /* ── fluxo avaliativo ── */
  const modulosFull = useMemo(() =>
    EVALUATION_REGISTRY.filter((e) => e.contexts?.prontuario).map((e) => ({
      id: e.moduleId || e.type,
      tipo: e.type,
      label: e.shortLabel || e.label,
      macroStageId: e.macroStageId,
      macroStageLabel: e.macroStageLabel,
    })),
  []);

  const stageOrder = useMemo(() => {
    const map = {};
    modulosFull.forEach((m) => { map[m.tipo] = m.macroStageId; });
    return map;
  }, [modulosFull]);

  const modulosAgrupados = useMemo(() => {
    const completedTypes = new Set(
      avaliacoes.filter((av) => av.status === 'finalizada').map((av) => av.tipo)
    );
    const map = new Map();
    for (const m of modulosFull) {
      const key = m.macroStageId || 'outros';
      if (!map.has(key)) map.set(key, { label: m.macroStageLabel || key, modules: [] });
      map.get(key).modules.push({ ...m, done: completedTypes.has(m.tipo) });
    }
    const ordered = MACRO_STAGE_ORDER
      .filter((id) => map.has(id))
      .map((id) => ({ id, ...map.get(id) }));
    for (const [key, val] of map) {
      if (!MACRO_STAGE_ORDER.includes(key)) ordered.push({ id: key, ...val });
    }
    return ordered;
  }, [modulosFull, avaliacoes]);

  /* ── sparklines ── */
  const sparksPeso = useMemo(() => {
    return (avaliacoesPorTipo['bioimpedancia'] || [])
      .filter((av) => pick(av.resultados || {}, ['pesoKg', 'pesoTotal', 'weightKg']) != null)
      .sort((a, b) => new Date(a.createdAt || a.data || 0) - new Date(b.createdAt || b.data || 0))
      .map((av) => ({
        valor: pick(av.resultados || {}, ['pesoKg', 'pesoTotal', 'weightKg']),
        dataLabel: formatDate ? formatDate(new Date(av.createdAt || av.data)) : '',
      }));
  }, [avaliacoesPorTipo, formatDate]);

  const sparksGC = useMemo(() => {
    return (avaliacoesPorTipo['bioimpedancia'] || [])
      .filter((av) => pick(av.resultados || {}, ['percentualGordura', 'percentFat']) != null)
      .sort((a, b) => new Date(a.createdAt || a.data || 0) - new Date(b.createdAt || b.data || 0))
      .map((av) => ({
        valor: pick(av.resultados || {}, ['percentualGordura', 'percentFat']),
        dataLabel: formatDate ? formatDate(new Date(av.createdAt || av.data)) : '',
      }));
  }, [avaliacoesPorTipo, formatDate]);

  const sparksDE = useMemo(() => {
    return (avaliacoesPorTipo['gasto_energetico_total'] || [])
      .filter((av) => pick(av.resultados || {}, ['disponibilidadeEnergetica', 'DE']) != null)
      .sort((a, b) => new Date(a.createdAt || a.data || 0) - new Date(b.createdAt || b.data || 0))
      .map((av) => ({
        valor: pick(av.resultados || {}, ['disponibilidadeEnergetica', 'DE']),
        dataLabel: formatDate ? formatDate(new Date(av.createdAt || av.data)) : '',
      }));
  }, [avaliacoesPorTipo, formatDate]);

  const hasVitais = Object.values(vitais).some((v) => v != null);
  const hasComposicao = composicao && Object.values(composicao).some((v) => v != null);
  const hasEnergetica = energetica.get != null || energetica.de != null;

  /* ── render ─────────────────────────────────────────── */
  return (
    <div className="visao-geral">

      {/* 1 — Fluxo Avaliativo */}
      <section className="pron-card pron-panel visao-geral__fases">
        <header className="pron-panel-header">
          <div>
            <h2>Fluxo Avaliativo</h2>
          </div>
          <span className="pron-badge-muted">
            {avaliacoes.length} aval. · {pendingModules.length} pendentes
          </span>
        </header>
        <div className="vg-fases">
          {modulosAgrupados.map((group) => {
            const done  = group.modules.filter((m) => m.done).length;
            const total = group.modules.length;
            const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
            return (
              <div
                key={group.id}
                className={`vg-fase ${done === total ? 'vg-fase--done' : done > 0 ? 'vg-fase--partial' : 'vg-fase--empty'}`}
              >
                <div className="vg-fase__top">
                  <span className="vg-fase__label">{group.label}</span>
                  <span className="vg-fase__count">{done}/{total}</span>
                </div>
                <div className="vg-fase__track">
                  <div className="vg-fase__fill" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 2 — Alertas clínicos */}
      {alertas.length > 0 && (
        <section className="pron-card pron-panel vg-alertas-section">
          <header className="pron-panel-header">
            <div className="pron-title-inline">
              <AlertTriangle size={14} />
              <div>
                <h2>Alertas clínicos</h2>
              </div>
            </div>
            <span className="pron-badge pron-badge-warn">{alertas.length} alerta{alertas.length !== 1 ? 's' : ''}</span>
          </header>
          <ul className="vg-alertas">
            {alertas.map((alerta) => (
              <li key={alerta.id} className={`vg-alerta vg-alerta--${alerta.tone}`}>
                <strong>{alerta.title}</strong>
                <span>{alerta.msg}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 3 — Snapshot + Próxima Ação */}
      <div className="vg-grid-2">

        {/* Snapshot Clínico */}
        <section className="pron-card pron-panel">
          <header className="pron-panel-header">
            <div>
              <h2>Snapshot Clínico</h2>
            </div>
            {redsAtual && (
              <span className={`pron-badge-reds pron-badge-reds--${getRedsTone(redsAtual)}`}>
                RED-S: {formatRedsLabel(redsAtual)}
              </span>
            )}
          </header>
          {hasComposicao || hasEnergetica ? (
            <>
              <dl className="vg-snapshot">
                {composicao?.pesoKg != null && (
                  <div className="vg-snapshot__row">
                    <dt>Peso</dt>
                    <dd>{Number(composicao.pesoKg).toFixed(1)} <span>kg</span></dd>
                  </div>
                )}
                {composicao?.percentualGordura != null && (
                  <div className={`vg-snapshot__row ${
                    alvoGC && composicao.percentualGordura > alvoGC.max ? 'vg-snapshot__row--warn'
                    : alvoGC && composicao.percentualGordura < alvoGC.min ? 'vg-snapshot__row--alert'
                    : 'vg-snapshot__row--ok'
                  }`}>
                    <dt>% Gordura</dt>
                    <dd>
                      {Number(composicao.percentualGordura).toFixed(1)}<span>%</span>
                      {alvoGC && (
                        <em className="vg-snapshot__alvo">alvo {alvoGC.min}–{alvoGC.max}%</em>
                      )}
                    </dd>
                  </div>
                )}
                {composicao?.massaMagraKg != null && (
                  <div className="vg-snapshot__row">
                    <dt>Massa Magra</dt>
                    <dd>{Number(composicao.massaMagraKg).toFixed(1)} <span>kg</span></dd>
                  </div>
                )}
                {energetica.de != null && (
                  <div className={`vg-snapshot__row ${
                    energetica.de < 30 ? 'vg-snapshot__row--risk'
                    : energetica.de < 45 ? 'vg-snapshot__row--warn'
                    : 'vg-snapshot__row--ok'
                  }`}>
                    <dt>Disp. Energética</dt>
                    <dd>{Number(energetica.de).toFixed(1)} <span>kcal/kg MLG</span></dd>
                  </div>
                )}
                {energetica.get != null && (
                  <div className="vg-snapshot__row">
                    <dt>GET estimado</dt>
                    <dd>{energetica.get} <span>kcal</span></dd>
                  </div>
                )}
                {adesao != null && (
                  <div className={`vg-snapshot__row ${adesao < 50 ? 'vg-snapshot__row--warn' : 'vg-snapshot__row--ok'}`}>
                    <dt>Adesão</dt>
                    <dd>{adesao}<span>%</span></dd>
                  </div>
                )}
              </dl>
              {(sparksPeso.length > 1 || sparksGC.length > 1 || sparksDE.length > 1) && (
                <div className="vg-snapshot__sparks">
                  {sparksPeso.length > 1 && (
                    <SparkLine pontos={sparksPeso} label="Peso" unidade="kg" cor="#3b82f6" />
                  )}
                  {sparksGC.length > 1 && (
                    <SparkLine pontos={sparksGC} label="% GC" unidade="%" cor="#f59e0b" />
                  )}
                  {sparksDE.length > 1 && (
                    <SparkLine pontos={sparksDE} label="DE" unidade="kcal/kg" cor="#8b5cf6" />
                  )}
                </div>
              )}
            </>
          ) : (
            <FeedbackState empty size="sm" title="Nenhum dado clínico registrado ainda." />
          )}
        </section>

        {/* Próxima Ação */}
        <section className="pron-card pron-panel">
          <header className="pron-panel-header">
            <div><h2>Próxima Ação</h2></div>
          </header>
          <div className="vg-acoes">
            <div className={`vg-consulta ${nextAppointment ? 'vg-consulta--agendada' : 'vg-consulta--vazia'}`}>
              <span className="vg-consulta__label">Próxima consulta</span>
              {nextAppointment ? (
                <strong className="vg-consulta__date">
                  {formatDate ? formatDate(nextAppointment.scheduledDate) : '—'}
                </strong>
              ) : (
                <span className="vg-consulta__none">Nenhuma agendada</span>
              )}
            </div>

            {pendingModules.length > 0 ? (
              <div className="vg-pendencias">
                <p className="vg-pendencias__title">
                  {pendingModules.length} módulo{pendingModules.length > 1 ? 's' : ''} pendente{pendingModules.length > 1 ? 's' : ''}
                </p>
                <ul className="vg-pendencias__list">
                  {pendingModules
                    .slice()
                    .sort((a, b) => {
                      const ai = MACRO_STAGE_ORDER.indexOf(stageOrder[a.tipo] || '');
                      const bi = MACRO_STAGE_ORDER.indexOf(stageOrder[b.tipo] || '');
                      return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
                    })
                    .slice(0, 4)
                    .map((m) => (
                    <li key={m.id || m.tipo}>
                      <button
                        type="button"
                        className="vg-pendencia-btn"
                        onClick={() => podeEditarAvaliacoes && onOpenEvaluationType?.(m.tipo)}
                        disabled={!podeEditarAvaliacoes}
                      >
                        {m.label}
                        {podeEditarAvaliacoes && <ChevronRight size={11} />}
                      </button>
                    </li>
                  ))}
                  {pendingModules.length > 4 && (
                    <li className="vg-pendencias__more">+{pendingModules.length - 4} módulos</li>
                  )}
                </ul>
              </div>
            ) : (
              <p className="vg-tudo-ok">Todos os módulos concluídos.</p>
            )}

            {podeEditarAvaliacoes && (
              <div className="vg-quick-actions">
                <button type="button" className="pron-btn pron-btn-primary pron-btn-sm" onClick={onCreateEvaluation}>
                  <Plus size={12} /> Nova avaliação
                </button>
                {onCreateAppointment && (
                  <button type="button" className="pron-btn pron-btn-secondary pron-btn-sm" onClick={onCreateAppointment}>
                    <Calendar size={12} /> Agendar
                  </button>
                )}
                {onCreateMealPlan && (
                  <button type="button" className="pron-btn pron-btn-secondary pron-btn-sm" onClick={onCreateMealPlan}>
                    <FileText size={12} /> Plano
                  </button>
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* 3 — Vitais compactos */}
      {hasVitais && (
        <section className="pron-card pron-panel vg-vitais-section">
          <header className="pron-panel-header">
            <div><h2>Sinais Vitais</h2></div>
            <span className="pron-text-sm pron-text-muted">última avaliação clínica</span>
          </header>
          <div className="vg-vitais">
            {vitais.paSistolica != null && (
              <div className={`vg-vital-chip ${vitais.paSistolica >= 140 ? 'vg-vital-chip--warn' : ''}`}>
                <span className="vg-vital-chip__label">PA</span>
                <span className="vg-vital-chip__val">{vitais.paSistolica}/{vitais.paDiastolica ?? '—'}</span>
                <span className="vg-vital-chip__unit">mmHg</span>
              </div>
            )}
            {vitais.fc != null && (
              <div className="vg-vital-chip">
                <span className="vg-vital-chip__label">FC</span>
                <span className="vg-vital-chip__val">{vitais.fc}</span>
                <span className="vg-vital-chip__unit">bpm</span>
              </div>
            )}
            {vitais.temperatura != null && (
              <div className="vg-vital-chip">
                <span className="vg-vital-chip__label">Temp</span>
                <span className="vg-vital-chip__val">{vitais.temperatura}</span>
                <span className="vg-vital-chip__unit">°C</span>
              </div>
            )}
            {vitais.glicemia != null && (
              <div className="vg-vital-chip">
                <span className="vg-vital-chip__label">Glicemia</span>
                <span className="vg-vital-chip__val">{vitais.glicemia}</span>
                <span className="vg-vital-chip__unit">mg/dL</span>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
};

export default VisaoGeral;
