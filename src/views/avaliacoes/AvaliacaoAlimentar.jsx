import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Apple, Trash2, Save, ChevronDown, ChevronUp } from 'lucide-react';
import api, { getApiErrorMessage } from '../../services/api';
import { Button } from '../../components/ui';
import AlimentoBuscador from '../../components/AlimentoBuscador';
import EvaluationReadiness from '../../components/Avaliacoes/components/EvaluationReadiness';
import { toLocalDateInputValue } from '../../utils/dateUtils';
import '../../components/Avaliacoes/avaliacoes.css';
import {
  AvaliacaoModulo,
  AvaliacaoSecao,
  AvaliacaoIndice,
  Campo,
  ResultadoCalculado,
  AvisoAvaliacao,
  BarraAcoesAvaliacao
} from '../../components/Avaliacoes/base';
import './AvaliacaoAlimentar.css';

const NOVA_GRUPOS = [
  { id: 'in_natura', label: 'In natura', short: '1' },
  { id: 'minimamente_processado', label: 'Min. processado', short: '2' },
  { id: 'processado', label: 'Processado', short: '3' },
  { id: 'ultraprocessado', label: 'Ultraprocessado', short: '4' }
];

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

const normalizeAlimentoItem = (item) => {
  const carboidrato = Number(toNumber(item?.carboidrato ?? item?.cho) || 0);
  const proteina = Number(toNumber(item?.proteina ?? item?.ptn) || 0);
  const lipidios = Number(toNumber(item?.lipidios ?? item?.lip) || 0);
  const fibra = Number(toNumber(item?.fibra) || 0);
  const calorias = Number(toNumber(item?.calorias ?? item?.energiaKcal) || 0);

  return {
    alimentoId: Number(item?.alimentoId),
    codigo: Number(item?.codigo || 0),
    descricao: String(item?.descricao || ''),
    grupo: String(item?.grupo || ''),
    medida: String(item?.medida || 'gramas'),
    medidaLabel: String(item?.medidaLabel || 'Gramas (g)'),
    fatorGramas: Number(item?.fatorGramas || 1),
    quantidadeMedida: Number(item?.quantidadeMedida || 0),
    quantidadeGramas: Number(item?.quantidadeGramas || 0),
    calorias,
    carboidrato,
    proteina,
    lipidios,
    cho: carboidrato,
    ptn: proteina,
    lip: lipidios,
    fibra,
    novaGrupo: String(item?.novaGrupo || ''),
    nutrientesPor100g: item?.nutrientesPor100g && typeof item.nutrientesPor100g === 'object'
      ? item.nutrientesPor100g
      : undefined
  };
};

