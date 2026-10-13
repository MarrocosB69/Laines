# Relatorio de validacao tecnica

## Data e ambiente

- Data da auditoria: execucoes registradas em 2026-06-10 e documentos gerados em 2026-06-11.
- Rodada pos-correcoes: executada em 2026-06-11, com revalidacao de build, testes core, RBAC, seguranca, analytics local e browser assessment.
- Timezone local: America/Sao_Paulo.
- Sistema operacional: Windows, PowerShell, workspace `C:\Users\bruno\laines-app`.
- Node.js: `v24.12.0`.
- npm: `11.6.2`.
- Banco de dados: o projeto requer PostgreSQL 14+ segundo `README.md`; o cliente `psql` nao estava disponivel no PATH, portanto a versao local do banco nao foi verificada. A API local iniciou e respondeu aos testes.
- API usada nos testes: `http://localhost:4000` / `http://127.0.0.1:4000`.
- Frontend preview usado nos testes browser: `http://127.0.0.1:4173`.

## Diretorios e arquivos analisados

- Frontend: `src/`, com rotas em `src/App.jsx`, portal do atleta em `src/views/Athlete/`, prontuario em `src/views/Student/Patients/PatientProntuario.jsx`, relatorios em `src/views/admin/ReportsPage/`.
- Backend: `server/src/`, com modulos `auth`, `pacientes`, `avaliacoes`, `analytics`, `planos-alimentares`, `notificacoes`, `tarefas`, `public`.
- Scripts: `scripts/`, `server/scripts/`.
- Testes: `tests/core`, `tests/browser`, scripts E2E em `scripts/e2e-*.mjs`.
- Documentacao: `README.md`, `docs/metodologia-tecnica-tcc.md`, `docs/rbac-matrix.md`.

## Scripts reais identificados

No `package.json` raiz existem, entre outros:

- `build`
- `smoke:api`
- `test:core`
- `test:e2e:critical`
- `test:e2e:avaliacoes`
- `test:e2e:auth-session`
- `test:e2e:roles`
- `test:e2e:analytics`
- `test:e2e:analytics:local`
- `assess:security`
- `assess:perf`
- `assess:browser`
- `test:e2e:env`

No `server/package.json` existem:

- `build`
- `lint`
- `seed:e2e`
- `migration:run`
- `start`
- `start:dev`

Comandos pedidos que nao existem exatamente no `package.json` raiz:

- `npm run test`: nao encontrado. Equivalente real: `npm run test:core` e scripts E2E especificos.
- `npm run smoke`: nao encontrado. Equivalente real: `npm run smoke:api`.
- `npm run test:e2e`: nao encontrado. Equivalentes reais: `test:e2e:critical`, `test:e2e:avaliacoes`, `test:e2e:auth-session`, `test:e2e:roles`, `test:e2e:analytics`.
- `npm run assess`: nao encontrado. Equivalentes reais: `assess:security`, `assess:perf`, `assess:browser`.

## Preparacao executada

- A API foi iniciada com `npm --prefix server run start`, usando `server/.env`, e depois encerrada.
- O frontend foi servido com `npm run preview -- --host 127.0.0.1`, e depois encerrado.
- Foi executado `npm run seed:e2e`, que fez upsert de 5 usuarios E2E: admin, professor, aluno, tecnico e atleta.
- Foi executado `npm run test:e2e:analytics:local`, que roda seeds CI. O seed de analytics apaga e recria apenas fixtures deterministicos por IDs fixos do proprio script.
- Na rodada pos-correcoes, a API foi iniciada com `npm --prefix server run start`, o frontend com `npm run preview -- --host 127.0.0.1`, e ambos foram encerrados ao fim da validacao.

## Correcoes feitas durante a validacao

Na primeira rodada, nao houve alteracao de funcionalidade da aplicacao para fazer testes passarem. Foram feitos ajustes de fixture/scripts de validacao:

