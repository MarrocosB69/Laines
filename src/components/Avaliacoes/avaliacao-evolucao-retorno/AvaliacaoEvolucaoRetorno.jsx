import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCcw, Save } from 'lucide-react';
import { Button } from '../../ui';
import { toLocalDateInputValue } from '../../../utils/dateUtils';
import { calculateEvolutionReturnEvaluation } from '../../../services/calculationEngine';
import '../avaliacoes.css';
import {
  AvaliacaoModulo,
  AvaliacaoSecao,
  Campo,
  AvisoAvaliacao,
  BarraAcoesAvaliacao
} from '../base';
import './AvaliacaoEvolucaoRetorno.css';

// Tipo do aviso da base para o tom que condutaStatus já calcula.
const AVISO_DO_TOM = { risk: 'perigo', warn: 'atencao', ok: 'sucesso' };

const createInitialState = () => ({
  dataAvaliacao: toLocalDateInputValue(new Date()),
  adesaoPlanoAlimentar: '',
  adesaoAtividadeFisica: '',
  respostaPercebida: '',
  objetivos: '',
  intercorrencias: '',
  sintomas: '',
  conduta: '',
  proximaAvaliacao: toLocalDateInputValue(new Date())
});

const AvaliacaoEvolucaoRetorno = ({
  pacienteId,
  onSalvar,
  onAutoSave,
  readOnly = false,
  onboardingContext,
  moduleSnapshot,
  currentSessionId,
  allEvaluationHistory = []
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
    const dadosBrutos = source?.dados_brutos || {};

    const objetivosList = Array.isArray(dadosBrutos?.objetivos)
      ? dadosBrutos.objetivos
      : Array.isArray(input?.objetivos)
        ? input.objetivos
        : [];

    setFormData({
      dataAvaliacao: normalizeDateValue(moduleSnapshot?.data || source?.dataAvaliacao || input?.dataAvaliacao),
      adesaoPlanoAlimentar: toInputValue(dadosBrutos?.adesaoPlanoAlimentar ?? source?.adesaoPlanoAlimentar ?? input?.adesaoPlanoAlimentar),
      adesaoAtividadeFisica: toInputValue(dadosBrutos?.adesaoAtividadeFisica ?? source?.adesaoAtividadeFisica ?? input?.adesaoAtividadeFisica),
      respostaPercebida: toInputValue(dadosBrutos?.respostaPercebida ?? source?.respostaPercebida ?? input?.respostaPercebida),
      objetivos: objetivosList.join('\n'),
      intercorrencias: toText(dadosBrutos?.intercorrencias || source?.intercorrencias || input?.intercorrencias),
      sintomas: toText(dadosBrutos?.sintomas || source?.sintomas || input?.sintomas),
      conduta: toText(dadosBrutos?.conduta || source?.conduta || input?.conduta),
      proximaAvaliacao: normalizeDateValue(dadosBrutos?.proximaAvaliacao || source?.proximaAvaliacao || input?.proximaAvaliacao)
    });

    loadedSnapshotIdRef.current = snapshotId;
  }, [moduleSnapshot]);

  const objetivosList = useMemo(() => String(formData.objetivos || '')
    .split(/[\n,;]+/g)
    .map((item) => item.trim())
    .filter(Boolean), [formData.objetivos]);

  const calculation = useMemo(() => calculateEvolutionReturnEvaluation({
    dataAvaliacao: formData.dataAvaliacao,
    adesaoPlanoAlimentar: formData.adesaoPlanoAlimentar,
    adesaoAtividadeFisica: formData.adesaoAtividadeFisica,
    respostaPercebida: formData.respostaPercebida,
    objetivos: objetivosList,
    intercorrencias: formData.intercorrencias,
    sintomas: formData.sintomas,
    conduta: formData.conduta,
    proximaAvaliacao: formData.proximaAvaliacao
  }), [
    formData.adesaoAtividadeFisica,
    formData.adesaoPlanoAlimentar,
    formData.conduta,
    formData.dataAvaliacao,
    formData.intercorrencias,
    formData.proximaAvaliacao,
    formData.respostaPercebida,
    formData.sintomas,
    objetivosList
  ]);

  const hasValues = Boolean(
    formData.adesaoPlanoAlimentar
    || formData.adesaoAtividadeFisica
    || formData.respostaPercebida
    || formData.intercorrencias
    || formData.sintomas
    || formData.conduta
  );

  const handleChange = (field) => (event) => {
    setError('');
    const value = event?.target?.value ?? '';
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const dispatchSave = useCallback(async (auto = false) => {
    if (!auto && !hasValues) {
      setError('Preencha ao menos os indicadores de adesão para salvar a avaliação.');
      return;
    }

    const dispatch = auto ? onAutoSave : onSalvar;
    if (!dispatch) return;

    const normalized = calculation?.inputNormalized || {};
    const calculated = calculation?.calculated || {};
    const classifications = calculation?.classifications || {};
    const warnings = Array.isArray(calculation?.warnings) ? calculation.warnings : [];
    const dataAvaliacao = normalizeDateValue(formData.dataAvaliacao);

    setSaveStatus('saving');
    if (saveStatusResetRef.current) clearTimeout(saveStatusResetRef.current);
    try {
      await Promise.resolve(dispatch({
        tipo: 'evolucao_retorno',
        pacienteId,
        data: dataAvaliacao,
        dados: {
          dataAvaliacao,
          dados_brutos: {
            ...normalized
          },
          resultados_calculados: {
            ...calculated
          },
          classificacoes: {
            ...classifications
          },
          metadados_formula: {
            formulaId: 'evolucao_adesao_score_v1',
            formulaVersion: '1.0.0'
          },
          input: {
            ...normalized
          },
          source: {
            mode: 'manual'
          },
          warnings
        },
        resultados: {
          score_adesao_geral: calculated?.scoreAdesaoGeral ?? null,
          prioridade_cuidado: classifications?.prioridadeRetorno ?? null,
          calculated,
          output: {
            ...classifications,
            warnings
          }
        },
        classificacao: classifications?.prioridadeRetorno || 'sem_classificacao',
        // Rótulo legível, no padrão que o servidor já usa ("Prioridade alta").
        classificacaoLabel: classifications?.prioridadeRetorno
          ? `Prioridade ${classifications.prioridadeRetorno}`
          : 'Sem classificação',
        schemaVersion: 1,
        formulaId: 'evolucao_adesao_score_v1',
        formulaVersion: '1.0.0',
        sourceSystem: 'manual',
        measuredAt: dataAvaliacao,
        sessaoId: moduleSnapshot?.sessaoId || currentSessionId
      }));
      setSaveStatus('saved');
      saveStatusResetRef.current = setTimeout(() => setSaveStatus(null), 3000);
    } catch (error) {
      setSaveStatus('error');
      if (!auto) {
        setError('Não foi possível salvar a avaliação.');
      }
    }
  }, [
    calculation,
    currentSessionId,
    formData.dataAvaliacao,
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

  // Sem nenhum componente de adesão, escore e prioridade são nulos: o escore
  // aparece "—" e a prioridade "Sem classificação", nunca o código cru.
  const score = calculation?.calculated?.scoreAdesaoGeral;
  const prioridade = calculation?.classifications?.prioridadeRetorno || null;
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

  // Evolução anterior (sessão diferente da atual) para comparativo temporal
  const previousEvolution = useMemo(() => {
    const tipo = 'evolucao_retorno';
    if (!Array.isArray(allEvaluationHistory)) return null;
    const all = allEvaluationHistory.filter(
      (item) => normalizeType(item?.tipo) === tipo && item?.status === 'finalizada'
    );
    if (!all.length) return null;
    const currentId = moduleSnapshot?.id;
    const currentSessao = String(currentSessionId || '').trim();
    // Preferencia: mais recente fora da sessão atual
    const prev = all.find((item) => {
      if (currentId && item?.id === currentId) return false;
      if (currentSessao && String(item?.sessaoId || '').trim() === currentSessao) return false;
      return true;
    });
    return prev || null;
  }, [allEvaluationHistory, moduleSnapshot?.id, currentSessionId]);

  const prevScores = useMemo(() => {
    if (!previousEvolution) return null;
    const src = previousEvolution?.dados || {};
    const brutos = src?.dados_brutos || {};
    const input = src?.input || {};
    const calc = previousEvolution?.resultados?.calculated || {};
    return {
      data: previousEvolution?.data || null,
      adesaoPlano: parseNumeric(brutos.adesaoPlanoAlimentar ?? input.adesaoPlanoAlimentar),
      adesaoAF: parseNumeric(brutos.adesaoAtividadeFisica ?? input.adesaoAtividadeFisica),
      resposta: parseNumeric(brutos.respostaPercebida ?? input.respostaPercebida),
      score: parseNumeric(calc.scoreAdesaoGeral ?? previousEvolution?.resultados?.score_adesao_geral),
    };
  }, [previousEvolution]);

  const metasAtivas = objetivosList.length;

  const condutaStatus = useMemo(() => {
    const prioridadeToken = String(prioridade || '').toLowerCase();
    if (prioridadeToken.includes('alta') || prioridadeToken.includes('urgente')) {
      return {
        tone: 'risk',
        title: 'Retorno exige conduta prioritária',
        message: 'Prioridade elevada de acompanhamento. Ajuste plano e monitoramento próximo.'
      };
    }
    if (Number.isFinite(score) && score < 60) {
      return {
        tone: 'warn',
        title: 'Aplicação da Dieta baixa para conduta',
        message: 'Reforçar estratégias de aplicação da dieta antes de progressão agressiva do plano.'
      };
    }
    if (hasValues && Number.isFinite(score)) {
      return {
        tone: 'ok',
        title: 'Evolução consistente para conduta',
        message: 'Dados de retorno prontos para apoiar metas e prescrição alimentar.'
      };
    }
    return {
      tone: 'warn',
      title: 'Evolução ainda incompleta',
      message: 'Complete os campos de retorno para fechar a etapa de conduta.'
    };
  }, [hasValues, prioridade, score]);

  const handlePrepareNewEvolution = useCallback(() => {
    const today = toLocalDateInputValue(new Date());
    setFormData((prev) => ({
      ...prev,
      dataAvaliacao: today,
      adesaoPlanoAlimentar: '',
      adesaoAtividadeFisica: '',
      respostaPercebida: '',
      intercorrencias: '',
      sintomas: '',
      conduta: '',
      proximaAvaliacao: today
    }));
    setError('');
  }, []);

  return (
    <AvaliacaoModulo
      className={`eval-card avaliacao-evolucao-retorno${readOnly ? ' eval-card--readonly' : ''}`}
      titulo="Evolução e retorno"
      descricao="Aplicação da Dieta, sinais de progresso e prioridade de acompanhamento."
      icone={<RefreshCcw size={22} />}
    >
      {readOnly && <AvisoAvaliacao tipo="info">Somente leitura para o seu perfil.</AvisoAvaliacao>}

      {isPrefilledFromHistory && (
        <AvisoAvaliacao tipo="info" className="avaliacao-evolucao-retorno__prefill-note">
          <p>
            Pré-preenchimento inteligente ativo: usando dados da última evolução ({formatDateBr(prefillSourceDate)}).
            Revise os campos e registre o novo ciclo.
          </p>
          {!readOnly && (
            <Button
              type="button"
              variant="secondary"
              onClick={handlePrepareNewEvolution}
            >
              Nova evolução mantendo objetivos
            </Button>
          )}
        </AvisoAvaliacao>
      )}

      {/* Os três indicadores que entram no score, com a data em que foram
          colhidos. */}
      <AvaliacaoSecao id="evolucao-adesao" titulo="Indicadores de adesão">
        <div className="eval-grid">
          <Campo rotulo="Data da consulta" className="eval-field">
            <input
              type="date"
              className="eval-input"
              value={formData.dataAvaliacao}
              onChange={handleChange('dataAvaliacao')}
              disabled={readOnly}
            />
          </Campo>
          <Campo rotulo="Aplicação da Dieta (%)" className="eval-field">
            <input
              type="number"
              min="0"
              max="100"
              className="eval-input"
              value={formData.adesaoPlanoAlimentar}
              onChange={handleChange('adesaoPlanoAlimentar')}
              disabled={readOnly}
            />
          </Campo>
          <Campo rotulo="Adesão à atividade física (%)" className="eval-field">
            <input
              type="number"
              min="0"
              max="100"
              className="eval-input"
              value={formData.adesaoAtividadeFisica}
              onChange={handleChange('adesaoAtividadeFisica')}
              disabled={readOnly}
            />
          </Campo>
          <Campo rotulo="Resposta percebida (1-5)" className="eval-field">
            <input
              type="number"
              min="1"
              max="5"
              step="1"
              className="eval-input"
              value={formData.respostaPercebida}
              onChange={handleChange('respostaPercebida')}
              disabled={readOnly}
            />
          </Campo>
        </div>
      </AvaliacaoSecao>

      {/* O que aconteceu desde a última consulta, a conduta e o próximo
          encontro. */}
      <AvaliacaoSecao id="evolucao-registro" titulo="Registro da consulta">
        <div className="eval-grid">
          <Campo rotulo="Objetivos em acompanhamento (um por linha)" className="eval-field eval-field-full">
            <textarea
              className="eval-textarea"
              rows="3"
              value={formData.objetivos}
              onChange={handleChange('objetivos')}
              disabled={readOnly}
              placeholder="Ex.: reduzir gordura corporal"
            />
          </Campo>
          <Campo rotulo="Intercorrências" className="eval-field eval-field-full">
            <textarea
              className="eval-textarea"
              rows="3"
              value={formData.intercorrencias}
              onChange={handleChange('intercorrencias')}
              disabled={readOnly}
            />
          </Campo>
          <Campo rotulo="Sintomas novos ou recorrentes" className="eval-field eval-field-full">
            <textarea
              className="eval-textarea"
              rows="3"
              value={formData.sintomas}
              onChange={handleChange('sintomas')}
              disabled={readOnly}
            />
          </Campo>
          <Campo rotulo="Conduta da consulta" className="eval-field eval-field-full">
            <textarea
              className="eval-textarea"
              rows="3"
              value={formData.conduta}
              onChange={handleChange('conduta')}
              disabled={readOnly}
            />
          </Campo>
          <Campo rotulo="Próxima avaliação" className="eval-field">
            <input
              type="date"
              className="eval-input"
              value={formData.proximaAvaliacao}
              onChange={handleChange('proximaAvaliacao')}
              disabled={readOnly}
            />
          </Campo>
        </div>
      </AvaliacaoSecao>

      {/* Resultados, a leitura da conduta (antes no alto do formulário) e o
          comparativo com a evolução anterior, juntos. */}
      <AvaliacaoSecao id="evolucao-resumo" titulo="Resumo calculado" className="eval-section">
        <div className="eval-summary-grid">
          <SummaryCard label="Score de Aplicação da Dieta" value={score} unit="%" />
          <SummaryCard label="Prioridade de retorno" value={prioridade || 'Sem classificação'} />
          <SummaryCard label="Objetivos mapeados" value={calculation?.calculated?.resumoObjetivos?.length || 0} />
        </div>
        {calculation?.warnings?.[0] && (
          <AvisoAvaliacao tipo="info">
            {calculation.warnings[0]}
          </AvisoAvaliacao>
        )}

        <AvisoAvaliacao
          tipo={AVISO_DO_TOM[condutaStatus.tone] || 'info'}
          titulo={condutaStatus.title}
          className={`avaliacao-evolucao-retorno__conduta-note tone-${condutaStatus.tone}`}
        >
          <p>{condutaStatus.message}</p>
          <small>
            Contexto: {onboardingResumo.modalidadePrincipal || 'modalidade não informada'}
            {' | '}
            Frequência: {Number.isFinite(onboardingResumo.frequenciaSemanal) ? `${onboardingResumo.frequenciaSemanal}x/sem` : 'não informada'}
            {' | '}
            Duração: {Number.isFinite(onboardingResumo.duracaoSessao) ? `${onboardingResumo.duracaoSessao} min` : 'não informada'}
            {' | '}
            Metas ativas: {metasAtivas}
          </small>
        </AvisoAvaliacao>

        {prevScores && (
          <AvaliacaoSecao
            className="eval-section evolucao-comparativo"
            titulo={(
              <>
                Comparativo com evolução anterior
                {prevScores.data && (
                  <span className="evolucao-comparativo__date">
                    {' '}— {formatDateBr(prevScores.data)}
                  </span>
                )}
              </>
            )}
          >
            <div className="evolucao-comparativo__grid">
              <DeltaRow
                label="Aplicação da Dieta"
                current={parseNumeric(formData.adesaoPlanoAlimentar)}
                previous={prevScores.adesaoPlano}
                unit="%"
              />
              <DeltaRow
                label="Adesão à atividade física"
                current={parseNumeric(formData.adesaoAtividadeFisica)}
                previous={prevScores.adesaoAF}
                unit="%"
              />
              <DeltaRow
                label="Resposta percebida"
                current={parseNumeric(formData.respostaPercebida)}
                previous={prevScores.resposta}
                unit="/5"
              />
              <DeltaRow
                label="Score de adesão geral"
                current={Number.isFinite(score) ? score : null}
                previous={prevScores.score}
                unit="%"
                highlight
              />
            </div>
          </AvaliacaoSecao>
        )}
      </AvaliacaoSecao>

      <BarraAcoesAvaliacao status={saveStatus}>
        <Button type="button" variant="primary" onClick={() => dispatchSave(false)} disabled={readOnly} loading={saveStatus === 'saving'}>
          <Save size={18} /> Salvar avaliação
        </Button>
      </BarraAcoesAvaliacao>
      {error && <AvisoAvaliacao tipo="perigo" anunciar className="form-error-message">{error}</AvisoAvaliacao>}
    </AvaliacaoModulo>
  );
};

// Sem valor: "—", lido como "sem valor", como no resultado da base.
const SummaryCard = ({ label, value, unit = '' }) => {
  let conteudo;
  if (Number.isFinite(value)) conteudo = `${value}${unit ? ` ${unit}` : ''}`;
  else if (value) conteudo = value;
  else conteudo = <><span aria-hidden="true">—</span><span className="av-sr">sem valor</span></>;
  return (
    <div className="eval-summary-item">
      <span>{label}</span>
      <strong>{conteudo}</strong>
    </div>
  );
};

const DeltaRow = ({ label, current, previous, unit = '', highlight = false }) => {
  const hasCurrent = Number.isFinite(current);
  const hasPrevious = Number.isFinite(previous);
  const delta = hasCurrent && hasPrevious ? Math.round((current - previous) * 10) / 10 : null;
  const isPositive = delta !== null && delta > 0;
  const isNegative = delta !== null && delta < 0;

  return (
    <div className={`evolucao-delta-row${highlight ? ' evolucao-delta-row--highlight' : ''}`}>
      <span className="evolucao-delta-row__label">{label}</span>
      <span className="evolucao-delta-row__prev">
        {hasPrevious ? `${previous}${unit}` : '—'}
      </span>
      <span className="evolucao-delta-row__arrow">→</span>
      <span className="evolucao-delta-row__current">
        {hasCurrent ? `${current}${unit}` : '—'}
      </span>
      <span className={`evolucao-delta-row__delta${isPositive ? ' delta--up' : isNegative ? ' delta--down' : ' delta--neutral'}`}>
        {delta === null ? '' : delta === 0 ? '=' : `${isPositive ? '+' : ''}${delta}${unit}`}
      </span>
    </div>
  );
};

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

export default AvaliacaoEvolucaoRetorno;

function normalizeType(value) {
  return String(value || '').trim().toLowerCase().replace(/-/g, '_');
}

function formatDateBr(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'data não informada';
  return parsed.toLocaleDateString('pt-BR');
}

