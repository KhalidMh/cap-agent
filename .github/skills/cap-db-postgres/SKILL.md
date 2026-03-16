---
name: cap-db-postgres
description: PostgreSQL database usage in SAP CAP projects. Use when working with @cap-js/postgres, PostgreSQL configuration, schema evolution, native PostgreSQL features, pg-specific CDS configuration, or deploying CAP to PostgreSQL on BTP or standalone.
---

# PostgreSQL in CAP

## Context7 — Docs Lookup

Before answering PostgreSQL-related questions:

1. Call `context7/query-docs` with `context7CompatibleLibraryID` = `/cap-js/docs` and `topic` = `postgresql database` (or more specific topic).
2. For native PostgreSQL SQL syntax questions, call `context7/resolve-library-id` with query `postgresql` to find the library, then `context7/query-docs` on it.

## Package

```
@cap-js/postgres
```

This is the CDS database service for PostgreSQL. It brings schema evolution, CQL support, and CDS type mapping to PostgreSQL.

## Setup

```bash
npm add @cap-js/postgres
```

Unlike SQLite, this is a production dependency (no `-D`).

### package.json configuration

```json
{
  "cds": {
    "requires": {
      "db": {
        "kind": "postgres",
        "[development]": {
          "kind": "sqlite",
          "credentials": { "url": "db.sqlite" }
        },
        "[production]": {
          "kind": "postgres"
        }
      }
    }
  }
}
```

### Local PostgreSQL for development

```json
{
  "cds": {
    "requires": {
      "db": {
        "kind": "postgres",
        "credentials": {
          "host": "localhost",
          "port": 5432,
          "user": "postgres",
          "password": "postgres",
          "database": "my_cap_db"
        }
      }
    }
  }
}
```

Or via `default-env.json` (keep in `.gitignore`):

```json
{
  "VCAP_SERVICES": {
    "postgres": [{
      "name": "my-pg",
      "label": "postgres",
      "credentials": {
        "host": "localhost",
        "port": 5432,
        "user": "postgres",
        "password": "postgres",
        "database": "my_cap_db",
        "sslmode": "disable"
      }
    }]
  }
}
```

## Deploy & Schema

```bash
# Deploy schema to PostgreSQL
cds deploy --to postgres

# Deploy with explicit connection
cds deploy --to postgres --credentials '{"host":"localhost","port":5432,"user":"postgres","password":"postgres","database":"my_cap_db"}'
```

### Schema Evolution

`@cap-js/postgres` supports automatic schema evolution:

- Adding entities/fields → `ALTER TABLE ADD COLUMN`.
- Removing fields → column stays (ignored by CDS runtime).
- Renaming fields → drop + add (data loss). Use explicit migration for renames.
- Changing types → `ALTER COLUMN ... TYPE ...` when PostgreSQL allows the cast.
- Adding/removing indexes → handled automatically.

For complex migrations that auto-evolution can't handle, use custom migration scripts.

## Docker Setup for Local Dev

```yaml
# docker-compose.yml
version: '3.8'
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: my_cap_db
    ports:
      - "5432:5432"
    volumes:
      - pg_data:/var/lib/postgresql/data

volumes:
  pg_data:
```

```bash
docker compose up -d
cds deploy --to postgres
cds watch
```

## PostgreSQL Advantages Over SQLite

- True `DECIMAL` precision — safe for financial data.
- Full concurrent read/write — production ready.
- Native `BOOLEAN`, `UUID`, `JSONB`, `TIMESTAMP WITH TIME ZONE`.
- Full-text search capabilities.
- Window functions, CTEs, lateral joins.
- Proper transaction isolation levels.

## CDS Type Mapping

| CDS Type | PostgreSQL Type |
|----------|----------------|
| `String(n)` | `varchar(n)` |
| `Integer` | `integer` |
| `Integer64` | `bigint` |
| `Decimal(p,s)` | `numeric(p,s)` |
| `Double` | `double precision` |
| `Boolean` | `boolean` |
| `Date` | `date` |
| `Time` | `time` |
| `DateTime` | `timestamp` |
| `Timestamp` | `timestamp` |
| `UUID` | `uuid` |
| `Binary` | `bytea` |
| `LargeBinary` | `bytea` |
| `LargeString` | `text` |

## Native PostgreSQL Features in CAP

### Using native SQL

```js
// Use cds.db.run() for native SQL when CQL isn't enough
const db = cds.db;
const result = await db.run(`
  SELECT id, name,
         COUNT(*) OVER (PARTITION BY category) as category_count
  FROM my_bookshop_books
  WHERE price > $1
`, [10]);
```

### JSONB columns

```cds
entity Events : cuid, managed {
  name     : String(200);
  metadata : String; // stored as text, but you can cast to JSONB in native queries
}
```

```js
// Native query with JSONB
const result = await cds.db.run(`
  SELECT id, name, metadata::jsonb->>'location' as location
  FROM my_app_events
  WHERE metadata::jsonb @> $1::jsonb
`, [JSON.stringify({ type: 'conference' })]);
```

## BTP Deployment with PostgreSQL

### Using SAP BTP PostgreSQL Hyperscaler

In `mta.yaml`:

```yaml
resources:
  - name: my-pg-db
    type: org.cloudfoundry.managed-service
    parameters:
      service: postgresql-db
      service-plan: trial

modules:
  - name: my-srv
    requires:
      - name: my-pg-db
```

### Binding

```json
{
  "cds": {
    "requires": {
      "db": {
        "kind": "postgres",
        "vcap": { "label": "postgresql-db" }
      }
    }
  }
}
```

## Connection Pooling

`@cap-js/postgres` uses `pg` (node-postgres) under the hood. Configure pool settings:

```json
{
  "cds": {
    "requires": {
      "db": {
        "kind": "postgres",
        "pool": {
          "min": 2,
          "max": 10,
          "acquireTimeoutMillis": 30000,
          "idleTimeoutMillis": 30000
        }
      }
    }
  }
}
```

## Debugging PostgreSQL Issues

| Problem | Fix |
|---------|-----|
| `ECONNREFUSED` | PostgreSQL not running or wrong host/port |
| `password authentication failed` | Check credentials in config or `default-env.json` |
| `relation does not exist` | Run `cds deploy --to postgres` |
| `column does not exist` | Schema out of sync — redeploy or check model |
| `SSL connection required` | Add `"sslmode": "require"` to credentials |
| `connection pool exhausted` | Increase `pool.max` or check for leaked connections |
| `numeric field overflow` | `Decimal` precision too small for the data |

### Checking deployed schema

```bash
# Connect to PostgreSQL
psql -h localhost -U postgres -d my_cap_db

# List tables
\dt

# Show table structure
\d my_bookshop_books

# Check CDS deploy tracking table
SELECT * FROM cds_deploy_log ORDER BY created_at DESC LIMIT 5;
```

## Anti-Patterns

- Hardcoding credentials in `package.json` instead of using `default-env.json` or service bindings.
- Using raw SQL for operations CQL handles fine — breaks DB portability.
- Skipping connection pooling config in production.
- Not using `[production]` / `[development]` profiles to separate DB kinds.
- Committing `default-env.json` with production credentials.
- Using SQLite-specific assumptions (like float decimals) in code that runs on PostgreSQL.
