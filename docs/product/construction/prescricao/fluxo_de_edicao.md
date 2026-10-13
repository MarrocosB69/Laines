# Prescrição: alimento, opção e entrega

@work-item-id WI-009

## Organização da tela

Cada refeição contém os alimentos prescritos, sua ação **Adicionar alimento** e a busca correspondente no mesmo cartão. A busca abre junto à ação que a iniciou e fecha quando a refeição é recolhida. Apenas uma busca fica ativa por vez; ao trocar entre refeição e substituição, termo e resultados anteriores são descartados. A busca de substituto permanece abaixo do alimento que será substituído. As opções têm quantidade própria e não entram no total da refeição até que o profissional as escolha como alimento principal. Biblioteca temporária, painéis abertos e busca são descartados ao trocar de paciente.

A lista de resultados é uma lista de botões, com carregamento, vazio e erro anunciados corretamente. Fechar ou escolher devolve o foco à ação que abriu a busca. Medidas longas podem quebrar linha em larguras pequenas.

## Significado clínico e entrega

A quantidade principal representa gramas quando o catálogo não oferece medida caseira; a equivalência automática compara apenas o nutriente âncora e o percentual deve dizê-lo na própria tela. A quantidade prescrita pode ser fixada pelo profissional. Totais consideram apenas os itens principais. Qualquer alimento de substituição em conflito com restrição confirmada exige justificativa antes da revisão/publicação, como ocorre com o principal; cada alternativa usa a chave `itemId:alimentoId` para não compartilhar uma justificativa com outros alimentos da mesma linha. Trocas escolhidas entre grupos diferentes não são equivalências automáticas e exigem quantidade explícita do profissional.

Uma alternativa automática antiga sem âncora verificável aparece na entrega com quantidade pendente, nunca com 100 g inferidos. O campo **Orientação de [refeição]** alimenta a propriedade `orientacoes`, usada no PDF e no portal do atleta. O seletor atualmente chamado “Método” muda somente a apresentação de edição; deve ser nomeado como visualização e informar que a entrega continua listando alimento e quantidade, sem oferecer uma modalidade qualitativa que o sistema não gera.

## Verificação

Cobrir com dados sintéticos alimento principal e substituto, unidade e quantidade, restrição em cada posição, recusa de revisão sem justificativa, orientação na projeção e nome oficial preservado. Conferir manualmente foco, busca única, cartão aberto/fechado e largura de 390 px quando houver navegador disponível.
