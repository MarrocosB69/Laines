import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Droplets, Save } from 'lucide-react';
import { Button } from '../../ui';
import { toLocalDateInputValue } from '../../../utils/dateUtils';
import { calculateHydrationEvaluation } from '../../../services/calculationEngine';
import { useSaveStatus } from '../hooks/useSaveStatus';
import { useModuleSnapshot } from '../hooks/useModuleSnapshot';
import EvaluationHeader from '../components/EvaluationHeader';
import '../avaliacoes.css';
import './AvaliacaoHidratacao.css';

const AvaliacaoHidratacao = ({
  pacienteId,
  onSalvar,
  onAutoSave,
  readOnly = false,
  moduleSnapshot,
  currentSessionId
}) => {
  const [dados, setDados] = useState({
    dataAvaliacao: toLocalDateInputValue(new Date()),
    pesoAntesExercicio: '',
    pesoAposExercicio: '',
    duracaoExercicioMin: '',
    volumeIngeridoMl: '',
    volumeUrinarioMl: '',
    modalidade: '',
    temperaturaAmbiente: '',
    observacoes: ''
  });
  const [error, setError] = useState('');
  const { saveStatus, setSaving, setSuccess, setFailure } = useSaveStatus();
  const autoSaveRef = useRef(null);

  useModuleSnapshot(moduleSnapshot, (source, input, snapshot) => {
    setDados({
      dataAvaliacao: normalizeDateValue(snapshot?.data || source?.dataAvaliacao || input?.dataAvaliacao),
      pesoAntesExercicio: toInputValue(
        input?.pesoAntesExercicio
        ?? source?.pesoAntesExercicio
        ?? source?.pesoPre
      ),
      pesoAposExercicio: toInputValue(
        input?.pesoAposExercicio
        ?? source?.pesoAposExercicio
        ?? source?.pesoPos
      ),
      duracaoExercicioMin: toInputValue(
        input?.duracaoExercicioMin
        ?? source?.duracaoExercicioMin
        ?? source?.duracaoExercicio
      ),
      volumeIngeridoMl: toInputValue(
        input?.volumeIngeridoMl
        ?? source?.volumeIngeridoMl
        ?? source?.volumeLiquidos
      ),
      volumeUrinarioMl: toInputValue(
        input?.volumeUrinarioMl
        ?? source?.volumeUrinarioMl
      ),
      modalidade: toText(source?.modalidade || input?.modalidade),
      temperaturaAmbiente: toInputValue(source?.temperaturaAmbiente || input?.temperaturaAmbiente),
      observacoes: toText(source?.observacoes || input?.observacoes)
    });
  });

  const handleChange = (event) => {
    const { name, value } = event.target;
    setError('');
    setDados((prev) => ({ ...prev, [name]: value }));
  };

  const hydration = useMemo(() => calculateHydrationEvaluation({
    dataAvaliacao: normalizeDateValue(dados.dataAvaliacao),
    pesoAntesExercicio: dados.pesoAntesExercicio,
    pesoAposExercicio: dados.pesoAposExercicio,
    duracaoExercicioMin: dados.duracaoExercicioMin,
    volumeIngeridoMl: dados.volumeIngeridoMl,
    volumeUrinarioMl: dados.volumeUrinarioMl,
    modalidade: dados.modalidade,
    temperaturaAmbiente: dados.temperaturaAmbiente,
    observacoes: dados.observacoes
  }), [
    dados.dataAvaliacao,
    dados.duracaoExercicioMin,
    dados.modalidade,
    dados.observacoes,
    dados.pesoAntesExercicio,
    dados.pesoAposExercicio,
    dados.temperaturaAmbiente,
    dados.volumeIngeridoMl,
    dados.volumeUrinarioMl
  ]);

  const calculated = useMemo(() => hydration?.metrics || {}, [hydration]);
  const normalizedInput = useMemo(() => hydration?.inputNormalized || {}, [hydration]);
  const classificacaoHidrica = hydration?.classification?.label || 'Sem classificacao';
  const alertLevel = hydration?.classification?.alertLevel || 'neutral';

  const payload = useMemo(() => ({
    dados: {
      ...dados,
      pesoAntesExercicio: normalizedInput.pesoAntesExercicio,
      pesoAposExercicio: normalizedInput.pesoAposExercicio,
      duracaoExercicioMin: normalizedInput.duracaoExercicioMin,
      volumeIngeridoMl: normalizedInput.volumeIngeridoMl,
      volumeUrinarioMl: normalizedInput.volumeUrinarioMl,
      perdaPesoAbsolutaKg: Number.isFinite(calculated.perdaPesoAbsolutaKg)
        ? Number(calculated.perdaPesoAbsolutaKg.toFixed(3))
        : null,
      perdaPesoPercentual: Number.isFinite(calculated.perdaPesoPercentual)
        ? Number(calculated.perdaPesoPercentual.toFixed(2))
        : null,
      perdaHidricaLiquidaMl: Number.isFinite(calculated.perdaHidricaLiquidaMl)
        ? Math.round(calculated.perdaHidricaLiquidaMl)
        : null,
      taxaSudoreseLh: Number.isFinite(calculated.taxaSudoreseLh)
        ? Number(calculated.taxaSudoreseLh.toFixed(2))
        : null,
      taxaSudorese: Number.isFinite(calculated.taxaSudoreseMlMin)
        ? Number(calculated.taxaSudoreseMlMin.toFixed(2))
        : null,
      perdaSuor: Number.isFinite(calculated.perdaHidricaLiquidaMl)
        ? Math.round(calculated.perdaHidricaLiquidaMl)
        : null,
      classificacaoHidrica,
      input: {
        dataAvaliacao: normalizeDateValue(dados.dataAvaliacao),
        pesoAntesExercicio: normalizedInput.pesoAntesExercicio,
        pesoAposExercicio: normalizedInput.pesoAposExercicio,
        duracaoExercicioMin: normalizedInput.duracaoExercicioMin,
        volumeIngeridoMl: normalizedInput.volumeIngeridoMl,
        volumeUrinarioMl: normalizedInput.volumeUrinarioMl,
        modalidade: normalizedInput.modalidade,
        temperaturaAmbiente: normalizedInput.temperaturaAmbiente,
        observacoes: normalizedInput.observacoes
      },
      source: {
        mode: 'manual'
      }
    },
    resultados: {
      perdaPesoAbsolutaKg: Number.isFinite(calculated.perdaPesoAbsolutaKg)
        ? Number(calculated.perdaPesoAbsolutaKg.toFixed(3))
        : null,
      perdaPesoPercentual: Number.isFinite(calculated.perdaPesoPercentual)
        ? Number(calculated.perdaPesoPercentual.toFixed(2))
        : null,
      taxaSudoreseLh: Number.isFinite(calculated.taxaSudoreseLh)
        ? Number(calculated.taxaSudoreseLh.toFixed(2))
        : null,
      perdaHidricaLiquidaMl: Number.isFinite(calculated.perdaHidricaLiquidaMl)
        ? Math.round(calculated.perdaHidricaLiquidaMl)
        : null,
      calculated: {
        perdaPesoAbsolutaKg: Number.isFinite(calculated.perdaPesoAbsolutaKg)
          ? Number(calculated.perdaPesoAbsolutaKg.toFixed(3))
          : null,
        perdaPesoPercentual: Number.isFinite(calculated.perdaPesoPercentual)
          ? Number(calculated.perdaPesoPercentual.toFixed(2))
          : null,
        taxaSudoreseLh: Number.isFinite(calculated.taxaSudoreseLh)
          ? Number(calculated.taxaSudoreseLh.toFixed(2))
          : null
      },
      output: {
        classificacaoHidrica,
        alertLevel,
        warnings: hydration?.warnings || []
      }
    }
  }), [alertLevel, calculated, classificacaoHidrica, dados, hydration?.warnings, normalizedInput]);

  const hasValues = Boolean(
    dados.pesoAntesExercicio
    || dados.pesoAposExercicio
    || dados.duracaoExercicioMin
    || dados.volumeIngeridoMl
    || dados.volumeUrinarioMl
    || dados.observacoes
  );

  const salvar = useCallback(async (isAutoSave = false) => {
    if (!isAutoSave && !hasValues) {
      setError('Preencha ao menos os dados principais da sessao.');
      return;
    }

    const dispatch = isAutoSave ? onAutoSave : onSalvar;
    if (!dispatch) return;
    setSaving();
    try {
      await Promise.resolve(dispatch({
        tipo: 'hidratacao',
        data: dados.dataAvaliacao,
        pacienteId,
        schemaVersion: 2,
        formulaId: 'hidratacao_balanco_hidrico',
        formulaVersion: '1.0.0',
        sourceSystem: 'manual',
        measuredAt: normalizeDateValue(dados.dataAvaliacao),
        sessaoId: moduleSnapshot?.sessaoId || currentSessionId,
        ...payload
      }));
      setSuccess();
    } catch {
      setFailure();
      if (!isAutoSave) {
        setError('Nao foi possivel salvar a avaliacao.');
      }
    }
  }, [
    currentSessionId,
    dados.dataAvaliacao,
    hasValues,
    moduleSnapshot?.sessaoId,
    onAutoSave,
    onSalvar,
    pacienteId,
    payload,
    setFailure,
    setSaving,
    setSuccess
  ]);

  useEffect(() => {
    if (readOnly || !onAutoSave || !hasValues) return undefined;
    clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => salvar(true), 900);
    return () => clearTimeout(autoSaveRef.current);
  }, [hasValues, onAutoSave, readOnly, salvar]);

  return (
    <div className={`eval-card avaliacao-hidratacao${readOnly ? ' eval-card--readonly' : ''}`}>
      <EvaluationHeader
        icon={<Droplets size={22} />}
        title="Avaliacao de hidratacao"
        subtitle="Sessao esportiva com perdas, reposicao e risco hidrico"
      />

      <div className="eval-grid">
        <Field label="Data" name="dataAvaliacao" value={dados.dataAvaliacao} onChange={handleChange} readOnly={readOnly} type="date" />
        <Field label="Peso antes (kg)" name="pesoAntesExercicio" value={dados.pesoAntesExercicio} onChange={handleChange} readOnly={readOnly} />
        <Field label="Peso apos (kg)" name="pesoAposExercicio" value={dados.pesoAposExercicio} onChange={handleChange} readOnly={readOnly} />
        <Field label="Duracao (min)" name="duracaoExercicioMin" value={dados.duracaoExercicioMin} onChange={handleChange} readOnly={readOnly} />
        <Field label="Volume ingerido (ml)" name="volumeIngeridoMl" value={dados.volumeIngeridoMl} onChange={handleChange} readOnly={readOnly} />
        <Field label="Volume urinario (ml)" name="volumeUrinarioMl" value={dados.volumeUrinarioMl} onChange={handleChange} readOnly={readOnly} />
        <Field label="Modalidade" name="modalidade" value={dados.modalidade} onChange={handleChange} readOnly={readOnly} type="text" />
        <Field label="Temperatura ambiente (C)" name="temperaturaAmbiente" value={dados.temperaturaAmbiente} onChange={handleChange} readOnly={readOnly} />
        <div className="eval-field" style={{ gridColumn: '1 / -1' }}>
          <label className="eval-label">Observacoes</label>
          <textarea
            className="eval-textarea"
            name="observacoes"
            value={dados.observacoes}
            onChange={handleChange}
            rows="3"
            disabled={readOnly}
          />
        </div>
      </div>

      <div className="eval-section">
        <h4 className="eval-section-title">Resultados automaticos</h4>
        <p className="eval-section-subtitle">Calculados a partir das entradas da sessao.</p>
        <div className="eval-summary-grid">
          <Summary label="Perda absoluta" value={formatValue(calculated.perdaPesoAbsolutaKg, 'kg', 3)} />
          <Summary label="Perda percentual" value={formatValue(calculated.perdaPesoPercentual, '%', 2)} />
          <Summary label="Taxa sudorese" value={formatValue(calculated.taxaSudoreseLh, 'L/h', 2)} />
          <Summary label="Perda hidrica liquida" value={Number.isFinite(calculated.perdaHidricaLiquidaMl) ? `${Math.round(calculated.perdaHidricaLiquidaMl)} ml` : 'Nao calculada'} />
          <Summary label="Classificacao" value={classificacaoHidrica} />
          <Summary label="Alerta" value={hydration?.classification?.alertLabel || 'Indefinido'} />
        </div>
        {Array.isArray(hydration?.warnings) && hydration.warnings.length > 0 && (
          <div className="eval-note">
            {hydration.warnings[0]}
          </div>
        )}
      </div>

      {error && <div className="form-error-message">{error}</div>}
      {readOnly && <div className="eval-note">Somente leitura para o seu perfil.</div>}

      <div className="eval-actions">
        {saveStatus && (
          <span className={`save-indicator ${saveStatus}`}>
            {saveStatus === 'saving' ? 'Salvando...' : saveStatus === 'saved' ? 'Salvo' : 'Erro ao salvar'}
          </span>
        )}
        <Button type="button" variant="primary" onClick={() => salvar(false)} disabled={readOnly} loading={saveStatus === 'saving'}>
          <Save size={18} /> Salvar avaliacao
        </Button>
      </div>
    </div>
  );
};

