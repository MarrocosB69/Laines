import React from 'react';
import Selo from './Selo.jsx';
import { n } from './formato.js';

/**
 * Apresentacional: não busca nada por conta própria.
 *
 * O container consulta a API e devolve os resultados já adaptados ao formato
 * do núcleo. Aqui só há digitação, lista e escolha.
 *
 * O painel mostra a composição de uma medida de cada candidato — sem isso a
 * escolha vira adivinhação e o profissional precisa adicionar para descobrir.
 */
export default function BuscaAlimento({
  id = 'busca-alimento',
  termo,
  resultados,
  carregando,
  erro,
  onTermo,
  onEscolher,
  onFechar
}) {
  /** Composição da primeira medida do alimento, que é o que sera adicionado. */
  const porMedida = (a, chave) => {
    const valor = a.comp?.[chave];
    const gramas = a.medidas?.[0]?.gramas ?? 1;
    if (valor === null || valor === undefined) return null;
    // Medida em grama unitaria: a linha representa 100 g, a referencia da tabela.
    return gramas === 1 ? valor : (valor * gramas) / 100;
  };

  const rotuloMedida = (a) => {
    const m = a.medidas?.[0];
    if (!m) return '—';
    return m.descricao ? `1 ${m.descricao} · ${n(m.gramas)} g` : '100 g';
  };

  return (
    <div className="pp-busca">
      <div className="pp-busca__topo">
        <input
          autoFocus
          type="text"
          id={id}
          value={termo}
          onChange={(e) => onTermo(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && onFechar()}
          placeholder="Buscar alimento — acento é opcional"
          aria-label="Buscar alimento"
          className="pp-busca__campo"
        />
        <button type="button" onClick={onFechar} className="pp-busca__fechar">
          fechar
        </button>
      </div>

      {carregando && <p className="pp-busca__aviso">Buscando…</p>}
      {erro && <p className="pp-busca__aviso pp-busca__aviso--erro">{erro}</p>}

      {!carregando && !erro && termo.trim().length >= 2 && resultados.length === 0 && (
        <p className="pp-busca__aviso">Nenhum alimento encontrado.</p>
      )}

      {resultados.length > 0 && (
        /* Lista, nao tabela: isto e um seletor, e a linha inteira e um
           botao. Como <table display:block> nao restringe a largura da
           linha ao painel, as colunas da direita vazavam para fora. */
        <div className="pp-busca__lista" role="listbox" aria-label="Resultados">
          <div className="pp-busca__cabecalho" aria-hidden="true">
            <span className="pp-busca__col-nome">Alimento</span>
            <span className="pp-busca__col-medida">Medida</span>
            <span className="pp-busca__col-num">kcal</span>
            <span className="pp-busca__col-num">C</span>
            <span className="pp-busca__col-num">P</span>
            <span className="pp-busca__col-num">L</span>
          </div>
          {resultados.map((a) => (
            <button
              key={a.id}
              type="button"
              role="option"
              aria-selected="false"
              onClick={() => onEscolher(a, a.medidas?.[0]?.gramas === 1 ? 100 : 1)}
              className="pp-busca__linha"
            >
              <span className="pp-busca__col-nome">
                {a.nome}
                <Selo fonte={a.fonte} />
              </span>
              <span className="pp-busca__col-medida">{rotuloMedida(a)}</span>
              <span className="pp-busca__col-num pp-busca__col-num--forte">
                {n(porMedida(a, 'kcal'))}
              </span>
              <span className="pp-busca__col-num">{n(porMedida(a, 'cho'))}</span>
              <span className="pp-busca__col-num">{n(porMedida(a, 'ptn'))}</span>
              <span className="pp-busca__col-num">{n(porMedida(a, 'lip'))}</span>
            </button>
          ))}
        </div>
      )}

    </div>
  );
}
