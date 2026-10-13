# Avaliação por imagem: experiência e limites do instrumento

@work-item-id WI-008

## Modelo conceitual

A avaliação por imagem é um registro independente e experimental do paciente. Peso e estatura são informados para esta sessão; idade, quando necessária a uma fórmula, pode vir da data de nascimento do cadastro na data da captura. Nenhum resultado de BIA, dobras, GET ou outra avaliação a preenche. O processamento é externo e assíncrono; ausência de processador, captura ou resultado tem estado próprio e não é substituída por número demonstrativo.

O percurso visível é: preparar e consentir → quatro fotos → vídeo 360° → envio/processamento → estimativas. A navegação textual informa a etapa atual e o que falta. Preparação, revisão e resultados usam superfície branca ampla do sistema; a câmera ocupa a tela inteira com instruções legíveis. No desktop, preparo pode usar duas colunas e a revisão usa grade de duas colunas; no móvel tudo vira uma coluna, sem rolagem horizontal e com alvos de ao menos 44 px.

## Dados, histórico e estados

- Consentimento, fonte dos dados antropométricos, estado de cada captura, data, autor e versão do algoritmo permanecem distinguíveis.
- A vista confirmada no servidor não pode ser substituída; depois de retomar, a ausência de prévia local é dita claramente, sem fingir revisão visual da foto.
- Histórico mostra registros por data e situação. O mais recente pendente pode ser retomado sem esconder o último resultado concluído. Selecionar um registro anterior nunca altera o processamento atual.
- Usuário somente leitura consulta registros e estado, sem entrar no wizard de captura ou ver ações de mutação.
- Erro de rede, câmera negada, navegador sem gravação compatível, upload parcial, processador ausente e resultado inválido têm mensagens e ações específicas.

## Apresentação clínica

- O primeiro plano do resultado é: percentual e massas **estimados**, método/versão, origem e qualidade de calibração quando informada. Qualidade técnica não é precisão clínica.
- O 3D procedural é rotulado como ilustração baseada em estimativas, nunca reconstrução fiel do paciente. Medidas segmentares só aparecem quando vierem do processador.
- IMC derivado de peso/estatura digitados fica identificado como cálculo antropométrico, não inferência da imagem.
- O cartão do prontuário mantém o selo experimental mesmo após concluir. Seus indicadores trazem “estimado” no rótulo e não recebem seta/cor de melhora clínica; séries genéricas de evolução não misturam esses números com instrumentos validados.
- Idade corporal, score/classificação de risco metabólico, triagem de panturrilha indiscriminada e intervalo numérico apresentado como IC 95% não são destacados nem usados em conduta sem validação específica. Dados técnicos legados podem permanecer persistidos, sem promoção visual.
- Se a idade válida do cadastro faltar ou não pertencer à população adulta aplicável, Deurenberg não entra na combinação; nunca usar 25 como substituto silencioso. Alteração da fórmula exige versão/rastreabilidade e teste de regressão.
- A entrada HTTP do processador mantém `idade`, `idadeOrigem` e `idadeReferenciaEm` ao validar a requisição; o cálculo não pode depender de campos descartados silenciosamente pelo esquema.
- A versão `2.1.1` distingue os novos jobs que recebem a idade no cálculo dos resultados `2.1.0` já gravados; o histórico não é recalculado.

## Linguagem visual e acesso

Usar Sofia Sans e Sofia Sans Extra Condensed; cartões brancos com `--lt-radius-card`, títulos de seção em Sofia 700, título principal na voz de campanha, campos com `--lt-color-border-field` e `--lt-focus-ring`, primário no degradê `--lt-color-start-*` e secundário em contorno. Textos e estados usam pares com contraste mínimo de 4,5:1. A natureza experimental é informação persistente, não um semáforo de risco.

O diálogo declara nome/papel modal, prende e devolve o foco, fecha por Escape quando não há envio em curso e bloqueia rolagem de fundo. Campos têm rótulos associados; progresso tem texto para tecnologia assistiva. A captura respeita safe-area e preferência por movimento reduzido. A heurística de brilho/nitidez/contraste apenas orienta a captura: não se apresenta como detecção corporal nem como validação clínica.
