import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Apple, Download, RefreshCw } from 'lucide-react';
import api, { getApiErrorMessage } from '../../services/api';
import { FeedbackState } from '../../components/ui';
import './AthleteMealPlan.css';

const formatNumber = (value) => value === null || value === undefined || value === ''
  || !Number.isFinite(Number(value)) ? null : Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 2 });

const formatDate = (value) => {
  if (!value) return null;
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString('pt-BR');
};

function Portion({ food }) {
  if (food.quantidadePendente) return <span className="ap-meal-plan-portion">Quantidade não confirmada</span>;
  const grams = formatNumber(food.quantidadeGramas);
  const measures = formatNumber(food.quantidadeMedidas);
  return (
    <span className="ap-meal-plan-portion">
      {food.medidaCaseira && <span>{measures ? `${measures} × ` : ''}{food.medidaCaseira}</span>}
      {grams && <span>{grams} g</span>}
      {!food.medidaCaseira && !grams && <span>Porção não informada</span>}
    </span>
  );
}

function Meal({ meal }) {
  const foods = Array.isArray(meal.alimentos) ? meal.alimentos : [];
  const alternatives = Array.isArray(meal.substitutos) ? meal.substitutos : [];
  return (
    <article className="ap-meal-plan-meal">
      <div className="ap-meal-plan-meal-title">
        <h3>{meal.nome}</h3>
        {meal.horario && <span>{meal.horario}</span>}
      </div>
      {foods.length ? (
        <ul className="ap-meal-plan-foods">
          {foods.map((food, index) => (
            <li key={index}>
              <span>{food.descricao}</span>
              <Portion food={food} />
            </li>
          ))}
        </ul>
      ) : <p>Nenhum alimento registrado nesta refeição.</p>}
      {alternatives.length > 0 && (
        <details className="ap-meal-plan-alternatives">
          <summary>Substituições desta refeição ({alternatives.length})</summary>
          <ul>
            {alternatives.map((food, index) => (
              <li key={index}>
                <span>{food.substitui ? `Em lugar de ${food.substitui}: ` : 'Alternativa sem vínculo definido: '}
                  <strong>{food.descricao}</strong>
                </span>
                <Portion food={food} />
                {food.semEquivalenciaAutomatica && (
                  <small className="ap-meal-plan-alternative-note">
                    {food.quantidadePendente
                      ? 'Esta alternativa precisa de quantidade confirmada pela equipe.'
                      : 'Quantidade definida individualmente pela equipe; sem equivalência automática.'}
                  </small>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
      {meal.orientacoes && <p className="ap-meal-plan-instructions">{meal.orientacoes}</p>}
    </article>
  );
}

export default function AthleteMealPlan({ patientId }) {
  const [state, setState] = useState({ patientId, loading: true, plan: null, error: '' });
  const [downloading, setDownloading] = useState(false);
  const [downloadMessage, setDownloadMessage] = useState('');
  const request = useRef(null);
  const downloadRequest = useRef(null);

  const load = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setState({ patientId, loading: true, plan: null, error: '' });
    try {
      const { data } = await api.get('/planos-alimentares', {
        params: { pacienteId: patientId, status: 'ativo', limit: 2 }, signal: controller.signal
      });
      if (controller.signal.aborted) return;
      if (!Array.isArray(data)) throw new Error('Não foi possível conferir o plano recebido.');
      if (data.length > 1) throw new Error('Há mais de um plano publicado. Peça à equipe para confirmar qual está vigente.');
      const plan = data[0] || null;
      if (plan && (plan.status !== 'ativo' || plan.pacienteId !== patientId
        || !Number.isInteger(plan.entrega?.version) || !Array.isArray(plan.entrega?.refeicoes))) {
        throw new Error('O plano ainda não está disponível para consulta. Peça à equipe para conferir a publicação.');
      }
      setState({ patientId, loading: false, plan, error: '' });
    } catch (error) {
      if (!controller.signal.aborted) {
        setState({ patientId, loading: false, plan: null,
          error: error.isAxiosError ? getApiErrorMessage(error, 'Não foi possível carregar seu plano alimentar.') : error.message });
      }
    }
  }, [patientId]);

  useEffect(() => {
    void load();
    const refresh = () => { void load(); };
    window.addEventListener('focus', refresh);
    return () => {
      request.current?.abort();
      downloadRequest.current?.abort();
      window.removeEventListener('focus', refresh);
    };
  }, [load]);

  const plan = state.patientId === patientId ? state.plan : null;
  const loading = state.loading || state.patientId !== patientId;
  const review = plan?.dados?.revisaoFinal;
  const supplements = Array.isArray(plan?.dados?.suplementos) ? plan.dados.suplementos : [];

  const download = async () => {
    if (!plan || downloading) return;
    setDownloading(true);
    setDownloadMessage('');
    const controller = new AbortController();
    downloadRequest.current = controller;
    try {
      const { data } = await api.get(`/planos-alimentares/${plan.id}/pdf`, {
        params: { expectedVersion: plan.entrega.version }, responseType: 'blob', signal: controller.signal
      });
      if (controller.signal.aborted) return;
      if (data.type !== 'application/pdf') throw new Error('Resposta de PDF inválida.');
      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `plano-alimentar-v${plan.entrega.version}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      if (controller.signal.aborted) return;
      if ([403, 404, 409].includes(error.response?.status)) {
        setDownloadMessage('O plano foi atualizado ou deixou de estar disponível. Confira a versão atual antes de baixar novamente.');
        await load();
      } else {
        setDownloadMessage('Não foi possível baixar o PDF. Tente novamente.');
      }
    } finally {
      setDownloading(false);
    }
  };

  return (
    <section className="ap-card ap-meal-plan" aria-labelledby="athlete-meal-plan-title" aria-busy={loading}>
      <div className="ap-meal-plan-header">
        <div>
          <h2 id="athlete-meal-plan-title"><Apple size={20} aria-hidden="true" /> Meu plano alimentar</h2>
          {plan && <p>Plano vigente · Versão {plan.entrega.version}</p>}
        </div>
        <div className="ap-meal-plan-actions">
          <button type="button" className="ui-button ui-button-secondary ui-button-sm" onClick={load} disabled={loading || downloading}>
            <RefreshCw size={15} aria-hidden="true" /> Atualizar
          </button>
          {plan && <button type="button" className="ui-button ui-button-primary ui-button-sm" onClick={download} disabled={downloading}>
            <Download size={15} aria-hidden="true" /> {downloading ? 'Baixando…' : 'Baixar PDF'}
          </button>}
        </div>
      </div>
      {downloadMessage && <p role="status" className="ap-meal-plan-notice">{downloadMessage}</p>}
      {loading ? <FeedbackState loading skeletonLines={4} />
        : state.error ? <FeedbackState error title="Plano indisponível" description={state.error} onRetry={load} />
          : !plan ? <FeedbackState title="Nenhum plano alimentar publicado" description="Seu plano aparecerá aqui quando a equipe concluir a revisão e a publicação." />
            : <>
              <div className="ap-meal-plan-metadata">
                {formatDate(plan.dataInicio) && <span>Início: {formatDate(plan.dataInicio)}</span>}
                {formatDate(plan.dataFim) && <span>Até: {formatDate(plan.dataFim)}</span>}
                {review?.confirmadoPorNome && <span>Revisado por {review.confirmadoPorNome}{review.crn ? ` · CRN ${review.crn}` : ''}</span>}
                {formatDate(review?.confirmadoEm) && <span>Revisão: {formatDate(review.confirmadoEm)}</span>}
              </div>
              <div className="ap-meal-plan-meals">
                {plan.entrega.refeicoes.map((meal, index) => <Meal key={meal.id || index} meal={meal} />)}
              </div>
              {plan.dados?.orientacoesGerais && <div className="ap-meal-plan-guidance">
                <h3>Orientações da equipe</h3>
                <p className="ap-meal-plan-instructions">{plan.dados.orientacoesGerais}</p>
              </div>}
              {supplements.length > 0 && <div className="ap-meal-plan-guidance">
                <h3>Suplementação prescrita</h3>
                <ul className="ap-meal-plan-foods">
                  {supplements.map((item, index) => <li key={index}>
                    <span><strong>{item.nome}</strong>{item.marca ? ` · ${item.marca}` : ''}</span>
                    <span>{[item.dose, item.horario].filter(Boolean).join(' · ')}</span>
                  </li>)}
                </ul>
              </div>}
            </>}
    </section>
  );
}
