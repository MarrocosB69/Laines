import React, { useEffect, useRef, useState } from 'react';
import RegistroConsumo from './RegistroConsumo';
import { Utensils, Save, BarChart3 } from 'lucide-react';
import { toLocalDateInputValue } from '../../../utils/dateUtils';
import '../avaliacoes.css';
import './AvaliacaoAlimentarNOVA.css';

const AvaliacaoAlimentarNOVA = ({ pacienteId, onSalvar, onAutoSave, readOnly = false }) => {
  const [registros, setRegistros] = useState([]);
  const [dataAvaliacao, setDataAvaliacao] = useState(toLocalDateInputValue(new Date()));
  const [error, setError] = useState('');
  const autoSaveRef = useRef(null);

  const categoriasNOVA = {
    in_natura: { nome: 'In Natura', energiaTotal: 0, alimentos: [] },
    minimamente_processados: { nome: 'Minimamente Processados', energiaTotal: 0, alimentos: [] },
    processados: { nome: 'Processados', energiaTotal: 0, alimentos: [] },
    ultraprocessados: { nome: 'Ultraprocessados', energiaTotal: 0, alimentos: [] }
  };

  const adicionarAlimento = (alimento) => {
    setError('');
    setRegistros([...registros, {
      ...alimento,
      id: Date.now(),
      data: dataAvaliacao
    }]);
  };

  const calcularTotais = () => {
    const totais = JSON.parse(JSON.stringify(categoriasNOVA));
    registros.forEach(registro => {
      if (totais[registro.categoria]) {
        totais[registro.categoria].energiaTotal += Number(registro.energia || 0);
        totais[registro.categoria].alimentos.push(registro);
      }
    });
    return totais;
  };

  const calcularTotalDiario = () => {
    return Object.values(calcularTotais()).reduce((total, cat) => total + cat.energiaTotal, 0);
  };

  const calcularPercentuais = () => {
    const total = calcularTotalDiario();
    if (total === 0) return {};
    const totais = calcularTotais();
    const percentuais = {};
    Object.keys(totais).forEach(cat => {
      percentuais[cat] = (totais[cat].energiaTotal / total) * 100;
    });
    return percentuais;
  };

  const classificarPadraoAlimentar = (percs) => {
    const up = percs.ultraprocessados || 0;
    if (up < 10) return 'Padrao saudavel';
    if (up < 20) return 'Padrao moderado';
    if (up < 30) return 'Padrao de risco';
    return 'Padrao de alto risco';
  };

  const totais = calcularTotais();
  const percentuais = calcularPercentuais();
  const totalDiario = calcularTotalDiario();
  const classificacao = classificarPadraoAlimentar(percentuais);

  useEffect(() => {
    if (readOnly || !onAutoSave) return undefined;
    if (registros.length === 0) return undefined;
    clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => {
      onAutoSave({
        tipo: 'alimentar',
        registros,
        data: dataAvaliacao,
        totalDiario,
        percentuais,
        classificacao,
        pacienteId
      });
    }, 900);
    return () => clearTimeout(autoSaveRef.current);
  }, [classificacao, dataAvaliacao, onAutoSave, pacienteId, percentuais, readOnly, registros, totalDiario]);

  return (
    <div className="avaliacao-alimentar">
      <div className="eval-card avaliacao-alimentar__header-card">
        <div className="eval-header">
          <div className="eval-icon" style={{ background: 'rgba(116, 168, 101, 0.12)', color: '#74A865' }}>
            <Utensils size={22} />
          </div>
          <div>
            <h3 className="eval-title">Avaliacao alimentar (NOVA)</h3>
            <p className="eval-subtitle">Classificacao por nivel de processamento</p>
          </div>
        </div>

        <div className="avaliacao-alimentar__date-row">
          <div className="eval-field avaliacao-alimentar__date-field">
            <label className="eval-label">Data</label>
            <input
              type="date"
              className="eval-input"
              value={dataAvaliacao}
              onChange={(e) => setDataAvaliacao(e.target.value)}
              disabled={readOnly}
            />
          </div>
        </div>
      </div>

      <div className="avaliacao-alimentar__content-grid">
        <RegistroConsumo onAdicionar={adicionarAlimento} registros={registros} readOnly={readOnly} />

        <div className="eval-card avaliacao-alimentar__summary-card">
          <div className="avaliacao-alimentar__summary-header">
            <BarChart3 size={20} />
            <h4>Resumo do consumo</h4>
          </div>

          <div className="avaliacao-alimentar__category-list">
            {Object.keys(totais).map(cat => (
              <div key={cat} className="avaliacao-alimentar__category-item">
                <div className="avaliacao-alimentar__category-line">
                  <span>{totais[cat].nome}</span>
                  <span>{percentuais[cat]?.toFixed(1) || 0}%</span>
                </div>
                <div className="avaliacao-alimentar__bar">
                  <div
                    className={`avaliacao-alimentar__bar-fill ${
                      cat === 'ultraprocessados' ? 'bg-red-500' :
                      cat === 'processados' ? 'bg-amber-500' :
                      cat === 'minimamente_processados' ? 'bg-blue-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${percentuais[cat] || 0}%` }}
                  />
                </div>
                <div className="avaliacao-alimentar__category-meta">
                  <span>{totais[cat].alimentos.length} alimentos</span>
                  <span>{totais[cat].energiaTotal.toFixed(0)} kcal</span>
                </div>
              </div>
            ))}
          </div>

          <div className="avaliacao-alimentar__footer">
            <div className="avaliacao-alimentar__footer-top">
              <div>
                <p className="avaliacao-alimentar__caption">Total diario</p>
                <p className="avaliacao-alimentar__total">{totalDiario.toFixed(0)} <span>kcal</span></p>
              </div>
              <div className="avaliacao-alimentar__classification-wrap">
                <p className="avaliacao-alimentar__caption">Classificacao</p>
                <span className={`avaliacao-alimentar__classification ${
                  classificacao.includes('alto risco') ? 'bg-red-100 text-red-600' :
                  classificacao.includes('risco') ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'
                }`}>
                  {classificacao}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (registros.length === 0) {
                  setError('Adicione ao menos um alimento.');
                  return;
                }
                onSalvar({ tipo: 'alimentar', registros, data: dataAvaliacao, totalDiario, percentuais, classificacao, pacienteId });
              }}
              disabled={registros.length === 0 || readOnly}
              className="eval-btn eval-btn-primary avaliacao-alimentar__save-btn"
            >
              <Save size={20} /> Salvar avaliacao
            </button>
            {error && <div className="eval-note" style={{ color: '#b91c1c', marginTop: '0.75rem' }}>{error}</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AvaliacaoAlimentarNOVA;



