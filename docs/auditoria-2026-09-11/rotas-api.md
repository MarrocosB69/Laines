# Inventário estático atual de rotas da API

Gerado por AST TypeScript, sem executar a API. 139 entradas de rota; 0 duplicidades exatas de método/caminho encontradas.

Este inventário não classifica uma rota como segura/insegura. Guard declarado é apenas uma camada; permissões, vínculo, projeção de campos e efeitos antes da autorização precisam ser lidos no serviço/interceptor. A ausência de guard pode ser intencional em endpoints públicos. Os decoradores completos estão em [rotas-api.json](evidencias/rotas-api.json). Não inclui URLs assinadas geradas dinamicamente nem rotas internas do processador Python.

| Método | Caminho | Guards declarados na classe/método | Fonte |
|---|---|---|---|
| GET | `/agendamentos` | JwtAuthGuard | `server/src/agendamentos/agendamentos.controller.ts:37` |
| POST | `/agendamentos` | JwtAuthGuard, RolesGuard | `server/src/agendamentos/agendamentos.controller.ts:71` |
| DELETE | `/agendamentos/:id` | JwtAuthGuard, RolesGuard | `server/src/agendamentos/agendamentos.controller.ts:100` |
| GET | `/agendamentos/:id` | JwtAuthGuard | `server/src/agendamentos/agendamentos.controller.ts:61` |
| PATCH | `/agendamentos/:id` | JwtAuthGuard, RolesGuard | `server/src/agendamentos/agendamentos.controller.ts:89` |
| POST | `/agendamentos/:id/remarcar` | JwtAuthGuard, RolesGuard | `server/src/agendamentos/agendamentos.controller.ts:78` |
| GET | `/analytics/correlations` | JwtAuthGuard | `server/src/analytics/analytics.controller.ts:128` |
| GET | `/analytics/dashboard/operational-board` | JwtAuthGuard | `server/src/analytics/analytics.controller.ts:114` |
| GET | `/analytics/dashboard/summary` | JwtAuthGuard | `server/src/analytics/analytics.controller.ts:100` |
| GET | `/analytics/reports/export` | JwtAuthGuard | `server/src/analytics/analytics.controller.ts:144` |
| GET | `/analytics/reports/overview` | JwtAuthGuard | `server/src/analytics/analytics.controller.ts:84` |
| GET | `/auditoria` | JwtAuthGuard, RolesGuard | `server/src/auditoria/auditoria.controller.ts:117` |
| POST | `/auditoria` | JwtAuthGuard | `server/src/auditoria/auditoria.controller.ts:80` |
| DELETE | `/auditoria/:id` | JwtAuthGuard, RolesGuard | `server/src/auditoria/auditoria.controller.ts:146` |
| GET | `/auditoria/:id` | JwtAuthGuard, RolesGuard | `server/src/auditoria/auditoria.controller.ts:135` |
| POST | `/auth/change-password` | JwtAuthGuard | `server/src/auth/auth.controller.ts:164` |
| POST | `/auth/login` | Não declarado no controller | `server/src/auth/auth.controller.ts:107` |
| POST | `/auth/logout` | Não declarado no controller | `server/src/auth/auth.controller.ts:139` |
| POST | `/auth/logout-all` | JwtAuthGuard | `server/src/auth/auth.controller.ts:173` |
| GET | `/auth/me` | JwtAuthGuard | `server/src/auth/auth.controller.ts:158` |
| PATCH | `/auth/profile` | JwtAuthGuard | `server/src/auth/auth.controller.ts:179` |
| POST | `/auth/recover-password` | Não declarado no controller | `server/src/auth/auth.controller.ts:147` |
| POST | `/auth/recovery-request` | Não declarado no controller | `server/src/auth/auth.controller.ts:152` |
| POST | `/auth/refresh` | Não declarado no controller | `server/src/auth/auth.controller.ts:124` |
| POST | `/auth/register` | Não declarado no controller | `server/src/auth/auth.controller.ts:96` |
| GET | `/auth/supervisors` | JwtAuthGuard | `server/src/auth/auth.controller.ts:188` |
| GET | `/avaliacoes` | JwtAuthGuard | `server/src/avaliacoes/avaliacoes.controller.ts:50` |
| POST | `/avaliacoes` | JwtAuthGuard, RolesGuard | `server/src/avaliacoes/avaliacoes.controller.ts:105` |
| POST | `/avaliacoes-imagem` | JwtAuthGuard | `server/src/avaliacao-imagem/avaliacao-imagem.controller.ts:44` |
| DELETE | `/avaliacoes-imagem/:id` | JwtAuthGuard | `server/src/avaliacao-imagem/avaliacao-imagem.controller.ts:100` |
| POST | `/avaliacoes-imagem/:id/capturas/:captureId/concluir-upload` | JwtAuthGuard | `server/src/avaliacao-imagem/avaliacao-imagem.controller.ts:62` |
| POST | `/avaliacoes-imagem/:id/reprocessar` | JwtAuthGuard | `server/src/avaliacao-imagem/avaliacao-imagem.controller.ts:73` |
| GET | `/avaliacoes-imagem/:id/resultados` | JwtAuthGuard | `server/src/avaliacao-imagem/avaliacao-imagem.controller.ts:91` |
| GET | `/avaliacoes-imagem/:id/status` | JwtAuthGuard | `server/src/avaliacao-imagem/avaliacao-imagem.controller.ts:82` |
| POST | `/avaliacoes-imagem/:id/upload-urls` | JwtAuthGuard | `server/src/avaliacao-imagem/avaliacao-imagem.controller.ts:53` |
| PUT | `/avaliacoes-imagem/uploads/local/:token` | Não declarado no controller | `server/src/avaliacao-imagem/avaliacao-imagem.controller.ts:30` |
| DELETE | `/avaliacoes/:id` | JwtAuthGuard, RolesGuard | `server/src/avaliacoes/avaliacoes.controller.ts:134` |
| GET | `/avaliacoes/:id` | JwtAuthGuard | `server/src/avaliacoes/avaliacoes.controller.ts:95` |
| PATCH | `/avaliacoes/:id` | JwtAuthGuard, RolesGuard | `server/src/avaliacoes/avaliacoes.controller.ts:123` |
| PATCH | `/avaliacoes/:id/revisar` | JwtAuthGuard, RolesGuard | `server/src/avaliacoes/avaliacoes.controller.ts:112` |
| GET | `/avaliacoes/paciente/:pacienteId/relatorio-clinico` | JwtAuthGuard | `server/src/avaliacoes/avaliacoes.controller.ts:82` |
| GET | `/avaliacoes/pendencias/:pacienteId` | JwtAuthGuard | `server/src/avaliacoes/avaliacoes.controller.ts:73` |
| GET | `/conteudos` | JwtAuthGuard | `server/src/conteudos/conteudos.controller.ts:48` |
| POST | `/conteudos` | JwtAuthGuard | `server/src/conteudos/conteudos.controller.ts:58` |
| DELETE | `/conteudos/:id` | JwtAuthGuard | `server/src/conteudos/conteudos.controller.ts:74` |
| PATCH | `/conteudos/:id` | JwtAuthGuard | `server/src/conteudos/conteudos.controller.ts:64` |
| DELETE | `/conteudos/:id/arquivo` | JwtAuthGuard | `server/src/conteudos/conteudos.controller.ts:138` |
| GET | `/conteudos/:id/arquivo` | JwtAuthGuard | `server/src/conteudos/conteudos.controller.ts:122` |
| POST | `/conteudos/:id/arquivo` | JwtAuthGuard | `server/src/conteudos/conteudos.controller.ts:80` |
| POST | `/csp-report` | Não declarado no controller | `server/src/app.controller.ts:23` |
| GET | `/health` | Não declarado no controller | `server/src/app.controller.ts:13` |
| GET | `/mets` | JwtAuthGuard | `server/src/mets/mets.controller.ts:118` |
| POST | `/mets` | JwtAuthGuard, RolesGuard | `server/src/mets/mets.controller.ts:133` |
| DELETE | `/mets/:id` | JwtAuthGuard, RolesGuard | `server/src/mets/mets.controller.ts:147` |
| GET | `/mets/:id` | JwtAuthGuard | `server/src/mets/mets.controller.ts:128` |
| PATCH | `/mets/:id` | JwtAuthGuard, RolesGuard | `server/src/mets/mets.controller.ts:140` |
| POST | `/mets/calcular` | JwtAuthGuard | `server/src/mets/mets.controller.ts:123` |
| GET | `/notificacoes` | JwtAuthGuard | `server/src/notificacoes/notificacoes.controller.ts:27` |
| POST | `/notificacoes` | JwtAuthGuard | `server/src/notificacoes/notificacoes.controller.ts:42` |
| DELETE | `/notificacoes/:id` | JwtAuthGuard, RolesGuard | `server/src/notificacoes/notificacoes.controller.ts:61` |
| PATCH | `/notificacoes/:id` | JwtAuthGuard, RolesGuard | `server/src/notificacoes/notificacoes.controller.ts:54` |
| PATCH | `/notificacoes/:id/resolver` | JwtAuthGuard | `server/src/notificacoes/notificacoes.controller.ts:48` |
| GET | `/observability/alerts` | JwtAuthGuard, RolesGuard | `server/src/observability/observability.controller.ts:28` |
| POST | `/observability/drill` | JwtAuthGuard, RolesGuard | `server/src/observability/observability.controller.ts:47` |
| GET | `/observability/errors` | JwtAuthGuard, RolesGuard | `server/src/observability/observability.controller.ts:33` |
| GET | `/observability/events` | JwtAuthGuard, RolesGuard | `server/src/observability/observability.controller.ts:38` |
| GET | `/observability/metrics` | JwtAuthGuard, RolesGuard | `server/src/observability/observability.controller.ts:18` |
| POST | `/observability/reset` | JwtAuthGuard, RolesGuard | `server/src/observability/observability.controller.ts:60` |
| GET | `/observability/slo` | JwtAuthGuard, RolesGuard | `server/src/observability/observability.controller.ts:23` |
| GET | `/pacientes` | JwtAuthGuard | `server/src/pacientes/pacientes.controller.ts:83` |
| POST | `/pacientes` | JwtAuthGuard, RolesGuard | `server/src/pacientes/pacientes.controller.ts:130` |
| DELETE | `/pacientes/:id` | JwtAuthGuard, RolesGuard | `server/src/pacientes/pacientes.controller.ts:241` |
| GET | `/pacientes/:id` | JwtAuthGuard | `server/src/pacientes/pacientes.controller.ts:117` |
| PATCH | `/pacientes/:id` | JwtAuthGuard, RolesGuard | `server/src/pacientes/pacientes.controller.ts:137` |
| POST | `/pacientes/:id/anexos` | JwtAuthGuard, RolesGuard | `server/src/pacientes/pacientes.controller.ts:169` |
| DELETE | `/pacientes/:id/anexos/:filename` | JwtAuthGuard, RolesGuard | `server/src/pacientes/pacientes.controller.ts:230` |
| GET | `/pacientes/:id/anexos/:filename` | JwtAuthGuard | `server/src/pacientes/pacientes.controller.ts:213` |
| POST | `/pacientes/:id/mensagens-professor` | JwtAuthGuard | `server/src/pacientes/pacientes.controller.ts:148` |
| PATCH | `/pacientes/:id/onboarding` | JwtAuthGuard, RolesGuard | `server/src/pacientes/pacientes.controller.ts:158` |
| GET | `/pacientes/:id/onboarding-status` | JwtAuthGuard | `server/src/pacientes/pacientes.controller.ts:108` |
| GET | `/pacientes/triagem-publica` | JwtAuthGuard | `server/src/pacientes/pacientes.controller.ts:102` |
| GET | `/planos-alimentares` | JwtAuthGuard | `server/src/planos-alimentares/plano-alimentar.controller.ts:143` |
| POST | `/planos-alimentares` | JwtAuthGuard, RolesGuard | `server/src/planos-alimentares/plano-alimentar.controller.ts:164` |
| DELETE | `/planos-alimentares/:id` | JwtAuthGuard, RolesGuard | `server/src/planos-alimentares/plano-alimentar.controller.ts:202` |
| GET | `/planos-alimentares/:id` | JwtAuthGuard | `server/src/planos-alimentares/plano-alimentar.controller.ts:158` |
| PATCH | `/planos-alimentares/:id` | JwtAuthGuard, RolesGuard | `server/src/planos-alimentares/plano-alimentar.controller.ts:171` |
| POST | `/planos-alimentares/:id/ativar` | JwtAuthGuard, RolesGuard | `server/src/planos-alimentares/plano-alimentar.controller.ts:182` |
| GET | `/planos-alimentares/:id/pdf` | JwtAuthGuard | `server/src/planos-alimentares/plano-alimentar.controller.ts:189` |
| GET | `/planos-alimentares/paciente/:pacienteId/contexto` | JwtAuthGuard | `server/src/planos-alimentares/plano-alimentar.controller.ts:149` |
| GET | `/projetos` | JwtAuthGuard | `server/src/projetos/projetos.controller.ts:78` |
| POST | `/projetos` | JwtAuthGuard | `server/src/projetos/projetos.controller.ts:225` |
| DELETE | `/projetos/:id` | JwtAuthGuard | `server/src/projetos/projetos.controller.ts:241` |
| GET | `/projetos/:id` | JwtAuthGuard | `server/src/projetos/projetos.controller.ts:212` |
| PATCH | `/projetos/:id` | JwtAuthGuard | `server/src/projetos/projetos.controller.ts:231` |
| GET | `/projetos/ideias` | JwtAuthGuard | `server/src/projetos/projetos.controller.ts:160` |
| POST | `/projetos/ideias` | JwtAuthGuard | `server/src/projetos/projetos.controller.ts:166` |
| DELETE | `/projetos/ideias/:id` | JwtAuthGuard | `server/src/projetos/projetos.controller.ts:203` |
| PATCH | `/projetos/ideias/:id` | JwtAuthGuard | `server/src/projetos/projetos.controller.ts:193` |
| DELETE | `/projetos/ideias/:id/interesse` | JwtAuthGuard | `server/src/projetos/projetos.controller.ts:184` |
| POST | `/projetos/ideias/:id/interesse` | JwtAuthGuard | `server/src/projetos/projetos.controller.ts:175` |
| GET | `/projetos/producoes` | JwtAuthGuard | `server/src/projetos/projetos.controller.ts:84` |
| POST | `/projetos/producoes` | JwtAuthGuard | `server/src/projetos/projetos.controller.ts:90` |
| DELETE | `/projetos/producoes/:id` | JwtAuthGuard | `server/src/projetos/projetos.controller.ts:151` |
| PATCH | `/projetos/producoes/:id` | JwtAuthGuard | `server/src/projetos/projetos.controller.ts:124` |
| GET | `/projetos/producoes/:id/arquivo/:filename` | JwtAuthGuard | `server/src/projetos/projetos.controller.ts:134` |
| GET | `/projetos/public` | Não declarado no controller | `server/src/projetos/projetos.controller.ts:73` |
| POST | `/public/inscricao` | Não declarado no controller | `server/src/public/public.controller.ts:16` |
| GET | `/public/stats` | Não declarado no controller | `server/src/public/public.controller.ts:11` |
| GET | `/ready` | Não declarado no controller | `server/src/app.controller.ts:18` |
| GET | `/settings/admin-console` | JwtAuthGuard, RolesGuard | `server/src/settings/settings.controller.ts:13` |
| PATCH | `/settings/admin-console` | JwtAuthGuard, RolesGuard | `server/src/settings/settings.controller.ts:20` |
| GET | `/solicitacoes-acesso` | JwtAuthGuard, RolesGuard | `server/src/solicitacoes-acesso/solicitacoes.controller.ts:45` |
| POST | `/solicitacoes-acesso` | Não declarado no controller | `server/src/solicitacoes-acesso/solicitacoes.controller.ts:36` |
| DELETE | `/solicitacoes-acesso/:id` | JwtAuthGuard, RolesGuard | `server/src/solicitacoes-acesso/solicitacoes.controller.ts:85` |
| GET | `/solicitacoes-acesso/:id` | JwtAuthGuard, RolesGuard | `server/src/solicitacoes-acesso/solicitacoes.controller.ts:57` |
| PATCH | `/solicitacoes-acesso/:id` | JwtAuthGuard, RolesGuard | `server/src/solicitacoes-acesso/solicitacoes.controller.ts:68` |
| POST | `/solicitacoes-acesso/:id/approve` | JwtAuthGuard, RolesGuard | `server/src/solicitacoes-acesso/solicitacoes.controller.ts:75` |
| POST | `/taco` | JwtAuthGuard, RolesGuard | `server/src/taco/taco.controller.ts:175` |
| DELETE | `/taco/:id` | JwtAuthGuard, RolesGuard | `server/src/taco/taco.controller.ts:189` |
| GET | `/taco/:id` | JwtAuthGuard | `server/src/taco/taco.controller.ts:170` |
| PATCH | `/taco/:id` | JwtAuthGuard, RolesGuard | `server/src/taco/taco.controller.ts:182` |
| GET | `/taco/buscar` | JwtAuthGuard | `server/src/taco/taco.controller.ts:148` |
| POST | `/taco/calcular` | JwtAuthGuard | `server/src/taco/taco.controller.ts:157` |
| POST | `/taco/calcular-lote` | JwtAuthGuard | `server/src/taco/taco.controller.ts:165` |
| GET | `/tarefas` | JwtAuthGuard | `server/src/tarefas/tarefas.controller.ts:31` |
| POST | `/tarefas` | JwtAuthGuard, RolesGuard | `server/src/tarefas/tarefas.controller.ts:41` |
| DELETE | `/tarefas/:id` | JwtAuthGuard, RolesGuard | `server/src/tarefas/tarefas.controller.ts:61` |
| PATCH | `/tarefas/:id` | JwtAuthGuard, RolesGuard | `server/src/tarefas/tarefas.controller.ts:54` |
| PATCH | `/tarefas/:id/resolver` | JwtAuthGuard | `server/src/tarefas/tarefas.controller.ts:48` |
| GET | `/users` | JwtAuthGuard | `server/src/users/users.controller.ts:88` |
| POST | `/users` | JwtAuthGuard, RolesGuard | `server/src/users/users.controller.ts:141` |
| DELETE | `/users/:id` | JwtAuthGuard, RolesGuard | `server/src/users/users.controller.ts:171` |
| GET | `/users/:id` | JwtAuthGuard | `server/src/users/users.controller.ts:127` |
| PATCH | `/users/:id` | JwtAuthGuard, RolesGuard | `server/src/users/users.controller.ts:164` |
| PATCH | `/users/:id/permissions` | JwtAuthGuard, RolesGuard | `server/src/users/users.controller.ts:148` |
| PATCH | `/users/:id/reset-password` | JwtAuthGuard, RolesGuard | `server/src/users/users.controller.ts:181` |
| GET | `/users/equipe-atendimento` | JwtAuthGuard | `server/src/users/users.controller.ts:113` |
| GET | `/users/meus-supervisionados` | JwtAuthGuard | `server/src/users/users.controller.ts:107` |
| GET | `/users/supervisores` | JwtAuthGuard, RolesGuard | `server/src/users/users.controller.ts:120` |
