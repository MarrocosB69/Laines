import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Save } from 'lucide-react';
import { Button } from '../../components/ui';
import EvaluationReadiness from '../../components/Avaliacoes/components/EvaluationReadiness';
import api from '../../services/api';
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
import './AvaliacaoCargaTreino.css';

// Só exibição: o tom da síntese (acwrSynthesis.tone) vira o tipo do aviso.
const TIPO_AVISO_SINTESE = { risk: 'perigo', warn: 'atencao', ok: 'sucesso', neutral: 'info' };

const INDICE_CARGA = [
  { id: 'carga-contexto', titulo: 'Contexto esportivo da sessão' },
  { id: 'carga-periodizacao', titulo: 'Periodização' },
  { id: 'carga-sessoes', titulo: 'Sessoes da semana' },
  { id: 'carga-resultados', titulo: 'Resultados' },
  { id: 'carga-historico', titulo: 'Historico das ultimas 4 semanas' }
];

const DIAS_SEMANA = [
  { key: 'segunda', label: 'Segunda' },
  { key: 'terca', label: 'Terca' },
  { key: 'quarta', label: 'Quarta' },
  { key: 'quinta', label: 'Quinta' },
  { key: 'sexta', label: 'Sexta' },
  { key: 'sabado', label: 'Sabado' },
  { key: 'domingo', label: 'Domingo' }
];

const FASE_OPTIONS = [
  { value: 'preparacao_geral', label: 'Preparacao geral' },
  { value: 'preparacao_especifica', label: 'Preparacao especifica' },
  { value: 'pre_competicao', label: 'Pre-competicao' },
  { value: 'competicao', label: 'Competicao' },
  { value: 'transicao', label: 'Transicao' },
  { value: 'taper', label: 'Taper' }
];

const ESTRATEGIA_OPTIONS = [
  { value: 'carga_regular', label: 'Carga Regular' },
  { value: 'condicionante_crescente', label: 'Condicionante Crescente' },
  { value: 'condicionante_decrescente', label: 'Condicionante Decrescente' },
  { value: 'condicionante_crescente_decrescente', label: 'Condicionante Crescente e Decrescente' },
  { value: 'condicionante_decrescente_crescente', label: 'Condicionante Decrescente e Crescente' },
  { value: 'intermediario_regular_decrescente', label: 'Intermediário Regular Decrescente' },
  { value: 'intermediario_regular_crescente', label: 'Intermediário Regular Crescente' }
];

const createSessaoRow = (dia) => ({
  dia,
  tipo: '',
  duracaoMin: '',
  pse: '',
  metValue: null
});

const buildSessaoSemanaPadrao = () => DIAS_SEMANA.map((item) => createSessaoRow(item.key));

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(String(value).replace(',', '.').trim());
  return Number.isFinite(parsed) ? parsed : null;
};

