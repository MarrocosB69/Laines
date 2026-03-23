import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Ruler } from 'lucide-react';
import { toLocalDateInputValue } from '../../../utils/dateUtils';
import '../avaliacoes.css';
import './PerimetrosCorporaisForm.css';

const FIELD_CONFIG = [
  { key: 'peso', label: 'Peso', unit: 'kg', optional: false, placeholder: '85,6' },
  {
    key: 'estatura',
    label: 'Estatura',
    unit: 'm',
    optional: false,
    placeholder: '1,82',
    hint: 'Digite em metros (ex.: 1,76)'
  },
  { key: 'cintura', label: 'Cintura', unit: 'cm', optional: true, hint: 'Opcional (risco)' },
  { key: 'quadril', label: 'Quadril', unit: 'cm', optional: true, hint: 'Opcional (WHR)' },
  { key: 'pescoco', label: 'Pescoço', unit: 'cm', optional: true },
  { key: 'braco_relaxado', label: 'Braço relaxado', unit: 'cm', optional: true },
  { key: 'coxa_maior_perimetro_direita', label: 'Coxa (maior perímetro) - direita', unit: 'cm', optional: true },
  { key: 'coxa_maior_perimetro_esquerda', label: 'Coxa (maior perímetro) - esquerda', unit: 'cm', optional: true },
  { key: 'panturrilha_maior_perimetro_direita', label: 'Panturrilha (maior perímetro) - direita', unit: 'cm', optional: true },
  { key: 'panturrilha_maior_perimetro_esquerda', label: 'Panturrilha (maior perímetro) - esquerda', unit: 'cm', optional: true }
];

