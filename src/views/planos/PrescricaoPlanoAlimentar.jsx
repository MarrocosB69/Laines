import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ChevronDown, Download, PlusCircle, Save, ShieldCheck } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { usePacientes } from '../../contexts/PacienteContext';
import api, { getApiErrorMessage } from '../../services/api';
import RefeicaoBuilder from '../../components/RefeicaoBuilder';
import SuplementoCard from '../../components/SuplementoCard';
import './PrescricaoPlanoAlimentar.css';

const EMPTY_REFEICAO = (index = 1) => ({
  id: `refeicao-${Date.now()}-${index}`,
  nome: `Refeição ${index}`,
  horario: '',
  vinculadoTreino: false,
  tipoVinculo: null,
  alimentos: [],
  substitutos: [],
  orientacoes: '',
  totalRefeicao: {
    calorias: 0,
    cho: 0,
    ptn: 0,
    lip: 0,
    fibra: 0
  }
});

const EMPTY_SUPLEMENTO = () => ({
  nome: '',
  dose: '',
  horario: '',
  marca: '',
  loteVerificado: '',
  statusWADA: 'risco',
  justificativaClinica: ''
});

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(String(value).replace(',', '.').trim());
  return Number.isFinite(parsed) ? parsed : null;
};

const getBarColor = (prescrito, meta) => {
  const prescritoNum = toNumber(prescrito) || 0;
  const metaNum = toNumber(meta) || 0;
  if (!metaNum || metaNum <= 0) return '#1565C0';
  const pct = (prescritoNum / metaNum) * 100;
  if (pct < 80) return '#F59E0B';
  if (pct <= 110) return '#0F6E56';
  return '#B91C1C';
};

const getTotalClass = (prescrito, meta) => {
  const prescritoNum = toNumber(prescrito) || 0;
  const metaNum = toNumber(meta) || 0;
  if (!metaNum || metaNum <= 0) return 'total-alert';
  const pct = prescritoNum / metaNum;
  if (pct < 0.80) return 'total-alert';
  if (pct <= 1.10) return 'total-ok';
  return 'total-risk';
};

const formatValue = (value, digits = 0) => {
  const num = toNumber(value);
  if (!Number.isFinite(num)) return '--';
  return Number(num).toFixed(digits);
};

const sumTotais = (refeicoes = []) => {
  const total = refeicoes.reduce((acc, refeicao) => {
    const t = refeicao?.totalRefeicao || {};
    acc.calorias += Number(toNumber(t.calorias) || 0);
    acc.cho += Number(toNumber(t.cho) || 0);
    acc.ptn += Number(toNumber(t.ptn) || 0);
    acc.lip += Number(toNumber(t.lip) || 0);
    acc.fibra += Number(toNumber(t.fibra) || 0);
    return acc;
  }, { calorias: 0, cho: 0, ptn: 0, lip: 0, fibra: 0 });

  return {
    calorias: Number(total.calorias.toFixed(2)),
    cho: Number(total.cho.toFixed(2)),
    ptn: Number(total.ptn.toFixed(2)),
    lip: Number(total.lip.toFixed(2)),
    fibra: Number(total.fibra.toFixed(2))
  };
};

const getEffectiveMeta = (manualValue, getValue) => {
  const manual = toNumber(manualValue);
  if (Number.isFinite(manual) && manual > 0) return manual;
  const fromGet = toNumber(getValue);
  if (Number.isFinite(fromGet) && fromGet > 0) return fromGet;
  return null;
};

const hasClinicalJustification = (value) => String(value || '').trim().length >= 10;

