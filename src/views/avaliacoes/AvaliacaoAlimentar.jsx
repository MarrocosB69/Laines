import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Apple, Trash2, Save, ChevronDown, ChevronUp } from 'lucide-react';
import api, { getApiErrorMessage } from '../../services/api';
import { Button } from '../../components/ui';
import AlimentoBuscador from '../../components/AlimentoBuscador';
import EvaluationReadiness from '../../components/Avaliacoes/components/EvaluationReadiness';
import { toLocalDateInputValue } from '../../utils/dateUtils';
import '../../components/Avaliacoes/avaliacoes.css';
import './AvaliacaoAlimentar.css';

const REFEICOES_BASE = [
  { id: 'cafe_da_manha', nome: 'Café da manhã' },
  { id: 'lanche_manha', nome: 'Lanche da manhã' },
  { id: 'almoco', nome: 'Almoço' },
  { id: 'lanche_tarde', nome: 'Lanche da tarde' },
  { id: 'jantar', nome: 'Jantar' },
  { id: 'ceia', nome: 'Ceia' }
];

const EMPTY_NUTRIENTES = {
  energiaKcal: 0,
  carboidrato: 0,
  proteina: 0,
  lipidios: 0,
  fibra: 0,
  vitaminaD: 0,
  ferro: 0,
  calcio: 0,
  vitaminaB12: null,
  totalAlimentos: 0,
  totalGramas: 0
};

const EMPTY_SUPLEMENTO = () => ({
  id: buildRowId(),
  nome: '',
  dose: '',
  frequencia: '',
  objetivo: ''
});

const EMPTY_ROTINA_CLINICA = () => ({
  horarioTreinoPrincipal: '',
  periodoTreino: '',
  fomePosTreino: '',
  adesaoPlanoAlimentar: '',
  adesaoHidratacao: '',
  principalBarreira: '',
  estrategiaAjuste: '',
  modalidadeContexto: '',
  frequenciaSemanalContexto: ''
});

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(String(value).replace(',', '.').trim());
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeDateValue = (value) => {
  if (!value) return toLocalDateInputValue(new Date());
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return value.trim();
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return toLocalDateInputValue(new Date());
  return toLocalDateInputValue(date);
};

const normalizeRefeicoes = (value) => {
  const fromSnapshot = Array.isArray(value) ? value : [];
  const byId = new Map();
  fromSnapshot.forEach((row) => {
    const id = String(row?.id || '').trim();
    if (!id) return;
    const itens = Array.isArray(row?.itens)
      ? row.itens
        .map((item) => ({
          alimentoId: Number(item?.alimentoId),
          codigo: Number(item?.codigo || 0),
          descricao: String(item?.descricao || ''),
          grupo: String(item?.grupo || ''),
          medida: String(item?.medida || 'gramas'),
          medidaLabel: String(item?.medidaLabel || 'Gramas (g)'),
          fatorGramas: Number(item?.fatorGramas || 1),
          quantidadeMedida: Number(item?.quantidadeMedida || 0),
          quantidadeGramas: Number(item?.quantidadeGramas || 0),
          calorias: Number(item?.calorias || 0)
        }))
        .filter((item) => Number.isInteger(item.alimentoId) && item.quantidadeGramas > 0)
      : [];
    byId.set(id, { id, nome: String(row?.nome || id), itens });
  });
  return REFEICOES_BASE.map((base) => byId.get(base.id) || { ...base, itens: [] });
};

const normalizeSuplementos = (value) => {
  if (!Array.isArray(value)) return [EMPTY_SUPLEMENTO()];
  const rows = value
    .map((item) => ({
      id: String(item?.id || buildRowId()),
      nome: String(item?.nome || '').trim(),
      dose: String(item?.dose || '').trim(),
      frequencia: String(item?.frequencia || '').trim(),
      objetivo: String(item?.objetivo || '').trim()
    }))
    .filter((item) => item.nome || item.dose);
  return rows.length ? rows : [EMPTY_SUPLEMENTO()];
};