1. `scripts/e2e-avaliacoes-finalizacao.mjs`
   - Antes: o teste gerava CPF aleatorio sem digitos verificadores, e o backend rejeitava o paciente de teste com `HTTP 400 - CPF invalido`.
   - Depois: o script passou a gerar CPF valido por calculo de digitos verificadores.
   - Motivo: corrigir dado de teste invalido.

2. `server/scripts/seed-ci-analytics.js`
   - Antes: o seed inseria pacientes sem preencher a coluna obrigatoria `prontuario`, causando falha de constraint `NOT NULL`.
   - Depois: o seed passou a preencher `PRT-CI-001`, `PRT-CI-002` e `PRT-CI-003`.
   - Motivo: alinhar fixture ao schema atual de `pacientes`.

Na rodada pos-auditoria, foram feitas correcoes tecnicas para resolver falhas reais encontradas:

3. `server/src/projetos/projetos.service.ts`
   - Antes: `GET /projetos` para `aluno` e `atleta` retornava campos fora do contrato (`area`, `coordenador`, `descricao`, `alunosNomes`, `canAnexar`).
   - Depois: a projecao desses perfis passou a retornar somente `id`, `nome` e `status`.
   - Motivo: corrigir exposicao indevida de campos para perfis com leitura limitada.

4. `server/scripts/seed-e2e-users.ts` e `server/scripts/seed-ci-users.js`
   - Antes: as contas E2E podiam nao refletir variaveis `E2E_*`, podiam permanecer soft-deletadas e tentativas antigas de login podiam interferir nos testes.
   - Depois: os seeds respeitam variaveis por perfil, reativam `deleted_at = NULL` para fixtures E2E e limpam tentativas de login dessas contas.
   - Motivo: tornar as credenciais E2E idempotentes e autenticaveis, incluindo o perfil atleta.

5. `server/scripts/seed-ci-analytics.js`, `scripts/e2e-analytics.mjs` e `scripts/e2e-analytics-local.mjs`
   - Antes: o fixture de analytics usava status divergente do agregador e o teste local dependia de contagens absolutas em banco nao isolado.
   - Depois: o fixture usa status normalizados (`ativo`, `espera`), o teste usa `forceRefresh` e o modo local valida minimos do fixture sem truncar dados locais.
   - Motivo: manter o E2E reprodutivel em ambiente local com dados preexistentes.

6. `src/views/LoginPage.jsx` e `scripts/browser-assessment.mjs`
   - Antes: o assessment buscava o campo de login por placeholder antigo.
   - Depois: o login recebeu `data-testid` estavel e o assessment usa seletor robusto; Firefox/WebKit ausentes continuam como `skipped`, nao falha.
   - Motivo: remover fragilidade de seletor visual.

## Resultados dos comandos

