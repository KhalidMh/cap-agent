---
name: cap-fiori-elements
description: Fiori Elements annotations for SAP CAP. Use when working with @UI annotations, List Report, Object Page, value helps, draft handling, side effects, field groups, selection fields, or any Fiori Elements UI configuration in CDS.
---

# Fiori Elements Annotations

## Overview

Fiori Elements UIs are driven by OData annotations in CDS. No custom frontend code needed — the UI is generated from annotations.

Keep annotations in separate files (e.g., `srv/annotations.cds` or per-entity files like `srv/annotations/Products.cds`) to keep data models clean.

## List Report — Basic Setup

```cds
using CatalogService as service from '../srv/CatalogService';

// Selection fields (filter bar)
annotate service.Products with @UI.SelectionFields: [
  category_ID,
  status,
  price,
];

// Table columns
annotate service.Products with @UI.LineItem: [
  { Value: name, Label: 'Product Name' },
  { Value: price, Label: 'Price' },
  { Value: currency_code, Label: 'Currency' },
  { Value: category.name, Label: 'Category' },
  { Value: status, Label: 'Status', Criticality: criticality },
  { Value: stock, Label: 'Stock' },
];
```

## Object Page — Header & Sections

```cds
annotate service.Products with @UI: {
  HeaderInfo: {
    TypeName: 'Product',
    TypeNamePlural: 'Products',
    Title: { Value: name },
    Description: { Value: description },
    ImageUrl: imageUrl,
  },

  HeaderFacets: [
    { $Type: 'UI.ReferenceFacet', Target: '@UI.FieldGroup#Price' },
    { $Type: 'UI.ReferenceFacet', Target: '@UI.DataPoint#Stock' },
  ],

  Facets: [
    { $Type: 'UI.ReferenceFacet', Label: 'General', Target: '@UI.FieldGroup#General' },
    { $Type: 'UI.ReferenceFacet', Label: 'Details', Target: '@UI.FieldGroup#Details' },
    { $Type: 'UI.ReferenceFacet', Label: 'Reviews', Target: 'reviews/@UI.LineItem' },
  ],

  FieldGroup#General: {
    Data: [
      { Value: name },
      { Value: description },
      { Value: category_ID },
    ],
  },

  FieldGroup#Details: {
    Data: [
      { Value: weight },
      { Value: dimensions },
      { Value: manufacturer },
    ],
  },

  FieldGroup#Price: {
    Data: [
      { Value: price },
      { Value: currency_code },
    ],
  },

  DataPoint#Stock: {
    Value: stock,
    Title: 'Stock',
    Criticality: stockCriticality,
  },
};
```

## Criticality (Traffic Lights)

Use a computed integer field for criticality:

```cds
// In the entity or a view
extend Products with {
  criticality : Integer @UI.Hidden;
}
```

```js
// In after READ handler
this.after('READ', Products, (products) => {
  for (const p of products) {
    if (p.status === 'discontinued') p.criticality = 1;      // Red
    else if (p.stock < 10) p.criticality = 2;                 // Yellow
    else p.criticality = 3;                                    // Green
  }
});
```

Criticality values: `0` = neutral (grey), `1` = negative (red), `2` = critical (yellow), `3` = positive (green).

## Value Helps

```cds
annotate service.Products with {
  category @Common: {
    Label: 'Category',
    Text: category.name,
    TextArrangement: #TextOnly,
    ValueList: {
      CollectionPath: 'Categories',
      Parameters: [
        { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: category_ID, ValueListProperty: 'ID' },
        { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'name' },
        { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'description' },
      ],
    },
  };
}
```

## Draft Handling

Enable draft for entities that need edit sessions:

```cds
annotate service.Products with @odata.draft.enabled;
```

This automatically adds draft tables, `IsActiveEntity`, `HasActiveEntity`, and `DraftAdministrativeData`. No handler changes needed for basic draft support.

For custom draft logic:

```js
// Runs when user activates (saves) a draft
this.before('SAVE', Products, (req) => {
  // Final validation before activation
  if (!req.data.name) req.error(400, 'Name is required before publishing', 'name');
});

// Runs when a new draft is created
this.before('NEW', Products, (req) => {
  req.data.status = 'draft';
});

// Runs when an existing entity is put into edit mode
this.before('EDIT', Products, (req) => {
  // Check if entity is locked, etc.
});
```

## Side Effects

Trigger UI refresh when a field changes:

```cds
annotate service.OrderItems with @Common.SideEffects: {
  SourceProperties: [quantity],
  TargetProperties: [totalPrice],
};

annotate service.Orders with @Common.SideEffects: #ItemsChanged: {
  SourceEntities: [items],
  TargetProperties: [totalAmount],
};
```

## Actions in the UI

```cds
// Bound action shown as button on Object Page
annotate service.Products actions {
  @Core.OperationAvailable: { $edmJson: { $If: [{ $Eq: [{ $Path: 'status' }, 'draft'] }, true, false] } }
  publish @(
    Common.SideEffects: {
      TargetProperties: ['status', 'criticality'],
    }
  );
};

// Unbound action shown in List Report toolbar
annotate service.bulkPublish with @UI.DataFieldForAction: {
  Label: 'Publish Selected',
  Action: 'CatalogService.bulkPublish',
};
```

## Common Annotation Patterns

### Read-only fields

```cds
annotate service.Products with {
  createdAt @UI.ReadOnly;
  createdBy @UI.ReadOnly;
};
```

### Hidden fields

```cds
annotate service.Products with {
  internalCode @UI.Hidden;
  criticality  @UI.Hidden;
};
```

### Mandatory fields in UI

```cds
annotate service.Products with {
  name @Common.FieldControl: #Mandatory;
};
```

### Text arrangements

```cds
annotate service.Products with {
  status @Common: {
    Text: statusText,
    TextArrangement: #TextOnly,  // or #TextFirst, #TextLast, #TextSeparate
  };
};
```

## Anti-Patterns

- Annotations in the data model file — keep them in separate annotation files.
- Missing `@UI.Hidden` on computed/criticality fields — they show as raw numbers.
- Draft enabled without testing the full edit-save-cancel cycle.
- Value helps without `TextArrangement` — shows UUIDs instead of names.
- Missing `TypeName` / `TypeNamePlural` in `HeaderInfo` — generic "Object" label.
- Hardcoded criticality values instead of computed field — breaks when business rules change.
- Side effects on too many fields — triggers excessive server roundtrips.
