---
name: cds-modeling
description: CDS data modeling conventions for SAP CAP. Use when creating, editing, or reviewing CDS entity definitions, types, aspects, associations, compositions, or annotations.
---

# CDS Modeling Conventions

## Naming

- **PascalCase** for entity names, **camelCase** for element names.
- Name files to match their primary entity or service: `Products.cds`, `CatalogService.cds`.

## Keys & Types

- Always define explicit keys — prefer `UUID` type (`cuid` aspect) for new entities.
- Prefer `cds.DateTime` / `cds.Timestamp` over raw strings for dates.
- Use `type` definitions for reusable field types.

## Aspects

- Always add `managed` aspect from `@sap/cds/common` for audit fields.
- Use `localized` for text fields that need i18n.
- Extract shared field groups into custom aspects to avoid duplication.

## Relationships

- **Composition** (`Composition of many`) for owned children (lifecycle-bound).
- **Association** for references to independent entities.
- Always define the `on` condition for compositions.

## Annotations

- Annotate for Fiori with `@UI`, `@Common`, `@title` where appropriate.
- Group annotations in separate `.cds` files (e.g. `annotations.cds`) to keep data models clean.

## Imports

- Prefer `using ... from` imports over inline references to other namespaces.

## Example — Good Entity

```cds
using { cuid, managed } from '@sap/cds/common';

entity Products : cuid, managed {
  name        : localized String(100) @title: 'Product Name';
  description : localized String(500);
  price       : Decimal(10,2);
  currency    : Currency;
  category    : Association to Categories;
  reviews     : Composition of many Reviews on reviews.product = $self;
}
```

## Anti-Patterns

- Entity without explicit key.
- Using `String` for dates instead of `Date` / `DateTime`.
- Composition where Association is more appropriate (shared reference, not owned child).
- Duplicating fields across entities instead of using aspects.
- Mixing data definitions and annotations in the same file.