| Comando | Diretorio | Resultado | Tempo observado | Testes/checks | Evidencia resumida |
|---|---:|---|---:|---:|---|
| `npm run build` | raiz | Sucesso | 31,3 s no comando; Vite `built in 26.95s` | N/A | `Encoding check passed`; `3033 modules transformed` |
| `npm --prefix server run build` | raiz | Sucesso | 20,3 s | N/A | `nest build` terminou com exit code 0 |
| `npm run test:core` | raiz | Sucesso | 28,9 s | 65 aprovados, 0 reprovados | `[core-test] todos os testes passaram.`; inclui contrato endurecido de `/projetos` |
| `npm run smoke:api` | raiz | Sucesso apos subir API | 12,1 s | 3 checks aprovados | `/health ok`; `/auth/me sem token ok (401)`; login payload invalido ok `(400)` |
| `npm run test:e2e:critical` | raiz | Sucesso com credencial E2E | 1,8 s | Contagem nao informada; 6 checkpoints logados | Login, `/auth/me`, metricas, `logout-all`, token revogado e re-login ok |
| `npm run test:e2e:auth-session` | raiz | Sucesso com credencial E2E | 1,3 s | Contagem nao informada; 5 checkpoints logados | Cookie HttpOnly, rotacao, reuse, revogacao de familia e re-login ok |
| `npm run test:e2e:avaliacoes` | raiz | Sucesso apos correcao de CPF do fixture | 6,9 s | Contagem nao informada; 10 checkpoints logados | Criou paciente, validou bloqueios de finalizacao, conflito por sessao/tipo, pendencias |
| `npm run test:e2e:roles` | raiz | Sucesso apos correcoes | 2,9 s | Admin, aluno, professor, tecnico e atleta aprovados | `Contratos de role validados com sucesso.` |
| `npm run test:e2e:analytics` | raiz | Falha inicial; substituido pela validacao local semeada | 1,8 s na falha inicial | Interrompido no primeiro assert antes da correcao | Esperado `totalPatients=2`, recebido `3` antes do seed local |
| `npm run test:e2e:analytics:local` | raiz | Sucesso apos correcoes | 2,9 s | Fluxo completo aprovado | Dashboard summary, correlations, overview, CSV, JSON e autorizacoes negativas passaram |
| Validacao direta de relatorios com `node fetch` | raiz | Sucesso | 4,5 s | 5 endpoints/formats verificados | overview 200, correlations 200, CSV 200, JSON 200, PDF clinico 200 |
| `npm run assess:security` | raiz | Sucesso com API ativa | 1,4 s | 9 aprovados, 0 reprovados | JSON `e2e-artifacts/security-assessment.json` |
| `npm run assess:perf` com `PERF_SOAK_MINUTES=1` e `PERF_SUSTAINED_MINUTES=1` | raiz | Sucesso com 11 falhas em 1 cenario | 168,1 s | 138.007 requisicoes; 137.996 sucesso; 11 falhas | JSON `e2e-artifacts/perf-load-assessment.json` |
| `npm run assess:browser` | raiz | Sucesso com skips esperados | 66,1 s com preview ativo | 11 checks: 8 passed, 0 failed, 3 skipped | Chromium desktop e mobile passaram; Firefox/WebKit/mobile Safari skipped por browsers nao instalados |
| `npm run test:e2e:env` | raiz | Nao bloqueante em local | 1,6 s | N/A | Ausentes `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD` no ambiente inicial |

## Evidencias de logs

Trechos relevantes:

```text
Encoding check passed.
vite v7.3.3 building client environment for production...
3033 modules transformed.
built in 26.95s
```

```text
[core-test] todos os testes passaram.
```

```text
[smoke] /health ok
[smoke] /auth/me sem token ok (401)
[smoke] validacao de payload em /auth/login ok (400)
[smoke] Concluido com sucesso.
```

```text
[e2e-avaliacoes] Fluxo de finalizacao de avaliacoes validado com sucesso.
```

```text
[role-e2e] admin (admin): checks ok
[role-e2e] student (aluno): checks ok
[role-e2e] professor (professor): checks ok
[role-e2e] tecnico (tecnico): checks ok
[role-e2e] atleta (atleta): checks ok
[role-e2e] Contratos de role validados com sucesso.
```

```text
[security] Todos os checks passaram.
```

```text
[e2e-analytics] /analytics/dashboard/summary fixture ok
[e2e-analytics] /analytics/correlations fixture ok
[e2e-analytics] /analytics/reports/overview project ok
[e2e-analytics] /analytics/reports/export csv ok
[e2e-analytics] /analytics/reports/export json ok
[e2e-analytics] Fluxo analytics/export validado com sucesso.
```

```text
[browser] chromium-desktop: status=passed passed=4 failed=0 skipped=0
[browser] mobile-chrome: status=passed passed=4 failed=0 skipped=0
[browser] firefox-desktop/webkit-desktop/mobile-safari: skipped por browser nao instalado
```

