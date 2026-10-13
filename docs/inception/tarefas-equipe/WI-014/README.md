# WI-014 — prazos e conclusão de tarefas por equipe

@work-item-id WI-014

## Task

Tarefas atribuídas a uma equipe devem ter data de término, contagem de dias até o prazo, ação para marcar como feitas e observação opcional na conclusão. A conclusão é única para a equipe, conforme decisão do usuário em 02/10/2026. O desempenho de cada diretoria deve aparecer nos relatórios sem confundir tarefas com indicadores clínicos.

## Expected behavior

- Uma tarefa nova destinada a uma diretoria ou equipe de atendimento exige prazo em data civil (`YYYY-MM-DD`); tarefas legadas sem prazo continuam legíveis como “Sem prazo”.
- Tarefas abertas exibem “Faltam N dias”, “Vence hoje” ou “Atrasada há N dias”, em dias de calendário de `America/Sao_Paulo`. Uma tarefa concluída exibe data de entrega e deixa de contar dias.
- “Marcar como feita” abre um campo de observação opcional e registra uma só conclusão por tarefa/equipe. O servidor grava horário e autor a partir da sessão, com repetição idempotente.
- Lista, Kanban e cabeçalho usam a mesma regra de conclusão. Criar com status concluído ou alterar diretamente o status para concluído não pode contornar esse registro.
- Gestão pode reabrir uma tarefa; a reabertura e alterações de prazo/equipe ficam registradas. Exclusão deixa o histórico necessário à avaliação.
- Relatórios mostram, por diretoria e período, tarefas com vencimento no período, concluídas no prazo, concluídas com atraso, abertas vencidas e sem dados de prazo, com denominador declarado. `todos` e papéis sem diretoria ficam em “Geral/outros”, sem atribuição artificial.
- O agregado não expõe observações; o detalhe da tarefa mostra a observação só a quem pode vê-la. O relatório de tarefas tem escopo e acesso próprios.

## Scope

- `server/src/tarefas/`: entidade, DTOs, serviço, controlador e testes de prazo/conclusão/permissão.
- Nova migração aditiva em `server/src/database/migrations/` para prazo, dados de conclusão, arquivamento e histórico de eventos.
- `src/views/admin/Dashboard/DashboardStats.jsx` e CSS: criação com prazo, contador, conclusão/reabertura e exibição de registro.
- `src/components/shared/NotificationTaskCenter.jsx` e CSS associado: prazo, contador e observação opcional ao concluir.
- `src/views/admin/ReportsPage/`: seção operacional própria para tarefas; endpoint/projeção e exportação próprios no módulo de tarefas, sem alterar o escopo por projeto dos relatórios clínicos.
- `server/src/realtime/realtime.gateway.ts`: alinhar audiência de invalidação ao GET de tarefas, incluindo `todos`, e evitar dados de tarefa no argumento interno dos eventos.
- Testes de contrato de tarefas e controle de acesso; documentação de produto em `docs/product/construction/tarefas-equipe/` após aprovação.

## Non-goals

- Não criar uma conclusão por integrante, pontuação subjetiva, ranking individual ou comparação automática de diretorias com volumes diferentes.
- Não alterar atribuições clínicas, prontuário, triagem, permissões atuais de criar/editar tarefas ou relatórios clínicos por projeto.
- Não executar migração no banco real, deploy ou limpeza de tarefas legadas nesta etapa.

## Invariants to preserve

- `INV-002`: o servidor continua verificando sessão e equipe atual; a UI sozinha não autoriza conclusão ou leitura do relatório.
- `INV-005`: testes usam dados sintéticos; observação não entra em agregado/exportação por padrão.
- `INV-006`: preservar o trabalho local existente, sem reset/clean e sem sobrescrever alterações de outras frentes.
- Tarefa concluída é um registro da equipe, com autor identificável; `updatedAt` não é usado como prova de entrega.
- Tarefas antigas sem prazo não entram no denominador de pontualidade; criação/conclusão passadas não são inferidas retrospectivamente.
- `todos` não dá a qualquer atleta direito de concluir uma tarefa institucional.

## Existing code to inspect/reuse

- `TarefasService.findAll` já delimita a audiência por papel/diretoria; `resolve` já é a ação compartilhada; `normalizeDiretoria` unifica nomes de equipe.
- O dashboard já cria/edita tarefas e possui lista/Kanban; o cabeçalho já permite resolver; `ReportsPage` possui apresentação e filtros de período.
- Relatórios clínicos em `analytics` usam projeto e têm leitores além de admin/coordenação; desempenho de tarefas precisa de contrato e permissão separados.

## Test plan

- Testes de serviço/HTTP: prazo obrigatório para equipe, data válida, conclusão por integrante da equipe, negação fora da equipe, autor/horário da sessão, nota opcional com limite, repetição idempotente, bloqueio de status concluído por atalho, reabertura, alteração de prazo/equipe e preservação após exclusão.
- Testes de data: hoje, futuro, vencido, dia de entrega e virada de dia em `America/Sao_Paulo`; tarefas legadas sem prazo.
- Testes de relatório: agrupamento por diretoria, período, denominador, distinção `todos`/“Geral”, autorização e ausência de observações no agregado/exportação.
- Teste de realtime: atleta não recebe invalidação de tarefa `todos` institucional; só a equipe atual recebe os eventos da sua atribuição.
- Rodar lint/build/testes afetados e PhaseGate. Conferir manualmente dashboard, cabeçalho e relatórios em desktop e celular com dados sintéticos.

## Rollback plan

Reverter UI, serviços e endpoint desta WI preservando a migração aditiva até existir procedimento explícito para arquivar os registros de conclusão. Não remover colunas/eventos nem executar `down` no banco real sem plano de retenção.

## Open questions / assumptions

- Premissa: “equipe” inclui as quatro diretorias e `coord_atendimento`; tarefas para `todos` podem existir sem prazo e não entram em uma diretoria.
- Premissa: somente admin/coordenação veem o consolidado de todas as diretorias; membros veem as próprias tarefas, mas não o consolidado global.
- Premissa: prazo termina ao fim do dia local de São Paulo. Observação é opcional e não interfere no estado concluído.
- O usuário autorizou continuar após a apresentação deste Change Intent em 02/10/2026. O desenho aceito está em `docs/product/construction/tarefas-equipe/prazos_conclusao_relatorios.md`.

## Implementação e evidência (02/10/2026)

- Prazo, entrega única, nota opcional, histórico, reabertura e arquivamento foram implementados no módulo de tarefas. O Kanban ignora arquivadas; a audiência dos eventos em tempo real acompanha a leitura HTTP.
- Dashboard, Kanban e cabeçalho usam `/tarefas/:id/resolver` e mostram o prazo civil. Relatório independente por diretoria tem atualização manual e por evento, com CSV/JSON agregado.
- `npm run test:core`, `npm run test:ui`, `npm run build`, `node scripts/test-security-realtime.cjs`, lint TypeScript, ESLint dos JSX tocados, Stylelint dos novos CSS, PhaseGate `phasegate:check-ready` e L2 passaram.
- Stylelint dos CSS legados `DashboardStats.css` e `AdminHeader.css` ainda acusa regras preexistentes fora das seções novas; os CSS criados nesta WI passaram. A migração foi criada, mas não executada no banco real; não houve navegador autenticado nesta validação.
