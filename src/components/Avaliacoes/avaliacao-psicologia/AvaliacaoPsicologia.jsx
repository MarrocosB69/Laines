import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Brain, Save, TriangleAlert } from 'lucide-react';
import { Button } from '../../ui';
import { toLocalDateInputValue } from '../../../utils/dateUtils';
import { useSaveStatus } from '../hooks/useSaveStatus';
import '../avaliacoes.css';
import {
  AvaliacaoModulo,
  AvaliacaoSecao,
  AvaliacaoIndice,
  Campo,
  GrupoOpcoes,
  Opcao,
  ResultadoCalculado,
  AvisoAvaliacao,
  BarraAcoesAvaliacao,
} from '../base';
import './AvaliacaoPsicologia.css';

const PHQ9_QUESTIONS = [
  'Pouco interesse ou prazer em fazer as coisas',
  'Sentir-se para baixo, deprimido(a) ou sem esperança',
  'Dificuldade para dormir, continuar dormindo ou dormir demais',
  'Sentir-se cansado(a) ou com pouca energia',
  'Falta de apetite ou comer demais',
  'Sentir-se mal consigo mesmo(a) — ou sentir que é um fracasso ou que decepcionou a si próprio(a) ou sua família',
  'Dificuldade para se concentrar nas coisas (ler jornal ou assistir televisão)',
  'Mover-se ou falar tão devagar que outras pessoas notaram — ou ao contrário, estar tão agitado(a) que fica difícil ficar parado(a)',
  'Pensamentos de que seria melhor estar morto(a) ou de que se machucaria de alguma forma',
];

const GAD7_QUESTIONS = [
  'Sentir-se nervoso(a), ansioso(a) ou no limite',
  'Não conseguir parar ou controlar as preocupações',
  'Preocupar-se demais com diferentes coisas',
  'Dificuldade para relaxar',
  'Ficar tão agitado(a) que fica difícil ficar parado(a)',
  'Irritar-se facilmente ou ficar facilmente aborrecido(a)',
  'Sentir medo como se algo terrível fosse acontecer',
];

const LIKERT_OPTIONS = [
  { value: 0, label: 'Nenhuma vez' },
  { value: 1, label: 'Vários dias' },
  { value: 2, label: 'Mais da metade dos dias' },
  { value: 3, label: 'Quase todos os dias' },
];

const PHQ9_SEVERITY = [
  { max: 4, label: 'Mínima', cls: 'psico-severity--green' },
  { max: 9, label: 'Leve', cls: 'psico-severity--yellow' },
  { max: 14, label: 'Moderada', cls: 'psico-severity--orange' },
  { max: 19, label: 'Moderadamente grave', cls: 'psico-severity--red' },
  { max: 27, label: 'Grave', cls: 'psico-severity--red' },
];

const GAD7_SEVERITY = [
  { max: 4, label: 'Mínima', cls: 'psico-severity--green' },
  { max: 9, label: 'Leve', cls: 'psico-severity--yellow' },
  { max: 14, label: 'Moderada', cls: 'psico-severity--orange' },
  { max: 21, label: 'Grave', cls: 'psico-severity--red' },
];

// Tom da base para a gravidade já calculada: a mesma cor de antes, agora
// sempre ao lado da classificação escrita.
const TOM_DA_GRAVIDADE = {
  'psico-severity--green': 'positivo',
  'psico-severity--yellow': 'atencao',
  'psico-severity--orange': 'atencao',
  'psico-severity--red': 'perigo',
};

// Item 9 do PHQ-9 (ideação): destacado na tela, sem texto novo.
const PHQ9_QUESTOES_DE_RISCO = ['q9'];

const PSICO_INDICE = [
  { id: 'psico-triagem', titulo: 'Triagem emocional' },
  { id: 'psico-phq9', titulo: 'PHQ-9 — Triagem de depressão' },
  { id: 'psico-gad7', titulo: 'GAD-7 — Triagem de ansiedade' },
  { id: 'psico-observacoes', titulo: 'Observações clínicas' },
];

function getSeverity(score, table) {
  return table.find((s) => score <= s.max) || table[table.length - 1];
}

function calcScore(answers, count) {
  let total = 0;
  let filled = 0;
  for (let i = 1; i <= count; i++) {
    const v = answers[`q${i}`];
    if (v !== '' && v !== null && v !== undefined) {
      total += Number(v);
      filled++;
    }
  }
  return { total, filled, complete: filled === count };
}

const buildInitialPhq9 = () => Object.fromEntries(
  PHQ9_QUESTIONS.map((_, i) => [`q${i + 1}`, ''])
);
const buildInitialGad7 = () => Object.fromEntries(
  GAD7_QUESTIONS.map((_, i) => [`q${i + 1}`, ''])
);

