# Matriz de autorização

@work-item-id WI-004

Revisão de 23/09/2026, UPD-19 e complemento do UPD-12. Esta é a referência documental atual da autorização: papel, permissões efetivas, vínculo com o objeto e projeção de resposta são condições distintas. A tabela de maio foi preservada ao final apenas como histórico.

## Camadas da decisão

| Camada | Regra atual | Fonte de implementação |
| --- | --- | --- |
| Sessão HTTP | JWT de acesso válido, usuário ativo, versão de sessão atual e família ativa; a estratégia recarrega o cadastro e as permissões. | [JwtStrategy](../server/src/auth/jwt.strategy.ts), [JwtAuthGuard](../server/src/auth/jwt-auth.guard.ts) |
| Papel na rota | `RolesGuard` aplica os papéis declarados pelo método ou controlador. Ausência de `@Roles` não elimina as verificações no serviço. | [RolesGuard](../server/src/auth/roles.guard.ts) |
| Permissões | Permissões explícitas aceitas para o perfil e permissões derivadas da diretoria compõem `getEffectivePermissions`. A aplicação verifica permissões em controladores e serviços; não há um `PermissionsGuard` global. | [Constantes de acesso](../server/src/common/domain/access.constants.ts), [decisões de acesso](../server/src/auth/access-control.ts) |
| Objeto clínico | `resolveClinicalLink` decide o vínculo; `clinicalScopeCondition` delimita listagens. Ter capacidade de abrir uma área ou ser autor histórico de uma avaliação não substitui o vínculo atual. | [Contrato de autorização](../server/src/auth/authorization.ts) |
| Interface | Login e `/auth/me` entregam `capabilities` de liga, atendimento e gestão. A interface usa essa projeção; cada operação continua sujeita ao servidor. | [AuthService](../server/src/auth/auth.service.ts), [AuthContext](../src/contexts/AuthContext.jsx) |

## Papéis e vínculos clínicos

| Perfil | Condição de acesso ao paciente | Limite |
| --- | --- | --- |
| `admin`, `coordenacao` | Vínculo `gestao`, exceção operacional prevista no código. | Leituras clínicas instrumentadas registram `acesso_clinico_gestao`; não implica habilitação para revisão profissional do plano. |
| `aluno`, `presidente`, `vice` | Aluno responsável ou membro da equipe técnica/multiprofissional do paciente. | Presidência e vice-presidência pertencem a `STUDENT_MEMBER_ROLES`, não a `ADMIN_ROLES`. |
| `professor`, `profissional`, `pesquisador`, `tecnico`, `colaborador` | Supervisor do caso, responsável, equipe ou cadeia de supervisão/profissional do aluno responsável. | O vínculo permite somente as ações e projeções admitidas pelo controlador e serviço de cada domínio. |
| `atleta` | `paciente.atletaUserId` igual ao usuário autenticado. | Dados próprios e projeção do portal; não equivale ao prontuário profissional completo. |
| Diretoria e demais papéis sem vínculo clínico | Cargo acadêmico isolado não cria vínculo assistencial. | Gestão da área da liga permanece independente do atendimento. |

Fontes: [grupos de papéis](../server/src/common/domain/access.constants.ts), [escopos de acesso](../server/src/auth/access-control.ts) e [resolução do vínculo](../server/src/auth/authorization.ts). Para a capacidade de atendimento do discente, `buildCapabilities` também considera supervisor e projeto cadastrados.

## Matriz atual por domínio e canal

As linhas agrupam operações relacionadas; os controladores vinculados contêm as rotas e papéis completos. Uma capacidade exibida na interface ou uma permissão delegada não amplia automaticamente um `RolesGuard` mais restrito.

