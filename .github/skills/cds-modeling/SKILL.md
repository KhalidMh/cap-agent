---
name: cds-modeling
description: CDS data modeling conventions for SAP CAP. Use when creating, editing, or reviewing CDS entity definitions, types, aspects, associations, compositions, annotations, projections, or service definitions.
---

# CDS Modeling Conventions

## Naming

- **PascalCase** for entity names, **camelCase** for element names.
- Name files to match their primary entity or service: `Products.cds`, `CatalogService.cds`.
- Use plural for entity names: `Products`, `Orders`, `Categories`.

## Keys & Types

- Always define explicit keys — prefer `UUID` type via the `cuid` aspect for new entities.
- Prefer `cds.DateTime` / `cds.Timestamp` over raw strings for dates.
- Use `type` definitions for reusable field types:

```cds
type Email : String(255);
type Amount : Decimal(15,2);
type Currency : Association to sap.common.Currencies;
```

- Prefer `String(n)` with explicit length over bare `String`.

## Aspects

- Always add `managed` aspect from `@sap/cds/common` for audit fields (`createdAt`, `createdBy`, etc.).
- Use `temporal` aspect for time-dependent data (valid-from/valid-to).
- Use `localized` for text fields that need i18n.
- Extract shared field groups into custom aspects:

```cds
aspect Addressable {
  street  : String(100);
  city    : String(50);
  country : Country;
  zipCode : String(10);
}

entity Suppliers : cuid, managed, Addressable {
  name : String(100);
}

entity Warehouses : cuid, managed, Addressable {
  capacity : Integer;
}
```

## Relationships

- **Composition** (`Composition of many`) for owned children (lifecycle-bound — deleted when parent is deleted).
- **Association** for references to independent entities (shared, not owned).
- Always define the `on` condition for compositions.
- Use backlink pattern for managed compositions:

```cds
entity Orders : cuid, managed {
  items : Composition of many OrderItems on items.order = $self;
}

entity OrderItems : cuid {
  order    : Association to Orders;
  product  : Association to Products;
  quantity : Integer;
}
```

- For many-to-many, use a link entity:

```cds
entity ProductCategories {
  key product  : Association to Products;
  key category : Association to Categories;
}
```

## Service Definitions & Projections

- Expose entities through services using projections:

```cds
service CatalogService {
  @readonly entity Products as projection on db.Products;
  entity Orders as projection on db.Orders;
  action submitOrder(orderID : UUID) returns String;
}
```

- Use `@readonly` for entities that should only support READ.
- Use `excluding { field1, field2 }` to hide internal fields:

```cds
service CatalogService {
  entity Products as projection on db.Products excluding { internalNotes };
}
```

- Use `@insertonly` for write-only entities (e.g., audit logs).

## Annotations

- Annotate for Fiori with `@UI`, `@Common`, `@title` where appropriate.
- Group annotations in separate `.cds` files (e.g., `annotations.cds`) to keep data models clean.
- Use `@assert.range` and `@assert.format` for input validation at the model level:

```cds
entity Products : cuid, managed {
  name   : String(100) @mandatory;
  price  : Decimal(10,2) @assert.range: [0.01, 999999.99];
  status : String enum { draft; active; discontinued } default 'draft';
  email  : String(255) @assert.format: '[^@]+@[^@]+\.[^@]+';
}
```

## Imports

- Prefer `using ... from` imports over inline references to other namespaces.
- Import common types from `@sap/cds/common`:

```cds
using { cuid, managed, temporal, Currency, Country } from '@sap/cds/common';
```

## Enums

- Use inline enums for simple status fields. Use a separate entity for enums that need to be extensible or translated:

```cds
// Inline — simple, fixed values
entity Orders {
  status : String enum { open; confirmed; shipped; cancelled };
}

// Separate entity — when you need descriptions, i18n, or extensibility
entity OrderStatuses : sap.common.CodeList {
  key code : String(20);
}
```

## Anti-Patterns

- Entity without explicit key.
- Using `String` for dates instead of `Date` / `DateTime`.
- Composition where Association is more appropriate (shared reference, not owned child).
- Duplicating fields across entities instead of using aspects.
- Mixing data definitions and annotations in the same file.
- Bare `String` without length constraint.
- Using `Integer` for IDs instead of `UUID` (breaks multi-tenant scenarios).
- Defining business logic in CDS (validation belongs in handlers, not CDS expressions).
