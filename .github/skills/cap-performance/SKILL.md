---
name: cap-performance
description: Performance optimization for SAP CAP. Use when writing or reviewing queries, dealing with $expand, pagination, N+1 problems, indexing, bulk operations, or optimizing CDS/JS code for speed.
---

# Performance

## Query Optimization

- Flag unbounded `SELECT` queries — always use `LIMIT` or pagination (`$top` / `$skip`).
- Prefer `SELECT.columns(...)` over `SELECT.from(Entity)` when only a few fields are needed.
- Use `@cds.search` annotation for full-text search instead of manual `LIKE` queries.
- Use `exists` subqueries instead of fetching and filtering in JavaScript.

## N+1 Prevention

- Watch for N+1 patterns in `after` handlers — fetching related data in a loop.
- Prefer `$expand` or CQL joins to load related data in a single query.
- Use `SELECT.from(Entity).where({ ID: { in: ids } })` for batch lookups.

## Deep Expand

- Flag `$expand` chains deeper than 3 levels as potential performance risks.
- Suggest projections or custom views to flatten deeply nested structures.

## Bulk Operations

- Use `INSERT.into(Entity).entries([...])` for bulk inserts instead of looping single inserts.
- Use `cds.tx()` to batch multiple operations in a single transaction when appropriate.

## Indexing

- Suggest `@cds.search` annotations on entities exposed in list views.
- Flag frequently filtered fields that lack database indexes.
- Use `@assert.unique` to enforce uniqueness at the database level.

## Caching

- For rarely-changing reference data from remote services, suggest caching strategies.
- Use `cds.requires.<service>.credentials.cache` configuration when available.

## Anti-Patterns

```js
// BAD — N+1 in after handler
this.after('READ', Orders, async (orders) => {
  for (const order of orders) {
    order.customer = await SELECT.one.from(Customers).where({ ID: order.customer_ID });
  }
});

// GOOD — batch lookup
this.after('READ', Orders, async (orders) => {
  const ids = orders.map(o => o.customer_ID);
  const customers = await SELECT.from(Customers).where({ ID: { in: ids } });
  const map = new Map(customers.map(c => [c.ID, c]));
  for (const order of orders) {
    order.customer = map.get(order.customer_ID);
  }
});
```
