---
name: change-intent
description: Create a Change Intent before coding: problem, scope, affected files, non-goals, invariants, test plan and rollback notes.
argument-hint: '[task description]'
---

# /change-intent

Prepare the change before implementation.

## Instructions

1. Restate the task in one paragraph.
2. Identify the smallest viable change.
3. List expected files/modules to touch.
4. List files/modules that must not be touched.
5. List invariants that may be affected.
6. List explicit non-goals.
7. Propose test/validation commands.
8. Propose rollback notes.
9. Ask for human approval before coding.

## Output

Use `templates/change-intent.md` format.

## Gate

Do not implement until the human approves the Change Intent.
