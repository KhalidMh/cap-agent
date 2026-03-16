---
name: cap-db-sqlite
description: SQLite database usage in SAP CAP projects. Use when working with @cap-js/sqlite, local development database, cds deploy --to sqlite, SQLite-specific configuration, schema evolution, or SQLite limitations and workarounds.
---

# SQLite in CAP

## Context7 — Docs Lookup

Before answering SQLite-related questions:

1. Call `context7/query-docs` with `context7CompatibleLibraryID` = `/cap-js/docs` and `topic` = `sqlite database` (or more specific topic).
2. For native SQLite SQL syntax questions, call `context7/resolve-library-id` with query `sqlite` to find the library, then `context7/query-docs` on it.

## Package

```
@cap-js/sqlite
```

This is the new CDS database service for SQLite. It replaces the older `@sap/cds-sqlite` package.

## Setup

```bash
npm add @cap-js/sqlite -D
```

`-D` because SQLite is typically a dev dependency — production uses HANA or PostgreSQL.

### package.json configuration

```json
{
  "cds": {
    "requires": {
      "db": {
        "kind": "sqlite",
        "credentials": {
          "url": "db.sqlite"
        },
        "[development]": {
          "kind": "sqlite",
          "credentials": { "url": "db.sqlite" }
        }
      }
    }
  }
}
```

For in-memory database (tests, ephemeral):

```json
{
  "cds": {
    "requires": {
      "db": {
        "kind": "sqlite",
        "credentials": { "url": ":memory:" }
      }
    }
  }
}
```

## Deploy & Schema

```bash
# Deploy schema to SQLite file
cds deploy --to sqlite

# Deploy with specific file
cds deploy --to sqlite:db/data.sqlite

# Re-create from scratch (when schema changes break migration)
rm db.sqlite && cds deploy --to sqlite
```

### Schema Evolution

`@cap-js/sqlite` supports automatic schema evolution:

- Adding new entities/fields → auto-migrated.
- Removing fields → column stays in DB (ignored by CDS).
- Renaming fields → treated as drop + add (data loss).
- Changing field types → may fail if incompatible.

When schema evolution fails, delete the `.sqlite` file and redeploy.

## Initial Data (CSV)

Place CSV files in `db/data/` matching the entity's full namespace:

```
db/data/my.bookshop-Books.csv
db/data/my.bookshop-Authors.csv
```

CSV header must match element names exactly (camelCase):

```csv
ID,title,price,currency_code
1,Wuthering Heights,11.11,GBP
2,Jane Eyre,12.34,GBP
```

For associations, use the foreign key column name (e.g., `author_ID` not `author`).

## SQLite Limitations in CAP

These are things SQLite doesn't support or handles differently from HANA/PostgreSQL:

### No native Boolean

SQLite stores booleans as integers (0/1). CDS handles this transparently, but raw SQL queries return 0/1.

### No DECIMAL precision

SQLite treats all `DECIMAL` as floating point. For financial data in production, use HANA or PostgreSQL.

### No concurrent writes

SQLite uses file-level locking. Fine for local dev, not suitable for production with multiple app instances.

### Limited string functions

Some CDS string functions may behave differently. `contains()` and `startswith()` work, but advanced regex is limited.

### No native UUID generation

CDS generates UUIDs in the application layer, not in the DB.

### No stored procedures

Anything requiring stored procedures or database-level logic needs a different approach in SQLite.

## Common Patterns

### Using SQLite for tests

```js
// test/setup.js — cds.test bootstraps with in-memory SQLite by default
const cds = require('@sap/cds');
const project = __dirname + '/..';
module.exports = cds.test(project);
```

### Switching DB per profile

```json
{
  "cds": {
    "requires": {
      "db": {
        "[development]": { "kind": "sqlite", "credentials": { "url": "db.sqlite" } },
        "[production]": { "kind": "hana" }
      }
    }
  }
}
```

### Inspecting the SQLite file

```bash
# Open SQLite CLI
sqlite3 db.sqlite

# List tables
.tables

# Show schema for a table
.schema my_bookshop_Books

# Run a query
SELECT * FROM my_bookshop_Books LIMIT 5;
```

## Debugging SQLite Issues

| Problem | Fix |
|---------|-----|
| `SQLITE_ERROR: no such table` | Run `cds deploy --to sqlite` |
| Schema change not reflected | Delete `.sqlite` file, redeploy |
| Data not loading from CSV | Check file naming matches full namespace |
| `SQLITE_BUSY` | Another process holds the file lock |
| Decimal precision wrong | Expected — SQLite uses floats. Use HANA/PG for precision. |

## Anti-Patterns

- Using SQLite in production with multiple instances (concurrency issues).
- Relying on `DECIMAL` precision in SQLite for financial calculations.
- Manually writing `CREATE TABLE` instead of using `cds deploy`.
- Committing the `.sqlite` file to git — add to `.gitignore`.
- Using `@cap-js/sqlite` without `-D` flag — it's a dev dependency.
