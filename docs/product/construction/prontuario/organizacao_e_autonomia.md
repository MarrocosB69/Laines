# Prontuário: hierarquia de uso e autonomia clínica

@work-item-id WI-007

## Leitura conceitual do sistema existente

O prontuário é o contexto do paciente, não uma avaliação gigante. Cabeçalho identifica paciente e estado; Visão geral apresenta síntese e próxima ação; Dados clínicos distingue dados declarados pelo atleta do resumo escrito pelo profissional; Avaliações contém instrumentos e registros; Evoluções mostra tempo/consultas; Anexos guarda documentos; Pendências mostra trabalho do atendimento. A supervisão é comunicação transversal. Essa estrutura e seus fluxos de acesso permanecem.

As fontes clínicas têm papéis diferentes: cadastro/triagem pública são autorrelato, formulários são registros independentes, e síntese/relatório do prontuário são leitura derivada de registros finalizados. Dados de triagem pública não viram resultado clínico automaticamente. Uma avaliação pode mostrar seu próprio histórico para comparação, mas não deve depender do estado, classificação ou resultado de outra.

## Decisões de interação e visual

- Manter as seis abas e o cabeçalho existentes. Destacar uma próxima ação e as pendências prioritárias na Visão geral, sem copiar a lista completa de Pendências.
- Na aba Avaliações, apresentar primeiro instrumentos e sua situação individual, com busca/filtro e entrada direta. Resumir estatísticas redundantes e deixar detalhes analíticos em contexto próprio. Histórico de registros segue acessível na mesma aba.
- Usar a identidade da landing e dos painéis novos no conteúdo do prontuário: superfície branca e raio `--lt-radius-card`, título principal na voz de campanha (`--lt-font-display`, itálico 900), títulos de seção em Sofia Sans 700, campos com `--lt-color-border-field`, ao menos 48 px de altura e `--lt-focus-ring`, botão primário no degradê `--lt-color-start-*` e secundário em contorno. Preservar contraste textual mínimo de 4,5:1, estados vazios/carregando/erro, alvos de lista de ao menos 44 px e adaptação a 1280/390 px sem rolagem horizontal do corpo. Cor não deve ser o único indicador de situação.
- Avisos de só leitura são informativos, com `--lt-color-track-tint`; anexos e entradas `attachment-thumbnail__input` acompanham os mesmos campos e focos. Usar apenas Sofia Sans e Sofia Sans Extra Condensed na área; a mudança é de apresentação e não altera textos, chamadas, permissões, cálculos, estados ou handlers.
- Quando um paciente está aberto, o prontuário ocupa uma página própria, fora da moldura e do cabeçalho global dos portais de aluno, professor e administração. O botão Voltar restaura a origem já registrada. A barra de abas não cria rolagem horizontal ou vertical própria; a rolagem vertical é a da página.
- A página própria reutiliza a barra lateral dos portais, inclusive logo, recolhimento, gaveta móvel e perfil. Suas opções são Voltar e, em seguida, Avaliações: painel e instrumentos agrupados pelas etapas do registro. A lista respeita a visibilidade já calculada para o usuário; não substitui as seis abas de conteúdo. Na avaliação aberta, o item ativo acompanha o estado interno do formulário, e a troca de módulo usa seu `handleTabChange` existente, inclusive alertas. Voltar e sair para o painel usam a confirmação de edição pendente; avaliação por imagem mantém a abertura do catálogo. A gaveta móvel não causa overflow horizontal.
- Cada módulo abre com sua própria identidade, dados e ações. Mensagens de “módulo pendente” ou “próximo passo” referentes a outro instrumento saem do formulário. Orientações clínicas de risco permanecem.
- A visão longitudinal e os relatórios podem combinar avaliações para **consulta**. A combinação não preenche, desbloqueia ou finaliza avaliações individuais.

## Contrato de dados entre avaliações

1. O formulário recebe seu snapshot e histórico do mesmo tipo, contexto cadastral estável e, quando cabível, peso/estatura compartilhados. Idade e sexo de outro formulário não são fonte; cadastro e edição local podem fornecê-los.
2. A edição local prevalece sobre valores compartilhados. Uma avaliação finalizada continua somente leitura; nova medição cria registro próprio.
3. RED-S obtém ingestão, gasto de exercício e massa magra em campos próprios. A disponibilidade energética conserva a fórmula `(ingestão − gasto) / massa magra`; se os três dados não existirem, mostra cálculo indisponível e nomeia os **campos** faltantes, sem exigir outras avaliações. Snapshots antigos com campos automáticos continuam legíveis.
4. GET estima a TMB no próprio instrumento a partir de peso, estatura, idade e sexo do cadastro/contexto compartilhado usando o motor de fórmulas já existente; admite TMB informada no módulo como substituição explícita. Não usa composição integrada ou Carga de Treino como entrada automática. Fórmulas, limites e interpretação do motor existente permanecem.
5. Instrumentos de treino, exames e evolução não importam classificações de outros instrumentos para seus indicadores internos. O prontuário pode apresentar esses resultados lado a lado com fonte e data.
6. A composição corporal integrada permanece um instrumento próprio: coleta medida de gordura ou massas no próprio formulário, admite água corporal opcional e usa apenas peso/estatura compartilhados e dados estáveis do cadastro para os cálculos existentes. A comparação entre BIA, dobras e DEXA pertence ao painel de leitura do prontuário e usa somente registros finalizados e revisados. Avaliações integradas antigas exibem seus resultados e sua origem salvos, sem transformar a integração histórica em nova medição.

## Verificação de aceitação

Abrir e salvar cada instrumento elegível sem outro instrumento preenchido; RED-S com campos próprios calcula quando completo e informa lacunas quando incompleto; registros antigos abrem sem sobrescrita; peso/estatura podem ser sugeridos, editados e identificados pela origem; navegação desktop/móvel permite chegar ao histórico, avaliação e pendências; permissões e revisão clínica existentes continuam regidas pelo servidor.
