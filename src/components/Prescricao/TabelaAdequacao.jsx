import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import LinhaAdequacao from './LinhaAdequacao.jsx';

/**
 * Apresentacional. O estado aqui é só de dobra visual, não de cálculo.
 *
 * Micronutrientes ficam FORA do DOM enquanto fechados, não escondidos por
 * CSS: a lista tem oito linhas e ninguém navegando por teclado ou leitor de
 * tela deveria atravessá-las para chegar ao resto da página.
 */
export default function TabelaAdequacao({ macros, micros, contexto }) {
  const [microAberto, setMicroAberto] = useState(false);
  const referencias = contexto?.referencias;
  const origemMetas = contexto?.origemMetas;
  const restricoes = contexto?.restricoes;
  const origem = (registro) => registro
    ? `${registro.status} · ${String(registro.data || 'data não informada').slice(0, 10)} · ${registro.metodo || 'método não informado'} · ${registro.origem || 'origem não informada'}`
    : 'Nenhuma avaliação finalizada disponível';

  return (
    <div className="pp-cartao pp-adequacao">
      <div className="pp-cartao__cabeca">
        <h3 className="pp-cartao__titulo">Adequação nutricional</h3>
        <span className="pp-selo-dri">
          {referencias?.grupo ? `DRI · ${referencias.grupo}` : 'DRI indisponível para este paciente'}
        </span>
      </div>
      {/* Contexto de onde vêm metas e referências: leitura de apoio, em
          corpo menor e agrupada, antes da tabela que ela explica. */}
      <div className="pp-notas">
        <p className="pp-nota">Metas individuais: GET · {origem(origemMetas)}.</p>
        {referencias?.grupo && <p className="pp-nota">Fonte: {referencias.fonte}. Perfil conferido em {referencias.dataReferencia}.</p>}
        {referencias?.motivo && <p className="pp-nota pp-nota--forte">{referencias.motivo}</p>}
        <p className="pp-nota">RDA/AI são referências populacionais; atingir a referência não comprova adequação individual. Limite e meta individual têm interpretações distintas.</p>
        <p className="pp-nota">
          Restrições: {restricoes?.descricao || 'não informadas'} · {origem(restricoes?.origem)}
          {restricoes?.pendenteRevisao === false && (restricoes.semRestricao ? ' · conferidas: nenhuma se aplica' : ` · conferidas: ${(restricoes.grupos || []).length} grupo(s), ${(restricoes.alimentoIds || []).length} alimento(s)`)}.
        </p>
        {restricoes?.pendenteRevisao && <p role="status" className="pp-nota pp-nota--atencao">{restricoes.motivo}</p>}
        {referencias?.observacao && <p className="pp-nota">{referencias.observacao}</p>}
        {[...macros, ...micros].some((linha) => Number.isFinite(linha.cobertura) && linha.cobertura < 1) && (
          <p className="pp-nota">* Valor parcial: subtotal dos alimentos com composição disponível. A cobertura indica quanto do plano tem esse dado; — indica ausência de composição.</p>
        )}
      </div>

      <table className="pp-adequacao__tabela">
        <caption className="pp-sr">
          Adequação do plano frente às referências de ingestão
        </caption>
        <thead>
          <tr>
            <th scope="col" className="pp-adequacao__cab">Nutriente</th>
            <th scope="col" className="pp-adequacao__cab pp-adequacao__cab--num">Plano</th>
            <th scope="col" className="pp-adequacao__cab pp-adequacao__cab--num">Referência</th>
            <th scope="col" className="pp-adequacao__cab">
              <span className="pp-sr">Proporção</span>
            </th>
            <th scope="col" className="pp-adequacao__cab pp-adequacao__cab--num">Cobert.</th>
          </tr>
        </thead>
        <tbody>
          {macros.map((l) => <LinhaAdequacao key={l.nutriente} linha={l} />)}

          <tr className="pp-adequacao__dobra">
            <td colSpan={5}>
              <button
                type="button"
                onClick={() => setMicroAberto((v) => !v)}
                aria-expanded={microAberto}
                className="pp-botao pp-botao--dobra"
              >
                {microAberto
                  ? <ChevronDown className="pp-icone" aria-hidden="true" />
                  : <ChevronRight className="pp-icone" aria-hidden="true" />}
                Micronutrientes
              </button>
            </td>
          </tr>

          {microAberto && micros.map((l) => <LinhaAdequacao key={l.nutriente} linha={l} />)}
        </tbody>
      </table>
    </div>
  );
}
