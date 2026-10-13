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
    <div className="pp-cartao">
      <div className="pp-cartao__cabeca">
        <h3 className="pp-cartao__titulo">Lista de compras</h3>
        <span className="pp-cartao__contagem">
          {total} {total === 1 ? 'item' : 'itens'}
          {opcoes > 0 && ` · ${opcoes} como opção`}
        </span>
      </div>

      {total === 0 && <p className="pp-cartao__vazio">Sem alimentos no plano.</p>}

      {lista.map((categoria) => (
        <div key={categoria.categoria} className="pp-compras__categoria">
          <p className="pp-compras__titulo">{categoria.categoria}</p>
          <ul className="pp-compras__lista">
            {categoria.itens.map((item) => (
              <li
                key={item.id}
                className={`pp-compras__item${item.opcao ? ' pp-compras__item--opcao' : ''}`}
              >
                {item.nome}
                {/* Marcado, e nao omitido: quem for trocar precisa comprar. */}
                {item.opcao && <span className="pp-compras__marca">opção</span>}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
