import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ClipboardList, Undo2 } from 'lucide-react';
import { FeedbackState } from '../ui';
import Button from '../ui/Button';
import { getEvaluationTypeLabel } from '../shared/evaluationSummaryUtils';
import { getApiErrorMessage } from '../../services/api';
import { getFilaRevisao, aprovarItemFila, devolverItemFila } from '../../services/supervisao';
import { toDate } from '../../utils/dateUtils';
import { useUiFeedback } from '../../contexts/UiFeedbackContext';
import './FilaRevisao.css';

const MIN_OBSERVACAO = 5;

const formatElapsed = (value) => {
  const date = toDate(value);
  if (!date) return null;
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'agora mesmo';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `há ${days} ${days === 1 ? 'dia' : 'dias'}`;
  const months = Math.floor(days / 30);
  if (months < 12) return `há ${months} ${months === 1 ? 'mês' : 'meses'}`;
  const years = Math.floor(months / 12);
  return `há ${years} ${years === 1 ? 'ano' : 'anos'}`;
};

const getInstrumentLabel = (item) => (
  item.tipo === 'plano' ? 'Plano alimentar' : getEvaluationTypeLabel(item.tipoInstrumento)
);

/*
 * O item de avaliacao devolvido pelo servidor carrega `rota: /avaliacao/:id`
 * usando o id DA AVALIACAO — mas a rota real (App.jsx) le esse parametro
 * como id DO PACIENTE (AvaliacaoCompleta.jsx faz `id = pacienteId || params.id`
 * e usa para `getPacienteById(id)`). Navegar com o id da avaliacao abriria o
 * prontuario errado (ou nenhum). Por isso a rota e montada aqui a partir de
 * `pacienteId`, que a fila sempre traz, em vez de usar `item.rota` direto
 * para avaliacoes. Para planos o campo ja usa pacienteId e bate com a rota
 * real — mesmo assim a montagem fica uniforme, sem depender do servidor
 * para os dois casos.
 */
const buildItemPath = (item) => (
  item.tipo === 'plano' ? `/prescricao-plano/${item.pacienteId}` : `/avaliacao/${item.pacienteId}`
);

const FilaRevisaoItem = ({ item, onOpen, onAprovar, onDevolver, busyId }) => {
  const [showDevolverForm, setShowDevolverForm] = useState(false);
  const [observacao, setObservacao] = useState('');
  const isBusy = busyId === item.id;
  const observacaoValida = observacao.trim().length >= MIN_OBSERVACAO;

  return (
    <article className="sup-fila-item">
      <div className="sup-fila-item__info">
        <div className="sup-fila-item__head">
          <strong>{item.pacienteNome || 'Paciente não identificado'}</strong>
          <span className="sup-fila-item__tipo">{getInstrumentLabel(item)}</span>
        </div>
        <p className="sup-fila-item__meta">
          Enviado por {item.enviadoPorNome || 'Não informado'} · {formatElapsed(item.enfileiradoEm) || 'data não disponível'}
        </p>
        {item.observacaoEnvio ? (
          <p className="sup-fila-item__observacao">"{item.observacaoEnvio}"</p>
        ) : null}
      </div>

      {showDevolverForm ? (
        <div className="sup-fila-item__devolver-form">
          <label htmlFor={`sup-fila-obs-${item.id}`} className="sup-fila-item__devolver-label">
            O aluno vai ler esta orientação. Descreva o que precisa ser ajustado.
          </label>
          <textarea
            id={`sup-fila-obs-${item.id}`}
            className="sup-fila-textarea"
            rows="2"
            maxLength={1000}
            value={observacao}
            onChange={(event) => setObservacao(event.target.value)}
            placeholder="Mínimo de 5 caracteres..."
            disabled={isBusy}
          />
          <div className="sup-fila-item__actions">
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={!observacaoValida || isBusy}
              loading={isBusy}
              onClick={() => onDevolver(item, observacao.trim())}
            >
              Confirmar devolução
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isBusy}
              onClick={() => { setShowDevolverForm(false); setObservacao(''); }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <div className="sup-fila-item__actions">
          <Button type="button" variant="ghost" size="sm" onClick={() => onOpen(item)} disabled={isBusy}>
            Abrir
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            loading={isBusy}
            disabled={isBusy}
            onClick={() => onAprovar(item)}
          >
            <CheckCircle2 size={14} /> Aprovar
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={isBusy}
            onClick={() => setShowDevolverForm(true)}
          >
            <Undo2 size={14} /> Devolver
          </Button>
        </div>
      )}
    </article>
  );
};

