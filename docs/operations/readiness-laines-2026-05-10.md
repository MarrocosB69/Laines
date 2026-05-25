# Readiness LAINES - 2026-05-10

## Status da rodada

Estado: aprovado para continuar preparacao de homologacao/staging.

Rodada local executada contra API em `http://localhost:4000`, banco local `up` e preview frontend em `http://127.0.0.1:4173`.

Ainda nao e go-live final porque os mesmos checks precisam ser repetidos em staging/servidor com credenciais reais, variaveis de producao e backup validado.

## Checks executados

| Check | Resultado | Observacao |
| --- | --- | --- |
| `npm run lint` | Passou | 0 erros, 7 warnings antigos |
| `npm --prefix server run lint` | Passou | TypeScript sem erro |
| `npm run guard:schema` | Passou | Runtime schema patch guard OK |
| `npm run test:core` | Passou | Inclui contrato de permissoes, avaliacoes e soft delete |
| `npm run build` | Passou | Build Vite de producao gerado |
| `npm audit --omit=dev` | Passou | 0 vulnerabilidades prod |
| `npm --prefix server audit --omit=dev` | Passou | 0 vulnerabilidades prod |
| Import case-sensitive `components/avaliacoes` | Passou | Nenhum import com case incorreto encontrado |
| `npm run seed:e2e` | Passou | 5 usuarios locais criados/atualizados |
| `npm run test:e2e:env` | Passou | Credenciais E2E locais validadas |
| `npm run test:e2e:roles` | Passou | Admin, aluno, professor, tecnico e atleta |
| `npm run smoke:api` | Passou | Health, auth sem token e validacao de payload |
| `npm run test:e2e:critical` | Passou | Login, `/auth/me`, observability e `logout-all` |
| `npm run test:e2e:auth-session` | Passou | Refresh HttpOnly, rotacao, reuse e revogacao |
| `npm run test:e2e:avaliacoes` | Passou | Criacao/finalizacao/bloqueios/pendencias |
| `npm run assess:security` | Passou | 9 checks, 0 falhas |
| `npm run assess:browser` | Passou parcial | Chromium desktop/mobile passaram; Firefox/WebKit skip por browsers nao instalados |

## Correcao aplicada nesta rodada

- Portal do atleta: a projecao publica de avaliacoes agora oculta `classificacao` e `classificacaoLabel` para tipos sensiveis:
  - `triagem_reds`
  - `psicologia`
  - `exames_laboratoriais`
- Teste de contrato adicionado: `avaliacoes.athlete-public-projection-hides-sensitive-classification`.
- Seed E2E local ajustado para incluir `tecnico` e `atleta`, alem de `admin`, `professor` e `aluno`.
- Notificacoes/tarefas: centro compartilhado habilitado para admin, professor, aluno, atleta, equipe tecnica e rotas internas.
- Notificacoes: `GET /notificacoes` passa a retornar por padrao apenas itens nao resolvidos do usuario logado; `PATCH /notificacoes/:id/resolver` marca `readAt` e remove o item da central.
- Notificacoes por diretoria/perfil: `POST /notificacoes` aceita `targetRole(s)` e `targetDiretoria(s)` e materializa notificacoes por usuario ativo.
- Tarefas: `PATCH /tarefas/:id/resolver` marca a tarefa como `concluida`; a leitura agora considera `todos`, role do usuario, diretoria cadastrada e coord. atendimento quando aplicavel.

## Credenciais E2E locais usadas

Estas credenciais sao de teste local e nao devem ser usadas em producao.

| Perfil | Email |
| --- | --- |
| Admin | `e2e-admin@teste.com` |
| Aluno | `e2e-aluno@teste.com` |
| Professor | `e2e-prof@teste.com` |
| Tecnico | `e2e-tecnico@teste.com` |
| Atleta | `e2e-atleta@teste.com` |

## Matriz operacional de permissoes

