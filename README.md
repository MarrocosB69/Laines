# LAINES App

Sistema web do ecossistema LAINES com frontend React (Vite) e backend NestJS + PostgreSQL.

## Estrutura

- `src/`: frontend (React)
- `server/src/`: API (NestJS)
- `server/src/database/migrations/`: migrations TypeORM

## Requisitos

- Node.js 20+
- PostgreSQL 14+

## Configuracao de ambiente

### Frontend (`.env`)

Exemplo:

```env
VITE_API_URL=http://localhost:4000
VITE_API_TIMEOUT_MS=20000
```

### Backend (`server/.env`)

Use `server/.env.example` como base e ajuste:

- `DB_*`
- `JWT_SECRET`
- `CORS_ORIGIN`
- `TRUST_PROXY` (producao com proxy/reverse-proxy)
- `MAINTENANCE_MODE` / `MAINTENANCE_BYPASS_TOKEN`
- `ACCESS_REQUEST_*` (anti-abuso da rota publica de solicitacao)
- `REALTIME_BROADCAST_ROLES`

## Rodando localmente

### 1. API

```bash
cd server
npm install
npm run migration:run
npm run start:dev
```

API padrao: `http://localhost:4000`

Health check: `GET /health`

### 2. Frontend

```bash
npm install
npm run dev
```

Frontend padrao: `http://localhost:5173`

## Build

### Frontend

```bash
npm run build
```

### Backend

```bash
cd server
npm run build
```

## Testes e validacao

### Core tests (automatizados)

```bash
npm run test:core
```

### Smoke de API (requer API no ar)

```bash
npm run smoke:api
```

### E2E critico (requer credenciais)

```bash
set E2E_EMAIL=seu@email.com
set E2E_PASSWORD=sua_senha
npm run test:e2e:critical
```

### E2E contratos por role (admin/aluno/professor)

```bash
set E2E_ADMIN_EMAIL=admin@email.com
set E2E_ADMIN_PASSWORD=senha_admin
set E2E_STUDENT_EMAIL=aluno@email.com
set E2E_STUDENT_PASSWORD=senha_aluno
set E2E_PROFESSOR_EMAIL=prof@email.com
set E2E_PROFESSOR_PASSWORD=senha_prof
set E2E_TEAM_EMAIL=tecnico@email.com
set E2E_TEAM_PASSWORD=senha_tecnico
set E2E_ATHLETE_EMAIL=atleta@email.com
set E2E_ATHLETE_PASSWORD=senha_atleta
set E2E_ALLOW_MUTATIONS=true
npm run test:e2e:roles
```

Observacoes:
- `E2E_ADMIN_*` e obrigatorio em CI para esse teste.
- `E2E_STUDENT_*`, `E2E_PROFESSOR_*`, `E2E_TEAM_*` e `E2E_ATHLETE_*` sao obrigatorios quando `E2E_ROLE_MATRIX_REQUIRED=true`.
- `E2E_ALLOW_MUTATIONS=true` habilita cleanup de escrita em `/tarefas` no teste de permissao.

### Validador de ambiente E2E (CI/local)

```bash
npm run test:e2e:env
```

Esse comando valida se todas as credenciais obrigatorias dos fluxos E2E estao configuradas.

### Pipeline completa

```bash
npm run test:all
```

Inclui `test:core`, `smoke:api`, `test:e2e:critical` e `test:e2e:roles`.

## Fluxos criticos recentes

- Solicitacao de acesso publica com protecao anti-abuso no backend.
- Aprovacao de solicitacao via endpoint unico:
  - `POST /solicitacoes-acesso/:id/approve`
- Remarcacao de consulta via endpoint transacional:
  - `POST /agendamentos/:id/remarcar`

## Seguranca e operacao

- `X-Request-Id` em todas as respostas.
- CORS restrito por configuracao.
- Headers de hardening HTTP.
- Health endpoint com validacao de banco (`database: up/down`).
- Readiness endpoint para operacao: `GET /ready`.
- Websocket autenticado por JWT e emissao segmentada por role.
- Maintenance mode via ambiente com bypass por header `x-maintenance-bypass`.

## Observabilidade

- Metricas operacionais: `GET /observability/metrics` (admin).
- Erros recentes: `GET /observability/errors` (admin).
- Eventos persistidos (alertas/erros): `GET /observability/events` (admin).
- `X-Request-Id` propagado em respostas e erros.
- Resumo analitico de relatorios: `GET /analytics/reports/overview` (area administrativa).

## Operacao

Documentacao operacional versionada:

- [`docs/operations/CICD.md`](docs/operations/CICD.md)
- [`docs/operations/SLO.md`](docs/operations/SLO.md)
- [`docs/operations/RUNBOOKS.md`](docs/operations/RUNBOOKS.md)
- [`docs/operations/PRODUCTION_CHECKLIST.md`](docs/operations/PRODUCTION_CHECKLIST.md)

## Observacoes

- Alertas de observabilidade podem ser enviados para webhook externo via `OBSERVABILITY_WEBHOOK_URL`.
- Para escala horizontal, recomenda-se mover rate-limits em memoria para store distribuido.
