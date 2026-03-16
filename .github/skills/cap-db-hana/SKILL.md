---
name: cap-db-hana
description: SAP HANA database usage in SAP CAP projects. Use when working with @cap-js/hana, HDI containers, HANA-specific CDS features, native HANA functions, HANA Cloud deployment, schema evolution on HANA, or production database topics on BTP.
---

# SAP HANA in CAP

## Context7 — Docs Lookup

Before answering HANA-related questions:

1. Call `context7/query-docs` with `context7CompatibleLibraryID` = `/cap-js/docs` and `topic` = `hana database` (or more specific topic).
2. For native HANA SQL or HDI-specific questions, call `context7/resolve-library-id` with query `sap hana` to find the library, then `context7/query-docs` on it.

## Package

```
@cap-js/hana
```

This is the CDS database service for SAP HANA. It replaces the older `@sap/cds-hana` package.

## Setup

```bash
npm add @cap-js/hana
```

Production dependency — HANA is the primary production database for CAP on BTP.

### package.json configuration

```json
{
  "cds": {
    "requires": {
      "db": {
        "kind": "hana",
        "[development]": {
          "kind": "sqlite",
          "credentials": { "url": "db.sqlite" }
        },
        "[production]": {
          "kind": "hana"
        }
      }
    }
  }
}
```

## HDI (HANA Deployment Infrastructure)

HANA uses HDI containers to manage database artifacts. CDS models compile to HDI artifacts (`.hdbtable`, `.hdbview`, etc.).

### Build for HANA

```bash
# Compile CDS to HANA artifacts
cds build --production

# This generates:
# gen/db/        — HDI artifacts (.hdbtable, .hdbview, etc.)
# gen/db/src/    — generated SQL artifacts
# gen/db/undeploy.json — artifacts to remove
```

### Deploy to HANA

```bash
# Via MTA build + cf deploy
mbt build
cf deploy mta_archives/*.mtar

# Or directly via hdi-deploy
cd gen/db
npm start  # runs hdi-deploy
```

### Hybrid local development (local app + remote HANA)

```bash
# Bind to HANA service on BTP
cds bind --to hana:my-hana-service

# Run locally against remote HANA
cds watch --profile hybrid

# Or one-shot
cds bind --exec -- cds watch
```

## Schema Evolution on HANA

HDI handles schema evolution automatically:

- Adding entities/fields → new tables/columns created.
- Removing fields → marked in `undeploy.json`, column dropped on next deploy.
- Renaming → treated as drop + add (data loss). Use `undeploy.json` carefully.
- Type changes → HDI attempts `ALTER COLUMN`. Incompatible changes fail the deploy.

### undeploy.json

When you remove or rename entities, add the old artifact to `undeploy.json`:

```json
[
  "src/gen/my.bookshop-OldEntity.hdbtable",
  "src/gen/my.bookshop-RenamedEntity.hdbtable"
]
```

Without this, orphaned artifacts remain in the HDI container.

## HANA-Specific CDS Features

### Native HANA types

```cds
entity Documents : cuid, managed {
  title   : String(200);
  content : hana.CLOB;       // Large text
  data    : hana.BLOB;       // Binary data
  geo     : hana.ST_POINT;   // Geospatial
}
```

### Calculated elements (pushed to DB)

```cds
entity Products : cuid, managed {
  name     : String(100);
  price    : Decimal(10,2);
  quantity : Integer;
  total    : Decimal(10,2) = price * quantity stored;  // computed column in HANA
}
```

### Full-text indexes

```cds
@cds.search: { title, description }
entity Articles : cuid, managed {
  title       : String(200);
  description : String(5000);
  content     : LargeString;
}
```

On HANA this creates a full-text index for efficient search.

### Temporal data

```cds
@cds.valid.from: 'validFrom'
@cds.valid.to: 'validTo'
entity Prices {
  key product : Association to Products;
  key validFrom : Date;
  validTo       : Date;
  price         : Decimal(10,2);
}
```

## CDS Type Mapping to HANA

| CDS Type | HANA Type |
|----------|-----------|
| `String(n)` | `NVARCHAR(n)` |
| `Integer` | `INTEGER` |
| `Integer64` | `BIGINT` |
| `Decimal(p,s)` | `DECIMAL(p,s)` |
| `Double` | `DOUBLE` |
| `Boolean` | `BOOLEAN` |
| `Date` | `DATE` |
| `Time` | `TIME` |
| `DateTime` | `TIMESTAMP` |
| `Timestamp` | `TIMESTAMP` |
| `UUID` | `NVARCHAR(36)` |
| `Binary(n)` | `VARBINARY(n)` |
| `LargeBinary` | `BLOB` |
| `LargeString` | `NCLOB` |

