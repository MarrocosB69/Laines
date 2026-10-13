import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Plus, Save, X } from 'lucide-react';
import { Button } from '../../ui';
import { toLocalDateInputValue } from '../../../utils/dateUtils';
import { useSaveStatus } from '../hooks/useSaveStatus';
import { useModuleSnapshot } from '../hooks/useModuleSnapshot';
import '../avaliacoes.css';
import {
  AvaliacaoModulo,
  AvaliacaoSecao,
  AvaliacaoIndice,
  Campo,
  AvisoAvaliacao,
  BarraAcoesAvaliacao
} from '../base';
import './AvaliacaoFisioterapia.css';

const FORMULA_ID = 'fisioterapia_clinica_v2';
const FORMULA_VERSION = '2.0.0';
const SCHEMA_VERSION = 3;

const Y_BALANCE_TESTS = [
  'Y Balance Test',
  'The Upper Quarter Y-Balance Test'
];

const Y_ROWS = [
  { key: 'a', label: 'A' },
  { key: 'pm', label: 'PM' },
  { key: 'pl', label: 'PL' },
  { key: 'ar', label: 'AR' },
  { key: 'ac', label: 'AC' }
];

// Rótulo (só leitor de tela) dos campos da tabela de amplitude: o texto do
// cabeçalho da coluna, somado ao movimento da linha.
const AMPLITUDE_COLUNAS = {
  movimento: 'Movimento',
  ativaD: 'Ativa D',
  ativaE: 'Ativa E',
  passivaD: 'Passiva D',
  passivaE: 'Passiva E'
};

const FISIO_INDICE = [
  { id: 'fisio-escritos', titulo: 'Escritos' },
  { id: 'fisio-sessoes', titulo: 'Sessões de medição' },
  { id: 'fisio-inspecao', titulo: 'Inspeção' },
  { id: 'fisio-palpacao', titulo: 'Dor à Palpação' },
  { id: 'fisio-perimetria', titulo: 'Perimetria' },
  { id: 'fisio-testes', titulo: 'Testes Especiais' },
  { id: 'fisio-intervencoes', titulo: 'Intervenções' }
];

const nanoid = (size = 8) => {
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  const cryptoSource = typeof crypto !== 'undefined' ? crypto : null;
  const bytes = cryptoSource?.getRandomValues
    ? cryptoSource.getRandomValues(new Uint8Array(size))
    : null;

  let id = '';
  for (let index = 0; index < size; index += 1) {
    const value = bytes ? bytes[index] : Math.floor(Math.random() * alphabet.length);
    id += alphabet[value % alphabet.length];
  }
  return id;
};

const emptyYBalance = () => ({
  nomeTest: Y_BALANCE_TESTS[0],
  tamanhoMMII: '',
  a: { d: '', e: '' },
  pm: { d: '', e: '' },
  pl: { d: '', e: '' },
  ar: { d: '', e: '' },
  ac: { d: '', e: '' }
});

const createSession = (date = toLocalDateInputValue(new Date())) => ({
  id: nanoid(8),
  data: normalizeDateValue(date),
  inspecao: '',
  dorPalpacao: '',
  perimetria: {},
  amplitudeMovimento: [],
  funcaoMuscular: { direito: '', esquerdo: '' },
  yBalance: emptyYBalance(),
  outrosTestes: ''
});

const createFormData = () => ({
  diagnosticoClinico: '',
  diagnosticoCineticofuncional: '',
  examesComplementares: '',
  sessoes: [createSession()],
  objetivosCurtoPrazo: [],
  objetivosMedioLongoPrazo: [],
  condutasCurtoPrazo: '',
  condutasMedioLongoPrazo: ''
});

const createGoal = () => ({ id: nanoid(8), texto: '', concluido: false });

const createAmplitudeRow = () => ({
  movimento: '',
  ativaD: '',
  ativaE: '',
  passivaD: '',
  passivaE: ''
});

