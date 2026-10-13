# Credenciais das jornadas de auditoria

@work-item-id WI-017

`journey-audit.mjs` le email e senha exclusivamente das variaveis `E2E_ADMIN_*`, `E2E_PRESIDENT_*`, `E2E_STUDENT_*`, `E2E_PROFESSOR_*`, `E2E_TEAM_*` e `E2E_ATHLETE_*`. Par incompleto nao vira tentativa de login. A jornada nao usa conta ou senha fixa do codigo como fallback. Ausencia de todas as credenciais deve produzir diagnostico claro e encerrar antes de abrir navegador ou enviar requisicao. O processo de rotacao de contas historicamente expostas e operacional e separado da mudanca de fonte.