const round = (value, digits = 2) => {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const mean = (values) => {
  if (!Array.isArray(values) || values.length === 0) return null;
  return values.reduce((sum, item) => sum + item, 0) / values.length;
};

const stddev = (values) => {
  if (!Array.isArray(values) || values.length === 0) return null;
  const avg = mean(values);
  if (!Number.isFinite(avg)) return null;
  const variance = values.reduce((sum, item) => {
    const delta = item - avg;
    return sum + (delta ** 2);
  }, 0) / values.length;
  return Math.sqrt(variance);
};

const classifyAcwr = (acwr) => {
  if (!Number.isFinite(acwr)) return '';
  if (acwr < 0.8) return 'subcarga';
  if (acwr <= 1.3) return 'zona_segura';
  if (acwr <= 1.5) return 'zona_alerta';
  return 'zona_risco';
};

const toText = (value) => String(value || '').trim();

const normalizeDateValue = (value) => {
  if (!value) return toLocalDateInputValue(new Date());
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return toLocalDateInputValue(new Date());
  return toLocalDateInputValue(date);
};

const resolveTimestamp = (value) => {
  if (!value) return 0;
  const date = value?.toDate ? value.toDate() : new Date(value);
  const ts = date.getTime();
  return Number.isFinite(ts) ? ts : 0;
};

const humanizeStatusToken = (value) => (
  toText(value)
    .replace(/_/g, ' ')
    .trim()
);

const normalizeMetCatalog = (payload) => {
  if (!Array.isArray(payload)) return [];
  return payload
    .map((item) => {
      const id = String(item?.id || '').trim();
      const modalidade = String(item?.modalidade || '').trim();
      const categoria = String(item?.categoria || '').trim();
      const intensidade = String(item?.intensidade || '').trim();
      const metValue = toNumber(item?.metValue);
      if (!id || !modalidade || !categoria || !intensidade || !Number.isFinite(metValue)) return null;
      return {
        id,
        modalidade,
        categoria,
        intensidade,
        metValue: round(metValue, 1)
      };
    })
    .filter(Boolean);
};

const buildMetByTipo = (rows) => {
  const grouped = new Map();
  rows.forEach((item) => {
    const key = String(item?.modalidade || '').trim().toLowerCase();
    if (!key) return;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(item);
  });

  const result = new Map();
  grouped.forEach((items, key) => {
    const moderate = items.find((row) => String(row.intensidade || '').toLowerCase() === 'moderada');
    const preferred = moderate || items[0];
    if (preferred?.metValue !== null && preferred?.metValue !== undefined) {
      result.set(key, preferred);
    }
  });
  return result;
};

const formatNumber = (value, digits = 2) => {
  if (!Number.isFinite(value)) return '--';
  return Number(value).toFixed(digits);
};

const AvaliacaoCargaTreino = ({
  pacienteId,
  onSalvar,
  onAutoSave,
  readOnly = false,
  moduleSnapshot,
  currentSessionId,
  onboardingContext
}) => {
  const [dataAvaliacao, setDataAvaliacao] = useState(() => toLocalDateInputValue(new Date()));
  const [faseAtual, setFaseAtual] = useState('preparacao_geral');
  const [semanasAteCompeticao, setSemanasAteCompeticao] = useState('');
  const [estrategiaTreinamento, setEstrategiaTreinamento] = useState('carga_regular');
  const [sessoesSemana, setSessoesSemana] = useState(() => buildSessaoSemanaPadrao());
  const [metCatalog, setMetCatalog] = useState([]);
  const [metError, setMetError] = useState('');
  const [historico4Semanas, setHistorico4Semanas] = useState([]);
  const [histError, setHistError] = useState('');
  const [error, setError] = useState('');
  const [saveStatus, setSaveStatus] = useState(null);

  const saveStatusResetRef = useRef(null);
  const autoSaveRef = useRef(null);
  const loadedSnapshotIdRef = useRef('');

  const metByTipo = useMemo(() => buildMetByTipo(metCatalog), [metCatalog]);
  const tipoOptions = useMemo(
    () => Array.from(new Set(metCatalog.map((item) => String(item.modalidade || '').trim()).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b)),
    [metCatalog]
  );

  const onboardingEsportivo = useMemo(() => {
    const modalidadePrincipal = toText(onboardingContext?.modalidadePrincipal);
    const frequenciaSemanal = toNumber(onboardingContext?.frequenciaSemanal);
    const duracaoSessao = toNumber(onboardingContext?.duracaoSessao);
    return { modalidadePrincipal, frequenciaSemanal, duracaoSessao };
  }, [
    onboardingContext?.duracaoSessao,
    onboardingContext?.frequenciaSemanal,
    onboardingContext?.modalidadePrincipal
  ]);

  useEffect(() => () => {
    clearTimeout(autoSaveRef.current);
    if (saveStatusResetRef.current) clearTimeout(saveStatusResetRef.current);
  }, []);

  useEffect(() => {
    let mounted = true;
    const fetchMets = async () => {
      setMetError('');
      try {
        const { data } = await api.get('/mets');
        if (!mounted) return;
        setMetCatalog(normalizeMetCatalog(data));
      } catch {
        if (!mounted) return;
        setMetError('Nao foi possivel carregar o banco de METs (T08).');
      }
    };
    fetchMets();
    return () => { mounted = false; };
  }, []);

  const fetchHistoricoCargaTreino = useCallback(async () => {
    if (!pacienteId) return;
    setHistError('');
    try {
      const { data } = await api.get('/avaliacoes', {
        params: { tipo: 'carga_treino', pacienteId, limit: 4 }
      });
      const rows = Array.isArray(data) ? data : [];
      const sorted = [...rows].sort((a, b) => {
        const timeA = resolveTimestamp(a?.updatedAt || a?.createdAt || a?.data);
        const timeB = resolveTimestamp(b?.updatedAt || b?.createdAt || b?.data);
        return timeB - timeA;
      });
      const scoped = sorted
        .filter((item) => item?.id && item.id !== moduleSnapshot?.id)
        .slice(0, 4)
        .map((item, index) => {
          const carga = toNumber(
            item?.resultados?.cargaSemanaAtual
            ?? item?.resultados?.calculated?.cargaSemanaAtual
            ?? item?.dados?.cargaSemanaAtual
          );
          return {
            id: item?.id || `hist-${index}`,
            label: normalizeDateValue(item?.data || item?.updatedAt || item?.createdAt),
            cargaSemanaAtual: Number.isFinite(carga) ? round(carga, 2) : null
          };
        })
        .filter((item) => Number.isFinite(item.cargaSemanaAtual));

      setHistorico4Semanas(scoped);
    } catch {
      setHistError('Nao foi possivel carregar historico das ultimas 4 semanas.');
    }
  }, [moduleSnapshot?.id, pacienteId]);

  useEffect(() => {
    void fetchHistoricoCargaTreino();
  }, [fetchHistoricoCargaTreino]);

  useEffect(() => {
    const snapshotId = moduleSnapshot?.id || '';
    if (!snapshotId || loadedSnapshotIdRef.current === snapshotId) return;

    const dados = moduleSnapshot?.dados || {};
    const sourceRows = Array.isArray(dados?.sessoesSemana) ? dados.sessoesSemana : [];

    setDataAvaliacao(normalizeDateValue(moduleSnapshot?.data || dados?.dataAvaliacao));
    setFaseAtual(String(dados?.faseAtual || 'preparacao_geral'));
    setSemanasAteCompeticao(
      Number.isFinite(toNumber(dados?.semanasAteCompeticao))
        ? String(toNumber(dados?.semanasAteCompeticao))
        : ''
    );
    setEstrategiaTreinamento(String(dados?.estrategiaTreinamento || 'carga_regular'));
    setSessoesSemana((prev) => mergeSessaoRows(prev, sourceRows, metByTipo));

    loadedSnapshotIdRef.current = snapshotId;
  }, [metByTipo, moduleSnapshot]);

  const sessoesNormalizadas = useMemo(() => normalizeSessaoRows(sessoesSemana, metByTipo), [metByTipo, sessoesSemana]);
  const hasSessionInput = useMemo(() => (
    sessoesNormalizadas.some((item) => (
      item.tipo
      || Number.isFinite(item.duracaoMin)
      || Number.isFinite(item.pse)
    ))
  ), [sessoesNormalizadas]);
  const hasSessaoValida = useMemo(() => (
    sessoesNormalizadas.some((item) => (
      item.tipo
      && Number.isFinite(item.duracaoMin)
      && item.duracaoMin > 0
      && Number.isFinite(item.pse)
      && item.pse >= 0
      && item.pse <= 10
    ))
  ), [sessoesNormalizadas]);

  const cargasDiarias = useMemo(() => {
    const map = DIAS_SEMANA.reduce((acc, item) => {
      acc[item.key] = 0;
      return acc;
    }, {});

    sessoesNormalizadas.forEach((sessao) => {
      if (!Number.isFinite(sessao.cargaSessao)) return;
      map[sessao.dia] += sessao.cargaSessao;
    });

    return DIAS_SEMANA.map((item) => round(map[item.key], 2) || 0);
  }, [sessoesNormalizadas]);

  const cargaSemanaAtual = useMemo(
    () => round(cargasDiarias.reduce((sum, item) => sum + item, 0), 2),
    [cargasDiarias]
  );

  const mediaCarga4Semanas = useMemo(() => {
    const values = historico4Semanas
      .map((item) => toNumber(item?.cargaSemanaAtual))
      .filter((item) => Number.isFinite(item));
    return round(mean(values), 4);
  }, [historico4Semanas]);

  const acwr = useMemo(() => {
    if (!Number.isFinite(cargaSemanaAtual)) return null;
    if (!Number.isFinite(mediaCarga4Semanas) || mediaCarga4Semanas <= 0) return null;
    return round(cargaSemanaAtual / mediaCarga4Semanas, 4);
  }, [cargaSemanaAtual, mediaCarga4Semanas]);

  const mediaCargas7dias = useMemo(() => round(mean(cargasDiarias), 4), [cargasDiarias]);
  const desvioPadraoCargas7dias = useMemo(() => round(stddev(cargasDiarias), 4), [cargasDiarias]);

  const monotonia = useMemo(() => {
    if (!Number.isFinite(mediaCargas7dias)) return null;
    if (!Number.isFinite(desvioPadraoCargas7dias) || desvioPadraoCargas7dias <= 0) return null;
    return round(mediaCargas7dias / desvioPadraoCargas7dias, 4);
  }, [desvioPadraoCargas7dias, mediaCargas7dias]);

  const strain = useMemo(() => {
    if (!Number.isFinite(cargaSemanaAtual) || !Number.isFinite(monotonia)) return null;
    return round(cargaSemanaAtual * monotonia, 2);
  }, [cargaSemanaAtual, monotonia]);

  const classificacaoAcwr = useMemo(() => classifyAcwr(acwr), [acwr]);

  const acwrSynthesis = useMemo(() => {
    if (classificacaoAcwr === 'zona_risco') {
      return {
        tone: 'risk',
        message: 'ACWR em zona de risco. Priorize ajuste de carga e recuperação antes de progressão.'
      };
    }
    if (classificacaoAcwr === 'zona_alerta') {
      return {
        tone: 'warn',
        message: 'ACWR em alerta. Monitore fadiga e ajuste o microciclo.'
      };
    }
    if (classificacaoAcwr === 'subcarga') {
      return {
        tone: 'warn',
        message: 'ACWR em subcarga. Planeje progressão gradual para evitar salto brusco.'
      };
    }
    if (classificacaoAcwr === 'zona_segura') {
      return {
        tone: 'ok',
        message: 'ACWR em zona segura. Mantenha progressão controlada.'
      };
    }
    if (historico4Semanas.length === 0) {
      return {
        tone: 'neutral',
        message: 'ACWR indisponivel: historico semanal insuficiente. Sera calculado automaticamente apos novas semanas registradas.'
      };
    }
    return {
      tone: 'neutral',
      message: 'Registre sessões válidas para classificar o ACWR com segurança.'
    };
  }, [classificacaoAcwr, historico4Semanas.length]);

  const readinessItems = useMemo(() => ([
    {
      key: 'session',
      label: 'Sessao valida',
      status: hasSessaoValida ? 'ok' : hasSessionInput ? 'warning' : 'pending',
      value: hasSessaoValida ? 'pronta' : hasSessionInput ? 'incompleta' : 'pendente'
    },
    {
      key: 'weekly-load',
      label: 'Carga semanal',
      status: Number.isFinite(cargaSemanaAtual) && cargaSemanaAtual > 0 ? 'ok' : 'pending',
      value: Number.isFinite(cargaSemanaAtual) && cargaSemanaAtual > 0 ? formatNumber(cargaSemanaAtual, 0) : 'nao calculada'
    },
    {
      key: 'history',
      label: 'Historico ACWR',
      status: Number.isFinite(acwr) ? 'ok' : historico4Semanas.length > 0 ? 'warning' : 'pending',
      value: Number.isFinite(acwr) ? formatNumber(acwr, 2) : `${historico4Semanas.length}/4 semanas`
    }
  ]), [
    acwr,
    cargaSemanaAtual,
    hasSessaoValida,
    hasSessionInput,
    historico4Semanas.length
  ]);

  const payload = useMemo(() => ({
    tipo: 'carga_treino',
    pacienteId,
    data: dataAvaliacao,
    sessaoId: moduleSnapshot?.sessaoId || currentSessionId,
    schemaVersion: 1,
    formulaId: 'acwr_monotonia_strain_v1',
    formulaVersion: '1.0.0',
    dados: {
      dataAvaliacao,
      faseAtual,
      semanasAteCompeticao: toNumber(semanasAteCompeticao),
      estrategiaTreinamento,
      sessoesSemana: sessoesNormalizadas.map((sessao) => ({
        dia: sessao.dia,
        tipo: sessao.tipo,
        duracaoMin: sessao.duracaoMin,
        pse: sessao.pse,
        metValue: sessao.metValue
      })),
      mediaCargaUltimas4Semanas: mediaCarga4Semanas
    },
    resultados: {
      cargaSemanaAtual,
      mediaCargaUltimas4Semanas: mediaCarga4Semanas,
      acwr,
      classificacaoAcwr: classificacaoAcwr || null,
      monotonia,
      strain,
      cargas7dias: cargasDiarias,
      mediaCargas7dias,
      desvioPadraoCargas7dias,
      calculated: {
        cargaSemanaAtual,
        mediaCargaUltimas4Semanas: mediaCarga4Semanas,
        acwr,
        classificacaoAcwr: classificacaoAcwr || null,
        monotonia,
        strain,
        cargas7dias: cargasDiarias,
        mediaCargas7dias,
        desvioPadraoCargas7dias
      },
      output: {
        classificacaoAcwr: classificacaoAcwr || null
      }
    },
    classificacao: classificacaoAcwr || undefined,
    classificacaoLabel: classificacaoAcwr ? `ACWR ${classificacaoAcwr}` : undefined
  }), [
    acwr,
    cargaSemanaAtual,
    cargasDiarias,
    classificacaoAcwr,
    currentSessionId,
    dataAvaliacao,
    desvioPadraoCargas7dias,
    estrategiaTreinamento,
    faseAtual,
    mediaCarga4Semanas,
    mediaCargas7dias,
    moduleSnapshot?.sessaoId,
    monotonia,
    pacienteId,
    semanasAteCompeticao,
    sessoesNormalizadas,
    strain
  ]);

  const hasInput = useMemo(() => (
    hasSessionInput
    || Number.isFinite(toNumber(semanasAteCompeticao))
  ), [hasSessionInput, semanasAteCompeticao]);

  const validateBeforeSave = useCallback(() => {
    if (!hasInput) return 'Preencha dados de carga da semana para salvar.';
    if (!hasSessaoValida) {
      return 'Informe ao menos uma sessao valida (tipo, duracao e PSE entre 0 e 10).';
    }
    return '';
  }, [hasInput, hasSessaoValida]);

  const dispatchCargaTreinoAtualizada = useCallback(() => {
    const detail = {
      faseAtual,
      acwr,
      estrategiaTreinamento
    };
    window.dispatchEvent(new CustomEvent('cargaTreinoAtualizada', { detail }));
  }, [acwr, estrategiaTreinamento, faseAtual]);

  const dispatchSalvar = useCallback(async (auto = false) => {
    const dispatch = auto ? onAutoSave : onSalvar;
    if (!dispatch) return;

    if (!auto) {
      const validationError = validateBeforeSave();
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    setError('');
    setSaveStatus('saving');
    if (saveStatusResetRef.current) clearTimeout(saveStatusResetRef.current);
    try {
      await Promise.resolve(dispatch(payload));
      dispatchCargaTreinoAtualizada();
      setSaveStatus('saved');
      saveStatusResetRef.current = setTimeout(() => setSaveStatus(null), 3000);
      void fetchHistoricoCargaTreino();
    } catch {
      setSaveStatus('error');
      if (!auto) setError('Nao foi possivel salvar a carga de treino.');
    }
  }, [dispatchCargaTreinoAtualizada, fetchHistoricoCargaTreino, onAutoSave, onSalvar, payload, validateBeforeSave]);

  useEffect(() => {
    if (readOnly || !onAutoSave || !hasInput) return undefined;
    clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => {
      void dispatchSalvar(true);
    }, 3500);
    return () => clearTimeout(autoSaveRef.current);
  }, [dispatchSalvar, hasInput, onAutoSave, readOnly]);

  const updateSessaoField = (dia, key, value) => {
    setSessoesSemana((prev) => prev.map((row) => {
      if (row.dia !== dia) return row;
      if (key === 'tipo') {
        const met = metByTipo.get(String(value || '').trim().toLowerCase());
        return {
          ...row,
          tipo: value,
          metValue: Number.isFinite(met?.metValue) ? met.metValue : null
        };
      }
      return { ...row, [key]: value };
    }));
  };

  // Os cartões antigos viraram seções com título; o cartão de parâmetros e
  // o de resultados, que não tinham título, ganharam "Periodização" e
  // "Resultados". A ordem continua a mesma.
  return (
    <AvaliacaoModulo
      className={`carga-treino${readOnly ? ' eval-card--readonly' : ''}`}
      titulo="Carga de Treino e Periodizacao"
      descricao="ACWR, monotonia e strain semanal"
      icone={<Activity size={22} />}
    >
      <AvaliacaoIndice itens={INDICE_CARGA} />

      <AvaliacaoSecao id="carga-contexto" titulo="Contexto esportivo da sessão">
        <div className="carga-treino__context-grid">
          <div>
            <span>Modalidade</span>
            <strong>{onboardingEsportivo.modalidadePrincipal || 'Nao informada'}</strong>
          </div>
          <div>
            <span>Frequencia semanal</span>
            <strong>{Number.isFinite(onboardingEsportivo.frequenciaSemanal) ? `${onboardingEsportivo.frequenciaSemanal}x/sem` : 'Nao informada'}</strong>
          </div>
          <div>
            <span>Duracao media por sessao</span>
            <strong>{Number.isFinite(onboardingEsportivo.duracaoSessao) ? `${onboardingEsportivo.duracaoSessao} min` : 'Nao informada'}</strong>
          </div>
        </div>
      </AvaliacaoSecao>

      <EvaluationReadiness items={readinessItems} />

      <AvaliacaoSecao id="carga-periodizacao" titulo="Periodização">
        <div className="av-grade">
          <Campo rotulo="Data da semana">
            <input
              type="date"
              className="eval-input"
              value={dataAvaliacao}
              onChange={(event) => setDataAvaliacao(event.target.value)}
              disabled={readOnly}
            />
          </Campo>
          <Campo rotulo="Fase atual">
            <select
              className="eval-input"
              value={faseAtual}
              onChange={(event) => setFaseAtual(event.target.value)}
              disabled={readOnly}
            >
              {FASE_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Semanas ate proxima competicao">
            <input
              type="number"
              min="0"
              step="1"
              className="eval-input"
              value={semanasAteCompeticao}
              onChange={(event) => setSemanasAteCompeticao(event.target.value)}
              disabled={readOnly}
              placeholder="Ex.: 6"
            />
          </Campo>
          <Campo rotulo="Período de Microciclo">
            <select
              className="eval-input"
              value={estrategiaTreinamento}
              onChange={(event) => setEstrategiaTreinamento(event.target.value)}
              disabled={readOnly}
            >
              {ESTRATEGIA_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </Campo>
        </div>
      </AvaliacaoSecao>

      <AvaliacaoSecao id="carga-sessoes" titulo="Sessoes da semana">
        {metError && <AvisoAvaliacao tipo="atencao" className="carga-treino__warning">{metError}</AvisoAvaliacao>}
        <details className="carga-treino__pse-guide">
          <summary>Escala de Borg modificada — PSE (0-10)</summary>
          <ul className="carga-treino__pse-scale">
            <li><span>0</span> Repouso / Nenhum esforço</li>
            <li><span>1</span> Muito leve</li>
            <li><span>2</span> Leve</li>
            <li><span>3</span> Moderado</li>
            <li><span>4</span> Pouco intenso</li>
            <li><span>5</span> Intenso</li>
            <li><span>6–7</span> Muito intenso</li>
            <li><span>8–9</span> Extremamente intenso</li>
            <li><span>10</span> Máximo — esforço absoluto</li>
          </ul>
        </details>
        {/* Tabela semântica: cabeçalhos de coluna e o dia como cabeçalho de
            linha. Cada campo tem rótulo oculto "linha, coluna" com os textos
            da própria tabela. Em tela estreita a tabela rola dentro do
            invólucro, que recebe foco pelo teclado e o nome da seção. */}
        <div
          className="carga-treino__table-wrap"
          role="region"
          aria-labelledby="carga-sessoes-titulo"
          tabIndex={0}
        >
          <table className="carga-treino__table" aria-labelledby="carga-sessoes-titulo">
            <thead>
              <tr>
                <th scope="col">Dia</th>
                <th scope="col">Tipo</th>
                <th scope="col">Duracao (min)</th>
                <th scope="col">PSE (0-10)</th>
                <th scope="col">MET (auto)</th>
                <th scope="col">Carga sessao</th>
              </tr>
            </thead>
            <tbody>
              {sessoesNormalizadas.map((row) => (
                <tr key={row.dia}>
                  <th scope="row">{findDiaLabel(row.dia)}</th>
                  <td>
                    <Campo rotulo={`${findDiaLabel(row.dia)}, Tipo`} rotuloOculto>
                      <select
                        className="eval-select"
                        value={row.tipo || ''}
                        onChange={(event) => updateSessaoField(row.dia, 'tipo', event.target.value)}
                        disabled={readOnly}
                      >
                        <option value="">Selecione</option>
                        {tipoOptions.map((tipo) => (
                          <option key={tipo} value={tipo}>{tipo}</option>
                        ))}
                      </select>
                    </Campo>
                  </td>
                  <td>
                    <Campo rotulo={`${findDiaLabel(row.dia)}, Duracao (min)`} rotuloOculto>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        className="eval-input"
                        value={row.duracaoMin ?? ''}
                        onChange={(event) => updateSessaoField(row.dia, 'duracaoMin', event.target.value)}
                        disabled={readOnly}
                      />
                    </Campo>
                  </td>
                  <td>
                    <Campo rotulo={`${findDiaLabel(row.dia)}, PSE (0-10)`} rotuloOculto>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="10"
                        className="eval-input"
                        value={row.pse ?? ''}
                        onChange={(event) => updateSessaoField(row.dia, 'pse', event.target.value)}
                        disabled={readOnly}
                      />
                    </Campo>
                  </td>
                  <td>{Number.isFinite(row.metValue) ? formatNumber(row.metValue, 1) : '--'}</td>
                  <td>{Number.isFinite(row.cargaSessao) ? formatNumber(row.cargaSessao, 1) : '--'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AvaliacaoSecao>

      {/* Mesmas casas de antes (formatNumber); "—" quando o valor não existe,
          no lugar do "--". A carga da semana mostra "—" enquanto nenhuma
          sessão foi preenchida (o cálculo e o payload continuam com 0). A
          classificação do ACWR vai escrita no resultado; o tom é o da síntese. */}
      <AvaliacaoSecao id="carga-resultados" titulo="Resultados">
        <div className="av-resultados">
          <ResultadoCalculado
            rotulo="Carga semana atual"
            valor={hasSessionInput && Number.isFinite(cargaSemanaAtual) ? formatNumber(cargaSemanaAtual, 2) : null}
          />
          <ResultadoCalculado
            rotulo="Media ultimas 4 semanas"
            valor={Number.isFinite(mediaCarga4Semanas) ? formatNumber(mediaCarga4Semanas, 2) : null}
          />
          <ResultadoCalculado
            rotulo="ACWR"
            valor={Number.isFinite(acwr) ? formatNumber(acwr, 2) : null}
            classificacao={classificacaoAcwr ? humanizeStatusToken(classificacaoAcwr) : null}
            tom={acwrSynthesis.tone}
          />
          <ResultadoCalculado rotulo="Monotonia" valor={Number.isFinite(monotonia) ? formatNumber(monotonia, 2) : null} />
          <ResultadoCalculado rotulo="Strain" valor={Number.isFinite(strain) ? formatNumber(strain, 2) : null} />
          <ResultadoCalculado className="carga-treino__resultado--texto" rotulo="Classificacao ACWR" valor={classificacaoAcwr || null} />
        </div>
        {classificacaoAcwr === 'zona_risco' && (
          <AvisoAvaliacao tipo="perigo" className="carga-treino__alert">
            ACWR em zona de risco (&gt; 1.5). Ajuste progressao de carga e recuperacao.
          </AvisoAvaliacao>
        )}
        <AvisoAvaliacao
          tipo={TIPO_AVISO_SINTESE[acwrSynthesis.tone] || 'info'}
          titulo="Sintese operacional"
          className={`carga-treino__synthesis carga-treino__synthesis--${acwrSynthesis.tone}`}
        >
          <p>{acwrSynthesis.message}</p>
          <small>
            Classificacao atual: {classificacaoAcwr ? humanizeStatusToken(classificacaoAcwr) : 'nao classificada'}
          </small>
        </AvisoAvaliacao>
      </AvaliacaoSecao>

      <AvaliacaoSecao id="carga-historico" titulo="Historico das ultimas 4 semanas">
        {histError && <AvisoAvaliacao tipo="atencao" className="carga-treino__warning">{histError}</AvisoAvaliacao>}
        {!historico4Semanas.length ? (
          <p className="carga-treino__empty">ACWR indisponivel: historico semanal insuficiente. Sera calculado automaticamente apos novas semanas registradas.</p>
        ) : (
          <div className="carga-treino__bars">
            {historico4Semanas.map((item, index) => (
              <div key={item.id || index} className="carga-treino__bar-item">
                <div
                  className="carga-treino__bar"
                  aria-hidden="true"
                  style={{
                    height: `${Math.max(8, calculateBarHeight(item.cargaSemanaAtual, historico4Semanas))}%`
                  }}
                />
                <small>{item.label}</small>
                <strong>{formatNumber(item.cargaSemanaAtual, 0)}</strong>
              </div>
            ))}
          </div>
        )}
      </AvaliacaoSecao>

      {error && <AvisoAvaliacao tipo="perigo" anunciar className="carga-treino__error">{error}</AvisoAvaliacao>}

      <BarraAcoesAvaliacao
        className="carga-treino__actions"
        status={saveStatus}
        textosStatus={{ saved: 'Salvo com sucesso.', error: 'Falha ao salvar.' }}
      >
        <Button
          type="button"
          variant="primary"
          onClick={() => void dispatchSalvar(false)}
          disabled={readOnly}
        >
          <Save size={16} />
          Salvar carga de treino
        </Button>
      </BarraAcoesAvaliacao>
    </AvaliacaoModulo>
  );
};

export default AvaliacaoCargaTreino;

function normalizeSessaoRows(rows, metByTipo) {
  if (!Array.isArray(rows)) return buildSessaoSemanaPadrao().map((row) => ({
    ...row,
    cargaSessao: null
  }));

  const byDia = new Map();
  rows.forEach((item) => {
    const dia = String(item?.dia || '').trim().toLowerCase();
    if (!dia) return;
    const tipo = String(item?.tipo || '').trim();
    const metOption = metByTipo.get(tipo.toLowerCase());
    const metValue = Number.isFinite(toNumber(item?.metValue))
      ? round(toNumber(item?.metValue), 1)
      : (Number.isFinite(metOption?.metValue) ? metOption.metValue : null);
    const duracaoMin = round(toNumber(item?.duracaoMin), 2);
    const pse = round(toNumber(item?.pse), 2);
    const cargaSessao = Number.isFinite(duracaoMin) && Number.isFinite(pse) && pse >= 0 && pse <= 10
      ? round((duracaoMin * pse), 2)
      : null;

    byDia.set(dia, {
      dia,
      tipo,
      duracaoMin,
      pse,
      metValue,
      cargaSessao
    });
  });

  return DIAS_SEMANA.map((item) => byDia.get(item.key) || {
    ...createSessaoRow(item.key),
    cargaSessao: null
  });
}

function mergeSessaoRows(currentRows, snapshotRows, metByTipo) {
  const base = normalizeSessaoRows(snapshotRows, metByTipo);
  if (Array.isArray(snapshotRows) && snapshotRows.length > 0) return base;
  if (!Array.isArray(currentRows) || currentRows.length === 0) return base;
  const currentByDay = new Map(currentRows.map((row) => [row.dia, row]));
  return base.map((row) => currentByDay.get(row.dia) || row);
}

function findDiaLabel(dia) {
  return DIAS_SEMANA.find((item) => item.key === dia)?.label || dia;
}

function calculateBarHeight(value, rows) {
  const max = Math.max(
    ...rows.map((row) => toNumber(row?.cargaSemanaAtual)).filter((item) => Number.isFinite(item)),
    1
  );
  const numeric = toNumber(value);
  if (!Number.isFinite(numeric)) return 8;
  return Math.min(100, Math.max(8, (numeric / max) * 100));
}
