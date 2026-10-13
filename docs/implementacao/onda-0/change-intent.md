# Change Intent

## Task

Executar UPD-01 a UPD-08 da [proposta aprovada](../../auditoria-2026-09-11/proposta-atualizacao.md), integrar as frentes e incorporar as ferramentas solicitadas pelo usuário em 12/09/2026. A autorização de implementação foi expressa em “podemos iniciar” e reiterada em “seguir o documento e as etapas”. Este registro consolida o escopo já aprovado; não pretende anteceder as alterações que já haviam começado antes da instalação das skills.

## Expected behavior

Recuperação requer desafio expirável e único; credenciais não são expostas. HTTP e WebSocket respeitam sessão vigente. Exportação não amplia autorização; upload negado não grava; CPF repetido não altera inscrição. Prescrição preserva dados, calcula de forma consistente e exige autoria profissional e versão para publicação. CI e verificações locais devem executar sem falsos resultados positivos.

## Scope

- Auth, users, credenciais, email e aprovação; telas correspondentes e migração aditiva.
- Realtime, destinatários de alertas clínicos e consumidores.
- Analytics, conteúdos/uploads, inscrição pública e testes negativos.
- Contrato/editor/serviço/PDF/revisão de planos.
- CI, erros de lint, scripts de regressão, instruções e ferramentas de desenvolvimento solicitadas.

## Non-goals

- Implantação e migração no banco real não integram esta execução local.
- Não modificar os resultados históricos da auditoria nem misturar seu estado com as evidências novas.
- Não aplicar inicializadores que mudem arquitetura, gerenciador de pacotes ou todo o estilo de código do projeto.
- A navegação e demais entregas das ondas seguintes continuam no backlog original; não considerá-las concluídas por instalar ferramentas.

## Invariants to preserve

1. Nenhum teste usa cadastro real ou envia email.
2. Papel acadêmico não concede assinatura clínica.
3. Dado legado preservado; nulo não equivale a zero.
4. Revogação não depende de cache de autorização.
5. Nenhuma limpeza ou reset elimina trabalho local anterior.
6. Teste que falha ou não executa não recebe status de aprovação.

## Existing code to inspect/reuse

Serviços Nest/TypeORM, motor src/core/prescricao, AuthContext, DTOs atuais, scripts/run-core-tests.mjs e CI. Evidências e hashes da auditoria são a referência anterior.

## Test plan

- scripts/test-security-{credentials,realtime,access}.cjs e scripts/test-prescription-contract.cjs.
- TypeScript servidor, lint frontend, build frontend/backend, core, guard schema e YAML sem chaves duplicadas.
- Ferramentas novas: instalação verificável, comandos locais compatíveis com Windows; registrar falhas e limites, sem desligar regra apenas para obter verde.
- Ensaio posterior necessário: PostgreSQL com migrações, SMTP controlado, navegação autenticada e jornada clínica completa da onda 1.

## Rollback plan

Revisar e reverter apenas os arquivos/hunks da implementação identificados em seu manifesto; preservar todo o trabalho anterior. Antes de implantação, backup validado de banco/arquivos e ensaio de migração são obrigatórios. Não restaurar senhas em texto nem o endpoint vulnerável para fazer rollback. Um rollback operacional deve manter a recuperação insegura indisponível.

## Open questions / assumptions

- RipStop 0.2.3 exige Node 22.x e GitHub Packages; consulta autenticada não disponível (401). Node local 24.12.0 e CI 20 são incompatíveis com engines declaradas.
- Kragg e Phasegate serão adaptados à arquitetura React JS + Nest TS existente, após inspeção do dry-run. Não se presume que seus scaffolds sejam adequados.
- Preparação automática de commits foi instalada para uso específico posterior; não abrange esta integração com alterações anteriores misturadas e repositórios internos não rastreados.
