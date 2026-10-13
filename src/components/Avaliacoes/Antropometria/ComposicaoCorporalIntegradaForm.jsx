import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Layers } from 'lucide-react';
import MiniSparkline from '../../shared/MiniSparkline';
import { Button } from '../../ui';
import { toLocalDateInputValue } from '../../../utils/dateUtils';
import {
  buildComparativeDeltas,
  calculateIntegratedBodyComposition,
  restoreIntegratedCompositionSnapshot,
  validatePhysiologicalRange
} from '../../../services/calculationEngine';
import { useUiFeedback } from '../../../contexts/UiFeedbackContext';
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
  percentFat: '',
  fatMassKg: '',
  leanMassKg: '',
  bodyWaterL: '',
  selectedTmbFormulaId: '',
  tmbSelectionReason: '',
  observacoes: ''
});

const ComposicaoCorporalIntegradaForm = ({
  pacienteId,
  onSalvar,
  onAutoSave,
  readOnly = false,
  onboardingContext,
  baselineAnthropometry,
  moduleSnapshot,
  moduleHistory = [],
  currentSessionId
}) => {
  const { confirm } = useUiFeedback();

  const [dados, setDados] = useState(createInitialData);
  const [error, setError] = useState('');
  const [saveStatus, setSaveStatus] = useState(null);
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
    const metadadosFormula = source?.metadados_formula || {};
    const ownMeasurements = dadosBrutos?.ownMeasurements || {};

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
      percentFat: toInput(firstDefined(ownMeasurements.percentFat, dadosBrutos?.percentFat), 2),
      fatMassKg: toInput(firstDefined(ownMeasurements.fatMassKg, dadosBrutos?.fatMassKg), 2),
      leanMassKg: toInput(firstDefined(ownMeasurements.leanMassKg, dadosBrutos?.leanMassKg), 2),
      bodyWaterL: toInput(firstDefined(ownMeasurements.bodyWaterL, dadosBrutos?.bodyWaterL), 2),
      selectedTmbFormulaId: dadosBrutos?.ownMeasurements ? toText(firstDefined(
        metadadosFormula?.formulaId,
        source?.formulaId
      )) : '',
      tmbSelectionReason: dadosBrutos?.ownMeasurements ? toText(firstDefined(
        metadadosFormula?.justificativa,
        dadosBrutos?.tmbSelectionReason
      )) : '',
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

  const calculatedComposition = useMemo(() => calculateIntegratedBodyComposition({
    ownMeasurements: {
      percentFat: toNumber(dados.percentFat),
      fatMassKg: toNumber(dados.fatMassKg),
      leanMassKg: toNumber(dados.leanMassKg),
      bodyWaterL: toNumber(dados.bodyWaterL)
    },
    sex: profile.sex,
    ageYears: profile.ageYears,
    weightKg: profile.weightKg,
    heightCm: profile.heightCm,
    activityLevel: dados.activityLevel,
    activityFactor: customActivityFactor,
    selectedFormulaId: dados.selectedTmbFormulaId
  }), [
    customActivityFactor,
    dados.activityLevel,
    dados.bodyWaterL,
    dados.fatMassKg,
    dados.leanMassKg,
    dados.percentFat,
    dados.selectedTmbFormulaId,
    profile
  ]);

  const savedComposition = useMemo(
    () => readOnly ? restoreIntegratedCompositionSnapshot(moduleSnapshot) : null,
    [moduleSnapshot, readOnly]
  );
  const composition = savedComposition || calculatedComposition;

  useEffect(() => {
    const formulaId = calculatedComposition?.selectedTmb?.formulaId || calculatedComposition?.tmbComparative?.defaultFormulaId;
    if (!dados.selectedTmbFormulaId && formulaId) {
      setDados((prev) => prev.selectedTmbFormulaId ? prev : ({ ...prev, selectedTmbFormulaId: formulaId }));
    }
  }, [calculatedComposition?.selectedTmb?.formulaId, calculatedComposition?.tmbComparative?.defaultFormulaId, dados.selectedTmbFormulaId]);

  const historyRows = useMemo(() => normalizeHistory(
    moduleSnapshot?.id
      ? moduleHistory.filter((record) => String(record?.id) !== String(moduleSnapshot.id))
      : moduleHistory
  ), [moduleHistory, moduleSnapshot]);
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
  const measurementErrors = useMemo(() => {
    const checks = [
      ['% de gordura', dados.percentFat, 0, 100],
      ['Massa gorda', dados.fatMassKg, 0, profile.weightKg],
      ['Massa magra', dados.leanMassKg, 0, profile.weightKg],
      ['Água corporal', dados.bodyWaterL, 0, null]
    ];
    const errors = checks.flatMap(([label, input, min, max]) => {
      if (toText(input) === '') return [];
      const value = toNumber(input);
      if (!Number.isFinite(value)) return [`${label}: informe um número válido.`];
      if (value < min || (Number.isFinite(max) && value > max)) {
        return [`${label}: valor fora da faixa permitida.`];
      }
      return [];
    });
    const fatMass = toNumber(dados.fatMassKg);
    const leanMass = toNumber(dados.leanMassKg);
    const percentFat = toNumber(dados.percentFat);
    if (Number.isFinite(profile.weightKg) && Number.isFinite(fatMass) && Number.isFinite(leanMass)
      && Math.abs(fatMass + leanMass - profile.weightKg) > 1) {
      errors.push('As massas gorda e magra devem corresponder ao peso compartilhado.');
    }
    if (Number.isFinite(profile.weightKg) && Number.isFinite(percentFat) && Number.isFinite(fatMass)
      && Math.abs(fatMass - (percentFat / 100) * profile.weightKg) > 1) {
      errors.push('Massa gorda e percentual de gordura precisam ser coerentes.');
    }
    if (Number.isFinite(profile.weightKg) && Number.isFinite(percentFat) && Number.isFinite(leanMass)
      && Math.abs(leanMass - (1 - percentFat / 100) * profile.weightKg) > 1) {
      errors.push('Massa magra e percentual de gordura precisam ser coerentes.');
    }
    if ((!Number.isFinite(profile.weightKg) || profile.weightKg <= 0) && Number.isFinite(percentFat)
      && Number.isFinite(fatMass) && Number.isFinite(leanMass) && fatMass + leanMass > 0
      && Math.abs(percentFat - 100 * fatMass / (fatMass + leanMass)) > 1) {
      errors.push('Percentual de gordura e massas informadas precisam ser coerentes.');
    }
    return errors;
  }, [dados.bodyWaterL, dados.fatMassKg, dados.leanMassKg, dados.percentFat, profile.weightKg]);
  const missingForFinalization = useMemo(() => {
    const missing = [];
    if (!composition?.official?.sourceId) missing.push('medida de gordura ou massa neste instrumento');
    if (!Number.isFinite(composition?.official?.percentFat)) missing.push('% de gordura (ou massas gorda e magra)');
    if (!Number.isFinite(composition?.official?.leanMassKg)) missing.push('massa magra (ou peso para derivá-la)');
    if (!Number.isFinite(composition?.selectedTmb?.tmbKcal)) missing.push('TMB (confira peso, idade e sexo do cadastro)');
    return missing;
  }, [composition?.official?.leanMassKg, composition?.official?.percentFat, composition?.official?.sourceId, composition?.selectedTmb?.tmbKcal]);
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
        ownMeasurements: {
          percentFat: toNumber(dados.percentFat),
          fatMassKg: toNumber(dados.fatMassKg),
          leanMassKg: toNumber(dados.leanMassKg),
          bodyWaterL: toNumber(dados.bodyWaterL)
        },
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
        mode: 'medicao_propria',
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
      sourceSystem: 'medicao_propria',
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
    } catch (error) {
      setSaveStatus('error');
      if (!auto) {
        setError('Nao foi possivel salvar a avaliacao. Tente novamente.');
      }
    }
  }, [dispatchSave]);

  const handleSubmit = useCallback(async () => {
    if (!onSalvar) return;
    setError('');
    if (measurementErrors.length > 0) {
      setError(measurementErrors.join(' '));
      return;
    }
    if (missingForFinalization.length > 0) {
      setError(`Para concluir esta avaliação, informe: ${missingForFinalization.join('; ')}.`);
      return;
    }
    if (outlier) {
      const proceed = await confirm({
        title: 'Valor fora da faixa fisiológica',
        details: [outlier],
        confirmLabel: 'Salvar mesmo assim',
        cancelLabel: 'Corrigir',
        variant: 'warning'
      });
      if (!proceed) return;
    }
    await executeSave(false);
  }, [confirm, executeSave, measurementErrors, missingForFinalization, onSalvar, outlier]);

  useEffect(() => {
    if (readOnly || !onAutoSave || !hasUserInput || missingForFinalization.length > 0 || measurementErrors.length > 0) return undefined;
    clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => executeSave(true), 3500);
    return () => clearTimeout(autoSaveRef.current);
  }, [executeSave, hasUserInput, measurementErrors, missingForFinalization, onAutoSave, readOnly]);

  const tmbRows = composition?.tmbComparative?.rows || [];
  const onboardingResumo = useMemo(() => {
    if (!onboardingContext || typeof onboardingContext !== 'object') return [];
    const resumo = [];
    const modalidade = toText(onboardingContext?.modalidadePrincipal);
    const frequencia = toNumber(onboardingContext?.frequenciaSemanal);
    if (modalidade) resumo.push(`Modalidade: ${modalidade}`);
    if (Number.isFinite(frequencia)) resumo.push(`Frequencia: ${frequencia}x/sem`);
    return resumo.slice(0, 2);
  }, [onboardingContext]);
  const savedTmbSelectionReason = toText(firstDefined(
    moduleSnapshot?.dados?.metadados_formula?.justificativa,
    moduleSnapshot?.dados?.dados_brutos?.tmbSelectionReason
  ));
  const historicalOverrideReason = toText(firstDefined(
    moduleSnapshot?.dados?.dados_brutos?.sourceOverrideReason,
    moduleSnapshot?.dados?.justificativa_override
  ));
  const integridadeIntegracao = useMemo(() => {
    if (savedComposition?.historicalIntegration) return 'Resultado histórico da integração, preservado como foi salvo.';
    if (savedComposition) return 'Medição registrada neste instrumento.';
    if (hasOfficial) return 'Medidas próprias disponíveis para esta avaliação.';
    return 'Informe uma medida de composição neste instrumento.';
  }, [hasOfficial, savedComposition]);

  return (
    <div className={`eval-card composicao-integrada-form composicao-integrada-form--modern${readOnly ? ' eval-card--readonly' : ''}`}>
      <div className="eval-header">
        <div className="eval-icon"><Layers size={20} /></div>
        <div>
          <h3 className="eval-title">Composicao corporal integrada</h3>
          <p className="eval-subtitle">
            {savedComposition?.historicalIntegration
              ? 'Resultados da integração histórica preservados no registro.'
              : 'Composição medida nesta avaliação, com TMB e GET calculados pelo perfil.'}
          </p>
        </div>
      </div>

      {!savedComposition && onboardingResumo.length > 0 ? (
        <div className="eval-note">
          <strong>Contexto do onboarding:</strong> {onboardingResumo.join(' | ')}
        </div>
      ) : null}
      <div className="eval-note">
        <strong>Origem da composição:</strong> {integridadeIntegracao}
      </div>

      <div className="eval-section">
        <h4 className="eval-section-title">Contexto</h4>
        <div className="composicao-grid">
          <FieldSelect label="Nivel de atividade" value={dados.activityLevel} disabled={readOnly} onChange={(v) => updateField(setDados, setHasUserInput, 'activityLevel', v)} options={ACTIVITY_OPTIONS} />
          <FieldText label="Fator personalizado (opcional)" value={dados.customActivityFactor} disabled={readOnly} onChange={(v) => updateField(setDados, setHasUserInput, 'customActivityFactor', v)} placeholder="Ex.: 1.42" />
          <FieldText label="Fator aplicado" value={Number.isFinite(composition?.activityFactorResolved) ? Number(composition.activityFactorResolved).toFixed(2) : '--'} disabled onChange={() => {}} />
          <FieldText label="Data da avaliacao" value={dados.dataAvaliacao} type="date" disabled={readOnly} onChange={(v) => updateField(setDados, setHasUserInput, 'dataAvaliacao', v)} />
          <FieldText label={savedComposition ? 'Peso registrado' : 'Peso compartilhado'} value={fmt(savedComposition ? composition?.official?.weightKg : profile.weightKg, 2, 'kg')} disabled onChange={() => {}} />
          <FieldText label={savedComposition ? 'Estatura registrada' : 'Estatura compartilhada'} value={fmt(savedComposition ? composition?.official?.heightCm : profile.heightCm, 1, 'cm')} disabled onChange={() => {}} />
        </div>
      </div>

      <div className="eval-section">
        <h4 className="eval-section-title">{savedComposition?.historicalIntegration ? 'Fontes históricas registradas' : 'Medidas desta avaliação'}</h4>
        {!readOnly ? (
          <div className="composicao-grid">
            <FieldText label="Gordura corporal (%)" value={dados.percentFat} onChange={(v) => updateField(setDados, setHasUserInput, 'percentFat', v)} placeholder="Ex.: 21,5" />
            <FieldText label="Massa gorda (kg)" value={dados.fatMassKg} onChange={(v) => updateField(setDados, setHasUserInput, 'fatMassKg', v)} placeholder="Opcional" />
            <FieldText label="Massa magra (kg)" value={dados.leanMassKg} onChange={(v) => updateField(setDados, setHasUserInput, 'leanMassKg', v)} placeholder="Opcional" />
            <FieldText label="Água corporal (L)" value={dados.bodyWaterL} onChange={(v) => updateField(setDados, setHasUserInput, 'bodyWaterL', v)} placeholder="Opcional" />
          </div>
        ) : null}
        {!readOnly ? <div className="eval-note">Preencha % de gordura ou uma massa medida; peso e estatura vêm do contexto compartilhado.</div> : null}
        {!readOnly && hasUserInput && missingForFinalization.length > 0 ? (
          <div className="eval-note">Ainda faltam para finalizar: {missingForFinalization.join('; ')}.</div>
        ) : null}
        {!readOnly && hasUserInput && measurementErrors.length > 0 ? (
          <div className="eval-note composicao-error-note">{measurementErrors.join(' ')}</div>
        ) : null}
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
        ) : <div className="eval-note">{savedComposition ? 'As fontes não foram detalhadas neste registro.' : 'Nenhuma medida de composição informada.'}</div>}

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
        <h4 className="eval-section-title">{savedComposition ? 'Fórmula registrada' : 'Comparativo de TMB'}</h4>
        {savedComposition ? (
          <div className="eval-note">
            {composition?.selectedTmb?.selected?.label || composition?.selectedTmb?.formulaId || 'Fórmula não registrada'}
            {' · '}
            {fmt(composition?.selectedTmb?.tmbKcal, 0, 'kcal/dia')}
          </div>
        ) : <div className="composicao-table-wrap">
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
        </div>}
      </div>

      <div className="eval-section">
        <h4 className="eval-section-title">Justificativas e observacoes</h4>
        {savedComposition?.historicalIntegration && historicalOverrideReason ? (
          <div className="eval-note"><strong>Justificativa histórica da fonte:</strong> {historicalOverrideReason}</div>
        ) : null}
        <FieldArea label="Justificativa da formula TMB (opcional)" value={savedComposition ? savedTmbSelectionReason : dados.tmbSelectionReason} disabled={readOnly} onChange={(v) => updateField(setDados, setHasUserInput, 'tmbSelectionReason', v)} />
        <FieldArea label="Observacoes" value={dados.observacoes} disabled={readOnly} onChange={(v) => updateField(setDados, setHasUserInput, 'observacoes', v)} />
      </div>

      <div className="eval-actions">
        {saveStatus ? <span className={`save-indicator ${saveStatus}`}>{saveStatus === 'saving' ? 'Salvando...' : saveStatus === 'saved' ? 'Salvo' : 'Erro ao salvar'}</span> : null}
        <Button type="button" variant="primary" disabled={readOnly} onClick={handleSubmit} loading={saveStatus === 'saving'}>
          Salvar composicao integrada
        </Button>
      </div>

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

