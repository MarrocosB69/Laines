import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useModalBodyLock } from '../../hooks/useModalBodyLock';
import { useModalFocusTrap } from '../../hooks/useModalFocusTrap';
import { getApiErrorMessage } from '../../services/api';
import './AthleteOnboardingModal.css';

const QUICK_OPTIONS = {
  temperos: ['Sal', 'Alho', 'Cebola', 'Pimenta', 'Ervas secas'],
  oleosGorduras: ['Óleo de soja', 'Azeite', 'Manteiga', 'Margarina', 'Banha'],
  equipamentosCasa: ['Fogão', 'Micro-ondas', 'Liquidificador', 'Airfryer', 'Geladeira']
};

const COMORBIDADES_OPTIONS = [
  { id: 'diabetes', label: 'Diabetes Mellitus (Tipo 1 ou 2)' },
  { id: 'hipertensao', label: 'Hipertensão arterial' },
  { id: 'anemia', label: 'Anemia' },
  { id: 'cardio', label: 'Doença cardiovascular' },
  { id: 'dislipidemia', label: 'Dislipidemia' },
  { id: 'renal_hepatica', label: 'Doença renal ou hepática' },
  { id: 'tireoide', label: 'Doença da tireoide' },
  { id: 'nenhum', label: 'Sem diagnóstico conhecido' }
];

const ONBOARDING_STEPS = [
  {
    id: 'identificacao',
    label: 'Identificação',
    fields: [
      'nomeCompleto',
      'dataNascimento',
      'pessoasCasa',
      'rendaMediaSm',
      'escolaridade',
      'atividadeFisica',
      'motivoAtendimento',
      'rotinaManha',
      'rotinaTarde',
      'rotinaNoite',
      'horarioDormir',
      'horarioAcordar'
    ]
  },
  {
    id: 'saude',
    label: 'Saúde e Alimentação',
    fields: [
      'usaMedicamentoSuplemento',
      'medicamentoDetalhes',
      'diagnosticosPessoais',
      'historicoFamiliar',
      'condicaoGastrointestinal',
      'alergiaIntolerancia',
      'naoGostaComer',
      'ingestaoAgua',
      'litrosAguaDia',
      'preparaRefeicoes',
      'quemPrepara',
      'temperos',
      'oleosGorduras',
      'equipamentosCasa',
      'bebidaAlcoolica',
      'fuma',
      'deliveryFrequencia',
      'dificuldadeDormir'
    ]
  },
  {
    id: 'resumo',
    label: 'Resumo Clínico',
    fields: ['observacoes', 'historicoSaude', 'comorbidadesPessoais', 'comorbidadesFamiliares']
  }
];

const parseListField = (value) => {
  if (!value || typeof value !== 'string') return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const parseArrayField = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || '').trim())
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const hasAnsweredValue = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean).length > 0;
  return String(value || '').trim().length > 0;
};

const isYes = (value) => String(value || '').trim().toLowerCase() === 'sim';
const yesNoValue = (checked) => (checked ? 'sim' : 'não');

