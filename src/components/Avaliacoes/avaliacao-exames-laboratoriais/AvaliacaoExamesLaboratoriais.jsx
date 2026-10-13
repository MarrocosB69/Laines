import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '../../ui';
import { toLocalDateInputValue } from '../../../utils/dateUtils';
import {
  calculateLaboratoryEvaluation,
  resolveLaboratoryConductTone
} from '../../../services/calculationEngine';
import '../avaliacoes.css';
import {
  AvaliacaoModulo,
  AvaliacaoSecao,
  Campo,
  ResultadoCalculado,
  AvisoAvaliacao,
  BarraAcoesAvaliacao
} from '../base';
import './AvaliacaoExamesLaboratoriais.css';

// Tom do aviso de conduta (condutaLabStatus.tone) no aviso da base: o título e
// a mensagem já vão escritos; o ícone e o prefixo lido acompanham.
const CONDUTA_TIPO_AVISO = { risk: 'perigo', warn: 'atencao', ok: 'sucesso' };

// Catálogo completo de analitos com referências e unidades padrão.
// Usado para auto-preenchimento quando o profissional digita o nome manualmente.
const ANALITO_CATALOG = {
  'hemoglobina':              { unidade: 'g/dL',    referenciaMin: '12',     referenciaMax: '18' },
  'hematocrito':              { unidade: '%',        referenciaMin: '36',     referenciaMax: '54' },
  'vcm':                      { unidade: 'fL',       referenciaMin: '80',     referenciaMax: '100' },
  'hcm':                      { unidade: 'pg',       referenciaMin: '27',     referenciaMax: '33' },
  'leucocitos':               { unidade: '/mm³',     referenciaMin: '4000',   referenciaMax: '11000' },
  'plaquetas':                { unidade: '/mm³',     referenciaMin: '150000', referenciaMax: '450000' },
  'reticulocitos':            { unidade: '%',        referenciaMin: '0.5',    referenciaMax: '2.5' },
  'glicose jejum':            { unidade: 'mg/dL',   referenciaMin: '70',     referenciaMax: '99' },
  'glicose':                  { unidade: 'mg/dL',   referenciaMin: '70',     referenciaMax: '99' },
  'hba1c':                    { unidade: '%',        referenciaMin: '4',      referenciaMax: '5.7' },
  'creatinina':               { unidade: 'mg/dL',   referenciaMin: '0.5',    referenciaMax: '1.2' },
  'ureia':                    { unidade: 'mg/dL',   referenciaMin: '15',     referenciaMax: '40' },
  'acido urico':              { unidade: 'mg/dL',   referenciaMin: '2.5',    referenciaMax: '7.0' },
  'tgo (ast)':                { unidade: 'U/L',      referenciaMin: '5',      referenciaMax: '40' },
  'tgp (alt)':                { unidade: 'U/L',      referenciaMin: '7',      referenciaMax: '56' },
  'gama gt':                  { unidade: 'U/L',      referenciaMin: '5',      referenciaMax: '55' },
  'fosfatase alcalina':       { unidade: 'U/L',      referenciaMin: '40',     referenciaMax: '150' },
  'pcr':                      { unidade: 'mg/L',     referenciaMin: '0',      referenciaMax: '5' },
  'pcr ultrassensivel':       { unidade: 'mg/L',     referenciaMin: '0',      referenciaMax: '1' },
  'albumina':                 { unidade: 'g/dL',     referenciaMin: '3.5',    referenciaMax: '5.0' },
  'proteinas totais':         { unidade: 'g/dL',     referenciaMin: '6.0',    referenciaMax: '8.3' },
  'ldh':                      { unidade: 'U/L',      referenciaMin: '140',    referenciaMax: '280' },
  'ck (ck total)':            { unidade: 'U/L',      referenciaMin: '30',     referenciaMax: '200' },
  'creatina quinase':         { unidade: 'U/L',      referenciaMin: '30',     referenciaMax: '200' },
  'colesterol total':         { unidade: 'mg/dL',   referenciaMin: '0',      referenciaMax: '200' },
  'hdl':                      { unidade: 'mg/dL',   referenciaMin: '40',     referenciaMax: '60' },
  'ldl':                      { unidade: 'mg/dL',   referenciaMin: '0',      referenciaMax: '130' },
  'triglicerideos':           { unidade: 'mg/dL',   referenciaMin: '0',      referenciaMax: '150' },
  'vldl':                     { unidade: 'mg/dL',   referenciaMin: '0',      referenciaMax: '30' },
  'vitamina d (25-oh)':       { unidade: 'ng/mL',   referenciaMin: '30',     referenciaMax: '100' },
  'vitamina d':               { unidade: 'ng/mL',   referenciaMin: '30',     referenciaMax: '100' },
  'ferro serico':             { unidade: 'μg/dL',   referenciaMin: '60',     referenciaMax: '170' },
  'ferro':                    { unidade: 'μg/dL',   referenciaMin: '60',     referenciaMax: '170' },
  'ferritina':                { unidade: 'ng/mL',   referenciaMin: '12',     referenciaMax: '300' },
  'transferrina':             { unidade: 'mg/dL',   referenciaMin: '200',    referenciaMax: '360' },
  'saturacao transferrina':   { unidade: '%',        referenciaMin: '20',     referenciaMax: '50' },
  'vitamina b12':             { unidade: 'pg/mL',   referenciaMin: '200',    referenciaMax: '900' },
  'folato':                   { unidade: 'ng/mL',   referenciaMin: '3',      referenciaMax: '17' },
  'vitamina b6':              { unidade: 'nmol/L',  referenciaMin: '20',     referenciaMax: '125' },
  'zinco':                    { unidade: 'μg/dL',   referenciaMin: '70',     referenciaMax: '120' },
  'magnesio':                 { unidade: 'mg/dL',   referenciaMin: '1.6',    referenciaMax: '2.5' },
  'calcio':                   { unidade: 'mg/dL',   referenciaMin: '8.5',    referenciaMax: '10.5' },
  'fosforo':                  { unidade: 'mg/dL',   referenciaMin: '2.5',    referenciaMax: '4.5' },
  'selenio':                  { unidade: 'μg/L',    referenciaMin: '70',     referenciaMax: '150' },
  'tsh':                      { unidade: 'mUI/L',   referenciaMin: '0.4',    referenciaMax: '4.0' },
  't3 livre':                 { unidade: 'pg/mL',   referenciaMin: '2.3',    referenciaMax: '4.2' },
  't4 livre':                 { unidade: 'ng/dL',   referenciaMin: '0.8',    referenciaMax: '1.8' },
  'testosterona total':       { unidade: 'ng/dL',   referenciaMin: '300',    referenciaMax: '900' },
  'testosterona livre':       { unidade: 'pg/mL',   referenciaMin: '5',      referenciaMax: '21' },
  'cortisol':                 { unidade: 'μg/dL',   referenciaMin: '5',      referenciaMax: '25' },
  'cortisol manha':           { unidade: 'μg/dL',   referenciaMin: '10',     referenciaMax: '25' },
  'dheas':                    { unidade: 'μg/dL',   referenciaMin: '80',     referenciaMax: '560' },
  'igf-1':                    { unidade: 'ng/mL',   referenciaMin: '115',    referenciaMax: '355' },
  'insulina':                 { unidade: 'μUI/mL',  referenciaMin: '2',      referenciaMax: '25' },
  'estradiol':                { unidade: 'pg/mL',   referenciaMin: '15',     referenciaMax: '350' },
  'progesterona':             { unidade: 'ng/mL',   referenciaMin: '0.1',    referenciaMax: '25' },
  'fsh':                      { unidade: 'mUI/mL',  referenciaMin: '2',      referenciaMax: '15' },
  'lh':                       { unidade: 'mUI/mL',  referenciaMin: '1',      referenciaMax: '20' },
  'prolactina':               { unidade: 'ng/mL',   referenciaMin: '2',      referenciaMax: '29' },
  'shbg':                     { unidade: 'nmol/L',  referenciaMin: '20',     referenciaMax: '130' },
  'vitamina a':               { unidade: 'μg/dL',   referenciaMin: '30',     referenciaMax: '80' },
  'vitamina e':               { unidade: 'mg/L',    referenciaMin: '5',      referenciaMax: '18' },
  'vitamina c':               { unidade: 'mg/dL',   referenciaMin: '0.4',    referenciaMax: '2.0' },
  'sodio':                    { unidade: 'mEq/L',   referenciaMin: '136',    referenciaMax: '145' },
  'potassio':                 { unidade: 'mEq/L',   referenciaMin: '3.5',    referenciaMax: '5.1' },
  'cloreto':                  { unidade: 'mEq/L',   referenciaMin: '98',     referenciaMax: '107' },
  'bicarbonato':              { unidade: 'mEq/L',   referenciaMin: '22',     referenciaMax: '29' },
};