| Domínio / operação | Verificação de entrada e escopo efetivo | Fonte |
| --- | --- | --- |
| Pacientes: leitura e prontuário | JWT; listagem e objeto seguem vínculo clínico, com projeção própria para atleta. | [Controlador](../server/src/pacientes/pacientes.controller.ts), [serviço](../server/src/pacientes/pacientes.service.ts) |
| Pacientes: criação, alteração e anexos | JWT + papéis da operação; criação aceita gestão, professor, profissional, presidente e vice. Alteração também admite aluno. O serviço verifica ação e vínculo; onboarding é do atleta. | [Controlador](../server/src/pacientes/pacientes.controller.ts), [serviço](../server/src/pacientes/pacientes.service.ts) |
| Avaliações: leitura, escrita e revisão | Leitura por ID exige vínculo atual; gestão mantém a exceção auditada. A listagem genérica discente combina autoria e vínculo atual. Escrita/revisão têm listas de papéis próprias e regras de área, autoria, estado e sessão. Atleta só preenche formulários liberados para ele. | [Controlador](../server/src/avaliacoes/avaliacoes.controller.ts), [serviço](../server/src/avaliacoes/avaliacoes.service.ts) |
| Planos: editar, revisar, ativar e entregar | JWT; operações de escrita também usam papéis. Vínculo, versão e estado são conferidos no serviço. Revisão exige professor/profissional ativo com CRN atual. Atleta recebe somente plano ativo com revisão válida; PDF verifica a versão informada. | [Controlador](../server/src/planos-alimentares/plano-alimentar.controller.ts), [serviço](../server/src/planos-alimentares/plano-alimentar.service.ts), [contrato](product/construction/fechamento/logical_design.md#plano) |
| Agendamentos | JWT e vínculo; criar é limitado a gestão/discentes. Remarcar e atualizar também admitem atleta sob as restrições do serviço. Excluir exige gestão. | [Controlador](../server/src/agendamentos/agendamentos.controller.ts), [serviço](../server/src/agendamentos/agendamentos.service.ts) |
| Indicadores e exportações | JWT + funções de autorização por permissão. Detalhamento e painel operacional ficam com gestão; delegados ficam no projeto vinculado e em projeção agregada. Exportação exige gestão ou permissões de pesquisa/marketing previstas no código. | [Controlador](../server/src/analytics/analytics.controller.ts), [decisões de acesso](../server/src/auth/access-control.ts) |
| Conteúdos da liga e arquivos | JWT + regras de categoria/estado no serviço. Publicado tem leitura transversal aos membros; gestão interna respeita diretoria e aprovação da coordenação. Upload usa `ConteudoUploadGuard` antes do interceptor. | [Serviço](../server/src/conteudos/conteudos.service.ts), [guard de upload](../server/src/conteudos/conteudo-upload.guard.ts) |
| Projetos e produções | JWT nas operações internas; vínculo, visibilidade, autoria e gestão de pesquisa são decididos pelo serviço. `/projetos/public` tem projeção pública própria. | [Controlador](../server/src/projetos/projetos.controller.ts), [serviço](../server/src/projetos/projetos.service.ts) |
| Membros e administração | Leitura de membros verifica permissões e projeta campos; mutações de usuários, permissões e senhas exigem `ADMIN_ROLES`. Solicitações administrativas, observabilidade e configuração usam suas regras de gestão. | [Usuários](../server/src/users/users.controller.ts), [solicitações](../server/src/solicitacoes-acesso/solicitacoes.controller.ts), [observabilidade](../server/src/observability/observability.controller.ts), [configuração](../server/src/settings/settings.controller.ts) |
| Avaliação por imagem | JWT e acesso ao paciente nas rotas clínicas; upload local tem contrato próprio de URL assinada. Estado experimental, retomada e limites de autorização estão no contrato específico. | [Contrato de imagem](operations/avaliacao-imagem.md), [controlador](../server/src/avaliacao-imagem/avaliacao-imagem.controller.ts) |
| WebSocket | Sessão e vínculo atuais são verificados na entrega. Eventos clínicos enviam apenas invalidação; gestão recarrega por HTTP e atleta não recebe eventos de avaliações. Notificações e tarefas seguem destinatário/atribuição. | [RealtimeGateway](../server/src/realtime/realtime.gateway.ts) |

## Evidência e limites

**Autoria histórica:** o complemento de 23/09 removeu o atalho de leitura por autoria em todos os tipos e adicionou vínculo atual à listagem genérica discente, preservando o filtro de autoria. A correção inicial do UPD-22 se limitava à imagem. Fonte: [serviço de avaliações](../server/src/avaliacoes/avaliacoes.service.ts); escopo e evidência: [WI-004](inception/fechamento/WI-004/README.md).

Em 23/09/2026, `node scripts/test-security-authorization.cjs` terminou com código 0 e 15 verificações sintéticas aprovadas, incluindo leitura real do serviço de avaliações, ex-autores, revogação e gestão auditada. [Cenários reproduzíveis](../scripts/test-security-authorization.cjs). Isso não é uma execução autenticada de todas as rotas, nem homologação de produção.

A trilha de gestão possui janela de cinco minutos em memória por usuário/objeto/ação e não bloqueia leitura em caso de falha de auditoria. As projeções de capacidade não substituem as condições mais específicas dos serviços. Inventário dos arquivos documentais revisados e seus limites: [operação](operations/README.md#candidato-local-upd-19).

O [gerador legado](../server/scripts/generate-rbac-matrix.ts) enumera metadados de guards/roles e sobrescreve este arquivo. Ele não representa permissões, vínculo ou projeção; não deve ser usado para publicar a matriz atual sem adaptar esse contrato.

## Apêndice histórico — matriz de maio

<details>
<summary>Fotografia obsoleta de 24/05/2026, preservada como evidência</summary>

As linhas abaixo não descrevem a autorização vigente. Em particular, a antiga expressão “sem restrição de role” não significa acesso irrestrito, e os grupos de papéis mudaram.

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

</details>
