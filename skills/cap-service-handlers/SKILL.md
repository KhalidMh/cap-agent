---
name: cap-service-handlers
description: Service handler patterns for SAP CAP Node.js runtime. Use when writing, editing, or reviewing custom event handlers, CRUD hooks, actions, functions, or service implementations in JavaScript.
---

# Service Handler Patterns (Node.js)

## Registration

- Register handlers with `this.on()`, `this.before()`, `this.after()` inside the `init()` method.
- Never mix callback-style and class-style handler registration in a single service.
- Destructure CQL operators at the top: `const { SELECT, INSERT, UPDATE, DELETE } = cds.ql`.

## Handler Roles

| Hook | Purpose |
|------|---------|
| `this.before('CREATE', ...)` | Input validation, defaults, authorization checks |
| `this.before('UPDATE', ...)` | Field-level validation, immutable field protection |
| `this.on('READ', ...)` | Only when overriding default CRUD — prefer CQL delegation |
| `this.after('READ', ...)` | Computed fields, data enrichment, formatting |
| `this.on('ACTION_NAME', ...)` | Custom bound/unbound actions and functions |

## Error Handling

- Use `req.error(code, message, target)` for validation errors (accumulates, does not abort).
- Use `req.reject(code, message)` to immediately abort the request.
- Never throw raw `Error` objects.

## External Services

- Use `cds.connect.to('service-name')` for consuming remote services.
- Never hardcode HTTP calls with `fetch` or `axios` to SAP endpoints.
- Define external services in `package.json` under `cds.requires`.

## Structure

- Keep handlers thin — extract business logic into modules under `srv/lib/`.
- One service file per CDS service definition.
- Name handler files to match service names: `CatalogService.js` → `CatalogService.cds`.

## Example — Clean Handler

Reference the [handler template](./handler-template.js) for the standard structure.

## Anti-Patterns

- `this.on('READ', ...)` that just wraps a `SELECT` without adding logic.
- Throwing `new Error(...)` instead of using `req.reject()`.
- Inline `fetch()` calls to external SAP services.
- Fat handlers with 100+ lines of business logic — split into `srv/lib/`.
