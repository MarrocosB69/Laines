# WI-011 — triagem pública e fila de contato da Extensão

@work-item-id WI-011

## Problema e resultado esperado

A inscrição pública cria um cadastro em `Triagem Publica`, mas a fila da Extensão apenas o lista por data. O esporte tem oito perguntas dispersas, não há pergunta sobre lesão atual/recente e a equipe não dispõe de ordem de contato nem relatório de gestão. A inscrição passará a entrar em `Lista de Espera` com origem pública identificável. A Extensão verá uma ordem operacional de contato explicável, poderá filtrar a fila e exportar um PDF interno com nome e protocolo, sem respostas de saúde ou contato.

## Escopo

- Formulário público de esporte e saúde, estado local, contrato validado e snapshot de inscrição.
- Resumo de autorrelato nas avaliações, com leitura dos esportes e lesões novos sem duplicar os campos legados.
- Leitura dos campos legados em prontuário, portal da equipe e cadastro do atleta sem exibir a sentinela técnica `nao_informado` como resposta clínica.
- Consulta da fila pública em pacientes, classificação versionada no servidor e painel de triagens da Extensão.
- Relatório PDF com projeção mínima, autorização no servidor, registro da exportação e testes sintéticos.
- Documentação de produto e verificações PhaseGate.

## Não objetivos

- Diagnóstico, aptidão esportiva, classificação IOC REDs CAT2 ou decisão clínica automática.
- Mudança no banco real, deploy, envio de mensagens, migração ou alteração dos cadastros legados.
- Atribuir prioridade por esporte, tempo de prática, duração ou pontuação RED-S recebida do navegador.
- Dar à Extensão acesso ao prontuário ou poder de ativar pacientes.

## Invariantes e regras

- Esportes são itens repetíveis com modalidade, tempo de prática, sessões por semana e minutos por sessão; a primeira modalidade alimenta campos legados, e a lista completa fica no snapshot. Ver [Change Intent de frequência](./change-intent-frequencia.md).
- Lesão/dor atual e lesão nos últimos três meses são autorrelato separado. Se positivo, perguntar o efeito atual na prática: normal, adaptada ou interrompida. Dados de saúde não entram no rascunho local.
- O semáforo de contato v2 soma três alertas internos de 0/1: respostas do rastreio de energia/treino associado ao RED-S, rastreio breve de insegurança alimentar e quatro ou mais sinais/sintomas distintos. Zero pontos é verde, um é amarelo e dois ou três são vermelho; resposta incompleta ou contraditória fica cinza quando impede determinar a faixa. Lesão continua registrada e visível no detalhe, mas deixa de pontuar. Ver [Change Intent v2](./change-intent-v2.md).
- O servidor calcula prioridade a partir de respostas validadas, sem confiar em escore do cliente. Mostrar cor, pontos e motivos somente na fila interna autorizada da Extensão; o formulário público não mostra pontos. O alerta de energia/treino não é disponibilidade energética calculada nem diagnóstico RED-S. Sintomas urgentes recebem orientação direta de atendimento, sem esperar a fila.
- A fila inclui somente status aguardando de origem pública; inscritos internos na Lista de Espera não entram. Registros históricos incompletos nunca viram verde por ausência de resposta.
- PDF interno contém posição, nome, protocolo e data, já ordenados. Não conter CPF, contato, modalidade, cor, respostas, motivos ou texto livre. A ordenação pode revelar inferência de saúde: limitar acesso, evitar cache e auditar exportação.

## Verificação e reversão

- Testar classificação, dados ausentes, legados, ordenação, separação de origem, autorização e ausência de campos sensíveis no PDF. Rodar lint, builds e PhaseGate com dados sintéticos.
- Sem Vite, Playwright, `npm install` ou banco real nesta etapa. Revisão clínica local dos critérios antes de uso em produção.
- Reverter apenas os arquivos do WI-011; snapshots já capturados permanecem legíveis pela compatibilidade legada.
