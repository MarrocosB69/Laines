# Texto para artigo/TCC

## Resultados - interacao com o atleta

A analise do codigo confirmou a existencia de um portal autenticado para o perfil atleta, acessado pela rota protegida `/atleta`, no qual o usuario pode visualizar dados de prontuario, agenda, avaliacoes e pendencias vinculadas ao seu cadastro. O sistema tambem implementa onboarding do atleta por rota protegida (`PATCH /pacientes/:id/onboarding`) e mecanismos para liberacao de formularios pelo membro/profissional responsavel. Foram identificados formularios de autoavaliacao do atleta para registro alimentar, hidratacao, carga de treino e relato de dor/lesao, alem de EBIA quando liberada pela equipe. Esses envios sao marcados no backend com origem de preenchimento pelo atleta e, nos formularios de autorrelato, ficam em estado de rascunho aguardando revisao profissional.

## Resultados - geracao de relatorios

A validacao confirmou endpoints de relatorios administrativos e clinicos. O modulo de analytics disponibiliza resumo administrativo (`/analytics/reports/overview`), correlacoes (`/analytics/correlations`) e exportacao em CSV ou JSON (`/analytics/reports/export`). Em chamada direta com token administrativo, os endpoints retornaram status 200, com CSV em `text/csv; charset=utf-8`, JSON em `application/json` e relatorio clinico em PDF (`application/pdf`) por meio de `/avaliacoes/paciente/:pacienteId/relatorio-clinico`. O registry de avaliacoes inclui 16 tipos avaliativos agregaveis, abrangendo anamnese, clinica, EBIA, antropometria, gasto energetico, carga de treino, alimentacao, hidratacao, psicologia, fisioterapia, RED-S, exames laboratoriais, evolucao/retorno e plano de metas.

## Discussao - contribuicao cientifica

Do ponto de vista tecnico, o sistema apresenta uma estrutura que pode apoiar pesquisas e atividades academicas por organizar dados de pacientes/atletas, avaliacoes multiprofissionais, agenda, prontuario e indicadores administrativos em uma aplicacao integrada. A possibilidade de liberar formularios ao atleta e registrar autorrelatos com status de revisao cria uma trilha verificavel de participacao do atleta no acompanhamento. Os relatorios e exportacoes podem apoiar analises descritivas, auditorias e planejamento multiprofissional. Entretanto, esta auditoria nao avaliou impacto clinico, usabilidade, aceitabilidade ou efetividade com usuarios reais; portanto, tais efeitos nao devem ser afirmados sem estudo empirico complementar.

## Validacao tecnica

Na auditoria local registrada entre 2026-06-10 e 2026-06-11, o build do frontend, o build do backend, os testes core, o smoke de API, os E2E criticos de autenticacao/sessao, o E2E de finalizacao de avaliacoes, a avaliacao de seguranca, o E2E de roles, o E2E analytics local e o browser assessment foram executados com sucesso apos correcoes. Os testes core registraram 65 casos aprovados. A avaliacao de seguranca registrou 9 checks aprovados e nenhum reprovado. O E2E de roles validou admin, aluno, professor, tecnico e atleta. O browser assessment registrou 8 checks aprovados, 0 reprovados e 3 skipped por browsers Playwright nao instalados. A avaliacao de desempenho, executada com parametros reduzidos de 1 minuto para soak e 1 minuto para carga sustentada, processou 138.007 requisicoes, com 137.996 sucessos e 11 falhas no cenario de login com concorrencia 500.

## Tabela 2 - Resultados reais da validacao tecnica

| Validacao | Resultado real | Evidencia |
|---|---|---|
| Build frontend | Aprovado | `npm run build`; `Encoding check passed`; Vite `built in 26.95s` |
| Build backend | Aprovado | `npm --prefix server run build`; exit code 0 |
| Testes core | Aprovado | 65/65 casos aprovados; `[core-test] todos os testes passaram.` |
| Smoke API | Aprovado apos subir API | `/health ok`; `/auth/me` sem token retornou 401; payload invalido retornou 400 |
| E2E critico | Aprovado com credencial E2E | Login, `/auth/me`, metricas, `logout-all`, revogacao e re-login ok |
| E2E sessao/auth | Aprovado com credencial E2E | Rotacao de refresh token, deteccao de reuse e revogacao de familia ok |
| E2E avaliacoes | Aprovado apos correcao de fixture | Bloqueios de finalizacao invalida, criacao/finalizacao e pendencias validados |
| Controle de acesso por perfil | Aprovado apos correcoes | Admin, aluno, professor, tecnico e atleta passaram no `test:e2e:roles` |
| Analytics/relatorios E2E | Aprovado local apos correcoes | `test:e2e:analytics:local` validou dashboard summary, correlations, overview, CSV, JSON e autorizacoes negativas |
| Seguranca | Aprovado | 9/9 checks aprovados em `assess:security` |
| Desempenho | Aprovado com ressalva | 138.007 requisicoes; 11 falhas em `login_v2_500_conc` |
| Browser | Aprovado com skips esperados | 8 checks passaram, 0 falharam, 3 foram skipped por Firefox/WebKit/mobile Safari nao instalados |

## Afirmacoes permitidas para o artigo

- O sistema possui frontend React/Vite e backend NestJS/PostgreSQL.
- O sistema possui portal do atleta autenticado e fluxo de onboarding.
- O sistema permite liberar formularios especificos ao atleta e registrar autorrelatos para revisao.
- O sistema gera relatorios administrativos e exportacoes CSV/JSON.
- O sistema gera relatorio clinico PDF por paciente.
- A validacao tecnica local executou builds, testes core, smoke API, E2E selecionados, seguranca, desempenho e browser, com os resultados acima.

## Afirmacoes que nao devem ser feitas

- Nao afirmar melhora de desfecho clinico, adesao, desempenho esportivo, satisfacao ou tomada de decisao real.
- Nao afirmar validacao empirica com usuarios finais.
- Nao afirmar compatibilidade browser completa; Firefox/WebKit/mobile Safari estavam ausentes e foram marcados como `skipped`.
