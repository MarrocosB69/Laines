import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Activity } from 'lucide-react';
import { toLocalDateInputValue } from '../../../utils/dateUtils';
import '../avaliacoes.css';
import './DobrasCutaneasForm.css';

const PROTOCOL_FIELDS = [
  { key: 'peitoral', label: 'Peitoral (mm)' },
  { key: 'axilarMedia', label: 'Axilar media (mm)' },
  { key: 'triceps', label: 'Triceps (mm)' },
  { key: 'subescapular', label: 'Subescapular (mm)' },
  { key: 'abdominal', label: 'Abdominal (mm)' },
  { key: 'supraIliaca', label: 'Supra-iliaca (mm)' },
  { key: 'coxa', label: 'Coxa (mm)' }
];

const DobrasCutaneasForm = ({
  pacienteId,
  onSalvar,
  onAutoSave,
  patient,
  baselineAnthropometry,
  lockSharedAnthropometry = false,
  readOnly = false
}) => {
  const [dados, setDados] = useState({
    dataAvaliacao: toLocalDateInputValue(new Date()),
    peitoral: '',
    axilarMedia: '',
    triceps: '',
    subescapular: '',
    abdominal: '',
    supraIliaca: '',
    coxa: '',
    peso: '',
    estatura: '',
    idade: '',
    sexo: ''
  });
  const [error, setError] = useState('');
  const autoSaveRef = useRef(null);

  useEffect(() => {
    if (!patient && !baselineAnthropometry) return;

    const baselineHeight = Number(
      baselineAnthropometry?.estaturaCm
      ?? normalizeHeightCm(patient?.altura || patient?.estatura || patient?.height)
    );
    const baselineWeight = Number(
      baselineAnthropometry?.pesoKg
      ?? parseNumeric(patient?.peso || patient?.weight)
    );
    const baselineSex = normalizeSex(
      baselineAnthropometry?.sexo
      || patient?.sexo
      || patient?.genero
    );
    const baselineAge = Number(
      baselineAnthropometry?.idade
      ?? patient?.idade
      ?? calculateAge(patient?.dataNascimento)
    );

    setDados((prev) => ({
      ...prev,
      estatura: lockSharedAnthropometry
        ? (Number.isFinite(baselineHeight) ? baselineHeight.toFixed(1) : '')
        : (prev.estatura || (Number.isFinite(baselineHeight) ? baselineHeight.toFixed(1) : '')),
      peso: lockSharedAnthropometry
        ? (Number.isFinite(baselineWeight) ? baselineWeight.toFixed(1) : '')
        : (prev.peso || (Number.isFinite(baselineWeight) ? baselineWeight.toFixed(1) : '')),
      sexo: lockSharedAnthropometry
        ? baselineSex
        : (prev.sexo || baselineSex),
      idade: lockSharedAnthropometry
        ? (Number.isFinite(baselineAge) ? String(Math.round(baselineAge)) : '')
        : (prev.idade || (Number.isFinite(baselineAge) ? String(Math.round(baselineAge)) : ''))
    }));
  }, [
    baselineAnthropometry,
    lockSharedAnthropometry,
    patient,
    patient?.altura,
    patient?.estatura,
    patient?.height,
    patient?.peso,
    patient?.weight,
    patient?.sexo,
    patient?.genero,
    patient?.idade,
    patient?.dataNascimento
  ]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setError('');
    setDados((prev) => ({
      ...prev,
      [name]: name === 'sexo' ? normalizeSex(value) : value
    }));
  };

  const foldValues = useMemo(() => (
    PROTOCOL_FIELDS.map((field) => parseNumeric(dados[field.key]))
  ), [dados]);

  const somaSeteDobras = useMemo(() => {
    if (foldValues.some((value) => !Number.isFinite(value))) return null;
    return foldValues.reduce((sum, value) => sum + value, 0);
  }, [foldValues]);

  const idade = useMemo(() => parseNumeric(dados.idade), [dados.idade]);
  const sexo = useMemo(() => normalizeSex(dados.sexo), [dados.sexo]);
  const pesoKg = useMemo(() => parseNumeric(dados.peso), [dados.peso]);
  const estaturaCm = useMemo(() => normalizeHeightCm(dados.estatura), [dados.estatura]);

  const densidadeCorporal = useMemo(
    () => calculateBodyDensityJP7({ somaSeteDobras, idade, sexo }),
    [idade, sexo, somaSeteDobras]
  );
  const percentualGordura = useMemo(
    () => calculateSiriBodyFat(densidadeCorporal),
    [densidadeCorporal]
  );
  const massaGorda = useMemo(() => (
    Number.isFinite(percentualGordura) && Number.isFinite(pesoKg)
      ? (percentualGordura / 100) * pesoKg
      : null
  ), [percentualGordura, pesoKg]);
  const massaMagra = useMemo(() => (
    Number.isFinite(massaGorda) && Number.isFinite(pesoKg)
      ? pesoKg - massaGorda
      : null
  ), [massaGorda, pesoKg]);
  const imc = useMemo(() => {
    if (!Number.isFinite(pesoKg) || !Number.isFinite(estaturaCm) || estaturaCm <= 0) return null;
    const estaturaM = estaturaCm / 100;
    return pesoKg / (estaturaM * estaturaM);
  }, [estaturaCm, pesoKg]);
  const imcClassificacao = useMemo(
    () => classifyBmi(imc),
    [imc]
  );
  const formulaLabel = useMemo(() => {
    if (sexo === 'MASCULINO') return 'Jackson & Pollock 7 (homens)';
    if (sexo === 'FEMININO') return 'Jackson et al. 7 (mulheres)';
    return 'Informe sexo biologico para aplicar JP7';
  }, [sexo]);

  const payloadDados = useMemo(() => {
    const normalizedFolds = {
      peitoral: parseNumeric(dados.peitoral),
      axilarMedia: parseNumeric(dados.axilarMedia),
      triceps: parseNumeric(dados.triceps),
      subescapular: parseNumeric(dados.subescapular),
      abdominal: parseNumeric(dados.abdominal),
      supraIliaca: parseNumeric(dados.supraIliaca),
      coxa: parseNumeric(dados.coxa)
    };

    return {
      ...dados,
      ...normalizedFolds,
      protocoloDobras: 'JP7',
      somaSeteDobras: Number.isFinite(somaSeteDobras) ? Number(somaSeteDobras.toFixed(2)) : null,
      soma_dobras_7: Number.isFinite(somaSeteDobras) ? Number(somaSeteDobras.toFixed(2)) : null,
      densidadeCorporal: Number.isFinite(densidadeCorporal) ? Number(densidadeCorporal.toFixed(6)) : null,
      densidade_corporal: Number.isFinite(densidadeCorporal) ? Number(densidadeCorporal.toFixed(6)) : null,
      percentualGordura: Number.isFinite(percentualGordura) ? Number(percentualGordura.toFixed(2)) : null,
      percentual_gordura: Number.isFinite(percentualGordura) ? Number(percentualGordura.toFixed(2)) : null,
      massaGorda: Number.isFinite(massaGorda) ? Number(massaGorda.toFixed(2)) : null,
      massa_gorda: Number.isFinite(massaGorda) ? Number(massaGorda.toFixed(2)) : null,
      massaMagra: Number.isFinite(massaMagra) ? Number(massaMagra.toFixed(2)) : null,
      massa_magra: Number.isFinite(massaMagra) ? Number(massaMagra.toFixed(2)) : null,
      imc: Number.isFinite(imc) ? Number(imc.toFixed(2)) : null,
      classificacaoImc: imcClassificacao,
      sexo,
      idade: Number.isFinite(idade) ? Math.round(idade) : null,
      peso: Number.isFinite(pesoKg) ? Number(pesoKg.toFixed(2)) : null,
      estatura: Number.isFinite(estaturaCm) ? Number(estaturaCm.toFixed(1)) : null
    };
  }, [
    dados,
    densidadeCorporal,
    idade,
    imc,
    imcClassificacao,
    massaGorda,
    massaMagra,
    percentualGordura,
    pesoKg,
    sexo,
    somaSeteDobras,
    estaturaCm
  ]);

  const hasValues = useMemo(() => Object.entries(payloadDados).some(([key, value]) => {
    if (key === 'dataAvaliacao' || key === 'protocoloDobras' || key === 'classificacaoImc') return false;
    return value !== '' && value !== null && value !== undefined;
  }), [payloadDados]);

  const payloadResult = useMemo(() => ({
    somaSeteDobras: payloadDados.somaSeteDobras,
    soma_dobras_7: payloadDados.soma_dobras_7,
    densidadeCorporal: payloadDados.densidadeCorporal,
    densidade_corporal: payloadDados.densidade_corporal,
    percentualGordura: payloadDados.percentualGordura,
    percentual_gordura: payloadDados.percentual_gordura,
    massaGorda: payloadDados.massaGorda,
    massa_gorda: payloadDados.massa_gorda,
    massaMagra: payloadDados.massaMagra,
    massa_magra: payloadDados.massa_magra,
    imc: payloadDados.imc,
    classificacaoImc: payloadDados.classificacaoImc
  }), [payloadDados]);

  const handleSalvar = () => {
    if (!onSalvar) return;
    if (!hasValues) {
      setError('Preencha ao menos um campo.');
      return;
    }

    onSalvar({
      tipo: 'dobras_cutaneas',
      dados: payloadDados,
      resultados: payloadResult,
      data: dados.dataAvaliacao,
      pacienteId
    });
  };

  useEffect(() => {
    if (readOnly || !onAutoSave) return undefined;
    if (!hasValues) return undefined;
    clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => {
      onAutoSave({
        tipo: 'dobras_cutaneas',
        dados: payloadDados,
        resultados: payloadResult,
        data: dados.dataAvaliacao,
        pacienteId
      });
    }, 900);
    return () => clearTimeout(autoSaveRef.current);
  }, [dados.dataAvaliacao, hasValues, onAutoSave, pacienteId, payloadDados, payloadResult, readOnly]);

  return (
    <div className="eval-card dobras-form">
      <div className="eval-header">
        <div className="eval-icon">
          <Activity size={22} />
        </div>
        <div>
          <h3 className="eval-title">Dobras cutaneas (Jackson & Pollock 7)</h3>
          <p className="eval-subtitle">
            Protocolo com 7 dobras, densidade corporal e percentual de gordura por Siri.
          </p>
        </div>
      </div>

      <div className="eval-section">
        <h4 className="eval-section-title">Dobras do protocolo JP7</h4>
        <p className="eval-section-subtitle">
          Informe as sete dobras em milimetros para liberar o calculo completo.
        </p>
        <div className="eval-grid">
          <div className="eval-field">
            <label className="eval-label">Data</label>
            <input
              type="date"
              className="eval-input"
              name="dataAvaliacao"
              value={dados.dataAvaliacao}
              onChange={handleChange}
              disabled={readOnly}
            />
          </div>
          {PROTOCOL_FIELDS.map((field) => (
            <MetricField
              key={field.key}
              label={field.label}
              name={field.key}
              value={dados[field.key]}
              onChange={handleChange}
              readOnly={readOnly}
            />
          ))}
        </div>
      </div>

      <div className="eval-section">
        <h4 className="eval-section-title">
          {lockSharedAnthropometry ? 'Ficha compartilhada (dados base)' : 'Parametros para calculo'}
        </h4>
        {lockSharedAnthropometry ? (
          <div className="eval-summary-grid">
            <div className="eval-summary-item">
              <span>Peso</span>
              <strong>{Number.isFinite(pesoKg) ? `${pesoKg.toFixed(1)} kg` : 'Nao informado'}</strong>
            </div>
            <div className="eval-summary-item">
              <span>Estatura</span>
              <strong>{Number.isFinite(estaturaCm) ? `${estaturaCm.toFixed(1)} cm` : 'Nao informada'}</strong>
            </div>
            <div className="eval-summary-item">
              <span>Idade</span>
              <strong>{Number.isFinite(idade) ? Math.round(idade) : 'Nao informada'}</strong>
            </div>
            <div className="eval-summary-item">
              <span>Sexo biologico</span>
              <strong>{sexo || 'Nao informado'}</strong>
            </div>
          </div>
        ) : (
          <div className="eval-grid eval-grid-compact">
            <MetricField label="Peso (kg)" name="peso" value={dados.peso} onChange={handleChange} readOnly={readOnly} />
            <MetricField label="Estatura (cm)" name="estatura" value={dados.estatura} onChange={handleChange} readOnly={readOnly} />
            <MetricField label="Idade" name="idade" value={dados.idade} onChange={handleChange} readOnly={readOnly} step="1" />
            <div className="eval-field">
              <label className="eval-label">Sexo biologico</label>
              <select
                className="eval-input"
                name="sexo"
                value={dados.sexo}
                onChange={handleChange}
                disabled={readOnly}
              >
                <option value="">Selecione</option>
                <option value="MASCULINO">Masculino</option>
                <option value="FEMININO">Feminino</option>
              </select>
            </div>
          </div>
        )}
      </div>

      <div className="dobras-section">
        <h4>Resultados calculados</h4>
        <div className="dobras-results">
          <ResultCard label="Soma 7 dobras (mm)" value={somaSeteDobras} suffix="" digits={1} />
          <ResultCard label="Densidade corporal" value={densidadeCorporal} suffix="" digits={4} />
          <ResultCard label="% Gordura (Siri)" value={percentualGordura} suffix="%" digits={1} />
          <ResultCard label="Massa gorda" value={massaGorda} suffix=" kg" digits={1} />
          <ResultCard label="Massa magra" value={massaMagra} suffix=" kg" digits={1} />
          <ResultCard label="IMC" value={imc} suffix="" digits={1} />
        </div>
        <div className="eval-note">
          <strong>{formulaLabel}</strong> | Siri (1956): %G = (495 / D) − 450.
        </div>
        <div className="eval-note">
          {imcClassificacao}
        </div>
      </div>

      <div className="eval-actions">
        <button type="button" className="eval-btn eval-btn-primary" onClick={handleSalvar} disabled={readOnly}>
          Salvar dobras
        </button>
      </div>

      {error && <div className="eval-note" style={{ color: '#b91c1c' }}>{error}</div>}
    </div>
  );
};