const Field = ({
  label,
  name,
  value,
  onChange,
  readOnly,
  type = 'number'
}) => (
  <div className="eval-field">
    <label className="eval-label">{label}</label>
    <input
      type={type}
      className="eval-input"
      name={name}
      value={value}
      onChange={onChange}
      disabled={readOnly}
    />
  </div>
);

const Summary = ({ label, value }) => (
  <div className="eval-summary-item">
    <span>{label}</span>
    <strong>{value}</strong>
  </div>
);

const parseNumeric = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value).replace(',', '.').trim());
  return Number.isFinite(parsed) ? parsed : null;
};

const toInputValue = (value) => {
  const numeric = parseNumeric(value);
  if (!Number.isFinite(numeric)) return '';
  return String(numeric);
};

const toText = (value) => (value === null || value === undefined ? '' : String(value).trim());

const formatValue = (value, unit = '', digits = 2) => {
  if (!Number.isFinite(value)) return 'Nao calculado';
  return `${Number(value).toFixed(digits)}${unit ? ` ${unit}` : ''}`;
};

const normalizeDateValue = (value) => {
  if (!value) return toLocalDateInputValue(new Date());
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  }
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return toLocalDateInputValue(new Date());
  return toLocalDateInputValue(date);
};

export default AvaliacaoHidratacao;