```text
[perf] login_v2_500_conc: req=1000 ok=989 err=11 p95=2309.29ms p99=2334.87ms rps=390.17
[perf] sustained_auth_me_200_conc: req=86426 ok=86426 err=0 p95=410.13ms p99=544.24ms rps=1431.91
```

```json
{
  "overviewTotalPacientes": 5,
  "overviewAvaliacoesPeriodo": 3,
  "csvStatus": 200,
  "csvContentType": "text/csv; charset=utf-8",
  "jsonStatus": 200,
  "jsonContentType": "application/json",
  "clinicalStatus": 200,
  "clinicalContentType": "application/pdf",
  "clinicalBytes": 2124
}
```

## Erros e classificacao

| Erro | Classificacao | Evidencia | Causa provavel |
|---|---|---|---|
| Smoke/API falhou inicialmente com `fetch failed` | Ambiente/configuracao | API nao estava ativa em `localhost:4000` | API local nao iniciada antes do primeiro smoke |
| E2E de avaliacoes falhou inicialmente com `CPF invalido` | Fixture/teste | `HTTP 400 - CPF invalido` | O script gerava CPF sem digito verificador |
| E2E roles: atleta nao autenticava antes da correcao | Corrigido na rodada pos-auditoria | `atleta (atleta): checks ok` | Seed E2E passou a respeitar variaveis por perfil, reativar fixture soft-deletada e limpar tentativas de login |
| E2E roles: aluno recebe campos extras em `/projetos` | Corrigido na rodada pos-auditoria | `student (aluno): checks ok` | Projecao de `/projetos` para `aluno`/`atleta` limitada a `id`, `nome`, `status` |
| E2E analytics fixture | Corrigido para validacao local | `Fluxo analytics/export validado com sucesso.` | Fixture normalizado e teste local passou a validar minimos sem truncar banco local |
| Browser assessment | Corrigido com skips esperados | 8 passed, 0 failed, 3 skipped | Seletores estabilizados; Firefox/WebKit seguem como skip por browsers Playwright ausentes |
| Performance `login_v2_500_conc` | Limite/desempenho observado | 1000 req, 989 ok, 11 falhas sem status HTTP | Falhas de fetch sob concorrencia 500 no login |

## Conclusao tecnica

O build do frontend, o build do backend, os testes core, o smoke de API, os E2E criticos de autenticacao/sessao, o E2E de finalizacao de avaliacoes, o E2E de roles completo, o E2E analytics local, a avaliacao de seguranca e o browser assessment foram executados com sucesso no ambiente local apos subir API e preview. A avaliacao de desempenho gerou metricas reais em carga reduzida por parametro do proprio script; houve 11 falhas no cenario `login_v2_500_conc`.

Foram confirmadas implementacoes de portal do atleta, onboarding, liberacao de formularios ao atleta, envio de autoavaliacoes para revisao, EBIA liberavel, relatorios administrativos com exportacao CSV/JSON e relatorio clinico PDF. As falhas inicialmente encontradas em `/projetos` para aluno, login E2E do atleta, fixture de analytics local e seletores de browser foram corrigidas e revalidadas.

## Limitacoes da validacao

- A validacao foi tecnica/local; nao houve avaliacao empirica com usuarios reais.
- A versao do PostgreSQL local nao foi verificada porque `psql` nao estava no PATH.
- O teste de desempenho foi executado com `PERF_SOAK_MINUTES=1` e `PERF_SUSTAINED_MINUTES=1`, nao com a duracao padrao de 15 minutos.
- O E2E de roles validou admin, aluno, professor, tecnico e atleta apos as correcoes.
- O E2E analytics local passou com fixture semeado; em banco local nao isolado, o teste valida minimos do fixture em vez de totais absolutos globais.
- O browser assessment passou em Chromium desktop e mobile; Firefox/WebKit/mobile Safari ficaram como `skipped` porque os browsers Playwright nao estavam instalados.
- As afirmacoes sobre apoio a tomada de decisao devem ser formuladas como potencial tecnico, nao como impacto clinico comprovado.
