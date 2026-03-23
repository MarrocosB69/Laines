# SLOs (Service Level Objectives)

## Escopo

Aplicacao LAINES (API NestJS + frontend web), com foco nos fluxos criticos:

- autenticacao
- gestao de pacientes
- agendamentos
- avaliacoes
- analiticos e exportacao

## SLOs ativos

1. Disponibilidade de API
- Objetivo: **99.5% mensal**
- SLI: `(requests 2xx/3xx + 4xx esperadas) / total de requests`
- Fonte: monitor sintetico em `GET /health`

2. Latencia de endpoints criticos (p95 em janela de 15 min)
- Objetivo: **p95 <= 700ms**
- Endpoints criticos:
  - `POST /auth/login`
  - `GET /pacientes`
  - `GET /agendamentos`
  - `GET /analytics/reports/overview`
  - `GET /analytics/dashboard/summary`
- Fonte: `GET /observability/slo`

3. Taxa de erro 5xx (janela de 15 min)
- Objetivo: **< 1.0%**
- SLI: `5xx / total`
- Fonte: `GET /observability/slo`

4. Sucesso de deploy em producao
- Objetivo: **>= 95% dos deploys sem rollback**
- SLI: `deploys bem-sucedidos / deploys totais`
- Fonte: historico de workflows

5. RTO operacional (restauracao)
- Objetivo: **<= 30 min**
- SLI: tempo entre inicio do incidente e restauracao funcional
- Fonte: timeline de incidentes em runbook

## Error budget

- Disponibilidade 99.5% => budget mensal aproximado: **3h39m**
- Politica:
  - consumo > 50%: congelar features nao criticas e priorizar estabilidade
  - consumo > 80%: apenas correcoes e hardening ate recuperar tendencia

## Alertas minimos obrigatorios

- healthcheck falhando por 5 min
- erro 5xx > 1.0% por 15 min
- p95 critico > 700ms por 15 min
- falha de deploy/rollback

## Endpoints operacionais

- `GET /observability/metrics`: visao geral de runtime e rotas
- `GET /observability/slo`: janela atual de SLO (p95/5xx)
- `GET /observability/alerts`: historico de alertas acionados/resolvidos
- `GET /observability/errors`: erros recentes

## Validacao por drill (staging)

Executar em staging, com usuario admin autenticado:

1. `POST /observability/drill` com `{ "scenario": "latency", "samples": 120 }`
2. Validar alerta de `critical_p95` em `GET /observability/slo` e `GET /observability/alerts`
3. `POST /observability/drill` com `{ "scenario": "error", "samples": 120 }`
4. Validar alerta de `error_rate_5xx`
5. `POST /observability/drill` com `{ "scenario": "recover", "samples": 120 }`
6. Confirmar resolucao dos alertas
