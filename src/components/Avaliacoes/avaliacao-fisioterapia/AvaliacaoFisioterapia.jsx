import React, { useEffect, useRef, useState } from 'react';
import { Activity, Save } from 'lucide-react';
import { toLocalDateInputValue } from '../../../utils/dateUtils';
import '../avaliacoes.css';
import './AvaliacaoFisioterapia.css';

const AvaliacaoFisioterapia = ({ pacienteId, onSalvar, onAutoSave, readOnly = false }) => {
  const [formData, setFormData] = useState({
    dataAvaliacao: toLocalDateInputValue(new Date()),
    queixaPrincipal: '',
    dorLocal: '',
    intensidadeDor: '',
    mobilidade: '',
    observacoes: ''
  });
  const [error, setError] = useState('');
  const autoSaveRef = useRef(null);

  const handleChange = (field) => (event) => {
    setError('');
    setFormData((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const hasValues = Boolean(
    formData.queixaPrincipal
    || formData.dorLocal
    || formData.intensidadeDor
    || formData.mobilidade
    || formData.observacoes
  );

  const handleSave = () => {
    if (readOnly) return;
    if (!hasValues) {
      setError('Preencha ao menos um campo da avaliacao.');
      return;
    }
    onSalvar({
      tipo: 'fisioterapia',
      pacienteId,
      dados: {
        queixaPrincipal: formData.queixaPrincipal,
        dorLocal: formData.dorLocal,
        intensidadeDor: formData.intensidadeDor,
        mobilidade: formData.mobilidade,
        observacoes: formData.observacoes
      },
      data: formData.dataAvaliacao
    });
  };

  useEffect(() => {
    if (readOnly || !onAutoSave) return undefined;
    if (!hasValues) return undefined;
    clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => {
      onAutoSave({
        tipo: 'fisioterapia',
        pacienteId,
        dados: {
          queixaPrincipal: formData.queixaPrincipal,
          dorLocal: formData.dorLocal,
          intensidadeDor: formData.intensidadeDor,
          mobilidade: formData.mobilidade,
          observacoes: formData.observacoes
        },
        data: formData.dataAvaliacao
      });
    }, 900);
    return () => clearTimeout(autoSaveRef.current);
  }, [formData, hasValues, onAutoSave, pacienteId, readOnly]);

  return (
    <div className="eval-card avaliacao-fisioterapia">
      <div className="eval-header">
        <div className="eval-icon" style={{ background: 'rgba(249, 115, 22, 0.12)', color: '#f97316' }}>
          <Activity size={22} />
        </div>
        <div>
          <h3 className="eval-title">Avaliacao de fisioterapia</h3>
          <p className="eval-subtitle">Registro funcional, dor e mobilidade</p>
        </div>
      </div>

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

        <div className="eval-field">
          <label className="eval-label">Queixa principal</label>
          <input
            type="text"
            className="eval-input"
            value={formData.queixaPrincipal}
            onChange={handleChange('queixaPrincipal')}
            placeholder="Descreva a queixa principal"
            disabled={readOnly}
          />
        </div>

        <div className="eval-field">
          <label className="eval-label">Local da dor</label>
          <input
            type="text"
            className="eval-input"
            value={formData.dorLocal}
            onChange={handleChange('dorLocal')}
            placeholder="Ex: Joelho direito"
            disabled={readOnly}
          />
        </div>

        <div className="eval-field">
          <label className="eval-label">Intensidade da dor (0-10)</label>
          <input
            type="number"
            min="0"
            max="10"
            className="eval-input"
            value={formData.intensidadeDor}
            onChange={handleChange('intensidadeDor')}
            disabled={readOnly}
          />
        </div>

        <div className="eval-field">
          <label className="eval-label">Mobilidade</label>
          <input
            type="text"
            className="eval-input"
            value={formData.mobilidade}
            onChange={handleChange('mobilidade')}
            placeholder="Ex: Limitacao em flexao"
            disabled={readOnly}
          />
        </div>

        <div className="eval-field eval-field-full">
          <label className="eval-label">Observacoes</label>
          <textarea
            className="eval-textarea"
            rows="4"
            value={formData.observacoes}
            onChange={handleChange('observacoes')}
            placeholder="Notas clinicas"
            disabled={readOnly}
          />
        </div>
      </div>

      <div className="eval-actions">
        <button type="button" className="eval-btn eval-btn-primary" onClick={handleSave} disabled={readOnly}>
          <Save size={18} /> Salvar avaliacao
        </button>
      </div>
      {error && <div className="eval-note" style={{ color: '#b91c1c' }}>{error}</div>}
    </div>
  );
};

export default AvaliacaoFisioterapia;
