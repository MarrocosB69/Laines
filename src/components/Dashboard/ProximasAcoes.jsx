import React, { useId } from 'react';
import {
  AlertCircle,
  CalendarDays,
  CheckCircle,
  ClipboardList,
  RefreshCw
} from 'lucide-react';
import './ProximasAcoes.css';

const TYPE_CONFIG = {
  avaliacao: {
    icon: ClipboardList,
    className: 'proximas-acoes-type-avaliacao'
  },
  consulta: {
    icon: CalendarDays,
    className: 'proximas-acoes-type-consulta'
  },
  retorno: {
    icon: RefreshCw,
    className: 'proximas-acoes-type-retorno'
  },
  pendencia: {
    icon: AlertCircle,
    className: 'proximas-acoes-type-pendencia'
  }
};

const visibleLimit = 8;

const ProximasAcoes = ({ items = [], loading = false, titulo = 'Próximas ações' }) => {
  const titleId = useId();
  const visibleItems = items.slice(0, visibleLimit);
  const remainingCount = Math.max(items.length - visibleLimit, 0);

  return (
    <section className="proximas-acoes" aria-labelledby={titleId}>
      <header className="proximas-acoes-header">
        <h2 id={titleId}>{titulo}</h2>
      </header>

      {loading && (
        <div className="proximas-acoes-loading" aria-label="Carregando próximas ações">
          <span className="proximas-acoes-skeleton" />
          <span className="proximas-acoes-skeleton" />
          <span className="proximas-acoes-skeleton" />
        </div>
      )}

      {!loading && visibleItems.length === 0 && (
        <div className="proximas-acoes-empty">
          <CheckCircle size={20} />
          <div>
            <strong>Tudo em dia</strong>
            <span>Nenhuma pendência no momento.</span>
          </div>
        </div>
      )}

      {!loading && visibleItems.length > 0 && (
        <>
          <ul className="proximas-acoes-list">
            {visibleItems.map((item) => {
              const config = TYPE_CONFIG[item.tipo] || TYPE_CONFIG.pendencia;
              const Icon = config.icon;

              return (
                <li key={item.id}>
                  <button type="button" className="proximas-acoes-item" onClick={item.onClick}>
                    <span className={`proximas-acoes-icon ${config.className}`}>
                      <Icon size={18} />
                    </span>
                    <span className="proximas-acoes-text">
                      <span className="proximas-acoes-label">{item.label}</span>
                      <strong>{item.pacienteNome}</strong>
                      {item.detalhe && <small>{item.detalhe}</small>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {remainingCount > 0 && (
            <footer className="proximas-acoes-footer">
              Ver mais {remainingCount} pendências
            </footer>
          )}
        </>
      )}
    </section>
  );
};

export default ProximasAcoes;
