import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ClipboardList, Plus, Trash2 } from 'lucide-react';
import { Button } from '../../ui';
import { toLocalDateInputValue } from '../../../utils/dateUtils';
import { calculateAnamneseInitialEvaluation } from '../../../services/calculationEngine';
import '../avaliacoes.css';
import './AnamneseInicialForm.css';

const GOAL_OPTIONS = [
  { value: 'emagrecimento', label: 'Emagrecimento' },
  { value: 'hipertrofia', label: 'Hipertrofia' },
  { value: 'saude_geral', label: 'Saude geral' },
  { value: 'performance', label: 'Performance' },
  { value: 'reabilitacao', label: 'Reabilitacao' },
  { value: 'gestacao', label: 'Gestacao' },
  { value: 'outros', label: 'Outros' }
];

const PATHOLOGY_OPTIONS = [
  'Diabetes',
  'Hipertensao',
  'Dislipidemia',
  'Doenca renal',
  'Doenca hepatica',
  'Hipotireoidismo',
  'Hipertireoidismo',
  'Sindrome dos ovarios policisticos',
  'Doenca cardiovascular',
  'Transtorno alimentar'
];

const TAB_ITEMS = [
  { id: 'identificacao', label: 'Identificacao e objetivo' },
  { id: 'historico', label: 'Historico clinico' },
  { id: 'estilo', label: 'Estilo de vida' },
  { id: 'familiar', label: 'Historico familiar' }
];

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
  observacoes: ''
});

