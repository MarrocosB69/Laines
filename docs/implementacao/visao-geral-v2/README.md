# "Visão geral" padronizada nos cinco portais

Escopo, decisões e contrato em [change-intent.md](change-intent.md) e [contrato-painel.md](contrato-painel.md). Nada foi commitado.

## O que mudou para quem usa

- **Mesma estrutura nos cinco portais** (decisão do usuário):
  1. cabeçalho com saudação, papel e data;
  2. faixa de 3 ou 4 indicadores;
  3. "O que precisa de você";
  4. "Agenda";
  5. o bloco específico do papel.
- **Mesmo visual da landing,** com peças compartilhadas em `src/components/painel/`.
- **Admin, professor e aluno:** mesmo conteúdo e mesmos números de antes, reorganizados.
- **Equipe e atleta:** ganharam uma Visão geral, que é a aba inicial desses portais.
  - **Atleta:** pendências, próxima consulta, avaliações e acompanhamento, sem valores clínicos.
  - **Equipe:** hoje só a lista de atletas é carregada sem um atleta selecionado. "O que precisa de você" e "Agenda" mostram uma orientação no lugar de números, e decidir isso fica com o usuário.
- **Títulos da aba inicial:** passaram a seguir o menu: "Início" no admin e "Visão Geral" nos demais.

## Verificação

- **`test-painel.cjs`:** 17 verificações. Cobre a saudação, o `dateTime` local às 21h30, fontes, escopo, alvos, movimento, contraste, a marcação, o estado expandido e o tom de atenção sem fundo.
- **Mesmos dados:** comparado com `tmp/visao-geral-v1/`. Nenhuma chamada nova nem cálculo alterado; os 10 números do admin continuam visíveis.
- **Navegador** (`tmp/visao-geral-v2/verificar.mjs`, API sintética, 1280 e 390 px):
  - blocos na ordem do contrato;
  - nenhuma rolagem horizontal nem texto cortado;
  - só as fontes Sofia;
  - alvos de 44 px;
  - um `h1` por página;
  - nenhum erro de console.
- **Revisão independente (Opus):** aprovado com ressalvas. Corrigido:
  - no professor, o foco se perdia ao abrir "Avaliações pendentes", e os indicadores não anunciavam o detalhe aberto. Agora a linha fica, o detalhe abre abaixo, e há `aria-expanded` e estado visível;
  - no aluno, os números e as pendências divergiam durante a busca de "Meus Atletas". Agora as pendências não dependem da busca;
  - o teste não cobria a data às 21h nem o tom de atenção.

## Limites e acompanhamento

- **Atleta sem verificação visual:** a Visão geral do atleta ainda não foi vista em navegador com dados, porque o assistente de cadastro cobria a tela na captura. A próxima rodada usa um atleta sintético com cadastro completo.
- **Registrados, anteriores a esta onda:** dois `h1` na área "Meus Atletas" do aluno; zeros no professor quando a API falha; `ProximasAcoes.jsx` sem uso; o ramo `isMulti` inalcançável.
- **Não testado:** leitor de tela real, Safari, Firefox e celular real.
