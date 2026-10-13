import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Save } from 'lucide-react';
import { Button } from '../../components/ui';
import EvaluationReadiness from '../../components/Avaliacoes/components/EvaluationReadiness';
import { toLocalDateInputValue } from '../../utils/dateUtils';
import '../../components/Avaliacoes/avaliacoes.css';
import {
  AvaliacaoModulo,
  AvaliacaoSecao,
  AvaliacaoIndice,
  Campo,
  GrupoOpcoes,
  Opcao,
  ResultadoCalculado,
  AvisoAvaliacao,
  BarraAcoesAvaliacao
} from '../../components/Avaliacoes/base';
import './AvaliacaoTriagemREDS.css';
import {
  LEAF_Q_QUESTIONS,
  LEA_Q13_QUESTIONS,
  SINTOMAS_OPTIONS,
  scoreQuestionnaire
} from '../../constants/clinicalInstruments';

// Só exibição: o tom da conduta (recomendacaoConduta.tone) vira o tipo do aviso.
const TIPO_AVISO_CONDUTA = { risk: 'perigo', warn: 'atencao', ok: 'sucesso' };

// Só exibição (WI-013): o código da faixa de DE segue igual no payload e no
// CSS; a tela mostra o nome do glossário. A forma curta vai onde o bloco já
// diz "disponibilidade energética".
const ROTULO_CLASSIFICACAO_DE = {
  otima: 'Disponibilidade energética adequada',
  risco_relativo: 'Disponibilidade energética reduzida',
  reds_estabelecido: 'Baixa disponibilidade energética'
};
const ROTULO_CURTO_CLASSIFICACAO_DE = { otima: 'adequada', risco_relativo: 'reduzida', reds_estabelecido: 'baixa' };

const createQuestionnaireState = (questions) => (
  questions.reduce((acc, item) => {
    acc[item.key] = null;
    return acc;
  }, {})
);

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(String(value).replace(',', '.').trim());
  return Number.isFinite(parsed) ? parsed : null;
};

const toInput = (value, digits = 2) => {
  if (!Number.isFinite(value)) return '';
  return Number(value).toFixed(digits);
};

const toBool = (value) => {
  if (typeof value === 'boolean') return value;
  if (value === null || value === undefined || value === '') return false;
  const token = String(value).trim().toLowerCase();
  return ['true', '1', 'sim', 'yes'].includes(token);
};

const firstDefined = (...values) => values.find((value) => value !== undefined && value !== null);

const normalizeDateValue = (value) => {
  if (!value) return toLocalDateInputValue(new Date());
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return toLocalDateInputValue(new Date());
  return toLocalDateInputValue(date);
};

const readPath = (source, path) => {
  if (!source || !path) return undefined;
  return String(path).split('.').reduce((acc, key) => (
    acc === null || acc === undefined ? undefined : acc[key]
  ), source);
};

