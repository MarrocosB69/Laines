import React, { useEffect, useRef, useState } from 'react';
import { Droplets, Save } from 'lucide-react';
import { toLocalDateInputValue } from '../../../utils/dateUtils';
import '../avaliacoes.css';
import './AvaliacaoHidratacao.css';

const AvaliacaoHidratacao = ({ pacienteId, onSalvar, onAutoSave, readOnly = false }) => {
  const [dados, setDados] = useState({
    dataAvaliacao: toLocalDateInputValue(new Date()),
    perdaSuor: '',
    taxaSudorese: '',
    perdaPesoPercentual: '',
    observacoes: ''
  });
  const [error, setError] = useState('');
  const autoSaveRef = useRef(null);

  const perdaPercentual = Number(dados.perdaPesoPercentual);
  const classificacaoHidrica = Number.isFinite(perdaPercentual)
    ? (
      perdaPercentual >= 3 ? 'Desidratacao importante'
        : perdaPercentual >= 2 ? 'Desidratacao moderada'
          : perdaPercentual > 0 ? 'Leve desidratacao'
            : 'Sem perda relevante'
    )
    : 'Sem classificacao';

  const handleChange = (e) => {
    const { name, value } = e.target;
    setError('');
    setDados(prev => ({ ...prev, [name]: value }));
  };

  const handleSalvar = () => {
    if (!onSalvar) return;
    const hasValues = Boolean(
      dados.perdaSuor ||
      dados.taxaSudorese ||
      dados.perdaPesoPercentual ||
      dados.observacoes
    );
    if (!hasValues) {
      setError('Preencha ao menos um campo.');
      return;
    }
    onSalvar({
      tipo: 'hidratacao',
      dados,
      data: dados.dataAvaliacao,
      pacienteId
    });
  };

  useEffect(() => {
    if (readOnly || !onAutoSave) return undefined;
    const hasValues = Boolean(
      dados.perdaSuor ||
      dados.taxaSudorese ||
      dados.perdaPesoPercentual ||
      dados.observacoes
    );
    if (!hasValues) return undefined;
    clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => {
      onAutoSave({
        tipo: 'hidratacao',
        dados,
        data: dados.dataAvaliacao,
        pacienteId
      });
    }, 900);
    return () => clearTimeout(autoSaveRef.current);
  }, [dados, onAutoSave, pacienteId, readOnly]);

  return (
    <div className="eval-card avaliacao-hidratacao">
      <div className="eval-header">
        <div className="eval-icon" style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6' }}>
          <Droplets size={22} />
        </div>
        <div>
          <h3 className="eval-title">Avaliacao de Hidratacao</h3>
          <p className="eval-subtitle">Controle da ingestao hidrica</p>
        </div>
      </div>

      <div className="eval-grid">
        <div className="eval-field">
          <label className="eval-label">Data</label>
          <input
            type="date"
            className="eval-input"
            name="dataAvaliacao"
            value={dados.dataAvaliacao}
            onChange={handleChange}
            disabled={readOnly}
          />
        </div>
        <div className="eval-field">
          <label className="eval-label">Perda de suor (ml)</label>
          <input
            type="number"
            className="eval-input"
            name="perdaSuor"
            value={dados.perdaSuor}
            onChange={handleChange}
            disabled={readOnly}
          />
        </div>
        <div className="eval-field">
          <label className="eval-label">Taxa de sudorese (ml/min)</label>
          <input
            type="number"
            className="eval-input"
            name="taxaSudorese"
            value={dados.taxaSudorese}
            onChange={handleChange}
            disabled={readOnly}
          />
        </div>
        <div className="eval-field">
          <label className="eval-label">Perda de peso (%)</label>
          <input
            type="number"
            className="eval-input"
            name="perdaPesoPercentual"
            value={dados.perdaPesoPercentual}
            onChange={handleChange}
            disabled={readOnly}
          />
        </div>
        <div className="eval-field" style={{ gridColumn: '1 / -1' }}>
          <label className="eval-label">Observacoes</label>
          <textarea
            className="eval-textarea"
            name="observacoes"
            value={dados.observacoes}
            onChange={handleChange}
            rows="4"
            disabled={readOnly}
          />
        </div>
      </div>

      <div className="eval-section">
        <h4 className="eval-section-title">Leitura clinica rapida</h4>
        <p className="eval-section-subtitle">Resumo automatico para orientar conduta no acompanhamento.</p>
        <div className="eval-summary-grid">
          <div className="eval-summary-item">
            <span>Perda de peso</span>
            <strong>{Number.isFinite(perdaPercentual) ? `${perdaPercentual}%` : 'Não informada'}</strong>
          </div>
          <div className="eval-summary-item">
            <span>Classificacao</span>
            <strong>{classificacaoHidrica}</strong>
          </div>
          <div className="eval-summary-item">
            <span>Taxa de sudorese</span>
            <strong>{dados.taxaSudorese ? `${dados.taxaSudorese} ml/min` : 'Não informada'}</strong>
          </div>
        </div>
      </div>

      <div className="eval-actions">
        <button type="button" className="eval-btn eval-btn-primary" onClick={handleSalvar} disabled={readOnly}>
          <Save size={18} /> Salvar avaliacao
        </button>
      </div>

      {error && <div className="eval-note" style={{ color: '#b91c1c' }}>{error}</div>}
    </div>
  );
};

export default AvaliacaoHidratacao;


