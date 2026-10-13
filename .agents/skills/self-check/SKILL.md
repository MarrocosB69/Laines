---
name: self-check
description: Compare the implemented diff against the approved Change Intent and produce a reviewable self-check.
argument-hint: '[approved intent + diff or changed files]'
---

# /self-check

Run after implementation and before the human review.

## Instructions

1. Load the approved Change Intent.
2. Inspect the actual diff or changed files.
3. Compare expected files vs actual files.
4. Identify scope drift, unexpected changes or hidden refactors.
5. Check whether listed invariants were touched.
6. List tests run and tests still missing.
7. Confirm rollback path.
8. Produce a concise pass/warn/block recommendation.

## Output

```markdown
# Agent Self-Check

## Verdict
PASS | WARN | BLOCK

## Intent match
...

## Files changed
...

## Scope drift
...

## Invariants
...

## Tests
...

## Rollback
...

## Human review focus
...
```

## Boundary

This is not a guarantee of code correctness, security or production readiness.
