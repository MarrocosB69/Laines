import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Save } from 'lucide-react';
import { Button } from '../../ui';
import { toLocalDateInputValue } from '../../../utils/dateUtils';
import { useSaveStatus } from '../hooks/useSaveStatus';
import { useModuleSnapshot } from '../hooks/useModuleSnapshot';
import EvaluationHeader from './EvaluationHeader';
import '../avaliacoes.css';

/**
 * Generic evaluation form for text-based assessments (fisioterapia, psicologia, etc.).
 *
 * `config` shape:
 * {
 *   tipo:      string,                   // e.g. 'fisioterapia'
 *   formulaId: string,                   // e.g. 'fisioterapia_funcional_basica'
 *   icon:      ReactNode,                // e.g. <Activity size={22} />
 *   title:     string,
 *   subtitle?: string,
 *   cssClass?: string,                   // appended to eval-card, e.g. 'avaliacao-fisioterapia'
 *   fields: Array<{
 *     key:          string,
 *     label:        string,
 *     type?:        'text' | 'number',   // default 'text'
 *     placeholder?: string,
 *     min?:         string,
 *     max?:         string,
 *     textarea?:    boolean,
 *     rows?:        number,
 *   }>
 * }
 */
const AvaliacaoTextual = ({
  pacienteId,
  onSalvar,
  onAutoSave,
  readOnly = false,
  moduleSnapshot,
  currentSessionId,
  config
}) => {
  const [formData, setFormData] = useState(() => {
    const initial = { dataAvaliacao: toLocalDateInputValue(new Date()) };
    config.fields.forEach((f) => { initial[f.key] = ''; });
    return initial;
  });
  const [error, setError] = useState('');
  const { saveStatus, setSaving, setSuccess, setFailure } = useSaveStatus();
  const autoSaveRef = useRef(null);

  useModuleSnapshot(moduleSnapshot, (source, input, snapshot) => {
    const next = {
      dataAvaliacao: normalizeDateValue(snapshot?.data || source?.dataAvaliacao || input?.dataAvaliacao)
    };
    config.fields.forEach((f) => {
      next[f.key] = toText(input?.[f.key] || source?.[f.key]);
    });
    setFormData(next);
  });

  const handleChange = (field) => (event) => {
    setError('');
    setFormData((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const hasValues = config.fields.some((f) => Boolean(formData[f.key]));

  const dispatchSalvar = useCallback(async (auto = false) => {
    const dispatch = auto ? onAutoSave : onSalvar;
    if (!dispatch) return;
    setSaving();
    const fieldData = {};
    config.fields.forEach((f) => { fieldData[f.key] = formData[f.key]; });
    try {
      await Promise.resolve(dispatch({
        tipo: config.tipo,
        pacienteId,
        dados: {
          ...fieldData,
          input: {
            dataAvaliacao: formData.dataAvaliacao,
            ...fieldData
          }
        },
        data: formData.dataAvaliacao,
        schemaVersion: 2,
        formulaId: config.formulaId,
        formulaVersion: '1.0.0',
        sourceSystem: 'manual',
        measuredAt: normalizeDateValue(formData.dataAvaliacao),
        sessaoId: moduleSnapshot?.sessaoId || currentSessionId
      }));
      setSuccess();
    } catch {
      setFailure();
      if (!auto) setError('Nao foi possivel salvar a avaliacao.');
    }
  }, [
    config,
    currentSessionId,
    formData,
    moduleSnapshot,
    onAutoSave,
    onSalvar,
    pacienteId,
    setFailure,
    setSaving,
    setSuccess
  ]);

  const handleSave = () => {
    if (readOnly) return;
    if (!hasValues) {
      setError('Preencha ao menos um campo da avaliacao.');
      return;
    }
    dispatchSalvar(false);
  };

  useEffect(() => {
    if (readOnly || !onAutoSave || !hasValues) return undefined;
    clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => dispatchSalvar(true), 3500);
    return () => clearTimeout(autoSaveRef.current);
  }, [dispatchSalvar, hasValues, onAutoSave, readOnly]);

  return (
    <div className={`eval-card${config.cssClass ? ` ${config.cssClass}` : ''}${readOnly ? ' eval-card--readonly' : ''}`}>
      <EvaluationHeader icon={config.icon} title={config.title} subtitle={config.subtitle} />

      <div className="eval-grid">
        <div className="eval-field">
          <label className="eval-label">Data</label>
          <input
            type="date"
            className="eval-input"
            value={formData.dataAvaliacao}
            onChange={handleChange('dataAvaliacao')}
            disabled={readOnly}
          />
        </div>

        {config.fields.map((f) => (
          f.textarea ? (
            <div key={f.key} className="eval-field eval-field-full">
              <label className="eval-label">{f.label}</label>
              <textarea
                className="eval-textarea"
                rows={f.rows || 4}
                value={formData[f.key]}
                onChange={handleChange(f.key)}
                placeholder={f.placeholder}
                disabled={readOnly}
              />
            </div>
          ) : (
            <div key={f.key} className="eval-field">
              <label className="eval-label">{f.label}</label>
              <input
                type={f.type || 'text'}
                className="eval-input"
                value={formData[f.key]}
                onChange={handleChange(f.key)}
                placeholder={f.placeholder}
                disabled={readOnly}
                min={f.min}
                max={f.max}
              />
            </div>
          )
        ))}
      </div>

      {readOnly && <div className="eval-note">Somente leitura para o seu perfil.</div>}

      <div className="eval-actions">
        {saveStatus && (
          <span className={`save-indicator ${saveStatus}`}>
            {saveStatus === 'saving' ? 'Salvando...' : saveStatus === 'saved' ? 'Salvo' : 'Erro ao salvar'}
          </span>
        )}
        <Button type="button" variant="primary" onClick={handleSave} disabled={readOnly} loading={saveStatus === 'saving'}>
          <Save size={18} /> Salvar avaliacao
        </Button>
      </div>
      {error && <div className="form-error-message">{error}</div>}
    </div>
  );
};

export default AvaliacaoTextual;

function normalizeDateValue(value) {
  if (!value) return toLocalDateInputValue(new Date());
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  }
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return toLocalDateInputValue(new Date());
  return toLocalDateInputValue(date);
}

function toText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}
