<!-- phasegate:managed-section:start -->
## PhaseGate Managed Instructions

### Required Documents

- `docs/folder_management_rules.md`
- `docs/principles/architecture-philosophy.md`
- `docs/principles/testing-rules.md`

### Workflow

- Create or update the relevant `docs/inception/**/WI-XXX/` work item before planning, design, implementation, or tests.
- Reflect accepted design into `docs/product/...` with `@work-item-id WI-XXX` before changing source files.
- Run the relevant PhaseGate checks after changing docs, source, hooks, skills, or setup artifacts.
- Do not bypass git hooks unless the user explicitly approves the reason, residual risk, and replacement validation.

### Setup State

- Agent target: `codex`
- Skill set: `core`
- Workflow mode: `standard`
- Husky hooks: `not managed by this setup run`
- CI workflow: `not managed by this setup run`

### Common Commands

- `phasegate doctor`
- `phasegate phasegate:check-ready`
- `phasegate validate --layer L2 --format human`
- `phasegate setup:agent --dry-run`
- `phasegate config:plan --intent l4-strict --dry-run`

### Codex Notes

- Enable native hook execution with `codex features enable hooks` when Codex hooks are installed.
- Keep local-only Codex settings outside repository-managed targets unless PhaseGate explicitly reports them as managed.
<!-- phasegate:managed-section:end -->

# Repository Instructions for AI Coding Agents

Follow these rules when working in this repository.

## 1. Do not code before intent is clear

Before making changes, create or update a Change Intent containing:

- the problem being solved;
- expected behavior;
- affected modules/files;
- non-goals;
- invariants that must not be broken;
- tests or checks that must pass;
- rollback notes.

If the task is ambiguous, ask for clarification or propose assumptions before editing files.

## 2. Prefer small, reviewable changes

Do not mix unrelated concerns in one change. Keep refactoring, behavior changes, formatting, dependency upgrades and UI changes separate unless explicitly requested.

## 3. Respect existing architecture

Before adding new abstractions or flows, search for similar existing code. Reuse existing patterns unless there is a clear reason not to.

Do not bypass established boundaries between UI, domain logic, infrastructure, persistence and external APIs.

## 4. Protect invariants

Read `templates/invariant-register.md` if present. If a change can affect a listed invariant, explicitly state how the invariant is preserved and which test/check proves it.

## 5. Testing expectations

When changing behavior, add or update tests where practical. If tests are not added, explain why and provide a manual verification checklist.

## 6. No hidden production risk

For changes touching auth, payments, security, data deletion, external APIs, migrations, trading/order logic, healthcare, legal, or financial flows, stop and request explicit human approval before implementation.

## 7. Post-change summary

After changes, provide:

- files changed;
- behavior changed;
- tests run and results;
- risks and limitations;
- rollback path;
- follow-up work.

## 8. No false certainty

Do not claim that code is safe, secure, compliant, or production-ready unless this was proven by tests, review or external verification. Use precise language.

## LAINES: contexto de adoção

Origem: vadimche/ai-agent-rails-pack, revisão 4adaeafab1646601de375c0e8b1b1fe7d507f148; modelos em templates/.
Escopo da versão: docs/auditoria-2026-09-11/proposta-atualizacao.md e backlog.json.
Registro da execução autorizada: docs/implementacao/onda-0/change-intent.md.
Respeitar autorização já dada na sessão; a seção 6 não requer repetir uma aprovação que já cobre a implementação proposta. Deploy e mudanças no banco real são decisões separadas.