/*
 * UPD-17 — fila de supervisao (UX-06): primeiro bloco da area do professor,
 * antes dos contadores gerais. Junta avaliacoes e planos aguardando revisao,
 * mais antigo primeiro, e permite aprovar/devolver sem abrir o registro.
 */
const FilaRevisao = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const navigate = useNavigate();
  const { notify } = useUiFeedback();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const fila = await getFilaRevisao();
      setItems(fila);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Não foi possível carregar a fila de revisão.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleOpen = useCallback((item) => {
    navigate(buildItemPath(item), {
      state: {
        returnTo: '/professor',
        returnView: 'dashboard',
        returnTab: 'patients'
      }
    });
  }, [navigate]);

  const handleAprovar = useCallback(async (item) => {
    setBusyId(item.id);
    try {
      await aprovarItemFila(item);
      setItems((prev) => prev.filter((entry) => entry.id !== item.id));
      notify({ type: 'success', title: 'Item aprovado', message: `${getInstrumentLabel(item)} de ${item.pacienteNome || 'paciente'} aprovado(a).` });
    } catch (err) {
      notify({ type: 'error', title: 'Erro ao aprovar', message: getApiErrorMessage(err, 'Não foi possível aprovar este item.') });
    } finally {
      setBusyId(null);
    }
  }, [notify]);

  const handleDevolver = useCallback(async (item, observacao) => {
    setBusyId(item.id);
    try {
      await devolverItemFila(item, observacao);
      setItems((prev) => prev.filter((entry) => entry.id !== item.id));
      notify({ type: 'success', title: 'Item devolvido', message: `${getInstrumentLabel(item)} de ${item.pacienteNome || 'paciente'} devolvido(a) com orientação.` });
    } catch (err) {
      notify({ type: 'error', title: 'Erro ao devolver', message: getApiErrorMessage(err, 'Não foi possível devolver este item.') });
    } finally {
      setBusyId(null);
    }
  }, [notify]);

  return (
    <section className="sup-fila">
      <header className="sup-fila__header">
        <div className="sup-fila__title">
          <ClipboardList size={17} />
          <div>
            <h2>Fila de revisão</h2>
            <p>Avaliações e planos alimentares enviados por alunos, aguardando sua decisão.</p>
          </div>
        </div>
        {!loading && !error && items.length > 0 && (
          <span className="sup-fila__count">{items.length} {items.length === 1 ? 'item' : 'itens'}</span>
        )}
      </header>

      {loading ? (
        <FeedbackState loading skeletonLines={3} />
      ) : error ? (
        <FeedbackState error title={error} onRetry={load} />
      ) : items.length === 0 ? (
        <FeedbackState
          empty
          size="sm"
          icon={CheckCircle2}
          title="Nenhum item aguardando sua revisão."
          description="A fila mostra avaliações e planos que alunos enviaram para revisão."
        />
      ) : (
        <div className="sup-fila__list">
          {items.map((item) => (
            <FilaRevisaoItem
              key={`${item.tipo}-${item.id}`}
              item={item}
              busyId={busyId}
              onOpen={handleOpen}
              onAprovar={handleAprovar}
              onDevolver={handleDevolver}
            />
          ))}
        </div>
      )}
    </section>
  );
};

export default FilaRevisao;
