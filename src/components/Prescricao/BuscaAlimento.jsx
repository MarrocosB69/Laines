import React, { useState } from 'react';
import Selo from './Selo.jsx';
import { n } from './formato.js';
import { nomeParaExibicao } from '../../core/prescricao/nomeAlimento.js';

/**
 * Apresentacional: não busca nada por conta própria.
 *
 * O container consulta a API e devolve os resultados já adaptados ao formato
 * do núcleo. Aqui só há digitação, lista e escolha.
 *
 * O painel mostra a composição de uma medida de cada candidato — sem isso a
 * escolha vira adivinhação e o profissional precisa adicionar para descobrir.
 */
const medidasValidas = (alimento) => (alimento.medidas ?? [])
  .map((medida, indice) => ({ ...medida, gramas: Number(medida.gramas), indice }))
  .filter((medida) => Number.isFinite(Number(medida.gramas)) && Number(medida.gramas) > 0);

const formatarGramas = (valor) => valor.toLocaleString('pt-BR', { maximumFractionDigits: 6 });

export default function BuscaAlimento({
  id = 'busca-alimento',
  modo = 'principal',
  termo,
  resultados,
  carregando,
  erro,
  onTermo,
  onEscolher,
  onFechar
}) {
  const [selecionado, setSelecionado] = useState(null);
  const [quantidade, setQuantidade] = useState('');
  const [medidaIdx, setMedidaIdx] = useState(0);
  const medidas = selecionado ? medidasValidas(selecionado) : [];
  const medida = medidas.find((opcao) => opcao.indice === medidaIdx);
  const numero = Number(quantidade);
  const gramas = numero * Number(medida?.gramas);
  const emGramas = !medida?.descricao && medida?.gramas === 1;
  const quantidadeValida = quantidade !== '' && Number.isFinite(numero) && numero > 0
    && Number.isFinite(gramas) && gramas > 0;

  /** A lista usa uma referência de comparação; a escolha vem depois. */
  const porMedida = (a, chave) => {
    const valor = a.comp?.[chave];
    const primeira = medidasValidas(a)[0];
    if (valor === null || valor === undefined || !primeira) return null;
    // Sem medida caseira, a composição da tabela representa 100 g.
    return !primeira.descricao && primeira.gramas === 1
      ? valor : (valor * primeira.gramas) / 100;
  };

  const rotuloMedida = (a) => {
    const m = medidasValidas(a)[0];
    if (!m) return 'sem medida válida';
    return m.descricao
      ? `1 ${m.descricao} · ${formatarGramas(m.gramas)} g`
      : `${formatarGramas(m.gramas === 1 ? 100 : m.gramas)} g (referência)`;
  };

  return (
    <div className="pp-busca">
      <div className="pp-busca__topo">
        <input
          autoFocus
          type="text"
          id={id}
          value={termo}
          onChange={(e) => {
            setSelecionado(null);
            onTermo(e.target.value);
          }}
          onKeyDown={(e) => e.key === 'Escape' && onFechar()}
          placeholder="Buscar por nome ou código — acento é opcional"
          aria-label="Buscar alimento"
          className="pp-controle pp-busca__campo"
        />
        <button type="button" onClick={onFechar} className="pp-botao pp-botao--secundario pp-busca__fechar">
          fechar
        </button>
      </div>

      {carregando && <p role="status" className="pp-busca__aviso">Buscando…</p>}
      {erro && <p role="alert" className="pp-busca__aviso pp-busca__aviso--erro">{erro}</p>}

      {!carregando && !erro && termo.trim().length >= 2 && resultados.length === 0 && (
        <p role="status" className="pp-busca__aviso">Nenhum alimento encontrado.</p>
      )}

      {selecionado && modo === 'principal' && (
        <form
          className="pp-busca__escolha"
          onSubmit={(e) => {
            e.preventDefault();
            if (quantidadeValida) onEscolher(selecionado, numero, medidaIdx);
          }}
        >
          <p className="pp-busca__escolha-titulo">{selecionado.nomeExibicao || nomeParaExibicao(selecionado)}</p>
          <div className="pp-campo">
            <label className="pp-rotulo" htmlFor={`${id}-quantidade`}>
              {emGramas ? 'Quantidade em gramas' : 'Quantidade de medidas'}
            </label>
            <input
              autoFocus
              id={`${id}-quantidade`}
              type="number"
              min="0"
              step="any"
              required
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              className="pp-controle pp-busca__quantidade"
            />
          </div>
          {medidas.length > 1 ? (
            <div className="pp-campo">
              <label className="pp-rotulo" htmlFor={`${id}-medida`}>Medida</label>
              <select
                id={`${id}-medida`}
                value={medidaIdx}
                onChange={(e) => setMedidaIdx(Number(e.target.value))}
                className="pp-controle pp-busca__medida"
              >
                {medidas.map((opcao) => (
                  <option key={opcao.indice} value={opcao.indice}>
                    {opcao.descricao || (opcao.gramas === 1 ? 'grama' : 'medida')} · {formatarGramas(opcao.gramas)} g
                  </option>
                ))}
              </select>
            </div>
          ) : medida?.descricao && (
            <p className="pp-busca__medida-fixa">1 {medida.descricao} = {formatarGramas(medida.gramas)} g</p>
          )}
          <p className="pp-busca__gramas" role="status">
            {quantidadeValida
              ? `Total: ${formatarGramas(gramas)} g`
              : 'Informe uma quantidade positiva para incluir o alimento.'}
          </p>
          <div className="pp-busca__escolha-acoes">
            <button type="submit" disabled={!quantidadeValida} className="pp-botao pp-botao--primario">
              Adicionar à refeição
            </button>
            <button type="button" onClick={() => setSelecionado(null)} className="pp-botao pp-botao--secundario">
              Voltar aos resultados
            </button>
          </div>
        </form>
      )}

      {!selecionado && resultados.length > 0 && (
        /* Lista, nao tabela: isto e um seletor, e a linha inteira e um
           botao. Como <table display:block> nao restringe a largura da
           linha ao painel, as colunas da direita vazavam para fora. */
        <div className="pp-busca__resultados">
          <p className="pp-busca__contexto">
            {modo === 'substituto'
              ? 'Composição para comparação. A quantidade do substituto será definida após a escolha.'
              : 'Escolha um alimento para informar a quantidade antes de incluir.'}
          </p>
          <div className="pp-busca__lista" role="group" aria-label="Resultados de alimentos">
          <div className="pp-busca__cabecalho" aria-hidden="true">
            <span className="pp-busca__col-nome">Alimento</span>
            <span className="pp-busca__col-medida">Referência</span>
            <span className="pp-busca__col-num">kcal</span>
            <span className="pp-busca__col-num">C</span>
            <span className="pp-busca__col-num">P</span>
            <span className="pp-busca__col-num">L</span>
          </div>
          {resultados.map((a) => (
            <button
              key={a.id}
              type="button"
              disabled={medidasValidas(a).length === 0}
              onClick={() => {
                if (modo === 'substituto') {
                  onEscolher(a, null, medidasValidas(a)[0].indice);
                  return;
                }
                setSelecionado(a);
                setQuantidade('');
                setMedidaIdx(medidasValidas(a)[0].indice);
              }}
              aria-label={`${medidasValidas(a).length ? 'Escolher' : 'Indisponível sem medida válida'} ${a.nomeExibicao || nomeParaExibicao(a)}`}
              className="pp-busca__linha"
            >
              <span className="pp-busca__col-nome" title={a.nome}>
                {a.nomeExibicao || nomeParaExibicao(a)}
                <Selo fonte={a.fonte} />
                {a.codigoFonte && <span className="pp-busca__codigo">{a.codigoFonte}</span>}
              </span>
              <span className="pp-busca__col-medida">{rotuloMedida(a)}</span>
              {/* data-rotulo: no painel estreito o cabecalho some e cada
                  numero mostra o proprio rotulo (so visual; ver o CSS). */}
              <span className="pp-busca__col-num pp-busca__col-num--forte" data-rotulo="kcal">
                {n(porMedida(a, 'kcal'))}
              </span>
              <span className="pp-busca__col-num" data-rotulo="C">{n(porMedida(a, 'cho'))}</span>
              <span className="pp-busca__col-num" data-rotulo="P">{n(porMedida(a, 'ptn'))}</span>
              <span className="pp-busca__col-num" data-rotulo="L">{n(porMedida(a, 'lip'))}</span>
            </button>
          ))}
          </div>
        </div>
      )}

    </div>
  );
}