const readNumberByAliases = (source, aliases = []) => {
  for (const alias of aliases) {
    const value = readPath(source, alias);
    const parsed = toNumber(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const resolveSexo = (...values) => {
  for (const value of values) {
    const token = String(value || '').trim().toLowerCase();
    if (!token) continue;
    if (token.includes('fem') || token === 'f') return 'feminino';
    if (token.includes('masc') || token === 'm') return 'masculino';
  }
  return '';
};

const classifyDE = (de) => {
  if (!Number.isFinite(de)) return '';
  if (de >= 45) return 'otima';
  if (de >= 30) return 'risco_relativo';
  return 'reds_estabelecido';
};

const normalizeQuestionnaireSnapshot = (sourceValue, questions) => {
  const base = createQuestionnaireState(questions);
  if (!sourceValue) return base;

  if (Array.isArray(sourceValue)) {
    const next = { ...base };
    questions.forEach((question, index) => {
      const value = sourceValue[index];
      if (typeof value === 'boolean') next[question.key] = value;
    });
    return next;
  }

  if (typeof sourceValue === 'object') {
    const next = { ...base };
    questions.forEach((question) => {
      if (Object.prototype.hasOwnProperty.call(sourceValue, question.key)) {
        next[question.key] = sourceValue[question.key] === null
          ? null
          : Boolean(sourceValue[question.key]);
      }
    });
    return next;
  }

  return base;
};

const AvaliacaoTriagemREDS = ({
  pacienteId,
  onSalvar,
  onAutoSave,
  readOnly = false,
  patient,
  onboardingContext,
  moduleSnapshot,
  currentSessionId
}) => {
  const [dataAvaliacao, setDataAvaliacao] = useState(() => toLocalDateInputValue(new Date()));
  const [ingestaoManual, setIngestaoManual] = useState('');
  const [gastoManual, setGastoManual] = useState('');
  const [massaMagraManual, setMassaMagraManual] = useState('');
  const [historicoAmenorreia, setHistoricoAmenorreia] = useState(false);
  const [historicoFraturaEstresse, setHistoricoFraturaEstresse] = useState(false);
  const [pressaoParaRestricao, setPressaoParaRestricao] = useState(false);
  const [sintomas, setSintomas] = useState([]);
  const [leafAnswers, setLeafAnswers] = useState(() => createQuestionnaireState(LEAF_Q_QUESTIONS));
  const [leaAnswers, setLeaAnswers] = useState(() => createQuestionnaireState(LEA_Q13_QUESTIONS));
  const [error, setError] = useState('');
  const [saveStatus, setSaveStatus] = useState(null);

  const saveStatusResetRef = useRef(null);
  const autoSaveRef = useRef(null);
  const loadedSnapshotIdRef = useRef('');

  const sexoBiologico = useMemo(() => resolveSexo(
    moduleSnapshot?.dados?.sexoBiologico,
    moduleSnapshot?.dados?.sexo,
    patient?.sexoBiologico,
    patient?.sexo,
    onboardingContext?.sexoBiologico
  ), [
    moduleSnapshot?.dados?.sexo,
    moduleSnapshot?.dados?.sexoBiologico,
    onboardingContext?.sexoBiologico,
    patient?.sexo,
    patient?.sexoBiologico
  ]);

  const isFemale = sexoBiologico === 'feminino';
  const isMale = sexoBiologico === 'masculino';

  const ingestaoKcalResolvida = toNumber(ingestaoManual);
  const gastoExercicioResolvido = toNumber(gastoManual);
  const massaMagraResolvida = toNumber(massaMagraManual);
  const precisaDadosExtras = useMemo(() => ([
    !Number.isFinite(ingestaoKcalResolvida) ? 'ingestaoKcalR24h' : null,
    !Number.isFinite(gastoExercicioResolvido) ? 'gastoExercicioKcal' : null,
    !Number.isFinite(massaMagraResolvida) || massaMagraResolvida <= 0 ? 'massaMagraKg' : null
  ].filter(Boolean)), [ingestaoKcalResolvida, gastoExercicioResolvido, massaMagraResolvida]);

  const disponibilidadeEnergetica = useMemo(() => {
    if (!Number.isFinite(ingestaoKcalResolvida)) return null;
    if (!Number.isFinite(gastoExercicioResolvido)) return null;
    if (!Number.isFinite(massaMagraResolvida) || massaMagraResolvida <= 0) return null;
    const value = (ingestaoKcalResolvida - gastoExercicioResolvido) / massaMagraResolvida;
    return Number.isFinite(value) ? Number(value.toFixed(2)) : null;
  }, [gastoExercicioResolvido, ingestaoKcalResolvida, massaMagraResolvida]);

  const classificacaoDE = useMemo(
    () => classifyDE(disponibilidadeEnergetica),
    [disponibilidadeEnergetica]
  );

  const scoreLeafQ = useMemo(() => {
    if (isFemale) return scoreQuestionnaire(leafAnswers);
    if (isMale) return scoreQuestionnaire(leaAnswers);
    return null;
  }, [isFemale, isMale, leafAnswers, leaAnswers]);

  const scoreLeaQ13 = useMemo(
    () => (isMale ? scoreQuestionnaire(leaAnswers) : null),
    [isMale, leaAnswers]
  );

  const hasLeafAlert = isFemale && Number.isFinite(scoreLeafQ) && scoreLeafQ >= 8;
  const questionnaireStats = useMemo(() => {
    const questions = isFemale ? LEAF_Q_QUESTIONS : isMale ? LEA_Q13_QUESTIONS : [];
    const answers = isFemale ? leafAnswers : isMale ? leaAnswers : {};
    const answered = questions.filter((item) => answers[item.key] !== null).length;
    return {
      answered,
      total: questions.length,
      complete: questions.length > 0 && answered === questions.length
    };
  }, [isFemale, isMale, leaAnswers, leafAnswers]);
  const onboardingResumo = useMemo(() => ({
    modalidadePrincipal: String(onboardingContext?.modalidadePrincipal || '').trim(),
    frequenciaSemanal: toNumber(onboardingContext?.frequenciaSemanal),
    duracaoSessao: toNumber(onboardingContext?.duracaoSessao),
    genero: String(onboardingContext?.genero || '').trim()
  }), [
    onboardingContext?.duracaoSessao,
    onboardingContext?.frequenciaSemanal,
    onboardingContext?.genero,
    onboardingContext?.modalidadePrincipal
  ]);

  const recomendacaoConduta = useMemo(() => {
    if (classificacaoDE === 'reds_estabelecido') {
      return {
        tone: 'risk',
        title: 'Conduta com alto risco funcional',
        message: 'Evite plano hipocalorico antes de corrigir disponibilidade energetica e sinais de risco.'
      };
    }
    if (classificacaoDE === 'risco_relativo') {
      return {
        tone: 'warn',
        title: 'Conduta com monitoramento reforcado',
        message: 'Ajuste ingestao e acompanhe sintomas antes de progressao de carga.'
      };
    }
    if (classificacaoDE === 'otima') {
      return {
        tone: 'ok',
        title: 'Conduta energetica favoravel',
        message: 'Disponibilidade energetica adequada para suportar plano e periodizacao.'
      };
    }
    return {
      tone: 'warn',
      title: 'Conduta com dados incompletos',
      message: 'Complete os dados faltantes para classificar a disponibilidade energética com segurança.'
    };
  }, [classificacaoDE]);

  const readinessItems = useMemo(() => {
    const baseInputsCount = 3 - precisaDadosExtras.length;
    const classificationStatus = classificacaoDE === 'reds_estabelecido'
      ? 'danger'
      : classificacaoDE === 'risco_relativo'
        ? 'warning'
        : classificacaoDE === 'otima'
          ? 'ok'
          : 'pending';

    return [
      {
        key: 'base-inputs',
        label: 'Base energetica',
        status: baseInputsCount === 3 ? 'ok' : baseInputsCount > 0 ? 'warning' : 'pending',
        value: `${baseInputsCount}/3 campos`
      },
      {
        key: 'questionnaire',
        label: isFemale ? 'LEAF-Q' : isMale ? 'LEA-Q13' : 'Questionario',
        status: questionnaireStats.complete ? 'ok' : 'pending',
        value: questionnaireStats.total ? `${questionnaireStats.answered}/${questionnaireStats.total}` : 'sexo pendente'
      },
      {
        key: 'de',
        label: 'Disponibilidade energetica',
        status: Number.isFinite(disponibilidadeEnergetica) ? classificationStatus : 'pending',
        value: Number.isFinite(disponibilidadeEnergetica) ? disponibilidadeEnergetica.toFixed(2) : 'nao calculada'
      },
      {
        key: 'classification',
        label: 'Classificacao',
        status: classificationStatus,
        value: ROTULO_CURTO_CLASSIFICACAO_DE[classificacaoDE] || 'pendente'
      }
    ];
  }, [
    classificacaoDE,
    disponibilidadeEnergetica,
    isFemale,
    isMale,
    precisaDadosExtras.length,
    questionnaireStats.answered,
    questionnaireStats.complete,
    questionnaireStats.total
  ]);

  const payload = useMemo(() => ({
    tipo: 'triagem_reds',
    pacienteId,
    data: dataAvaliacao,
    schemaVersion: 1,
    formulaId: 'DE',
    formulaVersion: '1.0.0',
    dados: {
      dataAvaliacao,
      sexoBiologico: sexoBiologico || null,
      ingestaoKcalR24hManual: toNumber(ingestaoManual),
      gastoExercicioKcalManual: toNumber(gastoManual),
      massaMagraKgManual: toNumber(massaMagraManual),
      ingestaoKcalR24h: Number.isFinite(ingestaoKcalResolvida) ? Number(ingestaoKcalResolvida.toFixed(2)) : null,
      gastoExercicioKcal: Number.isFinite(gastoExercicioResolvido) ? Number(gastoExercicioResolvido.toFixed(2)) : null,
      massaMagraKg: Number.isFinite(massaMagraResolvida) ? Number(massaMagraResolvida.toFixed(2)) : null,
      disponibilidadeEnergetica,
      scoreLeafQ: Number.isFinite(scoreLeafQ) ? scoreLeafQ : null,
      scoreLeaQ13: Number.isFinite(scoreLeaQ13) ? scoreLeaQ13 : null,
      leafQRespostas: leafAnswers,
      leaQ13Respostas: leaAnswers,
      historicoAmenorreia,
      historicoFraturaEstresse,
      pressaoParaRestricao,
      sintomas,
      precisaDadosExtras
    },
    resultados: {
      DE: disponibilidadeEnergetica,
      disponibilidadeEnergetica,
      classificacaoDE: classificacaoDE || null,
      scoreLeafQ: Number.isFinite(scoreLeafQ) ? scoreLeafQ : null,
      scoreLeaQ13: Number.isFinite(scoreLeaQ13) ? scoreLeaQ13 : null,
      precisaDadosExtras,
      calculated: {
        DE: disponibilidadeEnergetica,
        classificacaoDE: classificacaoDE || null,
        scoreLeafQ: Number.isFinite(scoreLeafQ) ? scoreLeafQ : null,
        scoreLeaQ13: Number.isFinite(scoreLeaQ13) ? scoreLeaQ13 : null,
        precisaDadosExtras
      },
      output: {
        classificacaoDE: classificacaoDE || null,
        precisaDadosExtras
      }
    },
    classificacao: classificacaoDE || undefined,
    classificacaoLabel: ROTULO_CLASSIFICACAO_DE[classificacaoDE] || undefined,
    sessaoId: moduleSnapshot?.sessaoId || currentSessionId
  }), [
    classificacaoDE,
    currentSessionId,
    dataAvaliacao,
    disponibilidadeEnergetica,
    gastoExercicioResolvido,
    gastoManual,
    historicoAmenorreia,
    historicoFraturaEstresse,
    ingestaoKcalResolvida,
    ingestaoManual,
    leaAnswers,
    leafAnswers,
    massaMagraManual,
    massaMagraResolvida,
    moduleSnapshot?.sessaoId,
    pacienteId,
    precisaDadosExtras,
    pressaoParaRestricao,
    scoreLeafQ,
    scoreLeaQ13,
    sexoBiologico,
    sintomas
  ]);

  const hasInput = useMemo(() => (
    Number.isFinite(ingestaoKcalResolvida)
    || Number.isFinite(gastoExercicioResolvido)
    || Number.isFinite(massaMagraResolvida)
    || sintomas.length > 0
    || historicoAmenorreia
    || historicoFraturaEstresse
    || pressaoParaRestricao
    || Object.values(leafAnswers).some((value) => value !== null)
    || Object.values(leaAnswers).some((value) => value !== null)
  ), [
    gastoExercicioResolvido,
    historicoAmenorreia,
    historicoFraturaEstresse,
    ingestaoKcalResolvida,
    leaAnswers,
    leafAnswers,
    massaMagraResolvida,
    pressaoParaRestricao,
    sintomas.length
  ]);

  useEffect(() => () => {
    clearTimeout(autoSaveRef.current);
    if (saveStatusResetRef.current) clearTimeout(saveStatusResetRef.current);
  }, []);

  useEffect(() => {
    const snapshotId = moduleSnapshot?.id || '';
    if (loadedSnapshotIdRef.current === snapshotId) return;
    if (!snapshotId) {
      setDataAvaliacao(toLocalDateInputValue(new Date()));
      setIngestaoManual('');
      setGastoManual('');
      setMassaMagraManual('');
      setHistoricoAmenorreia(false);
      setHistoricoFraturaEstresse(false);
      setPressaoParaRestricao(false);
      setSintomas([]);
      setLeafAnswers(createQuestionnaireState(LEAF_Q_QUESTIONS));
      setLeaAnswers(createQuestionnaireState(LEA_Q13_QUESTIONS));
      loadedSnapshotIdRef.current = '';
      return;
    }
    const source = moduleSnapshot?.dados || {};

    setDataAvaliacao(normalizeDateValue(firstDefined(
      moduleSnapshot?.data,
      source?.dataAvaliacao
    )));
    // O registro antigo pode guardar apenas campos *Auto. Eles são lidos
    // como valor histórico inicial, nunca atualizados por outra avaliação.
    setIngestaoManual(toInput(readNumberByAliases(moduleSnapshot, [
      'dados.ingestaoKcalR24h', 'dados.ingestaoKcalR24hManual',
      'dados.ingestaoKcalR24hFallback', 'dados.ingestaoManualKcal',
      'dados.ingestaoKcalR24hAuto', 'resultados.calculated.ingestaoKcalR24hAuto'
    ])));
    setGastoManual(toInput(readNumberByAliases(moduleSnapshot, [
      'dados.gastoExercicioKcal', 'dados.gastoExercicioKcalManual',
      'dados.gastoManualKcal', 'dados.gastoExercicioDiarioManual',
      'dados.gastoExercicioKcalAuto', 'resultados.calculated.gastoExercicioKcalAuto'
    ])));
    setMassaMagraManual(toInput(readNumberByAliases(moduleSnapshot, [
      'dados.massaMagraKg', 'dados.massaMagraKgManual',
      'dados.massaMagraFallback', 'dados.massaMagraManual',
      'dados.massaMagraKgAuto', 'resultados.calculated.massaMagraKgAuto'
    ])));
    setHistoricoAmenorreia(toBool(source?.historicoAmenorreia));
    setHistoricoFraturaEstresse(toBool(source?.historicoFraturaEstresse));
    setPressaoParaRestricao(toBool(source?.pressaoParaRestricao));
    setSintomas(Array.isArray(source?.sintomas) ? source.sintomas.filter(Boolean) : []);
    setLeafAnswers(normalizeQuestionnaireSnapshot(source?.leafQRespostas, LEAF_Q_QUESTIONS));
    setLeaAnswers(normalizeQuestionnaireSnapshot(source?.leaQ13Respostas, LEA_Q13_QUESTIONS));

    loadedSnapshotIdRef.current = snapshotId;
  }, [moduleSnapshot]);

  const validateBeforeSave = useCallback(() => {
    if (!hasInput) {
      return 'Preencha ao menos um campo para salvar a triagem de disponibilidade energética.';
    }
    return '';
  }, [hasInput]);

  const dispatchSalvar = useCallback(async (auto = false) => {
    const dispatch = auto ? onAutoSave : onSalvar;
    if (!dispatch) return;

    if (!auto) {
      const validationError = validateBeforeSave();
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    setError('');
    setSaveStatus('saving');
    if (saveStatusResetRef.current) clearTimeout(saveStatusResetRef.current);
    try {
      await Promise.resolve(dispatch(payload));
      setSaveStatus('saved');
      saveStatusResetRef.current = setTimeout(() => setSaveStatus(null), 3200);
    } catch {
      if (!auto) setError('Não foi possível salvar a triagem de disponibilidade energética.');
      setSaveStatus('error');
    }
  }, [onAutoSave, onSalvar, payload, validateBeforeSave]);

  useEffect(() => {
    if (readOnly || !onAutoSave || !hasInput) return undefined;
    clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => {
      dispatchSalvar(true);
    }, 3500);
    return () => clearTimeout(autoSaveRef.current);
  }, [dispatchSalvar, hasInput, onAutoSave, readOnly]);

  const toggleSintoma = (value) => {
    setSintomas((prev) => (
      prev.includes(value)
        ? prev.filter((item) => item !== value)
        : [...prev, value]
    ));
  };

  // Cada pergunta é um grupo (fieldset/legend) com as mesmas duas opções.
  const renderQuestionnaire = (questions, answers, onChange) => (
    <div className="triagem-reds-questionnaire">
      {questions.map((item) => (
        <GrupoOpcoes key={item.key} legenda={item.label} horizontal className="triagem-reds-question">
          <Opcao
            rotulo="Sim"
            name={item.key}
            checked={answers[item.key] === true}
            onChange={() => onChange(item.key, true)}
            disabled={readOnly}
          />
          <Opcao
            rotulo="Nao"
            name={item.key}
            checked={answers[item.key] === false}
            onChange={() => onChange(item.key, false)}
            disabled={readOnly}
          />
        </GrupoOpcoes>
      ))}
    </div>
  );

  // O título do questionário depende do sexo de referência, como antes.
  const tituloQuestionario = isFemale ? 'LEAF-Q (mulheres)' : isMale ? 'LEA-Q13 (homens)' : 'Questionario de risco';
  const indiceReds = [
    { id: 'reds-dados', titulo: 'Dados desta triagem' },
    { id: 'reds-resultado', titulo: 'Resultado DE' },
    { id: 'reds-questionario', titulo: tituloQuestionario },
    { id: 'reds-sinais', titulo: 'Sinais adicionais de risco' }
  ];

  // O cabeçalho do cartão antigo virou o do módulo (mesmo h3 e subtítulo);
  // a data e o sexo de referência passaram para "Dados desta triagem".
  return (
    <AvaliacaoModulo
      className={`triagem-reds${readOnly ? ' eval-card--readonly' : ''}`}
      titulo="Triagem de Disponibilidade Energetica"
      descricao="Disponibilidade energetica (DE) com suporte a LEAF-Q / LEA-Q13"
      icone={<Activity size={22} />}
    >
      <AvaliacaoIndice itens={indiceReds} />

      <AvisoAvaliacao tipo="info" className="triagem-reds__context-note">
        <strong>Contexto esportivo:</strong>
        {' '}
        {onboardingResumo.modalidadePrincipal || 'modalidade nao informada'}
        {' | '}
        Frequencia: {Number.isFinite(onboardingResumo.frequenciaSemanal) ? `${onboardingResumo.frequenciaSemanal}x/sem` : 'nao informada'}
        {' | '}
        Duracao: {Number.isFinite(onboardingResumo.duracaoSessao) ? `${onboardingResumo.duracaoSessao} min` : 'nao informada'}
        {onboardingResumo.genero ? ` | Genero: ${onboardingResumo.genero}` : ''}
      </AvisoAvaliacao>

      <EvaluationReadiness items={readinessItems} />

      <AvaliacaoSecao id="reds-dados" titulo="Dados desta triagem">
        <div className="triagem-reds__date-row">
          <Campo rotulo="Data da triagem" className="eval-field triagem-reds__date-field">
            <input
              type="date"
              className="eval-input"
              value={dataAvaliacao}
              onChange={(event) => setDataAvaliacao(event.target.value)}
              disabled={readOnly}
            />
          </Campo>
          <div className="triagem-reds__sex-chip">
            Sexo biologico de referencia: <strong>{sexoBiologico || 'nao informado'}</strong>
          </div>
        </div>
        <p className="eval-hint">Informe os valores usados no cálculo de disponibilidade energética. Revise valores recuperados de registros antigos.</p>
        <div className="av-grade">
          <Campo rotulo="Ingestão energética (kcal/dia)">
            <input
              type="number"
              min="0"
              step="0.1"
              className="eval-input"
              value={ingestaoManual}
              onChange={(event) => setIngestaoManual(event.target.value)}
              disabled={readOnly}
              placeholder="Ex.: 2200"
            />
          </Campo>
          <Campo rotulo="Gasto de exercício (kcal/dia)">
            <input
              type="number"
              min="0"
              step="0.1"
              className="eval-input"
              value={gastoManual}
              onChange={(event) => setGastoManual(event.target.value)}
              disabled={readOnly}
              placeholder="Ex.: 850"
            />
          </Campo>
          <Campo rotulo="Massa magra (kg)">
            <input
              type="number"
              min="0.1"
              step="0.1"
              className="eval-input"
              value={massaMagraManual}
              onChange={(event) => setMassaMagraManual(event.target.value)}
              disabled={readOnly}
              placeholder="Ex.: 52"
            />
          </Campo>
        </div>
        {precisaDadosExtras.length > 0 && (
          <AvisoAvaliacao tipo="atencao" anunciar className="triagem-reds__missing">
            <p>Para calcular, informe: <strong>{precisaDadosExtras.map((field) => ({
              ingestaoKcalR24h: 'ingestão energética',
              gastoExercicioKcal: 'gasto de exercício',
              massaMagraKg: 'massa magra positiva'
            }[field])).join(', ')}</strong>.</p>
          </AvisoAvaliacao>
        )}
      </AvaliacaoSecao>

      {/* Mesmos valores e textos de ausência de antes. A faixa de risco da
          DE vai escrita no selo do resultado (tom de atenção em DE
          reduzida e de perigo em DE baixa); a conduta, que já
          acompanhava o resultado, entra na mesma seção com o mesmo tom. */}
      <AvaliacaoSecao id="reds-resultado" titulo="Resultado DE">
        <div className="av-resultados">
          <ResultadoCalculado
            rotulo="Disponibilidade Energetica (kcal/kg MLG)"
            valor={Number.isFinite(disponibilidadeEnergetica) ? disponibilidadeEnergetica.toFixed(2) : null}
            semValor="Dados insuficientes"
            classificacao={ROTULO_CURTO_CLASSIFICACAO_DE[classificacaoDE] || null}
            tom={recomendacaoConduta.tone}
          />
          <ResultadoCalculado
            className={`triagem-reds__resultado--texto triagem-reds__badge--${classificacaoDE || 'na'}`}
            rotulo="Classificacao"
            valor={ROTULO_CLASSIFICACAO_DE[classificacaoDE] || null}
            semValor="nao calculada"
          />
          <ResultadoCalculado
            rotulo="Score principal"
            valor={Number.isFinite(scoreLeafQ) ? scoreLeafQ : null}
            semValor="Nao calculado"
          />
        </div>

        <AvisoAvaliacao
          tipo={TIPO_AVISO_CONDUTA[recomendacaoConduta.tone] || 'info'}
          titulo={recomendacaoConduta.title}
          className={`triagem-reds__conduta-note triagem-reds__conduta-note--${recomendacaoConduta.tone}`}
        >
          <p>{recomendacaoConduta.message}</p>
          <small>
            Classificacao DE: {ROTULO_CURTO_CLASSIFICACAO_DE[classificacaoDE] || 'nao calculada'}
            {' | '}
            Score principal: {Number.isFinite(scoreLeafQ) ? scoreLeafQ : 'nao calculado'}
            {' | '}
            Plano alimentar: {classificacaoDE === 'reds_estabelecido' ? 'requer override justificado' : 'pode prosseguir com criterio clinico'}
          </small>
        </AvisoAvaliacao>
      </AvaliacaoSecao>

      {/* Um só questionário aparece, pelo sexo de referência (mesmas
          condições de antes); as três versões usam o mesmo id do índice. */}
      {isFemale && (
        <AvaliacaoSecao id="reds-questionario" titulo="LEAF-Q (mulheres)" className="triagem-reds__questionnaire-card">
          {renderQuestionnaire(LEAF_Q_QUESTIONS, leafAnswers, (key, value) => {
            setLeafAnswers((prev) => ({ ...prev, [key]: value }));
          })}
          <p className="triagem-reds__score-line">
            Score LEAF-Q: <strong>{scoreQuestionnaire(leafAnswers)}</strong>
          </p>
          {hasLeafAlert && (
            <AvisoAvaliacao tipo="atencao" className="triagem-reds__leaf-alert">
              <p>
                Risco elevado de baixa disponibilidade energética (sensibilidade 78%, especificidade 90%) — Melin et al. 2014
              </p>
            </AvisoAvaliacao>
          )}
        </AvaliacaoSecao>
      )}

      {isMale && (
        <AvaliacaoSecao id="reds-questionario" titulo="LEA-Q13 (homens)" className="triagem-reds__questionnaire-card">
          {renderQuestionnaire(LEA_Q13_QUESTIONS, leaAnswers, (key, value) => {
            setLeaAnswers((prev) => ({ ...prev, [key]: value }));
          })}
          <p className="triagem-reds__score-line">
            Score LEA-Q13: <strong>{scoreQuestionnaire(leaAnswers)}</strong>
          </p>
        </AvaliacaoSecao>
      )}

      {!isFemale && !isMale && (
        <AvaliacaoSecao id="reds-questionario" titulo="Questionario de risco" className="triagem-reds__questionnaire-card">
          <p className="triagem-reds__questionnaire-empty">Sexo biologico nao identificado. Defina no prontuario para habilitar LEAF-Q ou LEA-Q13.</p>
        </AvaliacaoSecao>
      )}

      {/* As caixas continuam soltas, sem legenda própria: o grupo é
          rotulado pelo título da seção. */}
      <AvaliacaoSecao id="reds-sinais" titulo="Sinais adicionais de risco">
        <div className="triagem-reds__risk" role="group" aria-labelledby="reds-sinais-titulo">
          <div className="triagem-reds__risk-grid">
            <Opcao
              tipo="checkbox"
              rotulo="Historico de amenorreia"
              checked={historicoAmenorreia}
              onChange={(event) => setHistoricoAmenorreia(event.target.checked)}
              disabled={readOnly}
            />
            <Opcao
              tipo="checkbox"
              rotulo="Historico de fratura por estresse"
              checked={historicoFraturaEstresse}
              onChange={(event) => setHistoricoFraturaEstresse(event.target.checked)}
              disabled={readOnly}
            />
            <Opcao
              tipo="checkbox"
              rotulo="Pressao para restricao alimentar"
              checked={pressaoParaRestricao}
              onChange={(event) => setPressaoParaRestricao(event.target.checked)}
              disabled={readOnly}
            />
          </div>
          <div className="triagem-reds__symptoms">
            {SINTOMAS_OPTIONS.map((item) => (
              <Opcao
                key={item.value}
                tipo="checkbox"
                rotulo={item.label}
                checked={sintomas.includes(item.value)}
                onChange={() => toggleSintoma(item.value)}
                disabled={readOnly}
              />
            ))}
          </div>
        </div>
      </AvaliacaoSecao>

      {error && (
        <AvisoAvaliacao tipo="perigo" anunciar className="triagem-reds__error">{error}</AvisoAvaliacao>
      )}

      <BarraAcoesAvaliacao
        className="triagem-reds__actions"
        status={saveStatus}
        textosStatus={{ saved: 'Salvo com sucesso.', error: 'Falha ao salvar.' }}
      >
        <Button
          variant="primary"
          onClick={() => dispatchSalvar(false)}
          disabled={readOnly}
        >
          <Save size={16} />
          Salvar disponibilidade energética
        </Button>
      </BarraAcoesAvaliacao>
    </AvaliacaoModulo>
  );
};

export default AvaliacaoTriagemREDS;