## Native HANA Features in CAP

### Using native HANA SQL

```js
const db = cds.db;

// Window functions
const result = await db.run(`
  SELECT "ID", "NAME",
         ROW_NUMBER() OVER (PARTITION BY "CATEGORY" ORDER BY "PRICE" DESC) as rank
  FROM "MY_BOOKSHOP_PRODUCTS"
  WHERE "PRICE" > ?
`, [10]);
```

Note: HANA uses uppercase identifiers by default. Quoted identifiers preserve case.

### Using HANA calculation views

Define in `db/src/` as `.hdbcalculationview` and expose via CDS:

```cds
@cds.persistence.exists
entity SalesAnalytics {
  key product   : String(100);
  totalRevenue  : Decimal(15,2);
  orderCount    : Integer;
  avgOrderValue : Decimal(10,2);
}
```

`@cds.persistence.exists` tells CDS the table/view already exists in HANA — don't generate DDL.

### Using synonyms for cross-container access

```cds
// Access objects from another HDI container
@cds.persistence.exists
entity ExternalMasterData {
  key ID   : String(50);
  name     : String(200);
}
```

Create an `.hdbsynonym` in `db/src/` pointing to the external object.

## MTA Configuration for HANA

```yaml
resources:
  - name: my-hana-db
    type: com.sap.xs.hdi-container
    parameters:
      service: hana
      service-plan: hdi-shared

modules:
  - name: my-db-deployer
    type: hdb
    path: gen/db
    requires:
      - name: my-hana-db

  - name: my-srv
    type: nodejs
    path: gen/srv
    requires:
      - name: my-hana-db
```

## xs-security.json for HANA + XSUAA

```json
{
  "xsappname": "my-app",
  "tenant-mode": "dedicated",
  "scopes": [
    { "name": "$XSAPPNAME.Admin", "description": "Admin" },
    { "name": "$XSAPPNAME.Viewer", "description": "Viewer" }
  ],
  "role-templates": [
    {
      "name": "Admin",
      "scope-references": ["$XSAPPNAME.Admin"]
    },
    {
      "name": "Viewer",
      "scope-references": ["$XSAPPNAME.Viewer"]
    }
  ]
}
```

## Connection Configuration

HANA connections on BTP are managed via service bindings. For hybrid development:

```json
// default-env.json (DO NOT commit)
{
  "VCAP_SERVICES": {
    "hana": [{
      "name": "my-hana-db",
      "label": "hana",
      "plan": "hdi-shared",
      "credentials": {
        "host": "your-hana-host.hanacloud.ondemand.com",
        "port": "443",
        "user": "HDI_USER",
        "password": "...",
        "schema": "MY_HDI_CONTAINER",
        "certificate": "...",
        "encrypt": true
      }
    }]
  }
}
```

## Debugging HANA Issues

| Problem | Fix |
|---------|-----|
| `HDI deploy failed` | Run `cds compile --to sql` to check model errors |
| `insufficient privilege` | Check HDI container grants and technical user |
| `invalid column name` | HANA uses uppercase — check if your native SQL uses lowercase |
| `Connection failed` | Check host, port, SSL settings. HANA Cloud requires port 443. |
| `undeploy.json` errors | Remove stale entries or re-generate with `cds build` |
| `table already exists` | Artifact collision — check `@cds.persistence.exists` usage |
| `calculation view not found` | Deploy `.hdbcalculationview` artifacts first |
| `schema evolution failed` | Incompatible type change — manual migration needed |

### Inspecting HDI container

```bash
# Via BTP cockpit → HANA Cloud Central → SAP HANA Database Explorer
# Or via hdbsql CLI:
hdbsql -i 00 -n host:443 -u HDI_USER -p PASSWORD -d MY_DB \
  "SELECT TABLE_NAME FROM TABLES WHERE SCHEMA_NAME = 'MY_SCHEMA'"
```

## Anti-Patterns

- Using raw HANA SQL for operations CQL handles — breaks portability to SQLite/PostgreSQL.
- Hardcoding HANA credentials instead of using service bindings.
- Forgetting `undeploy.json` when removing entities — orphaned artifacts accumulate.
- Using `@cds.persistence.exists` without creating the corresponding HANA artifact.
- Not testing with `cds compile --to sql` before deploying to HANA.
- Deploying to HANA without `cds build --production` first.
- Using lowercase identifiers in native HANA SQL without quoting.
- Skipping `[production]` profile — risking SQLite config in production.
