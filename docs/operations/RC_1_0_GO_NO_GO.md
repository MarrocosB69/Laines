# RC 1.0 Go/No-Go (Escopo Atual)

Data de verificacao: 2026-03-14

## Gates tecnicos

- [x] `npm run lint` passou.
- [x] `npm run build` passou.
- [x] `node e2e-artifacts/journey-audit.mjs` passou.
- [x] `journey-report.json` contem `summary.okProfiles = 6` (todos os perfis).
- [x] Nenhum perfil com `pageErrors`.
- [x] Nenhum perfil com `apiErrors`.
- [x] `viewportChecks.desktopOverflow = false` para todos os perfis.
- [x] `viewportChecks.mobileOverflow = false` para todos os perfis.
- [x] Evidencias desktop e mobile geradas para todos os perfis.

## Gates de UX visual (fechamento)

- [x] Header mobile sem sobreposicao do breadcrumb pelo toggle da sidebar.
- [x] Breadcrumb mobile sem ruido de separador residual.
- [x] Modais com foco visivel padronizado (`close` e botoes).
- [x] CSS de telas criticas encapsulado para reduzir vazamento entre rotas:
  - professor
  - dashboard admin
  - prontuario
  - avaliacao completa

## Evidencias

- Relatorio de jornadas: `e2e-artifacts/journey-audit/journey-report.json`
- Screenshots por perfil:
  - `e2e-artifacts/journey-audit/admin.png`
  - `e2e-artifacts/journey-audit/admin-mobile.png`
  - `e2e-artifacts/journey-audit/presidente.png`
  - `e2e-artifacts/journey-audit/presidente-mobile.png`
  - `e2e-artifacts/journey-audit/aluno.png`
  - `e2e-artifacts/journey-audit/aluno-mobile.png`
  - `e2e-artifacts/journey-audit/professor.png`
  - `e2e-artifacts/journey-audit/professor-mobile.png`
  - `e2e-artifacts/journey-audit/tecnico.png`
  - `e2e-artifacts/journey-audit/tecnico-mobile.png`
  - `e2e-artifacts/journey-audit/atleta.png`
  - `e2e-artifacts/journey-audit/atleta-mobile.png`

## Residual (nao bloqueador)

- Portal do atleta em mobile com alta densidade de informacao quando ha muitas avaliacoes recentes no mesmo scroll.
  - Impacto: baixo.
  - Acao sugerida futura: collapse/accordion no historico para reduzir carga cognitiva.

## Decisao RC

- Status recomendado: **GO** para release candidate do escopo atual.
- Condicao de manutencao: manter o `journey-audit` como gate visual de regressao antes de cada release.
