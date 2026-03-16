---
name: cap-code-review
description: Code review for SAP CAP projects. Use when the user asks to review code, check for issues, audit quality, or validate CDS models and service handlers against best practices.
---

# Code Review

## Context7 — Docs Lookup

Before reviewing, call `context7/query-docs` with `context7CompatibleLibraryID` = `/cap-js/docs` and a `topic` matching the area being reviewed (e.g., `authorization`, `handlers`, `associations`). Ground your review in the fetched docs.

## Process

1. Read all relevant files using codebase/search tools.
2. Check against every section in this skill.
3. Report findings grouped by severity: **Critical** → **Warning** → **Suggestion**.
4. For each finding, show the file and line, explain the issue, and provide a fix.

## Severity

| Level | Meaning |
|-------|---------|
| **Critical** | Security vulnerability, data loss risk, broken functionality |
| **Warning** | Performance issue, convention violation, maintainability concern |
| **Suggestion** | Style improvement, simplification, optional enhancement |

---

## Security (Critical)

### Authorization

- Every service that isn't public MUST have `@requires` or `@restrict`:

```cds
// BAD — open to everyone
service AdminService { ... }

// GOOD
@requires: 'Admin'
service AdminService { ... }
```

- Entity-level restrictions use `@restrict`:

```cds
@restrict: [
  { grant: 'READ', to: 'Viewer' },
  { grant: ['CREATE', 'UPDATE', 'DELETE'], to: 'Admin' }
]
entity Products : cuid, managed { ... }
```

- Check `req.user.is()` for scope-based logic in handlers:

```js
// BAD — trusts user input for role
if (req.data.role === 'admin') { ... }

// GOOD — checks JWT scope
if (!req.user.is('Admin')) return req.reject(403, 'Forbidden');
```

### Credentials

- No hardcoded API keys, passwords, or tokens anywhere in code.
- `default-env.json` must be in `.gitignore`.
- `.env` files must be in `.gitignore`.
- No credentials in `package.json` — use service bindings or `default-env.json`.
- Check `xs-security.json`: `"authorities": ["$ACCEPT"]` is a security hole in production — it bypasses all scope checks.

### Data Exposure

- JWT content or `req.user` internals must not appear in error responses or logs.
- `req.reject()` messages are sent to the client — never include stack traces or internal state.
- Sensitive fields (`password`, `token`, `secret`) should have `@PersonalData` annotations if applicable and never be included in OData responses without explicit filtering.

---

## Performance (Warning)

### Unbounded Queries

```js
// BAD — returns entire table
const products = await SELECT.from(Products);

// GOOD — always limit
const products = await SELECT.from(Products).limit(100);

// GOOD — only needed columns
const products = await SELECT.from(Products).columns('ID', 'name', 'price').limit(100);
```

### N+1 Queries

Fetching related data inside a loop is the most common CAP performance bug:

```js
// BAD — N+1 in after handler
this.after('READ', Orders, async (orders) => {
  for (const order of orders) {
    order.customer = await SELECT.one.from(Customers).where({ ID: order.customer_ID });
  }
});

// GOOD — batch lookup
this.after('READ', Orders, async (orders) => {
  const ids = [...new Set(orders.map(o => o.customer_ID).filter(Boolean))];
  if (!ids.length) return;
  const customers = await SELECT.from(Customers).where({ ID: { in: ids } });
  const map = new Map(customers.map(c => [c.ID, c]));
  for (const order of orders) {
    order.customer = map.get(order.customer_ID);
  }
});
```

### JS-Side Filtering

```js
// BAD — fetches everything, filters in JS
const allOrders = await SELECT.from(Orders);
const open = allOrders.filter(o => o.status === 'open');

// GOOD — filter at DB level
const open = await SELECT.from(Orders).where({ status: 'open' });
```

### Bulk Operations

```js
// BAD — loop of single inserts
for (const item of items) {
  await INSERT.into(Items).entries(item);
}

// GOOD — single bulk insert
await INSERT.into(Items).entries(items);
```

### Other Performance Checks

- `$expand` chains deeper than 3 levels → flag as risk.
- Missing `@cds.search` on entities used in list views with search bars.
- Remote service calls inside loops → N+1 over network (much worse than DB N+1).

---

## CDS Modeling (Warning)

### Naming

- Entities: `PascalCase` — `entity SalesOrders`, not `entity sales_orders`.
- Elements: `camelCase` — `totalAmount`, not `total_amount`.
- Services: `PascalCase` — `service CatalogService`.

### Structure

- Every entity should use `managed` aspect (gives `createdAt`, `createdBy`, `modifiedAt`, `modifiedBy`):

```cds
entity Products : cuid, managed { ... }
```

- Every entity needs an explicit key. Prefer `cuid` (gives `key ID : UUID`).
- `String` must have a length: `String(100)`, not bare `String`.

### Associations vs Compositions

- **Association**: independent lifecycle. Deleting parent does NOT delete child.
- **Composition**: child depends on parent. Deleting parent cascades to children.

