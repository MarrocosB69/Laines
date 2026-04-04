import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Save } from 'lucide-react';
import { Button } from '../../ui';
import { toLocalDateInputValue } from '../../../utils/dateUtils';
import '../avaliacoes.css';
import './AvaliacaoSocioeconomica.css';

const EBIA_QUESTIONS = [
  { id: 'q1', text: 'Nos ultimos tres meses, houve preocupacao de que os alimentos acabassem antes de poder comprar ou receber mais comida?' },
  { id: 'q2', text: 'Nos ultimos tres meses, os alimentos acabaram antes de haver dinheiro para comprar mais comida?' },
  { id: 'q3', text: 'Nos ultimos tres meses, faltou dinheiro para manter alimentacao saudavel e variada?' },
  { id: 'q4', text: 'Nos ultimos tres meses, os moradores comeram apenas alguns alimentos restantes porque o dinheiro acabou?' },
  { id: 'q5', text: 'Nos ultimos tres meses, algum morador de 18 anos ou mais deixou de fazer refeicao por falta de dinheiro para comida?' },
  { id: 'q6', text: 'Nos ultimos tres meses, algum morador de 18 anos ou mais comeu menos do que deveria por falta de dinheiro para comida?' },
  { id: 'q7', text: 'Nos ultimos tres meses, algum morador de 18 anos ou mais sentiu fome e nao comeu por falta de dinheiro para comida?' },
  { id: 'q8', text: 'Nos ultimos tres meses, algum morador de 18 anos ou mais fez apenas uma refeicao ao dia ou ficou um dia inteiro sem comer por falta de dinheiro?' },
  { id: 'q9', text: 'Nos ultimos tres meses, algum morador menor de 18 anos deixou de ter alimentacao saudavel e variada por falta de dinheiro para comida?' },
  { id: 'q10', text: 'Nos ultimos tres meses, algum morador menor de 18 anos nao comeu quantidade suficiente por falta de dinheiro para comida?' },
  { id: 'q11', text: 'Nos ultimos tres meses, foi reduzida a quantidade de alimentos de refeicoes de algum morador menor de 18 anos por falta de dinheiro?' },
  { id: 'q12', text: 'Nos ultimos tres meses, algum morador menor de 18 anos deixou de fazer refeicao por falta de dinheiro para comida?' },
  { id: 'q13', text: 'Nos ultimos tres meses, algum morador menor de 18 anos sentiu fome e nao comeu por falta de dinheiro para comida?' },
  { id: 'q14', text: 'Nos ultimos tres meses, algum morador menor de 18 anos fez apenas uma refeicao ao dia ou ficou um dia inteiro sem comer por falta de dinheiro?' }
];

const EBIA_RANGE = {
  comMenores: [
    { code: 'SA', label: 'Seguranca Alimentar', min: 0, max: 0 },
    { code: 'IL', label: 'Insegurança Alimentar Leve', min: 1, max: 5 },
    { code: 'IM', label: 'Insegurança Alimentar Moderada', min: 6, max: 9 },
    { code: 'IG', label: 'Insegurança Alimentar Grave', min: 10, max: 14 }
  ],
  semMenores: [
    { code: 'SA', label: 'Seguranca Alimentar', min: 0, max: 0 },
    { code: 'IL', label: 'Insegurança Alimentar Leve', min: 1, max: 3 },
    { code: 'IM', label: 'Insegurança Alimentar Moderada', min: 4, max: 5 },
    { code: 'IG', label: 'Insegurança Alimentar Grave', min: 6, max: 8 }
  ]
};

