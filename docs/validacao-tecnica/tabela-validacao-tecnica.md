# Tabela de validacao tecnica

| Tipo de validacao | Comando executado | Objetivo | Resultado real | Evidencia/log | Observacao |
|---|---|---|---|---|---|
| Build frontend | `npm run build` | Gerar build de producao do frontend e checar encoding | Sucesso | `Encoding check passed`; `3033 modules transformed`; `built in 26.95s` | Rodada pos-correcoes: 31,3 s |
| Build backend | `npm --prefix server run build` | Compilar backend NestJS | Sucesso | `nest build`; exit code 0 | Rodada pos-correcoes: 20,3 s |
| Testes core | `npm run test:core` | Validar regras centrais, normalizadores, permissoes e calculos | Sucesso | `[core-test] todos os testes passaram.` | 65 aprovados, 0 reprovados; contrato de `/projetos` endurecido |
| Smoke API | `npm run smoke:api` | Verificar `/health`, autenticacao sem token e validacao de payload | Sucesso apos subir API | `/health ok`; `/auth/me sem token ok (401)`; login invalido ok `(400)` | Primeira tentativa falhou porque a API nao estava ativa |
| E2E critico | `E2E_EMAIL/E2E_PASSWORD + npm run test:e2e:critical` | Validar login, `/auth/me`, metricas e revogacao por logout-all | Sucesso | `Fluxo critico concluido com sucesso.` | Inicialmente foi `Skip` por falta de env |
| E2E auth/session | `E2E_EMAIL/E2E_PASSWORD + npm run test:e2e:auth-session` | Validar auth v2, refresh cookie, rotacao e reuse | Sucesso | `Fluxo de sessao/refresh validado com sucesso.` | Inicialmente foi `Skip` por falta de env |
| E2E avaliacoes | `E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD + npm run test:e2e:avaliacoes` | Validar finalizacao, bloqueios e pendencias de avaliacoes | Sucesso apos correcao de CPF no fixture | `Fluxo de finalizacao de avaliacoes validado com sucesso.` | Antes falhou com CPF invalido gerado pelo teste |
| E2E roles - matriz completa | `E2E_ROLE_MATRIX_REQUIRED=true + E2E_* + npm run test:e2e:roles` | Validar contratos de permissao por perfil | Sucesso apos correcoes | `admin`, `student`, `professor`, `tecnico` e `atleta`: `checks ok` | Escrita em tarefas/projetos ignorada com `E2E_ALLOW_MUTATIONS=false`; tempo 2,9 s |
| E2E roles - aluno | mesmo comando acima | Validar escopo do aluno em `/projetos` | Corrigido e aprovado | `student (aluno): checks ok` | Projecao limitada a `id`, `nome`, `status` |
| E2E roles - atleta | mesmo comando acima | Validar login e escopo do atleta | Corrigido e aprovado | `atleta (atleta): checks ok` | Seed E2E tornou credencial do atleta autenticavel |
| E2E analytics | `E2E_ADMIN_* + npm run test:e2e:analytics` | Validar endpoints e exportacao por fixture | Falha inicial; nao reexecutado isolado | `Esperado totalPatients=2, recebido 3` | Fluxo foi revalidado por `test:e2e:analytics:local` |
| E2E analytics local | `npm run test:e2e:analytics:local` | Semear fixture e rodar analytics E2E | Sucesso apos correcoes | `Fluxo analytics/export validado com sucesso.` | Dashboard summary, correlations, overview, CSV, JSON e autorizacoes negativas passaram |
| Relatorios - chamada direta | `node --input-type=module -e ...` | Confirmar endpoints e formatos de relatorio | Sucesso | overview 200; correlations 200; CSV 200; JSON 200; PDF clinico 200 | CSV: 31 linhas; JSON: 11080 bytes; PDF: 2124 bytes |
| Seguranca | `npm run assess:security` | Validar headers, payloads, refresh token, CSRF baseline e storage scan | Sucesso | `totalChecks: 9`, `passed: 9`, `failed: 0` | Rodada pos-correcoes: 1,4 s; token/cookie nao reproduzido no relatorio |
| Desempenho | `PERF_SOAK_MINUTES=1 PERF_SUSTAINED_MINUTES=1 npm run assess:perf` | Avaliar carga concorrente e cenarios de auth | Sucesso com falha em 1 cenario | 138.007 req; 137.996 ok; 11 falhas | `login_v2_500_conc`: 989 ok, 11 falhas |
| Browser | `npm run assess:browser` com preview ativo | Validar login page, overflow e login no navegador | Sucesso com skips esperados | 11 checks: 8 passed, 0 failed, 3 skipped | Chromium desktop/mobile passaram; Firefox/WebKit/mobile Safari skipped por browsers nao instalados |
| Validador E2E | `npm run test:e2e:env` | Checar variaveis obrigatorias | Nao bloqueante local | Ausentes `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD` | Depois foram usadas credenciais de fixture por comando |
| Comando inexistente | `npm run test` | Verificar comando solicitado | Nao encontrado | Ausente de `package.json` | Equivalentes: `test:core` e E2E especificos |
| Comando inexistente | `npm run smoke` | Verificar comando solicitado | Nao encontrado | Ausente de `package.json` | Equivalente: `smoke:api` |
| Comando inexistente | `npm run test:e2e` | Verificar comando solicitado | Nao encontrado | Ausente de `package.json` | Equivalentes: `test:e2e:*` |
| Comando inexistente | `npm run assess` | Verificar comando solicitado | Nao encontrado | Ausente de `package.json` | Equivalentes: `assess:security`, `assess:perf`, `assess:browser` |
