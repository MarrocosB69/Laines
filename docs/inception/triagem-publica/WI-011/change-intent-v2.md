# Change Intent — semáforo de contato v2

@work-item-id WI-011

## Task

Trocar os critérios de contato da triagem pública por três eixos binários: rastreio de energia/treino relacionado ao RED-S, insegurança alimentar e quantidade de sinais/sintomas. A pontuação é interna à fila da Extensão e não aparece na inscrição pública.

## Expected behavior

Cada eixo vale 0 ou 1; até três sinais relatados valem 0 e quatro ou mais valem 1. O servidor calcula a soma e a faixa de contato a partir do snapshot da inscrição. Resposta ausente, inválida ou parcial não é convertida em negativa. A regra fica versionada e os motivos mostram os critérios aos usuários autorizados.

## Scope

- `server/src/pacientes/triagem-publica-prioridade.ts`: classificador e ordem da fila.
- `server/src/pacientes/pacientes.service.ts`: metadado de auditoria da regra, se necessário.
- `server/scripts/test-triagem-publica.cjs`: fronteiras, ausências, ordenação e privacidade.
- `src/views/admin/Areas/Extensao.jsx`: pontuação e critérios apenas na fila interna.
- O detalhe interno não exibe a contagem bruta `redsScore` enviada pelo navegador; mostra somente os critérios calculados no servidor.
- `src/views/public/inscricao/EtapaFinalizacao.jsx`: identificar o bloco RED-S sem mostrar pontos.
- `src/views/public/InscricaoPublica.jsx`: enviar somente respostas do bloco aplicável ao sexo informado.
- `src/constants/clinicalInstruments.js`: esclarecer que a contagem local de respostas não é escore diagnóstico validado.
- `docs/product/construction/triagem-publica/fila_prioridade.md`: descrição aceita da regra.

## Non-goals

- Não diagnosticar RED-S, calcular disponibilidade energética sem ingestão/gasto/massa magra, nem usar o questionário simplificado como instrumento validado.
- Não mudar respostas, cadastro, banco, permissões, PDF de gestão ou mostrar pontuação a quem se inscreve.

## Invariants to preserve

- O servidor é a autoridade sobre prioridade e usa apenas respostas do snapshot, sem confiar em `redsScore` enviado pelo navegador.
- A fila continua restrita à origem pública e ao status aguardando; empate por data e identificador permanece determinístico.
- O PDF interno continua limitado a posição, nome, protocolo e data; sem escore, cor, respostas ou motivos.
- Registros antigos incompletos não se tornam verdes; urgências continuam com orientação direta na página pública.

## Existing code to inspect/reuse

- Classificador `contato-v1`, respostas de `redsRespostas`, `ebia.respostas`, `sinaisClinicos` e `relatoNegativo.sinais`, e testes sintéticos existentes.

## Test plan

- Testar 3 versus 4 sinais e códigos desconhecidos; EBIA completa negativa versus qualquer Sim e resposta parcial; respostas de energia/treino completas, parciais e inconsistentes; soma 0–3; legado incompleto; ordenação, autorização, auditoria e PDF mínimo.
- Rodar build/lint do servidor, teste de triagem e verificações PhaseGate relevantes com dados sintéticos.

## Rollback plan

Reverter somente classificador, testes e documentação desta versão. Os snapshots permanecem legíveis pela regra anterior.

## Open questions / assumptions

- Decisão do usuário: usar o bloco atual de energia/treino como alerta operacional. Qualquer resposta afirmativa válida vale 1; todas as perguntas respondidas negativamente valem 0; só negativas parciais permanecem indeterminadas. O resultado clínico posterior não participa da fila inicial.
- Faixas assumidas para o semáforo interno: 0 verde, 1 amarelo, 2–3 vermelho; cinza quando as respostas não permitem determinar a faixa.
