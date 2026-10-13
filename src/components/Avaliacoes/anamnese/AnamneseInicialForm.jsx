import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ClipboardList, Plus, Trash2 } from 'lucide-react';
import { Button } from '../../ui';
import { toLocalDateInputValue } from '../../../utils/dateUtils';
import { calculateAnamneseInitialEvaluation } from '../../../services/calculationEngine';
import '../avaliacoes.css';
import {
  AvaliacaoModulo,
  AvaliacaoSecao,
  Campo,
  GrupoOpcoes,
  Opcao,
  ResultadoCalculado,
  AvisoAvaliacao,
  BarraAcoesAvaliacao
} from '../base';
import './AnamneseInicialForm.css';

// Gravidade das flags de risco no aviso da base: além da cor, o ícone muda
// de forma e o leitor de tela ouve "Alerta:" ou "Atenção:". Só apresentação;
// as flags e a gravidade vêm do motor de regras, como antes.
const FLAG_TIPO_AVISO = { danger: 'perigo', warning: 'atencao' };

const GOAL_OPTIONS = [
  { value: 'emagrecimento', label: 'Emagrecimento' },
  { value: 'hipertrofia', label: 'Hipertrofia' },
  { value: 'saude_geral', label: 'Saúde geral' },
  { value: 'performance', label: 'Performance' },
  { value: 'reabilitacao', label: 'Reabilitação' },
  { value: 'gestacao', label: 'Gestação' },
  { value: 'outros', label: 'Outros' }
];

const PATHOLOGY_OPTIONS = [
  'Diabetes',
  'Hipertensão',
  'Dislipidemia',
  'Doença renal',
  'Doença hepática',
  'Hipotireoidismo',
  'Hipertireoidismo',
  'Síndrome dos ovários policísticos',
  'Doença cardiovascular',
  'Transtorno alimentar'
];

const SPORT_MODALITY_OPTIONS = [
  { value: '', label: 'Selecione' },
  { value: 'futebol', label: 'Futebol' },
  { value: 'futsal', label: 'Futsal' },
  { value: 'natacao', label: 'Natação' },
  { value: 'musculacao', label: 'Musculação' },
  { value: 'corrida', label: 'Corrida' },
  { value: 'ciclismo', label: 'Ciclismo' },
  { value: 'volei', label: 'Vôlei' },
  { value: 'basquete', label: 'Basquete' },
  { value: 'handebol', label: 'Handebol' },
  { value: 'tenis', label: 'Tênis' },
  { value: 'luta', label: 'Luta/Combate' },
  { value: 'atletismo', label: 'Atletismo' },
  { value: 'remo', label: 'Remo' },
  { value: 'triatlo', label: 'Triatlo' },
  { value: 'outro', label: 'Outro' }
];

const TAB_ITEMS = [
  { id: 'identificacao', label: 'Identificação e objetivo' },
  { id: 'historico', label: 'Histórico clínico' },
  { id: 'estilo', label: 'Estilo de vida' },
  { id: 'familiar', label: 'Histórico familiar' }
];

const createLesaoItem = () => ({
  id: createId(),
  local: '',
  tempoAfastado: ''
});

const createCompeticaoItem = () => ({
  id: createId(),
  nome: '',
  data: ''
});

const createEsportivoData = () => ({
  modalidade: '',
  posicao: '',
  provas: '',
  nivel: '',
  clube: '',
  cargaSemanal: {
    tecnico: '',
    tatico: '',
    fisico: '',
    preventivo: ''
  },
  fasePeriodizacao: '',
  historicoLesoes: [createLesaoItem()],
  proximasCompeticoes: [createCompeticaoItem()],
  historicaREDS: false
});

const createInitialData = () => ({
  dataAvaliacao: toLocalDateInputValue(new Date()),
  nomePaciente: '',
  dataNascimento: '',
  sexoBiologico: '',
  identidadeGenero: '',
  objetivos: [],
  objetivoOutros: '',
  queixaPrincipal: '',
  patologias: [],
  patologiasOutras: '',
  medicamentos: [{ id: createId(), nome: '', dose: '', frequencia: '' }],
  suplementos: [{ id: createId(), nome: '', dose: '', frequencia: '' }],
  alergias: '',
  cirurgias: '',
  atividadeTipo: '',
  atividadeFrequencia: '',
  atividadeDuracao: '',
  sonoHoras: '',
  sonoQualidade: '3',
  estresseNivel: '5',
  alcoolUso: 'nao_informado',
  tabacoUso: 'nao_informado',
  cicloMenstrualRegularidade: 'nao_informado',
  cicloMenstrualContraceptivo: 'nao_informado',
  familyCardiovascular: false,
  familyDiabetes: false,
  familyCancer: false,
  familyObesity: false,
  esportivo: createEsportivoData(),
  observacoes: ''
});

