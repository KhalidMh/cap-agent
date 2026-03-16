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

```js
// BAD — fetches all, filters in JS
const allOrders = await SELECT.from(Orders);
const openOrders = allOrders.filter(o => o.status === 'open');

// GOOD — filter at DB level
const openOrders = await SELECT.from(Orders).where({ status: 'open' });
```

```js
// BAD — selects everything
const products = await SELECT.from(Products);

// GOOD — only what you need
const products = await SELECT.from(Products).columns('ID', 'name', 'price');
```

## N+1 Prevention

- Watch for N+1 patterns in `after` handlers — fetching related data in a loop.
- Prefer `$expand` or CQL joins to load related data in a single query.
- Use `SELECT.from(Entity).where({ ID: { in: ids } })` for batch lookups.

```js
// BAD — N+1 in after handler
this.after('READ', Orders, async (orders) => {
  for (const order of orders) {
    order.customer = await SELECT.one.from(Customers).where({ ID: order.customer_ID });
  }
});

// GOOD — batch lookup with Map
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

## Deep Expand

- Flag `$expand` chains deeper than 3 levels as potential performance risks.
- Suggest projections or custom views to flatten deeply nested structures.
- Use `SELECT` with explicit columns + expand instead of relying on OData auto-expand:

```js
// Controlled expand
const orders = await SELECT.from(Orders)
  .columns('ID', 'status', 'orderDate')
  .columns(o => { o.items(i => { i.product_ID; i.quantity; i.price; }); })
  .limit(50);
```

## Pagination

```js
// Server-driven pagination in a custom READ handler
this.on('READ', Products, async (req) => {
  const top = req.query.SELECT.limit?.rows?.val ?? 100;
  const skip = req.query.SELECT.limit?.offset?.val ?? 0;
  const result = await SELECT.from(Products).limit(top, skip);
  result.$count = await SELECT.one.from(Products).columns('count(*) as count');
  return result;
});
```

## Bulk Operations

- Use `INSERT.into(Entity).entries([...])` for bulk inserts instead of looping single inserts.
- Use `cds.tx()` to batch multiple operations in a single transaction when appropriate.

```js
// BAD — one insert per item
for (const item of items) {
  await INSERT.into(OrderItems).entries(item);
}

// GOOD — single bulk insert
await INSERT.into(OrderItems).entries(items);
```

## Indexing

- Add `@cds.search` annotations on entities exposed in list views:

```cds
@cds.search: { name, description }
entity Products : cuid, managed {
  name        : String(100);
  description : String(500);
  price       : Decimal(10,2);
}
```

- Flag frequently filtered fields that lack database indexes.
- Use `@assert.unique` to enforce uniqueness at the database level:

```cds
@assert.unique: { email: [email] }
entity Users : cuid, managed {
  email : String(255);
  name  : String(100);
}
```

## Caching

- For rarely-changing reference data from remote services, suggest caching strategies.
- Use `cds.requires.<service>.credentials.cache` configuration when available.
- Cache lookups in-memory for data that doesn't change during a request:

```js
this.on('enrichOrders', async (req) => {
  const bupa = await cds.connect.to('API_BUSINESS_PARTNER');
  const partnerCache = new Map();

  for (const order of req.data.orders) {
    if (!partnerCache.has(order.partner_ID)) {
      const partner = await bupa.run(
        SELECT.one.from('A_BusinessPartner').where({ BusinessPartner: order.partner_ID })
      );
      partnerCache.set(order.partner_ID, partner);
    }
    order.partnerName = partnerCache.get(order.partner_ID)?.BusinessPartnerName;
  }
});
```

## Anti-Patterns

- Unbounded SELECT without LIMIT.
- N+1 queries in loops.
- Fetching full entities when only 2-3 columns are needed.
- Filtering in JS after fetching all rows from DB.
- Deep $expand chains (3+ levels).
- Single inserts in a loop instead of bulk.
- Missing `@cds.search` on entities used in list views.
