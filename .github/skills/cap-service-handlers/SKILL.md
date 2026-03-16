---
name: cap-service-handlers
description: Service handler patterns for SAP CAP Node.js runtime. Use when writing, editing, or reviewing custom event handlers, CRUD hooks, actions, functions, or service implementations in JavaScript.
---

# Service Handler Patterns (Node.js)

## Registration

- Register handlers with `this.on()`, `this.before()`, `this.after()` inside the `init()` method.
- Always call `await super.init()` at the end of `init()`.
- Destructure CQL operators at the top: `const { SELECT, INSERT, UPDATE, DELETE } = cds.ql`.
- Use class-style service implementation (extends `cds.ApplicationService`).

## Handler Roles

| Hook | Purpose | Runs |
|------|---------|------|
| `this.before('CREATE', Entity)` | Input validation, defaults, authorization checks | Before DB write |
| `this.before('UPDATE', Entity)` | Field-level validation, immutable field protection | Before DB write |
| `this.before('DELETE', Entity)` | Referential integrity checks, soft-delete logic | Before DB write |
| `this.on('READ', Entity)` | Only when overriding default CRUD — prefer CQL delegation | Instead of default |
| `this.after('READ', Entity)` | Computed fields, data enrichment, formatting | After DB read |
| `this.on('ACTION_NAME', ...)` | Custom bound/unbound actions and functions | Custom |
| `this.before('*', Entity)` | Cross-cutting concerns (logging, tenant checks) | Before any event |

## Handler Signatures

```js
// before/on handlers receive req
this.before('CREATE', Products, async (req) => {
  // req.data — the incoming payload
  // req.user — authenticated user
  // req.params — bound action parameters [{ID: '...'}]
  // req.query — the CQL query object
});

// after handlers receive data + req
this.after('READ', Products, (data, req) => {
  // data — array of results (even for single reads)
  // req — same request object
});
```

## Error Handling

- Use `req.error(code, message, target)` for validation errors — accumulates multiple errors, does not abort.
- Use `req.reject(code, message)` to immediately abort the request.
- Never throw raw `Error` objects.
- For multiple validation errors, use `req.error()` multiple times — CAP collects them and returns them all:

```js
this.before('CREATE', Products, (req) => {
  const { name, price, stock } = req.data;
  if (!name) req.error(400, 'Name is required', 'name');
  if (price < 0) req.error(400, 'Price must be positive', 'price');
  if (stock < 0) req.error(400, 'Stock cannot be negative', 'stock');
  // All errors returned together — request aborted only if any error was added
});
```

## Setting Defaults

```js
this.before('CREATE', Orders, (req) => {
  req.data.status ??= 'open';
  req.data.orderDate ??= new Date().toISOString();
});
```

## Computed Fields in after Handlers

```js
this.after('READ', Products, (products) => {
  for (const p of products) {
    p.available = p.stock > 0;
    p.displayPrice = `${p.price} ${p.currency_code}`;
  }
});
```

## Actions and Functions

```js
// Bound action — operates on a specific entity instance
this.on('approve', Orders, async (req) => {
  const { ID } = req.params[0];
  await UPDATE(Orders).set({ status: 'approved' }).where({ ID });
  return { message: `Order ${ID} approved` };
});

// Unbound action — not tied to an entity
this.on('resetCatalog', async (req) => {
  await DELETE.from(Products);
  return { message: 'Catalog reset' };
});
```

## External Services

- Use `cds.connect.to('service-name')` for consuming remote services.
- Never hardcode HTTP calls with `fetch` or `axios` to SAP endpoints.
- Define external services in `package.json` under `cds.requires`.
- Connect lazily inside handlers, not in `init()`:

```js
this.on('fetchCustomerDetails', async (req) => {
  const bupa = await cds.connect.to('API_BUSINESS_PARTNER');
  const result = await bupa.run(
    SELECT.from('A_BusinessPartner').where({ BusinessPartner: req.data.partnerId })
  );
  return result;
});
```

## Emitting Events

```js
this.after('CREATE', Orders, async (data, req) => {
  const messaging = await cds.connect.to('messaging');
  await messaging.emit('OrderCreated', { orderID: data.ID });
});
```

## Structure

- Keep handlers thin — extract business logic into modules under `srv/lib/`.
- One service file per CDS service definition.
- Name handler files to match service names: `CatalogService.js` → `CatalogService.cds`.

## Reference

See the [handler template](./handler-template.js) for the standard structure.

## Anti-Patterns

- `this.on('READ', ...)` that just wraps a `SELECT` without adding logic.
- Throwing `new Error(...)` instead of using `req.reject()`.
- Inline `fetch()` calls to external SAP services.
- Fat handlers with 100+ lines of business logic — split into `srv/lib/`.
- Connecting to external services in `init()` — do it lazily in the handler.
- Modifying `req.data` in `after` handlers (too late — data is already persisted).
- Forgetting `await super.init()` at end of `init()`.