// Normaliza string para busca no catálogo (remove acentos, lowercase)
const normalizeCatalogKey = (str) => String(str || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .trim();

// Retorna os campos do catálogo para um nome de analito, ou null se não encontrado
const lookupAnalito = (nome) => {
  const key = normalizeCatalogKey(nome);
  if (!key) return null;
  if (ANALITO_CATALOG[key]) return ANALITO_CATALOG[key];
  // busca parcial: retorna o primeiro que começa com o nome digitado
  const match = Object.keys(ANALITO_CATALOG).find((k) => k.startsWith(key) || key.startsWith(k));
  return match ? ANALITO_CATALOG[match] : null;
};

const PAINEL_TEMPLATES = [
  {
    id: 'hematologico',
    label: 'Hematológico',
    analitos: [
      { nome: 'Hemoglobina', unidade: 'g/dL', referenciaMin: '12', referenciaMax: '18' },
      { nome: 'Hematócrito', unidade: '%', referenciaMin: '36', referenciaMax: '54' },
      { nome: 'VCM', unidade: 'fL', referenciaMin: '80', referenciaMax: '100' },
      { nome: 'HCM', unidade: 'pg', referenciaMin: '27', referenciaMax: '33' },
      { nome: 'Leucócitos', unidade: '/mm³', referenciaMin: '4000', referenciaMax: '11000' },
      { nome: 'Plaquetas', unidade: '/mm³', referenciaMin: '150000', referenciaMax: '450000' },
      { nome: 'Reticulócitos', unidade: '%', referenciaMin: '0.5', referenciaMax: '2.5' },
    ]
  },
  {
    id: 'bioquimico',
    label: 'Bioquímico básico',
    analitos: [
      { nome: 'Glicose jejum', unidade: 'mg/dL', referenciaMin: '70', referenciaMax: '99' },
      { nome: 'HbA1c', unidade: '%', referenciaMin: '4', referenciaMax: '5.7' },
      { nome: 'Creatinina', unidade: 'mg/dL', referenciaMin: '0.5', referenciaMax: '1.2' },
      { nome: 'Ureia', unidade: 'mg/dL', referenciaMin: '15', referenciaMax: '40' },
      { nome: 'Ácido úrico', unidade: 'mg/dL', referenciaMin: '2.5', referenciaMax: '7.0' },
      { nome: 'TGO (AST)', unidade: 'U/L', referenciaMin: '5', referenciaMax: '40' },
      { nome: 'TGP (ALT)', unidade: 'U/L', referenciaMin: '7', referenciaMax: '56' },
      { nome: 'PCR', unidade: 'mg/L', referenciaMin: '0', referenciaMax: '5' },
      { nome: 'Albumina', unidade: 'g/dL', referenciaMin: '3.5', referenciaMax: '5.0' },
    ]
  },
  {
    id: 'lipidios',
    label: 'Lipídios',
    analitos: [
      { nome: 'Colesterol total', unidade: 'mg/dL', referenciaMin: '0', referenciaMax: '200' },
      { nome: 'HDL', unidade: 'mg/dL', referenciaMin: '40', referenciaMax: '60' },
      { nome: 'LDL', unidade: 'mg/dL', referenciaMin: '0', referenciaMax: '130' },
      { nome: 'Triglicerídeos', unidade: 'mg/dL', referenciaMin: '0', referenciaMax: '150' },
      { nome: 'VLDL', unidade: 'mg/dL', referenciaMin: '0', referenciaMax: '30' },
    ]
  },
  {
    id: 'vitaminas_minerais',
    label: 'Vitaminas / Minerais (atleta)',
    analitos: [
      { nome: 'Vitamina D (25-OH)', unidade: 'ng/mL', referenciaMin: '30', referenciaMax: '100' },
      { nome: 'Ferro sérico', unidade: 'μg/dL', referenciaMin: '60', referenciaMax: '170' },
      { nome: 'Ferritina', unidade: 'ng/mL', referenciaMin: '12', referenciaMax: '300' },
      { nome: 'Saturação transferrina', unidade: '%', referenciaMin: '20', referenciaMax: '50' },
      { nome: 'Vitamina B12', unidade: 'pg/mL', referenciaMin: '200', referenciaMax: '900' },
      { nome: 'Folato', unidade: 'ng/mL', referenciaMin: '3', referenciaMax: '17' },
      { nome: 'Zinco', unidade: 'μg/dL', referenciaMin: '70', referenciaMax: '120' },
      { nome: 'Magnésio', unidade: 'mg/dL', referenciaMin: '1.6', referenciaMax: '2.5' },
      { nome: 'Cálcio', unidade: 'mg/dL', referenciaMin: '8.5', referenciaMax: '10.5' },
    ]
  },
  {
    id: 'hormonal',
    label: 'Hormonal',
    analitos: [
      { nome: 'TSH', unidade: 'mUI/L', referenciaMin: '0.4', referenciaMax: '4.0' },
      { nome: 'T3 livre', unidade: 'pg/mL', referenciaMin: '2.3', referenciaMax: '4.2' },
      { nome: 'T4 livre', unidade: 'ng/dL', referenciaMin: '0.8', referenciaMax: '1.8' },
      { nome: 'Testosterona total', unidade: 'ng/dL', referenciaMin: '300', referenciaMax: '900' },
      { nome: 'Cortisol', unidade: 'μg/dL', referenciaMin: '5', referenciaMax: '25' },
      { nome: 'DHEAS', unidade: 'μg/dL', referenciaMin: '80', referenciaMax: '560' },
      { nome: 'IGF-1', unidade: 'ng/mL', referenciaMin: '115', referenciaMax: '355' },
    ]
  },
  {
    id: 'hormonal_feminino_reds',
    label: 'Hormonal feminino / disponibilidade energética',
    analitos: [
      { nome: 'Estradiol', unidade: 'pg/mL', referenciaMin: '15', referenciaMax: '350' },
      { nome: 'Progesterona', unidade: 'ng/mL', referenciaMin: '0.1', referenciaMax: '25' },
      { nome: 'FSH', unidade: 'mUI/mL', referenciaMin: '2', referenciaMax: '15' },
      { nome: 'LH', unidade: 'mUI/mL', referenciaMin: '1', referenciaMax: '20' },
      { nome: 'Prolactina', unidade: 'ng/mL', referenciaMin: '2', referenciaMax: '29' },
      { nome: 'SHBG', unidade: 'nmol/L', referenciaMin: '20', referenciaMax: '130' },
      { nome: 'Cortisol', unidade: 'μg/dL', referenciaMin: '5', referenciaMax: '25' },
      { nome: 'TSH', unidade: 'mUI/L', referenciaMin: '0.4', referenciaMax: '4.0' },
      { nome: 'Vitamina D (25-OH)', unidade: 'ng/mL', referenciaMin: '30', referenciaMax: '100' },
      { nome: 'Cálcio', unidade: 'mg/dL', referenciaMin: '8.5', referenciaMax: '10.5' },
      { nome: 'Ferritina', unidade: 'ng/mL', referenciaMin: '12', referenciaMax: '300' },
    ]
  },
  {
    id: 'overtreinamento',
    label: 'Overtreinamento',
    analitos: [
      { nome: 'CK (CK total)', unidade: 'U/L', referenciaMin: '30', referenciaMax: '200' },
      { nome: 'LDH', unidade: 'U/L', referenciaMin: '140', referenciaMax: '280' },
      { nome: 'PCR ultrassensível', unidade: 'mg/L', referenciaMin: '0', referenciaMax: '1' },
      { nome: 'Cortisol', unidade: 'μg/dL', referenciaMin: '5', referenciaMax: '25' },
      { nome: 'Testosterona total', unidade: 'ng/dL', referenciaMin: '300', referenciaMax: '900' },
      { nome: 'IGF-1', unidade: 'ng/mL', referenciaMin: '115', referenciaMax: '355' },
      { nome: 'Ferritina', unidade: 'ng/mL', referenciaMin: '12', referenciaMax: '300' },
      { nome: 'Hemoglobina', unidade: 'g/dL', referenciaMin: '12', referenciaMax: '18' },
      { nome: 'Magnésio', unidade: 'mg/dL', referenciaMin: '1.6', referenciaMax: '2.5' },
    ]
  },
];

const createAnalito = (index = 0, fallbackDate = toLocalDateInputValue(new Date())) => ({
  id: `${Date.now()}-${index}`,
  nome: '',
  valor: '',
  unidade: '',
  referenciaMin: '',
  referenciaMax: '',
  dataColeta: fallbackDate,
  laboratorio: ''
});

const createInitialState = () => ({
  dataAvaliacao: toLocalDateInputValue(new Date()),
  painel: 'geral',
  laboratorio: '',
  analitos: [createAnalito(1)]
});

const AvaliacaoExamesLaboratoriais = ({
  pacienteId,
  onSalvar,
  onAutoSave,
  readOnly = false,
  onboardingContext,
  moduleSnapshot,
  currentSessionId,
  moduleHistory = []
}) => {
  const [formData, setFormData] = useState(createInitialState);
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
    const sourceAnalitos = source?.dados_brutos?.analitos
      || source?.analitos
      || input?.analitos
      || moduleSnapshot?.registros
      || [];

    setFormData({
      dataAvaliacao: normalizeDateValue(moduleSnapshot?.data || source?.dataAvaliacao || input?.dataAvaliacao),
      painel: toText(source?.dados_brutos?.painel || source?.painel || input?.painel || 'geral') || 'geral',
      laboratorio: toText(source?.dados_brutos?.laboratorio || source?.laboratorio || input?.laboratorio),
      analitos: Array.isArray(sourceAnalitos) && sourceAnalitos.length
        ? sourceAnalitos.map((item, index) => normalizeAnalito(item, index, normalizeDateValue(moduleSnapshot?.data || source?.dataAvaliacao || input?.dataAvaliacao)))
        : [createAnalito(1)]
    });

    loadedSnapshotIdRef.current = snapshotId;
  }, [moduleSnapshot]);

  const previousAnalitos = useMemo(() => {
    if (!Array.isArray(moduleHistory) || moduleHistory.length <= 1) return [];
    const previous = moduleHistory.find((item) => item?.id && item.id !== moduleSnapshot?.id);
    if (!previous) return [];
    const source = previous?.dados || {};
    const input = source?.input || {};
    const items = source?.dados_brutos?.analitos || source?.analitos || input?.analitos || previous?.registros || [];
    return Array.isArray(items) ? items : [];
  }, [moduleHistory, moduleSnapshot?.id]);

  const evaluation = useMemo(() => calculateLaboratoryEvaluation({
    dataAvaliacao: formData.dataAvaliacao,
    painel: formData.painel,
    analitos: formData.analitos,
    previousAnalitos
  }), [formData.analitos, formData.dataAvaliacao, formData.painel, previousAnalitos]);

  const hasValues = formData.analitos.some((item) => (
    item?.nome
    || item?.valor
    || item?.referenciaMin
    || item?.referenciaMax
  ));

  const handleRootChange = (field) => (event) => {
    setError('');
    const value = event?.target?.value ?? '';
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleAnalitoChange = (rowId, field) => (event) => {
    setError('');
    const value = event?.target?.value ?? '';
    setFormData((prev) => ({
      ...prev,
      analitos: prev.analitos.map((row) => (
        row.id === rowId ? { ...row, [field]: value } : row
      ))
    }));
  };

  // Auto-preenche unidade e referências ao sair do campo nome, se o catálogo reconhece o analito
  const handleAnalitoNomeBlur = (rowId) => (event) => {
    const nome = event?.target?.value ?? '';
    const catalog = lookupAnalito(nome);
    if (!catalog) return;
    setFormData((prev) => ({
      ...prev,
      analitos: prev.analitos.map((row) => {
        if (row.id !== rowId) return row;
        return {
          ...row,
          unidade: row.unidade || catalog.unidade,
          referenciaMin: row.referenciaMin || catalog.referenciaMin,
          referenciaMax: row.referenciaMax || catalog.referenciaMax,
        };
      })
    }));
  };

  const addAnalito = () => {
    setFormData((prev) => ({
      ...prev,
      analitos: [...prev.analitos, createAnalito(prev.analitos.length + 1, prev.dataAvaliacao)]
    }));
  };

  const removeAnalito = (rowId) => {
    setFormData((prev) => {
      const nextRows = prev.analitos.filter((row) => row.id !== rowId);
      return {
        ...prev,
        analitos: nextRows.length ? nextRows : [createAnalito(1, prev.dataAvaliacao)]
      };
    });
  };

  const isCurrentListEmpty = (analitos) => (
    analitos.length === 1
    && !analitos[0].nome
    && !analitos[0].valor
    && !analitos[0].referenciaMin
    && !analitos[0].referenciaMax
  );

  const applyTemplate = useCallback((template) => {
    const now = toLocalDateInputValue(new Date());
    const newRows = template.analitos.map((item, index) => ({
      id: `${Date.now()}-tpl-${index}`,
      nome: item.nome,
      valor: '',
      unidade: item.unidade,
      referenciaMin: item.referenciaMin,
      referenciaMax: item.referenciaMax,
      dataColeta: now,
      laboratorio: ''
    }));
    setFormData((prev) => ({
      ...prev,
      painel: template.label,
      analitos: isCurrentListEmpty(prev.analitos) ? newRows : [...prev.analitos, ...newRows]
    }));
  }, []);

  const dispatchSave = useCallback(async (auto = false) => {
    if (!auto && !hasValues) {
      setError('Adicione ao menos um analito para salvar a avaliação.');
      return;
    }

    const dispatch = auto ? onAutoSave : onSalvar;
    if (!dispatch) return;

    const normalized = evaluation?.inputNormalized || {};
    const calculated = evaluation?.calculated || {};
    const classifications = evaluation?.classifications || {};
    const warnings = Array.isArray(evaluation?.warnings) ? evaluation.warnings : [];
    const dataAvaliacao = normalizeDateValue(formData.dataAvaliacao);
    const laboratorio = toText(formData.laboratorio);

    setSaveStatus('saving');
    if (saveStatusResetRef.current) clearTimeout(saveStatusResetRef.current);
    try {
      await Promise.resolve(dispatch({
        tipo: 'exames_laboratoriais',
        pacienteId,
        data: dataAvaliacao,
        registros: normalized.analitos || [],
        dados: {
          dataAvaliacao,
          painel: normalized.painel || formData.painel || 'geral',
          laboratorio,
          analitos: normalized.analitos || [],
          dados_brutos: {
            painel: normalized.painel || formData.painel || 'geral',
            analitos: normalized.analitos || [],
            laboratorio: laboratorio || undefined
          },
          resultados_calculados: calculated,
          classificacoes: classifications,
          metadados_formula: {
            formulaId: 'lab_ref_range_v1',
            formulaVersion: '1.0.0'
          },
          input: {
            dataAvaliacao,
            painel: normalized.painel || formData.painel || 'geral',
            analitos: normalized.analitos || [],
            laboratorio
          },
          source: {
            mode: 'manual',
            lab: laboratorio || null
          },
          warnings
        },
        resultados: {
          calculated,
          output: {
            ...classifications,
            warnings
          }
        },
        classificacao: classifications?.statusPainel || 'sem_classificacao',
        classificacaoLabel: classifications?.statusPainel || 'sem_classificacao',
        schemaVersion: 1,
        formulaId: 'lab_ref_range_v1',
        formulaVersion: '1.0.0',
        sourceSystem: 'manual',
        sourceRef: laboratorio || undefined,
        measuredAt: dataAvaliacao,
        sessaoId: moduleSnapshot?.sessaoId || currentSessionId
      }));
      setSaveStatus('saved');
      saveStatusResetRef.current = setTimeout(() => setSaveStatus(null), 3000);
    } catch (error) {
      setSaveStatus('error');
      if (!auto) {
        setError('Não foi possível salvar a avaliação laboratorial.');
      }
    }
  }, [
    currentSessionId,
    evaluation,
    formData.dataAvaliacao,
    formData.laboratorio,
    formData.painel,
    hasValues,
    moduleSnapshot,
    onAutoSave,
    onSalvar,
    pacienteId
  ]);

  useEffect(() => {
    if (readOnly || !onAutoSave || !hasValues) return undefined;
    clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => {
      dispatchSave(true);
    }, 3500);
    return () => clearTimeout(autoSaveRef.current);
  }, [dispatchSave, hasValues, onAutoSave, readOnly]);

  useEffect(() => () => {
    if (saveStatusResetRef.current) clearTimeout(saveStatusResetRef.current);
  }, []);

  const summary = evaluation?.calculated || {};
  const classification = evaluation?.classifications?.statusPainel || 'sem_classificacao';
  const isPrefilledFromHistory = useMemo(() => {
    if (!moduleSnapshot?.id) return false;
    if (String(moduleSnapshot?.status || '').toLowerCase() !== 'finalizada') return false;
    if (!currentSessionId) return true;
    return String(moduleSnapshot?.sessaoId || '').trim() !== String(currentSessionId || '').trim();
  }, [currentSessionId, moduleSnapshot?.id, moduleSnapshot?.sessaoId, moduleSnapshot?.status]);
  const prefillSourceDate = useMemo(
    () => normalizeDateValue(moduleSnapshot?.data || moduleSnapshot?.updatedAt || moduleSnapshot?.createdAt),
    [moduleSnapshot?.createdAt, moduleSnapshot?.data, moduleSnapshot?.updatedAt]
  );
  const onboardingResumo = useMemo(() => ({
    modalidadePrincipal: toText(onboardingContext?.modalidadePrincipal),
    frequenciaSemanal: parseNumeric(onboardingContext?.frequenciaSemanal),
    duracaoSessao: parseNumeric(onboardingContext?.duracaoSessao)
  }), [
    onboardingContext?.duracaoSessao,
    onboardingContext?.frequenciaSemanal,
    onboardingContext?.modalidadePrincipal
  ]);

  // O tom sai do status real do painel (alterado, limitrofe, normal,
  // sem_classificacao); sem classificação é "ainda não consolidados", nunca
  // "consistentes" (WI-013, decisão 2). Os textos são os de antes.
  const condutaLabStatus = useMemo(() => {
    const tom = resolveLaboratoryConductTone({ statusPainel: classification, scoreRisco: summary.scoreRisco });
    if (tom === 'risk') {
      return {
        tone: 'risk',
        title: 'Exames sugerem conduta prioritária',
        message: 'Classificação laboratorial com risco elevado. Reforce revisão clínica antes da prescrição.'
      };
    }
    if (tom === 'warn') {
      return {
        tone: 'warn',
        title: 'Exames sugerem monitoramento',
        message: 'Há alterações que merecem seguimento próximo na evolução/retorno.'
      };
    }
    if (tom === 'ok') {
      return {
        tone: 'ok',
        title: 'Exames consistentes para conduta',
        message: 'Painel laboratorial disponivel para apoiar decisao clinica e plano alimentar.'
      };
    }
    return {
      tone: 'warn',
      title: 'Exames ainda não consolidados',
      message: 'Complete os analitos relevantes da sessão para fechar a conduta.'
    };
  }, [classification, summary.scoreRisco]);

  const handlePrepareNewCollection = useCallback(() => {
    const nowDate = toLocalDateInputValue(new Date());
    setFormData((prev) => ({
      ...prev,
      dataAvaliacao: nowDate,
      analitos: prev.analitos.map((row, index) => ({
        ...row,
        id: `${Date.now()}-${index}`,
        valor: '',
        dataColeta: nowDate
      }))
    }));
    setError('');
  }, []);

  return (
    <AvaliacaoModulo
      className={`eval-card avaliacao-exames-laboratoriais${readOnly ? ' eval-card--readonly' : ''}`}
      titulo="Exames laboratoriais"
      descricao="Analitos com classificação por referência e comparativo anterior."
      icone={<FileText size={22} />}
    >
      {readOnly && <AvisoAvaliacao tipo="info">Somente leitura para o seu perfil.</AvisoAvaliacao>}

      {isPrefilledFromHistory && (
        <AvisoAvaliacao tipo="info" className="avaliacao-exames-laboratoriais__prefill-note">
          <p>
            Pré-preenchimento inteligente ativo: usando estrutura da última coleta ({formatDateBr(prefillSourceDate)}).
            Revise os campos antes de salvar.
          </p>
          {!readOnly && (
            <Button
              type="button"
              variant="secondary"
              onClick={handlePrepareNewCollection}
            >
              Limpar valores para nova coleta
            </Button>
          )}
        </AvisoAvaliacao>
      )}

      <AvisoAvaliacao
        tipo={CONDUTA_TIPO_AVISO[condutaLabStatus.tone] || 'info'}
        className={`avaliacao-exames-laboratoriais__conduta-note tone-${condutaLabStatus.tone}`}
      >
        <strong>{condutaLabStatus.title}</strong>
        <p>{condutaLabStatus.message}</p>
        <small>
          Contexto: {onboardingResumo.modalidadePrincipal || 'modalidade não informada'}
          {' | '}
          Frequência: {Number.isFinite(onboardingResumo.frequenciaSemanal) ? `${onboardingResumo.frequenciaSemanal}x/sem` : 'não informada'}
          {' | '}
          Duração: {Number.isFinite(onboardingResumo.duracaoSessao) ? `${onboardingResumo.duracaoSessao} min` : 'não informada'}
        </small>
      </AvisoAvaliacao>

      {/* Os três campos ficavam soltos entre os avisos e os analitos; agora
          numa seção própria. Sem .eval-section, para a contagem do modo
          essencial continuar a mesma. */}
      <AvaliacaoSecao id="exames-coleta" titulo="Dados da coleta">
        <div className="av-grade">
          <Campo rotulo="Data da coleta" className="eval-field">
            <input
              type="date"
              className="eval-input"
              value={formData.dataAvaliacao}
              onChange={handleRootChange('dataAvaliacao')}
              disabled={readOnly}
            />
          </Campo>
          <Campo rotulo="Painel" className="eval-field">
            <input
              type="text"
              className="eval-input"
              value={formData.painel}
              onChange={handleRootChange('painel')}
              disabled={readOnly}
              placeholder="Ex.: lipidograma"
            />
          </Campo>
          <Campo rotulo="Laboratório (opcional)" className="eval-field eval-field-full">
            <input
              type="text"
              className="eval-input"
              value={formData.laboratorio}
              onChange={handleRootChange('laboratorio')}
              disabled={readOnly}
              placeholder="Nome do laboratório"
            />
          </Campo>
        </div>
      </AvaliacaoSecao>

      <AvaliacaoSecao
        id="exames-analitos"
        titulo="Analitos"
        className="eval-section"
        acoes={(
          <Button
            type="button"
            variant="secondary"
            onClick={addAnalito}
            disabled={readOnly}
          >
            <Plus size={16} /> Adicionar analito
          </Button>
        )}
      >
        {!readOnly && (
          <div className="avaliacao-exames-laboratoriais__templates" role="group" aria-labelledby="exames-carregar-painel">
            <span id="exames-carregar-painel" className="avaliacao-exames-laboratoriais__templates-label">Carregar painel:</span>
            {PAINEL_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                className="avaliacao-exames-laboratoriais__tpl-btn"
                onClick={() => applyTemplate(tpl)}
              >
                {tpl.label}
              </button>
            ))}
          </div>
        )}

        {/* Cabeçalho e linhas rolam juntos no invólucro (contrato, seção 3):
            em tela estreita as colunas continuam alinhadas ao cabeçalho. */}
        <div className="avaliacao-exames-laboratoriais__table-wrap">
          <div className="avaliacao-exames-laboratoriais__row avaliacao-exames-laboratoriais__row--header" aria-hidden="true">
            <span>Analito</span>
            <span>Valor</span>
            <span>Unidade</span>
            <span>Ref. min</span>
            <span>Ref. max</span>
            <span />
          </div>
          <div className="avaliacao-exames-laboratoriais__rows">
            {/* Cada campo da linha tem rótulo só para o leitor de tela, com a
                linha e a coluna já escritas no cabeçalho acima. */}
            {formData.analitos.map((row, linha) => (
              <div key={row.id} className="avaliacao-exames-laboratoriais__row">
                <Campo rotuloOculto rotulo={`Analito ${linha + 1}`}>
                  <input
                    type="text"
                    className="eval-input"
                    value={row.nome}
                    onChange={handleAnalitoChange(row.id, 'nome')}
                    onBlur={handleAnalitoNomeBlur(row.id)}
                    disabled={readOnly}
                    placeholder="Analito"
                  />
                </Campo>
                <Campo rotuloOculto rotulo={`Analito ${linha + 1}: Valor`}>
                  <input
                    type="number"
                    step="0.01"
                    className="eval-input"
                    value={row.valor}
                    onChange={handleAnalitoChange(row.id, 'valor')}
                    disabled={readOnly}
                    placeholder="Valor"
                  />
                </Campo>
                <Campo rotuloOculto rotulo={`Analito ${linha + 1}: Unidade`}>
                  <input
                    type="text"
                    className="eval-input"
                    value={row.unidade}
                    onChange={handleAnalitoChange(row.id, 'unidade')}
                    disabled={readOnly}
                    placeholder="Unidade"
                  />
                </Campo>
                <Campo rotuloOculto rotulo={`Analito ${linha + 1}: Ref. min`}>
                  <input
                    type="number"
                    step="0.01"
                    className="eval-input"
                    value={row.referenciaMin}
                    onChange={handleAnalitoChange(row.id, 'referenciaMin')}
                    disabled={readOnly}
                    placeholder="Ref. min"
                  />
                </Campo>
                <Campo rotuloOculto rotulo={`Analito ${linha + 1}: Ref. max`}>
                  <input
                    type="number"
                    step="0.01"
                    className="eval-input"
                    value={row.referenciaMax}
                    onChange={handleAnalitoChange(row.id, 'referenciaMax')}
                    disabled={readOnly}
                    placeholder="Ref. max"
                  />
                </Campo>
                <Button
                  type="button"
                  variant="secondary"
                  className="avaliacao-exames-laboratoriais__remove-btn"
                  onClick={() => removeAnalito(row.id)}
                  disabled={readOnly}
                  aria-label="Remover analito"
                  title="Remover analito"
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </AvaliacaoSecao>

      <AvaliacaoSecao id="exames-resumo" titulo="Resumo calculado" className="eval-section">
        <div className="av-resultados">
          <SummaryCard label="Alterados" value={summary.alteracoesCount} />
          <SummaryCard label="Limítrofes" value={summary.limitesCount} />
          <SummaryCard label="Normais" value={summary.normaisCount} />
          <SummaryCard label="Score de risco" value={summary.scoreRisco} unit="%" />
          <SummaryCard label="Classificação" value={classification} />
        </div>
        {evaluation?.warnings?.[0] && (
          <AvisoAvaliacao tipo="info">
            {evaluation.warnings[0]}
          </AvisoAvaliacao>
        )}
      </AvaliacaoSecao>

      {error && <AvisoAvaliacao tipo="perigo" anunciar>{error}</AvisoAvaliacao>}

      <BarraAcoesAvaliacao status={saveStatus}>
        <Button type="button" variant="primary" onClick={() => dispatchSave(false)} disabled={readOnly} loading={saveStatus === 'saving'}>
          <Save size={18} /> Salvar avaliação
        </Button>
      </BarraAcoesAvaliacao>
    </AvaliacaoModulo>
  );
};

const formatDateBr = (value) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'data não informada';
  return parsed.toLocaleDateString('pt-BR');
};

