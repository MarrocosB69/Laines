import React, { useState, useCallback } from 'react';
import { X, ChevronDown, ChevronUp } from 'lucide-react';

const ALERTA_CFG = {
  reds_estabelecido: {
    cor: 'vermelho',
    emoji: '🚨',
    titulo: 'RED-S Estabelecido',
    dismissivel: false,
  },
  reds_risco: {
    cor: 'laranja',
    emoji: '⚠️',
    titulo: 'Risco de RED-S',
    dismissivel: true,
    storageKey: 'laines_al_reds_risco',
  },
  vitd_baixa_atleta: {
    cor: 'laranja',
    emoji: '🔆',
    titulo: 'Vitamina D baixa',
    dismissivel: true,
    storageKey: 'laines_al_vitd',
  },
  ferritina_baixa_atleta: {
    cor: 'laranja',
    emoji: '🩸',
    titulo: 'Ferritina baixa',
    dismissivel: true,
    storageKey: 'laines_al_ferritina',
  },
  acwr_risco: {
    cor: 'laranja',
    emoji: '📊',
    titulo: 'Carga de treino elevada (ACWR)',
    dismissivel: true,
    storageKey: 'laines_al_acwr',
  },
};

const MAX_VISIVEIS = 3;

const isDismissedLocally = (storageKey, pacienteId) => {
  if (!storageKey || !pacienteId) return false;
  try {
    return localStorage.getItem(`${storageKey}_${pacienteId}`) === '1';
  } catch {
    return false;
  }
};

const saveDismiss = (storageKey, pacienteId) => {
  if (!storageKey || !pacienteId) return;
  try {
    localStorage.setItem(`${storageKey}_${pacienteId}`, '1');
  } catch {
    /* ignore */
  }
};

/**
 * AlertaBanner — exibe stack de alertas clínicos.
 *
 * @param {{ alertas: Array<{tipo: string, mensagem?: string}>, pacienteId: string }} props
 */
const AlertaBanner = ({ alertas = [], pacienteId }) => {
  const [dismissedIds, setDismissedIds] = useState(() => {
    const set = new Set();
    alertas.forEach((al) => {
      const cfg = ALERTA_CFG[al.tipo];
      if (cfg?.dismissivel && isDismissedLocally(cfg.storageKey, pacienteId)) {
        set.add(al.tipo);
      }
    });
    return set;
  });
  const [expandido, setExpandido] = useState(false);

  const handleDismiss = useCallback(
    (tipo) => {
      const cfg = ALERTA_CFG[tipo];
      if (!cfg?.dismissivel) return;
      saveDismiss(cfg.storageKey, pacienteId);
      setDismissedIds((prev) => new Set([...prev, tipo]));
    },
    [pacienteId]
  );

  const visiveis = alertas.filter((al) => !dismissedIds.has(al.tipo));
  if (visiveis.length === 0) return null;

  const exibidos = expandido ? visiveis : visiveis.slice(0, MAX_VISIVEIS);
  const ocultos = visiveis.length - MAX_VISIVEIS;

  return (
    <div className="alerta-stack" role="alert" aria-live="polite">
      {exibidos.map((al) => {
        const cfg = ALERTA_CFG[al.tipo] || {};
        return (
          <div
            key={al.tipo}
            className={`alerta-banner alerta-banner--${cfg.cor || 'laranja'}`}
          >
            <span className="alerta-banner__emoji" aria-hidden="true">
              {cfg.emoji || '⚠️'}
            </span>
            <div className="alerta-banner__body">
              <strong className="alerta-banner__titulo">{cfg.titulo || al.tipo}</strong>
              {al.mensagem && (
                <span className="alerta-banner__msg">{al.mensagem}</span>
              )}
            </div>
            {cfg.dismissivel && (
              <button
                type="button"
                className="alerta-banner__dismiss"
                onClick={() => handleDismiss(al.tipo)}
                aria-label={`Dispensar alerta: ${cfg.titulo}`}
              >
                <X size={13} />
              </button>
            )}
          </div>
        );
      })}

      {!expandido && ocultos > 0 && (
        <button
          type="button"
          className="alerta-ver-mais"
          onClick={() => setExpandido(true)}
        >
          <ChevronDown size={13} />
          Ver mais {ocultos} alerta{ocultos !== 1 ? 's' : ''}
        </button>
      )}
      {expandido && visiveis.length > MAX_VISIVEIS && (
        <button
          type="button"
          className="alerta-ver-mais"
          onClick={() => setExpandido(false)}
        >
          <ChevronUp size={13} />
          Recolher alertas
        </button>
      )}
    </div>
  );
};

export default AlertaBanner;
