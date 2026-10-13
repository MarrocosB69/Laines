# Change Intent — frequência semanal por esporte

@work-item-id WI-011

## Problema e resultado esperado

O cartão de cada esporte na inscrição pública informa modalidade, tempo de prática e minutos por sessão, mas não a quantidade de sessões por semana. Adicionar um único select por esporte, com 1 a 14 sessões semanais. Cada modalidade mantém sua própria resposta no snapshot; o campo legado do paciente reflete o primeiro esporte.

Refinamento visual: o campo se chama “Frequência semanal” e as opções aparecem por extenso (“Uma vez por semana”, “Duas vezes por semana” etc.), mantendo os valores numéricos existentes de 1 a 14 no envio e na validação.

## Escopo

- Etapa de esporte, validação, payload e restauração do rascunho público.
- DTO e normalização da inscrição no servidor, sem migração de banco.
- Leitura da frequência por esporte no detalhe da Extensão e no resumo de autorrelato das avaliações.
- Testes sintéticos do contrato, persistência, rascunho e exibição.

## Não objetivos e invariantes

- Não alterar o semáforo, perguntas de saúde, permissões, status ou PDF da fila.
- Preservar leitura e submissão por clientes legados sem frequência no item; o novo formulário exige uma opção em cada esporte.
- A coluna `paciente.frequenciaSemanal` continua representando somente o esporte principal; não somar frequências de modalidades diferentes.
- Nenhum dado real, alteração no banco ou deploy nesta etapa.

## Verificação e reversão

Testar valores válidos e inválidos, duas modalidades com frequências diferentes, coluna principal, snapshot, rascunho e contexto exibido. Rodar lint, testes de interface/triagem e PhaseGate. Para reverter, remover o campo da apresentação e do contrato novo; snapshots já gravados permanecem legíveis porque o campo é aditivo.