| Area | Admin/coordenacao/presidente/vice | Diretorias/coord. atendimento | Professor/profissional/pesquisador/colaborador | Tecnico | Aluno | Atleta |
| --- | --- | --- | --- | --- | --- | --- |
| Login e perfil | Sim | Sim | Sim | Sim | Sim | Sim |
| Usuarios - listar | Sim | Sim | Nao | Nao | Nao | Nao |
| Usuarios - criar/editar/resetar/inativar | Sim | Nao | Nao | Nao | Nao | Nao |
| Pacientes - listar | Global | Global | Escopo da equipe | Escopo da equipe | Escopo vinculado | Proprio cadastro |
| Pacientes - criar/editar | Sim | Coord. atendimento e extensao | Professor/profissional | Nao | Proprio escopo | Apenas onboarding |
| Pacientes - inativar | Sim | Nao | Nao | Nao | Nao | Nao |
| Avaliacoes - ler | Global | Global | Escopo da equipe | Escopo da equipe | Escopo vinculado | Proprias, com projecao publica |
| Avaliacoes - criar | Sim | Coord. atendimento | Nao | Nao | Proprio escopo | Auto-relatos seguros/EBIA liberada |
| Avaliacoes - editar | Sim | Coord. atendimento | Nao | Nao | Proprio escopo | Nao |
| Avaliacoes - remover | Sim | Nao | Nao | Nao | Nao | Nao |
| Agenda - criar | Sim | Coord. atendimento/extensao | Nao | Nao | Proprio escopo | Nao |
| Agenda - remarcar | Sim | Coord. atendimento/extensao | Nao | Nao | Proprio escopo | Propria consulta, dentro da regra |
| Plano alimentar | Sim | Restrito por rota | Escopo da equipe | Escopo da equipe | Proprio escopo | Sem rota dedicada no frontend |
| Auditoria/observabilidade/settings | Sim | Parcial conforme endpoint | Nao | Nao | Nao | Nao |

## Fluxo critico validado por leitura tecnica

1. Admin cria usuario/atleta e pode inativar sem apagar historico.
2. Paciente/atleta usa soft delete em inativacao.
3. Aluno cria e edita avaliacoes apenas para paciente vinculado.
4. Professor acessa prontuario/avaliacao em modo leitura quando dentro do escopo.
5. Atleta ve apenas o proprio cadastro, agenda e avaliacoes com projecao publica.
6. Atleta pode preencher:
   - alimentar
   - hidratacao
   - carga de treino
   - fisioterapia
   - EBIA somente quando liberada pela equipe
7. Atleta nao pode criar RED-S, psicologia ou exames laboratoriais.

## Pendencias antes do go-live final

1. Repetir a rodada E2E em staging/servidor com credenciais reais por perfil:
   - `E2E_ADMIN_EMAIL`
   - `E2E_ADMIN_PASSWORD`
   - `E2E_STUDENT_EMAIL`
   - `E2E_STUDENT_PASSWORD`
   - `E2E_PROFESSOR_EMAIL`
   - `E2E_PROFESSOR_PASSWORD`
   - `E2E_TEAM_EMAIL`
   - `E2E_TEAM_PASSWORD`
   - `E2E_ATHLETE_EMAIL`
   - `E2E_ATHLETE_PASSWORD`
2. Rodar em staging:
   - `npm run smoke:api`
   - `npm run test:e2e:critical`
   - `npm run test:e2e:roles`
   - `npm run test:e2e:avaliacoes`
   - `npm run test:e2e:auth-session`
   - `npm run assess:security`
   - `npm run assess:browser`
3. Confirmar variaveis de producao:
   - `NODE_ENV=production`
   - `VITE_API_URL`
   - `CORS_ORIGIN`
   - `JWT_SECRET`
   - `JWT_REFRESH_SECRET`
   - `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
   - `DB_SYNC=false`
   - `DB_MIGRATIONS_RUN=true`
   - `AUTH_REFRESH_COOKIE_SECURE=true`
4. Validar backup/restore do PostgreSQL antes da primeira migration em producao.
5. Executar smoke manual final: login, cadastro de atleta, prontuario, avaliacao, portal do atleta e inativacao.

## Evidencias geradas

- `e2e-artifacts/security-assessment.json`: 9 checks, 9 passed, 0 failed.
- `e2e-artifacts/browser-assessment.json`: 8 checks passed em Chromium desktop/mobile, 0 failed, 3 skipped por browsers nao instalados.
- Saida de `npm run test:e2e:roles`: contratos por perfil validados com sucesso.
- Saida de `npm run test:e2e:avaliacoes`: fluxo de finalizacao de avaliacoes validado com sucesso.
- Saida de `npm run test:e2e:auth-session`: refresh token, reuse detection e revogacao validados com sucesso.
