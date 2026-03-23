import React, { useEffect, useRef, useState } from 'react';
import { Brain, Save } from 'lucide-react';
import { toLocalDateInputValue } from '../../../utils/dateUtils';
import '../avaliacoes.css';
import './AvaliacaoPsicologia.css';

const AvaliacaoPsicologia = ({ pacienteId, onSalvar, onAutoSave, readOnly = false }) => {
  const [formData, setFormData] = useState({
    dataAvaliacao: toLocalDateInputValue(new Date()),
    objetivo: '',
    humorAtual: '',
    estresse: '',
    sono: '',
    observacoes: ''
  });
  const [error, setError] = useState('');
  const autoSaveRef = useRef(null);

  const handleChange = (field) => (event) => {
    setError('');
    setFormData((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const hasValues = Boolean(
    formData.objetivo
    || formData.humorAtual
    || formData.estresse
    || formData.sono
    || formData.observacoes
  );

  const handleSave = () => {
    if (readOnly) return;
    if (!hasValues) {
      setError('Preencha ao menos um campo da avaliacao.');
      return;
    }
    onSalvar({
      tipo: 'psicologia',
      pacienteId,
      dados: {
        objetivo: formData.objetivo,
        humorAtual: formData.humorAtual,
        estresse: formData.estresse,
        sono: formData.sono,
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
        tipo: 'psicologia',
        pacienteId,
        dados: {
          objetivo: formData.objetivo,
          humorAtual: formData.humorAtual,
          estresse: formData.estresse,
          sono: formData.sono,
          observacoes: formData.observacoes
        },
        data: formData.dataAvaliacao
      });
    }, 900);
    return () => clearTimeout(autoSaveRef.current);
  }, [formData, hasValues, onAutoSave, pacienteId, readOnly]);

  return (
    <div className="eval-card avaliacao-psicologia">
      <div className="eval-header">
        <div className="eval-icon" style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#2563eb' }}>
          <Brain size={22} />
        </div>
        <div>
          <h3 className="eval-title">Avaliacao de psicologia</h3>
          <p className="eval-subtitle">Registro emocional e comportamental</p>
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
          <label className="eval-label">Objetivo do atendimento</label>
          <input
            type="text"
            className="eval-input"
            value={formData.objetivo}
            onChange={handleChange('objetivo')}
            placeholder="Ex: Controle de ansiedade"
            disabled={readOnly}
          />
        </div>

        <div className="eval-field">
          <label className="eval-label">Humor atual</label>
          <input
            type="text"
            className="eval-input"
            value={formData.humorAtual}
            onChange={handleChange('humorAtual')}
            placeholder="Ex: Motivado"
            disabled={readOnly}
          />
        </div>

        <div className="eval-field">
          <label className="eval-label">Nivel de estresse (0-10)</label>
          <input
            type="number"
            min="0"
            max="10"
            className="eval-input"
            value={formData.estresse}
            onChange={handleChange('estresse')}
            disabled={readOnly}
          />
        </div>

        <div className="eval-field">
          <label className="eval-label">Qualidade do sono</label>
          <input
            type="text"
            className="eval-input"
            value={formData.sono}
            onChange={handleChange('sono')}
            placeholder="Ex: Regular"
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

export default AvaliacaoPsicologia;
