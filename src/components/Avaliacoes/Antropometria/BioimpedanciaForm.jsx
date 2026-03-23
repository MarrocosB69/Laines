import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Scale } from 'lucide-react';
import { toLocalDateInputValue } from '../../../utils/dateUtils';
import { evaluateBioimpedanceSnapshot } from '../../../utils/bioimpedance';
import '../avaliacoes.css';
import './BioimpedanciaForm.css';

const BioimpedanciaForm = ({
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
    percentualGordura: '',
    pesoGordura: '',
    massaMagra: '',
    taxaMetabolicaBasal: '',
    aguaTotal: '',
    percentualAguaPesoCorporal: '',
    percentualAguaMassaMagra: '',
    bioresistencia: '',
    reatancia: '',
    alvoPercentualGordura: '',
    alvoPesoGordura: '',
    alvoPesoTotal: '',
    estatura: '',
    peso: '',
    sexo: '',
    idade: ''
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
    setDados((prev) => ({ ...prev, [name]: value }));
  };

  const imcCalculado = useMemo(() => {
    const pesoKg = parseNumeric(dados.peso);
    const alturaCm = normalizeHeightCm(dados.estatura);
    if (!Number.isFinite(pesoKg) || !Number.isFinite(alturaCm) || alturaCm <= 0) return null;
    const alturaM = alturaCm / 100;
    return pesoKg / (alturaM * alturaM);
  }, [dados.estatura, dados.peso]);

  const hydrationRatios = useMemo(() => {
    const aguaTotal = parseNumeric(dados.aguaTotal);
    const peso = parseNumeric(dados.peso);
    const massaMagra = parseNumeric(dados.massaMagra);

    const percentualAguaPesoCorporal = Number.isFinite(aguaTotal) && Number.isFinite(peso) && peso > 0
      ? (aguaTotal / peso) * 100
      : null;
    const percentualAguaMassaMagra = Number.isFinite(aguaTotal) && Number.isFinite(massaMagra) && massaMagra > 0
      ? (aguaTotal / massaMagra) * 100
      : null;

    return {
      percentualAguaPesoCorporal,
      percentualAguaMassaMagra
    };
  }, [dados.aguaTotal, dados.massaMagra, dados.peso]);

  const bioSnapshot = useMemo(() => {
    const percentualGordura = parseNumeric(dados.percentualGordura);
    const peso = parseNumeric(dados.peso);
    const pesoGordura = parseNumeric(dados.pesoGordura);
    const massaMagra = parseNumeric(dados.massaMagra);
    const aguaTotal = parseNumeric(dados.aguaTotal);

    return {
      percentualGordura,
      pesoGordura: Number.isFinite(pesoGordura)
        ? pesoGordura
        : (Number.isFinite(percentualGordura) && Number.isFinite(peso) ? (percentualGordura / 100) * peso : null),
      massaMagra,
      taxaMetabolicaBasal: parseNumeric(dados.taxaMetabolicaBasal),
      aguaTotal,
      percentualAguaPesoCorporal: parseNumeric(dados.percentualAguaPesoCorporal)
        ?? hydrationRatios.percentualAguaPesoCorporal,
      percentualAguaMassaMagra: parseNumeric(dados.percentualAguaMassaMagra)
        ?? hydrationRatios.percentualAguaMassaMagra,
      bioresistencia: parseNumeric(dados.bioresistencia),
      reatancia: parseNumeric(dados.reatancia),
      alvoPercentualGordura: parseNumeric(dados.alvoPercentualGordura),
      alvoPesoGordura: parseNumeric(dados.alvoPesoGordura),
      alvoPesoTotal: parseNumeric(dados.alvoPesoTotal),
      pesoTotal: peso,
      sexo: normalizeSex(dados.sexo),
      idade: parseNumeric(dados.idade),
      imc: imcCalculado !== null ? Number(imcCalculado.toFixed(2)) : null
    };
  }, [
    dados.percentualGordura,
    dados.peso,
    dados.pesoGordura,
    dados.massaMagra,
    dados.taxaMetabolicaBasal,
    dados.aguaTotal,
    dados.percentualAguaPesoCorporal,
    dados.percentualAguaMassaMagra,
    dados.bioresistencia,
    dados.reatancia,
    dados.alvoPercentualGordura,
    dados.alvoPesoGordura,
    dados.alvoPesoTotal,
    dados.sexo,
    dados.idade,
    hydrationRatios.percentualAguaPesoCorporal,
    hydrationRatios.percentualAguaMassaMagra,
    imcCalculado
  ]);

  const diagnostics = useMemo(
    () => evaluateBioimpedanceSnapshot(bioSnapshot),
    [bioSnapshot]
  );

  const payloadDados = useMemo(() => {
    const percentualAguaPesoCorporal = Number.isFinite(bioSnapshot.percentualAguaPesoCorporal)
      ? Number(bioSnapshot.percentualAguaPesoCorporal.toFixed(2))
      : null;
    const percentualAguaMassaMagra = Number.isFinite(bioSnapshot.percentualAguaMassaMagra)
      ? Number(bioSnapshot.percentualAguaMassaMagra.toFixed(2))
      : null;
    const pesoGordura = Number.isFinite(bioSnapshot.pesoGordura)
      ? Number(bioSnapshot.pesoGordura.toFixed(2))
      : null;
    const percentualGordura = Number.isFinite(bioSnapshot.percentualGordura)
      ? Number(bioSnapshot.percentualGordura.toFixed(2))
      : null;

    return {
      ...dados,
      imc: bioSnapshot.imc,
      classificacaoGordura: diagnostics.bodyFat.label,
      interpretacaoBioimpedancia: diagnostics.interpretation,
      percentualGordura,
      percentual_gordura: percentualGordura,
      pesoGordura,
      peso_gordura: pesoGordura,
      massaGorda: pesoGordura,
      massaMagra: bioSnapshot.massaMagra,
      massa_magra: bioSnapshot.massaMagra,
      aguaTotal: bioSnapshot.aguaTotal,
      agua_total: bioSnapshot.aguaTotal,
      aguaCorporal: bioSnapshot.aguaTotal,
      percentualAguaPesoCorporal,
      percentual_agua_peso_corporal: percentualAguaPesoCorporal,
      percentualAguaMassaMagra,
      percentual_agua_massa_magra: percentualAguaMassaMagra,
      taxaMetabolicaBasal: bioSnapshot.taxaMetabolicaBasal,
      taxa_metabolica_basal: bioSnapshot.taxaMetabolicaBasal,
      tmb: bioSnapshot.taxaMetabolicaBasal,
      bioresistencia: bioSnapshot.bioresistencia,
      reatancia: bioSnapshot.reatancia,
      alvoPercentualGordura: bioSnapshot.alvoPercentualGordura,
      alvo_percentual_gordura: bioSnapshot.alvoPercentualGordura,
      alvoPesoGordura: bioSnapshot.alvoPesoGordura,
      alvo_peso_gordura: bioSnapshot.alvoPesoGordura,
      alvoPesoTotal: bioSnapshot.alvoPesoTotal,
      alvo_peso_total: bioSnapshot.alvoPesoTotal,
      sexo: bioSnapshot.sexo,
      idade: bioSnapshot.idade
    };
  }, [bioSnapshot, dados, diagnostics.bodyFat.label, diagnostics.interpretation]);

  const hasValues = (payload) => Object.entries(payload).some(([key, value]) => {
    if (key === 'dataAvaliacao' || key === 'interpretacaoBioimpedancia') return false;
    return value !== '' && value !== null && value !== undefined;
  });

  const handleSalvar = () => {
    if (!onSalvar) return;
    if (!hasValues(dados)) {
      setError('Preencha ao menos um campo.');
      return;
    }

    onSalvar({
      tipo: 'bioimpedancia',
      dados: payloadDados,
      resultados: {
        percentualGordura: payloadDados.percentualGordura,
        percentual_gordura: payloadDados.percentual_gordura,
        pesoGordura: payloadDados.pesoGordura,
        peso_gordura: payloadDados.peso_gordura,
        massaMagra: payloadDados.massaMagra,
        massa_magra: payloadDados.massa_magra,
        aguaTotal: payloadDados.aguaTotal,
        agua_total: payloadDados.agua_total,
        percentualAguaPesoCorporal: payloadDados.percentualAguaPesoCorporal,
        percentual_agua_peso_corporal: payloadDados.percentual_agua_peso_corporal,
        percentualAguaMassaMagra: payloadDados.percentualAguaMassaMagra,
        percentual_agua_massa_magra: payloadDados.percentual_agua_massa_magra,
        taxaMetabolicaBasal: payloadDados.taxaMetabolicaBasal,
        taxa_metabolica_basal: payloadDados.taxa_metabolica_basal,
        bioresistencia: payloadDados.bioresistencia,
        reatancia: payloadDados.reatancia,
        alvoPercentualGordura: payloadDados.alvoPercentualGordura,
        alvo_percentual_gordura: payloadDados.alvo_percentual_gordura,
        alvoPesoGordura: payloadDados.alvoPesoGordura,
        alvo_peso_gordura: payloadDados.alvo_peso_gordura,
        alvoPesoTotal: payloadDados.alvoPesoTotal,
        alvo_peso_total: payloadDados.alvo_peso_total,
        classificacaoGordura: payloadDados.classificacaoGordura,
        interpretacaoBioimpedancia: payloadDados.interpretacaoBioimpedancia
      },
      data: dados.dataAvaliacao,
      pacienteId
    });
  };

  useEffect(() => {
    if (readOnly || !onAutoSave) return undefined;
    if (!hasValues(dados)) return undefined;
    clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => {
      onAutoSave({
        tipo: 'bioimpedancia',
        dados: payloadDados,
        resultados: {
          percentualGordura: payloadDados.percentualGordura,
          percentual_gordura: payloadDados.percentual_gordura,
          pesoGordura: payloadDados.pesoGordura,
          peso_gordura: payloadDados.peso_gordura,
          massaMagra: payloadDados.massaMagra,
          massa_magra: payloadDados.massa_magra,
          aguaTotal: payloadDados.aguaTotal,
          agua_total: payloadDados.agua_total,
          percentualAguaPesoCorporal: payloadDados.percentualAguaPesoCorporal,
          percentual_agua_peso_corporal: payloadDados.percentual_agua_peso_corporal,
          percentualAguaMassaMagra: payloadDados.percentualAguaMassaMagra,
          percentual_agua_massa_magra: payloadDados.percentual_agua_massa_magra,
          taxaMetabolicaBasal: payloadDados.taxaMetabolicaBasal,
          taxa_metabolica_basal: payloadDados.taxa_metabolica_basal,
          bioresistencia: payloadDados.bioresistencia,
          reatancia: payloadDados.reatancia,
          alvoPercentualGordura: payloadDados.alvoPercentualGordura,
          alvo_percentual_gordura: payloadDados.alvo_percentual_gordura,
          alvoPesoGordura: payloadDados.alvoPesoGordura,
          alvo_peso_gordura: payloadDados.alvo_peso_gordura,
          alvoPesoTotal: payloadDados.alvoPesoTotal,
          alvo_peso_total: payloadDados.alvo_peso_total,
          classificacaoGordura: payloadDados.classificacaoGordura,
          interpretacaoBioimpedancia: payloadDados.interpretacaoBioimpedancia
        },
        data: dados.dataAvaliacao,
        pacienteId
      });
    }, 900);
    return () => clearTimeout(autoSaveRef.current);
  }, [dados, onAutoSave, pacienteId, payloadDados, readOnly]);

  const readOnlyPercentualAguaPeso = Number.isFinite(hydrationRatios.percentualAguaPesoCorporal);
  const readOnlyPercentualAguaMassaMagra = Number.isFinite(hydrationRatios.percentualAguaMassaMagra);

  return (
    <div className="eval-card bioimpedancia-form">
      <div className="eval-header">
        <div className="eval-icon" style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#2563eb' }}>
          <Scale size={22} />
        </div>
        <div>
          <h3 className="eval-title">Bioimpedancia (BIA)</h3>
          <p className="eval-subtitle">
            Registro completo de composicao corporal com metas clinicas.
          </p>
        </div>
      </div>

      <div className="eval-section">
        <h4 className="eval-section-title">Metricas principais</h4>
        <p className="eval-section-subtitle">Percentual de gordura, massa magra e hidratacao total.</p>
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
          <MetricField label="% Gordura" name="percentualGordura" value={dados.percentualGordura} onChange={handleChange} readOnly={readOnly} step="0.1" />
          <MetricField label="Peso gordura (kg)" name="pesoGordura" value={dados.pesoGordura} onChange={handleChange} readOnly={readOnly} step="0.1" />
          <MetricField label="Massa magra (kg)" name="massaMagra" value={dados.massaMagra} onChange={handleChange} readOnly={readOnly} step="0.1" />
          <MetricField label="Agua total (L)" name="aguaTotal" value={dados.aguaTotal} onChange={handleChange} readOnly={readOnly} step="0.1" />
          <MetricField label="TMB (cal/dia)" name="taxaMetabolicaBasal" value={dados.taxaMetabolicaBasal} onChange={handleChange} readOnly={readOnly} step="1" />
          <MetricField label="Bioresistencia (ohms)" name="bioresistencia" value={dados.bioresistencia} onChange={handleChange} readOnly={readOnly} step="1" />
          <MetricField label="Reatancia (ohms)" name="reatancia" value={dados.reatancia} onChange={handleChange} readOnly={readOnly} step="1" />
        </div>
      </div>

      <div className="eval-section">
        <h4 className="eval-section-title">
          {lockSharedAnthropometry ? 'Ficha compartilhada (dados base)' : 'Parametros de referencia'}
        </h4>
        <p className="eval-section-subtitle">
          {lockSharedAnthropometry
            ? 'Dados comuns definidos na ficha de avaliacoes e reutilizados automaticamente.'
            : 'Base para interpretacao dinamica por perfil fisiologico.'}
        </p>
        {lockSharedAnthropometry ? (
          <div className="eval-summary-grid">
            <div className="eval-summary-item">
              <span>Peso</span>
              <strong>{Number.isFinite(parseNumeric(dados.peso)) ? `${parseNumeric(dados.peso).toFixed(1)} kg` : 'Nao informado'}</strong>
            </div>
            <div className="eval-summary-item">
              <span>Estatura</span>
              <strong>{Number.isFinite(normalizeHeightCm(dados.estatura)) ? `${normalizeHeightCm(dados.estatura).toFixed(1)} cm` : 'Nao informada'}</strong>
            </div>
            <div className="eval-summary-item">
              <span>Idade</span>
              <strong>{dados.idade || 'Nao informada'}</strong>
            </div>
            <div className="eval-summary-item">
              <span>Sexo biologico</span>
              <strong>{dados.sexo || 'Nao informado'}</strong>
            </div>
            <div className="eval-summary-item">
              <span>IMC</span>
              <strong>{imcCalculado !== null ? imcCalculado.toFixed(1) : 'Não calculado'}</strong>
            </div>
            <div className="eval-summary-item">
              <span>% Agua / peso</span>
              <strong>
                {Number.isFinite(hydrationRatios.percentualAguaPesoCorporal)
                  ? `${hydrationRatios.percentualAguaPesoCorporal.toFixed(1)} %`
                  : (dados.percentualAguaPesoCorporal || 'Nao informado')}
              </strong>
            </div>
            <div className="eval-summary-item">
              <span>% Agua / massa magra</span>
              <strong>
                {Number.isFinite(hydrationRatios.percentualAguaMassaMagra)
                  ? `${hydrationRatios.percentualAguaMassaMagra.toFixed(1)} %`
                  : (dados.percentualAguaMassaMagra || 'Nao informado')}
              </strong>
            </div>
          </div>
        ) : (
          <div className="eval-grid eval-grid-compact">
            <MetricField label="Estatura (cm)" name="estatura" value={dados.estatura} onChange={handleChange} readOnly={readOnly} step="0.1" />
            <MetricField label="Peso (kg)" name="peso" value={dados.peso} onChange={handleChange} readOnly={readOnly} step="0.1" />
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
            <div className="eval-field">
              <label className="eval-label">IMC</label>
              <input
                type="text"
                className="eval-input"
                value={imcCalculado !== null ? imcCalculado.toFixed(1) : 'Não calculado'}
                readOnly
                disabled
              />
            </div>
            <div className="eval-field">
              <label className="eval-label" title="Agua total em relacao ao peso corporal">
                % Agua / peso corporal
              </label>
              <input
                type="text"
                className="eval-input"
                value={Number.isFinite(hydrationRatios.percentualAguaPesoCorporal)
                  ? `${hydrationRatios.percentualAguaPesoCorporal.toFixed(1)} %`
                  : (dados.percentualAguaPesoCorporal || 'Nao informado')}
                readOnly={readOnlyPercentualAguaPeso}
                disabled={readOnlyPercentualAguaPeso || readOnly}
                name="percentualAguaPesoCorporal"
                onChange={handleChange}
              />
            </div>
            <div className="eval-field eval-field-full">
              <label className="eval-label" title="Agua total em relacao a massa magra">
                % Agua / massa magra
              </label>
              <input
                type="text"
                className="eval-input"
                value={Number.isFinite(hydrationRatios.percentualAguaMassaMagra)
                  ? `${hydrationRatios.percentualAguaMassaMagra.toFixed(1)} %`
                  : (dados.percentualAguaMassaMagra || 'Nao informado')}
                readOnly={readOnlyPercentualAguaMassaMagra}
                disabled={readOnlyPercentualAguaMassaMagra || readOnly}
                name="percentualAguaMassaMagra"
                onChange={handleChange}
              />
            </div>
          </div>
        )}
      </div>

      <div className="eval-section">
        <h4 className="eval-section-title">Metas clinicas (opcional)</h4>
        <p className="eval-section-subtitle">Definidas pelo profissional e atualizaveis nas proximas avaliacoes.</p>
        <div className="eval-grid eval-grid-compact">
          <MetricField label="Alvo % gordura" name="alvoPercentualGordura" value={dados.alvoPercentualGordura} onChange={handleChange} readOnly={readOnly} step="0.1" />
          <MetricField label="Alvo peso gordura (kg)" name="alvoPesoGordura" value={dados.alvoPesoGordura} onChange={handleChange} readOnly={readOnly} step="0.1" />
          <MetricField label="Alvo peso total (kg)" name="alvoPesoTotal" value={dados.alvoPesoTotal} onChange={handleChange} readOnly={readOnly} step="0.1" />
        </div>
      </div>

      <div className="eval-note">
        <strong>{diagnostics.bodyFat.label}</strong> | {diagnostics.hydration.label}
      </div>
      <div className="eval-note">{diagnostics.interpretation}</div>

      <div className="eval-actions">
        <button type="button" className="eval-btn eval-btn-primary" onClick={handleSalvar} disabled={readOnly}>
          Salvar valores
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

export default BioimpedanciaForm;

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
