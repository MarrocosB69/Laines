# Checklist Final de Producao

## 1) Qualidade de codigo

- [ ] `npm run lint` passou
- [ ] `npm run lint:server` passou
- [ ] `npm run guard:schema` passou
- [ ] `npm run build` passou
- [ ] `npm run test:core` passou
- [ ] smoke de API em staging passou
- [ ] e2e critico, e2e roles e e2e analytics passaram no CI
- [ ] artifact `api-smoke-artifacts` contem `e2e-analytics-report.json` com status `passed`
- [ ] e2e critico validou revogacao de sessao em `POST /auth/logout-all`

## 2) Seguranca e acesso

- [ ] segredos por ambiente configurados
- [ ] rotacao de JWT documentada
- [ ] revogacao de sessao por `session_version` validada
- [ ] headers de seguranca e CORS validados
- [ ] logs sem dados sensiveis

## 3) Banco de dados

- [ ] backup recente validado
- [ ] migrations testadas em staging
- [ ] migrations de FKs core aplicadas sem erro
- [ ] `DEPLOY_DB_BACKUP_COMMAND` validado
- [ ] `DEPLOY_DB_RESTORE_COMMAND` validado
- [ ] estrategia de rollback de schema documentada

## 4) Deploy e rollback

- [ ] workflow `Deploy` executou com sucesso
- [ ] artifact `deploy-api-gates-artifacts` contem `e2e-analytics-report.json` com status `passed`
- [ ] `release.json` presente no release implantado
- [ ] `releaseId` confere com commit real do artefato
- [ ] healthcheck aprovado apos deploy
- [ ] endpoint autenticado critico validado
- [ ] workflow `Rollback` testado em staging
- [ ] rollback com `restore_database=true` testado

## 5) Observabilidade

- [ ] `GET /observability/metrics` responde
- [ ] `GET /observability/slo` responde
- [ ] `GET /observability/alerts` responde
- [ ] alerta 5xx ativo e roteado
- [ ] alerta p95 ativo e roteado
- [ ] runbook de resposta revisado

## 6) Drill operacional (staging)

- [ ] drill de latencia executado e registrado
- [ ] drill de erro 5xx executado e registrado
- [ ] drill de recuperacao executado e registrado
- [ ] workflow `Operational Drill` executado com sucesso em staging
- [ ] evidencias anexadas (slo + alerts + horario)

## 7) Aceite final

- [ ] tech lead aprovou evidencias tecnicas
- [ ] operacao aprovou readiness
- [ ] produto aprovou janela de risco
- [ ] go-live autorizado
