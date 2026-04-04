import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCcw, Save } from 'lucide-react';
import { Button } from '../../ui';
import { toLocalDateInputValue } from '../../../utils/dateUtils';
import { calculateEvolutionReturnEvaluation } from '../../../services/calculationEngine';
import '../avaliacoes.css';
import './AvaliacaoEvolucaoRetorno.css';

const createInitialState = () => ({
  dataAvaliacao: toLocalDateInputValue(new Date()),
  adesaoPlanoAlimentar: '',
  adesaoAtividadeFisica: '',
  respostaPercebida: '',
  objetivos: '',
  intercorrencias: '',
  sintomas: '',
  conduta: '',
  proximaAvaliacao: toLocalDateInputValue(new Date())
});

const AvaliacaoEvolucaoRetorno = ({
  pacienteId,
  onSalvar,
  onAutoSave,
  readOnly = false,
  moduleSnapshot,
  currentSessionId
}) => {
  const [formData, setFormData] = useState(createInitialState);
  const [error, setError] = useState('');
  const [saveStatus, setSaveStatus] = useState(null);
  const autoSaveRef = useRef(null);
  const saveStatusResetRef = useRef(null);
  const loadedSnapshotIdRef = useRef('');

  useEffect(() => {
    const snapshotId = moduleSnapshot?.id || '';
    if (!snapshotId || loadedSnapshotIdRef.current === snapshotId) return;

    const source = moduleSnapshot?.dados || {};
    const input = source?.input || {};
    const dadosBrutos = source?.dados_brutos || {};

    const objetivosList = Array.isArray(dadosBrutos?.objetivos)
      ? dadosBrutos.objetivos
      : Array.isArray(input?.objetivos)
        ? input.objetivos
        : [];

    setFormData({
      dataAvaliacao: normalizeDateValue(moduleSnapshot?.data || source?.dataAvaliacao || input?.dataAvaliacao),
      adesaoPlanoAlimentar: toInputValue(dadosBrutos?.adesaoPlanoAlimentar ?? source?.adesaoPlanoAlimentar ?? input?.adesaoPlanoAlimentar),
      adesaoAtividadeFisica: toInputValue(dadosBrutos?.adesaoAtividadeFisica ?? source?.adesaoAtividadeFisica ?? input?.adesaoAtividadeFisica),
      respostaPercebida: toInputValue(dadosBrutos?.respostaPercebida ?? source?.respostaPercebida ?? input?.respostaPercebida),
      objetivos: objetivosList.join('\n'),
      intercorrencias: toText(dadosBrutos?.intercorrencias || source?.intercorrencias || input?.intercorrencias),
      sintomas: toText(dadosBrutos?.sintomas || source?.sintomas || input?.sintomas),
      conduta: toText(dadosBrutos?.conduta || source?.conduta || input?.conduta),
      proximaAvaliacao: normalizeDateValue(dadosBrutos?.proximaAvaliacao || source?.proximaAvaliacao || input?.proximaAvaliacao)
    });

    loadedSnapshotIdRef.current = snapshotId;
  }, [moduleSnapshot]);

  const objetivosList = useMemo(() => String(formData.objetivos || '')
    .split(/[\n,;]+/g)
    .map((item) => item.trim())
    .filter(Boolean), [formData.objetivos]);

  const calculation = useMemo(() => calculateEvolutionReturnEvaluation({
    dataAvaliacao: formData.dataAvaliacao,
    adesaoPlanoAlimentar: formData.adesaoPlanoAlimentar,
    adesaoAtividadeFisica: formData.adesaoAtividadeFisica,
    respostaPercebida: formData.respostaPercebida,
    objetivos: objetivosList,
    intercorrencias: formData.intercorrencias,
    sintomas: formData.sintomas,
    conduta: formData.conduta,
    proximaAvaliacao: formData.proximaAvaliacao
  }), [
    formData.adesaoAtividadeFisica,
    formData.adesaoPlanoAlimentar,
    formData.conduta,
    formData.dataAvaliacao,
    formData.intercorrencias,
    formData.proximaAvaliacao,
    formData.respostaPercebida,
    formData.sintomas,
    objetivosList
  ]);

  const hasValues = Boolean(
    formData.adesaoPlanoAlimentar
    || formData.adesaoAtividadeFisica
    || formData.respostaPercebida
    || formData.intercorrencias
    || formData.sintomas
    || formData.conduta
  );

  const handleChange = (field) => (event) => {
    setError('');
    const value = event?.target?.value ?? '';
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const dispatchSave = useCallback(async (auto = false) => {
    if (!auto && !hasValues) {
      setError('Preencha ao menos os indicadores de adesao para salvar a avaliacao.');
      return;
    }

    const dispatch = auto ? onAutoSave : onSalvar;
    if (!dispatch) return;

    const normalized = calculation?.inputNormalized || {};
    const calculated = calculation?.calculated || {};
    const classifications = calculation?.classifications || {};
    const warnings = Array.isArray(calculation?.warnings) ? calculation.warnings : [];
    const dataAvaliacao = normalizeDateValue(formData.dataAvaliacao);

    setSaveStatus('saving');
    if (saveStatusResetRef.current) clearTimeout(saveStatusResetRef.current);
    try {
      await Promise.resolve(dispatch({
        tipo: 'evolucao_retorno',
        pacienteId,
        data: dataAvaliacao,
        dados: {
          dataAvaliacao,
          dados_brutos: {
            ...normalized
          },
          resultados_calculados: {
            ...calculated
          },
          classificacoes: {
            ...classifications
          },
          metadados_formula: {
            formulaId: 'evolucao_adesao_score_v1',
            formulaVersion: '1.0.0'
          },
          input: {
            ...normalized
          },
          source: {
            mode: 'manual'
          },
          warnings
        },
        resultados: {
          score_adesao_geral: calculated?.scoreAdesaoGeral ?? null,
          prioridade_cuidado: classifications?.prioridadeRetorno ?? null,
          calculated,
          output: {
            ...classifications,
            warnings
          }
        },
        classificacao: classifications?.prioridadeRetorno || 'sem_classificacao',
        classificacaoLabel: classifications?.prioridadeRetorno || 'sem_classificacao',
        schemaVersion: 1,
        formulaId: 'evolucao_adesao_score_v1',
        formulaVersion: '1.0.0',
        sourceSystem: 'manual',
        measuredAt: dataAvaliacao,
        sessaoId: moduleSnapshot?.sessaoId || currentSessionId
      }));
      setSaveStatus('saved');
      saveStatusResetRef.current = setTimeout(() => setSaveStatus(null), 3000);
    } catch (dispatchError) {
      setSaveStatus('error');
      if (!auto) {
        setError('Nao foi possivel salvar a avaliacao.');
      }
    }
  }, [
    calculation,
    currentSessionId,
    formData.dataAvaliacao,
    hasValues,
    moduleSnapshot?.sessaoId,
    onAutoSave,
    onSalvar,
    pacienteId
  ]);

  useEffect(() => {
    if (readOnly || !onAutoSave || !hasValues) return undefined;
    clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => {
      dispatchSave(true);
    }, 900);
    return () => clearTimeout(autoSaveRef.current);
  }, [dispatchSave, hasValues, onAutoSave, readOnly]);

  useEffect(() => () => {
    if (saveStatusResetRef.current) clearTimeout(saveStatusResetRef.current);
  }, []);

  const score = calculation?.calculated?.scoreAdesaoGeral;
  const prioridade = calculation?.classifications?.prioridadeRetorno || 'sem_classificacao';

  return (
    <div className={`eval-card avaliacao-evolucao-retorno${readOnly ? ' eval-card--readonly' : ''}`}>
      <div className="eval-header">
        <div className="eval-icon">
          <RefreshCcw size={22} />
        </div>
        <div>
          <h3 className="eval-title">Evolucao e retorno</h3>
          <p className="eval-subtitle">Adesao, sinais de progresso e prioridade de acompanhamento.</p>
        </div>
      </div>

      <div className="eval-grid">
        <div className="eval-field">
          <label className="eval-label">Data da consulta</label>
          <input
            type="date"
            className="eval-input"
            value={formData.dataAvaliacao}
            onChange={handleChange('dataAvaliacao')}
            disabled={readOnly}
          />
        </div>
        <div className="eval-field">
          <label className="eval-label">Proxima avaliacao</label>
          <input
            type="date"
            className="eval-input"
            value={formData.proximaAvaliacao}
            onChange={handleChange('proximaAvaliacao')}
            disabled={readOnly}
          />
        </div>
        <div className="eval-field">
          <label className="eval-label">Adesao ao plano alimentar (%)</label>
          <input
            type="number"
            min="0"
            max="100"
            className="eval-input"
            value={formData.adesaoPlanoAlimentar}
            onChange={handleChange('adesaoPlanoAlimentar')}
            disabled={readOnly}
          />
        </div>
        <div className="eval-field">
          <label className="eval-label">Adesao a atividade fisica (%)</label>
          <input
            type="number"
            min="0"
            max="100"
            className="eval-input"
            value={formData.adesaoAtividadeFisica}
            onChange={handleChange('adesaoAtividadeFisica')}
            disabled={readOnly}
          />
        </div>
        <div className="eval-field">
          <label className="eval-label">Resposta percebida (1-5)</label>
          <input
            type="number"
            min="1"
            max="5"
            step="1"
            className="eval-input"
            value={formData.respostaPercebida}
            onChange={handleChange('respostaPercebida')}
            disabled={readOnly}
          />
        </div>
        <div className="eval-field eval-field-full">
          <label className="eval-label">Objetivos em acompanhamento (um por linha)</label>
          <textarea
            className="eval-textarea"
            rows="3"
            value={formData.objetivos}
            onChange={handleChange('objetivos')}
            disabled={readOnly}
            placeholder="Ex.: reduzir gordura corporal"
          />
        </div>
        <div className="eval-field eval-field-full">
          <label className="eval-label">Intercorrencias</label>
          <textarea
            className="eval-textarea"
            rows="3"
            value={formData.intercorrencias}
            onChange={handleChange('intercorrencias')}
            disabled={readOnly}
          />
        </div>
        <div className="eval-field eval-field-full">
          <label className="eval-label">Sintomas novos ou recorrentes</label>
          <textarea
            className="eval-textarea"
            rows="3"
            value={formData.sintomas}
            onChange={handleChange('sintomas')}
            disabled={readOnly}
          />
        </div>
        <div className="eval-field eval-field-full">
          <label className="eval-label">Conduta da consulta</label>
          <textarea
            className="eval-textarea"
            rows="3"
            value={formData.conduta}
            onChange={handleChange('conduta')}
            disabled={readOnly}
          />
        </div>
      </div>

      <div className="eval-section">
        <h4 className="eval-section-title">Resumo calculado</h4>
        <div className="eval-summary-grid">
          <SummaryCard label="Score de adesao" value={score} unit="%" />
          <SummaryCard label="Prioridade de retorno" value={prioridade} />
          <SummaryCard label="Objetivos mapeados" value={calculation?.calculated?.resumoObjetivos?.length || 0} />
        </div>
        {calculation?.warnings?.[0] && (
          <div className="eval-note" style={{ marginTop: '0.75rem' }}>
            {calculation.warnings[0]}
          </div>
        )}
      </div>

      {error && <div className="form-error-message">{error}</div>}
      {readOnly && <div className="eval-note">Somente leitura para o seu perfil.</div>}

      <div className="eval-actions">
        {saveStatus ? <span className={`save-indicator ${saveStatus}`}>{saveStatus === 'saving' ? 'Salvando...' : saveStatus === 'saved' ? 'Salvo' : 'Erro ao salvar'}</span> : null}
        <Button type="button" variant="primary" onClick={() => dispatchSave(false)} disabled={readOnly} loading={saveStatus === 'saving'}>
          <Save size={18} /> Salvar avaliacao
        </Button>
      </div>
    </div>
  );
};

const SummaryCard = ({ label, value, unit = '' }) => (
  <div className="eval-summary-item">
    <span>{label}</span>
    <strong>
      {Number.isFinite(value) ? `${value}${unit ? ` ${unit}` : ''}` : (value || 'Nao informado')}
    </strong>
  </div>
);

const parseNumeric = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value).replace(',', '.').trim());
  return Number.isFinite(parsed) ? parsed : null;
};

const toInputValue = (value) => {
  const numeric = parseNumeric(value);
  if (!Number.isFinite(numeric)) return '';
  return String(numeric);
};

const toText = (value) => (value === null || value === undefined ? '' : String(value).trim());

const normalizeDateValue = (value) => {
  if (!value) return toLocalDateInputValue(new Date());
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  }
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return toLocalDateInputValue(new Date());
  return toLocalDateInputValue(date);
};

export default AvaliacaoEvolucaoRetorno;
