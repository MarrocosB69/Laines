import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Save } from 'lucide-react';
import { toLocalDateInputValue } from '../../../utils/dateUtils';
import '../avaliacoes.css';
import './AvaliacaoSocioeconomica.css';

const EBIA_QUESTIONS = [
  {
    id: 'q1',
    text: 'Nos últimos três meses, os moradores deste domicílio tiveram preocupação de que os alimentos acabassem antes de poderem comprar ou receber mais comida?'
  },
  {
    id: 'q2',
    text: 'Nos últimos três meses, os alimentos acabaram antes que os moradores deste domicílio tivessem dinheiro para comprar mais comida?'
  },
  {
    id: 'q3',
    text: 'Nos últimos três meses, os moradores deste domicílio ficaram sem dinheiro para ter uma alimentação saudável e variada?'
  },
  {
    id: 'q4',
    text: 'Nos últimos três meses, os moradores deste domicílio comeram apenas alguns alimentos que ainda tinham porque o dinheiro acabou?'
  },
  {
    id: 'q5',
    text: 'Nos últimos três meses, algum morador de 18 anos ou mais de idade deixou de fazer uma refeição porque não havia dinheiro para comprar comida?'
  },
  {
    id: 'q6',
    text: 'Nos últimos três meses, algum morador de 18 anos ou mais de idade, alguma vez, comeu menos do que devia porque não havia dinheiro para comprar comida?'
  },
  {
    id: 'q7',
    text: 'Nos últimos três meses, algum morador de 18 anos ou mais de idade, alguma vez, sentiu fome, mas não comeu, porque não havia dinheiro para comprar comida?'
  },
  {
    id: 'q8',
    text: 'Nos últimos três meses, algum morador de 18 anos ou mais de idade, alguma vez, fez apenas uma refeição ao dia ou ficou um dia inteiro sem comer porque não havia dinheiro para comprar comida?'
  },
  {
    id: 'q9',
    text: 'Nos últimos três meses, algum morador com menos de 18 anos de idade, alguma vez, deixou de ter uma alimentação saudável e variada porque não havia dinheiro para comprar comida?'
  },
  {
    id: 'q10',
    text: 'Nos últimos três meses, algum morador com menos de 18 anos de idade, alguma vez, não comeu quantidade suficiente de comida porque não havia dinheiro para comprar comida?'
  },
  {
    id: 'q11',
    text: 'Nos últimos três meses, alguma vez, foi diminuída a quantidade de alimentos das refeições de algum morador com menos de 18 anos de idade, porque não havia dinheiro para comprar comida?'
  },
  {
    id: 'q12',
    text: 'Nos últimos três meses, alguma vez, algum morador com menos de 18 anos de idade deixou de fazer uma refeição, porque não havia dinheiro para comprar comida?'
  },
  {
    id: 'q13',
    text: 'Nos últimos três meses, alguma vez, algum morador com menos de 18 anos de idade, sentiu fome, mas não comeu, porque não havia dinheiro para comprar comida?'
  },
  {
    id: 'q14',
    text: 'Nos últimos três meses, alguma vez, algum morador com menos de 18 anos de idade, fez apenas uma refeição ao dia ou ficou um dia inteiro sem comer porque não havia dinheiro para comprar comida?'
  }
];

const EBIA_RANGE = {
  comMenores: [
    { code: 'SA', label: 'Segurança Alimentar', min: 0, max: 0 },
    { code: 'IL', label: 'Insegurança Alimentar Leve', min: 1, max: 5 },
    { code: 'IM', label: 'Insegurança Alimentar Moderada', min: 6, max: 9 },
    { code: 'IG', label: 'Insegurança Alimentar Grave', min: 10, max: 14 }
  ],
  semMenores: [
    { code: 'SA', label: 'Segurança Alimentar', min: 0, max: 0 },
    { code: 'IL', label: 'Insegurança Alimentar Leve', min: 1, max: 3 },
    { code: 'IM', label: 'Insegurança Alimentar Moderada', min: 4, max: 5 },
    { code: 'IG', label: 'Insegurança Alimentar Grave', min: 6, max: 8 }
  ]
};