const AnamneseInicialForm = ({
  pacienteId,
  onSalvar,
  onAutoSave,
  readOnly = false,
  patient,
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

    setDados((prev) => ({
      ...prev,
      dataAvaliacao: normalizeDate(firstDefined(moduleSnapshot?.data, source?.dataAvaliacao, dadosBrutos?.dataAvaliacao, prev.dataAvaliacao)),
      nomePaciente: toText(firstDefined(dadosBrutos?.nomePaciente, source?.nomePaciente, patient?.nome)),
      dataNascimento: toText(firstDefined(dadosBrutos?.dataNascimento, source?.dataNascimento, patient?.dataNascimento)),
      sexoBiologico: toText(firstDefined(dadosBrutos?.sexoBiologico, source?.sexoBiologico, patient?.sexo)),
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
      observacoes: toText(firstDefined(dadosBrutos?.observacoes, source?.observacoes))
    }));

    loadedSnapshotIdRef.current = snapshotId;
  }, [moduleSnapshot, patient?.dataNascimento, patient?.nome, patient?.sexo]);

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

  const payloadData = useMemo(() => ({
    dataAvaliacao: normalizeDate(dados.dataAvaliacao),
    nomePaciente: toText(dados.nomePaciente),
    sexoBiologico: toText(dados.sexoBiologico),
    objetivos: dados.objetivos,
    scoreRisco: evaluation?.score ?? null,
    prioridade: evaluation?.priority?.level || null,
    dados_brutos: {
      ...dados,
      medicamentos: dados.medicamentos
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
  }), [dados, evaluation]);

  const payloadResults = useMemo(() => ({
    prioridade_cuidado: payloadData?.resultados_calculados?.prioridade ?? null,
    score_risco: payloadData?.resultados_calculados?.scoreRisco ?? null,
    encaminhamentos: payloadData?.resultados_calculados?.encaminhamentos || []
  }), [payloadData]);

  const hasValues = useMemo(() => {
    if (dados.objetivos.length > 0) return true;
    const fields = [dados.nomePaciente, dados.queixaPrincipal, dados.alergias, dados.observacoes];
    return fields.some((value) => toText(value) !== '');
  }, [dados.alergias, dados.nomePaciente, dados.objetivos, dados.observacoes, dados.queixaPrincipal]);

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
    } catch (saveError) {
      setSaveStatus('error');
      if (!auto) {
        setError('Nao foi possivel salvar a avaliacao. Tente novamente.');
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
      setError('Nome, sexo biologico e ao menos um objetivo principal sao obrigatorios.');
      return;
    }
    await executeSave(false);
  }, [executeSave, hasRequiredMissing, hasValues, onSalvar]);

  useEffect(() => {
    if (readOnly || !onAutoSave || !hasUserInput) return undefined;
    if (!hasValues || hasRequiredMissing) return undefined;
    clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => executeSave(true), 900);
    return () => clearTimeout(autoSaveRef.current);
  }, [executeSave, hasRequiredMissing, hasUserInput, hasValues, onAutoSave, readOnly]);

  const flags = evaluation?.flags || [];

  return (
    <div className={`eval-card anamnese-form anamnese-form--modern${readOnly ? ' eval-card--readonly' : ''}`}>
      <div className="eval-header">
        <div className="eval-icon"><ClipboardList size={20} /></div>
        <div>
          <h3 className="eval-title">Anamnese inicial</h3>
          <p className="eval-subtitle">Coleta inicial de contexto clinico e risco para a conduta nutricional.</p>
        </div>
      </div>

      <div className="anamnese-tabs" role="tablist" aria-label="Abas da anamnese">
        {TAB_ITEMS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`anamnese-tab ${activeTab === tab.id ? 'is-active' : ''}`}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'identificacao' && (
        <div className="eval-section">
          <h4 className="eval-section-title">Identificacao e objetivo</h4>
          <div className="anamnese-grid">
            <InputField label="Data avaliacao" type="date" value={dados.dataAvaliacao} onChange={(v) => updateField(setDados, setHasUserInput, 'dataAvaliacao', v)} disabled={readOnly} />
            <InputField label="Nome" value={dados.nomePaciente} required onChange={(v) => updateField(setDados, setHasUserInput, 'nomePaciente', v)} disabled={readOnly} />
            <InputField label="Data nascimento" type="date" value={dados.dataNascimento} onChange={(v) => updateField(setDados, setHasUserInput, 'dataNascimento', v)} disabled={readOnly} />
            <SelectField label="Sexo biologico" value={dados.sexoBiologico} required options={[{ value: '', label: 'Selecione' }, { value: 'masculino', label: 'Masculino' }, { value: 'feminino', label: 'Feminino' }]} onChange={(v) => updateField(setDados, setHasUserInput, 'sexoBiologico', v)} disabled={readOnly} />
            <InputField label="Identidade de genero" value={dados.identidadeGenero} onChange={(v) => updateField(setDados, setHasUserInput, 'identidadeGenero', v)} disabled={readOnly} />
            <InputField label="Outros objetivos" value={dados.objetivoOutros} onChange={(v) => updateField(setDados, setHasUserInput, 'objetivoOutros', v)} disabled={readOnly} />
            <div className="eval-field eval-field-full">
              <label className="eval-label">Objetivos principais <span className="anamnese-required">*</span></label>
              <div className="anamnese-checkbox-grid">
                {GOAL_OPTIONS.map((option) => (
                  <label key={option.value} className="anamnese-checkbox">
                    <input
                      type="checkbox"
                      checked={dados.objetivos.includes(option.value)}
                      onChange={() => toggleArray(setDados, setHasUserInput, 'objetivos', option.value)}
                      disabled={readOnly}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <AreaField label="Queixa principal" value={dados.queixaPrincipal} onChange={(v) => updateField(setDados, setHasUserInput, 'queixaPrincipal', v)} disabled={readOnly} />
          </div>
        </div>
      )}

      {activeTab === 'historico' && (
        <div className="eval-section">
          <h4 className="eval-section-title">Historico clinico</h4>
          <div className="anamnese-grid">
            <div className="eval-field eval-field-full">
              <label className="eval-label">Patologias</label>
              <div className="anamnese-checkbox-grid">
                {PATHOLOGY_OPTIONS.map((item) => (
                  <label key={item} className="anamnese-checkbox">
                    <input
                      type="checkbox"
                      checked={dados.patologias.includes(item)}
                      onChange={() => toggleArray(setDados, setHasUserInput, 'patologias', item)}
                      disabled={readOnly}
                    />
                    <span>{item}</span>
                  </label>
                ))}
              </div>
            </div>
            <InputField label="Outras patologias" value={dados.patologiasOutras} onChange={(v) => updateField(setDados, setHasUserInput, 'patologiasOutras', v)} disabled={readOnly} />
            <div className="eval-field eval-field-full">
              <label className="eval-label">Medicamentos em uso</label>
              <div className="anamnese-med-list">
                {dados.medicamentos.map((med) => (
                  <div className="anamnese-med-row" key={med.id}>
                    <input className="eval-input" type="text" value={med.nome} placeholder="Nome" onChange={(e) => updateMedication(setDados, setHasUserInput, med.id, 'nome', e.target.value)} disabled={readOnly} />
                    <input className="eval-input" type="text" value={med.dose} placeholder="Dose" onChange={(e) => updateMedication(setDados, setHasUserInput, med.id, 'dose', e.target.value)} disabled={readOnly} />
                    <input className="eval-input" type="text" value={med.frequencia} placeholder="Frequencia" onChange={(e) => updateMedication(setDados, setHasUserInput, med.id, 'frequencia', e.target.value)} disabled={readOnly} />
                    <button type="button" className="anamnese-icon-btn" disabled={readOnly || dados.medicamentos.length <= 1} onClick={() => removeMedication(setDados, setHasUserInput, med.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <Button type="button" variant="secondary" className="anamnese-add-btn" disabled={readOnly} onClick={() => addMedication(setDados, setHasUserInput)}>
                <Plus size={14} /> Adicionar medicamento
              </Button>
            </div>
            <AreaField label="Alergias/intolerancias" value={dados.alergias} onChange={(v) => updateField(setDados, setHasUserInput, 'alergias', v)} disabled={readOnly} />
            <AreaField label="Cirurgias relevantes" value={dados.cirurgias} onChange={(v) => updateField(setDados, setHasUserInput, 'cirurgias', v)} disabled={readOnly} />
          </div>
        </div>
      )}

      {activeTab === 'estilo' && (
        <div className="eval-section">
          <h4 className="eval-section-title">Estilo de vida</h4>
          <div className="anamnese-grid">
            <InputField label="Atividade tipo" value={dados.atividadeTipo} onChange={(v) => updateField(setDados, setHasUserInput, 'atividadeTipo', v)} disabled={readOnly} />
            <InputField label="Frequencia semanal" value={dados.atividadeFrequencia} onChange={(v) => updateField(setDados, setHasUserInput, 'atividadeFrequencia', v)} disabled={readOnly} />
            <InputField label="Duracao media (min)" value={dados.atividadeDuracao} onChange={(v) => updateField(setDados, setHasUserInput, 'atividadeDuracao', v)} disabled={readOnly} />
            <InputField label="Sono horas/noite" value={dados.sonoHoras} onChange={(v) => updateField(setDados, setHasUserInput, 'sonoHoras', v)} disabled={readOnly} />
            <SelectField label="Qualidade sono (1-5)" value={dados.sonoQualidade} options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }))} onChange={(v) => updateField(setDados, setHasUserInput, 'sonoQualidade', v)} disabled={readOnly} />
            <SelectField label="Estresse (1-10)" value={dados.estresseNivel} options={Array.from({ length: 10 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))} onChange={(v) => updateField(setDados, setHasUserInput, 'estresseNivel', v)} disabled={readOnly} />
            <SelectField label="Alcool" value={dados.alcoolUso} options={[{ value: 'nao_informado', label: 'Nao informado' }, { value: 'nao', label: 'Nao' }, { value: 'eventual', label: 'Eventual' }, { value: 'frequente', label: 'Frequente' }, { value: 'alto', label: 'Alto/diario' }]} onChange={(v) => updateField(setDados, setHasUserInput, 'alcoolUso', v)} disabled={readOnly} />
            <SelectField label="Tabaco" value={dados.tabacoUso} options={[{ value: 'nao_informado', label: 'Nao informado' }, { value: 'nao', label: 'Nao' }, { value: 'eventual', label: 'Eventual' }, { value: 'sim', label: 'Sim' }]} onChange={(v) => updateField(setDados, setHasUserInput, 'tabacoUso', v)} disabled={readOnly} />
            <SelectField label="Ciclo menstrual" value={dados.cicloMenstrualRegularidade} options={[{ value: 'nao_informado', label: 'Nao informado' }, { value: 'regular', label: 'Regular' }, { value: 'irregular', label: 'Irregular' }, { value: 'nao_aplicavel', label: 'Nao aplicavel' }]} onChange={(v) => updateField(setDados, setHasUserInput, 'cicloMenstrualRegularidade', v)} disabled={readOnly} />
            <SelectField label="Contraceptivo" value={dados.cicloMenstrualContraceptivo} options={[{ value: 'nao_informado', label: 'Nao informado' }, { value: 'nao', label: 'Nao' }, { value: 'sim', label: 'Sim' }, { value: 'nao_aplicavel', label: 'Nao aplicavel' }]} onChange={(v) => updateField(setDados, setHasUserInput, 'cicloMenstrualContraceptivo', v)} disabled={readOnly} />
          </div>
        </div>
      )}

      {activeTab === 'familiar' && (
        <div className="eval-section">
          <h4 className="eval-section-title">Historico familiar</h4>
          <div className="anamnese-checkbox-grid">
            {[
              { key: 'familyCardiovascular', label: 'Doenca cardiovascular' },
              { key: 'familyDiabetes', label: 'Diabetes' },
              { key: 'familyCancer', label: 'Cancer' },
              { key: 'familyObesity', label: 'Obesidade' }
            ].map((item) => (
              <label key={item.key} className="anamnese-checkbox">
                <input type="checkbox" checked={Boolean(dados[item.key])} onChange={(e) => updateField(setDados, setHasUserInput, item.key, e.target.checked)} disabled={readOnly} />
                <span>{item.label}</span>
              </label>
            ))}
          </div>
          <AreaField label="Observacoes" value={dados.observacoes} onChange={(v) => updateField(setDados, setHasUserInput, 'observacoes', v)} disabled={readOnly} />
        </div>
      )}

      <div className="eval-section">
        <h4 className="eval-section-title">Resumo de risco</h4>
        <div className="anamnese-summary-grid">
          <SummaryCard label="Prioridade" value={formatPriority(evaluation?.priority?.level)} tone={priorityTone(evaluation?.priority?.level)} detail={evaluation?.priority?.reason} />
          <SummaryCard label="Score" value={Number.isFinite(evaluation?.score) ? String(evaluation.score) : '--'} tone={priorityTone(evaluation?.priority?.level)} detail={evaluation?.formulas?.priorityBands} />
          <SummaryCard label="Encaminhamentos" value={(evaluation?.recommendations || []).join(', ') || 'Sem encaminhamento'} tone="info" />
        </div>
        {flags.length ? (
          <div className="anamnese-flag-list">
            {flags.map((flag) => (
              <div className={`anamnese-flag-item severity-${flag.severity}`} key={flag.id}>
                <div className="anamnese-flag-title">
                  {flag.severity === 'danger' ? <AlertTriangle size={14} /> : null}
                  <strong>{flag.label}</strong>
                </div>
                <small>{flag.detail || flag.source}</small>
              </div>
            ))}
          </div>
        ) : <div className="eval-note">Sem flags automaticas de risco.</div>}
      </div>

      <div className="eval-actions">
        {saveStatus ? <span className={`save-indicator ${saveStatus}`}>{saveStatus === 'saving' ? 'Salvando...' : saveStatus === 'saved' ? 'Salvo' : 'Erro ao salvar'}</span> : null}
        <Button type="button" variant="secondary" disabled={readOnly} onClick={() => {
          const index = TAB_ITEMS.findIndex((tab) => tab.id === activeTab);
          if (index >= 0 && index < TAB_ITEMS.length - 1) setActiveTab(TAB_ITEMS[index + 1].id);
        }}>
          Proxima aba
        </Button>
        <Button type="button" variant="primary" disabled={readOnly} onClick={handleSubmit} loading={saveStatus === 'saving'}>
          Salvar anamnese
        </Button>
      </div>

      {submitAttempted && hasRequiredMissing ? <div className="eval-note anamnese-error-note">Nome, sexo biologico e objetivo principal sao obrigatorios.</div> : null}
      {error ? <div className="eval-note anamnese-error-note">{error}</div> : null}
    </div>
  );
};

export default AnamneseInicialForm;

const InputField = ({ label, value, onChange, disabled, type = 'text', required = false }) => (
  <div className="eval-field">
    <label className="eval-label">{label}{required ? <span className="anamnese-required">*</span> : null}</label>
    <input className="eval-input" type={type} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} />
  </div>
);

const SelectField = ({ label, value, onChange, disabled, options = [], required = false }) => (
  <div className="eval-field">
    <label className="eval-label">{label}{required ? <span className="anamnese-required">*</span> : null}</label>
    <select className="eval-select" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  </div>
);

const AreaField = ({ label, value, onChange, disabled }) => (
  <div className="eval-field eval-field-full">
    <label className="eval-label">{label}</label>
    <textarea className="eval-textarea" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} />
  </div>
);

const SummaryCard = ({ label, value, tone = 'neutral', detail = '' }) => (
  <article className={`anamnese-summary-card tone-${tone}`}>
    <span>{label}</span>
    <strong>{value}</strong>
    {detail ? <small>{detail}</small> : null}
  </article>
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
  return 'Nao definida';
}