const normalizeRefeicoes = (value) => {
  const fromSnapshot = Array.isArray(value) ? value : [];
  const byId = new Map();
  fromSnapshot.forEach((row) => {
    const id = String(row?.id || '').trim();
    if (!id) return;
    const itens = Array.isArray(row?.itens)
      ? row.itens
        .map(normalizeAlimentoItem)
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

  const nutrientesRealtime = useMemo(() => {
    const itens = flattenItens(refeicoes);
    const sumBy = (picker) => Number(itens.reduce((sum, item) => sum + Number(toNumber(picker(item)) || 0), 0).toFixed(2));

    return {
      ...EMPTY_NUTRIENTES,
      energiaKcal: sumBy((item) => item.calorias),
      carboidrato: sumBy((item) => item.carboidrato ?? item.cho),
      proteina: sumBy((item) => item.proteina ?? item.ptn),
      lipidios: sumBy((item) => item.lipidios ?? item.lip),
      fibra: sumBy((item) => item.fibra),
      totalAlimentos: itens.length,
      totalGramas: sumBy((item) => item.quantidadeGramas)
    };
  }, [refeicoes]);

  const hasNutrientPreview = Number(nutrientesPreview.energiaKcal) > 0;
  const nutrientesPainel = useMemo(
    () => (hasNutrientPreview ? nutrientesPreview : nutrientesRealtime),
    [hasNutrientPreview, nutrientesPreview, nutrientesRealtime]
  );

  const novaClassificados = useMemo(
    () => flattenItens(refeicoes).filter((item) => !!item.novaGrupo).length,
    [refeicoes]
  );

  const novaAnalise = useMemo(() => {
    const result = Object.fromEntries(NOVA_GRUPOS.map((g) => [g.id, { kcal: 0, count: 0 }]));
    result.sem_classificacao = { kcal: 0, count: 0 };
    flattenItens(refeicoes).forEach((item) => {
      const grupo = item.novaGrupo || '';
      const kcal = Number(item.calorias || 0);
      if (grupo && result[grupo]) {
        result[grupo].kcal += kcal;
        result[grupo].count++;
      } else {
        result.sem_classificacao.kcal += kcal;
        result.sem_classificacao.count++;
      }
    });
    return result;
  }, [refeicoes]);

  const readinessItems = useMemo(() => {
    return [
      { key: 'r24h', label: 'Recordatório 24h', status: totalItens > 0 ? 'ok' : 'pending', value: `${totalItens} alimentos` },
      { key: 'taco', label: 'Cálculo TACO', status: hasNutrientPreview ? 'ok' : totalItens > 0 ? 'warning' : 'pending', value: hasNutrientPreview ? `${Number(nutrientesPreview.energiaKcal).toFixed(0)} kcal` : 'após salvar' },
      { key: 'nova', label: 'Classificação NOVA', status: totalItens > 0 && novaClassificados === totalItens ? 'ok' : totalItens > 0 && novaClassificados > 0 ? 'warning' : 'pending', value: totalItens > 0 ? `${novaClassificados}/${totalItens} classificados` : 'aguardando alimentos' },
      { key: 'adherence', label: 'Adesão da rotina', status: Number.isFinite(scoreAdesaoRotina) ? 'ok' : 'pending', value: Number.isFinite(scoreAdesaoRotina) ? `${scoreAdesaoRotina}/10` : 'opcional' },
      { key: 'supplements', label: 'Suplementação', status: suplementosAtivos.length > 0 ? 'attention' : 'ok', value: suplementosAtivos.length > 0 ? `${suplementosAtivos.length} ativo(s)` : 'sem registro' }
    ];
  }, [hasNutrientPreview, novaClassificados, nutrientesPreview.energiaKcal, scoreAdesaoRotina, suplementosAtivos.length, totalItens]);

  const updateItemNovaGrupo = useCallback((refeicaoId, itemIndex, novaGrupo) => {
    setRefeicoes((prev) => prev.map((refeicao) => {
      if (refeicao.id !== refeicaoId) return refeicao;
      return {
        ...refeicao,
        itens: refeicao.itens.map((item, idx) => idx === itemIndex ? { ...item, novaGrupo } : item)
      };
    }));
  }, []);

  const removeItem = useCallback((refeicaoId, itemIndex) => {
    setError('');
    setNutrientesPreview(EMPTY_NUTRIENTES);
    setRefeicoes((prev) => prev.map((refeicao) => {
      if (refeicao.id !== refeicaoId) return refeicao;
      return { ...refeicao, itens: refeicao.itens.filter((_, index) => index !== itemIndex) };
    }));
  }, []);

  const addItem = useCallback((refeicaoId, item) => {
    setError('');
    setNutrientesPreview(EMPTY_NUTRIENTES);
    const normalizedItem = normalizeAlimentoItem(item);
    setRefeicoes((prev) => prev.map((refeicao) => {
      if (refeicao.id !== refeicaoId) return refeicao;
      return { ...refeicao, itens: [...refeicao.itens, normalizedItem] };
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
          categorias: (() => {
            const cats = { in_natura: 0, minimamente_processado: 0, processado: 0, ultraprocessado: 0 };
            flattenItens(refeicoes).forEach((item) => {
              const g = item.novaGrupo || '';
              if (g && cats[g] !== undefined) cats[g] += Number(item.calorias || 0);
            });
            return cats;
          })(),
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

  // Só exibição: sem alimento no R24h e sem cálculo TACO salvo, as kcal e os
  // macronutrientes aparecem como "—", não como 0. O estado, o cálculo e o
  // payload continuam com os mesmos zeros de antes.
  const temRegistroAlimentar = hasNutrientPreview || totalItens > 0;
  const indiceAlimentar = [
    { id: 'alimentar-recordatorio', titulo: 'Recordatório 24h' },
    { id: 'alimentar-resumo', titulo: 'Resumo nutricional' },
    totalItens > 0 ? { id: 'alimentar-nova', titulo: 'Classificação NOVA' } : null,
    { id: 'alimentar-suplementacao', titulo: 'Suplementação' },
    { id: 'alimentar-adesao', titulo: 'Adesão e rotina' }
  ];

  // O cabeçalho do cartão antigo virou o do módulo (mesmo h3 e subtítulo);
  // a data e o contador passaram para o topo do recordatório. O aviso de
  // somente leitura subiu do pé da coluna direita para o topo.
  return (
    <AvaliacaoModulo
      className={`avaliacao-alimentar-r24h${readOnly ? ' eval-card--readonly' : ''}`}
      titulo="Avaliação alimentar (R24h)"
      descricao="Recordatório de 24h com cálculo via TACO"
      icone={<Apple size={22} />}
    >
      <AvaliacaoIndice itens={indiceAlimentar} />

      {readOnly && <AvisoAvaliacao tipo="info">Somente leitura para o seu perfil.</AvisoAvaliacao>}

      {onboardingResumo.length > 0 && (
        <AvisoAvaliacao tipo="info">
          <strong>Contexto:</strong> {onboardingResumo.join(' | ')}
        </AvisoAvaliacao>
      )}

      <EvaluationReadiness items={readinessItems} />

      {/* Duas colunas em telas largas: o recordatório à esquerda; resumo,
          NOVA, suplementação e adesão à direita. */}
      <div className="avaliacao-alimentar-r24h__grid">

        <div className="avaliacao-alimentar-r24h__refeicoes">
          <AvaliacaoSecao id="alimentar-recordatorio" titulo="Recordatório 24h">
            <div className="avaliacao-alimentar-r24h__meta">
              <Campo rotulo="Data da avaliação" className="eval-field">
                <input
                  type="date"
                  className="eval-input"
                  value={dataAvaliacao}
                  onChange={(event) => { setError(''); setDataAvaliacao(event.target.value); }}
                  disabled={readOnly}
                />
              </Campo>
              <div className="avaliacao-alimentar-r24h__counter">
                <span>{totalItens}</span>
                <small>alimentos no R24h</small>
              </div>
            </div>

            {/* Busca única com seletor de refeição. O select mantém o
                aria-label de antes; "Adicionar à" passa a ser o rótulo visível. */}
            {!readOnly && (
              <div className="r24h-add-area">
                <Campo rotulo="Adicionar à" className="r24h-add-area__header">
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
                </Campo>
                <AlimentoBuscador
                  disabled={readOnly}
                  onAdd={(item) => addItem(selectedRefeicaoId, item)}
                />
              </div>
            )}

            {/* Uma subseção por refeição (h5): contagem, kcal e "+ aqui"
                ficam nas ações do título. O "+ aqui" é descrito pelo nome da
                refeição, que já está no título. */}
            {refeicoes.map((refeicao) => {
              const kcalRefeicao = refeicao.itens.reduce((sum, i) => sum + (i.calorias || 0), 0);
              const isSelected = !readOnly && selectedRefeicaoId === refeicao.id;
              const totalKcalDia = nutrientesRealtime.energiaKcal;
              const kcalPct = totalKcalDia > 0 ? Math.min(100, Math.round((kcalRefeicao / totalKcalDia) * 100)) : 0;
              return (
                <AvaliacaoSecao
                  key={refeicao.id}
                  id={`alimentar-refeicao-${refeicao.id}`}
                  titulo={refeicao.nome}
                  className={`r24h-meal${isSelected ? ' r24h-meal--selected' : ''}`}
                  acoes={(
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
                          className="r24h-meal__target-btn eval-btn eval-btn-secondary"
                          onClick={() => setSelectedRefeicaoId(refeicao.id)}
                          aria-describedby={`alimentar-refeicao-${refeicao.id}-titulo`}
                        >
                          + aqui
                        </button>
                      )}
                      {isSelected && (
                        <span className="r24h-meal__active-tag">selecionada</span>
                      )}
                    </div>
                  )}
                >
                  {refeicao.itens.length === 0 ? (
                    <div className="avaliacao-alimentar-r24h__empty">Nenhum alimento registrado.</div>
                  ) : (
                    <ul className="avaliacao-alimentar-r24h__items">
                      {refeicao.itens.map((item, index) => (
                        <li key={`${refeicao.id}-${item.alimentoId}-${index}`}>
                          <div className="avaliacao-alimentar-r24h__item-main">
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
                          </div>
                          {/* Grupo rotulado por "NOVA:"; cada botão diz o
                              estado (aria-pressed) e lê o nome do grupo, que
                              antes só estava no title. */}
                          <div
                            className="r24h-nova-selector"
                            role="group"
                            aria-labelledby={`alimentar-${refeicao.id}-${index}-nova`}
                          >
                            <span className="r24h-nova-selector__label" id={`alimentar-${refeicao.id}-${index}-nova`}>NOVA:</span>
                            {NOVA_GRUPOS.map((g) => (
                              <button
                                key={g.id}
                                type="button"
                                className={`r24h-nova-btn${item.novaGrupo === g.id ? ` r24h-nova-btn--${g.id}` : ''}`}
                                onClick={() => updateItemNovaGrupo(refeicao.id, index, item.novaGrupo === g.id ? '' : g.id)}
                                title={g.label}
                                disabled={readOnly}
                                aria-pressed={item.novaGrupo === g.id}
                              >
                                {g.short}
                                <span className="av-sr">{` ${g.label}`}</span>
                              </button>
                            ))}
                            {item.novaGrupo && (
                              <span className={`r24h-nova-label r24h-nova-label--${item.novaGrupo}`}>
                                {NOVA_GRUPOS.find((g) => g.id === item.novaGrupo)?.label}
                              </span>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  {kcalRefeicao > 0 && (
                    <div className="r24h-meal__kcal-bar" aria-hidden="true">
                      <div className="r24h-meal__kcal-bar-fill" style={{ width: `${kcalPct}%` }} />
                    </div>
                  )}
                </AvaliacaoSecao>
              );
            })}
          </AvaliacaoSecao>
        </div>

        <div className="avaliacao-alimentar-r24h__summary">
          {/* Mesmas expressões e casas de antes; sem registro, "—" em vez
              de 0 (temRegistroAlimentar). Os micronutrientes só existem
              depois do cálculo TACO, feito ao salvar. */}
          <AvaliacaoSecao id="alimentar-resumo" titulo="Resumo nutricional">
            <ResultadoCalculado
              className="r24h-kcal-block"
              rotulo="total do dia"
              valor={temRegistroAlimentar ? Number(nutrientesPainel.energiaKcal || 0).toFixed(0) : null}
              unidade="kcal"
            />

            <div className="r24h-macros-row">
              <ResultadoCalculado
                className="r24h-macro-pill r24h-macro-pill--cho"
                rotulo="g CHO"
                valor={temRegistroAlimentar ? Number(nutrientesPainel.carboidrato || 0).toFixed(0) : null}
              />
              <ResultadoCalculado
                className="r24h-macro-pill r24h-macro-pill--ptn"
                rotulo="g PTN"
                valor={temRegistroAlimentar ? Number(nutrientesPainel.proteina || 0).toFixed(0) : null}
              />
              <ResultadoCalculado
                className="r24h-macro-pill r24h-macro-pill--lip"
                rotulo="g LIP"
                valor={temRegistroAlimentar ? Number(nutrientesPainel.lipidios || 0).toFixed(0) : null}
              />
              <ResultadoCalculado
                className="r24h-macro-pill r24h-macro-pill--fibra"
                rotulo="g Fibras"
                valor={temRegistroAlimentar ? Number(nutrientesPainel.fibra || 0).toFixed(0) : null}
              />
            </div>

            <div className="avaliacao-alimentar-r24h__micros">
              <button
                type="button"
                className="r24h-micros-toggle"
                onClick={() => setShowMicros((prev) => !prev)}
                aria-expanded={showMicros}
              >
                Micronutrientes
                {showMicros ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
              </button>
              {showMicros && (
                <div className="avaliacao-alimentar-r24h__summary-grid">
                  <ResultadoCalculado rotulo="Vit. D (µg)" valor={hasNutrientPreview ? Number(nutrientesPreview.vitaminaD || 0).toFixed(2) : null} />
                  <ResultadoCalculado rotulo="Ferro (mg)" valor={hasNutrientPreview ? Number(nutrientesPreview.ferro || 0).toFixed(2) : null} />
                  <ResultadoCalculado rotulo="Cálcio (mg)" valor={hasNutrientPreview ? Number(nutrientesPreview.calcio || 0).toFixed(1) : null} />
                  <ResultadoCalculado rotulo="B12 (µg)" valor={Number.isFinite(nutrientesPreview.vitaminaB12) ? Number(nutrientesPreview.vitaminaB12).toFixed(2) : null} />
                </div>
              )}
            </div>
          </AvaliacaoSecao>

          {/* Classificação NOVA: a barra é uma imagem com nome; os valores
              estão escritos na lista logo abaixo. */}
          {totalItens > 0 && (
            <AvaliacaoSecao
              id="alimentar-nova"
              titulo="Classificação NOVA"
              acoes={<span className="r24h-nova-hint">{novaClassificados}/{totalItens} itens</span>}
            >
              <div className="r24h-nova-bar" role="img" aria-label="Distribuição kcal por grupo NOVA">
                {NOVA_GRUPOS.map((g) => {
                  const pct = nutrientesRealtime.energiaKcal > 0 && novaAnalise[g.id].kcal > 0
                    ? (novaAnalise[g.id].kcal / nutrientesRealtime.energiaKcal) * 100 : 0;
                  return pct > 1 ? (
                    <div key={g.id} className={`r24h-nova-bar__seg r24h-nova-bar__seg--${g.id}`} style={{ width: `${pct}%` }} title={`${g.label}: ${pct.toFixed(0)}%`} />
                  ) : null;
                })}
                {novaAnalise.sem_classificacao.kcal > 0 && nutrientesRealtime.energiaKcal > 0 && (
                  <div
                    className="r24h-nova-bar__seg r24h-nova-bar__seg--none"
                    style={{ width: `${(novaAnalise.sem_classificacao.kcal / nutrientesRealtime.energiaKcal) * 100}%` }}
                    title={`Não classificado: ${((novaAnalise.sem_classificacao.kcal / nutrientesRealtime.energiaKcal) * 100).toFixed(0)}%`}
                  />
                )}
              </div>
              <div className="r24h-nova-breakdown">
                {/* Sem kcal no total do dia não há percentual: "—", não 0%
                    (WI-013, decisão 6). */}
                {NOVA_GRUPOS.map((g) => {
                  const { kcal, count } = novaAnalise[g.id];
                  const temTotal = nutrientesRealtime.energiaKcal > 0;
                  const pct = temTotal ? ((kcal / nutrientesRealtime.energiaKcal) * 100).toFixed(0) : null;
                  let pctTexto = '—';
                  if (temTotal) pctTexto = count > 0 ? `${pct}%` : '0%';
                  return (
                    <div key={g.id} className="r24h-nova-breakdown__row">
                      <span className={`r24h-nova-dot r24h-nova-dot--${g.id}`} />
                      <span className="r24h-nova-breakdown__name">{g.label}</span>
                      <span className="r24h-nova-breakdown__count">{count > 0 ? `${count}al` : '—'}</span>
                      <span className="r24h-nova-breakdown__kcal">{count > 0 ? `${kcal.toFixed(0)} kcal` : '—'}</span>
                      <span className="r24h-nova-breakdown__pct">{pctTexto}</span>
                    </div>
                  );
                })}
              </div>
              {novaClassificados < totalItens && (
                <AvisoAvaliacao tipo="atencao" className="r24h-nova-incomplete">
                  {totalItens - novaClassificados} alimento(s) aguardam classificação. Toque em 1/2/3/4 em cada item.
                </AvisoAvaliacao>
              )}
            </AvaliacaoSecao>
          )}

          {/* Suplementação: os textos que eram só placeholder passam a ser
              também o rótulo visível de cada campo. */}
          <AvaliacaoSecao
            id="alimentar-suplementacao"
            titulo="Suplementação"
            acoes={!readOnly && (
              <button type="button" className="avaliacao-alimentar-r24h__mini-btn eval-btn eval-btn-secondary" onClick={addSuplemento}>
                + Adicionar
              </button>
            )}
          >
            <div className="avaliacao-alimentar-r24h__supp-list">
              {suplementos.map((item) => (
                <div className="avaliacao-alimentar-r24h__supp-card" key={item.id}>
                  <div className="avaliacao-alimentar-r24h__supp-top">
                    <Campo rotulo="Nome do suplemento">
                      <input
                        type="text"
                        className="eval-input"
                        placeholder="Nome do suplemento"
                        value={item.nome}
                        onChange={(event) => updateSuplemento(item.id, 'nome', event.target.value)}
                        disabled={readOnly}
                      />
                    </Campo>
                    {!readOnly && (
                      <button
                        type="button"
                        className="avaliacao-alimentar-r24h__icon-btn"
                        onClick={() => removeSuplemento(item.id)}
                        aria-label="Remover suplemento"
                      >
                        <Trash2 size={18} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                  <div className="avaliacao-alimentar-r24h__supp-bottom">
                    <Campo rotulo="Dose">
                      <input
                        type="text"
                        className="eval-input"
                        placeholder="Dose"
                        value={item.dose}
                        onChange={(event) => updateSuplemento(item.id, 'dose', event.target.value)}
                        disabled={readOnly}
                      />
                    </Campo>
                    <Campo rotulo="Frequência">
                      <input
                        type="text"
                        className="eval-input"
                        placeholder="Frequência"
                        value={item.frequencia}
                        onChange={(event) => updateSuplemento(item.id, 'frequencia', event.target.value)}
                        disabled={readOnly}
                      />
                    </Campo>
                  </div>
                </div>
              ))}
            </div>
          </AvaliacaoSecao>

          {/* Adesão e rotina. O controle deslizante continua com o mesmo
              value (vazio vira 0 na posição); o número ao lado mostra "—"
              enquanto a pergunta não foi respondida, em vez de "0/10". */}
          <AvaliacaoSecao id="alimentar-adesao" titulo="Adesão e rotina">
            <div className="avaliacao-alimentar-r24h__adherence-grid">
              <Campo rotulo="Adesão alimentar" className="eval-field r24h-slider-field">
                {(ligacao) => (
                  <div className="r24h-slider">
                    <input
                      {...ligacao}
                      type="range" min="0" max="10" step="1"
                      className="r24h-score-slider"
                      value={rotinaClinica.adesaoPlanoAlimentar || 0}
                      onChange={(event) => updateRotinaClinica('adesaoPlanoAlimentar', event.target.value)}
                      disabled={readOnly}
                    />
                    <span className="r24h-score-value">{rotinaClinica.adesaoPlanoAlimentar ? <>{rotinaClinica.adesaoPlanoAlimentar}/10</> : '—'}</span>
                  </div>
                )}
              </Campo>
              <Campo rotulo="Adesão hidratação" className="eval-field r24h-slider-field">
                {(ligacao) => (
                  <div className="r24h-slider">
                    <input
                      {...ligacao}
                      type="range" min="0" max="10" step="1"
                      className="r24h-score-slider"
                      value={rotinaClinica.adesaoHidratacao || 0}
                      onChange={(event) => updateRotinaClinica('adesaoHidratacao', event.target.value)}
                      disabled={readOnly}
                    />
                    <span className="r24h-score-value">{rotinaClinica.adesaoHidratacao ? <>{rotinaClinica.adesaoHidratacao}/10</> : '—'}</span>
                  </div>
                )}
              </Campo>
              <Campo rotulo="Fome pós-treino" className="eval-field r24h-slider-field">
                {(ligacao) => (
                  <div className="r24h-slider">
                    <input
                      {...ligacao}
                      type="range" min="0" max="10" step="1"
                      className="r24h-score-slider"
                      value={rotinaClinica.fomePosTreino || 0}
                      onChange={(event) => updateRotinaClinica('fomePosTreino', event.target.value)}
                      disabled={readOnly}
                    />
                    <span className="r24h-score-value">{rotinaClinica.fomePosTreino ? <>{rotinaClinica.fomePosTreino}/10</> : '—'}</span>
                  </div>
                )}
              </Campo>
              <Campo rotulo="Principal barreira" className="eval-field">
                <input
                  type="text"
                  className="eval-input"
                  value={rotinaClinica.principalBarreira}
                  onChange={(event) => updateRotinaClinica('principalBarreira', event.target.value)}
                  disabled={readOnly}
                />
              </Campo>
            </div>
            {Number.isFinite(scoreAdesaoRotina) && (
              <div className="avaliacao-alimentar-r24h__adherence-score">
                Score adesão: <strong>{scoreAdesaoRotina}/10</strong>
              </div>
            )}
          </AvaliacaoSecao>
        </div>
      </div>

      {/* Salvar: saiu do pé da coluna de refeições para o pé do módulo,
          porque também salva suplementação e adesão. Continua fixo no pé da
          tela enquanto o módulo está visível. */}
      {!readOnly && (
        <div className="avaliacao-alimentar-r24h__sticky-save">
          {error && <AvisoAvaliacao tipo="perigo" anunciar className="r24h-save-error">{error}</AvisoAvaliacao>}
          <BarraAcoesAvaliacao status={saveStatus} textosStatus={{ error: 'Erro' }}>
            <Button
              type="button"
              onClick={() => dispatchSalvar(false)}
              disabled={readOnly || totalItens <= 0}
              loading={saveStatus === 'saving'}
              variant="primary"
            >
              <Save size={15} /> Salvar avaliação
            </Button>
          </BarraAcoesAvaliacao>
        </div>
      )}
    </AvaliacaoModulo>
  );
};

export default AvaliacaoAlimentar;
