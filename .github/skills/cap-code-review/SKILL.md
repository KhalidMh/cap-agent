---
name: cap-code-review
description: Code review for SAP CAP projects. Use when the user asks to review code, check for issues, audit quality, or validate CDS models and service handlers against best practices.
---

# Code Review

## Process

1. Read all relevant files using codebase/search tools.
2. Check against CAP best practices (modeling, handlers, security, performance).
3. Report findings grouped by severity: **Critical** → **Warning** → **Suggestion**.
4. For each finding, show the specific file and line, explain the issue, and provide a fix.

## Severity Definitions

| Severity | Meaning |
|----------|---------|
| **Critical** | Security vulnerability, data loss risk, broken functionality |
| **Warning** | Performance issue, convention violation, maintainability concern |
| **Suggestion** | Style improvement, simplification, optional enhancement |

## What To Check

### Security (Critical)
- Missing `@requires` or `@restrict` on sensitive services/entities.
- Hardcoded credentials, API keys, or tokens.
- `req.user` access without scope verification.
- Raw `fetch`/`axios` calls to SAP endpoints bypassing destination service.
- `default-env.json` not in `.gitignore`.

### Performance (Warning)
- Unbounded `SELECT` without `LIMIT` or pagination.
- N+1 patterns in `after` handlers.
- Deep `$expand` chains (3+ levels).
- Full entity `SELECT` when only a few columns are needed.

### Conventions (Warning)
- Wrong casing: entities not PascalCase, elements not camelCase.
- Missing `managed` aspect on entities.
- Missing explicit keys.
- Composition used where Association is appropriate.
- Raw `throw new Error()` instead of `req.error()` / `req.reject()`.

### Structure (Suggestion)
- Fat handlers (100+ lines) that should be split.
- Missing file naming alignment between `.cds` and `.js` files.
- Annotations mixed into data model files.

## Rules

- Do not praise code that is merely correct — focus on actionable feedback only.
- If no issues are found, say so briefly. Do not pad the review.
- When suggesting a fix, show the corrected code.
- Group related findings (e.g. multiple missing `@requires`) into a single item.
