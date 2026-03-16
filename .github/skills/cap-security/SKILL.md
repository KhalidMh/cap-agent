---
name: cap-security
description: Security practices for SAP CAP. Use when working with authorization, authentication, @requires/@restrict annotations, xs-security.json, XSUAA, roles, scopes, data protection, or reviewing code for security vulnerabilities.
---

# Security

## CDS Authorization

- Every service exposing sensitive data must use `@requires` or `@restrict` annotations.
- Use `@requires: 'authenticated-user'` as the minimum for non-public services.
- Use `@restrict` with `grant` and `where` clauses for row-level authorization.
- Prefer role-based annotations over programmatic checks in handlers.

### Service-Level Authorization

```cds
@requires: 'authenticated-user'
service CatalogService {
  @readonly entity Products as projection on db.Products;
  @restrict: [{ grant: ['READ','WRITE'], to: 'Admin' }]
  entity Categories as projection on db.Categories;
}
```

### Row-Level Authorization

```cds
@restrict: [
  { grant: 'READ', where: 'createdBy = $user' },
  { grant: '*', to: 'Admin' }
]
entity Orders as projection on db.Orders;
```

### Draft-Enabled Entity Authorization

```cds
@odata.draft.enabled
@restrict: [
  { grant: ['READ', 'WRITE'], to: 'Editor', where: 'department = $user.department' },
  { grant: 'READ', to: 'Viewer' }
]
entity Reports as projection on db.Reports;
```

## xs-security.json

- Roles in `xs-security.json` must match the roles used in CDS `@requires` / `@restrict`.
- Scopes follow the pattern: `$XSAPPNAME.<scope-name>`.
- Role collections must map to role templates.

```json
{
  "xsappname": "my-cap-app",
  "tenant-mode": "dedicated",
  "scopes": [
    { "name": "$XSAPPNAME.Admin", "description": "Administrator" },
    { "name": "$XSAPPNAME.Editor", "description": "Editor" },
    { "name": "$XSAPPNAME.Viewer", "description": "Viewer" }
  ],
  "role-templates": [
    {
      "name": "Admin",
      "scope-references": ["$XSAPPNAME.Admin"]
    },
    {
      "name": "Editor",
      "scope-references": ["$XSAPPNAME.Editor"]
    },
    {
      "name": "Viewer",
      "scope-references": ["$XSAPPNAME.Viewer"]
    }
  ],
  "role-collections": [
    {
      "name": "MyApp_Admin",
      "role-template-references": ["$XSAPPNAME.Admin"]
    },
    {
      "name": "MyApp_Editor",
      "role-template-references": ["$XSAPPNAME.Editor"]
    }
  ]
}
```

- Flag `authorities: ["$ACCEPT"]` in production — this grants all scopes.

## Handler-Level Security

```js
// Programmatic role check when annotations aren't enough
this.before('approve', Orders, (req) => {
  if (!req.user.is('Admin') && !req.user.is('Manager')) {
    req.reject(403, 'Only Admin or Manager can approve orders');
  }
});

// Attribute-based check
this.before('UPDATE', Reports, (req) => {
  if (req.data.department && req.data.department !== req.user.attr.department) {
    req.reject(403, 'Cannot modify reports from another department');
  }
});
```

- Never trust client-provided data for authorization decisions — validate server-side.
- Never log or expose `req.user.token` or JWT content in error messages or responses.
- Never expose internal error details to the client — use generic messages.

## Remote Service Calls

- Must go through `cds.connect.to()` or SAP Cloud SDK — never raw `fetch`/`axios`.
- Destination credentials come from BTP Destination Service, not hardcoded.
- Flag any hardcoded credentials, API keys, or tokens in source code.

## Data Protection

- Annotate personally identifiable fields with `@PersonalData` annotations:

```cds
@PersonalData: { DataSubjectRole: 'Customer', EntitySemantics: 'DataSubject' }
entity Customers : cuid, managed {
  @PersonalData.FieldSemantics: 'DataSubjectID'
  key ID : UUID;

  @PersonalData.IsPotentiallyPersonal
  firstName : String(50);

  @PersonalData.IsPotentiallyPersonal
  lastName : String(50);

  @PersonalData.IsPotentiallySensitive
  email : String(255);
}
```

- Ensure audit logging is enabled for entities with personal data.

## Local Testing with Mock Auth

- Use `cds.env.requires.auth = { kind: 'mocked', users: {...} }` for local testing.
- Define mock users in `.cdsrc.json` or `package.json`:

```json
{
  "cds": {
    "requires": {
      "auth": {
        "[development]": {
          "kind": "mocked",
          "users": {
            "admin": { "roles": ["Admin"] },
            "editor": { "roles": ["Editor"], "attr": { "department": "Sales" } },
            "viewer": { "roles": ["Viewer"] }
          }
        },
        "[production]": {
          "kind": "xsuaa"
        }
      }
    }
  }
}
```

## Checklist

When reviewing for security, check for:

1. Missing `@requires` on service-level or entity-level.
2. Hardcoded credentials or tokens anywhere in the codebase.
3. `req.user` access without scope verification.
4. Raw HTTP calls to SAP endpoints bypassing destination service.
5. `$ACCEPT` authority in production `xs-security.json`.
6. Personal data fields missing `@PersonalData` annotations.
7. `default-env.json` or `.env` not in `.gitignore`.
8. JWT content logged or exposed in error responses.
