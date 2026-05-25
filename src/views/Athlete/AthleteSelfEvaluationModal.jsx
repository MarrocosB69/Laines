import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Activity, Apple, ClipboardList, Droplets, Dumbbell, X } from 'lucide-react';
import { useModalBodyLock } from '../../hooks/useModalBodyLock';
import { useModalFocusTrap } from '../../hooks/useModalFocusTrap';
import { toLocalDateInputValue } from '../../utils/dateUtils';
import { getAthleteSelfEvaluationConfig } from './athleteSelfEvaluations';
import '../../components/Avaliacoes/avaliacoes.css';
import './AthleteSelfEvaluationModal.css';

const FORM_COMPONENTS = {
  alimentar: AthleteAlimentarForm,
  hidratacao: AthleteHidratacaoForm,
  carga_treino: AthleteCargaTreinoForm,
  fisioterapia: AthletePainReportForm
};

const FORM_ICONS = {
  alimentar: Apple,
  hidratacao: Droplets,
  carga_treino: Dumbbell,
  fisioterapia: Activity
};

const AthleteSelfEvaluationModal = ({
  isOpen,
  type,
  patient,
  isSubmitting,
  onClose,
  onSubmit
}) => {
  const modalRef = useRef(null);
  const config = getAthleteSelfEvaluationConfig(type);
  const FormComponent = FORM_COMPONENTS[type] || null;
  const Icon = FORM_ICONS[type] || ClipboardList;

  useModalBodyLock(isOpen);
  useModalFocusTrap(isOpen, modalRef);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !isSubmitting) {
        event.preventDefault();
        onClose?.();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen || !patient || !config || !FormComponent) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="athlete-self-eval-overlay app-modal-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) {
          onClose?.();
        }
      }}
    >
      <div
        className="athlete-self-eval-modal app-modal-shell app-modal-shell--xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="athlete-self-eval-modal-title"
        ref={modalRef}
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="app-modal-header athlete-self-eval-header">
          <div className="athlete-self-eval-header-icon app-modal-header-icon">
            <Icon size={20} />
          </div>
          <div className="app-modal-heading">
            <h2 id="athlete-self-eval-modal-title" className="app-modal-title">{config.title}</h2>
            <p className="app-modal-subtitle">{config.subtitle} O envio ficará disponível para a equipe revisar.</p>
          </div>
          <button
            type="button"
            className="app-modal-close"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Fechar formulario"
          >
            <X size={15} />
          </button>
        </div>

        <div className="app-modal-body athlete-self-eval-body">
          <FormComponent
            pacienteId={patient.id}
            patient={patient}
            onSalvar={onSubmit}
            readOnly={isSubmitting}
          />
        </div>
      </div>
    </div>,
    document.body
  );
};

export default AthleteSelfEvaluationModal;

/* ─────────────────────────────────────────────────────────────
   Shared helpers
───────────────────────────────────────────────────────────── */

function FormField({ label, children }) {
  return (
    <div className="eval-field">
      <label className="eval-label">{label}</label>
      {children}
    </div>
  );
}

function FormFieldFull({ label, children }) {
  return (
    <div className="eval-field eval-field-full">
      <label className="eval-label">{label}</label>
      {children}
    </div>
  );
}

function CalcResult({ children }) {
  return <div className="athlete-calc-result">{children}</div>;
}

/* ─────────────────────────────────────────────────────────────
   AthleteAlimentarForm — registro alimentar simplificado
───────────────────────────────────────────────────────────── */

const REFEICOES = [
  { key: 'cafeDaManha', label: 'Café da manhã' },
  { key: 'almoco', label: 'Almoço' },
  { key: 'jantar', label: 'Jantar' },
  { key: 'lanches', label: 'Lanches / outros' }
];

