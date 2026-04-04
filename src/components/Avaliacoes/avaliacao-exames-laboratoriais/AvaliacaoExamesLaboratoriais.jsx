import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '../../ui';
import { toLocalDateInputValue } from '../../../utils/dateUtils';
import { calculateLaboratoryEvaluation } from '../../../services/calculationEngine';
import '../avaliacoes.css';
import './AvaliacaoExamesLaboratoriais.css';

const createAnalito = (index = 0, fallbackDate = toLocalDateInputValue(new Date())) => ({
  id: `${Date.now()}-${index}`,
  nome: '',
  valor: '',
  unidade: '',
  referenciaMin: '',
  referenciaMax: '',
  dataColeta: fallbackDate,
  laboratorio: ''
});

const createInitialState = () => ({
  dataAvaliacao: toLocalDateInputValue(new Date()),
  painel: 'geral',
  laboratorio: '',
  analitos: [createAnalito(1)]
});

const AvaliacaoExamesLaboratoriais = ({
  pacienteId,
  onSalvar,
  onAutoSave,
  readOnly = false,
  moduleSnapshot,
  currentSessionId,
  moduleHistory = []
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
    const sourceAnalitos = source?.dados_brutos?.analitos
      || source?.analitos
      || input?.analitos
      || moduleSnapshot?.registros
      || [];

    setFormData({
      dataAvaliacao: normalizeDateValue(moduleSnapshot?.data || source?.dataAvaliacao || input?.dataAvaliacao),
      painel: toText(source?.dados_brutos?.painel || source?.painel || input?.painel || 'geral') || 'geral',
      laboratorio: toText(source?.dados_brutos?.laboratorio || source?.laboratorio || input?.laboratorio),
      analitos: Array.isArray(sourceAnalitos) && sourceAnalitos.length
        ? sourceAnalitos.map((item, index) => normalizeAnalito(item, index, normalizeDateValue(moduleSnapshot?.data || source?.dataAvaliacao || input?.dataAvaliacao)))
        : [createAnalito(1)]
    });

    loadedSnapshotIdRef.current = snapshotId;
  }, [moduleSnapshot]);

  const previousAnalitos = useMemo(() => {
    if (!Array.isArray(moduleHistory) || moduleHistory.length <= 1) return [];
    const previous = moduleHistory.find((item) => item?.id && item.id !== moduleSnapshot?.id);
    if (!previous) return [];
    const source = previous?.dados || {};
    const input = source?.input || {};
    const items = source?.dados_brutos?.analitos || source?.analitos || input?.analitos || previous?.registros || [];
    return Array.isArray(items) ? items : [];
  }, [moduleHistory, moduleSnapshot?.id]);

  const evaluation = useMemo(() => calculateLaboratoryEvaluation({
    dataAvaliacao: formData.dataAvaliacao,
    painel: formData.painel,
    analitos: formData.analitos,
    previousAnalitos
  }), [formData.analitos, formData.dataAvaliacao, formData.painel, previousAnalitos]);

  const hasValues = formData.analitos.some((item) => (
    item?.nome
    || item?.valor
    || item?.referenciaMin
    || item?.referenciaMax
  ));

  const handleRootChange = (field) => (event) => {
    setError('');
    const value = event?.target?.value ?? '';
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleAnalitoChange = (rowId, field) => (event) => {
    setError('');
    const value = event?.target?.value ?? '';
    setFormData((prev) => ({
      ...prev,
      analitos: prev.analitos.map((row) => (
        row.id === rowId
          ? { ...row, [field]: value }
          : row
      ))
    }));
  };

  const addAnalito = () => {
    setFormData((prev) => ({
      ...prev,
      analitos: [...prev.analitos, createAnalito(prev.analitos.length + 1, prev.dataAvaliacao)]
    }));
  };

  const removeAnalito = (rowId) => {
    setFormData((prev) => {
      const nextRows = prev.analitos.filter((row) => row.id !== rowId);
      return {
        ...prev,
        analitos: nextRows.length ? nextRows : [createAnalito(1, prev.dataAvaliacao)]
      };
    });
  };

  const dispatchSave = useCallback(async (auto = false) => {
    if (!auto && !hasValues) {
      setError('Adicione ao menos um analito para salvar a avaliacao.');
      return;
    }

    const dispatch = auto ? onAutoSave : onSalvar;
    if (!dispatch) return;

    const normalized = evaluation?.inputNormalized || {};
    const calculated = evaluation?.calculated || {};
    const classifications = evaluation?.classifications || {};
    const warnings = Array.isArray(evaluation?.warnings) ? evaluation.warnings : [];
    const dataAvaliacao = normalizeDateValue(formData.dataAvaliacao);
    const laboratorio = toText(formData.laboratorio);

    setSaveStatus('saving');
    if (saveStatusResetRef.current) clearTimeout(saveStatusResetRef.current);
    try {
      await Promise.resolve(dispatch({
        tipo: 'exames_laboratoriais',
        pacienteId,
        data: dataAvaliacao,
        registros: normalized.analitos || [],
        dados: {
          dataAvaliacao,
          painel: normalized.painel || formData.painel || 'geral',
          laboratorio,
          analitos: normalized.analitos || [],
          dados_brutos: {
            painel: normalized.painel || formData.painel || 'geral',
            analitos: normalized.analitos || [],
            laboratorio: laboratorio || undefined
          },
          resultados_calculados: calculated,
          classificacoes: classifications,
          metadados_formula: {
            formulaId: 'lab_ref_range_v1',
            formulaVersion: '1.0.0'
          },
          input: {
            dataAvaliacao,
            painel: normalized.painel || formData.painel || 'geral',
            analitos: normalized.analitos || [],
            laboratorio
          },
          source: {
            mode: 'manual',
            lab: laboratorio || null
          },
          warnings
        },
        resultados: {
          calculated,
          output: {
            ...classifications,
            warnings
          }
        },
        classificacao: classifications?.statusPainel || 'sem_classificacao',
        classificacaoLabel: classifications?.statusPainel || 'sem_classificacao',
        schemaVersion: 1,
        formulaId: 'lab_ref_range_v1',
        formulaVersion: '1.0.0',
        sourceSystem: 'manual',
        sourceRef: laboratorio || undefined,
        measuredAt: dataAvaliacao,
        sessaoId: moduleSnapshot?.sessaoId || currentSessionId
      }));
      setSaveStatus('saved');
      saveStatusResetRef.current = setTimeout(() => setSaveStatus(null), 3000);
    } catch (dispatchError) {
      setSaveStatus('error');
      if (!auto) {
        setError('Nao foi possivel salvar a avaliacao laboratorial.');
      }
    }
  }, [
    currentSessionId,
    evaluation,
    formData.dataAvaliacao,
    formData.laboratorio,
    formData.painel,
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

  const summary = evaluation?.calculated || {};
  const classification = evaluation?.classifications?.statusPainel || 'sem_classificacao';

  return (
    <div className={`eval-card avaliacao-exames-laboratoriais${readOnly ? ' eval-card--readonly' : ''}`}>
      <div className="eval-header">
        <div className="eval-icon">
          <FileText size={22} />
        </div>
        <div>
          <h3 className="eval-title">Exames laboratoriais</h3>
          <p className="eval-subtitle">Analitos com classificacao por referencia e comparativo anterior.</p>
        </div>
      </div>

      <div className="eval-grid">
        <div className="eval-field">
          <label className="eval-label">Data da avaliacao</label>
          <input
            type="date"
            className="eval-input"
            value={formData.dataAvaliacao}
            onChange={handleRootChange('dataAvaliacao')}
            disabled={readOnly}
          />
        </div>
        <div className="eval-field">
          <label className="eval-label">Painel</label>
          <input
            type="text"
            className="eval-input"
            value={formData.painel}
            onChange={handleRootChange('painel')}
            disabled={readOnly}
            placeholder="Ex.: lipidograma"
          />
        </div>
        <div className="eval-field eval-field-full">
          <label className="eval-label">Laboratorio (opcional)</label>
          <input
            type="text"
            className="eval-input"
            value={formData.laboratorio}
            onChange={handleRootChange('laboratorio')}
            disabled={readOnly}
            placeholder="Nome do laboratorio"
          />
        </div>
      </div>

      <div className="eval-section">
        <div className="avaliacao-exames-laboratoriais__section-header">
          <h4 className="eval-section-title">Analitos</h4>
          <Button
            type="button"
            variant="secondary"
            onClick={addAnalito}
            disabled={readOnly}
          >
            <Plus size={16} /> Adicionar analito
          </Button>
        </div>

        <div className="avaliacao-exames-laboratoriais__rows">
          {formData.analitos.map((row) => (
            <div key={row.id} className="avaliacao-exames-laboratoriais__row">
              <input
                type="text"
                className="eval-input"
                value={row.nome}
                onChange={handleAnalitoChange(row.id, 'nome')}
                disabled={readOnly}
                placeholder="Analito"
              />
              <input
                type="number"
                step="0.01"
                className="eval-input"
                value={row.valor}
                onChange={handleAnalitoChange(row.id, 'valor')}
                disabled={readOnly}
                placeholder="Valor"
              />
              <input
                type="text"
                className="eval-input"
                value={row.unidade}
                onChange={handleAnalitoChange(row.id, 'unidade')}
                disabled={readOnly}
                placeholder="Unidade"
              />
              <input
                type="number"
                step="0.01"
                className="eval-input"
                value={row.referenciaMin}
                onChange={handleAnalitoChange(row.id, 'referenciaMin')}
                disabled={readOnly}
                placeholder="Ref. min"
              />
              <input
                type="number"
                step="0.01"
                className="eval-input"
                value={row.referenciaMax}
                onChange={handleAnalitoChange(row.id, 'referenciaMax')}
                disabled={readOnly}
                placeholder="Ref. max"
              />
              <input
                type="date"
                className="eval-input"
                value={row.dataColeta}
                onChange={handleAnalitoChange(row.id, 'dataColeta')}
                disabled={readOnly}
              />
              <Button
                type="button"
                variant="secondary"
                className="avaliacao-exames-laboratoriais__remove-btn"
                onClick={() => removeAnalito(row.id)}
                disabled={readOnly}
                aria-label="Remover analito"
                title="Remover analito"
              >
                <Trash2 size={16} />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="eval-section">
        <h4 className="eval-section-title">Resumo calculado</h4>
        <div className="eval-summary-grid">
          <SummaryCard label="Alterados" value={summary.alteracoesCount} />
          <SummaryCard label="Limitrofes" value={summary.limitesCount} />
          <SummaryCard label="Normais" value={summary.normaisCount} />
          <SummaryCard label="Score de risco" value={summary.scoreRisco} unit="%" />
          <SummaryCard label="Classificacao" value={classification} />
        </div>
        {evaluation?.warnings?.[0] && (
          <div className="eval-note" style={{ marginTop: '0.75rem' }}>
            {evaluation.warnings[0]}
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

const normalizeAnalito = (item, index = 0, fallbackDate = toLocalDateInputValue(new Date())) => ({
  id: toText(item?.id || `${Date.now()}-${index}`),
  nome: toText(item?.nome || item?.analito),
  valor: toInputValue(item?.valor ?? item?.value ?? item?.resultado),
  unidade: toText(item?.unidade || item?.unit),
  referenciaMin: toInputValue(item?.referenciaMin ?? item?.refMin ?? item?.valorRefMin),
  referenciaMax: toInputValue(item?.referenciaMax ?? item?.refMax ?? item?.valorRefMax),
  dataColeta: normalizeDateValue(item?.dataColeta || item?.data || fallbackDate),
  laboratorio: toText(item?.laboratorio || item?.lab)
});

export default AvaliacaoExamesLaboratoriais;
