import { useState } from 'react';
import { efeitoDaTeclaNaDica, normalizarDica } from './apoio';

/* Estado da dica "?": aberta ou fechada. É o único estado da base, e é de
   interface, não de negócio: nada daqui vai para o dado salvo.
   scripts/test-avaliacao-base.cjs só aceita useState neste arquivo.

   `painelId` vem de quem chama (`${id do controle}-dica` no Campo), para a
   base não criar um useId novo: um useId a mais num componente muda os ids
   gerados para os filhos dele. */
export function useDica(dica, painelId) {
  const [aberta, setAberta] = useState(false);
  const conteudo = normalizarDica(dica);
  const ativa = Boolean(conteudo) && aberta;

  const alternar = (evento) => {
    // O clique no "?" é só da dica: não aciona um ancestral clicável.
    evento?.stopPropagation?.();
    setAberta((atual) => !atual);
  };

  const aoTeclarNoBotao = (evento) => {
    const efeito = efeitoDaTeclaNaDica(evento.key, ativa);
    if (efeito === 'fechar') {
      evento.preventDefault();
      evento.stopPropagation();
      setAberta(false);
    } else if (efeito === 'isolar') {
      evento.stopPropagation();
    }
  };

  // Esc também fecha com o foco no controle do campo, depois de ler a dica.
  const aoTeclarNoCampo = ativa
    ? (evento) => {
        if (efeitoDaTeclaNaDica(evento.key, true) !== 'fechar') return;
        evento.preventDefault();
        evento.stopPropagation();
        setAberta(false);
      }
    : undefined;

  return {
    conteudo,
    aberta: ativa,
    painelId: conteudo ? painelId : null,
    // Ligado ao controle por aria-describedby só enquanto está aberta.
    descritaPor: ativa ? painelId : null,
    alternar,
    aoTeclarNoBotao,
    aoTeclarNoCampo
  };
}
