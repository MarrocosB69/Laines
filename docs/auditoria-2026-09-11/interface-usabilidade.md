# Interface, imagem e usabilidade

## Método e limites

Inspeção de código e renderização real do frontend em Chromium, com API interceptada e dados fictícios. Foram feitas **51 capturas de exploração**, incluindo repetidas e estados distintos, em desktop 1440×900 e celular 390×844. Duas capturas iniciais da prescrição ficaram no loading e foram descartadas para avaliação; a rodada seguinte esperou a tela real e corrigiu a evidência. Capturas iniciais do atleta mostravam cadastro incompleto; uma rodada adicional avaliou cadastro fictício concluído.

Isso permite avaliar composição, rótulos, navegação, estados vazios e comportamento de layout. Não comprova integração com banco, autorização real, comportamento sob carga ou atendimento completo em produção. Timeouts do roteiro e ausência de dados nas fixtures não foram classificados automaticamente como bugs do produto. Fotos/fontes externas foram bloqueadas no roteiro, portanto falhas desses recursos não foram atribuídas à aplicação.

Resultados: [exploração geral](evidencias/visual/resultados.json), [prontuário e prescrição](evidencias/visual-detalhes/resultados.json), [atleta com cadastro concluído](evidencias/visual-atleta/resultados.json). Roteiro: [visual.mjs](evidencias/visual.mjs).

## Evidências e recomendações

### UX-01 / P1 — menu mobile obstrui o conteúdo

Na entrada do aluno o drawer está aberto e escurece o conteúdo. Em `StudentView.jsx:31–44`, o estado começa aberto; o fechamento ocorre no evento de resize, sem uma inicialização equivalente. Professor e atleta seguem padrão semelhante. Isso exige uma ação adicional em toda entrada no celular.

No atleta, mesmo após Escape, a barra recolhida de aproximadamente 78 px permanece sobre o texto. O JSON pode indicar largura total de 390 px sem detectar esse encobrimento; ausência de scroll horizontal não comprova boa responsividade.

Evidências: [aluno mobile](evidencias/visual/mobile-aluno-inicio.png), [atleta após Escape](evidencias/visual-atleta/mobile-atleta-menu-fechado.png).

**Aceite:** entrada sem obstrução; drawer completamente fora da área útil quando fechado; abrir/fechar por botão, teclado e backdrop; foco volta ao acionador. Medir também em 320 px, tablet, orientação horizontal e zoom. Essas últimas condições ainda não foram executadas nesta rodada.

### UX-02 / P1 — prontuário repete pendências e consome o topo antes da decisão

O cabeçalho ocupa grande parte da primeira tela com dados de cadastro, vínculo e consentimento. Abaixo, “Pendências”, “Próxima ação”, “Próximos passos” e contagens por instrumento repetem avisos. Um registro novo aparece com 17 módulos pendentes sem contextualizar quais são necessários naquele atendimento.

Evidência: [prontuário desktop](evidencias/visual-detalhes/desktop-prontuario.png). Código: `PatientProntuario.jsx`, `ProntuarioHeader.jsx`, `VisaoGeral.jsx`, `ProntuarioPendencias.jsx`.

**Proposta:** cabeçalho compacto e uma fila de ações ordenada por relevância. Contato completo e detalhes administrativos entram em expansão. As avaliações continuam disponíveis, mas só as indicadas pelo fluxo viram pendência. Aceite: usuário identifica paciente, situação, última informação válida e próxima ação sem percorrer avisos duplicados.

### UX-03 / P1 — prescrição coloca análise antes da tarefa no celular

A regra `max-[999px]:flex-col-reverse` em `PrescricaoPlano.jsx:363` leva o resumo gráfico para cima da identificação e das ações. Na captura, o primeiro bloco é um anel vazio; nome do paciente e “Salvar plano” aparecem depois. Também há campos e textos pequenos, inclusive análise nutricional extensa num plano vazio.

Evidências: [desktop](evidencias/visual-detalhes/desktop-prescricao.png), [celular](evidencias/visual-detalhes/mobile-prescricao.png).

**Proposta:** paciente/status/ação primeiro; refeições como conteúdo principal; totais compactos persistentes; micronutrientes e análises expandíveis. Estado vazio orienta a adicionar alimento sem sugerir que zeros sejam resultados clínicos. “Gerar” e “PDF” só permanecem como ações operacionais depois de fechar CLI-01/03.

### UX-04 / P1 — diretoria muda a experiência principal da mesma pessoa

Aluno sem diretoria abre a área do aluno; aluno com Ensino ou Marketing abre o painel administrativo, com indicadores gerais e outra navegação. Existe ligação de volta à área do aluno, mas a função acadêmica desloca sua rotina de atendimento. O título “Administração” também não explica a responsabilidade local.

Evidências: [aluno](evidencias/visual/desktop-aluno-inicio.png), [aluno de Marketing](evidencias/visual/desktop-aluno-diretoria-marketing.png). Regras: `src/constants/roles.js`, `src/constants/adminTabs.js`.