const PerimetrosCorporaisForm = ({
  pacienteId,
  onSalvar,
  onAutoSave,
  readOnly = false,
  baselineAnthropometry,
  lockSharedAnthropometry = false
}) => {
  const [dados, setDados] = useState({
    dataAvaliacao: toLocalDateInputValue(new Date()),
    peso: '',
    estatura: '',
    cintura: '',
    quadril: '',
    pescoco: '',
    braco_relaxado: '',
    coxa_maior_perimetro_direita: '',
    coxa_maior_perimetro_esquerda: '',
    panturrilha_maior_perimetro_direita: '',
    panturrilha_maior_perimetro_esquerda: ''
  });
  const [error, setError] = useState('');
  const [hasUserInput, setHasUserInput] = useState(false);
  const autoSaveRef = useRef(null);

  useEffect(() => {
    setHasUserInput(false);
  }, [pacienteId]);

  useEffect(() => {
    if (!baselineAnthropometry) return;
    const pesoBase = Number.isFinite(baselineAnthropometry?.pesoKg)
      ? Number(baselineAnthropometry.pesoKg).toFixed(1)
      : '';
    const estaturaBase = Number.isFinite(baselineAnthropometry?.estaturaCm)
      ? (Number(baselineAnthropometry.estaturaCm) / 100).toFixed(2)
      : '';

    setDados((prev) => ({
      ...prev,
      peso: lockSharedAnthropometry ? pesoBase : (prev.peso || pesoBase),
      estatura: lockSharedAnthropometry ? estaturaBase : (prev.estatura || estaturaBase)
    }));
  }, [baselineAnthropometry, lockSharedAnthropometry]);

  const handleChange = (key, value) => {
    setError('');
    setHasUserInput(true);
    setDados((prev) => ({ ...prev, [key]: value }));
  };

  const payloadDados = useMemo(() => {
    const peso = toNumberOrNull(dados.peso);
    const estaturaMetros = toNumberOrNull(dados.estatura);
    const estaturaCm = Number.isFinite(estaturaMetros) ? Number((estaturaMetros * 100).toFixed(1)) : null;
    const cintura = toNumberOrNull(dados.cintura);
    const quadril = toNumberOrNull(dados.quadril);
    const pescoco = toNumberOrNull(dados.pescoco);
    const bracoRelaxado = toNumberOrNull(dados.braco_relaxado);
    const coxaDireita = toNumberOrNull(dados.coxa_maior_perimetro_direita);
    const coxaEsquerda = toNumberOrNull(dados.coxa_maior_perimetro_esquerda);
    const panturrilhaDireita = toNumberOrNull(dados.panturrilha_maior_perimetro_direita);
    const panturrilhaEsquerda = toNumberOrNull(dados.panturrilha_maior_perimetro_esquerda);

    return {
      peso,
      weight: peso,
      estatura: estaturaMetros,
      estatura_m: estaturaMetros,
      estatura_cm: estaturaCm,
      altura: estaturaCm,
      height: estaturaCm,
      cintura,
      cintura_cm: cintura,
      quadril,
      quadril_cm: quadril,
      pescoco,
      pescoco_cm: pescoco,
      braco_relaxado: bracoRelaxado,
      braco_relaxado_cm: bracoRelaxado,
      coxa_maior_perimetro_direita: coxaDireita,
      coxa_maior_perimetro_esquerda: coxaEsquerda,
      coxa_maior_perimetro_cm: maxOrNull(coxaDireita, coxaEsquerda),
      panturrilha_maior_perimetro_direita: panturrilhaDireita,
      panturrilha_maior_perimetro_esquerda: panturrilhaEsquerda,
      panturrilha_maior_perimetro_cm: maxOrNull(panturrilhaDireita, panturrilhaEsquerda)
    };
  }, [dados]);

  const hasValues = useMemo(
    () => Object.values(payloadDados).some((value) => Number.isFinite(value)),
    [payloadDados]
  );

  const handleSalvar = () => {
    if (!onSalvar) return;
    if (!hasValues) {
      setError('Preencha ao menos uma medida básica.');
      return;
    }
    onSalvar({
      tipo: 'perimetros',
      dados: payloadDados,
      data: dados.dataAvaliacao,
      pacienteId
    });
  };

  useEffect(() => {
    if (readOnly || !onAutoSave || !hasUserInput) return undefined;
    if (!hasValues) return undefined;
    clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => {
      onAutoSave({
        tipo: 'perimetros',
        dados: payloadDados,
        data: dados.dataAvaliacao,
        pacienteId
      });
    }, 900);
    return () => clearTimeout(autoSaveRef.current);
  }, [dados.dataAvaliacao, hasUserInput, hasValues, onAutoSave, pacienteId, payloadDados, readOnly]);

  return (
    <div className="eval-card perimetros-form">
      <div className="eval-header">
        <div className="eval-icon" style={{ background: 'rgba(99, 102, 241, 0.12)', color: '#6366f1' }}>
          <Ruler size={22} />
        </div>
        <div>
          <h3 className="eval-title">Perímetros corporais</h3>
          <p className="eval-subtitle">Medidas básicas para acompanhamento antropométrico</p>
        </div>
      </div>

      <div className="eval-section">
        <h4 className="eval-section-title">Dados da coleta</h4>
        <div className="eval-grid">
          <div className="eval-field">
            <label className="eval-label">Data</label>
            <input
              type="date"
              className="eval-input"
              value={dados.dataAvaliacao || ''}
              onChange={(event) => handleChange('dataAvaliacao', event.target.value)}
              disabled={readOnly}
            />
          </div>
        </div>
      </div>

      <div className="eval-section">
        <h4 className="eval-section-title">Medidas básicas</h4>
        <p className="eval-section-subtitle">
          Peso, estatura e perímetros corporais. Campos opcionais podem ser preenchidos conforme disponibilidade da coleta.
        </p>
        <div className="perimetros-basicos-grid">
          {FIELD_CONFIG.map((field) => {
            const disabledByShared = lockSharedAnthropometry && (field.key === 'peso' || field.key === 'estatura');
            return (
              <div key={field.key} className="eval-field perimetros-field">
                <label className="eval-label">
                  {field.label}
                  <span className="perimetros-field__unit">{field.unit}</span>
                  {field.optional ? <span className="perimetros-field__optional">Opcional</span> : null}
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  className="eval-input"
                  value={dados[field.key] || ''}
                  onChange={(event) => handleChange(field.key, event.target.value)}
                  placeholder={field.placeholder || ''}
                  disabled={readOnly || disabledByShared}
                />
                {field.hint ? <small className="perimetros-field__hint">{field.hint}</small> : null}
                {disabledByShared ? (
                  <small className="perimetros-field__hint">Preenchido pela ficha base compartilhada.</small>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="eval-actions">
        <button type="button" className="eval-btn eval-btn-primary" onClick={handleSalvar} disabled={readOnly}>
          Salvar perímetros
        </button>
      </div>

      {error && <div className="eval-note" style={{ color: '#b91c1c' }}>{error}</div>}
    </div>
  );
};

export default PerimetrosCorporaisForm;

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value).replace(',', '.').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function maxOrNull(...values) {
  const numerics = values.filter((value) => Number.isFinite(value));
  if (numerics.length === 0) return null;
  return Math.max(...numerics);
}


