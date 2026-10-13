import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Droplets, Save } from 'lucide-react';
import { Button } from '../../ui';
import { toLocalDateInputValue } from '../../../utils/dateUtils';
import { calculateHydrationEvaluation } from '../../../services/calculationEngine';
import { useSaveStatus } from '../hooks/useSaveStatus';
import { useModuleSnapshot } from '../hooks/useModuleSnapshot';
import EvaluationReadiness from '../components/EvaluationReadiness';
import '../avaliacoes.css';
import {
  AvaliacaoModulo,
  AvaliacaoSecao,
  Campo,
  ResultadoCalculado,
  AvisoAvaliacao,
  BarraAcoesAvaliacao
} from '../base';
import './AvaliacaoHidratacao.css';

const AvaliacaoHidratacao = ({
  pacienteId,
  onSalvar,
  onAutoSave,
  readOnly = false,
  onboardingContext,
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
    estrategiaAntesMl: '',
    estrategiaDuranteMlHora: '',
    estrategiaPosMl: '',
    corUrinaManha: '',
    sedePercebida: '',
    adesaoHidricaPlanejada: '',
    observacoes: ''
  });
  const [error, setError] = useState('');
  const { saveStatus, setSaving, setSuccess, setFailure } = useSaveStatus();
  const autoSaveRef = useRef(null);
  const onboardingPrefillRef = useRef('');

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
      estrategiaAntesMl: toInputValue(input?.estrategiaAntesMl ?? source?.estrategiaAntesMl),
      estrategiaDuranteMlHora: toInputValue(input?.estrategiaDuranteMlHora ?? source?.estrategiaDuranteMlHora),
      estrategiaPosMl: toInputValue(input?.estrategiaPosMl ?? source?.estrategiaPosMl),
      corUrinaManha: toInputValue(input?.corUrinaManha ?? source?.corUrinaManha),
      sedePercebida: toInputValue(input?.sedePercebida ?? source?.sedePercebida),
      adesaoHidricaPlanejada: toInputValue(input?.adesaoHidricaPlanejada ?? source?.adesaoHidricaPlanejada),
      observacoes: toText(source?.observacoes || input?.observacoes)
    });
  });

  const handleChange = (event) => {
    const { name, value } = event.target;
    setError('');
    setDados((prev) => ({ ...prev, [name]: value }));
  };

  useEffect(() => {
    if (moduleSnapshot?.id) return;

    const key = JSON.stringify({
      modalidade: onboardingContext?.modalidadePrincipal || '',
      frequencia: onboardingContext?.frequenciaSemanal || '',
      duracao: onboardingContext?.duracaoSessao || ''
    });
    if (onboardingPrefillRef.current === key) return;

    setDados((prev) => ({
      ...prev,
      modalidade: prev.modalidade || toText(onboardingContext?.modalidadePrincipal),
      duracaoExercicioMin: prev.duracaoExercicioMin || (
        Number.isFinite(Number(onboardingContext?.duracaoSessao))
          ? String(Number(onboardingContext.duracaoSessao))
          : ''
      )
    }));

    onboardingPrefillRef.current = key;
  }, [moduleSnapshot?.id, onboardingContext]);

  const onboardingResumo = useMemo(() => {
    if (!onboardingContext || typeof onboardingContext !== 'object') return [];
    const resumo = [];
    const modalidade = toText(onboardingContext?.modalidadePrincipal);
    const frequenciaRaw = onboardingContext?.frequenciaSemanal;
    const frequencia = frequenciaRaw === '' || frequenciaRaw === null || frequenciaRaw === undefined
      ? null
      : Number(frequenciaRaw);
    if (modalidade) resumo.push(`Modalidade: ${modalidade}`);
    if (Number.isFinite(frequencia)) resumo.push(`Frequência semanal: ${frequencia}x`);
    return resumo.slice(0, 2);
  }, [onboardingContext]);

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
  const classificacaoHidrica = hydration?.classification?.label || 'Sem classificação';
  const alertLevel = hydration?.classification?.alertLevel || 'neutral';
  // Perda de suor <= 0 é registro inconsistente: perda, sudorese e reposição
  // vêm nulas do motor e aparecem "—", com o aviso (WI-013, decisão 5).
  const ganhoPeso = Boolean(hydration?.flags?.ganhoPeso);
  const perdaSuorInconsistente = Boolean(hydration?.flags?.perdaSuorInconsistente);
  const metaReposicaoMl = Number.isFinite(calculated.metaReposicaoMl) ? calculated.metaReposicaoMl : null;
  const adesaoReposicaoPct = useMemo(() => {
    const ingerido = toNumber(normalizedInput.volumeIngeridoMl);
    if (!Number.isFinite(metaReposicaoMl) || metaReposicaoMl <= 0 || !Number.isFinite(ingerido)) return null;
    return Number(((ingerido / metaReposicaoMl) * 100).toFixed(1));
  }, [metaReposicaoMl, normalizedInput.volumeIngeridoMl]);
  const readinessItems = useMemo(() => {
    const coreValues = [
      normalizedInput.pesoAntesExercicio,
      normalizedInput.pesoAposExercicio,
      normalizedInput.duracaoExercicioMin
    ];
    const coreCount = coreValues.filter((value) => Number.isFinite(value)).length;
    const hasCore = coreCount === coreValues.length
      && Number(normalizedInput.duracaoExercicioMin) > 0
      && Number(normalizedInput.pesoAntesExercicio) > 0
      && Number(normalizedInput.pesoAposExercicio) > 0;
    const classificationStatus = alertLevel === 'danger'
      ? 'danger'
      : alertLevel === 'warning'
        ? 'warning'
        : classificacaoHidrica === 'Sem classificação'
          ? 'pending'
          : 'ok';

    return [
      {
        key: 'core',
        label: 'Campos de finalização',
        status: hasCore ? 'ok' : coreCount > 0 ? 'warning' : 'pending',
        value: `${coreCount}/3 campos`
      },
      {
        key: 'loss',
        label: 'Perda percentual',
        status: Number.isFinite(calculated.perdaPesoPercentual) ? classificationStatus : 'pending',
        value: Number.isFinite(calculated.perdaPesoPercentual) ? `${Number(calculated.perdaPesoPercentual).toFixed(2)}%` : 'não calculada'
      },
      {
        key: 'replacement',
        label: 'Meta de reposição',
        status: Number.isFinite(metaReposicaoMl) ? 'ok' : 'pending',
        value: Number.isFinite(metaReposicaoMl) ? `${metaReposicaoMl} ml` : 'pendente'
      },
      {
        key: 'warnings',
        label: 'Alertas',
        status: hydration?.warnings?.length ? 'warning' : hasCore ? 'ok' : 'pending',
        value: hydration?.warnings?.length ? `${hydration.warnings.length} alerta(s)` : 'sem alertas'
      }
    ];
  }, [
    alertLevel,
    calculated.perdaPesoPercentual,
    classificacaoHidrica,
    hydration,
    metaReposicaoMl,
    normalizedInput.duracaoExercicioMin,
    normalizedInput.pesoAntesExercicio,
    normalizedInput.pesoAposExercicio
  ]);

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
        estrategiaAntesMl: toNumber(dados.estrategiaAntesMl),
        estrategiaDuranteMlHora: toNumber(dados.estrategiaDuranteMlHora),
        estrategiaPosMl: toNumber(dados.estrategiaPosMl),
        corUrinaManha: toNumber(dados.corUrinaManha),
        sedePercebida: toNumber(dados.sedePercebida),
        adesaoHidricaPlanejada: toNumber(dados.adesaoHidricaPlanejada),
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
      metaReposicaoMl,
      adesaoReposicaoPercentual: adesaoReposicaoPct,
      calculated: {
        perdaPesoAbsolutaKg: Number.isFinite(calculated.perdaPesoAbsolutaKg)
          ? Number(calculated.perdaPesoAbsolutaKg.toFixed(3))
          : null,
        perdaPesoPercentual: Number.isFinite(calculated.perdaPesoPercentual)
          ? Number(calculated.perdaPesoPercentual.toFixed(2))
          : null,
        taxaSudoreseLh: Number.isFinite(calculated.taxaSudoreseLh)
          ? Number(calculated.taxaSudoreseLh.toFixed(2))
          : null,
        metaReposicaoMl,
        adesaoReposicaoPercentual: adesaoReposicaoPct
      },
      output: {
        classificacaoHidrica,
        alertLevel,
        metaReposicaoMl,
        adesaoReposicaoPercentual: adesaoReposicaoPct,
        warnings: hydration?.warnings || []
      }
    }
  }), [adesaoReposicaoPct, alertLevel, calculated, classificacaoHidrica, dados, hydration?.warnings, metaReposicaoMl, normalizedInput]);

  const hasValues = Boolean(
    dados.pesoAntesExercicio
    || dados.pesoAposExercicio
    || dados.duracaoExercicioMin
    || dados.volumeIngeridoMl
    || dados.volumeUrinarioMl
    || dados.estrategiaAntesMl
    || dados.estrategiaDuranteMlHora
    || dados.estrategiaPosMl
    || dados.adesaoHidricaPlanejada
    || dados.observacoes
  );

  const salvar = useCallback(async (isAutoSave = false) => {
    if (!isAutoSave && !hasValues) {
      setError('Preencha ao menos os dados principais da sessão.');
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
        setError('Não foi possível salvar a avaliação.');
      }
    }
  }, [
    currentSessionId,
    dados.dataAvaliacao,
    hasValues,
    moduleSnapshot,
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
    autoSaveRef.current = setTimeout(() => salvar(true), 3500);
    return () => clearTimeout(autoSaveRef.current);
  }, [hasValues, onAutoSave, readOnly, salvar]);

  // O cabeçalho que vinha de EvaluationHeader passou a ser o do módulo: o
  // mesmo h3, o mesmo subtítulo e o ícone decorativo, sem um segundo título.
  // O aviso de somente leitura subiu do pé do formulário para o topo.
  return (
    <AvaliacaoModulo
      className={`eval-card avaliacao-hidratacao${readOnly ? ' eval-card--readonly' : ''}`}
      titulo="Avaliação de hidratação"
      descricao="Sessão esportiva com perdas, reposição e risco hídrico"
      icone={<Droplets size={22} />}
    >
      {readOnly && <AvisoAvaliacao tipo="info">Somente leitura para o seu perfil.</AvisoAvaliacao>}

      {onboardingResumo.length > 0 ? (
        <AvisoAvaliacao tipo="info">
          <strong>Contexto do onboarding:</strong> {onboardingResumo.join(' | ')}
        </AvisoAvaliacao>
      ) : null}

      <EvaluationReadiness items={readinessItems} />

      <AvaliacaoSecao id="hidratacao-sessao" titulo="Dados da sessão">
        <div className="eval-grid">
          <Field label="Data" name="dataAvaliacao" value={dados.dataAvaliacao} onChange={handleChange} readOnly={readOnly} type="date" />
          <Field label="Peso antes (kg)" name="pesoAntesExercicio" value={dados.pesoAntesExercicio} onChange={handleChange} readOnly={readOnly} />
          <Field label="Peso após (kg)" name="pesoAposExercicio" value={dados.pesoAposExercicio} onChange={handleChange} readOnly={readOnly} />
          <Field label="Duracao (min)" name="duracaoExercicioMin" value={dados.duracaoExercicioMin} onChange={handleChange} readOnly={readOnly} />
          <Field label="Volume ingerido (ml)" name="volumeIngeridoMl" value={dados.volumeIngeridoMl} onChange={handleChange} readOnly={readOnly} />
          <Field label="Volume urinário (ml)" name="volumeUrinarioMl" value={dados.volumeUrinarioMl} onChange={handleChange} readOnly={readOnly} />
          <Field label="Modalidade" name="modalidade" value={dados.modalidade} onChange={handleChange} readOnly={readOnly} type="text" />
          <Field label="Temperatura ambiente (C)" name="temperaturaAmbiente" value={dados.temperaturaAmbiente} onChange={handleChange} readOnly={readOnly} />
          <Campo rotulo="Observações" className="eval-field av-inteiro">
            <textarea
              className="eval-textarea"
              name="observacoes"
              value={dados.observacoes}
              onChange={handleChange}
              rows="3"
              disabled={readOnly}
            />
          </Campo>
        </div>
      </AvaliacaoSecao>

      <AvaliacaoSecao id="hidratacao-estrategia" titulo="Estratégia hídrica e adesão" className="eval-section">
        {/* As cores das bolinhas são o dado da própria escala; o texto ao
            lado diz o que cada uma significa. As três mais escuras levam o
            número em cor clara (contraste medido em AvaliacaoHidratacao.css). */}
        <details className="eval-urine-guide">
          <summary>Escala de cor da urina — Armstrong (1-8)</summary>
          <ul className="eval-urine-scale">
            <li><span className="eval-urine-dot" style={{ background: '#fef9c3' }}>1</span> Amarelo muito claro — bem hidratado</li>
            <li><span className="eval-urine-dot" style={{ background: '#fef08a' }}>2</span> Amarelo claro — hidratado</li>
            <li><span className="eval-urine-dot" style={{ background: '#fde047' }}>3</span> Amarelo — hidratação aceitável</li>
            <li><span className="eval-urine-dot" style={{ background: '#facc15' }}>4</span> Amarelo escuro — iniciar reidratação</li>
            <li><span className="eval-urine-dot" style={{ background: '#ca8a04' }}>5</span> Âmbar — desidratação leve</li>
            <li><span className="eval-urine-dot eval-urine-dot--escura" style={{ background: '#92400e' }}>6</span> Laranja acastanhado — desidratação moderada</li>
            <li><span className="eval-urine-dot eval-urine-dot--escura" style={{ background: '#78350f' }}>7</span> Marrom — desidratação grave</li>
            <li><span className="eval-urine-dot eval-urine-dot--escura" style={{ background: '#44120a' }}>8</span> Marrom muito escuro / esverdeado — muito grave</li>
          </ul>
          <p className="eval-urine-note">Escala baseada em Armstrong et al. (1998). Valores ≥ 4 indicam necessidade de intervenção hídrica.</p>
        </details>
        <div className="eval-grid">
          <Field label="Ingestão pré-treino (ml)" name="estrategiaAntesMl" value={dados.estrategiaAntesMl} onChange={handleChange} readOnly={readOnly} />
          <Field label="Ingestão durante (ml/h)" name="estrategiaDuranteMlHora" value={dados.estrategiaDuranteMlHora} onChange={handleChange} readOnly={readOnly} />
          <Field label="Ingestão pós-treino (ml)" name="estrategiaPosMl" value={dados.estrategiaPosMl} onChange={handleChange} readOnly={readOnly} />
          <Field label="Cor da urina (1-8)" name="corUrinaManha" value={dados.corUrinaManha} onChange={handleChange} readOnly={readOnly} />
          <Field label="Sede percebida — 0 = sem sede · 10 = intensa" name="sedePercebida" value={dados.sedePercebida} onChange={handleChange} readOnly={readOnly} />
          <Field label="Adesão ao plano hídrico — 0 = nenhuma · 10 = total" name="adesaoHidricaPlanejada" value={dados.adesaoHidricaPlanejada} onChange={handleChange} readOnly={readOnly} />
        </div>
      </AvaliacaoSecao>

      {/* Mesmos valores, casas e textos de ausência de antes ("Não
          calculado"/"Não calculada"); a unidade saiu do texto do valor para
          a caixa de unidade. A classificação da perda percentual vai escrita
          e o tom só a acompanha. */}
      <AvaliacaoSecao id="hidratacao-resultados" titulo="Resultados automáticos" className="eval-section">
        <div className="av-resultados">
          {/* Peso após maior que antes: o primeiro cartão mostra o ganho e a
              perda percentual fica "—". */}
          <ResultadoCalculado
            rotulo={ganhoPeso ? 'Ganho de peso' : 'Perda absoluta'}
            valor={ganhoPeso
              ? formatValue(calculated.ganhoPesoKg, '', 3)
              : Number.isFinite(calculated.perdaPesoAbsolutaKg) ? formatValue(calculated.perdaPesoAbsolutaKg, '', 3) : null}
            unidade="kg"
            semValor="Não calculado"
          />
          <ResultadoCalculado
            rotulo="Perda percentual"
            valor={Number.isFinite(calculated.perdaPesoPercentual) ? formatValue(calculated.perdaPesoPercentual, '', 2) : null}
            unidade="%"
            semValor={ganhoPeso ? undefined : 'Não calculado'}
            classificacao={Number.isFinite(calculated.perdaPesoPercentual) ? classificacaoHidrica : null}
            tom={alertLevel}
          />
          <ResultadoCalculado
            rotulo="Taxa sudorese"
            valor={Number.isFinite(calculated.taxaSudoreseLh) ? formatValue(calculated.taxaSudoreseLh, '', 2) : null}
            unidade="L/h"
            semValor={perdaSuorInconsistente ? undefined : 'Não calculado'}
          />
          <ResultadoCalculado
            rotulo="Perda hídrica líquida"
            valor={Number.isFinite(calculated.perdaHidricaLiquidaMl) ? `${Math.round(calculated.perdaHidricaLiquidaMl)}` : null}
            unidade="ml"
            semValor={perdaSuorInconsistente ? undefined : 'Não calculada'}
          />
          <ResultadoCalculado
            rotulo="Meta de reposição"
            valor={Number.isFinite(metaReposicaoMl) ? `${metaReposicaoMl}` : null}
            unidade="ml"
            semValor={perdaSuorInconsistente ? undefined : 'Não calculada'}
          />
          <ResultadoCalculado
            rotulo="Adesão reposição"
            valor={Number.isFinite(adesaoReposicaoPct) ? `${adesaoReposicaoPct}` : null}
            unidade="%"
            semValor="Não calculada"
          />
          <ResultadoCalculado className="hidratacao-resultado--texto" rotulo="Classificação" valor={classificacaoHidrica} />
          <ResultadoCalculado className="hidratacao-resultado--texto" rotulo="Alerta" valor={hydration?.classification?.alertLabel || 'Indefinido'} />
        </div>
        {/* Todos os avisos, não só o primeiro: ganho de peso e perda de suor
            inconsistente costumam vir juntos. */}
        {Array.isArray(hydration?.warnings) && hydration.warnings.length > 0 && (
          <AvisoAvaliacao tipo="atencao">
            {hydration.warnings.join(' ')}
          </AvisoAvaliacao>
        )}
      </AvaliacaoSecao>

      {error && <AvisoAvaliacao tipo="perigo" anunciar className="form-error-message">{error}</AvisoAvaliacao>}

      <BarraAcoesAvaliacao status={saveStatus}>
        <Button type="button" variant="primary" onClick={() => salvar(false)} disabled={readOnly} loading={saveStatus === 'saving'}>
          <Save size={18} /> Salvar avaliação
        </Button>
      </BarraAcoesAvaliacao>
    </AvaliacaoModulo>
  );
};

// Mesma assinatura e o mesmo <input> de antes (type padrão number); o Campo
// da base só liga o rótulo ao controle.
const Field = ({
  label,
  name,
  value,
  onChange,
  readOnly,
  type = 'number'
}) => (
  <Campo rotulo={label} className="eval-field">
    <input
      type={type}
      className="eval-input"
      name={name}
      value={value}
      onChange={onChange}
      disabled={readOnly}
    />
  </Campo>
);

const parseNumeric = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value).replace(',', '.').trim());
  return Number.isFinite(parsed) ? parsed : null;
};

const toNumber = parseNumeric;

const toInputValue = (value) => {
  const numeric = parseNumeric(value);
  if (!Number.isFinite(numeric)) return '';
  return String(numeric);
};

const toText = (value) => (value === null || value === undefined ? '' : String(value).trim());

const formatValue = (value, unit = '', digits = 2) => {
  if (!Number.isFinite(value)) return 'Não calculado';
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