const AvaliacaoSocioeconomica = ({ pacienteId, onSalvar, onAutoSave, readOnly = false }) => {
  const [dados, setDados] = useState({
    temMenores: '',
    q1: '',
    q2: '',
    q3: '',
    q4: '',
    q5: '',
    q6: '',
    q7: '',
    q8: '',
    q9: '',
    q10: '',
    q11: '',
    q12: '',
    q13: '',
    q14: ''
  });

  const [error, setError] = useState('');
  const autoSaveRef = useRef(null);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setError('');
    setDados((prev) => ({ ...prev, [name]: value }));
  };

  const hasMinors = dados.temMenores === 'sim';
  const adultQuestions = EBIA_QUESTIONS.slice(0, 8);
  const minorQuestions = EBIA_QUESTIONS.slice(8);

  const answersMap = useMemo(() => {
    const entries = EBIA_QUESTIONS.map((item) => {
      const value = dados[item.id];
      return [item.id, value === 'sim'];
    });
    return Object.fromEntries(entries);
  }, [dados]);

  const score = useMemo(() => {
    const applicable = hasMinors ? EBIA_QUESTIONS : adultQuestions;
    return applicable.reduce((total, item) => total + (dados[item.id] === 'sim' ? 1 : 0), 0);
  }, [adultQuestions, dados, hasMinors]);

  const classification = useMemo(() => {
    const ranges = hasMinors ? EBIA_RANGE.comMenores : EBIA_RANGE.semMenores;
    return ranges.find((range) => score >= range.min && score <= range.max) || ranges[ranges.length - 1];
  }, [hasMinors, score]);

  const missingAnswers = useMemo(() => {
    const required = hasMinors ? EBIA_QUESTIONS : adultQuestions;
    return required.filter((item) => !dados[item.id]);
  }, [adultQuestions, dados, hasMinors]);

  const answeredCount = useMemo(() => {
    const required = hasMinors ? EBIA_QUESTIONS : adultQuestions;
    return required.filter((item) => Boolean(dados[item.id])).length;
  }, [adultQuestions, dados, hasMinors]);

  const salvarAvaliacao = () => {
    if (!onSalvar) return;
    if (!dados.temMenores) {
      setError('Informe se há menores de 18 anos no domicílio.');
      return;
    }
    if (missingAnswers.length > 0) {
      setError('Responda todas as perguntas obrigatórias da EBIA.');
      return;
    }

    onSalvar({
      tipo: 'avaliacao_socioeconomica',
      data: toLocalDateInputValue(new Date()),
      pacienteId,
      dados: {
        temMenores: hasMinors,
        respostas: answersMap
      },
      pontuacaoEBIA: score,
      classificacao: classification.code,
      classificacaoLabel: classification.label
    });
  };

  useEffect(() => {
    if (readOnly || !onAutoSave) return undefined;
    if (!dados.temMenores) return undefined;
    clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => {
      onAutoSave({
        tipo: 'avaliacao_socioeconomica',
        data: toLocalDateInputValue(new Date()),
        pacienteId,
        dados: {
          temMenores: hasMinors,
          respostas: answersMap
        },
        pontuacaoEBIA: score,
        classificacao: classification.code,
        classificacaoLabel: classification.label
      });
    }, 900);
    return () => clearTimeout(autoSaveRef.current);
  }, [answersMap, classification.code, classification.label, dados.temMenores, hasMinors, onAutoSave, pacienteId, readOnly, score]);

  return (
    <div className="eval-card avaliacao-socioeconomica">
      <div className="eval-header">
        <div className="eval-icon" style={{ background: 'rgba(14, 165, 233, 0.12)', color: '#0ea5e9' }}>
          EBIA
        </div>
        <div>
          <h3 className="eval-title">EBIA</h3>
          <p className="eval-subtitle">Escala Brasileira de Insegurança Alimentar</p>
        </div>
      </div>

      <div className="ebia-intro">
        <label className="eval-label">Há moradores menores de 18 anos no domicílio?</label>
        <div className="ebia-options">
          <label className="ebia-option">
            <input
              type="radio"
              name="temMenores"
              value="sim"
              checked={dados.temMenores === 'sim'}
              onChange={handleChange}
              disabled={readOnly}
            />
            <span>Sim</span>
          </label>
          <label className="ebia-option">
            <input
              type="radio"
              name="temMenores"
              value="nao"
              checked={dados.temMenores === 'nao'}
              onChange={handleChange}
              disabled={readOnly}
            />
            <span>Não</span>
          </label>
        </div>
      </div>

      <div className="eval-section">
        <h4 className="eval-section-title">Progresso do questionário</h4>
        <p className="eval-section-subtitle">Acompanhe o preenchimento para evitar respostas incompletas.</p>
        <div className="eval-summary-grid">
          <div className="eval-summary-item">
            <span>Respostas preenchidas</span>
            <strong>{answeredCount}</strong>
          </div>
          <div className="eval-summary-item">
            <span>Pendentes</span>
            <strong>{missingAnswers.length}</strong>
          </div>
          <div className="eval-summary-item">
            <span>Pontuação parcial</span>
            <strong>{score} ponto(s)</strong>
          </div>
        </div>
      </div>

      <div className="ebia-questions">
        {adultQuestions.map((item, index) => (
          <div key={item.id} className="ebia-question">
            <span className="ebia-question-text">{index + 1}. {item.text}</span>
            <div className="ebia-options">
              <label className="ebia-option">
                <input
                  type="radio"
                  name={item.id}
                  value="sim"
                  checked={dados[item.id] === 'sim'}
                  onChange={handleChange}
                  disabled={readOnly}
                />
                <span>Sim</span>
              </label>
              <label className="ebia-option">
                <input
                  type="radio"
                  name={item.id}
                  value="nao"
                  checked={dados[item.id] === 'nao'}
                  onChange={handleChange}
                  disabled={readOnly}
                />
                <span>Não</span>
              </label>
            </div>
          </div>
        ))}

        {hasMinors ? (
          minorQuestions.map((item, index) => (
            <div key={item.id} className="ebia-question">
              <span className="ebia-question-text">{index + 9}. {item.text}</span>
              <div className="ebia-options">
                <label className="ebia-option">
                  <input
                    type="radio"
                    name={item.id}
                    value="sim"
                    checked={dados[item.id] === 'sim'}
                    onChange={handleChange}
                    disabled={readOnly}
                  />
                  <span>Sim</span>
                </label>
                <label className="ebia-option">
                  <input
                    type="radio"
                    name={item.id}
                    value="nao"
                    checked={dados[item.id] === 'nao'}
                    onChange={handleChange}
                    disabled={readOnly}
                  />
                  <span>Não</span>
                </label>
              </div>
            </div>
          ))
        ) : (
          <div className="ebia-note">As perguntas 9 a 14 só se aplicam quando há menores de 18 anos no domicílio.</div>
        )}
      </div>

      <div className="ebia-result">
        <div className="ebia-score">
          <span>Pontuação</span>
          <strong>{score} pontos</strong>
        </div>
        <div className={`ebia-status status-${classification.code.toLowerCase()}`}>
          <span>{classification.code}</span>
          <strong>{classification.label}</strong>
        </div>
      </div>

      {error && <div className="eval-note" style={{ color: '#b91c1c' }}>{error}</div>}

      <div className="eval-actions">
        <button type="button" className="eval-btn eval-btn-primary" onClick={salvarAvaliacao} disabled={readOnly}>
          <Save size={18} /> Salvar EBIA
        </button>
      </div>
    </div>
  );
};

export default AvaliacaoSocioeconomica;


