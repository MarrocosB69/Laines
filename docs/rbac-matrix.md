# Matriz RBAC

Gerado automaticamente em 2026-05-24T21:30:53.841Z.

| Método | Rota | Guards | Roles permitidos |
| --- | --- | --- | --- |
| GET | `/agendamentos` | JwtAuthGuard | ⚠️ sem restrição de role |
| POST | `/agendamentos` | JwtAuthGuard, RolesGuard | admin, coordenacao, presidente, vice, coord_atendimento, diretoria_extensao, aluno, presidente, vice |
| DELETE | `/agendamentos/:id` | JwtAuthGuard, RolesGuard | admin, coordenacao, presidente, vice |
| GET | `/agendamentos/:id` | JwtAuthGuard | ⚠️ sem restrição de role |
| PATCH | `/agendamentos/:id` | JwtAuthGuard, RolesGuard | admin, coordenacao, presidente, vice, coord_atendimento, diretoria_extensao, aluno, presidente, vice, atleta |
| POST | `/agendamentos/:id/remarcar` | JwtAuthGuard, RolesGuard | admin, coordenacao, presidente, vice, coord_atendimento, diretoria_extensao, aluno, presidente, vice, atleta |
| GET | `/analytics/correlations` | JwtAuthGuard, RolesGuard | admin, coordenacao, presidente, vice, diretoria_marketing, diretoria_ensino, diretoria_pesquisa, diretoria_extensao, coord_atendimento |
| GET | `/analytics/dashboard/summary` | JwtAuthGuard, RolesGuard | admin, coordenacao, presidente, vice, diretoria_marketing, diretoria_ensino, diretoria_pesquisa, diretoria_extensao, coord_atendimento |
| GET | `/analytics/reports/export` | JwtAuthGuard, RolesGuard | admin, coordenacao, presidente, vice, diretoria_marketing, diretoria_ensino, diretoria_pesquisa, diretoria_extensao, coord_atendimento |
| GET | `/analytics/reports/overview` | JwtAuthGuard, RolesGuard | admin, coordenacao, presidente, vice, diretoria_marketing, diretoria_ensino, diretoria_pesquisa, diretoria_extensao, coord_atendimento |
| GET | `/auditoria` | JwtAuthGuard, RolesGuard | admin, coordenacao, presidente, vice |
| POST | `/auditoria` | JwtAuthGuard | ⚠️ sem restrição de role |
| DELETE | `/auditoria/:id` | JwtAuthGuard, RolesGuard | admin, coordenacao, presidente, vice |
| GET | `/auditoria/:id` | JwtAuthGuard, RolesGuard | admin, coordenacao, presidente, vice |
| POST | `/auth/change-password` | JwtAuthGuard | ⚠️ sem restrição de role |
| POST | `/auth/login` | nenhum | ⚠️ sem restrição de role |
| POST | `/auth/logout` | nenhum | ⚠️ sem restrição de role |
| POST | `/auth/logout-all` | JwtAuthGuard | ⚠️ sem restrição de role |
| GET | `/auth/me` | JwtAuthGuard | ⚠️ sem restrição de role |
| PATCH | `/auth/profile` | JwtAuthGuard | ⚠️ sem restrição de role |
| POST | `/auth/recover-password` | nenhum | ⚠️ sem restrição de role |
| POST | `/auth/refresh` | nenhum | ⚠️ sem restrição de role |
| POST | `/auth/register` | nenhum | ⚠️ sem restrição de role |
| GET | `/auth/supervisors` | JwtAuthGuard | ⚠️ sem restrição de role |
| GET | `/avaliacoes` | JwtAuthGuard | ⚠️ sem restrição de role |
| POST | `/avaliacoes` | JwtAuthGuard, RolesGuard | admin, coordenacao, presidente, vice, coord_atendimento, aluno, presidente, vice, atleta |
| DELETE | `/avaliacoes/:id` | JwtAuthGuard, RolesGuard | admin, coordenacao, presidente, vice |
| GET | `/avaliacoes/:id` | JwtAuthGuard | ⚠️ sem restrição de role |
| PATCH | `/avaliacoes/:id` | JwtAuthGuard, RolesGuard | admin, coordenacao, presidente, vice, coord_atendimento, aluno, presidente, vice |
| GET | `/avaliacoes/paciente/:pacienteId/relatorio-clinico` | JwtAuthGuard | ⚠️ sem restrição de role |
| GET | `/avaliacoes/pendencias/:pacienteId` | JwtAuthGuard | ⚠️ sem restrição de role |
| GET | `/conteudos` | JwtAuthGuard | ⚠️ sem restrição de role |
| POST | `/conteudos` | JwtAuthGuard, RolesGuard | admin, coordenacao, presidente, vice, diretoria_ensino, diretoria_extensao, coord_atendimento |
| DELETE | `/conteudos/:id` | JwtAuthGuard, RolesGuard | admin, coordenacao, presidente, vice, diretoria_ensino, diretoria_extensao, coord_atendimento |
| PATCH | `/conteudos/:id` | JwtAuthGuard, RolesGuard | admin, coordenacao, presidente, vice, diretoria_ensino, diretoria_extensao, coord_atendimento |
| POST | `/csp-report` | nenhum | ⚠️ sem restrição de role |
| GET | `/health` | nenhum | ⚠️ sem restrição de role |
| GET | `/mets` | JwtAuthGuard | ⚠️ sem restrição de role |
| POST | `/mets` | JwtAuthGuard, RolesGuard | admin, coordenacao, presidente, vice |
| DELETE | `/mets/:id` | JwtAuthGuard, RolesGuard | admin, coordenacao, presidente, vice |
| GET | `/mets/:id` | JwtAuthGuard | ⚠️ sem restrição de role |
| PATCH | `/mets/:id` | JwtAuthGuard, RolesGuard | admin, coordenacao, presidente, vice |
| POST | `/mets/calcular` | JwtAuthGuard | ⚠️ sem restrição de role |
| GET | `/notificacoes` | JwtAuthGuard | ⚠️ sem restrição de role |
| POST | `/notificacoes` | JwtAuthGuard | ⚠️ sem restrição de role |
| DELETE | `/notificacoes/:id` | JwtAuthGuard, RolesGuard | admin, coordenacao, presidente, vice |
| PATCH | `/notificacoes/:id` | JwtAuthGuard, RolesGuard | admin, coordenacao, presidente, vice |
| PATCH | `/notificacoes/:id/resolver` | JwtAuthGuard | ⚠️ sem restrição de role |
| GET | `/observability/alerts` | JwtAuthGuard, RolesGuard | admin, coordenacao, presidente, vice |
| POST | `/observability/drill` | JwtAuthGuard, RolesGuard | admin, coordenacao, presidente, vice |
| GET | `/observability/errors` | JwtAuthGuard, RolesGuard | admin, coordenacao, presidente, vice |
| GET | `/observability/events` | JwtAuthGuard, RolesGuard | admin, coordenacao, presidente, vice |
| GET | `/observability/metrics` | JwtAuthGuard, RolesGuard | admin, coordenacao, presidente, vice |
| POST | `/observability/reset` | JwtAuthGuard, RolesGuard | admin, coordenacao, presidente, vice |
| GET | `/observability/slo` | JwtAuthGuard, RolesGuard | admin, coordenacao, presidente, vice |
| GET | `/pacientes` | JwtAuthGuard | ⚠️ sem restrição de role |
| POST | `/pacientes` | JwtAuthGuard, RolesGuard | admin, coordenacao, presidente, vice, coord_atendimento, diretoria_extensao, professor, profissional, aluno, presidente, vice |
| DELETE | `/pacientes/:id` | JwtAuthGuard, RolesGuard | admin, coordenacao, presidente, vice |
| GET | `/pacientes/:id` | JwtAuthGuard | ⚠️ sem restrição de role |
| PATCH | `/pacientes/:id` | JwtAuthGuard, RolesGuard | admin, coordenacao, presidente, vice, coord_atendimento, diretoria_extensao, professor, profissional, aluno, presidente, vice |
| POST | `/pacientes/:id/anexos` | JwtAuthGuard, RolesGuard | admin, coordenacao, presidente, vice, coord_atendimento, diretoria_extensao, professor, profissional, aluno, presidente, vice |
| DELETE | `/pacientes/:id/anexos/:filename` | JwtAuthGuard, RolesGuard | admin, coordenacao, presidente, vice, coord_atendimento, diretoria_extensao, professor, profissional, aluno, presidente, vice |
| GET | `/pacientes/:id/anexos/:filename` | JwtAuthGuard | ⚠️ sem restrição de role |
| POST | `/pacientes/:id/mensagens-professor` | JwtAuthGuard | ⚠️ sem restrição de role |
| PATCH | `/pacientes/:id/onboarding` | JwtAuthGuard, RolesGuard | atleta |
| GET | `/pacientes/:id/onboarding-status` | JwtAuthGuard | ⚠️ sem restrição de role |
| GET | `/planos-alimentares` | JwtAuthGuard | ⚠️ sem restrição de role |
| POST | `/planos-alimentares` | JwtAuthGuard, RolesGuard | admin, coordenacao, presidente, vice, aluno, presidente, vice, professor, profissional, pesquisador, tecnico, colaborador |
| DELETE | `/planos-alimentares/:id` | JwtAuthGuard, RolesGuard | admin, coordenacao, presidente, vice, aluno, presidente, vice, professor, profissional, pesquisador, tecnico, colaborador |
| GET | `/planos-alimentares/:id` | JwtAuthGuard | ⚠️ sem restrição de role |
| PATCH | `/planos-alimentares/:id` | JwtAuthGuard, RolesGuard | admin, coordenacao, presidente, vice, aluno, presidente, vice, professor, profissional, pesquisador, tecnico, colaborador |
| POST | `/planos-alimentares/:id/ativar` | JwtAuthGuard, RolesGuard | admin, coordenacao, presidente, vice, aluno, presidente, vice, professor, profissional, pesquisador, tecnico, colaborador |
| GET | `/planos-alimentares/:id/pdf` | JwtAuthGuard | ⚠️ sem restrição de role |
| GET | `/planos-alimentares/paciente/:pacienteId/contexto` | JwtAuthGuard | ⚠️ sem restrição de role |
| GET | `/projetos` | JwtAuthGuard | ⚠️ sem restrição de role |
| POST | `/projetos` | JwtAuthGuard, RolesGuard | admin, coordenacao, presidente, vice, diretoria_pesquisa |
| DELETE | `/projetos/:id` | JwtAuthGuard, RolesGuard | admin, coordenacao, presidente, vice, diretoria_pesquisa |
| GET | `/projetos/:id` | JwtAuthGuard | ⚠️ sem restrição de role |
| PATCH | `/projetos/:id` | JwtAuthGuard, RolesGuard | admin, coordenacao, presidente, vice, diretoria_pesquisa |
| GET | `/projetos/public` | nenhum | ⚠️ sem restrição de role |
| GET | `/ready` | nenhum | ⚠️ sem restrição de role |
| GET | `/settings/admin-console` | JwtAuthGuard, RolesGuard | admin, coordenacao, presidente, vice, diretoria_marketing, diretoria_ensino, diretoria_pesquisa, diretoria_extensao, coord_atendimento |
| PATCH | `/settings/admin-console` | JwtAuthGuard, RolesGuard | admin, coordenacao, presidente, vice |
| GET | `/solicitacoes-acesso` | JwtAuthGuard, RolesGuard | admin, coordenacao, presidente, vice |
| POST | `/solicitacoes-acesso` | nenhum | ⚠️ sem restrição de role |
| DELETE | `/solicitacoes-acesso/:id` | JwtAuthGuard, RolesGuard | admin, coordenacao, presidente, vice |
| GET | `/solicitacoes-acesso/:id` | JwtAuthGuard, RolesGuard | admin, coordenacao, presidente, vice |
| PATCH | `/solicitacoes-acesso/:id` | JwtAuthGuard, RolesGuard | admin, coordenacao, presidente, vice |
| POST | `/solicitacoes-acesso/:id/approve` | JwtAuthGuard, RolesGuard | admin, coordenacao, presidente, vice |
| POST | `/taco` | JwtAuthGuard, RolesGuard | admin, coordenacao, presidente, vice |
| DELETE | `/taco/:id` | JwtAuthGuard, RolesGuard | admin, coordenacao, presidente, vice |
| GET | `/taco/:id` | JwtAuthGuard | ⚠️ sem restrição de role |
| PATCH | `/taco/:id` | JwtAuthGuard, RolesGuard | admin, coordenacao, presidente, vice |
| GET | `/taco/buscar` | JwtAuthGuard | ⚠️ sem restrição de role |
| POST | `/taco/calcular` | JwtAuthGuard | ⚠️ sem restrição de role |
| POST | `/taco/calcular-lote` | JwtAuthGuard | ⚠️ sem restrição de role |
| GET | `/tarefas` | JwtAuthGuard | ⚠️ sem restrição de role |
| POST | `/tarefas` | JwtAuthGuard, RolesGuard | admin, coordenacao, presidente, vice, diretoria_marketing, diretoria_ensino, diretoria_pesquisa, diretoria_extensao, coord_atendimento |
| DELETE | `/tarefas/:id` | JwtAuthGuard, RolesGuard | admin, coordenacao, presidente, vice, diretoria_marketing, diretoria_ensino, diretoria_pesquisa, diretoria_extensao, coord_atendimento |
| PATCH | `/tarefas/:id` | JwtAuthGuard, RolesGuard | admin, coordenacao, presidente, vice, diretoria_marketing, diretoria_ensino, diretoria_pesquisa, diretoria_extensao, coord_atendimento |
| PATCH | `/tarefas/:id/resolver` | JwtAuthGuard | ⚠️ sem restrição de role |
| GET | `/users` | JwtAuthGuard, RolesGuard | admin, coordenacao, presidente, vice, diretoria_marketing, diretoria_ensino, diretoria_pesquisa, diretoria_extensao, coord_atendimento |
| POST | `/users` | JwtAuthGuard, RolesGuard | admin, coordenacao, presidente, vice |
| DELETE | `/users/:id` | JwtAuthGuard, RolesGuard | admin, coordenacao, presidente, vice |
| GET | `/users/:id` | JwtAuthGuard, RolesGuard | admin, coordenacao, presidente, vice, diretoria_marketing, diretoria_ensino, diretoria_pesquisa, diretoria_extensao, coord_atendimento |
| PATCH | `/users/:id` | JwtAuthGuard, RolesGuard | admin, coordenacao, presidente, vice |
| PATCH | `/users/:id/reset-password` | JwtAuthGuard, RolesGuard | admin, coordenacao, presidente, vice |