const buildInitialData = (patient) => {
  const saved = patient?.confirmacaoAtleta?.dados || {};
  return {
    nomeCompleto: saved.nomeCompleto || patient?.nome || '',
    dataNascimento: saved.dataNascimento || patient?.dataNascimento || '',
    pessoasCasa: saved.pessoasCasa || '',
    rendaMediaSm: saved.rendaMediaSm || '',
    escolaridade: saved.escolaridade || '',
    atividadeFisica: saved.atividadeFisica || '',
    motivoAtendimento: saved.motivoAtendimento || '',
    usaMedicamentoSuplemento: saved.usaMedicamentoSuplemento || '',
    medicamentoDetalhes: saved.medicamentoDetalhes || '',
    diagnosticosPessoais: saved.diagnosticosPessoais || '',
    historicoFamiliar: saved.historicoFamiliar || '',
    condicaoGastrointestinal: saved.condicaoGastrointestinal || '',
    alergiaIntolerancia: saved.alergiaIntolerancia || '',
    naoGostaComer: saved.naoGostaComer || '',
    ingestaoAgua: saved.ingestaoAgua || '',
    litrosAguaDia: saved.litrosAguaDia || '',
    preparaRefeicoes: saved.preparaRefeicoes || '',
    quemPrepara: saved.quemPrepara || '',
    temperos: saved.temperos || '',
    oleosGorduras: saved.oleosGorduras || '',
    equipamentosCasa: saved.equipamentosCasa || '',
    bebidaAlcoolica: saved.bebidaAlcoolica || '',
    fuma: saved.fuma || '',
    deliveryFrequencia: saved.deliveryFrequencia || '',
    dificuldadeDormir: saved.dificuldadeDormir || '',
    rotinaManha: saved.rotinaManha || '',
    rotinaTarde: saved.rotinaTarde || '',
    rotinaNoite: saved.rotinaNoite || '',
    horarioDormir: saved.horarioDormir || '',
    horarioAcordar: saved.horarioAcordar || '',
    observacoes: saved.observacoes || patient?.observacoes || '',
    historicoSaude: saved.historicoSaude || patient?.historicoSaude || '',
    comorbidadesPessoais: parseArrayField(saved.comorbidadesPessoais || patient?.comorbidadesPessoais),
    comorbidadesFamiliares: parseArrayField(saved.comorbidadesFamiliares || patient?.comorbidadesFamiliares)
  };
};

const SectionLabel = ({ children }) => (
  <div className="athlete-onboarding-section-label md:col-span-2">{children}</div>
);

const TextField = ({ label, name, value, onChange, type = 'text', required = false, placeholder = '', colSpan = '' }) => (
  <label className={`athlete-onboarding-field ${colSpan}`.trim()}>
    <span>{label}{required ? ' *' : ''}</span>
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      className="athlete-onboarding-input"
      placeholder={placeholder}
      required={required}
    />
  </label>
);

const TextAreaField = ({
  label,
  name,
  value,
  onChange,
  placeholder = '',
  colSpan = '',
  required = false
}) => (
  <label className={`athlete-onboarding-field ${colSpan}`.trim()}>
    <span>{label}{required ? ' *' : ''}</span>
    <textarea
      name={name}
      value={value}
      onChange={onChange}
      className="athlete-onboarding-textarea"
      placeholder={placeholder}
      required={required}
    />
  </label>
);