const createInitialState = () => ({
  dataAvaliacao: toLocalDateInputValue(new Date()),
  objetivo: '',
  humorAtual: '',
  estresse: '',
  ansiedadeScore: '',
  motivacaoMudanca: '',
  sono: '',
  suporteSocial: '',
  sinaisAlerta: '',
  riscoCompulsao: '',
  observacoes: '',
  phq9: buildInitialPhq9(),
  gad7: buildInitialGad7(),
});

const AvaliacaoPsicologia = ({
  pacienteId,
  onSalvar,
  onAutoSave,
  readOnly = false,
  moduleSnapshot,
  currentSessionId,
}) => {
  const [formData, setFormData] = useState(createInitialState);
  const [error, setError] = useState('');
  const { saveStatus, setSaving, setSuccess, setFailure } = useSaveStatus();
  const autoSaveRef = useRef(null);
  const loadedIdRef = useRef('');

  useEffect(() => {
    const snapshotId = moduleSnapshot?.id || '';
    if (!snapshotId || loadedIdRef.current === snapshotId) return;

    const src = moduleSnapshot?.dados || {};
    const input = src?.input || {};

    const phq9Raw = src?.phq9 || input?.phq9 || {};
    const gad7Raw = src?.gad7 || input?.gad7 || {};

    setFormData({
      dataAvaliacao: normalizeDateValue(moduleSnapshot?.data || src?.dataAvaliacao || input?.dataAvaliacao),
      objetivo: toText(src?.objetivo || input?.objetivo),
      humorAtual: toText(src?.humorAtual || input?.humorAtual),
      estresse: toText(src?.estresse ?? input?.estresse),
      ansiedadeScore: toText(src?.ansiedadeScore ?? input?.ansiedadeScore),
      motivacaoMudanca: toText(src?.motivacaoMudanca ?? input?.motivacaoMudanca),
      sono: toText(src?.sono || input?.sono),
      suporteSocial: toText(src?.suporteSocial || input?.suporteSocial),
      sinaisAlerta: toText(src?.sinaisAlerta || input?.sinaisAlerta),
      riscoCompulsao: toText(src?.riscoCompulsao || input?.riscoCompulsao),
      observacoes: toText(src?.observacoes || input?.observacoes),
      phq9: { ...buildInitialPhq9(), ...phq9Raw },
      gad7: { ...buildInitialGad7(), ...gad7Raw },
    });

    loadedIdRef.current = snapshotId;
  }, [moduleSnapshot]);

  const setField = (field) => (e) => {
    setError('');
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const setQuestionAnswer = (instrument, questionKey, value) => {
    setError('');
    setFormData((prev) => ({
      ...prev,
      [instrument]: { ...prev[instrument], [questionKey]: value },
    }));
  };

  const phq9Result = calcScore(formData.phq9, PHQ9_QUESTIONS.length);
  const gad7Result = calcScore(formData.gad7, GAD7_QUESTIONS.length);

  const hasValues = formData.objetivo || formData.humorAtual || formData.observacoes
    || phq9Result.filled > 0 || gad7Result.filled > 0;

  const buildPayload = useCallback(() => {
    const phq9Score = phq9Result.complete ? phq9Result.total : null;
    const gad7Score = gad7Result.complete ? gad7Result.total : null;
    const dados = {
      objetivo: formData.objetivo,
      humorAtual: formData.humorAtual,
      estresse: formData.estresse !== '' ? Number(formData.estresse) : null,
      ansiedadeScore: formData.ansiedadeScore !== '' ? Number(formData.ansiedadeScore) : null,
      motivacaoMudanca: formData.motivacaoMudanca !== '' ? Number(formData.motivacaoMudanca) : null,
      sono: formData.sono,
      suporteSocial: formData.suporteSocial,
      sinaisAlerta: formData.sinaisAlerta,
      riscoCompulsao: formData.riscoCompulsao,
      observacoes: formData.observacoes,
      phq9: formData.phq9,
      phq9Score,
      phq9Severity: phq9Score !== null ? getSeverity(phq9Score, PHQ9_SEVERITY).label : null,
      gad7: formData.gad7,
      gad7Score,
      gad7Severity: gad7Score !== null ? getSeverity(gad7Score, GAD7_SEVERITY).label : null,
    };
    return {
      tipo: 'psicologia',
      pacienteId,
      dados: { ...dados, input: { dataAvaliacao: formData.dataAvaliacao, ...dados } },
      data: formData.dataAvaliacao,
      schemaVersion: 2,
      formulaId: 'psicologia_triagem_emocional',
      formulaVersion: '2.0.0',
      sourceSystem: 'manual',
      measuredAt: formData.dataAvaliacao,
      sessaoId: moduleSnapshot?.sessaoId || currentSessionId,
    };
  }, [formData, pacienteId, phq9Result, gad7Result, moduleSnapshot, currentSessionId]);

  const dispatchSalvar = useCallback(async (auto = false) => {
    const dispatch = auto ? onAutoSave : onSalvar;
    if (!dispatch) return;
    setSaving();
    try {
      await Promise.resolve(dispatch(buildPayload()));
      setSuccess();
    } catch {
      setFailure();
      if (!auto) setError('Não foi possível salvar a avaliação.');
    }
  }, [buildPayload, onAutoSave, onSalvar, setSaving, setSuccess, setFailure]);

  const handleSave = () => {
    if (readOnly) return;
    if (!hasValues) {
      setError('Preencha ao menos um campo antes de salvar.');
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
    <AvaliacaoModulo
      className={`eval-card avaliacao-psicologia${readOnly ? ' eval-card--readonly' : ''}`}
      titulo="Avaliação de psicologia"
      descricao="Triagem emocional, PHQ-9 e GAD-7"
      icone={<Brain size={22} />}
    >
      <AvaliacaoIndice itens={PSICO_INDICE} />

      {readOnly && <AvisoAvaliacao tipo="info">Somente leitura para o seu perfil.</AvisoAvaliacao>}

      <AvaliacaoSecao id="psico-triagem" titulo="Triagem emocional">
        <div className="eval-grid">
          <Campo rotulo="Data" className="eval-field">
            <input
              type="date"
              className="eval-input"
              value={formData.dataAvaliacao}
              onChange={setField('dataAvaliacao')}
              disabled={readOnly}
            />
          </Campo>
          <Campo rotulo="Objetivo do atendimento" className="eval-field">
            <input type="text" className="eval-input" value={formData.objetivo}
              onChange={setField('objetivo')} placeholder="Ex: Controle de ansiedade" disabled={readOnly} />
          </Campo>
          <Campo rotulo="Humor atual" className="eval-field">
            <input type="text" className="eval-input" value={formData.humorAtual}
              onChange={setField('humorAtual')} placeholder="Ex: Motivado" disabled={readOnly} />
          </Campo>
          <Campo rotulo="Nível de estresse (0–10)" className="eval-field">
            <input type="number" className="eval-input" value={formData.estresse}
              onChange={setField('estresse')} min="0" max="10" disabled={readOnly} />
          </Campo>
          <Campo rotulo="Motivação para adesão (0–10)" className="eval-field">
            <input type="number" className="eval-input" value={formData.motivacaoMudanca}
              onChange={setField('motivacaoMudanca')} min="0" max="10" disabled={readOnly} />
          </Campo>
          <Campo rotulo="Qualidade do sono" className="eval-field">
            <input type="text" className="eval-input" value={formData.sono}
              onChange={setField('sono')} placeholder="Ex: Regular" disabled={readOnly} />
          </Campo>
          <Campo rotulo="Suporte social percebido" className="eval-field">
            <input type="text" className="eval-input" value={formData.suporteSocial}
              onChange={setField('suporteSocial')} placeholder="Ex: Bom suporte familiar" disabled={readOnly} />
          </Campo>
        </div>

        {/* Os dois campos de risco numa faixa em tom de atenção, com ícone de
            forma própria: o rótulo continua sendo o texto de sempre. */}
        <div className="av-grade psico-risco">
          <Campo
            rotulo={<><TriangleAlert size={16} aria-hidden="true" className="psico-risco__icone" /> Sinais de alerta psicológico</>}
            className="eval-field"
          >
            <input type="text" className="eval-input" value={formData.sinaisAlerta}
              onChange={setField('sinaisAlerta')} placeholder="Ex: Irritabilidade, desmotivação" disabled={readOnly} />
          </Campo>
          <Campo
            rotulo={<><TriangleAlert size={16} aria-hidden="true" className="psico-risco__icone" /> Risco de compulsão alimentar</>}
            className="eval-field"
          >
            <input type="text" className="eval-input" value={formData.riscoCompulsao}
              onChange={setField('riscoCompulsao')} placeholder="Ex: Ausente / suspeita / presente" disabled={readOnly} />
          </Campo>
        </div>
      </AvaliacaoSecao>

      <QuestionnaireSection
        id="psico-phq9"
        title="PHQ-9 — Triagem de depressão"
        subtitle="Nas últimas 2 semanas, com que frequência você foi incomodado(a) pelos problemas abaixo?"
        citation="Patient Health Questionnaire — Kroenke, Spitzer & Williams (2001)"
        questions={PHQ9_QUESTIONS}
        answers={formData.phq9}
        instrument="phq9"
        score={phq9Result}
        severityTable={PHQ9_SEVERITY}
        maxScore={27}
        cutOff={10}
        readOnly={readOnly}
        onChange={setQuestionAnswer}
        questoesDeRisco={PHQ9_QUESTOES_DE_RISCO}
      />

      <QuestionnaireSection
        id="psico-gad7"
        title="GAD-7 — Triagem de ansiedade"
        subtitle="Nas últimas 2 semanas, com que frequência você foi incomodado(a) pelos problemas abaixo?"
        citation="Generalized Anxiety Disorder — Spitzer et al. (2006)"
        questions={GAD7_QUESTIONS}
        answers={formData.gad7}
        instrument="gad7"
        score={gad7Result}
        severityTable={GAD7_SEVERITY}
        maxScore={21}
        cutOff={10}
        readOnly={readOnly}
        onChange={setQuestionAnswer}
      />

      {/* O rótulo visível é o título da seção; o campo leva o mesmo texto. */}
      <AvaliacaoSecao id="psico-observacoes" titulo="Observações clínicas">
        <Campo rotulo="Observações clínicas" rotuloOculto className="eval-field eval-field-full">
          <textarea className="eval-textarea" rows={4} value={formData.observacoes}
            onChange={setField('observacoes')} placeholder="Notas clínicas adicionais" disabled={readOnly} />
        </Campo>
      </AvaliacaoSecao>

      <BarraAcoesAvaliacao status={saveStatus}>
        <Button type="button" variant="primary" onClick={handleSave} disabled={readOnly} loading={saveStatus === 'saving'}>
          <Save size={18} /> Salvar avaliação
        </Button>
      </BarraAcoesAvaliacao>
      {error && <AvisoAvaliacao tipo="perigo" anunciar className="form-error-message">{error}</AvisoAvaliacao>}
    </AvaliacaoModulo>
  );
};

// Cada questão é um fieldset: a pergunta é a legenda e as quatro respostas
// da escala são opções rotuladas (antes, o rótulo vinha só do cabeçalho das
// colunas e o rádio ficava invisível).
const QuestionnaireSection = ({
  id, title, subtitle, citation, questions, answers, instrument,
  score, severityTable, maxScore, cutOff, readOnly, onChange, questoesDeRisco = [],
}) => {
  const severity = score.complete ? getSeverity(score.total, severityTable) : null;

  return (
    <AvaliacaoSecao id={id} titulo={title} descricao={subtitle} className="psico-section">
      <p className="psico-section-citation">{citation}</p>

      {questions.map((question, idx) => {
        const key = `q${idx + 1}`;
        const deRisco = questoesDeRisco.includes(key);
        return (
          <GrupoOpcoes
            key={key}
            className={`psico-question${deRisco ? ' psico-question--risco' : ''}`}
            legenda={(
              <span className="psico-q-text">
                {deRisco && <TriangleAlert size={16} aria-hidden="true" className="psico-risco__icone" />}
                <span className="psico-q-num">{idx + 1}.</span> {question}
              </span>
            )}
            horizontal
          >
            {LIKERT_OPTIONS.map((opt) => (
              <Opcao
                key={opt.value}
                rotulo={opt.label}
                className={`psico-likert-option${answers[key] === String(opt.value) || answers[key] === opt.value ? ' psico-likert-option--selected' : ''}${readOnly ? ' psico-likert-option--readonly' : ''}`}
                type="radio"
                name={`${instrument}_${key}`}
                value={opt.value}
                checked={String(answers[key]) === String(opt.value)}
                onChange={() => !readOnly && onChange(instrument, key, opt.value)}
                disabled={readOnly}
              />
            ))}
          </GrupoOpcoes>
        );
      })}

      {/* Sem todas as respostas, o escore não existe: o valor fica "—" e a
          contagem de respondidas vai logo abaixo, com o texto de antes. */}
      <div className="psico-score-row">
        <ResultadoCalculado
          className={`psico-score-badge${severity ? ` ${severity.cls}` : ''}`}
          rotulo={title}
          valor={score.complete ? score.total : null}
          classificacao={score.complete ? `${severity?.label} — pontuação: ${score.total}/${maxScore}` : null}
          tom={severity ? TOM_DA_GRAVIDADE[severity.cls] : undefined}
          referencia={score.complete ? null : `${score.filled}/${questions.length}`}
          metodo={score.complete ? null : 'Preencha todas as questões para calcular'}
        />
        {score.complete && score.total >= cutOff && (
          <AvisoAvaliacao tipo="perigo" className="psico-cutoff-alert">
            Pontuação acima do ponto de corte ({cutOff}). Avaliação especializada indicada.
          </AvisoAvaliacao>
        )}
      </div>
    </AvaliacaoSecao>
  );
};

export default AvaliacaoPsicologia;

function normalizeDateValue(value) {
  if (!value) return toLocalDateInputValue(new Date());
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return value.trim();
  const date = value?.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? toLocalDateInputValue(new Date()) : toLocalDateInputValue(date);
}

function toText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}
