# CI/CD Operacional

## Workflows

- `CI` (`.github/workflows/ci.yml`)
  - Triggers: `pull_request` (main/develop) e `push` (main)
  - Gates atuais:
    - guard de schema runtime (`npm run guard:schema`)
    - install frontend/backend
    - backend TypeScript lint (`npm --prefix server run lint`)
    - `npm run lint`
    - `npm run build` (frontend)
    - `npm run test:core`
    - smoke de API com Postgres (`npm run smoke:api`)
    - e2e critico (`npm run test:e2e:critical`)
    - e2e contratos por role (`npm run test:e2e:roles`)
    - e2e analytics/export (`npm run test:e2e:analytics`)
  - Fixture de analytics no CI:
    - `node server/scripts/seed-ci-users.js`
    - `node server/scripts/seed-ci-analytics.js`
  - Evidencias publicadas como artifact (`api-smoke-artifacts`):
    - `api.log`
    - `e2e-artifacts/e2e-analytics-report.json`

- `Deploy` (`.github/workflows/deploy.yml`)
  - Trigger: `workflow_dispatch`
  - Inputs:
    - `ref` (branch/tag/SHA)
    - `environment` (`staging`/`production`)
    - `run_migrations` (`true`/`false`)
  - Gates obrigatorios antes do deploy:
    - preflight: guard de schema, lint, build frontend/backend, core tests
    - api gates: smoke + e2e critico + e2e roles + e2e analytics/export
    - fixture deterministica de analytics antes dos e2e
  - Fluxo:
    - resolve commit real do artefato com `git rev-parse HEAD`
    - gera artefato com nome baseado no commit real
    - inclui `release.json` (releaseId/sourceRef/workflowRun/builtAt)
    - publica release em `releases/<releaseId>` no servidor
    - valida manifesto do release antes de trocar `current`
    - reinicia servico (obrigatorio)
    - valida healthcheck
    - auto-rollback de aplicacao em falha
    - restore de banco em falha quando deploy rodou migrations
    - pruning de releases por data real (mantem as 5 mais recentes)
  - Evidencias publicadas no gate de API (`deploy-api-gates-artifacts`):
    - `api.log`
    - `e2e-artifacts/e2e-analytics-report.json`

- `Rollback` (`.github/workflows/rollback.yml`)
  - Trigger: `workflow_dispatch`
  - Inputs:
    - `environment`
    - `release_id` (opcional; vazio usa `previous`)
    - `restore_database` (`true`/`false`)
  - Fluxo:
    - troca `current` para release alvo
    - opcionalmente executa restore de banco
    - reinicia servico
    - valida healthcheck
    - se rollback falhar, restaura release anterior automaticamente

- `Operational Drill` (`.github/workflows/operational-drill.yml`)
  - Trigger: `workflow_dispatch` (staging)
  - Objetivo:
    - executar drill de observabilidade (latencia, erro, recuperacao)
    - validar acionamento e resolucao de alertas SLO
    - gerar artifacts (`before`, `latency`, `error`, `recover`, `summary`)
  - Requisitos de secrets no environment:
    - `DRILL_API_BASE_URL`
    - preferencial: `DRILL_ADMIN_EMAIL` + `DRILL_ADMIN_PASSWORD`
    - fallback: `DRILL_ADMIN_TOKEN`

## Secrets obrigatorios por environment

- `DEPLOY_HOST`
- `DEPLOY_USER`
- `DEPLOY_PATH`
- `DEPLOY_SSH_PRIVATE_KEY`
- `DEPLOY_HEALTHCHECK_URL`
- `DEPLOY_RESTART_COMMAND`

Obrigatorios quando `run_migrations=true` no workflow `Deploy`:

- `DEPLOY_DB_BACKUP_COMMAND`
- `DEPLOY_DB_RESTORE_COMMAND`

`DEPLOY_DB_RESTORE_COMMAND` tambem e obrigatorio no `Rollback` quando `restore_database=true`.

## Estrutura esperada no servidor

- `<DEPLOY_PATH>/artifacts`
- `<DEPLOY_PATH>/releases/<release_id>`
- `<DEPLOY_PATH>/current` (symlink)
- `<DEPLOY_PATH>/previous` (symlink)

Cada release deve conter `release.json`.

## Politica de rollback de banco

- Deploy com migrations sempre deve executar backup de banco antes do `migration:run:prod`.
- Em caso de falha apos backup, o workflow de deploy faz:
  1. rollback de aplicacao para `previous`
  2. restore de banco com `DEPLOY_DB_RESTORE_COMMAND`
- Rollback manual pode executar restore com `restore_database=true`.

## Staging drill obrigatorio

Antes de aprovar producao, executar drill em `staging`:

1. Deploy em `staging` com `run_migrations=true`.
2. Forcar falha controlada pos-migration (ex.: healthcheck invalido temporario).
3. Confirmar:
   - rollback automatico do app
   - restore de banco executado
   - servico recuperado dentro do RTO
4. Registrar evidencias (logs do workflow + horario + releaseId recuperado).

## Politica recomendada

- `main` protegida com status checks obrigatorios:
  - `CI / Quality Gates`
  - `CI / API Smoke Tests`
- Deploy em `production` somente via `workflow_dispatch` com aprovacao do environment.
- Rollback habilitado para lideres tecnicos/on-call.

## Dev loop local (analytics)

Para validar analytics/export localmente com fixture deterministica:

1. Subir API local com banco disponivel.
2. Executar `npm run test:e2e:analytics:local`.
3. O comando faz seed de usuarios + seed analitico + e2e analytics.