// Mesma assinatura e mesmo texto: o número com a unidade ao lado, o texto
// (a classificação do painel) como veio e "Não informado" na ausência.
const SummaryCard = ({ label, value, unit = '' }) => (
  <ResultadoCalculado
    className={`exames-resumo-card${Number.isFinite(value) ? '' : ' exames-resumo-card--texto'}`}
    rotulo={label}
    valor={Number.isFinite(value) ? value : (value || null)}
    unidade={Number.isFinite(value) && unit ? unit : undefined}
    semValor="Não informado"
  />
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

const normalizeAnalito = (item, index = 0, fallbackDate = toLocalDateInputValue(new Date())) => ({
  id: toText(item?.id || `${Date.now()}-${index}`),
  nome: toText(item?.nome || item?.analito),
  valor: toInputValue(item?.valor ?? item?.value ?? item?.resultado),
  unidade: toText(item?.unidade || item?.unit),
  referenciaMin: toInputValue(item?.referenciaMin ?? item?.refMin ?? item?.valorRefMin),
  referenciaMax: toInputValue(item?.referenciaMax ?? item?.refMax ?? item?.valorRefMax),
  dataColeta: normalizeDateValue(item?.dataColeta || item?.data || fallbackDate),
  laboratorio: toText(item?.laboratorio || item?.lab)
});

export default AvaliacaoExamesLaboratoriais;

