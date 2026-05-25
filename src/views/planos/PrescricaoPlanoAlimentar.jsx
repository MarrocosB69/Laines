import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, PlusCircle, Save, ArrowLeft } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { usePacientes } from '../../contexts/PacienteContext';
import api, { getApiErrorMessage } from '../../services/api';
import RefeicaoBuilder from '../../components/RefeicaoBuilder';
import SuplementoCard from '../../components/SuplementoCard';
import './PrescricaoPlanoAlimentar.css';

const EMPTY_REFEICAO = (index = 1) => ({
  id: `refeicao-${Date.now()}-${index}`,
  nome: `Refeicao ${index}`,
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
    lip: 0
  }
});

const EMPTY_SUPLEMENTO = () => ({
  nome: '',
  dose: '',
  horario: '',
  marca: '',
  loteVerificado: '',
  statusWADA: 'risco'
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
    return acc;
  }, { calorias: 0, cho: 0, ptn: 0, lip: 0 });

  return {
    calorias: Number(total.calorias.toFixed(2)),
    cho: Number(total.cho.toFixed(2)),
    ptn: Number(total.ptn.toFixed(2)),
    lip: Number(total.lip.toFixed(2))
  };
};

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

  const metaCaloricaNum = toNumber(metaCalorica) || 0;
  const metaCaloricaPorRefeicao = useMemo(() => {
    if (!metaCaloricaNum || metaCaloricaNum <= 0) return 0;
    const divisor = Math.max(refeicoes.length, 1);
    return Number((metaCaloricaNum / divisor).toFixed(2));
  }, [metaCaloricaNum, refeicoes.length]);

  const totais = useMemo(() => sumTotais(refeicoes), [refeicoes]);
  const statusLabel = useMemo(() => {
    if (status === 'ativo') return 'Ativo';
    if (status === 'encerrado') return 'Encerrado';
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
      prescrito: 0,
      color: '#0F6E56',
      digits: 0
    }
  ]), [metasGet?.calorias, metasGet?.cho, metasGet?.fibras, metasGet?.lip, metasGet?.ptn, totais.calorias, totais.cho, totais.lip, totais.ptn]);

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
    }
  ]), [metasGet?.calorias, metasGet?.cho, metasGet?.lip, metasGet?.ptn, totais.calorias, totais.cho, totais.lip, totais.ptn]);

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
        setError(getApiErrorMessage(requestError, 'Nao foi possivel carregar o contexto do plano alimentar.'));
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
    setSuplementos((prev) => prev.filter((_, idx) => idx !== index));
  };

  const buildPayload = () => ({
    pacienteId,
    alunoId: null,
    projetoId: patient?.projetoId || null,
    status,
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
      orientacoesGerais
    },
    resultados: {
      totaisCalculados: totais
    }
  });

  const handleSave = async () => {
    if (!pacienteId) return;
    setError('');

    if (status === 'ativo' && !metasGet?.avaliacaoId) {
      setError('Configure o Gasto Energético Total antes de ativar o plano');
      return;
    }

    setSaveStatus('saving');
    try {
      const payload = buildPayload();
      if (planId) {
        const { data } = await api.patch(`/planos-alimentares/${planId}`, payload);
        setPlanId(data?.id || planId);
      } else {
        const { data } = await api.post('/planos-alimentares', payload);
        setPlanId(data?.id || '');
      }
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(null), 2500);
    } catch (requestError) {
      setSaveStatus('error');
      setError(getApiErrorMessage(requestError, 'Nao foi possivel salvar o plano alimentar.'));
    }
  };

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
      setError(getApiErrorMessage(requestError, 'Nao foi possivel gerar o PDF do plano.'));
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
              disabled={!planId}
            >
              <Download size={14} /> PDF
            </button>
            <button type="button" className="btn-salvar" onClick={handleSave}>
              <Save size={14} /> Salvar plano
            </button>
          </div>
        </div>
      </header>

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
              <option value="ativo">Ativo</option>
              <option value="encerrado">Encerrado</option>
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
            <label htmlFor="plano-data-inicio">Data inicio</label>
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
            Versao competicion
          </label>
        </div>
      </section>

      <section className="prescricao-card prescricao-section">
        <div className="prescricao-section-header">
          <h2 className="section-title">Refeições</h2>
          <button type="button" className="btn-secondary" onClick={addRefeicao}>
            <PlusCircle size={16} /> Adicionar refeicao
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
          placeholder="Observacoes para o paciente, timing de refeicoes e condutas complementares."
        />
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

