import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Flame } from 'lucide-react';
import MiniSparkline from '../../shared/MiniSparkline';
import { Button } from '../../ui';
import { toLocalDateInputValue } from '../../../utils/dateUtils';
import {
  buildComparativeDeltas,
  calculateGetEvaluation
} from '../../../services/calculationEngine';
import '../avaliacoes.css';
import './GastoEnergeticoTotalForm.css';

const ACTIVITY_OPTIONS = [
  { value: 'sedentario', label: 'Sedentario (1.2)' },
  { value: 'levemente_ativo', label: 'Levemente ativo (1.375)' },
  { value: 'moderadamente_ativo', label: 'Moderadamente ativo (1.55)' },
  { value: 'muito_ativo', label: 'Muito ativo (1.725)' },
  { value: 'extremamente_ativo', label: 'Extremamente ativo (1.9)' }
];

const createInitialData = () => ({
  dataAvaliacao: toLocalDateInputValue(new Date()),
  activityLevel: 'sedentario',
  customActivityFactor: '',
  manualTmbKcal: '',
  observacoes: ''
});

const GastoEnergeticoTotalForm = ({
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
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [hasUserInput, setHasUserInput] = useState(false);
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

    setDados((prev) => ({
      ...prev,
      dataAvaliacao: normalizeDateValue(firstDefined(
        moduleSnapshot?.data,
        source?.dataAvaliacao,
        dadosBrutos?.dataAvaliacao,
        prev.dataAvaliacao
      )),
      activityLevel: toTextInput(firstDefined(
        dadosBrutos?.activityLevel,
        dadosBrutos?.nivel_atividade,
        source?.nivel_atividade,
        'sedentario'
      )) || 'sedentario',
      customActivityFactor: toInputValue(firstDefined(
        dadosBrutos?.customActivityFactor,
        dadosBrutos?.fator_atividade_personalizado,
        source?.fator_atividade_personalizado
      ), 3),
      manualTmbKcal: toInputValue(firstDefined(
        dadosBrutos?.manualTmbKcal,
        dadosBrutos?.tmb_manual_kcal,
        source?.tmb_manual_kcal
      ), 0),
      observacoes: toTextInput(firstDefined(
        dadosBrutos?.observacoes,
        source?.observacoes
      ))
    }));

    loadedSnapshotIdRef.current = snapshotId;
  }, [moduleSnapshot]);

  const sex = useMemo(
    () => normalizeSexToken(baselineAnthropometry?.sexo),
    [baselineAnthropometry?.sexo]
  );

  const numericFields = useMemo(() => ({
    customActivityFactor: parseNumeric(dados.customActivityFactor),
    manualTmbKcal: parseNumeric(dados.manualTmbKcal)
  }), [dados.customActivityFactor, dados.manualTmbKcal]);

  const getEvaluation = useMemo(() => calculateGetEvaluation({
    allHistory: allEvaluationHistory,
    currentSessionId,
    sex,
    activityLevel: dados.activityLevel,
    customActivityFactor: numericFields.customActivityFactor,
    manualTmbKcal: numericFields.manualTmbKcal
  }), [
    allEvaluationHistory,
    currentSessionId,
    dados.activityLevel,
    numericFields.customActivityFactor,
    numericFields.manualTmbKcal,
    sex
  ]);

  const normalizedHistory = useMemo(
    () => normalizeGetHistory(moduleHistory),
    [moduleHistory]
  );
  const previous = normalizedHistory[0] || null;
  const first = normalizedHistory.length ? normalizedHistory[normalizedHistory.length - 1] : null;

  const comparisonRows = useMemo(() => ([
    createComparisonRow(
      'tmb',
      'TMB base',
      'kcal',
      getEvaluation?.base?.tmbUsedKcal,
      previous?.metrics?.tmb,
      first?.metrics?.tmb
    ),
    createComparisonRow(
      'factor',
      'Fator atividade',
      '',
      getEvaluation?.activity?.factorApplied,
      previous?.metrics?.factor,
      first?.metrics?.factor
    ),
    createComparisonRow(
      'get',
      'GET estimado',
      'kcal',
      getEvaluation?.results?.getKcal,
      previous?.metrics?.get,
      first?.metrics?.get
    )
  ]), [
    first?.metrics?.factor,
    first?.metrics?.get,
    first?.metrics?.tmb,
    getEvaluation?.activity?.factorApplied,
    getEvaluation?.base?.tmbUsedKcal,
    getEvaluation?.results?.getKcal,
    previous?.metrics?.factor,
    previous?.metrics?.get,
    previous?.metrics?.tmb
  ]);

  const sparklineGet = useMemo(() => {
    const values = [];
    [...normalizedHistory]
      .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
      .forEach((item) => {
        if (Number.isFinite(item?.metrics?.get)) values.push(item.metrics.get);
      });
    if (Number.isFinite(getEvaluation?.results?.getKcal)) values.push(getEvaluation.results.getKcal);
    return values.slice(-6);
  }, [getEvaluation, normalizedHistory]);

  const customFactorValidation = useMemo(() => {
    if (dados.customActivityFactor === '') return { status: 'empty', message: '' };
    const numeric = parseNumeric(dados.customActivityFactor);
    if (!Number.isFinite(numeric)) return { status: 'error', message: 'Informe um numero valido.' };
    if (numeric < 0.8 || numeric > 2.5) {
      return { status: 'warning', message: 'Fator personalizado deve estar entre 0.8 e 2.5.' };
    }
    return { status: 'ok', message: '' };
  }, [dados.customActivityFactor]);

  const manualTmbValidation = useMemo(() => {
    if (dados.manualTmbKcal === '') return { status: 'empty', message: '' };
    const numeric = parseNumeric(dados.manualTmbKcal);
    if (!Number.isFinite(numeric)) return { status: 'error', message: 'Informe um numero valido.' };
    if (numeric < 500 || numeric > 6000) {
      return { status: 'warning', message: 'TMB fora da faixa esperada. Verifique o valor.' };
    }
    return { status: 'ok', message: '' };
  }, [dados.manualTmbKcal]);

  const hasFieldErrors = useMemo(
    () => [customFactorValidation, manualTmbValidation].some((item) => item.status === 'error'),
    [customFactorValidation, manualTmbValidation]
  );

  const warnings = useMemo(() => {
    const items = [...(Array.isArray(getEvaluation?.warnings) ? getEvaluation.warnings : [])];
    if (customFactorValidation.status === 'warning') items.push(customFactorValidation.message);
    if (manualTmbValidation.status === 'warning') items.push(manualTmbValidation.message);
    return Array.from(new Set(items.filter(Boolean)));
  }, [customFactorValidation, getEvaluation, manualTmbValidation]);

  const hasRequiredMissing = useMemo(
    () => !Number.isFinite(getEvaluation?.base?.tmbUsedKcal),
    [getEvaluation?.base?.tmbUsedKcal]
  );

  const payloadData = useMemo(() => {
    const deltaGet = buildComparativeDeltas({
      current: getEvaluation?.results?.getKcal,
      reference: previous?.metrics?.get
    });

    return {
      dataAvaliacao: normalizeDateValue(dados.dataAvaliacao),
      sexo: sex,
      nivel_atividade: dados.activityLevel || 'sedentario',
      fator_atividade_personalizado: Number.isFinite(numericFields.customActivityFactor)
        ? numericFields.customActivityFactor
        : null,
      tmb_manual_kcal: Number.isFinite(numericFields.manualTmbKcal)
        ? Math.round(numericFields.manualTmbKcal)
        : null,
      dados_brutos: {
        activityLevel: dados.activityLevel || 'sedentario',
        customActivityFactor: Number.isFinite(numericFields.customActivityFactor)
          ? numericFields.customActivityFactor
          : null,
        manualTmbKcal: Number.isFinite(numericFields.manualTmbKcal)
          ? Math.round(numericFields.manualTmbKcal)
          : null,
        observacoes: toTextInput(dados.observacoes) || null
      },
      resultados_calculados: {
        tmbBaseKcal: Number.isFinite(getEvaluation?.base?.tmbUsedKcal)
          ? Math.round(getEvaluation.base.tmbUsedKcal)
          : null,
        fatorAtividade: Number.isFinite(getEvaluation?.activity?.factorApplied)
          ? Number(getEvaluation.activity.factorApplied.toFixed(3))
          : null,
        getEstimadoKcal: Number.isFinite(getEvaluation?.results?.getKcal)
          ? Math.round(getEvaluation.results.getKcal)
          : null,
        manutencaoKcal: Number.isFinite(getEvaluation?.results?.maintenanceKcal)
          ? Math.round(getEvaluation.results.maintenanceKcal)
          : null,
        emagrecimentoLeveKcal: Number.isFinite(getEvaluation?.results?.weightLossLightKcal)
          ? Math.round(getEvaluation.results.weightLossLightKcal)
          : null,
        emagrecimentoModeradoKcal: Number.isFinite(getEvaluation?.results?.weightLossModerateKcal)
          ? Math.round(getEvaluation.results.weightLossModerateKcal)
          : null,
        emagrecimentoIntensoKcal: Number.isFinite(getEvaluation?.results?.weightLossIntenseKcal)
          ? Math.round(getEvaluation.results.weightLossIntenseKcal)
          : null,
        hipertrofiaMinKcal: Number.isFinite(getEvaluation?.results?.hypertrophyMinKcal)
          ? Math.round(getEvaluation.results.hypertrophyMinKcal)
          : null,
        hipertrofiaMaxKcal: Number.isFinite(getEvaluation?.results?.hypertrophyMaxKcal)
          ? Math.round(getEvaluation.results.hypertrophyMaxKcal)
          : null
      },
      classificacoes: {
        alertaIngestaoIntensa: Boolean(getEvaluation?.safety?.hasIntenseLowIntakeRisk),
        referenciaSeguranca: getEvaluation?.safety?.hasIntenseLowIntakeRisk
          ? `Limite minimo ${Math.round(getEvaluation?.safety?.intenseMinThreshold || 0)} kcal/dia`
          : 'Sem alerta'
      },
      metadados_formula: {
        formulaId: getEvaluation?.base?.formulaId || null,
        formulaVersion: getEvaluation?.base?.formulaVersion || null,
        formulaLabel: getEvaluation?.base?.formulaLabel || null,
        sourceLabel: getEvaluation?.base?.sourceLabel || null,
        formulaGet: getEvaluation?.formulas?.get || 'GET = TMB x fator_atividade'
      },
      comparacao: {
        referencia_comparacao: previous ? 'avaliacao_anterior' : null,
        delta_get_kcal: Number.isFinite(deltaGet.deltaAbs) ? Number(deltaGet.deltaAbs.toFixed(0)) : null,
        delta_get_percentual: Number.isFinite(deltaGet.deltaPct) ? Number(deltaGet.deltaPct.toFixed(2)) : null
      },
      source: {
        mode: 'calculado',
        system: 'gasto_energetico_total'
      },
      observacoes: toTextInput(dados.observacoes) || null
    };
  }, [
    dados.activityLevel,
    dados.dataAvaliacao,
    dados.observacoes,
    getEvaluation,
    numericFields.customActivityFactor,
    numericFields.manualTmbKcal,
    previous,
    sex
  ]);

  const payloadResults = useMemo(() => ({
    tmb_kcal: payloadData?.resultados_calculados?.tmbBaseKcal ?? null,
    fator_atividade: payloadData?.resultados_calculados?.fatorAtividade ?? null,
    get_kcal: payloadData?.resultados_calculados?.getEstimadoKcal ?? null,
    calculated: {
      tmbKcal: payloadData?.resultados_calculados?.tmbBaseKcal ?? null,
      fatorAtividade: payloadData?.resultados_calculados?.fatorAtividade ?? null,
      getKcal: payloadData?.resultados_calculados?.getEstimadoKcal ?? null
    },
    output: {
      alertaIngestaoIntensa: payloadData?.classificacoes?.alertaIngestaoIntensa ?? false
    },
    comparacao: payloadData?.comparacao || {}
  }), [payloadData]);

  const hasValues = useMemo(() => (
    toTextInput(dados.customActivityFactor) !== ''
    || toTextInput(dados.manualTmbKcal) !== ''
    || toTextInput(dados.observacoes) !== ''
    || Number.isFinite(getEvaluation?.results?.getKcal)
  ), [
    dados.customActivityFactor,
    dados.manualTmbKcal,
    dados.observacoes,
    getEvaluation?.results?.getKcal
  ]);

  const dispatchSave = useCallback(async (auto = false) => {
    const dispatch = auto ? onAutoSave : onSalvar;
    if (!dispatch) return;

    await dispatch({
      tipo: 'gasto_energetico_total',
      dados: payloadData,
      resultados: payloadResults,
      data: dados.dataAvaliacao,
      pacienteId,
      schemaVersion: 1,
      formulaId: payloadData?.metadados_formula?.formulaId || 'mifflin_st_jeor_1990',
      formulaVersion: payloadData?.metadados_formula?.formulaVersion || '1.0.0',
      sourceSystem: 'calculado',
      measuredAt: normalizeDateValue(dados.dataAvaliacao),
      sessaoId: moduleSnapshot?.sessaoId || currentSessionId
    });
  }, [
    currentSessionId,
    dados.dataAvaliacao,
    moduleSnapshot?.sessaoId,
    onAutoSave,
    onSalvar,
    pacienteId,
    payloadData,
    payloadResults
  ]);

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

    if (!hasValues) {
      setError('Preencha ao menos o nivel de atividade para calcular o GET.');
      return;
    }

    if (hasRequiredMissing) {
      setError('TMB indisponivel. Salve a composicao integrada ou informe uma TMB manual.');
      return;
    }

    if (hasFieldErrors) {
      setError('Existem campos com erro de validacao. Revise os valores destacados.');
      return;
    }

    if (warnings.length > 0) {
      const confirmMessage = [
        'Foram detectados alertas nesta avaliacao:',
        ...warnings.map((item) => `- ${item}`),
        '',
        'Deseja salvar mesmo assim?'
      ].join('\n');

      if (!window.confirm(confirmMessage)) return;
    }

    await executeSave(false);
  }, [executeSave, hasFieldErrors, hasRequiredMissing, hasValues, onSalvar, warnings]);

  useEffect(() => {
    if (readOnly || !onAutoSave || !hasUserInput) return undefined;
    if (!hasValues || hasFieldErrors || hasRequiredMissing) return undefined;

    clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => {
      executeSave(true);
    }, 900);

    return () => clearTimeout(autoSaveRef.current);
  }, [executeSave, hasFieldErrors, hasRequiredMissing, hasUserInput, hasValues, onAutoSave, readOnly]);

  return (
    <div className={`eval-card get-form get-form--modern${readOnly ? ' eval-card--readonly' : ''}`}>
      <div className="eval-header">
        <div className="eval-icon">
          <Flame size={20} />
        </div>
        <div>
          <h3 className="eval-title">Gasto energetico total (GET)</h3>
          <p className="eval-subtitle">
            TMB integrada da sessao + fator de atividade para estimar manutencao, emagrecimento e hipertrofia.
          </p>
        </div>
      </div>

      <div className="eval-section">
        <h4 className="eval-section-title">Dados obrigatorios</h4>
        <div className="get-grid">
          <div className="eval-field">
            <label className="eval-label">Data da avaliacao</label>
            <input
              type="date"
              className="eval-input"
              value={dados.dataAvaliacao}
              onChange={(event) => updateField(setDados, setHasUserInput, 'dataAvaliacao', event.target.value)}
              disabled={readOnly}
            />
          </div>
          <div className="eval-field">
            <label className="eval-label">Nivel de atividade</label>
            <select
              className="eval-select"
              value={dados.activityLevel}
              onChange={(event) => updateField(setDados, setHasUserInput, 'activityLevel', event.target.value)}
              disabled={readOnly}
            >
              {ACTIVITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div className="eval-field">
            <label className="eval-label">TMB da composicao (auto)</label>
            <div className="get-readonly">
              {formatMetric(getEvaluation?.base?.tmbFromIntegratedKcal, 'kcal', 'kcal')}
            </div>
          </div>
          <div className="eval-field">
            <label className="eval-label">Fator aplicado</label>
            <div className="get-readonly">
              {formatMetric(getEvaluation?.activity?.factorApplied, '', 'factor')}
            </div>
          </div>
        </div>
      </div>

      <div className="eval-section">
        <h4 className="eval-section-title">Dados opcionais</h4>
        <div className="get-grid">
          <div className="eval-field">
            <label className="eval-label">
              Fator de atividade personalizado
              <span className="get-optional">Opcional</span>
            </label>
            <input
              type="text"
              inputMode="decimal"
              className={`eval-input ${submitAttempted && customFactorValidation.status === 'error' ? 'get-input-invalid' : ''} ${submitAttempted && customFactorValidation.status === 'warning' ? 'get-input-warning' : ''}`}
              value={dados.customActivityFactor}
              onChange={(event) => updateField(setDados, setHasUserInput, 'customActivityFactor', event.target.value)}
              disabled={readOnly}
              placeholder="0.8 a 2.5"
            />
            {submitAttempted && customFactorValidation.message ? (
              <small className={`get-field-message ${customFactorValidation.status === 'error' ? 'is-error' : 'is-warning'}`}>
                {customFactorValidation.message}
              </small>
            ) : null}
          </div>
          <div className="eval-field">
            <label className="eval-label">
              TMB manual (override)
              <span className="get-optional">Opcional</span>
            </label>
            <input
              type="text"
              inputMode="decimal"
              className={`eval-input ${submitAttempted && manualTmbValidation.status === 'error' ? 'get-input-invalid' : ''} ${submitAttempted && manualTmbValidation.status === 'warning' ? 'get-input-warning' : ''}`}
              value={dados.manualTmbKcal}
              onChange={(event) => updateField(setDados, setHasUserInput, 'manualTmbKcal', event.target.value)}
              disabled={readOnly}
              placeholder="Ex.: 1640"
            />
            {submitAttempted && manualTmbValidation.message ? (
              <small className={`get-field-message ${manualTmbValidation.status === 'error' ? 'is-error' : 'is-warning'}`}>
                {manualTmbValidation.message}
              </small>
            ) : null}
          </div>
        </div>
      </div>

      <div className="eval-results-section">
        <div className="get-cards">
          <ResultCard
            label="TMB utilizada"
            value={getEvaluation?.base?.tmbUsedKcal}
            unit="kcal"
            badge={getEvaluation?.base?.formulaLabel || 'Sem formula'}
            tone="info"
          />
          <ResultCard
            label="GET estimado"
            value={getEvaluation?.results?.getKcal}
            unit="kcal"
            badge={getEvaluation?.activity?.label || 'Fator atividade'}
            tone="success"
            delta={buildComparativeDeltas({
              current: getEvaluation?.results?.getKcal,
              reference: previous?.metrics?.get
            })}
          />
          <ResultCard
            label="Emagrecimento moderado"
            value={getEvaluation?.results?.weightLossModerateKcal}
            unit="kcal"
            badge="GET - 500"
            tone="warning"
          />
          <ResultCard
            label="Emagrecimento intenso"
            value={getEvaluation?.results?.weightLossIntenseKcal}
            unit="kcal"
            badge={getEvaluation?.safety?.hasIntenseLowIntakeRisk ? 'Abaixo do minimo' : 'GET - 750'}
            tone={getEvaluation?.safety?.hasIntenseLowIntakeRisk ? 'danger' : 'warning'}
          />
          <RangeCard
            label="Hipertrofia"
            minValue={getEvaluation?.results?.hypertrophyMinKcal}
            maxValue={getEvaluation?.results?.hypertrophyMaxKcal}
            unit="kcal"
            badge="GET + 300 a 500"
          />
          <ResultCard
            label="Manutencao"
            value={getEvaluation?.results?.maintenanceKcal}
            unit="kcal"
            badge="GET"
            tone="neutral"
          />
        </div>

        <div className="get-meta-box">
          <p><strong>Formula usada:</strong> {getEvaluation?.base?.formulaLabel || '--'}</p>
          <p><strong>formulaId:</strong> {getEvaluation?.base?.formulaId || '--'} | <strong>versao:</strong> {getEvaluation?.base?.formulaVersion || '--'}</p>
          {getEvaluation?.base?.sourceLabel ? <p><strong>Fonte oficial:</strong> {getEvaluation.base.sourceLabel}</p> : null}
        </div>

        {getEvaluation?.safety?.hasIntenseLowIntakeRisk && (
          <div className="get-warning">
            <AlertTriangle size={16} />
            <span>
              Alerta de seguranca: ingestao de emagrecimento intenso abaixo de {Math.round(getEvaluation?.safety?.intenseMinThreshold || 0)} kcal/dia.
            </span>
          </div>
        )}

        <div className="get-table-wrap">
          <table className="get-table">
            <thead>
              <tr>
                <th>Indicador</th>
                <th>Atual</th>
                <th>Anterior</th>
                <th>Primeira</th>
                <th>Delta abs.</th>
                <th>Delta %</th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row) => (
                <tr key={row.key}>
                  <td>{row.label}</td>
                  <td>{formatMetric(row.current, row.unit, row.key)}</td>
                  <td>{formatMetric(row.previous, row.unit, row.key)}</td>
                  <td>{formatMetric(row.first, row.unit, row.key)}</td>
                  <td className={resolveDeltaClass(row.delta.deltaAbs)}>{formatSigned(row.delta.deltaAbs, row.unit, row.key)}</td>
                  <td className={resolveDeltaClass(row.delta.deltaPct)}>{formatSigned(row.delta.deltaPct, '%', 'percent')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="get-sparkline">
          <p>GET (ultimos 6)</p>
          <MiniSparkline values={sparklineGet} width={250} height={80} />
        </div>
      </div>

      <div className="eval-section">
        <h4 className="eval-section-title">Observacoes</h4>
        <textarea
          className="eval-textarea"
          value={dados.observacoes}
          onChange={(event) => updateField(setDados, setHasUserInput, 'observacoes', event.target.value)}
          disabled={readOnly}
          placeholder="Contexto clinico, adesao e ajustes sugeridos."
        />
      </div>

      <div className="eval-actions">
        {saveStatus ? <span className={`save-indicator ${saveStatus}`}>{saveStatus === 'saving' ? 'Salvando...' : saveStatus === 'saved' ? 'Salvo' : 'Erro ao salvar'}</span> : null}
        <Button type="button" variant="primary" disabled={readOnly} onClick={handleSubmit} loading={saveStatus === 'saving'}>
          Salvar GET
        </Button>
      </div>

      {error && <div className="eval-note get-error-note">{error}</div>}
    </div>
  );
};

export default GastoEnergeticoTotalForm;

const ResultCard = ({ label, value, unit, badge, tone = 'neutral', delta = null }) => (
  <article className="get-card">
    <span>{label}</span>
    <strong>{formatMetric(value, unit, label)}</strong>
    <small className={`get-badge get-tone-${tone}`}>{badge}</small>
    {delta && Number.isFinite(delta.deltaAbs) ? (
      <p className={resolveDeltaClass(delta.deltaAbs)}>{formatSigned(delta.deltaAbs, unit, label)}</p>
    ) : null}
  </article>
);

const RangeCard = ({ label, minValue, maxValue, unit, badge }) => (
  <article className="get-card">
    <span>{label}</span>
    <strong>
      {Number.isFinite(minValue) && Number.isFinite(maxValue)
        ? `${formatMetric(minValue, unit, 'range')} a ${formatMetric(maxValue, unit, 'range')}`
        : '--'}
    </strong>
    <small className="get-badge get-tone-info">{badge}</small>
  </article>
);

function updateField(setDados, setHasUserInput, key, value) {
  setHasUserInput(true);
  setDados((prev) => ({ ...prev, [key]: value }));
}

function parseNumeric(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(String(value).replace(',', '.').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function toInputValue(value, digits = null) {
  const numeric = parseNumeric(value);
  if (!Number.isFinite(numeric)) return '';
  if (!Number.isFinite(digits)) return String(numeric);
  return Number(numeric).toFixed(digits);
}

function toTextInput(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
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

function normalizeSexToken(value) {
  const token = toTextInput(value).toLowerCase();
  if (!token) return null;
  if (token.includes('fem') || token === 'f' || token === 'female') return 'female';
  if (token.includes('masc') || token === 'm' || token === 'male') return 'male';
  return null;
}

function formatNumber(value, digits = 1) {
  if (!Number.isFinite(value)) return '--';
  return Number(value).toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function formatMetric(value, unit = '', key = '') {
  if (!Number.isFinite(value)) return '--';
  const token = String(key || '').toLowerCase();
  const digits = token.includes('factor')
    ? 3
    : token.includes('kcal')
      ? 0
      : 2;
  return `${formatNumber(value, digits)}${unit ? ` ${unit}` : ''}`;
}

function formatSigned(value, unit = '', key = '') {
  if (!Number.isFinite(value)) return '--';
  const token = String(key || '').toLowerCase();
  const digits = token.includes('percent')
    ? 2
    : token.includes('kcal')
      ? 0
      : 2;
  const sign = value > 0 ? '+' : '';
  return `${sign}${formatNumber(value, digits)}${unit ? ` ${unit}` : ''}`;
}

function resolveDeltaClass(value) {
  if (!Number.isFinite(value)) return 'is-flat';
  if (value > 0) return 'is-up';
  if (value < 0) return 'is-down';
  return 'is-flat';
}

function createComparisonRow(key, label, unit, current, previous, first) {
  return {
    key,
    label,
    unit,
    current: Number.isFinite(current) ? current : null,
    previous: Number.isFinite(previous) ? previous : null,
    first: Number.isFinite(first) ? first : null,
    delta: buildComparativeDeltas({ current, reference: previous })
  };
}

function normalizeGetHistory(records = []) {
  if (!Array.isArray(records)) return [];
  return records
    .map((record) => {
      const dados = record?.dados || {};
      const calculated = dados?.resultados_calculados || {};
      const timestamp = resolveDate(record?.updatedAt || record?.createdAt || record?.data)?.getTime() || 0;
      return {
        id: record?.id || '',
        timestamp,
        metrics: {
          tmb: parseNumeric(firstDefined(
            calculated?.tmbBaseKcal,
            dados?.tmb_base_kcal,
            record?.resultados?.tmb_kcal
          )),
          factor: parseNumeric(firstDefined(
            calculated?.fatorAtividade,
            dados?.fator_atividade
          )),
          get: parseNumeric(firstDefined(
            calculated?.getEstimadoKcal,
            dados?.get_estimado_kcal,
            record?.resultados?.get_kcal
          ))
        }
      };
    })
    .filter((item) => Number.isFinite(item.metrics.tmb) || Number.isFinite(item.metrics.get))
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
}

function resolveDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value?.toDate === 'function') {
    const converted = value.toDate();
    return Number.isNaN(converted?.getTime?.()) ? null : converted;
  }
  if (typeof value?.seconds === 'number') {
    const converted = new Date(value.seconds * 1000);
    return Number.isNaN(converted.getTime()) ? null : converted;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