**Proposta:** navegação pessoal estável. Liga reúne o que todos podem conhecer; Atendimento reúne pacientes vinculados; Minha diretoria contém a gestão permitida. Não criar um painel administrativo genérico como consequência automática de pertencer a uma diretoria.

### UX-05 / P2 — repetição de painéis e nomes pouco orientados à tarefa

Ensino tem título, contadores, aviso de visualização, “Operação de ensino”, dois cartões de área, próximos encontros e materiais recentes. A estrutura é aproveitável, mas o texto “consultar ou gerenciar” e a denominação operacional não distinguem bem o leitor do gestor.

Evidência: [Ensino](evidencias/visual/desktop-aluno-ensino.png). **Proposta:** destacar próximos encontros e materiais para o membro; controles de publicação para a diretoria. Os mesmos registros alimentam ambas as projeções. Comunicação deve aparecer junto às outras áreas na visão comum.

### UX-06 / P2 — dashboards contam mais do que ajudam a agir

O início do aluno dedica muito espaço a um cartão de paciente e calendário mensal, mesmo com poucos registros. O professor inicia com uma grade de seis contadores. Para trabalho diário, consultas próximas, avaliações aguardando revisão e retornos exigem mais destaque que números gerais. As fixtures vazias não permitem avaliar densidade com uma base grande.

Evidências: [aluno](evidencias/visual/desktop-aluno-inicio.png), [professor](evidencias/visual/desktop-professor-inicio.png). **Aceite:** primeiro bloco oferece ação executável; lista e agenda levam ao mesmo paciente e retornam preservando contexto; estados vazios explicam ausência sem inventar problemas.

### UX-07 / P1 — parte da navegação não tem endereço persistente

`StudentView.jsx:25` e `ProfessorView.jsx:26` guardam a área em estado local; vários cliques mantêm `/aluno` ou `/professor`. O admin já usa query string para parte das abas, padrão que pode ser aproveitado. Atualizar, voltar ou compartilhar um endereço não preserva igualmente o contexto em todas as áreas.

**Proposta:** rotas ou query strings estáveis para área, paciente e aba; guardar filtros/página no retorno. Aceite: F5 reabre a área atual; voltar retorna à lista filtrada; links profundos verificam autorização e têm saída útil em 403/404. Mudanças não salvas precisam de proteção contra abandono, separada do redirecionamento de sessão.

### UX-08 / P1 — legibilidade e acesso aos detalhes requerem verificação específica

As telas usam muitos textos secundários claros e pequenos. Tokens como `--pn-text-4:#94a3b8` e `--color-text-muted:#8fa0b3` precisam ser avaliados no fundo e tamanho realmente usados. A auditoria de tokenização CSS não mede contraste. Não foi feita medição completa de contraste nem teste com leitor de tela.

`SparkLine.jsx:134–142` abre detalhes por mouse; precisa de acesso equivalente por teclado/toque e tabela/lista associada. Botões apenas com ícone precisam de nome acessível, foco visível e área acionável consistente. Não usar apenas cor para estado ou gravidade.

**Aceite de projeto:** WCAG 2.2 AA, incluindo contraste de texto conforme tamanho, navegação por teclado, foco, nomes e reflow. O alvo de 24×24 CSS px do critério 2.5.8 tem exceções; 44×44 px pode ser adotado como preferência de conforto, não como citação incorreta desse mínimo. Fontes: [contraste](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [alvo mínimo](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html), [reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html).

### UX-09 / P2 — relatórios precisam de uma visão inicial por decisão

“Completa”, “Executiva”, “Operacional” e “Acionável” são recortes úteis, mas a visão completa inicial reúne muitos cartões e grupos. A captura mostra a composição, não valida números, pois analytics recebeu fixture vazia. O gráfico normalizado já explica sua escala; preservar essa explicação e oferecer valores originais.

Evidência: [relatórios](evidencias/visual/desktop-admin-relatorios.png). **Proposta:** iniciar no recorte pertinente ao papel, com período, população e uma explicação curta de cada indicador. Lista de tarefas separada de indicadores; dados clínicos identificados sob permissão própria. Validar totais com uma fixture de referência antes da publicação.

## Direção visual proposta

Manter identidade azul/verde e componentes existentes. A melhoria deve vir de hierarquia: título claro, uma ação principal, menos cartões aninhados, menos variações de estado e mais informação comparável em listas. Não trocar todas as cores ou adicionar animações como substituto da reorganização.

Para tabelas, padronizar busca, filtros, contador, paginação, ordenação e retorno. Para formulários, seção atual, salvamento e erros locais, usando histórico existente como ajuda. Para gráficos, data, unidade, método, cobertura e explicação de referência. Para o atleta, orientações publicadas e próxima ação, com linguagem cotidiana.

Não é necessário adicionar novos cadastros. A proposta reorganiza a apresentação dos dados que já existem e conclui ações já oferecidas pelo sistema.