const AvaliacaoFisioterapia = ({
  pacienteId,
  onSalvar,
  onAutoSave,
  readOnly = false,
  moduleSnapshot,
  currentSessionId
}) => {
  const [initialData] = useState(() => createFormData());
  const [formData, setFormData] = useState(initialData);
  const [activeSessionId, setActiveSessionId] = useState(() => initialData.sessoes[0]?.id || '');
  const [error, setError] = useState('');
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const autoSaveRef = useRef(null);
  const { saveStatus, setSaving, setSuccess, setFailure } = useSaveStatus();

  useModuleSnapshot(moduleSnapshot, (source, input, snapshot) => {
    const next = normalizeSnapshotData(source, input, snapshot);
    setFormData(next);
    setActiveSessionId(getMostRecentSession(next.sessoes)?.id || next.sessoes[0]?.id || '');
    setError('');
    setHasPendingChanges(false);
  });

  const sessionsOrdered = useMemo(
    () => [...formData.sessoes].sort((a, b) => String(a.data || '').localeCompare(String(b.data || ''))),
    [formData.sessoes]
  );

  const activeSession = useMemo(() => (
    formData.sessoes.find((session) => session.id === activeSessionId)
    || getMostRecentSession(formData.sessoes)
    || formData.sessoes[0]
    || createSession()
  ), [activeSessionId, formData.sessoes]);

  const activeYBalance = useMemo(
    () => normalizeYBalance(activeSession.yBalance),
    [activeSession.yBalance]
  );

  const yBalanceComputed = useMemo(
    () => computeYBalance(activeYBalance),
    [activeYBalance]
  );

  const markChanged = useCallback(() => {
    setError('');
    setHasPendingChanges(true);
  }, []);

  const updateRootField = useCallback((field, value) => {
    markChanged();
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, [markChanged]);

  const updateActiveSession = useCallback((updater) => {
    markChanged();
    setFormData((prev) => ({
      ...prev,
      sessoes: prev.sessoes.map((session) => {
        if (session.id !== activeSessionId) return session;
        return typeof updater === 'function' ? updater(session) : { ...session, ...updater };
      })
    }));
  }, [activeSessionId, markChanged]);

  const handleAddSession = useCallback(() => {
    const next = createSession();
    markChanged();
    setFormData((prev) => ({ ...prev, sessoes: [...prev.sessoes, next] }));
    setActiveSessionId(next.id);
  }, [markChanged]);

  const updateSessionDate = useCallback((value) => {
    updateActiveSession((session) => ({ ...session, data: normalizeDateValue(value) }));
  }, [updateActiveSession]);

  const updatePerimetriaValue = useCallback((segmento, value) => {
    updateActiveSession((session) => ({
      ...session,
      perimetria: { ...(session.perimetria || {}), [segmento]: value }
    }));
  }, [updateActiveSession]);

  const updatePerimetriaSegment = useCallback((oldSegmento, nextSegmento) => {
    updateActiveSession((session) => {
      const current = session.perimetria || {};
      const entries = Object.entries(current);
      const normalizedNext = nextSegmento;
      const next = {};
      entries.forEach(([key, value]) => {
        if (key === oldSegmento) next[normalizedNext] = value;
        else next[key] = value;
      });
      return { ...session, perimetria: next };
    });
  }, [updateActiveSession]);

  const addPerimetriaRow = useCallback(() => {
    updateActiveSession((session) => {
      const current = session.perimetria || {};
      let index = Object.keys(current).length + 1;
      let key = `Segmento ${index}`;
      while (Object.prototype.hasOwnProperty.call(current, key)) {
        index += 1;
        key = `Segmento ${index}`;
      }
      return { ...session, perimetria: { ...current, [key]: '' } };
    });
  }, [updateActiveSession]);

  const removePerimetriaRow = useCallback((segmento) => {
    updateActiveSession((session) => {
      const next = { ...(session.perimetria || {}) };
      delete next[segmento];
      return { ...session, perimetria: next };
    });
  }, [updateActiveSession]);

  const updateAmplitudeRow = useCallback((index, field, value) => {
    updateActiveSession((session) => ({
      ...session,
      amplitudeMovimento: normalizeAmplitudeRows(session.amplitudeMovimento).map((row, rowIndex) => (
        rowIndex === index ? { ...row, [field]: value } : row
      ))
    }));
  }, [updateActiveSession]);

  const addAmplitudeRow = useCallback(() => {
    updateActiveSession((session) => ({
      ...session,
      amplitudeMovimento: [...normalizeAmplitudeRows(session.amplitudeMovimento), createAmplitudeRow()]
    }));
  }, [updateActiveSession]);

  const removeAmplitudeRow = useCallback((index) => {
    updateActiveSession((session) => ({
      ...session,
      amplitudeMovimento: normalizeAmplitudeRows(session.amplitudeMovimento).filter((_, rowIndex) => rowIndex !== index)
    }));
  }, [updateActiveSession]);

  const updateFuncaoMuscular = useCallback((side, value) => {
    updateActiveSession((session) => ({
      ...session,
      funcaoMuscular: {
        direito: toText(session.funcaoMuscular?.direito),
        esquerdo: toText(session.funcaoMuscular?.esquerdo),
        [side]: value
      }
    }));
  }, [updateActiveSession]);

  const updateYBalanceField = useCallback((field, value) => {
    updateActiveSession((session) => ({
      ...session,
      yBalance: { ...normalizeYBalance(session.yBalance), [field]: value }
    }));
  }, [updateActiveSession]);

  const updateYBalanceSide = useCallback((rowKey, side, value) => {
    updateActiveSession((session) => {
      const yBalance = normalizeYBalance(session.yBalance);
      return {
        ...session,
        yBalance: {
          ...yBalance,
          [rowKey]: {
            ...yBalance[rowKey],
            [side]: value
          }
        }
      };
    });
  }, [updateActiveSession]);

  const addGoal = useCallback((field) => {
    markChanged();
    setFormData((prev) => ({ ...prev, [field]: [...normalizeGoals(prev[field]), createGoal()] }));
  }, [markChanged]);

  const updateGoal = useCallback((field, id, patch) => {
    markChanged();
    setFormData((prev) => ({
      ...prev,
      [field]: normalizeGoals(prev[field]).map((item) => (
        item.id === id ? { ...item, ...patch } : item
      ))
    }));
  }, [markChanged]);

  const removeGoal = useCallback((field, id) => {
    markChanged();
    setFormData((prev) => ({
      ...prev,
      [field]: normalizeGoals(prev[field]).filter((item) => item.id !== id)
    }));
  }, [markChanged]);

  const payload = useMemo(() => ({
    tipo: 'fisioterapia',
    pacienteId,
    formulaId: FORMULA_ID,
    formulaVersion: FORMULA_VERSION,
    schemaVersion: SCHEMA_VERSION,
    sourceSystem: 'manual',
    sessaoId: moduleSnapshot?.sessaoId || currentSessionId,
    dados: buildDadosForSave(formData)
  }), [currentSessionId, formData, moduleSnapshot?.sessaoId, pacienteId]);

  const hasInput = useMemo(() => hasFisioterapiaInput(formData), [formData]);

  const dispatchSalvar = useCallback(async (auto = false) => {
    const dispatch = auto ? onAutoSave : onSalvar;
    if (!dispatch) return;

    if (!auto && !hasInput) {
      setError('Preencha ao menos um campo da avaliação de fisioterapia.');
      return;
    }

    setSaving();
    try {
      await Promise.resolve(dispatch(payload));
      setSuccess();
      setHasPendingChanges(false);
    } catch {
      setFailure();
      if (!auto) setError('Não foi possível salvar a avaliação de fisioterapia.');
    }
  }, [hasInput, onAutoSave, onSalvar, payload, setFailure, setSaving, setSuccess]);

  useEffect(() => {
    if (readOnly || !onAutoSave || !hasPendingChanges) return undefined;
    clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => {
      void dispatchSalvar(true);
    }, 3500);
    return () => clearTimeout(autoSaveRef.current);
  }, [dispatchSalvar, hasPendingChanges, onAutoSave, readOnly]);

  const perimetriaRows = Object.entries(activeSession.perimetria || {});
  const amplitudeRows = normalizeAmplitudeRows(activeSession.amplitudeMovimento);
  const funcaoMuscular = {
    direito: toText(activeSession.funcaoMuscular?.direito),
    esquerdo: toText(activeSession.funcaoMuscular?.esquerdo)
  };
  const objetivosCurto = normalizeGoals(formData.objetivosCurtoPrazo);
  const objetivosMedioLongo = normalizeGoals(formData.objetivosMedioLongoPrazo);

  // h6 por exceção (contrato, seção 2): a lista fica dentro da subseção
  // "Objetivos" (h5) de "Intervenções" (h4).
  const renderChecklist = (field, title, items) => (
    <div className="fisio-checklist-block">
      <h6 className="fisio-subtitle">{title}</h6>
      <div className="fisio-checklist" role="list">
        {items.length === 0 ? (
          <p className="fisio-empty">Nenhum objetivo registrado.</p>
        ) : items.map((item) => (
          <div
            key={item.id}
            className={`fisio-checklist__item${item.concluido ? ' fisio-checklist__item--done' : ''}`}
            role="listitem"
          >
            <input
              type="checkbox"
              checked={item.concluido}
              onChange={(event) => updateGoal(field, item.id, { concluido: event.target.checked })}
              disabled={readOnly}
              aria-label={`Concluir objetivo: ${item.texto || title}`}
            />
            <Campo rotulo={`Texto do objetivo, ${title}`} rotuloOculto>
              <input
                type="text"
                className="eval-input"
                value={item.texto}
                onChange={(event) => updateGoal(field, item.id, { texto: event.target.value })}
                placeholder="Texto do objetivo"
                disabled={readOnly}
              />
            </Campo>
            <button
              type="button"
              className="fisio-icon-btn"
              onClick={() => removeGoal(field, item.id)}
              disabled={readOnly}
              aria-label="Remover objetivo"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="fisio-row-add"
        onClick={() => addGoal(field)}
        disabled={readOnly}
      >
        <Plus size={14} /> Adicionar objetivo
      </button>
    </div>
  );

  return (
    <AvaliacaoModulo
      className={`eval-card avaliacao-fisioterapia${readOnly ? ' eval-card--readonly' : ''}`}
      titulo="Avaliação de fisioterapia"
      descricao="Registro clínico funcional com sessões de medição e plano de intervenção"
      icone={<Activity size={22} />}
    >
      <AvaliacaoIndice itens={FISIO_INDICE} />

      {readOnly && <AvisoAvaliacao tipo="info">Somente leitura para o seu perfil.</AvisoAvaliacao>}

      <AvaliacaoSecao id="fisio-escritos" titulo="Escritos" className="eval-section">
        <div className="eval-grid">
          <Campo rotulo="Diagnóstico Clínico" className="eval-field eval-field-full">
            <textarea
              className="eval-textarea"
              rows={4}
              value={formData.diagnosticoClinico}
              onChange={(event) => updateRootField('diagnosticoClinico', event.target.value)}
              disabled={readOnly}
            />
          </Campo>
          <Campo rotulo="Diagnóstico Cineticofuncional" className="eval-field eval-field-full">
            <textarea
              className="eval-textarea"
              rows={4}
              value={formData.diagnosticoCineticofuncional}
              onChange={(event) => updateRootField('diagnosticoCineticofuncional', event.target.value)}
              disabled={readOnly}
            />
          </Campo>
          <Campo rotulo="Exames Complementares" className="eval-field eval-field-full">
            <textarea
              className="eval-textarea"
              rows={4}
              value={formData.examesComplementares}
              onChange={(event) => updateRootField('examesComplementares', event.target.value)}
              disabled={readOnly}
            />
          </Campo>
        </div>
      </AvaliacaoSecao>

      {/* Tudo o que muda com a sessão escolhida fica numa faixa só, abaixo
          das abas: data, inspeção, palpação, perimetria e testes. Escritos e
          intervenções valem para a avaliação inteira e ficam fora dela. */}
      <div className="fisio-sessao-grupo">
        <AvaliacaoSecao id="fisio-sessoes" titulo="Sessões de medição" className="eval-section">
          <div className="fisio-session-nav" role="group" aria-label="Sessões de medição">
            <button
              type="button"
              className="fisio-session-add"
              onClick={handleAddSession}
              disabled={readOnly}
            >
              <Plus size={14} /> Nova sessão
            </button>
            {sessionsOrdered.map((session) => (
              <button
                key={session.id}
                type="button"
                className={`fisio-session-tab${session.id === activeSession.id ? ' fisio-session-tab--active' : ''}`}
                onClick={() => setActiveSessionId(session.id)}
                aria-pressed={session.id === activeSession.id}
              >
                {formatDateLabel(session.data)}
                {session.id === activeSession.id ? <span aria-hidden="true">●</span> : null}
              </button>
            ))}
          </div>
          <div className="eval-grid eval-grid-compact">
            <Campo rotulo="Data da sessão" className="eval-field">
              <input
                type="date"
                className="eval-input"
                value={normalizeDateValue(activeSession.data)}
                onChange={(event) => updateSessionDate(event.target.value)}
                disabled={readOnly}
              />
            </Campo>
          </div>
        </AvaliacaoSecao>

        {/* Inspeção e Dor à Palpação: o rótulo do campo é o título da seção. */}
        <AvaliacaoSecao id="fisio-inspecao" titulo="Inspeção" className="eval-section">
          <Campo rotulo="Inspeção" rotuloOculto className="eval-field eval-field-full">
            <textarea
              className="eval-textarea"
              rows={4}
              value={activeSession.inspecao || ''}
              onChange={(event) => updateActiveSession({ inspecao: event.target.value })}
              disabled={readOnly}
            />
          </Campo>
        </AvaliacaoSecao>

        <AvaliacaoSecao id="fisio-palpacao" titulo="Dor à Palpação" className="eval-section">
          <Campo rotulo="Dor à Palpação" rotuloOculto className="eval-field eval-field-full">
            <textarea
              className="eval-textarea"
              rows={3}
              value={activeSession.dorPalpacao || ''}
              onChange={(event) => updateActiveSession({ dorPalpacao: event.target.value })}
              disabled={readOnly}
            />
          </Campo>
        </AvaliacaoSecao>

        <AvaliacaoSecao id="fisio-perimetria" titulo="Perimetria" className="eval-section">
          <div className="fisio-table-wrap">
            <table className="fisio-table">
              <thead>
                <tr>
                  <th>Segmento</th>
                  <th>Valor (cm)</th>
                  <th aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {perimetriaRows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="fisio-table__empty">Nenhuma medida adicionada.</td>
                  </tr>
                ) : perimetriaRows.map(([segmento, valor]) => (
                  <tr key={segmento}>
                    <td>
                      <Campo rotulo="Segmento" rotuloOculto>
                        <input
                          type="text"
                          className="eval-input"
                          value={segmento}
                          onChange={(event) => updatePerimetriaSegment(segmento, event.target.value)}
                          placeholder="Ex: Braço D"
                          disabled={readOnly}
                        />
                      </Campo>
                    </td>
                    <td>
                      <Campo rotulo={`${segmento || 'Segmento'}, Valor (cm)`} rotuloOculto>
                        <input
                          type="number"
                          className="eval-input"
                          value={valor}
                          onChange={(event) => updatePerimetriaValue(segmento, event.target.value)}
                          disabled={readOnly}
                        />
                      </Campo>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="fisio-icon-btn"
                        onClick={() => removePerimetriaRow(segmento)}
                        disabled={readOnly}
                        aria-label={`Remover medida ${segmento}`}
                      >
                        <X size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" className="fisio-row-add" onClick={addPerimetriaRow} disabled={readOnly}>
            <Plus size={14} /> Adicionar medida
          </button>
        </AvaliacaoSecao>

        <AvaliacaoSecao id="fisio-testes" titulo="Testes Especiais" className="eval-section">
          <AvaliacaoSecao titulo="Amplitude de Movimento" className="fisio-subsection">
            <div className="fisio-table-wrap">
              <table className="fisio-table">
                <thead>
                  <tr>
                    <th>Movimento</th>
                    <th>Ativa D</th>
                    <th>Ativa E</th>
                    <th>Passiva D</th>
                    <th>Passiva E</th>
                    <th aria-label="Ações" />
                  </tr>
                </thead>
                <tbody>
                  {amplitudeRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="fisio-table__empty">Nenhum movimento adicionado.</td>
                    </tr>
                  ) : amplitudeRows.map((row, index) => (
                    <tr key={`amplitude-${index}`}>
                      {['movimento', 'ativaD', 'ativaE', 'passivaD', 'passivaE'].map((field) => (
                        <td key={field}>
                          <Campo
                            rotulo={field === 'movimento'
                              ? AMPLITUDE_COLUNAS.movimento
                              : `${row.movimento || AMPLITUDE_COLUNAS.movimento}, ${AMPLITUDE_COLUNAS[field]}`}
                            rotuloOculto
                          >
                            <input
                              type={field === 'movimento' ? 'text' : 'text'}
                              className="eval-input"
                              value={row[field]}
                              onChange={(event) => updateAmplitudeRow(index, field, event.target.value)}
                              disabled={readOnly}
                            />
                          </Campo>
                        </td>
                      ))}
                      <td>
                        <button
                          type="button"
                          className="fisio-icon-btn"
                          onClick={() => removeAmplitudeRow(index)}
                          disabled={readOnly}
                          aria-label="Remover movimento"
                        >
                          <X size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" className="fisio-row-add" onClick={addAmplitudeRow} disabled={readOnly}>
              <Plus size={14} /> Adicionar movimento
            </button>
          </AvaliacaoSecao>

          <AvaliacaoSecao titulo="Função Muscular" className="fisio-subsection">
            <div className="fisio-two-col">
              <Campo rotulo="Direito" className="eval-field">
                <textarea
                  className="eval-textarea"
                  rows={4}
                  value={funcaoMuscular.direito}
                  onChange={(event) => updateFuncaoMuscular('direito', event.target.value)}
                  disabled={readOnly}
                />
              </Campo>
              <Campo rotulo="Esquerdo" className="eval-field">
                <textarea
                  className="eval-textarea"
                  rows={4}
                  value={funcaoMuscular.esquerdo}
                  onChange={(event) => updateFuncaoMuscular('esquerdo', event.target.value)}
                  disabled={readOnly}
                />
              </Campo>
            </div>
          </AvaliacaoSecao>

          <AvaliacaoSecao titulo="Y-Balance Test" className="fisio-subsection">
            <div className="eval-grid eval-grid-compact">
              <Campo rotulo="Teste" className="eval-field">
                <select
                  className="eval-select"
                  value={activeYBalance.nomeTest}
                  onChange={(event) => updateYBalanceField('nomeTest', event.target.value)}
                  disabled={readOnly}
                >
                  {Y_BALANCE_TESTS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </Campo>
              <Campo rotulo="Tamanho do MMII (cm)" className="eval-field">
                <input
                  type="number"
                  className="eval-input"
                  value={activeYBalance.tamanhoMMII}
                  onChange={(event) => updateYBalanceField('tamanhoMMII', event.target.value)}
                  disabled={readOnly}
                />
              </Campo>
            </div>

            {/* Os valores calculados continuam como antes: "-" quando falta
                medida, e o cálculo fica em computeYBalance. */}
            <div className="fisio-table-wrap">
              <table className="fisio-table">
                <thead>
                  <tr>
                    <th>Linha</th>
                    <th>Direito</th>
                    <th>Esquerdo</th>
                    <th>Assimetria (cm)</th>
                    <th>Assimetria (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {Y_ROWS.map(({ key, label }) => {
                    const row = yBalanceComputed.rows[key];
                    const isComputed = key === 'ac' || (key === 'ar' && yBalanceComputed.arAuto);
                    const isManualAr = key === 'ar' && !yBalanceComputed.arAuto;
                    return (
                      <tr key={key}>
                        <th>{label}</th>
                        <td className={isComputed ? 'fisio-table__computed' : ''}>
                          {key === 'ac' ? (
                            row.d || '-'
                          ) : isComputed ? (
                            row.d || '-'
                          ) : (
                            <Campo rotulo={`${label}, Direito`} rotuloOculto>
                              <input
                                type="number"
                                className="eval-input"
                                value={isManualAr ? activeYBalance.ar.d : activeYBalance[key].d}
                                onChange={(event) => updateYBalanceSide(key, 'd', event.target.value)}
                                disabled={readOnly}
                              />
                            </Campo>
                          )}
                        </td>
                        <td className={isComputed ? 'fisio-table__computed' : ''}>
                          {key === 'ac' ? (
                            row.e || '-'
                          ) : isComputed ? (
                            row.e || '-'
                          ) : (
                            <Campo rotulo={`${label}, Esquerdo`} rotuloOculto>
                              <input
                                type="number"
                                className="eval-input"
                                value={isManualAr ? activeYBalance.ar.e : activeYBalance[key].e}
                                onChange={(event) => updateYBalanceSide(key, 'e', event.target.value)}
                                disabled={readOnly}
                              />
                            </Campo>
                          )}
                        </td>
                        <td className="fisio-table__computed">{row.assimetriaCm || '-'}</td>
                        <td className="fisio-table__computed">{row.assimetriaPct || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </AvaliacaoSecao>

          <AvaliacaoSecao titulo="Outros Testes" className="fisio-subsection">
            <Campo rotulo="Outros Testes" rotuloOculto className="eval-field eval-field-full">
              <textarea
                className="eval-textarea"
                rows={6}
                value={activeSession.outrosTestes || ''}
                onChange={(event) => updateActiveSession({ outrosTestes: event.target.value })}
                disabled={readOnly}
              />
            </Campo>
          </AvaliacaoSecao>
        </AvaliacaoSecao>
      </div>

      {/* Os dois pares "Curto Prazo" / "Médio e Longo Prazo" eram só
          rótulos soltos: as subseções dizem qual é objetivo e qual é conduta
          (objetivosCurtoPrazo... e condutasCurtoPrazo... no dado salvo). */}
      <AvaliacaoSecao id="fisio-intervencoes" titulo="Intervenções" className="eval-section">
        <AvaliacaoSecao titulo="Objetivos">
          <div className="fisio-two-col">
            {renderChecklist('objetivosCurtoPrazo', 'Curto Prazo', objetivosCurto)}
            {renderChecklist('objetivosMedioLongoPrazo', 'Médio e Longo Prazo', objetivosMedioLongo)}
          </div>
        </AvaliacaoSecao>

        <AvaliacaoSecao titulo="Condutas">
          <div className="fisio-two-col fisio-condutas">
            <Campo rotulo="Curto Prazo" className="eval-field">
              <textarea
                className="eval-textarea"
                rows={5}
                value={formData.condutasCurtoPrazo}
                onChange={(event) => updateRootField('condutasCurtoPrazo', event.target.value)}
                disabled={readOnly}
              />
            </Campo>
            <Campo rotulo="Médio e Longo Prazo" className="eval-field">
              <textarea
                className="eval-textarea"
                rows={5}
                value={formData.condutasMedioLongoPrazo}
                onChange={(event) => updateRootField('condutasMedioLongoPrazo', event.target.value)}
                disabled={readOnly}
              />
            </Campo>
          </div>
        </AvaliacaoSecao>
      </AvaliacaoSecao>

      <BarraAcoesAvaliacao status={saveStatus}>
        <Button
          type="button"
          variant="primary"
          onClick={() => dispatchSalvar(false)}
          disabled={readOnly}
          loading={saveStatus === 'saving'}
        >
          <Save size={18} /> Salvar avaliação
        </Button>
      </BarraAcoesAvaliacao>
      {error && <AvisoAvaliacao tipo="perigo" anunciar className="form-error-message">{error}</AvisoAvaliacao>}
    </AvaliacaoModulo>
  );
};

export default AvaliacaoFisioterapia;

function normalizeSnapshotData(source = {}, input = {}, snapshot = {}) {
  const baseDate = normalizeDateValue(snapshot?.data || source?.dataAvaliacao || input?.dataAvaliacao);
  const sessoes = normalizeSessions(source.sessoes, baseDate);
  return {
    diagnosticoClinico: toText(source.diagnosticoClinico ?? input.diagnosticoClinico),
    diagnosticoCineticofuncional: toText(source.diagnosticoCineticofuncional ?? input.diagnosticoCineticofuncional),
    examesComplementares: toText(source.examesComplementares ?? input.examesComplementares),
    sessoes,
    objetivosCurtoPrazo: normalizeGoals(source.objetivosCurtoPrazo ?? input.objetivosCurtoPrazo),
    objetivosMedioLongoPrazo: normalizeGoals(source.objetivosMedioLongoPrazo ?? input.objetivosMedioLongoPrazo),
    condutasCurtoPrazo: toText(source.condutasCurtoPrazo ?? input.condutasCurtoPrazo),
    condutasMedioLongoPrazo: toText(source.condutasMedioLongoPrazo ?? input.condutasMedioLongoPrazo)
  };
}

function normalizeSessions(value, fallbackDate = toLocalDateInputValue(new Date())) {
  const rows = Array.isArray(value)
    ? value.map((session) => normalizeSession(session)).filter(Boolean)
    : [];
  return rows.length > 0 ? rows : [createSession(fallbackDate)];
}

function normalizeSession(session) {
  if (!session || typeof session !== 'object' || Array.isArray(session)) return null;
  const id = toText(session.id) || nanoid(8);
  return {
    ...session,
    id,
    data: normalizeDateValue(session.data),
    inspecao: toText(session.inspecao),
    dorPalpacao: toText(session.dorPalpacao),
    perimetria: normalizePerimetria(session.perimetria),
    amplitudeMovimento: normalizeAmplitudeRows(session.amplitudeMovimento),
    funcaoMuscular: {
      direito: toText(session.funcaoMuscular?.direito),
      esquerdo: toText(session.funcaoMuscular?.esquerdo)
    },
    yBalance: normalizeYBalance(session.yBalance),
    outrosTestes: toText(session.outrosTestes)
  };
}

function normalizePerimetria(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.entries(value).reduce((acc, [key, rowValue]) => {
    acc[toText(key)] = toText(rowValue);
    return acc;
  }, {});
}

function normalizeAmplitudeRows(value) {
  if (!Array.isArray(value)) return [];
  return value.map((row) => ({
    movimento: toText(row?.movimento),
    ativaD: toText(row?.ativaD),
    ativaE: toText(row?.ativaE),
    passivaD: toText(row?.passivaD),
    passivaE: toText(row?.passivaE)
  }));
}

function normalizeGoals(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => ({
    id: toText(item?.id) || nanoid(8),
    texto: toText(item?.texto),
    concluido: Boolean(item?.concluido)
  }));
}

function normalizeYBalance(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    nomeTest: Y_BALANCE_TESTS.includes(source.nomeTest) ? source.nomeTest : Y_BALANCE_TESTS[0],
    tamanhoMMII: toText(source.tamanhoMMII),
    a: normalizeSidePair(source.a),
    pm: normalizeSidePair(source.pm),
    pl: normalizeSidePair(source.pl),
    ar: normalizeSidePair(source.ar),
    ac: normalizeSidePair(source.ac)
  };
}

function normalizeSidePair(value) {
  return {
    d: toText(value?.d),
    e: toText(value?.e)
  };
}

function buildDadosForSave(data) {
  return {
    diagnosticoClinico: toText(data.diagnosticoClinico),
    diagnosticoCineticofuncional: toText(data.diagnosticoCineticofuncional),
    examesComplementares: toText(data.examesComplementares),
    sessoes: normalizeSessions(data.sessoes).map((session) => {
      const yBalance = normalizeYBalance(session.yBalance);
      const computed = computeYBalance(yBalance);
      return {
        ...session,
        yBalance: {
          ...yBalance,
          ar: computed.rows.ar.raw,
          ac: computed.rows.ac.raw
        }
      };
    }),
    objetivosCurtoPrazo: normalizeGoals(data.objetivosCurtoPrazo),
    objetivosMedioLongoPrazo: normalizeGoals(data.objetivosMedioLongoPrazo),
    condutasCurtoPrazo: toText(data.condutasCurtoPrazo),
    condutasMedioLongoPrazo: toText(data.condutasMedioLongoPrazo)
  };
}

function computeYBalance(yBalance) {
  const size = toNumber(yBalance.tamanhoMMII);
  const a = normalizeNumericPair(yBalance.a);
  const pm = normalizeNumericPair(yBalance.pm);
  const pl = normalizeNumericPair(yBalance.pl);
  const ac = {
    d: sumIfComplete(a.d, pm.d, pl.d),
    e: sumIfComplete(a.e, pm.e, pl.e)
  };
  const arAuto = Number.isFinite(size) && size > 0;
  const ar = arAuto
    ? {
        d: Number.isFinite(ac.d) ? (ac.d / (3 * size)) * 100 : null,
        e: Number.isFinite(ac.e) ? (ac.e / (3 * size)) * 100 : null
      }
    : normalizeNumericPair(yBalance.ar);

  const rows = {
    a: buildYBalanceRow(a.d, a.e),
    pm: buildYBalanceRow(pm.d, pm.e),
    pl: buildYBalanceRow(pl.d, pl.e),
    ar: buildYBalanceRow(ar.d, ar.e),
    ac: buildYBalanceRow(ac.d, ac.e)
  };

  return { rows, arAuto };
}

function buildYBalanceRow(d, e) {
  const asymmetry = Number.isFinite(d) && Number.isFinite(e) ? Math.abs(d - e) : null;
  const max = Number.isFinite(d) && Number.isFinite(e) ? Math.max(d, e) : null;
  const asymmetryPct = Number.isFinite(asymmetry) && Number.isFinite(max) && max > 0
    ? (asymmetry / max) * 100
    : null;
  return {
    d: formatMaybe(d),
    e: formatMaybe(e),
    raw: {
      d: formatMaybe(d),
      e: formatMaybe(e)
    },
    assimetriaCm: formatMaybe(asymmetry),
    assimetriaPct: formatMaybe(asymmetryPct)
  };
}

function normalizeNumericPair(value) {
  return {
    d: toNumber(value?.d),
    e: toNumber(value?.e)
  };
}

function sumIfComplete(...values) {
  return values.every(Number.isFinite)
    ? values.reduce((total, value) => total + value, 0)
    : null;
}

function hasFisioterapiaInput(data) {
  const rootText = [
    data.diagnosticoClinico,
    data.diagnosticoCineticofuncional,
    data.examesComplementares,
    data.condutasCurtoPrazo,
    data.condutasMedioLongoPrazo
  ].some(Boolean);
  const goals = [...normalizeGoals(data.objetivosCurtoPrazo), ...normalizeGoals(data.objetivosMedioLongoPrazo)]
    .some((item) => item.texto || item.concluido);
  const sessions = normalizeSessions(data.sessoes).some((session) => (
    session.inspecao
    || session.dorPalpacao
    || Object.keys(session.perimetria || {}).length > 0
    || normalizeAmplitudeRows(session.amplitudeMovimento).length > 0
    || session.funcaoMuscular?.direito
    || session.funcaoMuscular?.esquerdo
    || hasYBalanceInput(session.yBalance)
    || session.outrosTestes
  ));
  return rootText || goals || sessions;
}

function hasYBalanceInput(value) {
  const yBalance = normalizeYBalance(value);
  return Boolean(
    yBalance.tamanhoMMII
    || yBalance.a.d
    || yBalance.a.e
    || yBalance.pm.d
    || yBalance.pm.e
    || yBalance.pl.d
    || yBalance.pl.e
    || yBalance.ar.d
    || yBalance.ar.e
  );
}

function getMostRecentSession(sessions = []) {
  return [...sessions]
    .filter((session) => session?.id)
    .sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')))[0] || null;
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

function formatDateLabel(value) {
  const normalized = normalizeDateValue(value);
  const [year, month, day] = normalized.split('-');
  return `${day}/${month}/${year}`;
}

function toText(value) {
  if (value === null || value === undefined) return '';
  return String(value);
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value).replace(',', '.').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function formatMaybe(value) {
  return Number.isFinite(value) ? Number(value).toFixed(2) : '';
}
