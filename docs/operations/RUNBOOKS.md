# Runbooks Operacionais

## 1) API indisponivel

### Sintoma
- `GET /health` falhando
- erro 5xx alto em `GET /observability/slo`

### Diagnostico rapido
1. Verificar estado do processo API.
2. Verificar conectividade com banco.
3. Verificar `GET /observability/errors?limit=50`.

### Acao
1. Reiniciar servico da API.
2. Se nao normalizar, executar workflow `Rollback`.
3. Validar `GET /health` e login basico (`POST /auth/login`).

### Validacao
- `health` em `ok`
- erro 5xx em queda na janela de 15 min

---

## 2) Deploy falhou

### Sintoma
- workflow `Deploy` falha em migration/restart/healthcheck

### Diagnostico rapido
1. Revisar fase exata da falha no workflow.
2. Confirmar `releaseId` e `sourceRef`.
3. Revisar logs do servico no host.

### Acao
1. Confirmar rollback automatico de aplicacao.
2. Se migration foi executada, confirmar restore de banco.
3. Se necessario, executar workflow `Rollback` manual.

### Validacao
- `current` aponta para release estavel
- API saudavel e autenticao funcional

---

## 3) Aumento de erro 5xx

### Sintoma
- alerta `error_rate_5xx` em `GET /observability/alerts`

### Diagnostico rapido
1. Conferir rotas com maior erro em `GET /observability/metrics`.
2. Correlacionar com ultimo deploy.
3. Inspecionar erros recentes (`/observability/errors`).

### Acao
1. Mitigar causa imediata (rollback ou hotfix).
2. Proteger rota afetada com fallback defensivo.
3. Abrir incidente com `requestId`, stack e payload.

### Validacao
- alerta `error_rate_5xx` resolvido
- taxa 5xx abaixo do threshold por uma janela completa

---

## 4) Latencia p95 acima do alvo

### Sintoma
- alerta `critical_p95` em `GET /observability/alerts`

### Diagnostico rapido
1. Verificar `criticalP95Ms` em `GET /observability/slo`.
2. Verificar rotas com maior duracao media/maxima.
3. Correlacionar com volume de requests e carga de banco.

### Acao
1. Reduzir cargas forca-bruta no frontend (forcar endpoint analitico).
2. Ajustar cache/TTL de endpoint analitico.
3. Revisar indices e consulta no banco.

### Validacao
- p95 critico abaixo do alvo por uma janela completa
- alerta `critical_p95` resolvido

---

## 5) Drill de observabilidade (staging)

### Objetivo
Comprovar que p95/5xx acionam alerta e que o sistema registra resolucao.

### Passos
0. Garantir `OBSERVABILITY_DRILL_ENABLED=true` no ambiente de staging.
1. Executar `POST /observability/drill` com `{"scenario":"latency","samples":120}`.
2. Confirmar alerta `critical_p95` em `/observability/slo` e `/observability/alerts`.
3. Executar `POST /observability/drill` com `{"scenario":"error","samples":120}`.
4. Confirmar alerta `error_rate_5xx`.
5. Executar `POST /observability/drill` com `{"scenario":"recover","samples":120}`.
6. Confirmar resolucao dos dois alertas.

### Evidencias minimas
- horario de inicio/fim
- payloads usados no drill
- resposta de `/observability/slo` por etapa
- historico de `/observability/alerts`
