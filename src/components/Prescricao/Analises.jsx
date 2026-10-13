import React from 'react';
import { n } from './formato.js';

/**
 * Apresentacional: leituras do plano como conjunto, já calculadas.
 *
 * Não são nutrientes — são propriedades do plano inteiro que a tabela de
 * adequação não mostra: variedade, concentração de energia e a razão
 * sódio/potássio.
 */
export default function Analises({ analises, peso }) {
  const { alimentos, grupos, densidadeEnergetica, naK, proteinaPorRefeicao } = analises;

  const cartoes = [
    {
      rotulo: 'Variedade',
      valor: String(alimentos),
      unidade: alimentos === 1 ? 'alimento' : 'alimentos',
      nota: `${grupos} ${grupos === 1 ? 'grupo' : 'grupos'}`
    },
    {
      rotulo: 'Densidade energética',
      valor: n(densidadeEnergetica, 2),
      unidade: 'kcal/g',
      nota: ''
    },
    {
      rotulo: 'Sódio / potássio',
      valor: n(naK, 2),
      unidade: '',
      // A leitura só existe com os dois nutrientes; sem um deles é traço.
      nota: naK === null ? 'sem dado dos dois' : naK < 1 ? 'abaixo de 1,0' : 'acima de 1,0',
      bom: naK !== null && naK < 1
    }
  ];

  const maxGkg = Math.max(0.6, ...proteinaPorRefeicao.map((r) => r.gkg ?? 0));

  return (
    <div className="pp-cartao pp-analises">
      <h3 className="pp-cartao__titulo">Análises do plano</h3>

      <div className="pp-analises__cartoes">
        {cartoes.map((c) => (
          <div key={c.rotulo} className="pp-analises__cartao">
            <p className="pp-analises__rotulo">{c.rotulo}</p>
            <p className="pp-analises__valor">
              {c.valor} {c.unidade && <span className="pp-analises__unidade">{c.unidade}</span>}
            </p>
            <p className={`pp-analises__nota${c.bom ? ' pp-analises__nota--bom' : ''}`}>{c.nota}</p>
          </div>
        ))}
      </div>

      <div className="pp-analises__proteina">
        <p className="pp-analises__subtitulo">
          Proteína por refeição
          {peso ? ' · g/kg' : ' · em grama (paciente sem peso cadastrado)'}
        </p>
        <ul className="pp-analises__barras" style={{ height: '3rem' }}>
          {proteinaPorRefeicao.map((r) => {
            // Sem peso a barra usa a propria proteina como escala, para a
            // distribuicao continuar legivel mesmo sem g/kg.
            const base = peso ? (r.gkg ?? 0) / maxGkg : 0;
            const altura = Math.round(base * 44);
            const adequada = r.gkg !== null && r.gkg >= 0.3;
            // O valor de cada barra antes so existia no `title`, que o leitor
            // de tela nao garante ler; o mesmo texto vai tambem para dentro.
            const legenda = `${r.nome}: ${peso ? `${n(r.gkg, 2)} g/kg` : `${n(r.ptn)} g`}`;
            return (
              <li
                key={r.id}
                className="pp-analises__barra"
                title={legenda}
                style={{
                  height: `${Math.max(altura, 2)}px`,
                  background: adequada ? 'var(--lt-color-brand-green)' : 'var(--pp-raia)'
                }}
              >
                <span className="pp-sr">{legenda}</span>
              </li>
            );
          })}
        </ul>
        {peso && (
          <p className="pp-analises__legenda">
            Verde a partir de 0,3 g/kg por refeição.
          </p>
        )}
      </div>
    </div>
  );
}
