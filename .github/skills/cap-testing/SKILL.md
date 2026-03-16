---
name: cap-testing
description: Testing SAP CAP applications. Use when writing, editing, or reviewing unit tests, integration tests, test setup, cds.test, mock users, test fixtures, or when the user asks about testing strategies for CAP services.
---

# Testing

## Test Framework

- Use `jest` as the test runner.
- Use `cds.test()` to bootstrap a CAP server for integration tests.
- Place tests in `test/` at the project root.
- Name test files to match the service: `CatalogService.test.js`.

## Project Setup

```json
// package.json
{
  "scripts": {
    "test": "jest --forceExit"
  },
  "devDependencies": {
    "jest": "^29",
    "axios": "^1"
  },
  "jest": {
    "testTimeout": 20000
  }
}
```

## cds.test() — Integration Tests

`cds.test()` starts a full CAP server in-process, deploys to SQLite in-memory, and returns an axios-like HTTP client.

```js
const cds = require('@sap/cds');
const { expect } = cds.test(__dirname + '/..');

describe('CatalogService', () => {
  it('should return products', async () => {
    const { data } = await cds.test.get('/odata/v4/catalog/Products');
    expect(data.value).toBeInstanceOf(Array);
  });

  it('should create a product', async () => {
    const { status, data } = await cds.test.post('/odata/v4/catalog/Products', {
      name: 'Test Product',
      price: 9.99,
    });
    expect(status).toBe(201);
    expect(data.name).toBe('Test Product');
  });

  it('should reject invalid product', async () => {
    try {
      await cds.test.post('/odata/v4/catalog/Products', { price: -1 });
      fail('Should have thrown');
    } catch (e) {
      expect(e.response.status).toBe(400);
    }
  });
});
```

## Authenticated Tests with Mock Users

Use the `auth` option to send requests as a specific mock user. Mock users must be defined in `package.json` under `cds.requires.auth`.

```js
const cds = require('@sap/cds');
const { expect } = cds.test(__dirname + '/..');

describe('AdminService (authorized)', () => {
  it('should allow admin to read sensitive data', async () => {
    const { status } = await cds.test.get('/odata/v4/admin/Users', {
      auth: { username: 'admin', password: 'admin' },
    });
    expect(status).toBe(200);
  });

  it('should reject viewer from writing', async () => {
    try {
      await cds.test.post('/odata/v4/admin/Users', {
        auth: { username: 'viewer', password: 'viewer' },
        data: { name: 'New User' },
      });
      fail('Should have thrown');
    } catch (e) {
      expect(e.response.status).toBe(403);
    }
  });
});
```

## Testing Actions

```js
describe('submitOrder action', () => {
  let orderID;

  beforeAll(async () => {
    const { data } = await cds.test.post('/odata/v4/catalog/Orders', {
      status: 'open',
    });
    orderID = data.ID;
  });

  it('should submit an existing order', async () => {
    const { status, data } = await cds.test.post(
      `/odata/v4/catalog/submitOrder`,
      { orderID }
    );
    expect(status).toBe(200);
  });

  it('should reject non-existent order', async () => {
    try {
      await cds.test.post('/odata/v4/catalog/submitOrder', {
        orderID: '00000000-0000-0000-0000-000000000000',
      });
      fail('Should have thrown');
    } catch (e) {
      expect(e.response.status).toBe(404);
    }
  });
});
```

## Testing OData Queries

```js
describe('OData query features', () => {
  it('should support $filter', async () => {
    const { data } = await cds.test.get(
      `/odata/v4/catalog/Products?$filter=price gt 10`
    );
    for (const p of data.value) {
      expect(p.price).toBeGreaterThan(10);
    }
  });

  it('should support $expand', async () => {
    const { data } = await cds.test.get(
      `/odata/v4/catalog/Orders?$expand=items`
    );
    expect(data.value[0].items).toBeDefined();
  });

  it('should support $select', async () => {
    const { data } = await cds.test.get(
      `/odata/v4/catalog/Products?$select=name,price`
    );
    const product = data.value[0];
    expect(product.name).toBeDefined();
    expect(product.price).toBeDefined();
    expect(product.description).toBeUndefined();
  });

  it('should support pagination', async () => {
    const { data } = await cds.test.get(
      `/odata/v4/catalog/Products?$top=5&$skip=0&$count=true`
    );
    expect(data.value.length).toBeLessThanOrEqual(5);
    expect(data['@odata.count']).toBeDefined();
  });
});
```

## Test Data Fixtures

Use `beforeAll` to seed data, or create a `test/data/` folder with CSV files that CDS auto-deploys:

```
test/
├── data/
│   ├── my.bookshop-Books.csv
│   └── my.bookshop-Authors.csv
├── CatalogService.test.js
└── AdminService.test.js
```

CSV file names follow the pattern: `<namespace>-<EntityName>.csv`.

## Unit Testing Business Logic

For logic extracted into `srv/lib/`, test it in isolation:

```js
// srv/lib/pricing.js
function calculateDiscount(price, quantity) {
  if (quantity >= 100) return price * 0.15;
  if (quantity >= 50) return price * 0.10;
  if (quantity >= 10) return price * 0.05;
  return 0;
}
module.exports = { calculateDiscount };

// test/pricing.test.js
const { calculateDiscount } = require('../srv/lib/pricing');

describe('calculateDiscount', () => {
  it('should give 15% for 100+ items', () => {
    expect(calculateDiscount(100, 100)).toBe(15);
  });
  it('should give 0 for less than 10 items', () => {
    expect(calculateDiscount(100, 5)).toBe(0);
  });
});
```

## Anti-Patterns

- Testing against a production database — always use in-memory SQLite via `cds.test()`.
- Missing `--forceExit` in jest config — CAP server may keep the process alive.
- Not testing authorization — always test both allowed and forbidden scenarios.
- Hardcoded test data IDs — use `beforeAll` to create data and capture IDs.
- Testing only happy paths — always test error cases and edge cases.
- Skipping OData query tests — `$filter`, `$expand`, `$select` are the API contract.
