# Fechamento Consolidado de Auditoria (03/04/2026)

## Secao A - Resumo executivo
- Maturidade estimada: 3.9 / 5
- Decisao de producao: NO-GO ate corrigir risco critico de seguranca
- Cobertura executada:
  - pre-check tecnico e navegacao por perfil
  - autenticacao/sessao/refresh e revogacao
  - agenda, remarcacao e persistencia
  - prontuario e avaliacao completa
  - relatorios administrativos
  - contrato de permissoes por perfil
  - smoke API
  - cross-browser (desktop e mobile)

### Top 10 riscos para usuario
1. Exposicao de senha temporaria em texto claro na listagem de usuarios (critico).
2. Possivel acesso indevido caso senha provisoria seja visualizada por operador nao autorizado.
3. Rota de prontuario pouco explicita em alguns fluxos (`/aluno` e `/professor` mantendo contexto interno), reduzindo previsibilidade de navegacao.
4. Inconsistencia de encoding em nomes com acento na tabela de usuarios.
5. Ruido de logs por 401 esperado em `/auth/me`, dificultando leitura de incidentes reais.
6. Onboarding do atleta ainda gera alto atrito inicial (muitos campos na primeira interacao).
7. Dependencia de ambiente correto para alguns scripts de auditoria (ex.: `PLAYWRIGHT_BASE_URL`) pode gerar falso negativo.
8. Historico de avaliacoes com alta densidade visual em alguns modulos pode reduzir legibilidade para novos usuarios.
9. Fluxos com muitos modais em sequencia aumentam risco de abandono no mobile.
10. Falta de padronizacao unica de evidencia entre rodadas (arquivos em pastas diferentes) aumenta custo operacional de QA.

## Secao B - Tabela consolidada de achados
- ID: LAI-SEC-001
  - Severidade: Critico
  - Modulo: Admin > Membros
  - Perfil afetado: Admin / Coordenacao
  - Cenario: listagem de usuarios exibe senha provisoria em texto claro
  - Impacto: comprometimento potencial de contas
  - Evidencia: fluxo manual Bloco 3 (modal/lista de usuarios)
  - Recomendacao: remover senha em claro; exibir apenas status + reset seguro auditavel
  - Esforco: medio

- ID: LAI-DATA-002
  - Severidade: Medio
  - Modulo: Admin > Membros
  - Perfil afetado: Admin
  - Cenario: nomes com acentuacao exibidos com caracteres corrompidos
  - Impacto: confianca e leitura de dados prejudicadas
  - Evidencia: tabela de usuarios (Bloco 3)
  - Recomendacao: revisar cadeia UTF-8 (persistencia, API, render)
  - Esforco: medio

- ID: LAI-UX-003
  - Severidade: Medio
  - Modulo: Prontuario
  - Perfil afetado: Aluno / Professor
  - Cenario: abertura de prontuario mantendo rota base do perfil
  - Impacto: baixa previsibilidade de deep-link/reload
  - Evidencia: Bloco 2
  - Recomendacao: rotas explicitas para detalhe de paciente/prontuario
  - Esforco: medio

- ID: LAI-OBS-004
  - Severidade: Baixo
  - Modulo: Auth / Observabilidade
  - Perfil afetado: Todos
  - Cenario: 401 esperado aparecendo como erro recorrente
  - Impacto: ruido de monitoramento
  - Evidencia: journey-audit e console
  - Recomendacao: classificar eventos esperados no monitoramento
  - Esforco: baixo

## Secao C - Gargalos de usabilidade
- Onboarding atleta com grande quantidade de campos na primeira interacao.
- Alto volume de informacao por tela em alguns modulos clinicos sem modo "resumido".
- Dependencia de sequencia de modais para avancar em cadastros pode aumentar friccao.

## Secao D - Plano de acao por ondas
### Onda 1 (24h) - Criticos
1. Remover exibicao de senha provisoria em texto claro em toda interface.
2. Revisar endpoint/listagem para nunca retornar senha temporaria ao frontend.
3. Garantir fluxo de reset seguro com auditoria (token/expiracao/log de emissao).

### Onda 2 (7 dias) - Altos + usabilidade
1. Corrigir encoding UTF-8 de nomes e strings institucionais.
2. Tornar rotas de prontuario explicitas para aluno/professor.
3. Reduzir atrito do onboarding atleta (progressivo por etapas).

### Onda 3 (30 dias) - Refinamento
1. Padronizar observabilidade para separar erro real vs evento esperado.
2. Criar modo de visualizacao resumida nos modulos mais densos.
3. Unificar pipeline de evidencias QA (nomenclatura e diretórios).

## Secao E - Criterios objetivos de aceite para producao
1. Nao exibir nem transportar senha provisoria em texto claro no frontend.
2. Validar via teste automatizado e manual que fluxo de reset seguro funciona.
3. Executar smoke API, role-contract e browser-assessment com 100% de checks passados.
4. Confirmar abertura de prontuario e remarcacao em aluno/professor sem regressao.
5. Registrar evidencias finais e aprovacoes do bloco critico de seguranca.

## Evidencias e artefatos desta rodada
- Bloco 1: `docs/manuals/auditoria/2026-04-03-bloco-1.md`
- Bloco 2: `docs/manuals/auditoria/2026-04-03-bloco-2.md`
- Bloco 3: `docs/manuals/auditoria/2026-04-03-bloco-3.md`
- Fechamento: `docs/manuals/auditoria/2026-04-03-fechamento-consolidado.md`
- Prints manuais: `e2e-artifacts/manual-qa-20260403/`
- Jornada por perfil: `e2e-artifacts/journey-audit/journey-report.json`
- Browser assessment: `e2e-artifacts/browser-assessment.json`
- Smoke API: execucao em `npm run smoke:api`
- Role contract: execucao em `node scripts/e2e-role-contract.mjs`
- Auth session: execucao em `node scripts/e2e-auth-session.mjs`
