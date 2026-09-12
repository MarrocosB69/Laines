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
    <div className="mt-2 rounded-xl border border-stone-200 bg-white px-4 py-3">
      <p className="mb-2 text-sm text-stone-900">Análises do plano</p>

      <div className="grid grid-cols-3 gap-2 max-[560px]:grid-cols-1">
        {cartoes.map((c) => (
          <div key={c.rotulo} className="rounded bg-stone-100 px-3 py-2">
            <p className="text-xs text-stone-500">{c.rotulo}</p>
            <p className="text-base text-stone-900">
              {c.valor} {c.unidade && <span className="text-xs text-stone-400">{c.unidade}</span>}
            </p>
            <p className={`text-xs ${c.bom ? 'text-emerald-700' : 'text-stone-400'}`}>{c.nota}</p>
          </div>
        ))}
      </div>

      <div className="mt-3">
        <p className="mb-1.5 text-xs text-stone-500">
          Proteína por refeição
          {peso ? ' · g/kg' : ' · em grama (paciente sem peso cadastrado)'}
        </p>
        <ul className="flex items-end gap-1" style={{ height: '3rem' }}>
          {proteinaPorRefeicao.map((r) => {
            // Sem peso a barra usa a propria proteina como escala, para a
            // distribuicao continuar legivel mesmo sem g/kg.
            const base = peso ? (r.gkg ?? 0) / maxGkg : 0;
            const altura = Math.round(base * 44);
            const adequada = r.gkg !== null && r.gkg >= 0.3;
            return (
              <li
                key={r.id}
                className="flex-1 rounded-t"
                title={`${r.nome}: ${peso ? `${n(r.gkg, 2)} g/kg` : `${n(r.ptn)} g`}`}
                style={{
                  height: `${Math.max(altura, 2)}px`,
                  background: adequada ? '#5C9150' : 'rgba(29, 51, 80, 0.22)'
                }}
              />
            );
          })}
        </ul>
        {peso && (
          <p className="mt-1 text-xs text-stone-400">
            Verde a partir de 0,3 g/kg por refeição.
          </p>
        )}
      </div>
    </div>
  );
}
