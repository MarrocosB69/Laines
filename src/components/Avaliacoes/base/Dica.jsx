import { useId } from 'react';
import { useDica } from './useDica';
import './avaliacao-base.css';

/* Dica "?" dos formulários de avaliação. Antes, cada formulário tinha um
   `<span role="button">` de 24 px dentro do <label>, e o nome dele ("Abrir
   informação") entrava no nome acessível do campo. Aqui:
   - o "?" é um <button> de 44 px, fora do rótulo, com aria-expanded e
     aria-controls;
   - o texto fica num painel logo abaixo, escondido (`hidden`) até abrir;
   - aberto, o Campo liga o painel ao controle por aria-describedby;
   - Esc fecha. Contrato: docs/implementacao/avaliacoes-v2/contrato-avaliacao.md. */

export function BotaoDica({ dica }) {
  if (!dica.conteudo) return null;
  return (
    <button
      type="button"
      className="av-dica__botao"
      aria-label={dica.conteudo.rotulo}
      aria-expanded={dica.aberta}
      aria-controls={dica.painelId}
      onClick={dica.alternar}
      onKeyDown={dica.aoTeclarNoBotao}
    >
      <span className="av-dica__marca" aria-hidden="true">?</span>
    </button>
  );
}

// <span> e não <div>: a dica avulsa pode ir dentro de texto corrido.
export function PainelDica({ dica }) {
  if (!dica.conteudo) return null;
  return (
    <span className="av-dica__painel" id={dica.painelId} hidden={!dica.aberta}>
      {dica.conteudo.linhas.map((linha, indice) => (
        <span className="av-dica__linha" key={indice}>{linha}</span>
      ))}
    </span>
  );
}

// Dica avulsa, fora de Campo, GrupoOpcoes e ResultadoCalculado (ações de uma
// seção, célula de tabela): o botão e o painel, lado a lado no fluxo. Num
// contêiner flex com quebra, o painel ocupa a linha de baixo inteira.
export function Dica({ texto, rotulo, id }) {
  const gerado = `av-dica-${useId().replace(/[^\w-]/g, '')}`;
  const dica = useDica({ texto, rotulo }, id || gerado);
  if (!dica.conteudo) return null;
  return (
    <>
      <BotaoDica dica={dica} />
      <PainelDica dica={dica} />
    </>
  );
}
