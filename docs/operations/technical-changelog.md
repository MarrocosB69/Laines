# Technical Changelog

## 2026-03-31

### Added
- `docs/operations/avaliacoes-phase-6-expansao-futura.md` with technical design for expansion of `exames_laboratoriais` and `evolucao_retorno` (integration points, schema target, dependencies, risks and backlog), without runtime implementation.
- Runtime expansion implemented for `exames_laboratoriais` and `evolucao_retorno`:
  - frontend registry + module integration in `AvaliacaoCompleta` and `PatientProntuario`
  - new forms in `src/components/Avaliacoes/avaliacao-exames-laboratoriais` and `src/components/Avaliacoes/avaliacao-evolucao-retorno`
  - centralized calculations in `src/services/calculationEngine.js`
  - backend normalizers in `server/src/avaliacoes/*-normalizer.ts`
  - backend registry/default formula metadata updates
  - core test coverage expanded in `scripts/run-core-tests.mjs`

## 2026-03-30

### Removed
- `src/services/calculos.js` removed as orphan legacy module with no active imports in `src/`.
- Scope: Fase 5.1 (clean-up of unconnected legacy code).

### Added
- Core tests expanded in `scripts/run-core-tests.mjs` for:
  - Hydration calculation engine (`calculateHydrationEvaluation`)
  - NOVA calculation engine (`calculateNovaEvaluation`)
  - `AvaliacoesService` athlete authorization guardrails on create
  - `AvaliacoesService.findAll` filter requirements for athlete/admin
