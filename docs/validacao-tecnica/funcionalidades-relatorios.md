# Funcionalidades de relatorios

| Relatorio | Implementado? | Dados utilizados | Formato de saida | Possivel uso na tomada de decisao | Evidencia no codigo |
|---|---|---|---|---|---|
| Relatorio administrativo geral | Sim | Usuarios, pacientes, avaliacoes, projetos e periodo/filtro | Tela em `ReportsPage` e JSON via `/analytics/reports/overview` | Apoiar gestao academica/operacional por volume de alunos, professores, pacientes, avaliacoes, vinculacao, integridade e completude | `server/src/analytics/analytics.controller.ts` rota `GET reports/overview`; service `getReportsOverview` |
| Uso de avaliacoes por tipo | Sim | Avaliacoes agrupadas por tipo do registry | Tela e JSON | Identificar quais modulos avaliativos estao sendo mais/menos usados | `AnalyticsService.mapUsageByType`; retorno `usageByType`; registry com 16 tipos |
| Painel trimestral | Sim | Avaliacoes e metricas por trimestre | Tela e JSON | Acompanhar evolucao longitudinal/agregada por trimestre | `AnalyticsService.getReportsOverview` retorna `quarterly` |
| Correlacoes/drivers administrativos | Sim | Pacientes, avaliacoes e agendamentos | Tela e JSON via `/analytics/correlations` | Levantar hipoteses operacionais sobre absenteismo, completude e retencao; nao comprova causalidade | `GET /analytics/correlations`; `drivers`, `alerts`, `absenteeism`, `completeness`, `retention` |
| Exportacao CSV administrativa | Sim e validada | Pacientes, avaliacoes e agendamentos, com opcao de anonimizar | CSV download | Gerar base consolidada para auditoria, planilha ou analise estatistica | `GET /analytics/reports/export?format=csv`; validacao direta retornou `200`, `text/csv; charset=utf-8`, 31 linhas |
| Exportacao JSON administrativa | Sim e validada | Metricas, usageByType, quarterly, pacientes, avaliacoes, agendamentos | JSON download | Integrar dados em scripts analiticos ou reproducao de auditoria | `GET /analytics/reports/export?format=json`; validacao direta retornou `200`, `application/json`, 11080 bytes |
| Relatorio clinico PDF por paciente | Sim e validado | Paciente, prontuario, vinculos e avaliacoes finalizadas | PDF download | Apoiar revisao multiprofissional do caso e acompanhamento longitudinal do paciente | `GET /avaliacoes/paciente/:pacienteId/relatorio-clinico`; validacao direta retornou `200`, `application/pdf`, 2124 bytes |
| Relatorio/modelo clinico HTML no frontend | Sim no codigo | Paciente, avaliacoes, sessoes, pendencias, exportedBy | HTML/text download | Organizar um dossie clinico exportavel pelo frontend | `src/services/clinicalReportService.js` define `buildClinicalReportModel`, `buildClinicalReportHtml`, `buildReportFilename` |
| PDF de plano alimentar | Implementado no codigo; nao validado em runtime | Plano alimentar, paciente, refeicoes, metas e validacao clinica | PDF download | Apoiar entrega/revisao de prescricao nutricional | `GET /planos-alimentares/:id/pdf`; controller seta `Content-Type: application/pdf`; nao havia ID de plano fixture para chamada real |
| Relatorios de observabilidade/metricas | Sim, parcialmente validado | Requisicoes, erros, latencia e eventos operacionais | JSON em endpoints admin | Apoiar monitoramento tecnico e resposta a incidentes | E2E critico validou `/observability/metrics ok`; README lista metricas/erros/eventos |

## Dados avaliativos agregaveis em relatorios

O registry backend confirma 16 tipos de avaliacao com labels de analytics:

- `anamnese_inicial`
- `avaliacao_clinica`
- `avaliacao_socioeconomica`
- `perimetros`
- `dobras_cutaneas`
- `bioimpedancia`
- `gasto_energetico_total`
- `carga_treino`
- `alimentar`
- `hidratacao`
- `psicologia`
- `fisioterapia`
- `triagem_reds`
- `exames_laboratoriais`
- `evolucao_retorno`
- `plano_metas`

Esses dados permitem relatorios sobre prontuario, composicao corporal, alimentacao, hidratacao, RED-S/disponibilidade energetica, psicologia, fisioterapia, evolucao/retorno, plano de metas e gestao academica/operacional. A validacao tecnica confirma disponibilidade de endpoints e formatos, mas nao confirma impacto clinico real.

## Validacao direta dos endpoints de relatorio

Foi executada uma chamada direta com `node fetch` usando token admin de fixture, sem imprimir o token. Resultado real:

```json
{
  "overviewStatus": "ok",
  "overviewTotalPacientes": 5,
  "overviewAvaliacoesPeriodo": 3,
  "overviewUsageTypes": 16,
  "correlationsStatus": "ok",
  "correlationsDrivers": 4,
  "csvStatus": 200,
  "csvContentType": "text/csv; charset=utf-8",
  "csvLineCount": 31,
  "jsonStatus": 200,
  "jsonContentType": "application/json",
  "jsonLength": 11080,
  "clinicalStatus": 200,
  "clinicalContentType": "application/pdf",
  "clinicalBytes": 2124
}
```

## Limitacoes especificas de relatorios

- O E2E automatizado `test:e2e:analytics:local` passou apos ajuste do fixture e do modo local, validando dashboard summary, correlations, overview, CSV, JSON e autorizacoes negativas.
- Em banco local nao isolado, o teste local valida minimos do fixture em vez de totais absolutos globais para nao depender de truncamento de dados locais.
- O PDF de plano alimentar esta implementado, mas nao foi chamado por falta de um ID de plano alimentar fixture neste ciclo.
- Nao se deve afirmar que os relatorios melhoraram desfechos clinicos ou tomada de decisao real; apenas que estruturam e disponibilizam dados potencialmente uteis para revisao tecnica, clinica, academica ou multiprofissional.