const PrescricaoPlanoAlimentar = () => {
  const { pacienteId } = useParams();
  const navigate = useNavigate();
  const { getPacienteById } = usePacientes();

  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saveStatus, setSaveStatus] = useState(null);
  const [planId, setPlanId] = useState('');

  const [metasGet, setMetasGet] = useState({
    calorias: null,
    cho: null,
    ptn: null,
    lip: null,
    fibras: null,
    avaliacaoId: null
  });

  const [status, setStatus] = useState('rascunho');
  const [dataInicio, setDataInicio] = useState(() => new Date().toISOString().slice(0, 10));
  const [dataFim, setDataFim] = useState('');
  const [tipoDieta, setTipoDieta] = useState('fixa');
  const [faseAtual, setFaseAtual] = useState('');
  const [metaCalorica, setMetaCalorica] = useState('');
  const [metaCho, setMetaCho] = useState('');
  const [metaPtn, setMetaPtn] = useState('');
  const [metaLip, setMetaLip] = useState('');
  const [metaFibras, setMetaFibras] = useState('');
  const [validadoAntidoping, setValidadoAntidoping] = useState(false);
  const [versaoCompeticion, setVersaoCompeticion] = useState(false);
  const [orientacoesGerais, setOrientacoesGerais] = useState('');
  const [refeicoes, setRefeicoes] = useState([EMPTY_REFEICAO(1)]);
  const [suplementos, setSuplementos] = useState([]);
  const [revisaoFinalConfirmada, setRevisaoFinalConfirmada] = useState(false);
  const [validacaoAberta, setValidacaoAberta] = useState(false);

  const metaCaloricaNum = toNumber(metaCalorica) || 0;
  // Dividir a meta do dia pelo numero de refeicoes cadastradas *ate agora* faz
  // a primeira refeicao ser comparada com o dia inteiro — e o status de uma
  // refeicao muda sozinho quando outra e criada. Abaixo de tres refeicoes a
  // divisao nao significa nada, entao nao ha meta por refeicao para julgar.
  const MINIMO_REFEICOES_PARA_META = 3;
  const metaCaloricaPorRefeicao = useMemo(() => {
    if (!metaCaloricaNum || metaCaloricaNum <= 0) return 0;
    if (refeicoes.length < MINIMO_REFEICOES_PARA_META) return 0;
    return Number((metaCaloricaNum / refeicoes.length).toFixed(2));
  }, [metaCaloricaNum, refeicoes.length]);

  const totais = useMemo(() => sumTotais(refeicoes), [refeicoes]);
  const statusLabel = useMemo(() => {
    if (status === 'ativo') return 'Ativo';
    if (status === 'em_revisao') return 'Em revisão';
    if (status === 'arquivado' || status === 'encerrado') return 'Arquivado';
    return 'Rascunho';
  }, [status]);

  const metasCards = useMemo(() => ([
    {
      key: 'kcal',
      label: 'Energia',
      value: metasGet?.calorias,
      unit: 'kcal',
      prescrito: totais.calorias,
      color: '#1565C0',
      digits: 0
    },
    {
      key: 'cho',
      label: 'CHO',
      value: metasGet?.cho,
      unit: 'g',
      prescrito: totais.cho,
      color: '#F59E0B',
      digits: 0
    },
    {
      key: 'ptn',
      label: 'PTN',
      value: metasGet?.ptn,
      unit: 'g',
      prescrito: totais.ptn,
      color: '#8B5CF6',
      digits: 0
    },
    {
      key: 'lip',
      label: 'LIP',
      value: metasGet?.lip,
      unit: 'g',
      prescrito: totais.lip,
      color: '#10B981',
      digits: 0
    },
    {
      key: 'fibra',
      label: 'Fibras',
      value: metasGet?.fibras,
      unit: 'g',
      prescrito: totais.fibra,
      color: '#0F6E56',
      digits: 0
    }
  ]), [metasGet?.calorias, metasGet?.cho, metasGet?.fibras, metasGet?.lip, metasGet?.ptn, totais.calorias, totais.cho, totais.fibra, totais.lip, totais.ptn]);

  const totaisCards = useMemo(() => ([
    {
      key: 'kcal',
      label: 'Energia',
      value: totais.calorias,
      meta: metasGet?.calorias,
      unit: 'kcal',
      digits: 1
    },
    {
      key: 'cho',
      label: 'CHO',
      value: totais.cho,
      meta: metasGet?.cho,
      unit: 'g',
      digits: 1
    },
    {
      key: 'ptn',
      label: 'PTN',
      value: totais.ptn,
      meta: metasGet?.ptn,
      unit: 'g',
      digits: 1
    },
    {
      key: 'lip',
      label: 'LIP',
      value: totais.lip,
      meta: metasGet?.lip,
      unit: 'g',
      digits: 1
    },
    {
      key: 'fibra',
      label: 'Fibras',
      value: totais.fibra,
      meta: metasGet?.fibras,
      unit: 'g',
      digits: 1
    }
  ]), [metasGet?.calorias, metasGet?.cho, metasGet?.fibras, metasGet?.lip, metasGet?.ptn, totais.calorias, totais.cho, totais.fibra, totais.lip, totais.ptn]);

  const mapPlano = useCallback((plano) => {
    if (!plano) return;
    const dados = plano?.dados || {};

    setPlanId(plano.id || '');
    setStatus(String(plano.status || 'rascunho'));
    setDataInicio(String(plano.dataInicio || new Date().toISOString().slice(0, 10)));
    setDataFim(String(plano.dataFim || ''));
    setTipoDieta(String(plano.tipoDieta || 'fixa'));
    setFaseAtual(String(plano.faseAtual || ''));
    setMetaCalorica(plano.metaCalorica == null ? '' : String(plano.metaCalorica));
    setMetaCho(plano.metaCHOg == null ? '' : String(plano.metaCHOg));
    setMetaPtn(plano.metaPTNg == null ? '' : String(plano.metaPTNg));
    setMetaLip(plano.metaLIPg == null ? '' : String(plano.metaLIPg));
    setMetaFibras(plano.metaFibrasg == null ? '' : String(plano.metaFibrasg));
    setValidadoAntidoping(Boolean(plano.validadoAntidoping));
    setVersaoCompeticion(Boolean(dados.versaoCompeticion));
    setOrientacoesGerais(String(dados.orientacoesGerais || ''));
    setRevisaoFinalConfirmada(Boolean(dados?.revisaoFinal?.confirmada));

    const refeicoesPlano = Array.isArray(dados.refeicoes) && dados.refeicoes.length
      ? dados.refeicoes
      : [EMPTY_REFEICAO(1)];
    setRefeicoes(refeicoesPlano);
    setSuplementos(Array.isArray(dados.suplementos) ? dados.suplementos : []);
  }, []);

  useEffect(() => {
    let mounted = true;
    const bootstrap = async () => {
      if (!pacienteId) return;
      setLoading(true);
      setError('');
      try {
        const [paciente, contextoResp, planosResp] = await Promise.all([
          getPacienteById(pacienteId),
          api.get(`/planos-alimentares/paciente/${pacienteId}/contexto`),
          api.get('/planos-alimentares', { params: { pacienteId, limit: 1, offset: 0 } })
        ]);

        if (!mounted) return;
        setPatient(paciente || null);
        setMetasGet(contextoResp?.data?.metasGet || {});

        const planoRecente = Array.isArray(planosResp?.data) && planosResp.data.length ? planosResp.data[0] : null;
        if (planoRecente) {
          mapPlano(planoRecente);
        } else {
          const metas = contextoResp?.data?.metasGet || {};
          setMetaCalorica(metas.calorias == null ? '' : String(Math.round(metas.calorias)));
          setMetaCho(metas.cho == null ? '' : String(Math.round(metas.cho)));
          setMetaPtn(metas.ptn == null ? '' : String(Math.round(metas.ptn)));
          setMetaLip(metas.lip == null ? '' : String(Math.round(metas.lip)));
          setMetaFibras(metas.fibras == null ? '' : String(Math.round(metas.fibras)));
        }
      } catch (requestError) {
        if (!mounted) return;
        setError(getApiErrorMessage(requestError, 'Não foi possível carregar o contexto do plano alimentar.'));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    bootstrap();
    return () => {
      mounted = false;
    };
  }, [getPacienteById, mapPlano, pacienteId]);

  const addRefeicao = () => {
    setRefeicoes((prev) => [...prev, EMPTY_REFEICAO(prev.length + 1)]);
  };

  const patchRefeicao = (index, next) => {
    setRefeicoes((prev) => prev.map((item, idx) => (idx === index ? next : item)));
  };

  const removeRefeicao = (index) => {
    const confirmed = window.confirm('Tem certeza que deseja remover esta refeicao? Os alimentos e substituicoes vinculados tambem serao removidos.');
    if (!confirmed) return;
    setRefeicoes((prev) => {
      const next = prev.filter((_, idx) => idx !== index);
      return next.length ? next : [EMPTY_REFEICAO(1)];
    });
  };

  const addSuplemento = () => {
    setSuplementos((prev) => [...prev, EMPTY_SUPLEMENTO()]);
  };

  const patchSuplemento = (index, next) => {
    setSuplementos((prev) => prev.map((item, idx) => (idx === index ? next : item)));
  };

  const removeSuplemento = (index) => {
    const confirmed = window.confirm('Tem certeza que deseja remover este suplemento do plano?');
    if (!confirmed) return;
    setSuplementos((prev) => prev.filter((_, idx) => idx !== index));
  };

  const metasEfetivas = useMemo(() => ({
    calorias: getEffectiveMeta(metaCalorica, metasGet?.calorias),
    cho: getEffectiveMeta(metaCho, metasGet?.cho),
    ptn: getEffectiveMeta(metaPtn, metasGet?.ptn),
    lip: getEffectiveMeta(metaLip, metasGet?.lip),
    fibras: getEffectiveMeta(metaFibras, metasGet?.fibras)
  }), [metaCalorica, metaCho, metaFibras, metaLip, metaPtn, metasGet?.calorias, metasGet?.cho, metasGet?.fibras, metasGet?.lip, metasGet?.ptn]);

  const refeicoesComAlimentos = useMemo(() => (
    refeicoes.filter((refeicao) => Array.isArray(refeicao?.alimentos) && refeicao.alimentos.length > 0).length
  ), [refeicoes]);

  const suplementosProibidos = useMemo(() => (
    suplementos.filter((item) => String(item?.statusWADA || '').toLowerCase() === 'proibido')
  ), [suplementos]);

  const suplementosRiscoSemJustificativa = useMemo(() => (
    suplementos.filter((item) => (
      String(item?.statusWADA || 'risco').toLowerCase() === 'risco'
      && !hasClinicalJustification(item?.justificativaClinica)
    ))
  ), [suplementos]);

  const energiaAdequacao = useMemo(() => {
    const meta = metasEfetivas.calorias;
    if (!meta || meta <= 0) return null;
    return (totais.calorias / meta) * 100;
  }, [metasEfetivas.calorias, totais.calorias]);

  const activationChecklist = useMemo(() => {
    const hasGet = Boolean(metasGet?.avaliacaoId);
    const metasCompletas = Object.values(metasEfetivas).every((value) => Number.isFinite(value) && value > 0);
    const totaisValidos = totais.calorias > 0 && totais.cho >= 0 && totais.ptn >= 0 && totais.lip >= 0 && totais.fibra >= 0;

    const items = [
      {
        id: 'get',
        label: 'GET cadastrado',
        ok: hasGet,
        severity: 'blocker',
        message: hasGet
          ? 'GET localizado para apoiar a prescrição.'
          : 'Este paciente ainda não possui GET cadastrado. Você pode montar um rascunho, mas não será possível ativar o plano até preencher as metas energéticas e nutricionais.'
      },
      {
        id: 'metas',
        label: 'Metas completas',
        ok: metasCompletas,
        severity: 'blocker',
        message: metasCompletas
          ? 'Metas de kcal, CHO, PTN, LIP e fibras definidas.'
          : 'Metas incompletas. Revise kcal, carboidratos, proteínas, lipídios e fibras antes da ativação.'
      },
      {
        id: 'refeicoes',
        label: 'Refeições cadastradas',
        ok: refeicoesComAlimentos > 0,
        severity: 'blocker',
        message: refeicoesComAlimentos > 0
          ? `${refeicoesComAlimentos} refeicao(oes) com alimentos cadastrados.`
          : 'Cadastre ao menos uma refeição com alimento antes de ativar.'
      },
      {
        id: 'totais',
        label: 'Totais calculados',
        ok: totaisValidos,
        severity: 'blocker',
        message: totaisValidos
          ? 'Totais nutricionais calculados com fibras incluidas.'
          : 'Não foi possível calcular totais nutricionais válidos.'
      },
      {
        id: 'proibidos',
        label: 'Suplementos proibidos',
        ok: suplementosProibidos.length === 0,
        severity: 'blocker',
        message: suplementosProibidos.length === 0
          ? 'Nenhum suplemento proibido informado.'
          : 'Ha suplemento marcado como proibido. Remova ou substitua antes de ativar.'
      },
      {
        id: 'risco',
        label: 'Suplementos em risco',
        ok: suplementosRiscoSemJustificativa.length === 0,
        severity: 'blocker',
        message: suplementosRiscoSemJustificativa.length === 0
          ? 'Suplementos em risco possuem justificativa clínica ou não foram informados.'
          : 'Suplemento em risco exige justificativa clinica antes da ativacao.'
      },
      {
        id: 'revisao',
        label: 'Revisão final',
        ok: revisaoFinalConfirmada,
        severity: 'blocker',
        message: revisaoFinalConfirmada
          ? 'Revisão final confirmada pelo profissional.'
          : 'Confirme a revisão final profissional antes de ativar.'
      }
    ];

    if (energiaAdequacao !== null && energiaAdequacao < 80) {
      items.push({
        id: 'energia',
        label: 'Distância em relação ao GET',
        ok: false,
        severity: 'warning',
        message: 'O plano está distante da meta energética definida. Revise as refeições antes de ativar.'
      });
    }

    if (!metasEfetivas.fibras) {
      items.push({
        id: 'fibras',
        label: 'Fibras ausentes',
        ok: false,
        severity: 'warning',
        message: 'A meta de fibras não foi definida. O plano poderá ser salvo, mas revise este dado antes da ativação.'
      });
    }

    return items;
  }, [
    energiaAdequacao,
    metasEfetivas,
    metasGet?.avaliacaoId,
    refeicoesComAlimentos,
    revisaoFinalConfirmada,
    suplementosProibidos.length,
    suplementosRiscoSemJustificativa.length,
    totais.calorias,
    totais.cho,
    totais.fibra,
    totais.lip,
    totais.ptn
  ]);

  const activationBlockers = useMemo(() => (
    activationChecklist
      .filter((item) => item.severity === 'blocker' && !item.ok)
      .map((item) => item.message)
  ), [activationChecklist]);

  const activationWarnings = useMemo(() => (
    activationChecklist
      .filter((item) => item.severity === 'warning' && !item.ok)
      .map((item) => item.message)
  ), [activationChecklist]);

  const canActivate = activationBlockers.length === 0;

  const buildPayload = (statusOverride = status) => ({
    pacienteId,
    alunoId: null,
    projetoId: patient?.projetoId || null,
    status: statusOverride,
    dataInicio,
    dataFim: dataFim || null,
    tipoDieta,
    metaCalorica: toNumber(metaCalorica),
    metaCHOg: toNumber(metaCho),
    metaPTNg: toNumber(metaPtn),
    metaLIPg: toNumber(metaLip),
    metaFibrasg: toNumber(metaFibras),
    faseAtual: faseAtual || null,
    validadoAntidoping,
    dados: {
      refeicoes,
      suplementos,
      versaoCompeticion,
      orientacoesGerais,
      revisaoFinal: {
        confirmada: revisaoFinalConfirmada
      }
    },
    resultados: {
      totaisCalculados: totais
    }
  });

  const handleSave = async (statusOverride) => {
    if (!pacienteId) return;
    const nextStatus = typeof statusOverride === 'string' ? statusOverride : status;
    setError('');

    if (nextStatus === 'ativo' && activationBlockers.length > 0) {
      setError(activationBlockers[0]);
      return;
    }

    if (status === 'ativo' && !metasGet?.avaliacaoId) {
      setError('Configure o Gasto Energético Total antes de ativar o plano');
      return;
    }

    setSaveStatus('saving');
    try {
      const payload = buildPayload(nextStatus);
      if (planId) {
        const { data } = await api.patch(`/planos-alimentares/${planId}`, payload);
        setPlanId(data?.id || planId);
        mapPlano(data);
      } else {
        const { data } = await api.post('/planos-alimentares', payload);
        setPlanId(data?.id || '');
        mapPlano(data);
      }
      setStatus(nextStatus);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(null), 2500);
    } catch (requestError) {
      setSaveStatus('error');
      setError(getApiErrorMessage(requestError, 'Não foi possível salvar o plano alimentar.'));
    }
  };

  const handleActivate = () => handleSave('ativo');

  const handleDownloadPdf = async () => {
    if (!planId) return;
    try {
      const response = await api.get(`/planos-alimentares/${planId}/pdf`, {
        responseType: 'blob'
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `plano-alimentar-${planId}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Não foi possível gerar o PDF do plano.'));
    }
  };

  if (loading) {
    return <div className="prescricao-plano loading">Carregando plano alimentar...</div>;
  }

  return (
    <div className="prescricao-plano">
      <header className="prescricao-header">
        <div className="prescricao-header-row">
          <button type="button" className="btn-voltar" onClick={() => navigate(-1)}>
            <ArrowLeft size={14} /> Voltar
          </button>

          <div className="prescricao-header-info">
            <h1 className="prescricao-title">Prescrição de Plano Alimentar</h1>
            <p className="prescricao-subtitle">{patient?.nome || 'Paciente'} | ID: {pacienteId}</p>
          </div>

          <div className="prescricao-header-actions">
            <span className="status-badge" data-status={statusLabel}>{statusLabel}</span>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleDownloadPdf}
              disabled={!planId || saveStatus === 'saving'}
            >
              <Download size={14} /> PDF
            </button>
            <button type="button" className="btn-secondary" onClick={handleSave} disabled={saveStatus === 'saving'}>
              <Save size={14} /> Salvar plano
            </button>
            <button
              type="button"
              className="btn-ativar"
              onClick={handleActivate}
              disabled={!canActivate || saveStatus === 'saving'}
              title={!canActivate ? activationBlockers[0] : 'Ativar plano alimentar'}
            >
              <ShieldCheck size={14} /> Ativar plano
            </button>
          </div>
        </div>
      </header>

      {/* A validacao abria com nove cartoes de bloqueio antes do plano aparecer.
          O contador ja diz se e preciso olhar; a lista fica a um clique. */}
      <section className="prescricao-card prescricao-section">
        <div className="prescricao-section-header">
          <button
            type="button"
            className="validacao-toggle"
            onClick={() => setValidacaoAberta((v) => !v)}
            aria-expanded={validacaoAberta}
          >
            <ChevronDown
              size={14}
              className={`validacao-toggle__seta${validacaoAberta ? ' aberta' : ''}`}
              aria-hidden="true"
            />
            <span className="section-title">Validação clínica para ativação</span>
          </button>
          <span className={`activation-summary ${canActivate ? 'ok' : 'blocker'}`}>
            {canActivate
              ? 'Pronto para ativação'
              : `${activationBlockers.length} ${activationBlockers.length === 1 ? 'bloqueio' : 'bloqueios'}`}
          </span>
        </div>

        <div className={`clinical-checklist${validacaoAberta ? '' : ' recolhida'}`}>
          {activationChecklist.map((item) => (
            <article
              key={item.id}
              className={`clinical-checklist__item ${item.ok ? 'ok' : item.severity}`}
            >
              <span className="clinical-checklist__dot" aria-hidden="true" />
              <div>
                <strong>{item.label}</strong>
                <p>{item.message}</p>
              </div>
            </article>
          ))}
        </div>

        {activationWarnings.length > 0 && (
          <div className="clinical-warning-list">
            {activationWarnings.map((message) => (
              <p key={message}>{message}</p>
            ))}
          </div>
        )}
      </section>

      <section className="prescricao-card">
        <h2 className="section-title">Metas do GET (última avaliação)</h2>
        <div className="metas-grid">
          {metasCards.map((item) => {
            const metaNum = toNumber(item.value) || 0;
            const prescritoNum = toNumber(item.prescrito) || 0;
            const pct = metaNum > 0 ? Math.min((prescritoNum / metaNum) * 100, 100) : 0;
            return (
              <article key={item.key} className="meta-item" style={{ '--meta-base-color': item.color }}>
                <div className="meta-item-label">{item.label}</div>
                <div className="meta-item-value">{formatValue(item.value, item.digits)}</div>
                <div className="meta-item-unit">{item.unit}</div>
                <div className="meta-progress-bar">
                  <div
                    className="meta-progress-fill"
                    style={{
                      width: `${Math.max(0, pct)}%`,
                      background: getBarColor(prescritoNum, metaNum)
                    }}
                  />
                </div>
                <div className="meta-item-sub">
                  Prescrito: {formatValue(item.prescrito, 1)} {item.unit}
                </div>
                {metaNum > 0 && (
                  <div className="meta-item-pct">
                    {Math.round((prescritoNum / metaNum) * 100)}%
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section className="prescricao-card">
        <h2 className="section-title">Configuração do plano</h2>

                <div className="config-grid-meta">
          <div className="form-field">
            <label htmlFor="plano-status">Status</label>
            <select
              id="plano-status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              aria-required="true"
            >
              <option value="rascunho">Rascunho</option>
              <option value="em_revisao">Em revisao</option>
              <option value="ativo">Ativo</option>
              <option value="arquivado">Arquivado</option>
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="plano-tipo-dieta">Tipo de dieta</label>
            <select
              id="plano-tipo-dieta"
              value={tipoDieta}
              onChange={(event) => setTipoDieta(event.target.value)}
              aria-required="true"
            >
              <option value="fixa">Fixa</option>
              <option value="rodizio">Rodizio</option>
              <option value="periodizada">Periodizada</option>
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="plano-fase-atual">Fase atual</label>
            <input
              id="plano-fase-atual"
              type="text"
              value={faseAtual}
              onChange={(event) => setFaseAtual(event.target.value)}
              aria-required="true"
            />
          </div>

          <div className="form-field">
            <label htmlFor="plano-data-inicio">Data início</label>
            <input
              id="plano-data-inicio"
              type="date"
              value={dataInicio}
              onChange={(event) => setDataInicio(event.target.value)}
              aria-required="true"
            />
          </div>

          <div className="form-field">
            <label htmlFor="plano-data-fim">Data fim</label>
            <input
              id="plano-data-fim"
              type="date"
              value={dataFim}
              onChange={(event) => setDataFim(event.target.value)}
            />
          </div>
        </div>

        <div className="config-subgroup">
          <p className="config-subgroup-label">Metas nutricionais</p>
          <div className="config-grid-metas-nutricionais">
            <div className="form-field">
              <label htmlFor="plano-meta-calorica">Meta calorica</label>
              <input
                id="plano-meta-calorica"
                type="number"
                value={metaCalorica}
                onChange={(event) => setMetaCalorica(event.target.value)}
                aria-required="true"
              />
            </div>

            <div className="form-field">
              <label htmlFor="plano-meta-cho">Meta CHO g</label>
              <input
                id="plano-meta-cho"
                type="number"
                value={metaCho}
                onChange={(event) => setMetaCho(event.target.value)}
                aria-required="true"
              />
            </div>

            <div className="form-field">
              <label htmlFor="plano-meta-ptn">Meta PTN g</label>
              <input
                id="plano-meta-ptn"
                type="number"
                value={metaPtn}
                onChange={(event) => setMetaPtn(event.target.value)}
                aria-required="true"
              />
            </div>

            <div className="form-field">
              <label htmlFor="plano-meta-lip">Meta LIP g</label>
              <input
                id="plano-meta-lip"
                type="number"
                value={metaLip}
                onChange={(event) => setMetaLip(event.target.value)}
                aria-required="true"
              />
            </div>

            <div className="form-field">
              <label htmlFor="plano-meta-fibras">Meta Fibras g</label>
              <input
                id="plano-meta-fibras"
                type="number"
                value={metaFibras}
                onChange={(event) => setMetaFibras(event.target.value)}
                aria-required="true"
              />
            </div>
          </div>
        </div>

        <div className="config-checkboxes">
          <label className="config-toggle">
            <input
              type="checkbox"
              checked={validadoAntidoping}
              onChange={(event) => setValidadoAntidoping(event.target.checked)}
            />
            <span className="config-toggle-track" />
            Validado antidoping
          </label>
          <label className="config-toggle">
            <input
              type="checkbox"
              checked={versaoCompeticion}
              onChange={(event) => setVersaoCompeticion(event.target.checked)}
            />
            <span className="config-toggle-track" />
            Versão competição
          </label>
        </div>
      </section>

      <section className="prescricao-card prescricao-section">
        <div className="prescricao-section-header">
          <h2 className="section-title">Refeições</h2>
          <button type="button" className="btn-secondary" onClick={addRefeicao}>
            <PlusCircle size={16} /> Adicionar refeição
          </button>
        </div>

        <div className="prescricao-refeicoes">
          {refeicoes.map((refeicao, index) => (
            <RefeicaoBuilder
              key={refeicao.id || `refeicao-${index}`}
              value={refeicao}
              onChange={(next) => patchRefeicao(index, next)}
              onRemove={() => removeRefeicao(index)}
              metaCaloricaPorRefeicao={metaCaloricaPorRefeicao}
              refeicaoNumero={index + 1}
            />
          ))}
        </div>
      </section>

      <section className="prescricao-card prescricao-section">
        <div className="prescricao-section-header">
          <h2 className="section-title">Suplementação</h2>
          <button type="button" className="btn-secondary" onClick={addSuplemento}>
            <PlusCircle size={16} /> Adicionar suplemento
          </button>
        </div>

        <div className="prescricao-suplementos">
          {suplementos.length === 0 ? (
            <p className="prescricao-empty">Nenhum suplemento adicionado.</p>
          ) : suplementos.map((item, index) => (
            <SuplementoCard
              key={`sup-${index}`}
              value={item}
              onChange={(next) => patchSuplemento(index, next)}
              onRemove={() => removeSuplemento(index)}
            />
          ))}
        </div>
      </section>

      <section className="prescricao-card prescricao-section">
        <h2 className="section-title">Orientações gerais</h2>
        <label className="form-field-label" htmlFor="plano-orientacoes-gerais">Orientações do plano</label>
        <textarea
          id="plano-orientacoes-gerais"
          className="orientacoes-textarea"
          rows={4}
          value={orientacoesGerais}
          onChange={(event) => setOrientacoesGerais(event.target.value)}
          placeholder="Observações para o paciente, timing de refeições e condutas complementares."
        />
      </section>

      <section className="prescricao-card prescricao-section">
        <h2 className="section-title">Revisão final</h2>
        <div className="review-summary-grid">
          <div>
            <span>Energia prescrita</span>
            <strong>{formatValue(totais.calorias, 1)} kcal</strong>
          </div>
          <div>
            <span>Fibras prescritas</span>
            <strong>{formatValue(totais.fibra, 1)} g</strong>
          </div>
          <div>
            <span>Refeições com alimentos</span>
            <strong>{refeicoesComAlimentos}</strong>
          </div>
          <div>
            <span>Suplementos em risco</span>
            <strong>{suplementosRiscoSemJustificativa.length}</strong>
          </div>
        </div>

        <label className="review-confirmation">
          <input
            type="checkbox"
            checked={revisaoFinalConfirmada}
            onChange={(event) => setRevisaoFinalConfirmada(event.target.checked)}
          />
          <span>
            Confirmo que revisei metas, refeições, fibras, suplementos e alertas clínicos antes da ativação.
          </span>
        </label>
      </section>

      <section className="prescricao-card">
        <h2 className="section-title">Totais prescritos</h2>
        <div className="totais-grid">
          {totaisCards.map((item) => {
            const totalClass = getTotalClass(item.value, item.meta);
            return (
              <article key={item.key} className={`total-item ${totalClass}`}>
                <div className="total-label">{item.label}</div>
                <div className="total-value">{formatValue(item.value, item.digits)}</div>
                <div className="total-meta">
                  Meta: {formatValue(item.meta, 0)} {item.unit}
                </div>
                {(() => {
                  const metaNum = toNumber(item.meta) || 0;
                  const pct = metaNum > 0 ? Math.min(((toNumber(item.value) || 0) / metaNum) * 100, 100) : 0;
                  return metaNum > 0 ? (
                    <div className="total-progress-bar">
                      <div className="total-progress-fill" style={{ width: `${pct}%` }} />
                    </div>
                  ) : null;
                })()}
              </article>
            );
          })}
        </div>
      </section>

      {saveStatus ? (
        <div className={`prescricao-plano__save-status ${saveStatus}`}>
          {saveStatus === 'saving' ? 'Salvando...' : saveStatus === 'saved' ? 'Salvo com sucesso' : 'Erro ao salvar'}
        </div>
      ) : null}
      {error && <div className="prescricao-plano__error">{error}</div>}
    </div>
  );
};

export default PrescricaoPlanoAlimentar;