const normalizeRotinaClinica = (value) => {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    ...EMPTY_ROTINA_CLINICA(),
    horarioTreinoPrincipal: String(raw?.horarioTreinoPrincipal || '').trim(),
    periodoTreino: String(raw?.periodoTreino || '').trim(),
    fomePosTreino: String(raw?.fomePosTreino || '').trim(),
    adesaoPlanoAlimentar: String(raw?.adesaoPlanoAlimentar || '').trim(),
    adesaoHidratacao: String(raw?.adesaoHidratacao || '').trim(),
    principalBarreira: String(raw?.principalBarreira || '').trim(),
    estrategiaAjuste: String(raw?.estrategiaAjuste || '').trim(),
    modalidadeContexto: String(raw?.modalidadeContexto || '').trim(),
    frequenciaSemanalContexto: String(raw?.frequenciaSemanalContexto || '').trim()
  };
};

const buildOnboardingResumo = (onboardingContext) => {
  if (!onboardingContext || typeof onboardingContext !== 'object') return [];
  const resumo = [];
  const modalidade = String(onboardingContext?.modalidadePrincipal || '').trim();
  const frequenciaRaw = onboardingContext?.frequenciaSemanal;
  const frequencia = frequenciaRaw == null || frequenciaRaw === '' ? null : Number(frequenciaRaw);
  const status = String(onboardingContext?.status || '').trim();
  if (modalidade) resumo.push(`Modalidade: ${modalidade}`);
  if (Number.isFinite(frequencia)) resumo.push(`Frequência: ${frequencia}×/sem`);
  if (status) resumo.push(`Status: ${status}`);
  return resumo.slice(0, 3);
};

const flattenItens = (refeicoes) => refeicoes.flatMap((r) => r.itens || []);

function buildRowId() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

