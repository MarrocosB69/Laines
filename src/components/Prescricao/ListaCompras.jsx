import React from 'react';

/**
 * Apresentacional: a lista já chega agrupada e ordenada.
 *
 * Sem quantidade de propósito — o paciente compra o pacote, não as gramas do
 * plano, e número aqui passa uma precisão que a compra não tem.
 */
export default function ListaCompras({ lista }) {
  const total = lista.reduce((acc, c) => acc + c.itens.length, 0);
  const opcoes = lista.reduce((acc, c) => acc + c.itens.filter((i) => i.opcao).length, 0);

  return (
    <div className="rounded-xl border border-stone-200 bg-white px-4 py-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className="text-sm text-stone-900">Lista de compras</p>
        <span className="text-xs text-stone-400">
          {total} {total === 1 ? 'item' : 'itens'}
          {opcoes > 0 && ` · ${opcoes} como opção`}
        </span>
      </div>

      {total === 0 && <p className="text-xs text-stone-400">Sem alimentos no plano.</p>}

      {lista.map((categoria) => (
        <div key={categoria.categoria} className="mb-2">
          <p className="mb-1 text-xs text-stone-400">{categoria.categoria}</p>
          <ul>
            {categoria.itens.map((item) => (
              <li
                key={item.id}
                className={`border-t border-stone-200 py-0.5 text-xs ${item.opcao ? 'text-stone-400' : 'text-stone-700'}`}
              >
                {item.nome}
                {/* Marcado, e nao omitido: quem for trocar precisa comprar. */}
                {item.opcao && <span className="ml-1.5 text-stone-300">opção</span>}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
