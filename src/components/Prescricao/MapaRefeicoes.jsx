import React from 'react';
import { n } from './formato.js';

/** Atalhos de leitura; os cálculos e a ordem chegam prontos da página. */
export default function MapaRefeicoes({ refeicoes, totaisPorId, itensPorRefeicao, horarioDeRefeicao, onIr }) {
  return (
    <nav className="pp-mapa" aria-label="Mapa das refeições">
      <div className="pp-mapa__cabeca">
        <h3 className="pp-mapa__titulo">Roteiro do dia</h3>
        <span className="pp-mapa__apoio">Escolha uma refeição para editar</span>
      </div>
      <div className="pp-mapa__lista">
        {refeicoes.map((refeicao) => {
          const totais = totaisPorId[refeicao.id];
          const itens = itensPorRefeicao[refeicao.id] || [];
          const semEnergia = itens.length > 0 && itens.every((item) => item.comp?.kcal == null);
          const energiaParcial = itens.some((item) => item.comp?.kcal == null);
          return (
            <button
              key={refeicao.id}
              type="button"
              onClick={() => onIr(refeicao.id)}
              aria-controls={`pp-refeicao-${refeicao.id}`}
              aria-expanded={Boolean(refeicao.aberta)}
              className={`pp-mapa__item${refeicao.aberta ? ' pp-mapa__item--aberto' : ''}`}
            >
              <span className="pp-mapa__linha">
                <strong>{refeicao.nome}</strong>
                <span>{horarioDeRefeicao(refeicao) || 'Sem horário'}</span>
              </span>
              <span className="pp-mapa__linha pp-mapa__linha--dados">
                <span>{itens.length} {itens.length === 1 ? 'alimento' : 'alimentos'}</span>
                <span>{semEnergia ? '—' : n(totais?.kcal)} kcal{energiaParcial && !semEnergia ? ' · subtotal' : ''}</span>
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
