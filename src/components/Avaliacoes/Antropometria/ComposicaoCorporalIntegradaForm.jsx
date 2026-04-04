import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Layers } from 'lucide-react';
import MiniSparkline from '../../shared/MiniSparkline';
import { Button } from '../../ui';
import { toLocalDateInputValue } from '../../../utils/dateUtils';
import {
  buildComparativeDeltas,
  calculateIntegratedBodyComposition,
  validatePhysiologicalRange
} from '../../../services/calculationEngine';
import '../avaliacoes.css';
import './ComposicaoCorporalIntegradaForm.css';

const ACTIVITY_OPTIONS = [
  { value: 'sedentario', label: 'Sedentario (1.2)' },
  { value: 'pouco_ativo', label: 'Pouco ativo (1.375)' },
  { value: 'ativo', label: 'Moderadamente ativo (1.55)' },
  { value: 'muito_ativo', label: 'Muito ativo (1.725)' },
  { value: 'extremamente_ativo', label: 'Extremamente ativo (1.9)' }
];

const createInitialData = () => ({
  dataAvaliacao: toLocalDateInputValue(new Date()),
  activityLevel: 'sedentario',
  customActivityFactor: '',
  selectedSourceId: '',
  sourceOverrideReason: '',
  selectedTmbFormulaId: '',
  tmbSelectionReason: '',
  observacoes: ''
});