```cds
// Association — Customer exists independently of Order
entity Orders {
  customer : Association to Customers;
}

// Composition — OrderItems die with the Order
entity Orders {
  items : Composition of many OrderItems on items.parent = $self;
}
```

Flag: Composition used where the child entity makes sense on its own (should be Association).
Flag: Association used where children should be deleted with parent (should be Composition).

### Annotations

- Keep annotations in separate files (`srv/annotations.cds`), not mixed into data model files in `db/`.

---

## Service Handlers (Warning)

### Error Handling

```js
// BAD — raw throw, produces generic 500
throw new Error('Something went wrong');

// GOOD — structured OData error with status code
req.reject(400, 'Order quantity must be positive');

// GOOD — multiple errors collected
req.error(400, 'Name is required', 'in/name');
req.error(400, 'Price must be positive', 'in/price');
```

### Handler Structure

- `init()` must call `await super.init()` at the end:

```js
class MyService extends cds.ApplicationService {
  async init() {
    // register handlers
    this.on('READ', Products, ...);
    this.before('CREATE', Orders, ...);

    await super.init(); // MUST be last
  }
}
```

- Handlers longer than 80-100 lines → extract business logic to `srv/lib/`:

```js
// srv/lib/order-logic.js
module.exports = { validateOrder, calculateTotal };

// srv/OrderService.js
const { validateOrder } = require('./lib/order-logic');
this.before('CREATE', Orders, validateOrder);
```

### External Services

```js
// BAD — raw HTTP call
const res = await fetch('https://my-s4.com/sap/opu/odata/...');

// GOOD — uses CAP's destination + auth handling
const bupa = await cds.connect.to('API_BUSINESS_PARTNER');
const partner = await bupa.run(SELECT.one.from('A_BusinessPartner').where({ BusinessPartner: id }));
```

- Never use `fetch`, `axios`, or `node-fetch` to call SAP endpoints. Always `cds.connect.to()`.
- Never connect at module level — `cds.connect.to()` inside `init()` or inside the handler.

---

## Remote Services (Warning)

- Full imported API exposed without projection → flag. Always project only needed fields.
- Missing `[development]` mock config for external services → every dev needs hybrid setup.
- Missing error handling on remote calls → remote failures crash the handler silently.
- Hardcoded remote URLs instead of BTP destinations.

---

## Messaging (Warning)

- `this.emit()` in a `before` handler without outbox → event fires even if the transaction rolls back.
- Event handlers that aren't idempotent → duplicate processing on redelivery.
- Missing `[development]` / `[production]` split for messaging config.
- Throwing errors inside event handlers without understanding retry behavior → infinite retry loops.

---

## Database (Warning)

- Missing `[development]` / `[production]` profile split for DB config.
- `@cap-js/sqlite` installed without `-D` flag (should be devDependency).
- `.sqlite` file committed to git.
- Relying on `DECIMAL` precision in SQLite (it uses floats).
- Lowercase identifiers in native HANA SQL without quoting (HANA defaults to uppercase).
- Missing `undeploy.json` entries when entities are removed (HANA only).

---

## Deployment (Warning)

- Missing `[production]` profile overrides in `package.json` → dev config leaks to prod.
- `xs-security.json` roles don't match `@requires` / `@restrict` annotations in CDS.
- `default-env.json` or `.env` committed to source control.
- MTA missing required service bindings (destination, connectivity, xsuaa, hdi-container).
- `cds build --production` not used before `mbt build`.

---

## Testing (Suggestion)

- No test files for the service being reviewed → suggest adding them.
- Missing authorization tests — both "allowed user can access" and "forbidden user gets 403".
- Missing error case tests — what happens with invalid input.
- Hardcoded UUIDs in test data instead of generating dynamically.
- No test for custom actions/functions.

---

## Output Format

```
### Critical

**[C-1] Missing @requires on AdminService** — `srv/AdminService.cds:1`
The AdminService has no authorization annotation. Any unauthenticated user can access it.
Fix:
@requires: 'Admin'
service AdminService { ... }

### Warning

**[W-1] N+1 query in after handler** — `srv/CatalogService.js:45`
Each order fetches its customer individually. With 100 orders, this fires 100 DB queries.
Fix: batch-fetch using `where({ ID: { in: ids } })` with a Map lookup.

### Suggestion

**[S-1] Missing tests for CatalogService** — `test/`
No test file found for CatalogService. Add `test/catalog-service.test.js` covering
READ, CREATE, and authorization.
```

## Rules

- Do not praise code that is merely correct — focus on actionable feedback only.
- If no issues found, say so briefly. Do not pad the review.
- When suggesting a fix, show the corrected code.
- Group related findings (e.g., multiple missing `@requires`) into a single item.
- Always check `package.json` → `cds` section for configuration issues.
- Always check `.gitignore` for missing entries (`default-env.json`, `.env`, `*.sqlite`).
