import React, { useState } from 'react';
import { Utensils, Plus } from 'lucide-react';
import '../avaliacoes.css';
import './RegistroConsumo.css';

const RegistroConsumo = ({ onAdicionar, registros = [], readOnly = false }) => {
  const [form, setForm] = useState({
    alimento: '',
    categoria: 'in_natura',
    energia: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!onAdicionar) return;
    if (!form.alimento || !form.energia) return;
    onAdicionar(form);
    setForm({ alimento: '', categoria: 'in_natura', energia: '' });
  };

  return (
    <div className="eval-card registro-consumo">
      <div className="eval-header">
        <div className="eval-icon" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>
          <Utensils size={22} />
        </div>
        <div>
          <h3 className="eval-title">Registro de Consumo</h3>
          <p className="eval-subtitle">Historico alimentar do paciente</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="eval-grid">
        <div className="eval-field eval-field-full">
          <label className="eval-label">Alimento</label>
          <input
            type="text"
            className="eval-input"
            name="alimento"
            value={form.alimento}
            onChange={handleChange}
            disabled={readOnly}
          />
        </div>
        <div className="eval-field">
          <label className="eval-label">Categoria</label>
          <select
            className="eval-select"
            name="categoria"
            value={form.categoria}
            onChange={handleChange}
            disabled={readOnly}
          >
            <option value="in_natura">In natura</option>
            <option value="minimamente_processados">Minimamente processados</option>
            <option value="processados">Processados</option>
            <option value="ultraprocessados">Ultraprocessados</option>
          </select>
        </div>
        <div className="eval-field">
          <label className="eval-label">Energia (kcal)</label>
          <input
            type="number"
            className="eval-input"
            name="energia"
            value={form.energia}
            onChange={handleChange}
            disabled={readOnly}
          />
        </div>
        <div className="eval-actions eval-field-full">
          <button className="eval-btn eval-btn-primary" type="submit" disabled={readOnly}>
            <Plus size={18} /> Adicionar alimento
          </button>
        </div>
      </form>

      <div className="eval-divider" />

      {registros.length === 0 ? (
        <div className="eval-empty">Nenhum registro encontrado para este periodo.</div>
      ) : (
        <div className="eval-grid">
          {registros.map((item) => (
            <div key={item.id} className="registro-consumo-item">
              <div className="registro-consumo-item__title">{item.alimento}</div>
              <div className="registro-consumo-item__meta">
                {item.energia} kcal - {item.categoria.replace(/_/g, ' ')}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RegistroConsumo;