const MetricField = ({
  label,
  name,
  value,
  onChange,
  readOnly,
  step = '0.1'
}) => (
  <div className="eval-field">
    <label className="eval-label">{label}</label>
    <input
      type="number"
      step={step}
      className="eval-input"
      name={name}
      value={value}
      onChange={onChange}
      disabled={readOnly}
    />
  </div>
);

const ResultCard = ({ label, value, suffix = '', digits = 1 }) => (
  <div className="dobras-result-card">
    <span className="dobras-result-label">{label}</span>
    <strong>{Number.isFinite(value) ? `${value.toFixed(digits)}${suffix}` : 'Nao calculado'}</strong>
  </div>
);

export default DobrasCutaneasForm;

function parseNumeric(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value).replace(',', '.').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeHeightCm(value) {
  const numeric = parseNumeric(value);
  if (!Number.isFinite(numeric)) return null;
  if (numeric > 0 && numeric <= 3) return numeric * 100;
  return numeric;
}

function normalizeSex(value) {
  const token = String(value || '').trim().toLowerCase();
  if (token.includes('fem') || token === 'f') return 'FEMININO';
  if (token.includes('masc') || token === 'm') return 'MASCULINO';
  return String(value || '').toUpperCase();
}

function calculateAge(dateValue) {
  if (!dateValue) return null;
  const birthDate = dateValue?.toDate ? dateValue.toDate() : new Date(dateValue);
  if (Number.isNaN(birthDate.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const monthDiff = now.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) {
    age -= 1;
  }
  return age;
}

function calculateBodyDensityJP7({ somaSeteDobras, idade, sexo }) {
  if (!Number.isFinite(somaSeteDobras) || !Number.isFinite(idade) || !sexo) return null;
  if (sexo === 'MASCULINO') {
    return 1.112
      - (0.00043499 * somaSeteDobras)
      + (0.00000055 * (somaSeteDobras ** 2))
      - (0.00028826 * idade);
  }
  if (sexo === 'FEMININO') {
    return 1.0970
      - (0.00046971 * somaSeteDobras)
      + (0.00000056 * (somaSeteDobras ** 2))
      - (0.00012828 * idade);
  }
  return null;
}

function calculateSiriBodyFat(densidadeCorporal) {
  if (!Number.isFinite(densidadeCorporal) || densidadeCorporal <= 0) return null;
  return (495 / densidadeCorporal) - 450;
}

function classifyBmi(imc) {
  if (!Number.isFinite(imc)) return 'IMC nao calculado';
  if (imc < 18.5) return 'IMC: baixo peso';
  if (imc < 25) return 'IMC: eutrofia';
  if (imc < 30) return 'IMC: sobrepeso';
  if (imc < 35) return 'IMC: obesidade grau I';
  if (imc < 40) return 'IMC: obesidade grau II';
  return 'IMC: obesidade grau III';
}
