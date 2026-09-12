import React from 'react';
import { n } from './formato.js';

/**
 * Apresentacional: a situação chega decidida pelo núcleo.
 *
 * A inversão do sódio (passar de 100% é excesso, não conquista) vive em
 * `situacaoAdequacao`; aqui cada situação só vira um tom. A cor nunca carrega
 * sozinha o significado — o valor e o percentual estão sempre na linha.
 */
const COR_SITUACAO = {
  'sem-dado': '#D6D3D1',
  ok: '#059669',
  atencao: '#D97706',
  insuficiente: '#DC2626',
  excedido: '#DC2626'
};

export default function LinhaAdequacao({ linha }) {
  const { percentual, direcao, cobertura: cob, situacao } = linha;
  const largura = percentual === null ? 0 : Math.min(percentual, 100);
  const cor = COR_SITUACAO[situacao] ?? COR_SITUACAO['sem-dado'];

  return (
    <tr className="border-b border-stone-200 text-xs">
      <th scope="row" className="py-1 pr-2 text-left font-normal text-stone-700">
        {linha.rotulo}
        {direcao === 'limite' && <span className="ml-1 text-stone-400">limite</span>}
      </th>
      <td className="py-1 pr-2 whitespace-nowrap text-right text-stone-800">
        {n(linha.valor, linha.valor !== null && linha.valor < 20 ? 1 : 0)} {linha.unidade}
      </td>
      <td className="py-1 pr-2 whitespace-nowrap text-right text-stone-500">
        {n(linha.referencia, linha.referencia < 20 ? 1 : 0)}
        {linha.tipo !== 'meta' && <span className="ml-1 text-stone-400">{linha.tipo}</span>}
      </td>
      <td className="w-16 py-1 pl-2">
        <span className="block h-1 rounded-sm bg-stone-200">
          <span className="adequacao-barra block h-1" style={{ width: `${largura}%`, background: cor }} />
        </span>
      </td>
      <td className="w-14 py-1 whitespace-nowrap text-right text-stone-400">
        {cob < 1 ? `${Math.round(cob * 100)}%` : ''}
      </td>
    </tr>
  );
}