const ComposicaoCorporalIntegradaForm = ({
  pacienteId,
  onSalvar,
  onAutoSave,
  readOnly = false,
  baselineAnthropometry,
  moduleSnapshot,
  moduleHistory = [],
  allEvaluationHistory = [],
  currentSessionId
}) => {
  const [dados, setDados] = useState(createInitialData);
  const [error, setError] = useState('');
  const [saveStatus, setSaveStatus] = useState(null);
  const [hasUserInput, setHasUserInput] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const loadedSnapshotIdRef = useRef(null);
  const autoSaveRef = useRef(null);
  const saveStatusResetRef = useRef(null);

  useEffect(() => () => {
    clearTimeout(autoSaveRef.current);
    if (saveStatusResetRef.current) clearTimeout(saveStatusResetRef.current);
  }, []);

  useEffect(() => {
    const snapshotId = moduleSnapshot?.id || '__empty__';
    if (loadedSnapshotIdRef.current === snapshotId) return;

    const source = moduleSnapshot?.dados || {};
    const dadosBrutos = source?.dados_brutos || source?.input || source;
    const metadadosFormula = source?.metadados_formula || {};

    setDados((prev) => ({
      ...prev,
      dataAvaliacao: normalizeDateValue(firstDefined(
        moduleSnapshot?.data,
        source?.dataAvaliacao,
        dadosBrutos?.dataAvaliacao,
        prev.dataAvaliacao
      )),
      activityLevel: toText(firstDefined(
        dadosBrutos?.activityLevel,
        dadosBrutos?.nivel_atividade,
        source?.nivel_atividade,
        'sedentario'
      )) || 'sedentario',
      customActivityFactor: toInput(firstDefined(
        dadosBrutos?.customActivityFactor,
        dadosBrutos?.fator_atividade_personalizado,
        source?.fator_atividade_personalizado
      ), 2),
      selectedSourceId: toText(firstDefined(
        dadosBrutos?.selectedSourceId,
        source?.fonte_oficial
      )),
      sourceOverrideReason: toText(firstDefined(
        dadosBrutos?.sourceOverrideReason,
        source?.justificativa_override
      )),
      selectedTmbFormulaId: toText(firstDefined(
        metadadosFormula?.formulaId,
        source?.formulaId
      )),
      tmbSelectionReason: toText(firstDefined(
        metadadosFormula?.justificativa,
        dadosBrutos?.tmbSelectionReason
      )),
      observacoes: toText(firstDefined(dadosBrutos?.observacoes, source?.observacoes))
    }));

    loadedSnapshotIdRef.current = snapshotId;
  }, [moduleSnapshot]);

  const profile = useMemo(() => ({
    sex: normalizeSex(baselineAnthropometry?.sexo),
    ageYears: toNumber(baselineAnthropometry?.idade),
    weightKg: toNumber(baselineAnthropometry?.pesoKg),
    heightCm: normalizeHeight(baselineAnthropometry?.estaturaCm)
  }), [baselineAnthropometry]);

  const customActivityFactor = useMemo(
    () => toNumber(dados.customActivityFactor),
    [dados.customActivityFactor]
  );

  const composition = useMemo(() => calculateIntegratedBodyComposition({
    allHistory: allEvaluationHistory,
    currentSessionId,
    sex: profile.sex,
    ageYears: profile.ageYears,
    weightKg: profile.weightKg,
    heightCm: profile.heightCm,
    activityLevel: dados.activityLevel,
    activityFactor: customActivityFactor,
    selectedSourceId: dados.selectedSourceId,
    selectedFormulaId: dados.selectedTmbFormulaId
  }), [
    allEvaluationHistory,
    currentSessionId,
    customActivityFactor,
    dados.activityLevel,
    dados.selectedSourceId,
    dados.selectedTmbFormulaId,
    profile
  ]);

  useEffect(() => {
    if (!dados.selectedSourceId && composition?.selectedSourceId) {
      setDados((prev) => ({ ...prev, selectedSourceId: composition.selectedSourceId }));
    }
  }, [composition?.selectedSourceId, dados.selectedSourceId]);

  useEffect(() => {
    const formulaId = composition?.selectedTmb?.formulaId || composition?.tmbComparative?.defaultFormulaId;
    if (!dados.selectedTmbFormulaId && formulaId) {
      setDados((prev) => ({ ...prev, selectedTmbFormulaId: formulaId }));
    }
  }, [composition?.selectedTmb?.formulaId, composition?.tmbComparative?.defaultFormulaId, dados.selectedTmbFormulaId]);

  const historyRows = useMemo(() => normalizeHistory(moduleHistory), [moduleHistory]);
  const previous = historyRows[0] || null;

  const comparison = useMemo(() => ({
    percentFat: buildComparativeDeltas({ current: composition?.official?.percentFat, reference: previous?.percentFat }),
    leanMass: buildComparativeDeltas({ current: composition?.official?.leanMassKg, reference: previous?.leanMassKg }),
    get: buildComparativeDeltas({ current: composition?.getKcal, reference: previous?.getKcal })
  }), [composition?.getKcal, composition?.official?.leanMassKg, composition?.official?.percentFat, previous]);

  const sparkPercent = useMemo(
    () => buildSparkline(historyRows, 'percentFat', composition?.official?.percentFat),
    [composition?.official?.percentFat, historyRows]
  );
  const sparkLean = useMemo(
    () => buildSparkline(historyRows, 'leanMassKg', composition?.official?.leanMassKg),
    [composition?.official?.leanMassKg, historyRows]
  );

  const hasOfficial = Boolean(composition?.official?.sourceId);
  const outlier = useMemo(() => {
    const status = validatePhysiologicalRange({
      metric: 'percentual_gordura',
      value: composition?.official?.percentFat
    });
    return status.status === 'warning' ? status.message : '';
  }, [composition?.official?.percentFat]);

  const payload = useMemo(() => {
    const selectedFormula = composition?.selectedTmb?.selected || null;
    return {
      dataAvaliacao: normalizeDateValue(dados.dataAvaliacao),
      sexo: profile.sex,
      idade: Number.isFinite(profile.ageYears) ? Math.round(profile.ageYears) : null,
      peso_kg: profile.weightKg ?? null,
      estatura_cm: profile.heightCm ?? null,
      nivel_atividade: dados.activityLevel || 'sedentario',
      fator_atividade_personalizado: Number.isFinite(customActivityFactor) ? customActivityFactor : null,
      fonte_oficial: composition?.official?.sourceId || null,
      dados_brutos: {
        selectedSourceId: composition?.official?.sourceId || null,
        sourceOverrideReason: toText(dados.sourceOverrideReason) || null,
        activityLevel: dados.activityLevel || 'sedentario',
        customActivityFactor: Number.isFinite(customActivityFactor) ? customActivityFactor : null,
        selectedTmbFormulaId: composition?.selectedTmb?.formulaId || null,
        tmbSelectionReason: toText(dados.tmbSelectionReason) || null,
        observacoes: toText(dados.observacoes) || null,
        fontes_disponiveis: (composition?.sources || []).map((source) => ({
          sourceId: source.sourceId,
          label: source.label,
          rank: source.rank,
          percentFat: Number.isFinite(source.percentFat) ? Number(source.percentFat.toFixed(2)) : null,
          fatMassKg: Number.isFinite(source.fatMassKg) ? Number(source.fatMassKg.toFixed(2)) : null,
          leanMassKg: Number.isFinite(source.leanMassKg) ? Number(source.leanMassKg.toFixed(2)) : null,
          bodyWaterL: Number.isFinite(source.bodyWaterL) ? Number(source.bodyWaterL.toFixed(2)) : null,
          measuredAt: source.measuredAt || null,
          isRecommended: Boolean(source.isRecommended),
          isOfficial: Boolean(source.isOfficial)
        }))
      },
      resultados_calculados: {
        percentualGorduraOficial: Number.isFinite(composition?.official?.percentFat) ? Number(composition.official.percentFat.toFixed(2)) : null,
        massaGordaOficialKg: Number.isFinite(composition?.official?.fatMassKg) ? Number(composition.official.fatMassKg.toFixed(2)) : null,
        massaMagraOficialKg: Number.isFinite(composition?.official?.leanMassKg) ? Number(composition.official.leanMassKg.toFixed(2)) : null,
        aguaCorporalOficialL: Number.isFinite(composition?.official?.waterL) ? Number(composition.official.waterL.toFixed(2)) : null,
        tmbSelecionadaKcal: Number.isFinite(composition?.selectedTmb?.tmbKcal) ? Math.round(composition.selectedTmb.tmbKcal) : null,
        getEstimadoKcal: Number.isFinite(composition?.getKcal) ? Math.round(composition.getKcal) : null
      },
      classificacoes: {
        percentual_gordura: composition?.official?.classification?.label || null,
        referencia: composition?.official?.classification?.source || null,
        fonte_oficial: composition?.official?.sourceLabel || null
      },
      metadados_formula: {
        formulaId: selectedFormula?.formulaId || composition?.selectedTmb?.formulaId || null,
        formulaVersion: selectedFormula?.formulaVersion || composition?.selectedTmb?.formulaVersion || null,
        formulaLabel: selectedFormula?.label || null,
        equacao: selectedFormula?.equation || null,
        justificativa: toText(dados.tmbSelectionReason) || null
      },
      comparacao: {
        delta_percentual_gordura: num(comparison.percentFat.deltaAbs, 2),
        delta_massa_magra_kg: num(comparison.leanMass.deltaAbs, 2),
        delta_get_kcal: num(comparison.get.deltaAbs, 0),
        spread_metodos_pp: num(composition?.methodSpreadPp, 2)
      },
      source: {
        mode: 'integrado',
        system: 'composicao_corporal_integrada'
      },
      observacoes: toText(dados.observacoes) || null
    };
  }, [comparison.get.deltaAbs, comparison.leanMass.deltaAbs, comparison.percentFat.deltaAbs, composition, customActivityFactor, dados, profile]);

  const dispatchSave = useCallback(async (auto = false) => {
    const dispatch = auto ? onAutoSave : onSalvar;
    if (!dispatch) return;
    await dispatch({
      tipo: 'composicao_corporal_integrada',
      dados: payload,
      resultados: payload.resultados_calculados,
      data: dados.dataAvaliacao,
      pacienteId,
      schemaVersion: 1,
      formulaId: payload?.metadados_formula?.formulaId || 'mifflin_st_jeor_1990',
      formulaVersion: payload?.metadados_formula?.formulaVersion || '1.0.0',
      sourceSystem: 'integrado',
      measuredAt: normalizeDateValue(dados.dataAvaliacao),
      sessaoId: moduleSnapshot?.sessaoId || currentSessionId
    });
  }, [currentSessionId, dados.dataAvaliacao, moduleSnapshot?.sessaoId, onAutoSave, onSalvar, pacienteId, payload]);

  const executeSave = useCallback(async (auto = false) => {
    setSaveStatus('saving');
    if (saveStatusResetRef.current) clearTimeout(saveStatusResetRef.current);
    try {
      await dispatchSave(auto);
      setSaveStatus('saved');
      saveStatusResetRef.current = setTimeout(() => setSaveStatus(null), 3000);
    } catch (saveError) {
      setSaveStatus('error');
      if (!auto) {
        setError('Nao foi possivel salvar a avaliacao. Tente novamente.');
      }
    }
  }, [dispatchSave]);

  const handleSubmit = useCallback(async () => {
    if (!onSalvar) return;
    setSubmitAttempted(true);
    setError('');
    if (!hasOfficial) {
      setError('Nenhuma fonte valida disponivel para composicao integrada.');
      return;
    }
    if (outlier && !window.confirm(`Valor fora da faixa fisiologica: ${outlier}\nDeseja salvar mesmo assim?`)) {
      return;
    }
    await executeSave(false);
  }, [executeSave, hasOfficial, onSalvar, outlier]);

  useEffect(() => {
    if (readOnly || !onAutoSave || !hasUserInput || !hasOfficial) return undefined;
    clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => executeSave(true), 900);
    return () => clearTimeout(autoSaveRef.current);
  }, [executeSave, hasOfficial, hasUserInput, onAutoSave, readOnly]);

  const tmbRows = composition?.tmbComparative?.rows || [];

  return (
    <div className={`eval-card composicao-integrada-form composicao-integrada-form--modern${readOnly ? ' eval-card--readonly' : ''}`}>
      <div className="eval-header">
        <div className="eval-icon"><Layers size={20} /></div>
        <div>
          <h3 className="eval-title">Composicao corporal integrada</h3>
          <p className="eval-subtitle">Fonte oficial por hierarquia clinica, comparativo de metodos e TMB/GET da sessao.</p>
        </div>
      </div>

      <div className="eval-section">
        <h4 className="eval-section-title">Contexto</h4>
        <div className="composicao-grid">
          <FieldSelect label="Nivel de atividade" value={dados.activityLevel} disabled={readOnly} onChange={(v) => updateField(setDados, setHasUserInput, 'activityLevel', v)} options={ACTIVITY_OPTIONS} />
          <FieldText label="Fator personalizado (opcional)" value={dados.customActivityFactor} disabled={readOnly} onChange={(v) => updateField(setDados, setHasUserInput, 'customActivityFactor', v)} placeholder="Ex.: 1.42" />
          <FieldText label="Fator aplicado" value={Number.isFinite(composition?.activityFactorResolved) ? Number(composition.activityFactorResolved).toFixed(2) : '--'} disabled onChange={() => {}} />
          <FieldText label="Data da avaliacao" value={dados.dataAvaliacao} type="date" disabled={readOnly} onChange={(v) => updateField(setDados, setHasUserInput, 'dataAvaliacao', v)} />
        </div>
      </div>

      <div className="eval-section">
        <h4 className="eval-section-title">Fontes na sessao</h4>
        {(composition?.sources || []).length ? (
          <div className="composicao-table-wrap">
            <table className="composicao-table">
              <thead>
                <tr><th>Fonte</th><th>%G</th><th>MM</th><th>MG</th><th>Agua</th><th>Delta</th><th>Status</th></tr>
              </thead>
              <tbody>
                {composition.sources.map((source) => (
                  <tr
                    key={source.sourceId}
                    className={source.sourceId === composition?.selectedSourceId ? 'is-selected' : ''}
                    onClick={() => !readOnly && updateField(setDados, setHasUserInput, 'selectedSourceId', source.sourceId)}
                    onKeyDown={(event) => {
                      if (readOnly) return;
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        updateField(setDados, setHasUserInput, 'selectedSourceId', source.sourceId);
                      }
                    }}
                    role="button"
                    tabIndex={readOnly ? -1 : 0}
                  >
                    <td><strong>{source.label}</strong></td>
                    <td>{fmt(source.percentFat, 2, '%')}</td>
                    <td>{fmt(source.leanMassKg, 2, 'kg')}</td>
                    <td>{fmt(source.fatMassKg, 2, 'kg')}</td>
                    <td>{fmt(source.bodyWaterL, 2, 'L')}</td>
                    <td className={deltaClass(source.deltaVsOfficial)}>{signed(source.deltaVsOfficial, 2, 'p.p.')}</td>
                    <td>
                      {source.isOfficial ? <span className="composicao-tag composicao-tag--info">Oficial</span> : null}
                      {source.isRecommended ? <span className="composicao-tag composicao-tag--success">Recomendada</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="eval-note">Sem fontes disponiveis nesta sessao.</div>}

        {composition?.hasRelevantMethodSpread ? (
          <div className="composicao-warning">
            <AlertTriangle size={16} />
            <span>Diferenca entre metodos acima de 3 p.p. ({fmt(composition.methodSpreadPp, 2, 'p.p.')}).</span>
          </div>
        ) : null}
      </div>

      <div className="eval-results-section">
        <div className="composicao-cards">
          <ResultCard label="% Gordura" value={composition?.official?.percentFat} unit="%" classification={composition?.official?.classification?.label} delta={comparison.percentFat} />
          <ResultCard label="Massa magra" value={composition?.official?.leanMassKg} unit="kg" classification={composition?.official?.sourceLabel} delta={comparison.leanMass} />
          <ResultCard label="Massa gorda" value={composition?.official?.fatMassKg} unit="kg" classification={composition?.official?.sourceLabel} />
          <ResultCard label="Agua corporal" value={composition?.official?.waterL} unit="L" classification={composition?.official?.sourceLabel} />
          <ResultCard label="TMB oficial" value={composition?.selectedTmb?.tmbKcal} unit="kcal" classification={composition?.selectedTmb?.selected?.label} />
          <ResultCard label="GET estimado" value={composition?.getKcal} unit="kcal" classification="TMB x fator" delta={comparison.get} />
        </div>
        <div className="composicao-sparklines">
          <SparkCard label="% gordura" values={sparkPercent} />
          <SparkCard label="Massa magra" values={sparkLean} />
        </div>
      </div>

      <div className="eval-section">
        <h4 className="eval-section-title">Comparativo de TMB</h4>
        <div className="composicao-table-wrap">
          <table className="composicao-table">
            <thead><tr><th>Formula</th><th>Valor</th><th>Indicado para</th></tr></thead>
            <tbody>
              {tmbRows.map((row) => (
                <tr
                  key={row.formulaId}
                  className={`${row.formulaId === composition?.selectedTmb?.formulaId ? 'is-selected' : ''} ${row.applicable ? '' : 'is-disabled'}`}
                  onClick={() => !readOnly && row.applicable && updateField(setDados, setHasUserInput, 'selectedTmbFormulaId', row.formulaId)}
                  onKeyDown={(event) => {
                    if (readOnly || !row.applicable) return;
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      updateField(setDados, setHasUserInput, 'selectedTmbFormulaId', row.formulaId);
                    }
                  }}
                  role="button"
                  tabIndex={readOnly || !row.applicable ? -1 : 0}
                >
                  <td>{row.label}</td>
                  <td>{row.applicable && Number.isFinite(row.valueKcal) ? `${Math.round(row.valueKcal)} kcal/dia` : 'Nao aplicavel'}</td>
                  <td>{row.indicatedFor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="eval-section">
        <h4 className="eval-section-title">Justificativas e observacoes</h4>
        <FieldArea label="Justificativa de override (opcional)" value={dados.sourceOverrideReason} disabled={readOnly} onChange={(v) => updateField(setDados, setHasUserInput, 'sourceOverrideReason', v)} />
        <FieldArea label="Justificativa da formula TMB (opcional)" value={dados.tmbSelectionReason} disabled={readOnly} onChange={(v) => updateField(setDados, setHasUserInput, 'tmbSelectionReason', v)} />
        <FieldArea label="Observacoes" value={dados.observacoes} disabled={readOnly} onChange={(v) => updateField(setDados, setHasUserInput, 'observacoes', v)} />
      </div>

      <div className="eval-actions">
        {saveStatus ? <span className={`save-indicator ${saveStatus}`}>{saveStatus === 'saving' ? 'Salvando...' : saveStatus === 'saved' ? 'Salvo' : 'Erro ao salvar'}</span> : null}
        <Button type="button" variant="primary" disabled={readOnly} onClick={handleSubmit} loading={saveStatus === 'saving'}>
          Salvar composicao integrada
        </Button>
      </div>

      {submitAttempted && composition?.hasOverride && !toText(dados.sourceOverrideReason) ? (
        <div className="eval-note">Recomendado registrar justificativa para override da fonte oficial.</div>
      ) : null}
      {error ? <div className="eval-note composicao-error-note">{error}</div> : null}
    </div>
  );
};

export default ComposicaoCorporalIntegradaForm;

const FieldText = ({ label, value, onChange, disabled, placeholder = '', type = 'text' }) => (
  <div className="eval-field">
    <label className="eval-label">{label}</label>
    <input className="eval-input" type={type} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} placeholder={placeholder} />
  </div>
);

const FieldSelect = ({ label, value, onChange, disabled, options = [] }) => (
  <div className="eval-field">
    <label className="eval-label">{label}</label>
    <select className="eval-select" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  </div>
);

const FieldArea = ({ label, value, onChange, disabled }) => (
  <div className="eval-field">
    <label className="eval-label">{label}</label>
    <textarea className="eval-textarea" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} />
  </div>
);

const ResultCard = ({ label, value, unit, classification, delta }) => (
  <article className="composicao-card">
    <span>{label}</span>
    <strong>{fmt(value, unit === 'kcal' ? 0 : 2, unit)}</strong>
    <small>{classification || 'Sem classificacao'}</small>
    {delta && Number.isFinite(delta.deltaAbs) ? (
      <p className={deltaClass(delta.deltaAbs)}>{signed(delta.deltaAbs, unit === 'kcal' ? 0 : 2, unit)}</p>
    ) : null}
  </article>
);

const SparkCard = ({ label, values }) => (
  <div className="composicao-spark">
    <p>{label}</p>
    <MiniSparkline values={values} width={240} height={80} />
  </div>
);

function updateField(setDados, setHasUserInput, key, value) {
  setHasUserInput(true);
  setDados((prev) => ({ ...prev, [key]: value }));
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value).replace(',', '.').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function toInput(value, digits = null) {
  const numeric = toNumber(value);
  if (!Number.isFinite(numeric)) return '';
  if (!Number.isFinite(digits)) return String(numeric);
  return Number(numeric).toFixed(digits);
}

function toText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function normalizeHeight(value) {
  const numeric = toNumber(value);
  if (!Number.isFinite(numeric)) return null;
  if (numeric > 0 && numeric <= 3) return Number((numeric * 100).toFixed(1));
  return numeric;
}

function normalizeSex(value) {
  const token = toText(value).toLowerCase();
  if (!token) return null;
  if (token.includes('fem') || token === 'f' || token === 'female') return 'female';
  if (token.includes('masc') || token === 'm' || token === 'male') return 'male';
  return null;
}

function firstDefined(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return null;
}

function normalizeDateValue(value) {
  if (!value) return toLocalDateInputValue(new Date());
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return value.trim();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return toLocalDateInputValue(new Date());
  return toLocalDateInputValue(parsed);
}

function fmt(value, digits = 2, unit = '') {
  if (!Number.isFinite(value)) return '--';
  return `${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })}${unit ? ` ${unit}` : ''}`;
}

function signed(value, digits = 2, unit = '') {
  if (!Number.isFinite(value)) return '--';
  const sign = value > 0 ? '+' : '';
  return `${sign}${fmt(value, digits, unit)}`;
}

function deltaClass(value) {
  if (!Number.isFinite(value)) return 'is-flat';
  if (value > 0) return 'is-up';
  if (value < 0) return 'is-down';
  return 'is-flat';
}

function num(value, digits = 2) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}

function normalizeHistory(records = []) {
  return (Array.isArray(records) ? records : [])
    .map((record) => {
      const data = record?.dados || {};
      const calc = data?.resultados_calculados || {};
      const measuredAt = record?.updatedAt || record?.createdAt || record?.data;
      const timestamp = measuredAt ? new Date(measuredAt).getTime() : 0;
      return {
        timestamp: Number.isFinite(timestamp) ? timestamp : 0,
        percentFat: toNumber(firstDefined(calc?.percentualGorduraOficial, data?.percentual_gordura_oficial)),
        leanMassKg: toNumber(firstDefined(calc?.massaMagraOficialKg, data?.massa_magra_kg)),
        getKcal: toNumber(firstDefined(calc?.getEstimadoKcal, data?.get_estimado_kcal))
      };
    })
    .filter((row) => Number.isFinite(row.percentFat) || Number.isFinite(row.leanMassKg) || Number.isFinite(row.getKcal))
    .sort((a, b) => b.timestamp - a.timestamp);
}

function buildSparkline(rows, key, current) {
  const values = [...rows].sort((a, b) => a.timestamp - b.timestamp).map((row) => row[key]).filter(Number.isFinite);
  if (Number.isFinite(current)) values.push(current);
  return values.slice(-6);
}