const createInitialState = () => ({
  dataAvaliacao: toLocalDateInputValue(new Date()),
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

const AvaliacaoSocioeconomica = ({
  pacienteId,
  onSalvar,
  onAutoSave,
  readOnly = false,
  moduleSnapshot,
  currentSessionId
}) => {
  const [dados, setDados] = useState(createInitialState);
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
    const respostas = source?.respostas || input?.respostas || {};
    const temMenores = resolveTemMenores(input?.temMenores ?? source?.temMenores);

    setDados({
      ...createInitialState(),
      ...mapRespostasToState(respostas),
      dataAvaliacao: normalizeDateValue(moduleSnapshot?.data || source?.dataAvaliacao || input?.dataAvaliacao),
      temMenores
    });

    loadedSnapshotIdRef.current = snapshotId;
  }, [moduleSnapshot]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setError('');
    setDados((prev) => ({ ...prev, [name]: value }));
  };

  const hasMinors = dados.temMenores === 'sim';
  const adultQuestions = EBIA_QUESTIONS.slice(0, 8);
  const minorQuestions = EBIA_QUESTIONS.slice(8);

  const requiredQuestions = useMemo(
    () => (hasMinors ? EBIA_QUESTIONS : adultQuestions),
    [adultQuestions, hasMinors]
  );

  const answersMap = useMemo(() => {
    const entries = EBIA_QUESTIONS.map((item) => [item.id, dados[item.id] === 'sim']);
    return Object.fromEntries(entries);
  }, [dados]);

  const score = useMemo(() => {
    return requiredQuestions.reduce((total, item) => total + (dados[item.id] === 'sim' ? 1 : 0), 0);
  }, [dados, requiredQuestions]);

  const classification = useMemo(() => {
    const ranges = hasMinors ? EBIA_RANGE.comMenores : EBIA_RANGE.semMenores;
    return ranges.find((range) => score >= range.min && score <= range.max) || ranges[ranges.length - 1];
  }, [hasMinors, score]);

  const missingAnswers = useMemo(() => {
    return requiredQuestions.filter((item) => !dados[item.id]);
  }, [dados, requiredQuestions]);

  const answeredCount = useMemo(() => {
    return requiredQuestions.filter((item) => Boolean(dados[item.id])).length;
  }, [dados, requiredQuestions]);

  const payloadDados = useMemo(() => ({
    dataAvaliacao: dados.dataAvaliacao,
    temMenores: hasMinors,
    respostas: answersMap,
    input: {
      dataAvaliacao: dados.dataAvaliacao,
      temMenores: hasMinors,
      respostas: answersMap
    },
    source: {
      mode: 'questionario_ebia',
      system: 'manual'
    }
  }), [answersMap, dados.dataAvaliacao, hasMinors]);

  const payloadResultados = useMemo(() => ({
    pontuacaoEBIA: score,
    classificacao: classification.code,
    classificacaoLabel: classification.label,
    calculated: {
      pontuacaoEBIA: score
    },
    output: {
      classificacao: classification.code,
      classificacaoLabel: classification.label
    }
  }), [classification.code, classification.label, score]);

  const dispatchSalvar = useCallback(async (auto = false) => {
    const dispatch = auto ? onAutoSave : onSalvar;
    if (!dispatch) return;

    if (!dados.temMenores) {
      if (!auto) setError('Informe se ha menores de 18 anos no domicilio.');
      return;
    }

    if (missingAnswers.length > 0) {
      if (!auto) setError('Responda todas as perguntas obrigatorias da EBIA.');
      return;
    }

    setSaveStatus('saving');
    if (saveStatusResetRef.current) clearTimeout(saveStatusResetRef.current);
    try {
      await Promise.resolve(dispatch({
        tipo: 'avaliacao_socioeconomica',
        data: dados.dataAvaliacao,
        pacienteId,
        dados: payloadDados,
        resultados: payloadResultados,
        pontuacaoEBIA: score,
        classificacao: classification.code,
        classificacaoLabel: classification.label,
        schemaVersion: 2,
        formulaId: 'ebia_14_itens',
        formulaVersion: '1.0.0',
        sourceSystem: 'manual',
        measuredAt: normalizeDateValue(dados.dataAvaliacao),
        sessaoId: moduleSnapshot?.sessaoId || currentSessionId
      }));
      setSaveStatus('saved');
      saveStatusResetRef.current = setTimeout(() => setSaveStatus(null), 3000);
    } catch (dispatchError) {
      setSaveStatus('error');
      if (!auto) {
        setError('Nao foi possivel salvar o questionario EBIA.');
      }
    }
  }, [
    classification.code,
    classification.label,
    currentSessionId,
    dados.dataAvaliacao,
    dados.temMenores,
    missingAnswers.length,
    moduleSnapshot?.sessaoId,
    onAutoSave,
    onSalvar,
    pacienteId,
    payloadDados,
    payloadResultados,
    saveStatusResetRef,
    score
  ]);

  useEffect(() => {
    if (readOnly || !onAutoSave) return undefined;
    if (!dados.temMenores) return undefined;
    if (answeredCount === 0) return undefined;
    if (missingAnswers.length > 0) return undefined;

    clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => dispatchSalvar(true), 900);
    return () => clearTimeout(autoSaveRef.current);
  }, [answeredCount, dados.temMenores, dispatchSalvar, missingAnswers.length, onAutoSave, readOnly]);

  useEffect(() => () => {
    if (saveStatusResetRef.current) clearTimeout(saveStatusResetRef.current);
  }, []);

  return (
    <div className={`eval-card avaliacao-socioeconomica${readOnly ? ' eval-card--readonly' : ''}`}>
      <div className="eval-header">
        <div className="eval-icon">
          EBIA
        </div>
        <div>
          <h3 className="eval-title">EBIA</h3>
          <p className="eval-subtitle">Escala Brasileira de Insegurança Alimentar</p>
        </div>
      </div>

      <div className="ebia-intro">
        <div className="eval-field" style={{ maxWidth: '280px' }}>
          <label className="eval-label">Data da coleta</label>
          <input
            type="date"
            className="eval-input"
            name="dataAvaliacao"
            value={dados.dataAvaliacao}
            onChange={handleChange}
            disabled={readOnly}
          />
        </div>

        <label className="eval-label" style={{ marginTop: '0.75rem' }}>Ha moradores menores de 18 anos no domicilio?</label>
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
            <span>Nao</span>
          </label>
        </div>
      </div>

      <div className="eval-section">
        <h4 className="eval-section-title">Progresso do questionario</h4>
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
          <QuestionRow
            key={item.id}
            item={item}
            index={index + 1}
            value={dados[item.id]}
            onChange={handleChange}
            readOnly={readOnly}
          />
        ))}

        {hasMinors ? (
          minorQuestions.map((item, index) => (
            <QuestionRow
              key={item.id}
              item={item}
              index={index + 9}
              value={dados[item.id]}
              onChange={handleChange}
              readOnly={readOnly}
            />
          ))
        ) : (
          <div className="ebia-note">As perguntas 9 a 14 so se aplicam quando ha menores de 18 anos no domicilio.</div>
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

      {error && <div className="form-error-message">{error}</div>}
      {readOnly && (
        <div className="eval-note">Somente leitura para o seu perfil.</div>
      )}

      <div className="eval-actions">
        {saveStatus ? <span className={`save-indicator ${saveStatus}`}>{saveStatus === 'saving' ? 'Salvando...' : saveStatus === 'saved' ? 'Salvo' : 'Erro ao salvar'}</span> : null}
        <Button type="button" variant="primary" onClick={() => dispatchSalvar(false)} disabled={readOnly} loading={saveStatus === 'saving'}>
          <Save size={18} /> Salvar EBIA
        </Button>
      </div>
    </div>
  );
};