const AnamneseInicialForm = ({
  pacienteId,
  onSalvar,
  onAutoSave,
  readOnly = false,
  patient,
  onboardingContext,
  moduleSnapshot,
  currentSessionId
}) => {
  const [activeTab, setActiveTab] = useState(TAB_ITEMS[0].id);
  const [dados, setDados] = useState(createInitialData);
  const [error, setError] = useState('');
  const [saveStatus, setSaveStatus] = useState(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [hasUserInput, setHasUserInput] = useState(false);
  const loadedSnapshotIdRef = useRef(null);
  const loadedOnboardingPrefillRef = useRef(null);
  const autoSaveRef = useRef(null);
  const saveStatusResetRef = useRef(null);

  useEffect(() => () => {
    clearTimeout(autoSaveRef.current);
    if (saveStatusResetRef.current) clearTimeout(saveStatusResetRef.current);
  }, []);

  useEffect(() => {
    setSaveStatus(null);
    if (saveStatusResetRef.current) clearTimeout(saveStatusResetRef.current);
  }, [pacienteId]);

  useEffect(() => {
    const snapshotId = moduleSnapshot?.id || '__empty__';
    if (loadedSnapshotIdRef.current === snapshotId) return;

    const source = moduleSnapshot?.dados || {};
    const dadosBrutos = source?.dados_brutos || source?.input || source;
    const meds = Array.isArray(dadosBrutos?.medicamentos) ? dadosBrutos.medicamentos : [];
    const sups = Array.isArray(dadosBrutos?.suplementos) ? dadosBrutos.suplementos : [];
    const esportivoRaw = asRecord(firstDefined(dadosBrutos?.esportivo, source?.esportivo));
    const cargaRaw = asRecord(firstDefined(esportivoRaw?.cargaSemanal, esportivoRaw?.carga_semanal));
    const historicoLesoesRaw = normalizeObjectArray(firstDefined(
      esportivoRaw?.historicoLesoes,
      esportivoRaw?.historico_lesoes
    ));
    const proximasCompeticoesRaw = normalizeObjectArray(firstDefined(
      esportivoRaw?.proximasCompeticoes,
      esportivoRaw?.proximas_competicoes
    ));

    setDados((prev) => ({
      ...prev,
      dataAvaliacao: normalizeDate(firstDefined(moduleSnapshot?.data, source?.dataAvaliacao, dadosBrutos?.dataAvaliacao, prev.dataAvaliacao)),
      nomePaciente: toText(firstDefined(dadosBrutos?.nomePaciente, source?.nomePaciente, patient?.nome)),
      dataNascimento: toText(firstDefined(dadosBrutos?.dataNascimento, source?.dataNascimento, patient?.dataNascimento)),
      sexoBiologico: toText(firstDefined(dadosBrutos?.sexoBiologico, source?.sexoBiologico, patient?.sexoBiologico, patient?.sexo)),
      identidadeGenero: toText(firstDefined(dadosBrutos?.identidadeGenero, source?.identidadeGenero)),
      objetivos: normalizeArray(firstDefined(dadosBrutos?.objetivos, source?.objetivos)),
      objetivoOutros: toText(firstDefined(dadosBrutos?.objetivoOutros, source?.objetivoOutros)),
      queixaPrincipal: toText(firstDefined(dadosBrutos?.queixaPrincipal, source?.queixaPrincipal)),
      patologias: normalizeArray(firstDefined(dadosBrutos?.patologias, source?.patologias)),
      patologiasOutras: toText(firstDefined(dadosBrutos?.patologiasOutras, source?.patologiasOutras)),
      medicamentos: meds.length
        ? meds.map((item) => ({
          id: createId(),
          nome: toText(item?.nome || item?.name),
          dose: toText(item?.dose),
          frequencia: toText(item?.frequencia || item?.frequency)
        }))
        : [{ id: createId(), nome: '', dose: '', frequencia: '' }],
      suplementos: sups.length
        ? sups.map((item) => ({
          id: createId(),
          nome: toText(item?.nome || item?.name),
          dose: toText(item?.dose),
          frequencia: toText(item?.frequencia || item?.frequency)
        }))
        : [{ id: createId(), nome: '', dose: '', frequencia: '' }],
      alergias: toText(firstDefined(dadosBrutos?.alergias, source?.alergias)),
      cirurgias: toText(firstDefined(dadosBrutos?.cirurgias, source?.cirurgias)),
      atividadeTipo: toText(firstDefined(dadosBrutos?.atividadeTipo, source?.atividadeTipo)),
      atividadeFrequencia: toInput(firstDefined(dadosBrutos?.atividadeFrequencia, source?.atividadeFrequencia), 0),
      atividadeDuracao: toInput(firstDefined(dadosBrutos?.atividadeDuracao, source?.atividadeDuracao), 0),
      sonoHoras: toInput(firstDefined(dadosBrutos?.sonoHoras, source?.sonoHoras), 1),
      sonoQualidade: String(firstDefined(dadosBrutos?.sonoQualidade, source?.sonoQualidade, '3')),
      estresseNivel: String(firstDefined(dadosBrutos?.estresseNivel, source?.estresseNivel, '5')),
      alcoolUso: toText(firstDefined(dadosBrutos?.alcoolUso, source?.alcoolUso, 'nao_informado')) || 'nao_informado',
      tabacoUso: toText(firstDefined(dadosBrutos?.tabacoUso, source?.tabacoUso, 'nao_informado')) || 'nao_informado',
      cicloMenstrualRegularidade: toText(firstDefined(dadosBrutos?.cicloMenstrualRegularidade, source?.cicloMenstrualRegularidade, 'nao_informado')) || 'nao_informado',
      cicloMenstrualContraceptivo: toText(firstDefined(dadosBrutos?.cicloMenstrualContraceptivo, source?.cicloMenstrualContraceptivo, 'nao_informado')) || 'nao_informado',
      familyCardiovascular: normalizeBoolean(firstDefined(dadosBrutos?.familyCardiovascular, source?.familyCardiovascular)),
      familyDiabetes: normalizeBoolean(firstDefined(dadosBrutos?.familyDiabetes, source?.familyDiabetes)),
      familyCancer: normalizeBoolean(firstDefined(dadosBrutos?.familyCancer, source?.familyCancer)),
      familyObesity: normalizeBoolean(firstDefined(dadosBrutos?.familyObesity, source?.familyObesity)),
      esportivo: {
        modalidade: toText(firstDefined(esportivoRaw?.modalidade, prev?.esportivo?.modalidade)),
        posicao: toText(firstDefined(esportivoRaw?.posicao, prev?.esportivo?.posicao)),
        provas: toText(firstDefined(
          Array.isArray(esportivoRaw?.provas) ? esportivoRaw.provas.join(', ') : esportivoRaw?.provas,
          prev?.esportivo?.provas
        )),
        nivel: toText(firstDefined(esportivoRaw?.nivel, prev?.esportivo?.nivel)),
        clube: toText(firstDefined(esportivoRaw?.clube, prev?.esportivo?.clube)),
        cargaSemanal: {
          tecnico: toInput(firstDefined(cargaRaw?.tecnico, prev?.esportivo?.cargaSemanal?.tecnico), 1),
          tatico: toInput(firstDefined(cargaRaw?.tatico, prev?.esportivo?.cargaSemanal?.tatico), 1),
          fisico: toInput(firstDefined(cargaRaw?.fisico, prev?.esportivo?.cargaSemanal?.fisico), 1),
          preventivo: toInput(firstDefined(cargaRaw?.preventivo, prev?.esportivo?.cargaSemanal?.preventivo), 1)
        },
        fasePeriodizacao: toText(firstDefined(esportivoRaw?.fasePeriodizacao, esportivoRaw?.fase_periodizacao, prev?.esportivo?.fasePeriodizacao)),
        historicoLesoes: historicoLesoesRaw.length
          ? historicoLesoesRaw.map((item) => ({
            id: createId(),
            local: toText(firstDefined(item?.local, item?.regiao)),
            tempoAfastado: toText(firstDefined(item?.tempoAfastado, item?.tempo_afastado))
          }))
          : [createLesaoItem()],
        proximasCompeticoes: proximasCompeticoesRaw.length
          ? proximasCompeticoesRaw.map((item) => ({
            id: createId(),
            nome: toText(firstDefined(item?.nome, item?.competicao)),
            data: normalizeDateOptional(firstDefined(item?.data, item?.date))
          }))
          : [createCompeticaoItem()],
        historicaREDS: normalizeBoolean(firstDefined(esportivoRaw?.historicaREDS, esportivoRaw?.historica_reds))
      },
      observacoes: toText(firstDefined(dadosBrutos?.observacoes, source?.observacoes))
    }));

    loadedSnapshotIdRef.current = snapshotId;
  }, [moduleSnapshot, patient?.dataNascimento, patient?.nome, patient?.sexo, patient?.sexoBiologico]);

  useEffect(() => {
    if (hasUserInput) return;
    if (moduleSnapshot?.id) return;

    const contextKey = JSON.stringify({
      pacienteId,
      modalidade: onboardingContext?.modalidadePrincipal || '',
      frequencia: onboardingContext?.frequenciaSemanal || '',
      duracao: onboardingContext?.duracaoSessao || '',
      sexoBiologico: onboardingContext?.sexoBiologico || '',
      status: onboardingContext?.status || '',
      observacoesIniciais: onboardingContext?.observacoesIniciais || '',
      historicoSaude: onboardingContext?.historicoSaude || '',
      rawNivel: onboardingContext?.raw?.nivelCompetitivo || '',
      rawMotivo: onboardingContext?.raw?.motivoAtendimento || ''
    });

    if (loadedOnboardingPrefillRef.current === contextKey) return;

    const prefill = buildOnboardingPrefill(onboardingContext, patient);
    if (!prefill) {
      loadedOnboardingPrefillRef.current = contextKey;
      return;
    }

    setDados((prev) => applyOnboardingPrefill(prev, prefill));
    loadedOnboardingPrefillRef.current = contextKey;
  }, [hasUserInput, moduleSnapshot?.id, onboardingContext, pacienteId, patient]);

  const evaluation = useMemo(() => calculateAnamneseInitialEvaluation({
    goals: [...dados.objetivos, ...(dados.objetivoOutros ? [dados.objetivoOutros] : [])],
    pathologies: [...dados.patologias, ...(dados.patologiasOutras ? [dados.patologiasOutras] : [])],
    medications: dados.medicamentos.map((m) => ({ name: m.nome, dose: m.dose, frequency: m.frequencia })),
    allergies: dados.alergias,
    surgeries: dados.cirurgias,
    activityType: dados.atividadeTipo,
    activityFrequency: toNumber(dados.atividadeFrequencia),
    activityDuration: toNumber(dados.atividadeDuracao),
    sleepHours: toNumber(dados.sonoHoras),
    sleepQuality: toNumber(dados.sonoQualidade),
    stressLevel: toNumber(dados.estresseNivel),
    alcoholUse: dados.alcoolUso,
    tobaccoUse: dados.tabacoUso,
    menstrualRegularity: dados.cicloMenstrualRegularidade,
    familyCardiovascular: dados.familyCardiovascular,
    familyDiabetes: dados.familyDiabetes,
    familyCancer: dados.familyCancer,
    familyObesity: dados.familyObesity
  }), [dados]);

  const hasRequiredMissing = useMemo(() => {
    if (!toText(dados.nomePaciente)) return true;
    if (!toText(dados.sexoBiologico)) return true;
    if (!Array.isArray(dados.objetivos) || dados.objetivos.length === 0) return true;
    return false;
  }, [dados.nomePaciente, dados.objetivos, dados.sexoBiologico]);

  const onboardingSummary = useMemo(
    () => buildOnboardingSummary(onboardingContext),
    [onboardingContext]
  );

  const payloadData = useMemo(() => {
    const esportivoPayload = buildEsportivoPayload(dados.esportivo);
    return {
      dataAvaliacao: normalizeDate(dados.dataAvaliacao),
      nomePaciente: toText(dados.nomePaciente),
      sexoBiologico: toText(dados.sexoBiologico),
      objetivos: dados.objetivos,
      scoreRisco: evaluation?.score ?? null,
      prioridade: evaluation?.priority?.level || null,
      esportivo: esportivoPayload,
      dados_brutos: {
        ...dados,
        esportivo: esportivoPayload,
        medicamentos: dados.medicamentos
          .filter((item) => toText(item.nome))
          .map((item) => ({
            nome: toText(item.nome),
            dose: toText(item.dose) || null,
            frequencia: toText(item.frequencia) || null
          })),
        suplementos: dados.suplementos
          .filter((item) => toText(item.nome))
          .map((item) => ({
            nome: toText(item.nome),
            dose: toText(item.dose) || null,
            frequencia: toText(item.frequencia) || null
          }))
      },
      resultados_calculados: {
        scoreRisco: evaluation?.score ?? null,
        prioridade: evaluation?.priority?.level || null,
        justificativaPrioridade: evaluation?.priority?.reason || null,
        flags: (evaluation?.flags || []).map((flag) => ({
          id: flag.id,
          label: flag.label,
          severity: flag.severity,
          source: flag.source,
          detail: flag.detail || null
        })),
        encaminhamentos: evaluation?.recommendations || []
      },
      classificacoes: {
        prioridadeCuidado: evaluation?.priority?.level || null,
        referencia: 'anamnese_initial_rules_v1'
      },
      metadados_formula: {
        formulaId: 'anamnese_risk_rules_v1',
        formulaVersion: '1.0.0',
        formulaLabel: 'Score de risco de anamnese inicial',
        equacao: evaluation?.formulas?.riskScoring || null
      },
      source: {
        mode: 'manual',
        system: 'anamnese_inicial'
      }
    };
  }, [dados, evaluation]);

  const payloadResults = useMemo(() => ({
    prioridade_cuidado: payloadData?.resultados_calculados?.prioridade ?? null,
    score_risco: payloadData?.resultados_calculados?.scoreRisco ?? null,
    encaminhamentos: payloadData?.resultados_calculados?.encaminhamentos || []
  }), [payloadData]);

  const hasValues = useMemo(() => {
    if (dados.objetivos.length > 0) return true;
    const fields = [dados.nomePaciente, dados.queixaPrincipal, dados.alergias, dados.observacoes];
    if (fields.some((value) => toText(value) !== '')) return true;
    return hasEsportivoValues(dados.esportivo);
  }, [dados.alergias, dados.esportivo, dados.nomePaciente, dados.objetivos, dados.observacoes, dados.queixaPrincipal]);

  const dispatchSave = useCallback(async (auto = false) => {
    const dispatch = auto ? onAutoSave : onSalvar;
    if (!dispatch) return;
    await dispatch({
      tipo: 'anamnese_inicial',
      dados: payloadData,
      resultados: payloadResults,
      data: dados.dataAvaliacao,
      pacienteId,
      schemaVersion: 1,
      formulaId: 'anamnese_risk_rules_v1',
      formulaVersion: '1.0.0',
      sourceSystem: 'manual',
      measuredAt: normalizeDate(dados.dataAvaliacao),
      sessaoId: moduleSnapshot?.sessaoId || currentSessionId
    });
  }, [
    currentSessionId,
    dados.dataAvaliacao,
    moduleSnapshot?.sessaoId,
    onAutoSave,
    onSalvar,
    pacienteId,
    payloadData,
    payloadResults
  ]);

  const executeSave = useCallback(async (auto = false) => {
    setSaveStatus('saving');
    if (saveStatusResetRef.current) clearTimeout(saveStatusResetRef.current);
    try {
      await dispatchSave(auto);
      setSaveStatus('saved');
      saveStatusResetRef.current = setTimeout(() => setSaveStatus(null), 3000);
    } catch (error) {
      setSaveStatus('error');
      if (!auto) {
        setError('Não foi possível salvar a avaliação. Tente novamente.');
      }
    }
  }, [dispatchSave]);

  const handleSubmit = useCallback(async () => {
    if (!onSalvar) return;
    setSubmitAttempted(true);
    setError('');
    if (!hasValues) {
      setError('Preencha os dados principais da anamnese para salvar.');
      return;
    }
    if (hasRequiredMissing) {
      setError('Nome, sexo biológico e ao menos um objetivo principal são obrigatórios.');
      return;
    }
    await executeSave(false);
  }, [executeSave, hasRequiredMissing, hasValues, onSalvar]);

  useEffect(() => {
    if (readOnly || !onAutoSave || !hasUserInput) return undefined;
    if (!hasValues || hasRequiredMissing) return undefined;
    clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => executeSave(true), 3500);
    return () => clearTimeout(autoSaveRef.current);
  }, [executeSave, hasRequiredMissing, hasUserInput, hasValues, onAutoSave, readOnly]);

  const flags = evaluation?.flags || [];

  return (
    <AvaliacaoModulo
      className={`eval-card anamnese-form anamnese-form--modern${readOnly ? ' eval-card--readonly' : ''}`}
      titulo="Anamnese inicial"
      descricao="Coleta inicial de contexto clínico e risco para a conduta nutricional."
      icone={<ClipboardList size={20} />}
    >
      {onboardingSummary.length > 0 ? (
        <AvisoAvaliacao tipo="info">
          <strong>Pré-preenchimento do onboarding:</strong> {onboardingSummary.join(' - ')}
        </AvisoAvaliacao>
      ) : null}

      {/* As abas já são a navegação deste formulário (só a aba ativa é
          montada), por isso não há índice "Neste formulário": um link para
          uma seção de outra aba cairia no #id nativo e mudaria a URL. */}
      <div className="anamnese-navegacao">
      {(() => {
        const activeIndex = TAB_ITEMS.findIndex((t) => t.id === activeTab);
        const progress = Math.round(((activeIndex + 1) / TAB_ITEMS.length) * 100);
        return (
          <>
            <div className="anamnese-progress">
              <div className="anamnese-progress__header">
                <span className="anamnese-progress__label">
                  Passo {activeIndex + 1} de {TAB_ITEMS.length}
                </span>
                <span className="anamnese-progress__tab-name">
                  {TAB_ITEMS[activeIndex]?.label}
                </span>
              </div>
              <div
                className="anamnese-progress__bar"
                role="progressbar"
                aria-valuenow={activeIndex + 1}
                aria-valuemin={1}
                aria-valuemax={TAB_ITEMS.length}
                aria-label={`Passo ${activeIndex + 1} de ${TAB_ITEMS.length}`}
              >
                <div className="anamnese-progress__fill" style={{ width: `${progress}%` }} />
              </div>
            </div>

            <div className="anamnese-tabs" role="tablist" aria-label="Abas da anamnese">
              {TAB_ITEMS.map((tab, index) => {
                const isDone = index < activeIndex;
                const isActive = tab.id === activeTab;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    className={`anamnese-tab ${isActive ? 'is-active' : ''} ${isDone ? 'is-done' : ''}`}
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    {isDone && <span className="anamnese-tab__check" aria-hidden="true">✓</span>}
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </>
        );
      })()}
      </div>

      {activeTab === 'identificacao' && (
        <AvaliacaoSecao id="anamnese-identificacao" titulo="Identificação e objetivo" className="eval-section">
          <div className="av-grade">
            <InputField label="Data avaliacao" type="date" value={dados.dataAvaliacao} onChange={(v) => updateField(setDados, setHasUserInput, 'dataAvaliacao', v)} disabled={readOnly} />
            <InputField label="Nome" value={dados.nomePaciente} required onChange={(v) => updateField(setDados, setHasUserInput, 'nomePaciente', v)} disabled={readOnly} />
            <InputField label="Data nascimento" type="date" value={dados.dataNascimento} onChange={(v) => updateField(setDados, setHasUserInput, 'dataNascimento', v)} disabled={readOnly} />
            <SelectField label="Sexo biologico" value={dados.sexoBiologico} required options={[{ value: '', label: 'Selecione' }, { value: 'masculino', label: 'Masculino' }, { value: 'feminino', label: 'Feminino' }]} onChange={(v) => updateField(setDados, setHasUserInput, 'sexoBiologico', v)} disabled={readOnly} />
            <InputField label="Identidade de gênero" value={dados.identidadeGenero} onChange={(v) => updateField(setDados, setHasUserInput, 'identidadeGenero', v)} disabled={readOnly} />
          </div>
          <div className="av-grade">
            <GrupoOpcoes
              legenda="Objetivos principais"
              obrigatorio
              classeObrigatorio="anamnese-required"
              className="eval-field eval-field-full anamnese-opcoes"
            >
              {GOAL_OPTIONS.map((option) => (
                <Opcao
                  key={option.value}
                  tipo="checkbox"
                  rotulo={option.label}
                  checked={dados.objetivos.includes(option.value)}
                  onChange={() => toggleArray(setDados, setHasUserInput, 'objetivos', option.value)}
                  disabled={readOnly}
                />
              ))}
            </GrupoOpcoes>
            <InputField label="Outros objetivos" value={dados.objetivoOutros} onChange={(v) => updateField(setDados, setHasUserInput, 'objetivoOutros', v)} disabled={readOnly} />
            <AreaField label="Queixa principal" value={dados.queixaPrincipal} onChange={(v) => updateField(setDados, setHasUserInput, 'queixaPrincipal', v)} disabled={readOnly} />
          </div>
        </AvaliacaoSecao>
      )}

      {activeTab === 'historico' && (
        <AvaliacaoSecao id="anamnese-historico" titulo="Histórico clínico" className="eval-section">
          <div className="av-grade">
            <GrupoOpcoes legenda="Patologias" className="eval-field eval-field-full anamnese-opcoes">
              {PATHOLOGY_OPTIONS.map((item) => (
                <Opcao
                  key={item}
                  tipo="checkbox"
                  rotulo={item}
                  checked={dados.patologias.includes(item)}
                  onChange={() => toggleArray(setDados, setHasUserInput, 'patologias', item)}
                  disabled={readOnly}
                />
              ))}
            </GrupoOpcoes>
            <InputField label="Outras patologias" value={dados.patologiasOutras} onChange={(v) => updateField(setDados, setHasUserInput, 'patologiasOutras', v)} disabled={readOnly} />
            {/* Linhas repetidas: cada campo tem rótulo só para o leitor de
                tela, com o nome da lista, a linha e o placeholder de antes. */}
            <Campo rotulo="Medicamentos em uso" className="eval-field eval-field-full">
              <div className="anamnese-med-list">
                {dados.medicamentos.map((med, linha) => (
                  <div className="anamnese-med-row" key={med.id}>
                    <Campo rotuloOculto rotulo={`Medicamentos em uso ${linha + 1}: Nome`}>
                      <input className="eval-input" type="text" value={med.nome} placeholder="Nome" onChange={(e) => updateMedication(setDados, setHasUserInput, med.id, 'nome', e.target.value)} disabled={readOnly} />
                    </Campo>
                    <Campo rotuloOculto rotulo={`Medicamentos em uso ${linha + 1}: Dose`}>
                      <input className="eval-input" type="text" value={med.dose} placeholder="Dose" onChange={(e) => updateMedication(setDados, setHasUserInput, med.id, 'dose', e.target.value)} disabled={readOnly} />
                    </Campo>
                    <Campo rotuloOculto rotulo={`Medicamentos em uso ${linha + 1}: Frequência`}>
                      <input className="eval-input" type="text" value={med.frequencia} placeholder="Frequência" onChange={(e) => updateMedication(setDados, setHasUserInput, med.id, 'frequencia', e.target.value)} disabled={readOnly} />
                    </Campo>
                    <button type="button" className="anamnese-icon-btn" disabled={readOnly || dados.medicamentos.length <= 1} onClick={() => removeMedication(setDados, setHasUserInput, med.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <Button type="button" variant="secondary" className="anamnese-add-btn" disabled={readOnly} onClick={() => addMedication(setDados, setHasUserInput)}>
                <Plus size={14} /> Adicionar medicamento
              </Button>
            </Campo>
            <Campo rotulo="Suplementos em uso" className="eval-field eval-field-full">
              <div className="anamnese-med-list">
                {dados.suplementos.map((sup, linha) => (
                  <div className="anamnese-med-row" key={sup.id}>
                    <Campo rotuloOculto rotulo={`Suplementos em uso ${linha + 1}: Nome`}>
                      <input className="eval-input" type="text" value={sup.nome} placeholder="Nome" onChange={(e) => updateSuplemento(setDados, setHasUserInput, sup.id, 'nome', e.target.value)} disabled={readOnly} />
                    </Campo>
                    <Campo rotuloOculto rotulo={`Suplementos em uso ${linha + 1}: Dose`}>
                      <input className="eval-input" type="text" value={sup.dose} placeholder="Dose" onChange={(e) => updateSuplemento(setDados, setHasUserInput, sup.id, 'dose', e.target.value)} disabled={readOnly} />
                    </Campo>
                    <Campo rotuloOculto rotulo={`Suplementos em uso ${linha + 1}: Frequência`}>
                      <input className="eval-input" type="text" value={sup.frequencia} placeholder="Frequência" onChange={(e) => updateSuplemento(setDados, setHasUserInput, sup.id, 'frequencia', e.target.value)} disabled={readOnly} />
                    </Campo>
                    <button type="button" className="anamnese-icon-btn" disabled={readOnly || dados.suplementos.length <= 1} onClick={() => removeSuplemento(setDados, setHasUserInput, sup.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <Button type="button" variant="secondary" className="anamnese-add-btn" disabled={readOnly} onClick={() => addSuplemento(setDados, setHasUserInput)}>
                <Plus size={14} /> Adicionar suplemento
              </Button>
            </Campo>
            <AreaField label="Alergias/intolerâncias" value={dados.alergias} onChange={(v) => updateField(setDados, setHasUserInput, 'alergias', v)} disabled={readOnly} />
            <AreaField label="Cirurgias relevantes" value={dados.cirurgias} onChange={(v) => updateField(setDados, setHasUserInput, 'cirurgias', v)} disabled={readOnly} />
          </div>
        </AvaliacaoSecao>
      )}

      {activeTab === 'estilo' && (
        <AvaliacaoSecao id="anamnese-estilo" titulo="Estilo de vida" className="eval-section">
          {/* Mesmos campos e mesma ordem, em blocos: atividade física; sono e
              estresse; álcool e tabaco; ciclo menstrual. */}
          <div className="av-grade">
            <InputField label="Atividade tipo" value={dados.atividadeTipo} onChange={(v) => updateField(setDados, setHasUserInput, 'atividadeTipo', v)} disabled={readOnly} />
            <InputField label="Frequência semanal" value={dados.atividadeFrequencia} onChange={(v) => updateField(setDados, setHasUserInput, 'atividadeFrequencia', v)} disabled={readOnly} />
            <InputField label="Duração média (min)" value={dados.atividadeDuracao} onChange={(v) => updateField(setDados, setHasUserInput, 'atividadeDuracao', v)} disabled={readOnly} />
          </div>
          <div className="av-grade">
            <InputField label="Sono horas/noite" value={dados.sonoHoras} onChange={(v) => updateField(setDados, setHasUserInput, 'sonoHoras', v)} disabled={readOnly} />
            <SelectField label="Qualidade sono (1-5)" value={dados.sonoQualidade} options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }))} onChange={(v) => updateField(setDados, setHasUserInput, 'sonoQualidade', v)} disabled={readOnly} />
            <SelectField label="Estresse (1-10)" value={dados.estresseNivel} options={Array.from({ length: 10 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))} onChange={(v) => updateField(setDados, setHasUserInput, 'estresseNivel', v)} disabled={readOnly} />
          </div>
          <div className="av-grade">
            <SelectField label="Álcool" value={dados.alcoolUso} options={[{ value: 'nao_informado', label: 'Não informado' }, { value: 'nao', label: 'Não' }, { value: 'eventual', label: 'Eventual' }, { value: 'frequente', label: 'Frequente' }, { value: 'alto', label: 'Alto/diário' }]} onChange={(v) => updateField(setDados, setHasUserInput, 'alcoolUso', v)} disabled={readOnly} />
            <SelectField label="Tabaco" value={dados.tabacoUso} options={[{ value: 'nao_informado', label: 'Não informado' }, { value: 'nao', label: 'Não' }, { value: 'eventual', label: 'Eventual' }, { value: 'sim', label: 'Sim' }]} onChange={(v) => updateField(setDados, setHasUserInput, 'tabacoUso', v)} disabled={readOnly} />
          </div>
          <div className="av-grade">
            <SelectField label="Ciclo menstrual" value={dados.cicloMenstrualRegularidade} options={[{ value: 'nao_informado', label: 'Não informado' }, { value: 'regular', label: 'Regular' }, { value: 'irregular', label: 'Irregular' }, { value: 'nao_aplicavel', label: 'Não aplicável' }]} onChange={(v) => updateField(setDados, setHasUserInput, 'cicloMenstrualRegularidade', v)} disabled={readOnly} />
            <SelectField label="Contraceptivo" value={dados.cicloMenstrualContraceptivo} options={[{ value: 'nao_informado', label: 'Não informado' }, { value: 'nao', label: 'Não' }, { value: 'sim', label: 'Sim' }, { value: 'nao_aplicavel', label: 'Não aplicável' }]} onChange={(v) => updateField(setDados, setHasUserInput, 'cicloMenstrualContraceptivo', v)} disabled={readOnly} />
          </div>

          {/* Era um segundo h4 dentro da mesma .eval-section; como subseção
              (h5) a aba continua com uma .eval-section só, e o modo
              essencial esconde as duas partes juntas, como antes. */}
          <AvaliacaoSecao id="anamnese-esportivo" titulo="Contexto esportivo">
          <div className="av-grade">
            <SelectField
              label="Modalidade"
              value={dados.esportivo.modalidade}
              options={SPORT_MODALITY_OPTIONS}
              onChange={(v) => updateEsportivoField(setDados, setHasUserInput, 'modalidade', v)}
              disabled={readOnly}
            />
            <InputField
              label="Posição / função"
              value={dados.esportivo.posicao}
              onChange={(v) => updateEsportivoField(setDados, setHasUserInput, 'posicao', v)}
              disabled={readOnly}
            />
            <InputField
              label="Provas / especialidade"
              value={dados.esportivo.provas}
              onChange={(v) => updateEsportivoField(setDados, setHasUserInput, 'provas', v)}
              disabled={readOnly}
            />
            <SelectField
              label="Nível competitivo"
              value={dados.esportivo.nivel}
              options={[
                { value: '', label: 'Selecione' },
                { value: 'amador', label: 'Amador' },
                { value: 'semi-pro', label: 'Semi-pro' },
                { value: 'elite', label: 'Elite' },
                { value: 'federado', label: 'Federado' }
              ]}
              onChange={(v) => updateEsportivoField(setDados, setHasUserInput, 'nivel', v)}
              disabled={readOnly}
            />
            <InputField
              label="Clube"
              value={dados.esportivo.clube}
              onChange={(v) => updateEsportivoField(setDados, setHasUserInput, 'clube', v)}
              disabled={readOnly}
            />
          </div>

          <div className="av-grade">
            <InputField
              label="Carga técnica (h/sem)"
              value={dados.esportivo.cargaSemanal.tecnico}
              onChange={(v) => updateEsportivoCarga(setDados, setHasUserInput, 'tecnico', v)}
              disabled={readOnly}
            />
            <InputField
              label="Carga tática (h/sem)"
              value={dados.esportivo.cargaSemanal.tatico}
              onChange={(v) => updateEsportivoCarga(setDados, setHasUserInput, 'tatico', v)}
              disabled={readOnly}
            />
            <InputField
              label="Carga física (h/sem)"
              value={dados.esportivo.cargaSemanal.fisico}
              onChange={(v) => updateEsportivoCarga(setDados, setHasUserInput, 'fisico', v)}
              disabled={readOnly}
            />
            <InputField
              label="Carga preventiva (h/sem)"
              value={dados.esportivo.cargaSemanal.preventivo}
              onChange={(v) => updateEsportivoCarga(setDados, setHasUserInput, 'preventivo', v)}
              disabled={readOnly}
            />
          </div>

          <div className="av-grade">
            <SelectField
              label="Fase de periodização"
              value={dados.esportivo.fasePeriodizacao}
              options={[
                { value: '', label: 'Selecione' },
                { value: 'pre-temporada', label: 'Pré-temporada' },
                { value: 'temporada', label: 'Temporada' },
                { value: 'off-season', label: 'Off-season' }
              ]}
              onChange={(v) => updateEsportivoField(setDados, setHasUserInput, 'fasePeriodizacao', v)}
              disabled={readOnly}
            />

            <Campo rotulo="Histórico de lesões" className="eval-field eval-field-full">
              <div className="anamnese-med-list">
                {dados.esportivo.historicoLesoes.map((item, linha) => (
                  <div className="anamnese-med-row" key={item.id}>
                    <Campo rotuloOculto rotulo={`Histórico de lesões ${linha + 1}: Local da lesão`}>
                      <input
                        className="eval-input"
                        type="text"
                        placeholder="Local da lesão"
                        value={item.local}
                        onChange={(e) => updateEsportivoArrayItem(setDados, setHasUserInput, 'historicoLesoes', item.id, 'local', e.target.value)}
                        disabled={readOnly}
                      />
                    </Campo>
                    <Campo rotuloOculto rotulo={`Histórico de lesões ${linha + 1}: Tempo afastado`}>
                      <input
                        className="eval-input"
                        type="text"
                        placeholder="Tempo afastado"
                        value={item.tempoAfastado}
                        onChange={(e) => updateEsportivoArrayItem(setDados, setHasUserInput, 'historicoLesoes', item.id, 'tempoAfastado', e.target.value)}
                        disabled={readOnly}
                      />
                    </Campo>
                    <button
                      type="button"
                      className="anamnese-icon-btn"
                      disabled={readOnly || dados.esportivo.historicoLesoes.length <= 1}
                      onClick={() => removeEsportivoArrayItem(setDados, setHasUserInput, 'historicoLesoes', item.id, createLesaoItem)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <Button type="button" variant="secondary" className="anamnese-add-btn" disabled={readOnly} onClick={() => addEsportivoArrayItem(setDados, setHasUserInput, 'historicoLesoes', createLesaoItem)}>
                <Plus size={14} /> Adicionar lesão
              </Button>
            </Campo>

            <Campo rotulo="Próximas competições" className="eval-field eval-field-full">
              <div className="anamnese-med-list">
                {dados.esportivo.proximasCompeticoes.map((item, linha) => (
                  <div className="anamnese-med-row" key={item.id}>
                    <Campo rotuloOculto rotulo={`Próximas competições ${linha + 1}: Nome da competição`}>
                      <input
                        className="eval-input"
                        type="text"
                        placeholder="Nome da competição"
                        value={item.nome}
                        onChange={(e) => updateEsportivoArrayItem(setDados, setHasUserInput, 'proximasCompeticoes', item.id, 'nome', e.target.value)}
                        disabled={readOnly}
                      />
                    </Campo>
                    <Campo rotuloOculto rotulo={`Próximas competições ${linha + 1}: Data`}>
                      <input
                        className="eval-input"
                        type="date"
                        value={item.data}
                        onChange={(e) => updateEsportivoArrayItem(setDados, setHasUserInput, 'proximasCompeticoes', item.id, 'data', e.target.value)}
                        disabled={readOnly}
                      />
                    </Campo>
                    <button
                      type="button"
                      className="anamnese-icon-btn"
                      disabled={readOnly || dados.esportivo.proximasCompeticoes.length <= 1}
                      onClick={() => removeEsportivoArrayItem(setDados, setHasUserInput, 'proximasCompeticoes', item.id, createCompeticaoItem)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <Button type="button" variant="secondary" className="anamnese-add-btn" disabled={readOnly} onClick={() => addEsportivoArrayItem(setDados, setHasUserInput, 'proximasCompeticoes', createCompeticaoItem)}>
                <Plus size={14} /> Adicionar competição
              </Button>
            </Campo>

            {toText(dados.sexoBiologico).toLowerCase().includes('femin') && (
              <div className="eval-field eval-field-full">
                <Opcao
                  tipo="checkbox"
                  rotulo="Histórico pregresso sugestivo de baixa disponibilidade energética"
                  checked={Boolean(dados.esportivo.historicaREDS)}
                  onChange={(e) => updateEsportivoField(setDados, setHasUserInput, 'historicaREDS', e.target.checked)}
                  disabled={readOnly}
                />
              </div>
            )}
          </div>
          </AvaliacaoSecao>
        </AvaliacaoSecao>
      )}

      {activeTab === 'familiar' && (
        <AvaliacaoSecao id="anamnese-familiar" titulo="Histórico familiar" className="eval-section">
          {/* As caixas não tinham legenda própria: o grupo é rotulado pelo
              título da seção. */}
          <div className="anamnese-opcoes-grade" role="group" aria-labelledby="anamnese-familiar-titulo">
            {[
              { key: 'familyCardiovascular', label: 'Doença cardiovascular' },
              { key: 'familyDiabetes', label: 'Diabetes' },
              { key: 'familyCancer', label: 'Câncer' },
              { key: 'familyObesity', label: 'Obesidade' }
            ].map((item) => (
              <Opcao
                key={item.key}
                tipo="checkbox"
                rotulo={item.label}
                checked={Boolean(dados[item.key])}
                onChange={(e) => updateField(setDados, setHasUserInput, item.key, e.target.checked)}
                disabled={readOnly}
              />
            ))}
          </div>
          <AreaField label="Observações" value={dados.observacoes} onChange={(v) => updateField(setDados, setHasUserInput, 'observacoes', v)} disabled={readOnly} />
        </AvaliacaoSecao>
      )}

      <AvaliacaoSecao id="anamnese-resumo" titulo="Resumo de risco" className="eval-section">
        <div className="av-resultados">
          <SummaryCard label="Prioridade" value={formatPriority(evaluation?.priority?.level)} tone={priorityTone(evaluation?.priority?.level)} detail={evaluation?.priority?.reason} />
          <SummaryCard label="Score" value={Number.isFinite(evaluation?.score) ? String(evaluation.score) : '--'} tone={priorityTone(evaluation?.priority?.level)} detail={evaluation?.formulas?.priorityBands} />
          <SummaryCard label="Encaminhamentos" value={(evaluation?.recommendations || []).join(', ') || 'Sem encaminhamento'} tone="info" />
        </div>
        {flags.length ? (
          <div className="anamnese-flag-list">
            {flags.map((flag) => (
              <AvisoAvaliacao
                tipo={FLAG_TIPO_AVISO[flag.severity] || 'info'}
                className={`anamnese-flag-item severity-${flag.severity}`}
                key={flag.id}
              >
                <strong>{flag.label}</strong>
                <small>{flag.detail || flag.source}</small>
              </AvisoAvaliacao>
            ))}
          </div>
        ) : <AvisoAvaliacao tipo="info">Sem flags automáticas de risco.</AvisoAvaliacao>}
      </AvaliacaoSecao>

      <BarraAcoesAvaliacao status={saveStatus}>
        {TAB_ITEMS.findIndex((tab) => tab.id === activeTab) < TAB_ITEMS.length - 1 && (
          <Button type="button" variant="secondary" disabled={readOnly} onClick={() => {
            const index = TAB_ITEMS.findIndex((tab) => tab.id === activeTab);
            setActiveTab(TAB_ITEMS[index + 1].id);
          }}>
            Próxima aba
          </Button>
        )}
        <Button type="button" variant="primary" disabled={readOnly} onClick={handleSubmit} loading={saveStatus === 'saving'}>
          Salvar anamnese
        </Button>
      </BarraAcoesAvaliacao>

      {submitAttempted && hasRequiredMissing ? <AvisoAvaliacao tipo="perigo" anunciar className="anamnese-error-note">Nome, sexo biológico e objetivo principal são obrigatórios.</AvisoAvaliacao> : null}
      {error ? <AvisoAvaliacao tipo="perigo" anunciar className="anamnese-error-note">{error}</AvisoAvaliacao> : null}
    </AvaliacaoModulo>
  );
};

export default AnamneseInicialForm;

// Mesma assinatura de antes. O rótulo passa a ser ligado ao controle pela
// base; a marca de obrigatório continua com a classe anamnese-required, que o
// modo essencial de AvaliacaoCompleta procura dentro do .eval-field.
const InputField = ({ label, value, onChange, disabled, type = 'text', required = false }) => (
  <Campo rotulo={label} obrigatorio={required} classeObrigatorio="anamnese-required" className="eval-field">
    <input className="eval-input" type={type} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} />
  </Campo>
);

const SelectField = ({ label, value, onChange, disabled, options = [], required = false }) => (
  <Campo rotulo={label} obrigatorio={required} classeObrigatorio="anamnese-required" className="eval-field">
    <select className="eval-select" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  </Campo>
);

const AreaField = ({ label, value, onChange, disabled }) => (
  <Campo rotulo={label} className="eval-field eval-field-full">
    <textarea className="eval-textarea" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} />
  </Campo>
);

// O valor já chega escrito (a prioridade por extenso, o score, os
// encaminhamentos). O tom de antes (tone-*) só pinta a raia do cartão, ao lado
// de um valor que já diz o que é; '--' era a ausência do score e vira "—".
const SummaryCard = ({ label, value, tone = 'neutral', detail = '' }) => (
  <ResultadoCalculado
    className={`anamnese-summary-card tone-${tone}`}
    rotulo={label}
    valor={value === '--' ? null : value}
    metodo={detail || undefined}
  />
);

function createId() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function updateField(setDados, setHasUserInput, key, value) {
  setHasUserInput(true);
  setDados((prev) => ({ ...prev, [key]: value }));
}

function toggleArray(setDados, setHasUserInput, key, value) {
  setHasUserInput(true);
  setDados((prev) => {
    const list = Array.isArray(prev[key]) ? prev[key] : [];
    return list.includes(value)
      ? { ...prev, [key]: list.filter((item) => item !== value) }
      : { ...prev, [key]: [...list, value] };
  });
}

function addMedication(setDados, setHasUserInput) {
  setHasUserInput(true);
  setDados((prev) => ({
    ...prev,
    medicamentos: [...(Array.isArray(prev.medicamentos) ? prev.medicamentos : []), { id: createId(), nome: '', dose: '', frequencia: '' }]
  }));
}

function removeMedication(setDados, setHasUserInput, id) {
  setHasUserInput(true);
  setDados((prev) => {
    const list = (Array.isArray(prev.medicamentos) ? prev.medicamentos : []).filter((item) => item.id !== id);
    return { ...prev, medicamentos: list.length ? list : [{ id: createId(), nome: '', dose: '', frequencia: '' }] };
  });
}

function updateMedication(setDados, setHasUserInput, id, key, value) {
  setHasUserInput(true);
  setDados((prev) => ({
    ...prev,
    medicamentos: (Array.isArray(prev.medicamentos) ? prev.medicamentos : []).map((item) => (
      item.id === id ? { ...item, [key]: value } : item
    ))
  }));
}

function addSuplemento(setDados, setHasUserInput) {
  setHasUserInput(true);
  setDados((prev) => ({
    ...prev,
    suplementos: [...(Array.isArray(prev.suplementos) ? prev.suplementos : []), { id: createId(), nome: '', dose: '', frequencia: '' }]
  }));
}

function removeSuplemento(setDados, setHasUserInput, id) {
  setHasUserInput(true);
  setDados((prev) => {
    const list = (Array.isArray(prev.suplementos) ? prev.suplementos : []).filter((item) => item.id !== id);
    return { ...prev, suplementos: list.length ? list : [{ id: createId(), nome: '', dose: '', frequencia: '' }] };
  });
}

function updateSuplemento(setDados, setHasUserInput, id, key, value) {
  setHasUserInput(true);
  setDados((prev) => ({
    ...prev,
    suplementos: (Array.isArray(prev.suplementos) ? prev.suplementos : []).map((item) => (
      item.id === id ? { ...item, [key]: value } : item
    ))
  }));
}

function updateEsportivoField(setDados, setHasUserInput, key, value) {
  setHasUserInput(true);
  setDados((prev) => ({
    ...prev,
    esportivo: {
      ...(prev?.esportivo || createEsportivoData()),
      [key]: value
    }
  }));
}

function updateEsportivoCarga(setDados, setHasUserInput, key, value) {
  setHasUserInput(true);
  setDados((prev) => ({
    ...prev,
    esportivo: {
      ...(prev?.esportivo || createEsportivoData()),
      cargaSemanal: {
        ...(prev?.esportivo?.cargaSemanal || {}),
        [key]: value
      }
    }
  }));
}

function updateEsportivoArrayItem(setDados, setHasUserInput, listKey, id, field, value) {
  setHasUserInput(true);
  setDados((prev) => ({
    ...prev,
    esportivo: {
      ...(prev?.esportivo || createEsportivoData()),
      [listKey]: normalizeObjectArray(prev?.esportivo?.[listKey]).map((item) => (
        String(item?.id) === String(id) ? { ...item, [field]: value } : item
      ))
    }
  }));
}

function addEsportivoArrayItem(setDados, setHasUserInput, listKey, createItem) {
  setHasUserInput(true);
  setDados((prev) => ({
    ...prev,
    esportivo: {
      ...(prev?.esportivo || createEsportivoData()),
      [listKey]: [
        ...normalizeObjectArray(prev?.esportivo?.[listKey]),
        createItem()
      ]
    }
  }));
}

function removeEsportivoArrayItem(setDados, setHasUserInput, listKey, id, createItem) {
  setHasUserInput(true);
  setDados((prev) => {
    const filtered = normalizeObjectArray(prev?.esportivo?.[listKey]).filter(
      (item) => String(item?.id) !== String(id)
    );
    return {
      ...prev,
      esportivo: {
        ...(prev?.esportivo || createEsportivoData()),
        [listKey]: filtered.length ? filtered : [createItem()]
      }
    };
  });
}

function normalizeObjectArray(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === 'object');
}

function asRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
}

function normalizeDateOptional(value) {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return value.trim();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return toLocalDateInputValue(date);
}

function buildEsportivoPayload(esportivo) {
  const source = asRecord(esportivo);
  const carga = asRecord(source.cargaSemanal);
  return {
    modalidade: toText(source.modalidade) || null,
    posicao: toText(source.posicao) || null,
    provas: (() => {
      const raw = source.provas;
      const text = Array.isArray(raw) ? raw.join(', ') : toText(raw);
      if (!text) return null;
      const arr = text.split(/[,;]+/).map((s) => s.trim()).filter(Boolean);
      return arr.length ? arr : null;
    })(),
    nivel: toText(source.nivel) || null,
    clube: toText(source.clube) || null,
    cargaSemanal: {
      tecnico: toNumber(carga.tecnico),
      tatico: toNumber(carga.tatico),
      fisico: toNumber(carga.fisico),
      preventivo: toNumber(carga.preventivo)
    },
    fasePeriodizacao: toText(source.fasePeriodizacao) || null,
    historicoLesoes: normalizeObjectArray(source.historicoLesoes)
      .map((item) => ({
        local: toText(item.local) || null,
        tempoAfastado: toText(item.tempoAfastado) || null
      }))
      .filter((item) => item.local || item.tempoAfastado),
    proximasCompeticoes: normalizeObjectArray(source.proximasCompeticoes)
      .map((item) => ({
        nome: toText(item.nome) || null,
        data: normalizeDateOptional(item.data) || null
      }))
      .filter((item) => item.nome || item.data),
    historicaREDS: normalizeBoolean(source.historicaREDS)
  };
}

function hasEsportivoValues(esportivo) {
  const payload = buildEsportivoPayload(esportivo);
  if (payload.modalidade || payload.posicao || payload.nivel || payload.clube || payload.fasePeriodizacao) return true;
  if (payload.provas && payload.provas.length > 0) return true;
  if (payload.historicaREDS) return true;
  if (payload.historicoLesoes.length > 0) return true;
  if (payload.proximasCompeticoes.length > 0) return true;
  return Object.values(payload.cargaSemanal || {}).some((value) => Number.isFinite(value));
}

function buildOnboardingPrefill(onboardingContext, patient) {
  if (!onboardingContext || typeof onboardingContext !== 'object') return null;

  const modalidadeTexto = toText(
    onboardingContext?.modalidadePrincipal
    || onboardingContext?.raw?.atividadeFisica
    || patient?.modalidadePrincipal
    || patient?.modalidade
  );

  const frequencia = toNumber(
    onboardingContext?.frequenciaSemanal ?? onboardingContext?.raw?.frequenciaSemanal
  );
  const duracao = toNumber(
    onboardingContext?.duracaoSessao ?? onboardingContext?.raw?.duracaoSessao
  );
  const sexo = normalizeBiologicalSex(
    onboardingContext?.sexoBiologico || patient?.sexoBiologico || onboardingContext?.raw?.sexoBiologico || patient?.sexo
  );
  const nivelCompetitivo = normalizeCompetitiveLevel(onboardingContext?.raw?.nivelCompetitivo);
  const motivoAtendimento = toText(onboardingContext?.raw?.motivoAtendimento);

  const observacoes = buildOnboardingObservations(onboardingContext);
  const modalidade = mapSportModalityToken(modalidadeTexto);

  if (!modalidadeTexto && !Number.isFinite(frequencia) && !Number.isFinite(duracao) && !sexo && !motivoAtendimento && !observacoes) {
    return null;
  }

  return {
    sexoBiologico: sexo,
    atividadeTipo: modalidadeTexto,
    atividadeFrequencia: Number.isFinite(frequencia) ? String(frequencia) : '',
    atividadeDuracao: Number.isFinite(duracao) ? String(duracao) : '',
    queixaPrincipal: motivoAtendimento,
    observacoes,
    esportivo: {
      modalidade,
      nivel: nivelCompetitivo,
      cargaSemanal: {
        fisico: Number.isFinite(frequencia) && Number.isFinite(duracao)
          ? String(Math.max((frequencia * duracao) / 60, 0).toFixed(1))
          : ''
      }
    }
  };
}

function applyOnboardingPrefill(currentData, prefill) {
  const current = currentData || createInitialData();
  const next = { ...current };

  next.sexoBiologico = fillIfEmpty(current.sexoBiologico, prefill.sexoBiologico);
  next.atividadeTipo = fillIfEmpty(current.atividadeTipo, prefill.atividadeTipo);
  next.atividadeFrequencia = fillIfEmpty(current.atividadeFrequencia, prefill.atividadeFrequencia);
  next.atividadeDuracao = fillIfEmpty(current.atividadeDuracao, prefill.atividadeDuracao);
  next.queixaPrincipal = fillIfEmpty(current.queixaPrincipal, prefill.queixaPrincipal);
  next.observacoes = fillIfEmpty(current.observacoes, prefill.observacoes);

  const esporteAtual = asRecord(current.esportivo);
  const esportePrefill = asRecord(prefill.esportivo);
  const cargaAtual = asRecord(esporteAtual.cargaSemanal);
  const cargaPrefill = asRecord(esportePrefill.cargaSemanal);

  next.esportivo = {
    ...(esporteAtual || createEsportivoData()),
    modalidade: fillIfEmpty(esporteAtual.modalidade, esportePrefill.modalidade),
    nivel: fillIfEmpty(esporteAtual.nivel, esportePrefill.nivel),
    cargaSemanal: {
      ...(esporteAtual.cargaSemanal || {}),
      fisico: fillIfEmpty(cargaAtual.fisico, cargaPrefill.fisico)
    }
  };

  return next;
}

function fillIfEmpty(currentValue, nextValue) {
  if (toText(currentValue)) return currentValue;
  return nextValue ?? currentValue;
}

function normalizeBiologicalSex(value) {
  const token = toText(value).toLowerCase();
  if (!token) return '';
  if (token.includes('fem')) return 'feminino';
  if (token.includes('masc')) return 'masculino';
  return '';
}

function normalizeCompetitiveLevel(value) {
  const token = toText(value).toLowerCase();
  if (!token) return '';
  if (token.includes('semi')) return 'semi-pro';
  if (token.includes('elit')) return 'elite';
  if (token.includes('feder')) return 'federado';
  if (token.includes('amador')) return 'amador';
  return '';
}

function mapSportModalityToken(value) {
  const token = toText(value).toLowerCase();
  if (!token) return '';
  if (token.includes('futsal')) return 'futsal';
  if (token.includes('futebol')) return 'futebol';
  if (token.includes('nata')) return 'natacao';
  if (token.includes('muscula')) return 'musculacao';
  if (token.includes('corr')) return 'corrida';
  if (token.includes('cicl')) return 'ciclismo';
  if (token.includes('volei')) return 'volei';
  if (token.includes('basquet')) return 'basquete';
  if (token.includes('hand')) return 'handebol';
  if (token.includes('tenis')) return 'tenis';
  if (token.includes('luta') || token.includes('mma') || token.includes('combate')) return 'luta';
  if (token.includes('atlet')) return 'atletismo';
  if (token.includes('remo')) return 'remo';
  if (token.includes('triat')) return 'triatlo';
  return 'outro';
}

function buildOnboardingObservations(onboardingContext) {
  const chunks = [
    toText(onboardingContext?.observacoesIniciais),
    toText(onboardingContext?.historicoSaude)
  ].filter(Boolean);
  if (!chunks.length) return '';
  return chunks.join(' | ');
}

function buildOnboardingSummary(onboardingContext) {
  if (!onboardingContext || typeof onboardingContext !== 'object') return [];
  const summary = [];
  const modalidade = toText(onboardingContext?.modalidadePrincipal);
  const frequencia = toNumber(onboardingContext?.frequenciaSemanal);
  const duracao = toNumber(onboardingContext?.duracaoSessao);
  const genero = toText(onboardingContext?.genero);
  const status = toText(onboardingContext?.status);

  if (modalidade) summary.push(`Modalidade: ${modalidade}`);
  if (Number.isFinite(frequencia)) summary.push(`Frequência: ${frequencia}x/sem`);
  if (Number.isFinite(duracao)) summary.push(`Duração: ${duracao} min`);
  if (genero) summary.push(`Gênero: ${genero}`);
  if (status) summary.push(`Status: ${status}`);
  return summary.slice(0, 5);
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(String(value).replace(',', '.').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function toInput(value, digits = null) {
  const numeric = toNumber(value);
  if (!Number.isFinite(numeric)) return '';
  if (!Number.isFinite(digits)) return String(numeric);
  return Number(numeric).toFixed(digits);
}

function toText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function firstDefined(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return null;
}

function normalizeDate(value) {
  if (!value) return toLocalDateInputValue(new Date());
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return value.trim();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? toLocalDateInputValue(new Date()) : toLocalDateInputValue(date);
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
  const text = toText(value);
  if (!text) return [];
  return text.split(/[,\n;]+/g).map((item) => item.trim()).filter(Boolean);
}

function normalizeBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  const token = toText(value).toLowerCase();
  if (!token) return false;
  return ['1', 'true', 'sim', 'yes', 'y', 'on'].includes(token);
}

function priorityTone(level) {
  if (level === 'alta') return 'danger';
  if (level === 'moderada') return 'warning';
  if (level === 'baixa') return 'success';
  return 'neutral';
}

function formatPriority(level) {
  if (level === 'alta') return 'Alta';
  if (level === 'moderada') return 'Moderada';
  if (level === 'baixa') return 'Baixa';
  return 'Não definida';
}