function AthleteAlimentarForm({ pacienteId, onSalvar, readOnly = false }) {
  const [formData, setFormData] = useState(() => ({
    dataAvaliacao: toLocalDateInputValue(new Date()),
    cafeDaManha: '',
    almoco: '',
    jantar: '',
    lanches: '',
    adesao: '',
    observacoes: ''
  }));
  const [error, setError] = useState('');

  const updateField = (field, value) => {
    setError('');
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const hasInput = Object.entries(formData).some(
    ([key, value]) => key !== 'dataAvaliacao' && String(value || '').trim()
  );

  const handleSubmit = async () => {
    if (readOnly) return;
    if (!hasInput) { setError('Preencha ao menos um campo do registro.'); return; }
    const payload = {
      tipo: 'alimentar',
      pacienteId,
      data: formData.dataAvaliacao,
      measuredAt: formData.dataAvaliacao,
      formulaId: 'nova_percentual_distribuicao',
      formulaVersion: '1.0.0',
      schemaVersion: 2,
      sourceSystem: 'portal_atleta',
      dados: {
        relatoAtleta: true,
        dataAvaliacao: formData.dataAvaliacao,
        categorias: [],
        refeicoes: {
          cafeDaManha: { alimentos: formData.cafeDaManha },
          almoco: { alimentos: formData.almoco },
          jantar: { alimentos: formData.jantar },
          lanches: { alimentos: formData.lanches }
        },
        adesao: formData.adesao ? Number(formData.adesao) : null,
        observacoes: formData.observacoes,
        input: { ...formData }
      }
    };
    await Promise.resolve(onSalvar?.(payload));
  };

  return (
    <div className="eval-card">
      <div className="eval-grid">
        <FormField label="Data">
          <input type="date" className="eval-input" value={formData.dataAvaliacao}
            onChange={(e) => updateField('dataAvaliacao', e.target.value)} disabled={readOnly} />
        </FormField>
        <FormField label="Adesão ao plano alimentar (0–10)">
          <input type="number" min="0" max="10" className="eval-input" value={formData.adesao}
            onChange={(e) => updateField('adesao', e.target.value)} disabled={readOnly} />
        </FormField>
        {REFEICOES.map(({ key, label }) => (
          <FormFieldFull key={key} label={label}>
            <textarea className="eval-textarea" rows={2} value={formData[key]}
              onChange={(e) => updateField(key, e.target.value)}
              placeholder="Descreva o que consumiu (alimentos e quantidades aproximadas)"
              disabled={readOnly} />
          </FormFieldFull>
        ))}
        <FormFieldFull label="Observações">
          <textarea className="eval-textarea" rows={3} value={formData.observacoes}
            onChange={(e) => updateField('observacoes', e.target.value)} disabled={readOnly} />
        </FormFieldFull>
      </div>
      {error ? <div className="form-error-message">{error}</div> : null}
      <div className="eval-actions">
        <button type="button" className="eval-btn eval-btn-primary"
          onClick={handleSubmit} disabled={readOnly}>
          Enviar registro para revisão
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   AthleteHidratacaoForm — balanço hídrico simplificado
───────────────────────────────────────────────────────────── */

function AthleteHidratacaoForm({ pacienteId, onSalvar, readOnly = false }) {
  const [formData, setFormData] = useState(() => ({
    dataAvaliacao: toLocalDateInputValue(new Date()),
    pesoAntes: '',
    pesoApos: '',
    duracaoMin: '',
    volumeIngeridoMl: '',
    corUrina: '',
    sedePercebida: '',
    observacoes: ''
  }));
  const [error, setError] = useState('');

  const updateField = (field, value) => {
    setError('');
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const perdaPct = (() => {
    const antes = parseFloat(formData.pesoAntes);
    const apos = parseFloat(formData.pesoApos);
    if (!Number.isFinite(antes) || !Number.isFinite(apos) || antes <= 0) return null;
    return ((antes - apos) / antes * 100).toFixed(2);
  })();

  const hasInput = Object.entries(formData).some(
    ([key, value]) => key !== 'dataAvaliacao' && String(value || '').trim()
  );

  const handleSubmit = async () => {
    if (readOnly) return;
    if (!hasInput) { setError('Preencha ao menos um campo.'); return; }
    const payload = {
      tipo: 'hidratacao',
      pacienteId,
      data: formData.dataAvaliacao,
      measuredAt: formData.dataAvaliacao,
      formulaId: 'hidratacao_balanco_hidrico',
      formulaVersion: '2.0.0',
      schemaVersion: 2,
      sourceSystem: 'portal_atleta',
      dados: {
        relatoAtleta: true,
        dataAvaliacao: formData.dataAvaliacao,
        pesoAntesExercicio: formData.pesoAntes ? Number(formData.pesoAntes) : null,
        pesoAposExercicio: formData.pesoApos ? Number(formData.pesoApos) : null,
        duracaoExercicioMin: formData.duracaoMin ? Number(formData.duracaoMin) : null,
        volumeIngeridoMl: formData.volumeIngeridoMl ? Number(formData.volumeIngeridoMl) : null,
        perdaPesoPercentual: perdaPct !== null ? Number(perdaPct) : null,
        corUrinaManha: formData.corUrina ? Number(formData.corUrina) : null,
        sedePercebida: formData.sedePercebida ? Number(formData.sedePercebida) : null,
        observacoes: formData.observacoes,
        input: { ...formData }
      }
    };
    await Promise.resolve(onSalvar?.(payload));
  };

  return (
    <div className="eval-card">
      <div className="eval-grid">
        <FormField label="Data">
          <input type="date" className="eval-input" value={formData.dataAvaliacao}
            onChange={(e) => updateField('dataAvaliacao', e.target.value)} disabled={readOnly} />
        </FormField>
        <FormField label="Duração do exercício (min)">
          <input type="number" min="0" className="eval-input" value={formData.duracaoMin}
            onChange={(e) => updateField('duracaoMin', e.target.value)} disabled={readOnly} />
        </FormField>
        <FormField label="Peso antes do exercício (kg)">
          <input type="number" step="0.1" min="0" className="eval-input" value={formData.pesoAntes}
            onChange={(e) => updateField('pesoAntes', e.target.value)} disabled={readOnly} />
        </FormField>
        <FormField label="Peso após o exercício (kg)">
          <input type="number" step="0.1" min="0" className="eval-input" value={formData.pesoApos}
            onChange={(e) => updateField('pesoApos', e.target.value)} disabled={readOnly} />
        </FormField>
        {perdaPct !== null && (
          <div className="eval-field eval-field-full">
            <CalcResult>
              Perda estimada: <strong>{perdaPct}%</strong> do peso corporal
            </CalcResult>
          </div>
        )}
        <FormField label="Volume ingerido (ml)">
          <input type="number" min="0" className="eval-input" value={formData.volumeIngeridoMl}
            onChange={(e) => updateField('volumeIngeridoMl', e.target.value)} disabled={readOnly} />
        </FormField>
        <FormField label="Cor da urina (1 = claro · 8 = escuro)">
          <input type="number" min="1" max="8" className="eval-input" value={formData.corUrina}
            onChange={(e) => updateField('corUrina', e.target.value)} disabled={readOnly} />
        </FormField>
        <FormField label="Sede percebida (0 = sem sede · 10 = intensa)">
          <input type="number" min="0" max="10" className="eval-input" value={formData.sedePercebida}
            onChange={(e) => updateField('sedePercebida', e.target.value)} disabled={readOnly} />
        </FormField>
        <FormFieldFull label="Observações">
          <textarea className="eval-textarea" rows={3} value={formData.observacoes}
            onChange={(e) => updateField('observacoes', e.target.value)} disabled={readOnly} />
        </FormFieldFull>
      </div>
      {error ? <div className="form-error-message">{error}</div> : null}
      <div className="eval-actions">
        <button type="button" className="eval-btn eval-btn-primary"
          onClick={handleSubmit} disabled={readOnly}>
          Enviar registro para revisão
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   AthleteCargaTreinoForm — carga semanal por RPE
───────────────────────────────────────────────────────────── */

const FASE_TREINO_OPTIONS = [
  { value: 'preparacao_geral', label: 'Preparação geral' },
  { value: 'pre_temporada', label: 'Pré-temporada' },
  { value: 'temporada_competitiva', label: 'Temporada competitiva' },
  { value: 'pos_temporada', label: 'Pós-temporada / recuperação' },
  { value: 'ferias', label: 'Férias / descanso' },
  { value: 'lesionado', label: 'Período de lesão / afastamento' }
];

function AthleteCargaTreinoForm({ pacienteId, onSalvar, readOnly = false }) {
  const [formData, setFormData] = useState(() => ({
    dataAvaliacao: toLocalDateInputValue(new Date()),
    faseAtual: '',
    sessoesSemana: '',
    duracaoMedia: '',
    rpePercebido: '',
    observacoes: ''
  }));
  const [error, setError] = useState('');

  const updateField = (field, value) => {
    setError('');
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const cargaSemanaAtual = (() => {
    const sessoes = parseFloat(formData.sessoesSemana);
    const duracao = parseFloat(formData.duracaoMedia);
    const rpe = parseFloat(formData.rpePercebido);
    if (!Number.isFinite(sessoes) || !Number.isFinite(duracao) || !Number.isFinite(rpe)) return null;
    return Math.round(sessoes * duracao * rpe);
  })();

  const hasInput = formData.sessoesSemana || formData.faseAtual || formData.observacoes;

  const handleSubmit = async () => {
    if (readOnly) return;
    if (!hasInput) { setError('Preencha ao menos um campo.'); return; }
    const payload = {
      tipo: 'carga_treino',
      pacienteId,
      data: formData.dataAvaliacao,
      measuredAt: formData.dataAvaliacao,
      formulaId: 'acwr_monotonia_strain_v1',
      formulaVersion: '1.0.0',
      schemaVersion: 1,
      sourceSystem: 'portal_atleta',
      dados: {
        relatoAtleta: true,
        dataAvaliacao: formData.dataAvaliacao,
        faseAtual: formData.faseAtual || null,
        sessoesSemana: formData.sessoesSemana ? Number(formData.sessoesSemana) : null,
        duracaoMediaMin: formData.duracaoMedia ? Number(formData.duracaoMedia) : null,
        rpePercebido: formData.rpePercebido ? Number(formData.rpePercebido) : null,
        cargaSemanaAtual,
        observacoes: formData.observacoes,
        input: { ...formData }
      }
    };
    await Promise.resolve(onSalvar?.(payload));
  };

  return (
    <div className="eval-card">
      <div className="eval-grid">
        <FormField label="Semana de referência">
          <input type="date" className="eval-input" value={formData.dataAvaliacao}
            onChange={(e) => updateField('dataAvaliacao', e.target.value)} disabled={readOnly} />
        </FormField>
        <FormField label="Fase atual do treinamento">
          <select className="eval-input" value={formData.faseAtual}
            onChange={(e) => updateField('faseAtual', e.target.value)} disabled={readOnly}>
            <option value="">Selecione</option>
            {FASE_TREINO_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Sessões na semana">
          <input type="number" min="0" max="20" className="eval-input" value={formData.sessoesSemana}
            onChange={(e) => updateField('sessoesSemana', e.target.value)} disabled={readOnly} />
        </FormField>
        <FormField label="Duração média por sessão (min)">
          <input type="number" min="0" className="eval-input" value={formData.duracaoMedia}
            onChange={(e) => updateField('duracaoMedia', e.target.value)} disabled={readOnly} />
        </FormField>
        <FormField label="Intensidade percebida — RPE médio (0–10)">
          <input type="number" min="0" max="10" className="eval-input" value={formData.rpePercebido}
            onChange={(e) => updateField('rpePercebido', e.target.value)}
            placeholder="0 = repouso · 10 = máximo" disabled={readOnly} />
        </FormField>
        {cargaSemanaAtual !== null && (
          <div className="eval-field eval-field-full">
            <CalcResult>
              Carga estimada da semana: <strong>{cargaSemanaAtual} UA</strong>
              <span className="athlete-calc-result__note"> (sessões × duração × RPE)</span>
            </CalcResult>
          </div>
        )}
        <FormFieldFull label="Observações da semana">
          <textarea className="eval-textarea" rows={4} value={formData.observacoes}
            onChange={(e) => updateField('observacoes', e.target.value)}
            placeholder="Ex: lesão, cansaço, mudança de rotina, competição..."
            disabled={readOnly} />
        </FormFieldFull>
      </div>
      {error ? <div className="form-error-message">{error}</div> : null}
      <div className="eval-actions">
        <button type="button" className="eval-btn eval-btn-primary"
          onClick={handleSubmit} disabled={readOnly}>
          Enviar relato da semana para revisão
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   AthletePainReportForm — relato de dor / lesão
───────────────────────────────────────────────────────────── */

function AthletePainReportForm({
  pacienteId,
  patient,
  onSalvar,
  readOnly = false
}) {
  const [formData, setFormData] = useState(() => ({
    dataAvaliacao: toLocalDateInputValue(new Date()),
    queixaPrincipal: '',
    dorLocal: '',
    intensidadeDor: '',
    inicioSintomas: '',
    mecanismo: '',
    limitacaoTreino: '',
    sinaisAlerta: '',
    observacoes: ''
  }));
  const [error, setError] = useState('');

  const updateField = (field, value) => {
    setError('');
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const hasInput = Object.entries(formData).some(([key, value]) => (
    key !== 'dataAvaliacao' && String(value || '').trim()
  ));

  const handleSubmit = async () => {
    if (readOnly) return;
    if (!hasInput) {
      setError('Preencha ao menos um campo do relato.');
      return;
    }

    const payload = {
      tipo: 'fisioterapia',
      pacienteId,
      data: formData.dataAvaliacao,
      measuredAt: formData.dataAvaliacao,
      formulaId: 'fisioterapia_relato_atleta_v1',
      formulaVersion: '1.0.0',
      schemaVersion: 1,
      sourceSystem: 'portal_atleta',
      dados: {
        relatoAtleta: true,
        dataAvaliacao: formData.dataAvaliacao,
        queixaPrincipal: formData.queixaPrincipal,
        dorLocal: formData.dorLocal,
        intensidadeDor: formData.intensidadeDor,
        inicioSintomas: formData.inicioSintomas,
        mecanismo: formData.mecanismo,
        limitacaoTreino: formData.limitacaoTreino,
        sinaisAlerta: formData.sinaisAlerta,
        observacoes: formData.observacoes,
        input: {
          ...formData,
          atletaNome: patient?.nome || ''
        }
      },
      meta: {
        formularioAtleta: 'relato_dor_lesao'
      }
    };

    await Promise.resolve(onSalvar?.(payload));
  };

  return (
    <div className="eval-card">
      <div className="eval-grid">
        <FormField label="Data">
          <input type="date" className="eval-input" value={formData.dataAvaliacao}
            onChange={(e) => updateField('dataAvaliacao', e.target.value)} disabled={readOnly} />
        </FormField>
        <FormField label="Local da dor">
          <input type="text" className="eval-input" value={formData.dorLocal}
            onChange={(e) => updateField('dorLocal', e.target.value)}
            placeholder="Ex: joelho direito" disabled={readOnly} />
        </FormField>
        <FormField label="Intensidade da dor (0–10)">
          <input type="number" min="0" max="10" className="eval-input" value={formData.intensidadeDor}
            onChange={(e) => updateField('intensidadeDor', e.target.value)} disabled={readOnly} />
        </FormField>
        <FormField label="Início dos sintomas">
          <input type="text" className="eval-input" value={formData.inicioSintomas}
            onChange={(e) => updateField('inicioSintomas', e.target.value)}
            placeholder="Ex: há 3 dias" disabled={readOnly} />
        </FormField>
        <FormFieldFull label="O que aconteceu?">
          <textarea className="eval-textarea" rows={3} value={formData.queixaPrincipal}
            onChange={(e) => updateField('queixaPrincipal', e.target.value)}
            placeholder="Descreva o sintoma ou queixa principal." disabled={readOnly} />
        </FormFieldFull>
        <FormFieldFull label="Mecanismo ou contexto">
          <textarea className="eval-textarea" rows={3} value={formData.mecanismo}
            onChange={(e) => updateField('mecanismo', e.target.value)}
            placeholder="Ex: treino, jogo, queda, aumento de carga." disabled={readOnly} />
        </FormFieldFull>
        <FormFieldFull label="Limitação no treino">
          <textarea className="eval-textarea" rows={3} value={formData.limitacaoTreino}
            onChange={(e) => updateField('limitacaoTreino', e.target.value)}
            placeholder="Informe se precisou parar, reduzir carga ou evitar algum movimento." disabled={readOnly} />
        </FormFieldFull>
        <FormFieldFull label="Sinais de alerta percebidos">
          <textarea className="eval-textarea" rows={3} value={formData.sinaisAlerta}
            onChange={(e) => updateField('sinaisAlerta', e.target.value)}
            placeholder="Ex: edema, perda de força, formigamento, dor noturna." disabled={readOnly} />
        </FormFieldFull>
        <FormFieldFull label="Observações">
          <textarea className="eval-textarea" rows={4} value={formData.observacoes}
            onChange={(e) => updateField('observacoes', e.target.value)} disabled={readOnly} />
        </FormFieldFull>
      </div>
      {error ? <div className="form-error-message">{error}</div> : null}
      <div className="eval-actions">
        <button type="button" className="eval-btn eval-btn-primary"
          onClick={handleSubmit} disabled={readOnly}>
          Enviar relato para revisão
        </button>
      </div>
    </div>
  );
}