function QuestionRow({ item, index, value, onChange, readOnly }) {
  return (
    <div className="ebia-question">
      <span className="ebia-question-text">{index}. {item.text}</span>
      <div className="ebia-options">
        <label className="ebia-option">
          <input
            type="radio"
            name={item.id}
            value="sim"
            checked={value === 'sim'}
            onChange={onChange}
            disabled={readOnly}
          />
          <span>Sim</span>
        </label>
        <label className="ebia-option">
          <input
            type="radio"
            name={item.id}
            value="nao"
            checked={value === 'nao'}
            onChange={onChange}
            disabled={readOnly}
          />
          <span>Nao</span>
        </label>
      </div>
    </div>
  );
}

function mapRespostasToState(respostas) {
  const next = {};
  EBIA_QUESTIONS.forEach((question) => {
    const value = respostas?.[question.id];
    if (value === true || value === 'sim' || value === 'SIM' || value === 1 || value === '1') {
      next[question.id] = 'sim';
      return;
    }
    if (value === false || value === 'nao' || value === 'NAO' || value === 'não' || value === 0 || value === '0') {
      next[question.id] = 'nao';
      return;
    }
    next[question.id] = '';
  });
  return next;
}

function resolveTemMenores(value) {
  if (value === true || value === 'sim' || value === 'SIM' || value === 1 || value === '1') return 'sim';
  if (value === false || value === 'nao' || value === 'NAO' || value === 'não' || value === 0 || value === '0') return 'nao';
  return '';
}

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

export default AvaliacaoSocioeconomica;