const AvaliacaoAlimentar = ({
  pacienteId,
  onSalvar,
  onAutoSave,
  readOnly = false,
  onboardingContext,
  moduleSnapshot,
  currentSessionId
}) => {
  const [dataAvaliacao, setDataAvaliacao] = useState(toLocalDateInputValue(new Date()));
  const [refeicoes, setRefeicoes] = useState(REFEICOES_BASE.map((item) => ({ ...item, itens: [] })));
  const [suplementos, setSuplementos] = useState([EMPTY_SUPLEMENTO()]);
  const [rotinaClinica, setRotinaClinica] = useState(EMPTY_ROTINA_CLINICA);
  const [nutrientesPreview, setNutrientesPreview] = useState(EMPTY_NUTRIENTES);
  const [saveStatus, setSaveStatus] = useState(null);
  const [error, setError] = useState('');
  const [selectedRefeicaoId, setSelectedRefeicaoId] = useState(REFEICOES_BASE[0].id);
  const [showMicros, setShowMicros] = useState(false);

  const autoSaveRef = useRef(null);
  const saveStatusResetRef = useRef(null);
  const loadedSnapshotIdRef = useRef('');
  const onboardingPrefillRef = useRef('');

  useEffect(() => {
    const snapshotId = moduleSnapshot?.id || '';
    if (!snapshotId || loadedSnapshotIdRef.current === snapshotId) return;
    const sourceDados = moduleSnapshot?.dados || {};
    const sourceResultados = moduleSnapshot?.resultados || {};
    setDataAvaliacao(normalizeDateValue(moduleSnapshot?.data || sourceDados?.dataAvaliacao));
    setRefeicoes(normalizeRefeicoes(sourceDados?.refeicoes));
    setSuplementos(normalizeSuplementos(
      sourceDados?.suplementos || sourceDados?.suplementacao || sourceDados?.dados_brutos?.suplementos
    ));
    setRotinaClinica(normalizeRotinaClinica(
      sourceDados?.rotinaClinica || sourceDados?.adesao || sourceResultados?.rotinaClinica
    ));
    const snapshotNutrientes = sourceResultados?.nutrientesR24h || sourceResultados?.calculated || {};
    setNutrientesPreview({
      ...EMPTY_NUTRIENTES,
      energiaKcal: Number(toNumber(snapshotNutrientes?.energiaKcal ?? sourceResultados?.caloriasTotal ?? sourceResultados?.totalDiario) || 0),
      carboidrato: Number(toNumber(snapshotNutrientes?.carboidrato ?? sourceResultados?.cho) || 0),
      proteina: Number(toNumber(snapshotNutrientes?.proteina ?? sourceResultados?.ptn) || 0),
      lipidios: Number(toNumber(snapshotNutrientes?.lipidios ?? sourceResultados?.lip) || 0),
      fibra: Number(toNumber(snapshotNutrientes?.fibra ?? sourceResultados?.fibras) || 0),
      vitaminaD: Number(toNumber(snapshotNutrientes?.vitaminaD ?? sourceResultados?.vitaminaD) || 0),
      ferro: Number(toNumber(snapshotNutrientes?.ferro ?? sourceResultados?.ferro) || 0),
      calcio: Number(toNumber(snapshotNutrientes?.calcio ?? sourceResultados?.calcio) || 0),
      vitaminaB12: toNumber(snapshotNutrientes?.vitaminaB12 ?? sourceResultados?.b12),
      totalAlimentos: Number(toNumber(snapshotNutrientes?.totalAlimentos) || 0),
      totalGramas: Number(toNumber(snapshotNutrientes?.totalGramas) || 0)
    });
    loadedSnapshotIdRef.current = snapshotId;
  }, [moduleSnapshot]);

  useEffect(() => {
    if (moduleSnapshot?.id) return;
    const key = JSON.stringify({
      modalidade: onboardingContext?.modalidadePrincipal || '',
      frequencia: onboardingContext?.frequenciaSemanal || '',
      status: onboardingContext?.status || ''
    });
    if (onboardingPrefillRef.current === key) return;
    setRotinaClinica((prev) => ({
      ...prev,
      modalidadeContexto: prev.modalidadeContexto || String(onboardingContext?.modalidadePrincipal || '').trim(),
      frequenciaSemanalContexto: prev.frequenciaSemanalContexto || (
        Number.isFinite(Number(onboardingContext?.frequenciaSemanal))
          ? String(Number(onboardingContext.frequenciaSemanal))
          : ''
      )
    }));
    onboardingPrefillRef.current = key;
  }, [moduleSnapshot?.id, onboardingContext]);

  const totalItens = useMemo(() => flattenItens(refeicoes).length, [refeicoes]);
  const onboardingResumo = useMemo(() => buildOnboardingResumo(onboardingContext), [onboardingContext]);
  const suplementosAtivos = useMemo(
    () => suplementos.map((item) => ({ ...item, nome: String(item?.nome || '').trim() })).filter((item) => item.nome.length > 0),
    [suplementos]
  );
  const scoreAdesaoRotina = useMemo(() => {
    const scorePlano = toNumber(rotinaClinica.adesaoPlanoAlimentar);
    const scoreHidratacao = toNumber(rotinaClinica.adesaoHidratacao);
    const valid = [scorePlano, scoreHidratacao].filter((item) => Number.isFinite(item));
    if (!valid.length) return null;
    return Number((valid.reduce((acc, item) => acc + item, 0) / valid.length).toFixed(1));
  }, [rotinaClinica.adesaoHidratacao, rotinaClinica.adesaoPlanoAlimentar]);

  const readinessItems = useMemo(() => {
    const hasNutrientPreview = Number(nutrientesPreview.energiaKcal) > 0;
    return [
      { key: 'r24h', label: 'Recordatório 24h', status: totalItens > 0 ? 'ok' : 'pending', value: `${totalItens} alimentos` },
      { key: 'taco', label: 'Cálculo TACO', status: hasNutrientPreview ? 'ok' : totalItens > 0 ? 'warning' : 'pending', value: hasNutrientPreview ? `${Number(nutrientesPreview.energiaKcal).toFixed(0)} kcal` : 'após salvar' },
      { key: 'adherence', label: 'Adesão da rotina', status: Number.isFinite(scoreAdesaoRotina) ? 'ok' : 'pending', value: Number.isFinite(scoreAdesaoRotina) ? `${scoreAdesaoRotina}/10` : 'opcional' },
      { key: 'supplements', label: 'Suplementação', status: suplementosAtivos.length > 0 ? 'warning' : 'ok', value: suplementosAtivos.length > 0 ? `${suplementosAtivos.length} ativo(s)` : 'sem registro' }
    ];
  }, [nutrientesPreview.energiaKcal, scoreAdesaoRotina, suplementosAtivos.length, totalItens]);

  const removeItem = useCallback((refeicaoId, itemIndex) => {
    setError('');
    setRefeicoes((prev) => prev.map((refeicao) => {
      if (refeicao.id !== refeicaoId) return refeicao;
      return { ...refeicao, itens: refeicao.itens.filter((_, index) => index !== itemIndex) };
    }));
  }, []);

  const addItem = useCallback((refeicaoId, item) => {
    setError('');
    setRefeicoes((prev) => prev.map((refeicao) => {
      if (refeicao.id !== refeicaoId) return refeicao;
      return { ...refeicao, itens: [...refeicao.itens, item] };
    }));
  }, []);

  const addSuplemento = useCallback(() => {
    setSuplementos((prev) => [...prev, EMPTY_SUPLEMENTO()]);
  }, []);

  const removeSuplemento = useCallback((id) => {
    setSuplementos((prev) => {
      const next = prev.filter((item) => String(item.id) !== String(id));
      return next.length ? next : [EMPTY_SUPLEMENTO()];
    });
  }, []);

  const updateSuplemento = useCallback((id, field, value) => {
    setSuplementos((prev) => prev.map((item) => String(item.id) === String(id) ? { ...item, [field]: value } : item));
  }, []);

  const updateRotinaClinica = useCallback((field, value) => {
    setRotinaClinica((prev) => ({ ...prev, [field]: value }));
  }, []);

  const dispatchSalvar = useCallback(async (auto = false) => {
    if (totalItens <= 0) {
      if (!auto) setError('Adicione ao menos um alimento no R24h.');
      return;
    }
    const dispatch = auto ? onAutoSave : onSalvar;
    if (!dispatch) return;
    setSaveStatus('saving');
    if (saveStatusResetRef.current) clearTimeout(saveStatusResetRef.current);
    try {
      const itemsCalculo = flattenItens(refeicoes).map((item) => ({
        alimentoId: Number(item.alimentoId),
        quantidadeGramas: Number(item.quantidadeGramas)
      }));
      const { data: nutrientesApi } = await api.post('/taco/calcular', itemsCalculo);
      const nutrientes = { ...EMPTY_NUTRIENTES, ...(nutrientesApi || {}) };
      const caloriasTotal = Number(toNumber(nutrientes.energiaKcal) || 0);
      await Promise.resolve(dispatch({
        tipo: 'alimentar',
        pacienteId,
        data: dataAvaliacao,
        sessaoId: moduleSnapshot?.sessaoId || currentSessionId,
        schemaVersion: 3,
        formulaId: 'taco_r24h_v1',
        formulaVersion: '1.0.0',
        dados: {
          dataAvaliacao,
          fonteTabela: 'TACO 4a edicao',
          refeicoes,
          suplementos,
          rotinaClinica,
          categorias: { in_natura: caloriasTotal, minimamente_processados: 0, processados: 0, ultraprocessados: 0 },
          totalDiario: caloriasTotal,
          source: { mode: 'manual', system: 'taco', externalRef: 'taco-4ed' }
        },
        resultados: {
          nutrientesR24h: nutrientes,
          caloriasTotal,
          totalDiario: caloriasTotal,
          adesaoPlanoAlimentar: toNumber(rotinaClinica.adesaoPlanoAlimentar),
          adesaoHidratacao: toNumber(rotinaClinica.adesaoHidratacao),
          scoreAdesaoRotina,
          usaSuplementacao: suplementosAtivos.length > 0,
          suplementosAtivos: suplementosAtivos.map((item) => ({
            nome: item.nome,
            dose: String(item.dose || '').trim() || null,
            frequencia: String(item.frequencia || '').trim() || null
          })),
          cho: Number(toNumber(nutrientes.carboidrato) || 0),
          ptn: Number(toNumber(nutrientes.proteina) || 0),
          lip: Number(toNumber(nutrientes.lipidios) || 0),
          fibras: Number(toNumber(nutrientes.fibra) || 0),
          vitaminaD: Number(toNumber(nutrientes.vitaminaD) || 0),
          ferro: Number(toNumber(nutrientes.ferro) || 0),
          calcio: Number(toNumber(nutrientes.calcio) || 0),
          b12: toNumber(nutrientes.vitaminaB12),
          calculated: { nutrientesR24h: nutrientes, caloriasTotal, scoreAdesaoRotina }
        }
      }));
      setNutrientesPreview({ ...nutrientes, energiaKcal: caloriasTotal });
      setSaveStatus('saved');
      saveStatusResetRef.current = setTimeout(() => setSaveStatus(null), 3000);
    } catch (requestError) {
      setSaveStatus('error');
      if (!auto) setError(getApiErrorMessage(requestError, 'Não foi possível salvar a avaliação alimentar.'));
    }
  }, [currentSessionId, dataAvaliacao, moduleSnapshot, onAutoSave, onSalvar, pacienteId, refeicoes, rotinaClinica, scoreAdesaoRotina, suplementos, suplementosAtivos, totalItens]);

  useEffect(() => {
    if (readOnly || !onAutoSave || totalItens <= 0) return undefined;
    clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => { dispatchSalvar(true); }, 3500);
    return () => clearTimeout(autoSaveRef.current);
  }, [dispatchSalvar, onAutoSave, readOnly, refeicoes, rotinaClinica, suplementos, totalItens]);

  useEffect(() => () => {
    if (saveStatusResetRef.current) clearTimeout(saveStatusResetRef.current);
  }, []);

  return (
    <div className={`avaliacao-alimentar-r24h${readOnly ? ' eval-card--readonly' : ''}`}>

      {/* Header */}
      <div className="eval-card avaliacao-alimentar-r24h__header">
        <div className="eval-header">
          <div className="eval-icon"><Apple size={22} /></div>
          <div>
            <h3 className="eval-title">Avaliação alimentar (R24h)</h3>
            <p className="eval-subtitle">Recordatório de 24h com cálculo via TACO</p>
          </div>
        </div>
        <div className="avaliacao-alimentar-r24h__meta">
          <div className="eval-field">
            <label className="eval-label">Data da avaliação</label>
            <input
              type="date"
              className="eval-input"
              value={dataAvaliacao}
              onChange={(event) => { setError(''); setDataAvaliacao(event.target.value); }}
              disabled={readOnly}
            />
          </div>
          <div className="avaliacao-alimentar-r24h__counter">
            <span>{totalItens}</span>
            <small>alimentos no R24h</small>
          </div>
        </div>
      </div>

      {onboardingResumo.length > 0 && (
        <div className="eval-note">
          <strong>Contexto:</strong> {onboardingResumo.join(' | ')}
        </div>
      )}

      <EvaluationReadiness items={readinessItems} />

      <div className="avaliacao-alimentar-r24h__grid">

        {/* LEFT — busca + refeições */}
        <div className="avaliacao-alimentar-r24h__refeicoes">

          {/* Busca única com seletor de refeição */}
          {!readOnly && (
            <div className="eval-card r24h-add-area">
              <div className="r24h-add-area__header">
                <span className="r24h-add-area__label">Adicionar à</span>
                <select
                  className="r24h-add-area__meal-select"
                  value={selectedRefeicaoId}
                  onChange={(event) => setSelectedRefeicaoId(event.target.value)}
                  aria-label="Selecionar refeição"
                >
                  {refeicoes.map((r) => (
                    <option key={r.id} value={r.id}>{r.nome}</option>
                  ))}
                </select>
              </div>
              <AlimentoBuscador
                disabled={readOnly}
                onAdd={(item) => addItem(selectedRefeicaoId, item)}
              />
            </div>
          )}

          {/* Cards compactos por refeição */}
          {refeicoes.map((refeicao) => {
            const kcalRefeicao = refeicao.itens.reduce((sum, i) => sum + (i.calorias || 0), 0);
            const isSelected = !readOnly && selectedRefeicaoId === refeicao.id;
            return (
              <div
                key={refeicao.id}
                className={`eval-card r24h-meal${isSelected ? ' r24h-meal--selected' : ''}`}
              >
                <div className="avaliacao-alimentar-r24h__meal-header">
                  <h4>{refeicao.nome}</h4>
                  <div className="avaliacao-alimentar-r24h__meal-stats">
                    {refeicao.itens.length > 0 && (
                      <span>{refeicao.itens.length} item{refeicao.itens.length !== 1 ? 's' : ''}</span>
                    )}
                    {kcalRefeicao > 0 && (
                      <span className="avaliacao-alimentar-r24h__meal-kcal">{kcalRefeicao.toFixed(0)} kcal</span>
                    )}
                    {!readOnly && !isSelected && (
                      <button
                        type="button"
                        className="r24h-meal__target-btn"
                        onClick={() => setSelectedRefeicaoId(refeicao.id)}
                      >
                        + aqui
                      </button>
                    )}
                    {isSelected && (
                      <span className="r24h-meal__active-tag">selecionada</span>
                    )}
                  </div>
                </div>

                {refeicao.itens.length === 0 ? (
                  <div className="avaliacao-alimentar-r24h__empty">Nenhum alimento registrado.</div>
                ) : (
                  <ul className="avaliacao-alimentar-r24h__items">
                    {refeicao.itens.map((item, index) => (
                      <li key={`${refeicao.id}-${item.alimentoId}-${index}`}>
                        <div className="avaliacao-alimentar-r24h__item-info">
                          <strong>{item.descricao}</strong>
                          <small>{item.quantidadeMedida} {item.medidaLabel} · {item.quantidadeGramas.toFixed(0)} g</small>
                        </div>
                        <div className="avaliacao-alimentar-r24h__item-right">
                          {(item.calorias || 0) > 0 && (
                            <span className="avaliacao-alimentar-r24h__item-kcal">{Number(item.calorias).toFixed(0)} kcal</span>
                          )}
                          {!readOnly && (
                            <button
                              type="button"
                              className="avaliacao-alimentar-r24h__remove-btn"
                              onClick={() => removeItem(refeicao.id, index)}
                              aria-label="Remover item"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}

          {/* Salvar — sticky na base da coluna de refeições */}
          {!readOnly && (
            <div className="avaliacao-alimentar-r24h__sticky-save">
              {error && <span className="r24h-save-error">{error}</span>}
              {saveStatus && (
                <span className={`save-indicator ${saveStatus}`}>
                  {saveStatus === 'saving' ? 'Salvando...' : saveStatus === 'saved' ? 'Salvo' : 'Erro'}
                </span>
              )}
              <Button
                type="button"
                onClick={() => dispatchSalvar(false)}
                disabled={readOnly || totalItens <= 0}
                loading={saveStatus === 'saving'}
                variant="primary"
              >
                <Save size={15} /> Salvar avaliação
              </Button>
            </div>
          )}
        </div>

        {/* RIGHT — resumo nutricional + suplementação + adesão */}
        <div className="eval-card avaliacao-alimentar-r24h__summary">

          {/* Kcal em destaque */}
          <div className="r24h-kcal-block">
            <span className="r24h-kcal-block__value">{Number(nutrientesPreview.energiaKcal || 0).toFixed(0)}</span>
            <span className="r24h-kcal-block__unit">kcal</span>
            <span className="r24h-kcal-block__label">total do dia</span>
          </div>

          {/* Macronutrientes */}
          <div className="r24h-macros-row">
            <div className="r24h-macro-pill">
              <strong>{Number(nutrientesPreview.carboidrato || 0).toFixed(0)}</strong>
              <span>g CHO</span>
            </div>
            <div className="r24h-macro-pill">
              <strong>{Number(nutrientesPreview.proteina || 0).toFixed(0)}</strong>
              <span>g PTN</span>
            </div>
            <div className="r24h-macro-pill">
              <strong>{Number(nutrientesPreview.lipidios || 0).toFixed(0)}</strong>
              <span>g LIP</span>
            </div>
            <div className="r24h-macro-pill">
              <strong>{Number(nutrientesPreview.fibra || 0).toFixed(0)}</strong>
              <span>g Fibras</span>
            </div>
          </div>

          {/* Micronutrientes (colapsável) */}
          <div className="avaliacao-alimentar-r24h__section">
            <button
              type="button"
              className="r24h-micros-toggle"
              onClick={() => setShowMicros((prev) => !prev)}
            >
              Micronutrientes
              {showMicros ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
            {showMicros && (
              <div className="avaliacao-alimentar-r24h__summary-grid">
                <div><span>Vit. D (µg)</span><strong>{Number(nutrientesPreview.vitaminaD || 0).toFixed(2)}</strong></div>
                <div><span>Ferro (mg)</span><strong>{Number(nutrientesPreview.ferro || 0).toFixed(2)}</strong></div>
                <div><span>Cálcio (mg)</span><strong>{Number(nutrientesPreview.calcio || 0).toFixed(1)}</strong></div>
                <div><span>B12 (µg)</span><strong>{Number.isFinite(nutrientesPreview.vitaminaB12) ? Number(nutrientesPreview.vitaminaB12).toFixed(2) : '—'}</strong></div>
              </div>
            )}
          </div>

          {/* Suplementação */}
          <div className="avaliacao-alimentar-r24h__section">
            <div className="avaliacao-alimentar-r24h__section-header">
              <h5>Suplementação</h5>
              {!readOnly && (
                <button type="button" className="avaliacao-alimentar-r24h__mini-btn" onClick={addSuplemento}>
                  + Adicionar
                </button>
              )}
            </div>
            <div className="avaliacao-alimentar-r24h__supp-list">
              {suplementos.map((item) => (
                <div className="avaliacao-alimentar-r24h__supp-row" key={item.id}>
                  <input
                    type="text"
                    className="eval-input"
                    placeholder="Suplemento"
                    value={item.nome}
                    onChange={(event) => updateSuplemento(item.id, 'nome', event.target.value)}
                    disabled={readOnly}
                  />
                  <input
                    type="text"
                    className="eval-input"
                    placeholder="Dose"
                    value={item.dose}
                    onChange={(event) => updateSuplemento(item.id, 'dose', event.target.value)}
                    disabled={readOnly}
                  />
                  <input
                    type="text"
                    className="eval-input"
                    placeholder="Frequência"
                    value={item.frequencia}
                    onChange={(event) => updateSuplemento(item.id, 'frequencia', event.target.value)}
                    disabled={readOnly}
                  />
                  {!readOnly && (
                    <button
                      type="button"
                      className="avaliacao-alimentar-r24h__icon-btn"
                      onClick={() => removeSuplemento(item.id)}
                      aria-label="Remover suplemento"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Adesão e rotina (simplificado) */}
          <div className="avaliacao-alimentar-r24h__section">
            <h5>Adesão e rotina</h5>
            <div className="avaliacao-alimentar-r24h__adherence-grid">
              <div className="eval-field">
                <label className="eval-label">Adesão alimentar (0–10)</label>
                <input
                  type="number" min="0" max="10"
                  className="eval-input"
                  value={rotinaClinica.adesaoPlanoAlimentar}
                  onChange={(event) => updateRotinaClinica('adesaoPlanoAlimentar', event.target.value)}
                  disabled={readOnly}
                />
              </div>
              <div className="eval-field">
                <label className="eval-label">Adesão hidratação (0–10)</label>
                <input
                  type="number" min="0" max="10"
                  className="eval-input"
                  value={rotinaClinica.adesaoHidratacao}
                  onChange={(event) => updateRotinaClinica('adesaoHidratacao', event.target.value)}
                  disabled={readOnly}
                />
              </div>
              <div className="eval-field">
                <label className="eval-label">Fome pós-treino (0–10)</label>
                <input
                  type="number" min="0" max="10"
                  className="eval-input"
                  value={rotinaClinica.fomePosTreino}
                  onChange={(event) => updateRotinaClinica('fomePosTreino', event.target.value)}
                  disabled={readOnly}
                />
              </div>
              <div className="eval-field">
                <label className="eval-label">Principal barreira</label>
                <input
                  type="text"
                  className="eval-input"
                  value={rotinaClinica.principalBarreira}
                  onChange={(event) => updateRotinaClinica('principalBarreira', event.target.value)}
                  disabled={readOnly}
                />
              </div>
            </div>
            {Number.isFinite(scoreAdesaoRotina) && (
              <div className="avaliacao-alimentar-r24h__adherence-score">
                Score adesão: <strong>{scoreAdesaoRotina}/10</strong>
              </div>
            )}
          </div>

          {readOnly && <div className="eval-note">Somente leitura para o seu perfil.</div>}
        </div>
      </div>
    </div>
  );
};

export default AvaliacaoAlimentar;