const AthleteOnboardingModal = ({ isOpen, patient, onClose, onSave }) => {
  const [formData, setFormData] = useState(buildInitialData(patient));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const modalRef = useRef(null);
  // Ids dos títulos dos grupos de opções (role="group" + aria-labelledby).
  const grupoId = useId();

  useModalBodyLock(isOpen);
  useModalFocusTrap(isOpen, modalRef);

  useEffect(() => {
    if (!isOpen) return;
    setFormData(buildInitialData(patient));
    setError('');
    setSaving(false);
  }, [isOpen, patient]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleBooleanChange = useCallback((name, checked) => {
    setFormData((prev) => ({ ...prev, [name]: yesNoValue(checked) }));
  }, []);

  const handleToggleQuickOption = useCallback((field, option) => {
    setFormData((prev) => {
      const currentItems = parseListField(prev[field]);
      const hasOption = currentItems.includes(option);
      const nextItems = hasOption
        ? currentItems.filter((item) => item !== option)
        : [...currentItems, option];
      return {
        ...prev,
        [field]: nextItems.join(', ')
      };
    });
  }, []);

  const handleToggleComorbidade = useCallback((field, id) => {
    setFormData((prev) => {
      const current = new Set(parseArrayField(prev[field]));
      if (id === 'nenhum') {
        if (current.has('nenhum')) {
          current.clear();
        } else {
          current.clear();
          current.add('nenhum');
        }
      } else {
        current.delete('nenhum');
        if (current.has(id)) {
          current.delete(id);
        } else {
          current.add(id);
        }
      }
      return {
        ...prev,
        [field]: Array.from(current)
      };
    });
  }, []);

  const progress = useMemo(() => {
    const total = Object.keys(formData).length;
    const answered = Object.values(formData).filter((value) => hasAnsweredValue(value)).length;
    const percent = Math.round((answered / total) * 100);
    return { total, answered, percent };
  }, [formData]);

  const stepProgress = useMemo(() => {
    const items = ONBOARDING_STEPS.map((step) => {
      const answered = step.fields.filter((field) => hasAnsweredValue(formData[field])).length;
      const total = step.fields.length;
      return {
        ...step,
        answered,
        total,
        completed: total > 0 && answered === total
      };
    });

    const firstIncomplete = items.findIndex((step) => !step.completed);
    const activeIndex = firstIncomplete === -1 ? items.length - 1 : firstIncomplete;

    return {
      items,
      activeIndex: Math.max(activeIndex, 0)
    };
  }, [formData]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (
      !formData.nomeCompleto.trim()
      || !formData.dataNascimento
      || !String(formData.observacoes || '').trim()
      || !String(formData.historicoSaude || '').trim()
    ) {
      setError('Nome, data de nascimento, queixa principal e histórico de saúde são obrigatórios.');
      return;
    }

    setSaving(true);
    try {
      await onSave(formData);
      setSaving(false);
    } catch (err) {
      console.error('Erro ao salvar confirmação:', err);
      setError(getApiErrorMessage(err, 'Não foi possível salvar as informações.'));
      setSaving(false);
    }
  };

  const handleRequestClose = useCallback(() => {
    if (saving) return;
    onClose?.();
  }, [saving, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleRequestClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, handleRequestClose]);

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  const modalContent = (
    <div
      className="athlete-onboarding-overlay app-modal-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          handleRequestClose();
        }
      }}
    >
      <div
        className="athlete-onboarding-modal app-modal-shell app-modal-shell--xl"
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="athlete-onboarding-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="app-modal-header athlete-onboarding-header">
          <div className="app-modal-heading">
            <h2 id="athlete-onboarding-modal-title" className="app-modal-title">Confirmação inicial do atleta</h2>
            <p className="app-modal-subtitle">
              Complete seu cadastro inicial. Campos com checkbox deixam o preenchimento mais rápido.
            </p>
          </div>
          {onClose && (
            <button type="button" onClick={handleRequestClose} className="app-modal-close" aria-label="Fechar">
              <X size={18} />
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="athlete-onboarding-form app-modal-body">
          <div className="athlete-onboarding-progress">
            <div className="athlete-onboarding-progress-label">
              <span>
                Etapa {Math.min(stepProgress.activeIndex + 1, stepProgress.items.length)} de {stepProgress.items.length}
                {' '}• {progress.answered} de {progress.total} campos respondidos
              </span>
              <strong>{progress.percent}%</strong>
            </div>
            <div className="athlete-onboarding-stepper" aria-label="Progresso por etapas">
              {stepProgress.items.map((step, index) => (
                <div
                  key={step.id}
                  className={`athlete-onboarding-step ${step.completed ? 'is-done' : ''} ${index === stepProgress.activeIndex ? 'is-active' : ''}`}
                >
                  <span className="athlete-onboarding-step-index">{step.completed ? '✓' : index + 1}</span>
                  <div className="athlete-onboarding-step-content">
                    <strong>{step.label}</strong>
                    <small>{step.answered}/{step.total}</small>
                  </div>
                </div>
              ))}
            </div>
            <div className="athlete-onboarding-progress-track" aria-hidden="true">
              <div className="athlete-onboarding-progress-fill" style={{ width: `${progress.percent}%` }} />
            </div>
          </div>

          <div className="athlete-onboarding-grid">
            <SectionLabel>Identificação</SectionLabel>

            <TextField
              label="Nome completo"
              name="nomeCompleto"
              value={formData.nomeCompleto}
              onChange={handleChange}
              required
              colSpan="md:col-span-2"
            />

            <TextField
              label="Data de nascimento"
              name="dataNascimento"
              value={formData.dataNascimento}
              onChange={handleChange}
              type="date"
              required
            />

            <TextField
              label="Com quantas pessoas você mora?"
              name="pessoasCasa"
              value={formData.pessoasCasa}
              onChange={handleChange}
              type="number"
            />

            <TextField
              label="Renda média (em salários mínimos)"
              name="rendaMediaSm"
              value={formData.rendaMediaSm}
              onChange={handleChange}
              placeholder="Ex: 2 SM"
            />

            <TextField
              label="Nível de escolaridade"
              name="escolaridade"
              value={formData.escolaridade}
              onChange={handleChange}
            />

            <TextAreaField
              label="Prática atividade física? Informe horário e frequência"
              name="atividadeFisica"
              value={formData.atividadeFisica}
              onChange={handleChange}
              colSpan="md:col-span-2"
            />

            <TextAreaField
              label="Motivo para buscar atendimento nutricional"
              name="motivoAtendimento"
              value={formData.motivoAtendimento}
              onChange={handleChange}
              colSpan="md:col-span-2"
            />

            <SectionLabel>Saúde e histórico</SectionLabel>

            <div className="athlete-onboarding-toggle md:col-span-2">
              <label className="athlete-onboarding-checkbox">
                <input
                  type="checkbox"
                  checked={isYes(formData.usaMedicamentoSuplemento)}
                  onChange={(event) => handleBooleanChange('usaMedicamentoSuplemento', event.target.checked)}
                />
                <span>Faço uso de medicamento ou suplemento</span>
              </label>
              <p>Desmarcado = não.</p>
            </div>

            {isYes(formData.usaMedicamentoSuplemento) && (
              <TextAreaField
                label="Quais itens, quantidade e horário de uso?"
                name="medicamentoDetalhes"
                value={formData.medicamentoDetalhes}
                onChange={handleChange}
                colSpan="md:col-span-2"
              />
            )}

            <TextAreaField
              label="Diagnóstico de alguma doença"
              name="diagnosticosPessoais"
              value={formData.diagnosticosPessoais}
              onChange={handleChange}
              colSpan="md:col-span-2"
            />

            <TextAreaField
              label="Histórico familiar de doenças"
              name="historicoFamiliar"
              value={formData.historicoFamiliar}
              onChange={handleChange}
              colSpan="md:col-span-2"
            />

            <TextAreaField
              label="Condições do trato gastrointestinal"
              name="condicaoGastrointestinal"
              value={formData.condicaoGastrointestinal}
              onChange={handleChange}
              colSpan="md:col-span-2"
            />

            <TextAreaField
              label="Alergia ou intolerância alimentar"
              name="alergiaIntolerancia"
              value={formData.alergiaIntolerancia}
              onChange={handleChange}
              colSpan="md:col-span-2"
            />

            <SectionLabel>Alimentação e rotina</SectionLabel>

            <TextAreaField
              label="O que você não gosta de comer?"
              name="naoGostaComer"
              value={formData.naoGostaComer}
              onChange={handleChange}
              colSpan="md:col-span-2"
            />

            <TextField
              label="Como considera sua ingestão de água?"
              name="ingestaoAgua"
              value={formData.ingestaoAgua}
              onChange={handleChange}
            />

            <TextField
              label="Quantos litros de água por dia?"
              name="litrosAguaDia"
              value={formData.litrosAguaDia}
              onChange={handleChange}
            />

            <div className="athlete-onboarding-toggle">
              <label className="athlete-onboarding-checkbox">
                <input
                  type="checkbox"
                  checked={isYes(formData.preparaRefeicoes)}
                  onChange={(event) => handleBooleanChange('preparaRefeicoes', event.target.checked)}
                />
                <span>Tenho habilidade para preparar refeições</span>
              </label>
              <p>Desmarcado = não.</p>
            </div>

            <TextField
              label="Quem prepara sua comida?"
              name="quemPrepara"
              value={formData.quemPrepara}
              onChange={handleChange}
              placeholder={isYes(formData.preparaRefeicoes) ? 'Ex: eu mesmo(a)' : 'Ex: mãe, pai, parceiro(a)'}
            />

            <div className="athlete-onboarding-field athlete-onboarding-group md:col-span-2" role="group" aria-labelledby={`${grupoId}-temperos`}>
              <span id={`${grupoId}-temperos`}>Temperos utilizados ao cozinhar</span>
              <div className="athlete-onboarding-check-grid">
                {QUICK_OPTIONS.temperos.map((option) => (
                  <label key={option} className="athlete-onboarding-check-item">
                    <input
                      type="checkbox"
                      checked={parseListField(formData.temperos).includes(option)}
                      onChange={() => handleToggleQuickOption('temperos', option)}
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
              <input
                type="text"
                name="temperos"
                value={formData.temperos}
                onChange={handleChange}
                className="athlete-onboarding-input"
                placeholder="Outros separados por vírgula"
                aria-labelledby={`${grupoId}-temperos`}
              />
            </div>

            <div className="athlete-onboarding-field athlete-onboarding-group md:col-span-2" role="group" aria-labelledby={`${grupoId}-oleosGorduras`}>
              <span id={`${grupoId}-oleosGorduras`}>Óleos ou gorduras utilizadas</span>
              <div className="athlete-onboarding-check-grid">
                {QUICK_OPTIONS.oleosGorduras.map((option) => (
                  <label key={option} className="athlete-onboarding-check-item">
                    <input
                      type="checkbox"
                      checked={parseListField(formData.oleosGorduras).includes(option)}
                      onChange={() => handleToggleQuickOption('oleosGorduras', option)}
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
              <input
                type="text"
                name="oleosGorduras"
                value={formData.oleosGorduras}
                onChange={handleChange}
                className="athlete-onboarding-input"
                placeholder="Outros separados por vírgula"
                aria-labelledby={`${grupoId}-oleosGorduras`}
              />
            </div>

            <div className="athlete-onboarding-field athlete-onboarding-group md:col-span-2" role="group" aria-labelledby={`${grupoId}-equipamentosCasa`}>
              <span id={`${grupoId}-equipamentosCasa`}>Equipamentos disponíveis em casa</span>
              <div className="athlete-onboarding-check-grid">
                {QUICK_OPTIONS.equipamentosCasa.map((option) => (
                  <label key={option} className="athlete-onboarding-check-item">
                    <input
                      type="checkbox"
                      checked={parseListField(formData.equipamentosCasa).includes(option)}
                      onChange={() => handleToggleQuickOption('equipamentosCasa', option)}
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
              <input
                type="text"
                name="equipamentosCasa"
                value={formData.equipamentosCasa}
                onChange={handleChange}
                className="athlete-onboarding-input"
                placeholder="Outros separados por vírgula"
                aria-labelledby={`${grupoId}-equipamentosCasa`}
              />
            </div>

            <div className="athlete-onboarding-toggle">
              <label className="athlete-onboarding-checkbox">
                <input
                  type="checkbox"
                  checked={isYes(formData.bebidaAlcoolica)}
                  onChange={(event) => handleBooleanChange('bebidaAlcoolica', event.target.checked)}
                />
                <span>Consumo de bebida alcoólica</span>
              </label>
              <p>Desmarcado = não.</p>
            </div>

            <div className="athlete-onboarding-toggle">
              <label className="athlete-onboarding-checkbox">
                <input
                  type="checkbox"
                  checked={isYes(formData.fuma)}
                  onChange={(event) => handleBooleanChange('fuma', event.target.checked)}
                />
                <span>Fumo atualmente</span>
              </label>
              <p>Desmarcado = não.</p>
            </div>

            <TextField
              label="Frequência de pedido por delivery"
              name="deliveryFrequencia"
              value={formData.deliveryFrequencia}
              onChange={handleChange}
            />

            <div className="athlete-onboarding-toggle">
              <label className="athlete-onboarding-checkbox">
                <input
                  type="checkbox"
                  checked={isYes(formData.dificuldadeDormir)}
                  onChange={(event) => handleBooleanChange('dificuldadeDormir', event.target.checked)}
                />
                <span>Tenho dificuldade para dormir</span>
              </label>
              <p>Desmarcado = não.</p>
            </div>

            <TextAreaField
              label="Da hora que acorda até o almoço"
              name="rotinaManha"
              value={formData.rotinaManha}
              onChange={handleChange}
              colSpan="md:col-span-2"
            />

            <TextAreaField
              label="Do almoço até a janta"
              name="rotinaTarde"
              value={formData.rotinaTarde}
              onChange={handleChange}
              colSpan="md:col-span-2"
            />

            <TextAreaField
              label="Da janta até dormir"
              name="rotinaNoite"
              value={formData.rotinaNoite}
              onChange={handleChange}
              colSpan="md:col-span-2"
            />

            <TextField
              label="Horário que geralmente dorme"
              name="horarioDormir"
              value={formData.horarioDormir}
              onChange={handleChange}
              type="time"
            />

            <TextField
              label="Horário que geralmente acorda"
              name="horarioAcordar"
              value={formData.horarioAcordar}
              onChange={handleChange}
              type="time"
            />

            <SectionLabel>Resumo clínico inicial</SectionLabel>

            <TextAreaField
              label="Queixa principal"
              name="observacoes"
              value={formData.observacoes}
              onChange={handleChange}
              colSpan="md:col-span-2"
              required
              placeholder="Descreva o principal motivo clínico deste acompanhamento."
            />

            <TextAreaField
              label="Histórico de saúde"
              name="historicoSaude"
              value={formData.historicoSaude}
              onChange={handleChange}
              colSpan="md:col-span-2"
              required
              placeholder="Registre doenças prévias, tratamentos e contexto de saúde relevante."
            />

            <div className="athlete-onboarding-field athlete-onboarding-group md:col-span-2" role="group" aria-labelledby={`${grupoId}-comorbidadesPessoais`}>
              <span id={`${grupoId}-comorbidadesPessoais`}>Comorbidades pessoais</span>
              <div className="athlete-onboarding-check-grid">
                {COMORBIDADES_OPTIONS.map((option) => (
                  <label key={`pessoal-${option.id}`} className="athlete-onboarding-check-item">
                    <input
                      type="checkbox"
                      checked={parseArrayField(formData.comorbidadesPessoais).includes(option.id)}
                      onChange={() => handleToggleComorbidade('comorbidadesPessoais', option.id)}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="athlete-onboarding-field athlete-onboarding-group md:col-span-2" role="group" aria-labelledby={`${grupoId}-comorbidadesFamiliares`}>
              <span id={`${grupoId}-comorbidadesFamiliares`}>Comorbidades familiares</span>
              <div className="athlete-onboarding-check-grid">
                {COMORBIDADES_OPTIONS.map((option) => (
                  <label key={`familiar-${option.id}`} className="athlete-onboarding-check-item">
                    <input
                      type="checkbox"
                      checked={parseArrayField(formData.comorbidadesFamiliares).includes(option.id)}
                      onChange={() => handleToggleComorbidade('comorbidadesFamiliares', option.id)}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {error && (
            <div className="athlete-onboarding-error" role="alert">
              {error}
            </div>
          )}

          <div className="app-modal-footer">
            <div className="app-modal-actions">
              {onClose && (
                <button
                  type="button"
                  onClick={handleRequestClose}
                  className="app-modal-btn app-modal-btn--secondary"
                  disabled={saving}
                >
                  Depois
                </button>
              )}
              <button
                type="submit"
                className="app-modal-btn app-modal-btn--primary"
                disabled={saving}
              >
                {saving ? 'Salvando...' : 'Salvar cadastro'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default AthleteOnboardingModal;

