import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Utensils, Save, BarChart3 } from 'lucide-react';
import { Button } from '../../ui';
import { toLocalDateInputValue } from '../../../utils/dateUtils';
import { calculateNovaEvaluation } from '../../../services/calculationEngine';
import '../avaliacoes.css';
import './AvaliacaoAlimentarNOVA.css';

const ORIGENS_DISPONIVEIS = [
  { value: 'manual', label: 'Manual' },
  { value: 'questnova', label: 'QuestNova' },
  { value: 'importacao', label: 'Importação externa' }
];

const NOVA_GROUP_FIELDS = [
  { key: 'in_natura', label: 'In natura', placeholder: 'Ex.: 850' },
  { key: 'minimamente_processados', label: 'Minimamente processados', placeholder: 'Ex.: 620' },
  { key: 'processados', label: 'Processados', placeholder: 'Ex.: 300' },
  { key: 'ultraprocessados', label: 'Ultraprocessados', placeholder: 'Ex.: 450' }
];

const AvaliacaoAlimentarNOVA = ({
  pacienteId,
  onSalvar,
  onAutoSave,
  readOnly = false,
  moduleSnapshot,
  currentSessionId
}) => {
  const [dataAvaliacao, setDataAvaliacao] = useState(toLocalDateInputValue(new Date()));
  const [origemDados, setOrigemDados] = useState('manual');
  const [fonteExterna, setFonteExterna] = useState('');
  const [kcalTotalInformado, setKcalTotalInformado] = useState('');
  const [kcalInNatura, setKcalInNatura] = useState('');
  const [kcalMinimamenteProcessados, setKcalMinimamenteProcessados] = useState('');
  const [kcalProcessados, setKcalProcessados] = useState('');
  const [kcalUltraprocessados, setKcalUltraprocessados] = useState('');
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
    const normalizedDate = normalizeDateValue(moduleSnapshot?.data || source?.dataAvaliacao || input?.dataAvaliacao);
    const sourceRecords = source?.registros || input?.registros || moduleSnapshot?.registros || [];

    const normalizedSnapshot = calculateNovaEvaluation({
      ...source,
      ...input,
      dataAvaliacao: normalizedDate,
      origemDados: source?.origemDados || input?.origemDados || source?.source?.mode || 'manual',
      fonteExterna: source?.fonteExterna || input?.fonteExterna || source?.source?.externalRef || '',
      kcalTotalInformado: input?.kcalTotalInformado ?? source?.kcalTotalInformado ?? null,
      registros: sourceRecords
    });

    const normalizedInput = normalizedSnapshot?.inputNormalized || {};
    const normalizedCategorias = normalizedInput?.categorias || {};

    setDataAvaliacao(normalizedInput?.dataAvaliacao || normalizedDate);
    setOrigemDados(normalizeOrigem(normalizedInput?.origemDados || source?.origemDados || input?.origemDados || source?.source?.mode));
    setFonteExterna(toText(normalizedInput?.fonteExterna || source?.fonteExterna || input?.fonteExterna || source?.source?.externalRef));
    setKcalTotalInformado(toInputValue(normalizedInput?.kcalTotalInformado ?? source?.kcalTotalInformado));
    setKcalInNatura(toInputValue(normalizedCategorias?.in_natura));
    setKcalMinimamenteProcessados(toInputValue(normalizedCategorias?.minimamente_processados));
    setKcalProcessados(toInputValue(normalizedCategorias?.processados));
    setKcalUltraprocessados(toInputValue(normalizedCategorias?.ultraprocessados));

    loadedSnapshotIdRef.current = snapshotId;
  }, [moduleSnapshot]);

  const novaEvaluation = useMemo(() => calculateNovaEvaluation({
    dataAvaliacao,
    origemDados,
    fonteExterna,
    kcalTotalInformado,
    kcalInNatura,
    kcalMinimamenteProcessados,
    kcalProcessados,
    kcalUltraprocessados
  }), [
    dataAvaliacao,
    fonteExterna,
    kcalInNatura,
    kcalMinimamenteProcessados,
    kcalProcessados,
    kcalTotalInformado,
    kcalUltraprocessados,
    origemDados
  ]);

  const totais = useMemo(() => novaEvaluation?.categories || {}, [novaEvaluation]);
  const percentuais = useMemo(() => novaEvaluation?.percentuais || {}, [novaEvaluation]);
  const percentuaisSobreTotalInformado = useMemo(
    () => novaEvaluation?.percentuaisSobreTotalInformado || {},
    [novaEvaluation]
  );
  const classificacao = novaEvaluation?.classification?.label || 'Sem classificacao';
  const inconsistenciaKcal = novaEvaluation?.totals?.inconsistenciaKcal ?? null;
  const totalDiario = novaEvaluation?.totals?.totalDiario ?? 0;
  const kcalTotalCalculado = novaEvaluation?.totals?.totalDiarioCalculado ?? 0;
  const kcalTotalInformadoNum = novaEvaluation?.totals?.kcalTotalInformado ?? null;
  const somaPercentuais = useMemo(
    () => Object.values(percentuais).reduce((sum, value) => sum + Number(value || 0), 0),
    [percentuais]
  );

  const totalGruposInformado = useMemo(
    () => Object.values(totais).reduce((sum, categoria) => sum + Number(categoria?.energiaTotal || 0), 0),
    [totais]
  );

  const payloadDados = (() => {
    const normalizedInput = novaEvaluation?.inputNormalized || {};
    const categories = novaEvaluation?.categories || {};
    const origemNormalizada = normalizeOrigem(normalizedInput.origemDados || origemDados);
    const fonteNormalizada = toText(normalizedInput.fonteExterna || fonteExterna);
    const totaisEnergeticos = {
      in_natura: Number(Number(categories?.in_natura?.energiaTotal || 0).toFixed(2)),
      minimamente_processados: Number(Number(categories?.minimamente_processados?.energiaTotal || 0).toFixed(2)),
      processados: Number(Number(categories?.processados?.energiaTotal || 0).toFixed(2)),
      ultraprocessados: Number(Number(categories?.ultraprocessados?.energiaTotal || 0).toFixed(2))
    };

    return {
      dataAvaliacao: normalizedInput.dataAvaliacao || dataAvaliacao,
      origemDados: origemNormalizada,
      fonteExterna: fonteNormalizada,
      registros: [],
      categorias: totaisEnergeticos,
      kcalPorGrupo: totaisEnergeticos,
      kcalInNatura: totaisEnergeticos.in_natura,
      kcalMinimamenteProcessados: totaisEnergeticos.minimamente_processados,
      kcalProcessados: totaisEnergeticos.processados,
      kcalUltraprocessados: totaisEnergeticos.ultraprocessados,
      totalDiario: Number.isFinite(totalDiario) ? Number(totalDiario.toFixed(2)) : 0,
      totalDiarioCalculado: Number.isFinite(kcalTotalCalculado) ? Number(kcalTotalCalculado.toFixed(2)) : 0,
      kcalTotalInformado: Number.isFinite(kcalTotalInformadoNum) ? Number(kcalTotalInformadoNum.toFixed(2)) : null,
      inconsistenciaKcal,
      percentuais,
      percentuaisSobreTotalInformado,
      classificacao,
      input: {
        dataAvaliacao: normalizedInput.dataAvaliacao || dataAvaliacao,
        registros: [],
        categorias: totaisEnergeticos,
        kcalInNatura: totaisEnergeticos.in_natura,
        kcalMinimamenteProcessados: totaisEnergeticos.minimamente_processados,
        kcalProcessados: totaisEnergeticos.processados,
        kcalUltraprocessados: totaisEnergeticos.ultraprocessados,
        origemDados: origemNormalizada,
        kcalTotalInformado: Number.isFinite(kcalTotalInformadoNum) ? Number(kcalTotalInformadoNum.toFixed(2)) : null,
        fonteExterna: fonteNormalizada
      },
      source: {
        mode: origemNormalizada,
        system: origemNormalizada === 'questnova' ? 'questnova' : 'manual',
        externalRef: fonteNormalizada || null
      },
      warnings: Array.isArray(novaEvaluation?.warnings) ? novaEvaluation.warnings : []
    };
  })();

  const hasValues = Number.isFinite(totalGruposInformado) && totalGruposInformado > 0;

  const dispatchSalvar = useCallback(async (auto = false) => {
    if (!auto && !hasValues) {
      setError('Informe as kcal consumidas em pelo menos um grupo NOVA.');
      return;
    }

    const dispatch = auto ? onAutoSave : onSalvar;
    if (!dispatch) return;

    const payloadResultados = {
      totalDiario: payloadDados.totalDiario,
      percentuais,
      classificacao,
      calculated: {
        totalDiario: payloadDados.totalDiario,
        totalDiarioCalculado: payloadDados.totalDiarioCalculado,
        inconsistenciaKcal,
        percentuais,
        percentuaisSobreTotalInformado
      },
      output: {
        classificacao,
        alertaConsistencia: Number.isFinite(inconsistenciaKcal) && Math.abs(inconsistenciaKcal) > 100
          ? 'Diferenca relevante entre total informado e soma dos grupos.'
          : '',
        warnings: Array.isArray(novaEvaluation?.warnings) ? novaEvaluation.warnings : []
      }
    };

    setSaveStatus('saving');
    if (saveStatusResetRef.current) clearTimeout(saveStatusResetRef.current);
    try {
      await Promise.resolve(dispatch({
        tipo: 'alimentar',
        pacienteId,
        registros: [],
        data: payloadDados.dataAvaliacao,
        totalDiario: payloadDados.totalDiario,
        percentuais,
        classificacao,
        dados: payloadDados,
        resultados: payloadResultados,
        schemaVersion: 2,
        formulaId: 'nova_percentual_distribuicao',
        formulaVersion: '1.0.0',
        sourceSystem: payloadDados?.source?.system || 'manual',
        sourceRef: payloadDados?.source?.externalRef || undefined,
        measuredAt: normalizeDateValue(payloadDados.dataAvaliacao || dataAvaliacao),
        sessaoId: moduleSnapshot?.sessaoId || currentSessionId
      }));
      setSaveStatus('saved');
      saveStatusResetRef.current = setTimeout(() => setSaveStatus(null), 3000);
    } catch (error) {
      setSaveStatus('error');
      if (!auto) {
        setError('Nao foi possivel salvar a avaliacao alimentar.');
      }
    }
  }, [
    classificacao,
    currentSessionId,
    dataAvaliacao,
    hasValues,
    inconsistenciaKcal,
    moduleSnapshot,
    novaEvaluation,
    onAutoSave,
    onSalvar,
    pacienteId,
    payloadDados,
    percentuais,
    percentuaisSobreTotalInformado,
    saveStatusResetRef
  ]);

  useEffect(() => {
    if (readOnly || !onAutoSave || !hasValues) return undefined;

    clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => {
      dispatchSalvar(true);
    }, 3500);

    return () => clearTimeout(autoSaveRef.current);
  }, [dispatchSalvar, hasValues, onAutoSave, readOnly]);

  useEffect(() => () => {
    if (saveStatusResetRef.current) clearTimeout(saveStatusResetRef.current);
  }, []);

  const groupInputState = {
    in_natura: kcalInNatura,
    minimamente_processados: kcalMinimamenteProcessados,
    processados: kcalProcessados,
    ultraprocessados: kcalUltraprocessados
  };

  const setGroupInputValue = (key, value) => {
    setError('');
    if (key === 'in_natura') setKcalInNatura(value);
    if (key === 'minimamente_processados') setKcalMinimamenteProcessados(value);
    if (key === 'processados') setKcalProcessados(value);
    if (key === 'ultraprocessados') setKcalUltraprocessados(value);
  };

  return (
    <div className={`avaliacao-alimentar${readOnly ? ' eval-card--readonly' : ''}`}>
      <div className="eval-card avaliacao-alimentar__header-card">
        <div className="eval-header">
          <div className="eval-icon">
            <Utensils size={22} />
          </div>
          <div>
            <h3 className="eval-title">Avaliacao alimentar (NOVA)</h3>
            <p className="eval-subtitle">Distribuicao energetica por nivel de processamento</p>
          </div>
        </div>

        <div className="avaliacao-alimentar__date-row">
          <div className="eval-field avaliacao-alimentar__date-field">
            <label className="eval-label">Data</label>
            <input
              type="date"
              className="eval-input"
              value={dataAvaliacao}
              onChange={(event) => {
                setError('');
                setDataAvaliacao(event.target.value);
              }}
              disabled={readOnly}
            />
          </div>
          <div className="eval-field avaliacao-alimentar__date-field">
            <label className="eval-label">Origem</label>
            <select
              className="eval-input"
              value={origemDados}
              onChange={(event) => {
                setError('');
                setOrigemDados(normalizeOrigem(event.target.value));
              }}
              disabled={readOnly}
            >
              {ORIGENS_DISPONIVEIS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div className="eval-field avaliacao-alimentar__date-field">
            <label className="eval-label">Kcal total (opcional)</label>
            <input
              type="number"
              className="eval-input"
              value={kcalTotalInformado}
              onChange={(event) => {
                setError('');
                setKcalTotalInformado(event.target.value);
              }}
              disabled={readOnly}
              placeholder="Ex.: 2350"
            />
          </div>
          <div className="eval-field avaliacao-alimentar__date-field">
            <label className="eval-label">Fonte / lote (opcional)</label>
            <input
              type="text"
              className="eval-input"
              value={fonteExterna}
              onChange={(event) => {
                setError('');
                setFonteExterna(event.target.value);
              }}
              disabled={readOnly}
              placeholder="Ex.: QuestNova 2026-03"
            />
          </div>
        </div>
      </div>

      <div className="avaliacao-alimentar__content-grid">
        <div className="eval-card avaliacao-alimentar__group-card">
          <div className="avaliacao-alimentar__group-header">
            <h4>Kcal por grupo NOVA</h4>
            <p>Informe o consumo diario em kcal para cada grupo.</p>
          </div>

          <div className="avaliacao-alimentar__group-grid">
            {NOVA_GROUP_FIELDS.map((group) => (
              <div key={group.key} className="eval-field avaliacao-alimentar__group-field">
                <label className="eval-label">{group.label}</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  className="eval-input"
                  value={groupInputState[group.key]}
                  onChange={(event) => setGroupInputValue(group.key, event.target.value)}
                  disabled={readOnly}
                  placeholder={group.placeholder}
                />
                <div className="avaliacao-alimentar__group-meta">
                  <span>{Number(totais?.[group.key]?.energiaTotal || 0).toFixed(0)} kcal</span>
                  <span>{Number(percentuais?.[group.key] || 0).toFixed(1)}% do total dos grupos</span>
                  {Number.isFinite(kcalTotalInformadoNum) && kcalTotalInformadoNum > 0 && (
                    <span className="avaliacao-alimentar__group-meta-sub">
                      {Number(percentuaisSobreTotalInformado?.[group.key] || 0).toFixed(1)}% do total informado
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="eval-card avaliacao-alimentar__summary-card">
          <div className="avaliacao-alimentar__summary-header">
            <BarChart3 size={20} />
            <h4>Resumo do consumo</h4>
          </div>

          <div className="avaliacao-alimentar__category-list">
            {NOVA_GROUP_FIELDS.map((group) => {
              const categoria = group.key;
              const energia = Number(totais?.[categoria]?.energiaTotal || 0);
              const percentual = Number(percentuais?.[categoria] || 0);
              const fonte = totais?.[categoria]?.fonteEnergia === 'kcal_informada' ? 'Kcal informadas' : 'Registros legados';
              return (
                <div key={categoria} className="avaliacao-alimentar__category-item">
                  <div className="avaliacao-alimentar__category-line">
                    <span>{totais?.[categoria]?.nome || group.label}</span>
                    <span>{percentual.toFixed(1)}% do total dos grupos</span>
                  </div>
                  <div className="avaliacao-alimentar__bar">
                    <div
                      className={`avaliacao-alimentar__bar-fill ${
                        categoria === 'ultraprocessados' ? 'bg-red-500'
                          : categoria === 'processados' ? 'bg-amber-500'
                            : categoria === 'minimamente_processados' ? 'bg-blue-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${percentual}%` }}
                    />
                  </div>
                  <div className="avaliacao-alimentar__category-meta">
                    <span>{fonte}</span>
                    <span>{energia.toFixed(0)} kcal</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="avaliacao-alimentar__footer">
            <div className="avaliacao-alimentar__footer-top">
              <div>
                <p className="avaliacao-alimentar__caption">Total dos grupos</p>
                <p className="avaliacao-alimentar__total">
                  {(Number.isFinite(kcalTotalCalculado) ? kcalTotalCalculado : 0).toFixed(0)} <span>kcal</span>
                </p>
                <p className="avaliacao-alimentar__caption">Soma percentual: {somaPercentuais.toFixed(1)}%</p>
              </div>
              <div className="avaliacao-alimentar__classification-wrap">
                <p className="avaliacao-alimentar__caption">Classificacao</p>
                <span
                  className={`avaliacao-alimentar__classification ${
                    classificacao.includes('alto risco')
                      ? 'bg-red-100 text-red-600'
                      : classificacao.includes('risco')
                        ? 'bg-amber-100 text-amber-600'
                        : 'bg-emerald-100 text-emerald-600'
                  }`}
                >
                  {classificacao}
                </span>
              </div>
            </div>

            {Number.isFinite(inconsistenciaKcal) && Math.abs(inconsistenciaKcal) > 0.01 && (
              <div className="eval-note" style={{ marginTop: '0.75rem' }}>
                Diferenca entre total informado e soma dos grupos: {inconsistenciaKcal > 0 ? '+' : ''}{inconsistenciaKcal.toFixed(1)} kcal.
              </div>
            )}
            {Number.isFinite(kcalTotalInformadoNum) && kcalTotalInformadoNum > 0 && (
              <div className="eval-note" style={{ marginTop: '0.5rem' }}>
                Total informado manualmente: {kcalTotalInformadoNum.toFixed(0)} kcal.
              </div>
            )}
            {Array.isArray(novaEvaluation?.warnings) && novaEvaluation.warnings.length > 0 && (
              <div className="eval-note" style={{ marginTop: '0.75rem' }}>
                {novaEvaluation.warnings[0]}
              </div>
            )}

            {readOnly && (
              <div className="eval-note">Somente leitura para o seu perfil.</div>
            )}

            {saveStatus ? <span className={`save-indicator ${saveStatus}`}>{saveStatus === 'saving' ? 'Salvando...' : saveStatus === 'saved' ? 'Salvo' : 'Erro ao salvar'}</span> : null}
            <Button
              type="button"
              onClick={() => dispatchSalvar(false)}
              disabled={!hasValues || readOnly}
              loading={saveStatus === 'saving'}
              variant="primary"
              className="avaliacao-alimentar__save-btn"
            >
              <Save size={20} /> Salvar avaliacao
            </Button>
            {error && <div className="form-error-message">{error}</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AvaliacaoAlimentarNOVA;

function toText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(String(value).replace(',', '.').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function toInputValue(value) {
  const numeric = toNumber(value);
  if (!Number.isFinite(numeric)) return '';
  return String(numeric);
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

function normalizeOrigem(value) {
  const token = String(value || '').trim().toLowerCase();
  if (token === 'questnova') return 'questnova';
  if (token === 'importacao') return 'importacao';
  return 'manual';
}

