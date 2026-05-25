import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, CheckCircle2, Circle } from 'lucide-react';
import { FeedbackState } from '../ui';
import { EVALUATION_REGISTRY_BY_TYPE } from '../../constants/evaluationRegistry';
import api from '../../services/api';

// Mirrors PENDENCIAS_OBRIGATORIAS in avaliacoes.service.ts — backend is source of truth.
const OBRIGATORIOS = ['anamnese_inicial', 'perimetros', 'avaliacao_clinica'];

const toDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value?.toDate === 'function') return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const computeLocalPendencias = (avaliacoes = [], agendamentos = [], paciente = {}) => {
  if (!paciente?.id) return [];
  const pendencias = [];

  const tiposRealizados = new Set(avaliacoes.map((item) => String(item.tipo || '').trim().toLowerCase()));
  OBRIGATORIOS.forEach((tipo) => {
    if (!tiposRealizados.has(tipo)) {
      pendencias.push({
        id: `missing-${tipo}`,
        tipo: 'avaliacao_ausente',
        severidade: 'alta',
        itemTipo: tipo,
        mensagem: `${EVALUATION_REGISTRY_BY_TYPE[tipo]?.label || tipo} não registrada`,
        acao: { label: 'Iniciar' }
      });
    }
  });

  avaliacoes
    .filter((item) => {
      const completude = Number(item?.meta?.completude);
      return Number.isFinite(completude) && completude < 80;
    })
    .forEach((item) => {
      const completude = Math.round(Number(item.meta.completude));
      pendencias.push({
        id: `incomplete-${item.id}`,
        tipo: 'avaliacao_incompleta',
        severidade: 'media',
        itemTipo: item.tipo,
        mensagem: `${EVALUATION_REGISTRY_BY_TYPE[item.tipo]?.label || item.tipo} incompleta (${completude}%)`,
        acao: { label: 'Completar' }
      });
    });

  const temFutura = agendamentos.some((ag) => {
    const date = toDate(ag.scheduledAt || ag.date);
    return date && date > new Date() && String(ag.status || '').toLowerCase() !== 'cancelado';
  });
  if (!temFutura) {
    pendencias.push({
      id: 'no-future-appointment',
      tipo: 'sem_consulta',
      severidade: 'baixa',
      itemTipo: '',
      mensagem: 'Nenhuma consulta futura agendada',
      acao: { label: 'Agendar' }
    });
  }

  return pendencias;
};

const ProntuarioPendencias = ({
  avaliacoes = [],
  agendamentos = [],
  paciente = {},
  onOpenEvaluationType,
  onOpenAppointment
}) => {
  const [remotePendencias, setRemotePendencias] = useState(null);

  useEffect(() => {
    if (!paciente?.id) {
      setRemotePendencias(null);
      return;
    }
    let cancelled = false;
    api.get(`/avaliacoes/pendencias/${paciente.id}`)
      .then((res) => {
        if (!cancelled) setRemotePendencias(Array.isArray(res.data) ? res.data : null);
      })
      .catch(() => {
        if (!cancelled) setRemotePendencias(null);
      });
    return () => { cancelled = true; };
  }, [paciente?.id]);

  const localPendencias = useMemo(
    () => computeLocalPendencias(avaliacoes, agendamentos, paciente),
    [agendamentos, avaliacoes, paciente]
  );

  // Backend is source of truth for eval pendencias; local computation is the fallback.
  // Appointment check always comes from local (backend doesn't track agendamentos here).
  const pendencias = useMemo(() => {
    const appointmentPendencia = localPendencias.find((p) => p.tipo === 'sem_consulta');
    if (remotePendencias !== null) {
      return appointmentPendencia
        ? [...remotePendencias, appointmentPendencia]
        : remotePendencias;
    }
    return localPendencias;
  }, [localPendencias, remotePendencias]);

  const handleAction = (item) => {
    if (item.tipo === 'sem_consulta') {
      onOpenAppointment?.();
      return;
    }
    if (item.itemTipo) {
      onOpenEvaluationType?.(item.itemTipo);
    }
  };

  return (
    <section className="pron-card pron-panel">
      <header className="pron-panel-header">
        <div>
          <h2>Pendências do prontuário</h2>
          <p>{pendencias.length} pendência(s) identificada(s).</p>
        </div>
      </header>

      {pendencias.length === 0 ? (
        <FeedbackState empty icon={CheckCircle2} size="sm" title="Sem pendências críticas no prontuário." />
      ) : (
        <div className="pron-pendencias-list">
          {pendencias.map((item) => (
            <article key={item.id} className={`pron-pendencia-item severity-${item.severidade}`}>
              <div className="pron-title-inline">
                {item.severidade === 'alta'
                  ? <AlertTriangle size={15} />
                  : item.severidade === 'media'
                    ? <Circle size={15} />
                    : <CalendarClock size={15} />}
                <span>{item.mensagem}</span>
              </div>
              <button type="button" className="pron-link-btn" onClick={() => handleAction(item)}>
                {item.acao?.label || 'Abrir'}
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};

export default ProntuarioPendencias;
