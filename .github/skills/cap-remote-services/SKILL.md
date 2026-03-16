---
name: cap-remote-services
description: Consuming external APIs and remote services in SAP CAP. Use when working with cds import, external service definitions (.edmx, .csn), destinations, cds.connect.to(), mashups combining local and remote data, mocking external services, API Business Hub, S/4HANA integration, SuccessFactors, or any side-by-side extension pattern.
---

# Remote Services

## Context7 — Docs Lookup

Before answering remote services questions:

1. Call `context7/query-docs` with `context7CompatibleLibraryID` = `/cap-js/docs` and `topic` = `remote services` (or more specific: `cds import`, `external service`, `mashup`, `destination`).
2. For SAP Cloud SDK questions, call `context7/resolve-library-id` with query `sap cloud sdk` to find the library, then `context7/query-docs` on it.

## Importing External Service Definitions

### From SAP API Business Hub

```bash
# Import an OData API — downloads .edmx and generates .csn
cds import <path-to-edmx-file>

# Example: import Business Partner API
cds import API_BUSINESS_PARTNER.edmx --as cds
```

This creates:
- `srv/external/API_BUSINESS_PARTNER.csn` — the parsed service definition
- `srv/external/API_BUSINESS_PARTNER.edmx` — the original metadata (keep for reference)
- Updates `package.json` → `cds.requires` with the service binding

### From a URL

```bash
cds import https://sandbox.api.sap.com/s4hanacloud/sap/opu/odata/sap/API_BUSINESS_PARTNER/$metadata
```

### Generated package.json config

After import, `package.json` gets:

```json
{
  "cds": {
    "requires": {
      "API_BUSINESS_PARTNER": {
        "kind": "odata-v2",
        "model": "srv/external/API_BUSINESS_PARTNER"
      }
    }
  }
}
```

## Projecting from External Services

Never expose the full imported API. Create a projection with only the fields you need:

```cds
// srv/mashup-service.cds
using { API_BUSINESS_PARTNER as bupa } from './external/API_BUSINESS_PARTNER';

service MashupService {

  // Project only what you need from the external API
  @readonly
  entity BusinessPartners as projection on bupa.A_BusinessPartner {
    key BusinessPartner,
    BusinessPartnerFullName,
    BusinessPartnerCategory,
    FirstName,
    LastName
  };

  // Your local entity that references external data
  entity Orders : cuid, managed {
    description  : String(200);
    partner      : Association to BusinessPartners;
    totalAmount  : Decimal(15,2);
  };
}
```

### Excluding unwanted fields

```cds
entity BusinessPartners as projection on bupa.A_BusinessPartner
  excluding { BusinessPartnerGrouping, AuthorizationGroup, SearchTerm1 };
```

## Connecting to Remote Services

### In service handlers

```js
const cds = require('@sap/cds');

class MashupService extends cds.ApplicationService {

  async init() {
    // Lazy connect — resolves on first use, not at startup
    const bupa = await cds.connect.to('API_BUSINESS_PARTNER');

    const { BusinessPartners, Orders } = this.entities;

    // Delegate READ of projected entity to remote service
    this.on('READ', BusinessPartners, (req) => {
      return bupa.run(req.query);
    });

    // Custom handler that combines local + remote data
    this.on('READ', Orders, async (req, next) => {
      // First get local orders
      const orders = await next();
      if (!orders.length) return orders;

      // Then enrich with remote partner data
      const partnerIDs = [...new Set(
        orders.map(o => o.partner_BusinessPartner).filter(Boolean)
      )];

      if (partnerIDs.length) {
        const partners = await bupa.run(
          SELECT.from('A_BusinessPartner')
            .columns('BusinessPartner', 'BusinessPartnerFullName')
            .where({ BusinessPartner: { in: partnerIDs } })
        );
        const map = new Map(partners.map(p => [p.BusinessPartner, p]));
        for (const order of orders) {
          order.partner = map.get(order.partner_BusinessPartner);
        }
      }

      return orders;
    });

    await super.init();
  }
}

module.exports = MashupService;
```

### Key rules for `cds.connect.to()`

- Always `await` it — it returns a promise.
- Call it inside `init()` or inside a handler. Never at module level.
- The string must match the key in `package.json` → `cds.requires`.
- Use `bupa.run(req.query)` to delegate the full query (including `$filter`, `$select`, `$expand`).
- Use `bupa.run(SELECT.from(...))` for custom queries.
- Use `bupa.send('GET', '/path')` for raw HTTP when OData doesn't fit.

## Destination Configuration

### For BTP Cloud Foundry

```json
{
  "cds": {
    "requires": {
      "API_BUSINESS_PARTNER": {
        "kind": "odata-v2",
        "model": "srv/external/API_BUSINESS_PARTNER",
        "[production]": {
          "credentials": {
            "destination": "S4HANA_BUPA",
            "path": "/sap/opu/odata/sap/API_BUSINESS_PARTNER"
          }
        }
      }
    }
  }
}
```

### MTA resource for destination service

```yaml
resources:
  - name: my-destination-service
    type: org.cloudfoundry.managed-service
    parameters:
      service: destination
      service-plan: lite

  - name: my-connectivity-service
    type: org.cloudfoundry.managed-service
    parameters:
      service: connectivity
      service-plan: lite

modules:
  - name: my-srv
    requires:
      - name: my-destination-service
      - name: my-connectivity-service
```

### Destination in BTP Cockpit

The destination named `S4HANA_BUPA` must exist in the BTP subaccount with:
- URL pointing to the S/4HANA system
- Authentication: OAuth2SAMLBearerAssertion, BasicAuthentication, or OAuth2ClientCredentials
- Additional properties as needed (`sap-client`, `HTML5.DynamicDestination`, etc.)

## Mocking External Services for Local Dev

### Option 1: Mock data with CSV (recommended for dev)

```json
{
  "cds": {
    "requires": {
      "API_BUSINESS_PARTNER": {
        "kind": "odata-v2",
        "model": "srv/external/API_BUSINESS_PARTNER",
        "[development]": {
          "kind": "odata",
          "credentials": {
            "url": "http://localhost:4004/api-business-partner"
          }
        }
      }
    }
  }
}
```

Or simpler — use the built-in mock:

```json
{
  "cds": {
    "requires": {
      "API_BUSINESS_PARTNER": {
        "[development]": { "kind": "odata-v2-mock" }
      }
    }
  }
}
```

Place mock data CSV files in `srv/external/data/`:

```
srv/external/data/API_BUSINESS_PARTNER-A_BusinessPartner.csv
```

### Option 2: Hybrid testing against real remote

```bash
# Bind to BTP destination service
cds bind --to destination:my-destination-instance

# Run with hybrid profile
cds watch --profile hybrid
```

### Option 3: Custom mock implementation

```js
// srv/external/API_BUSINESS_PARTNER.js — mock handler
module.exports = (srv) => {
  srv.on('READ', 'A_BusinessPartner', () => {
    return [
      { BusinessPartner: '1000001', BusinessPartnerFullName: 'Test Partner 1' },
      { BusinessPartner: '1000002', BusinessPartnerFullName: 'Test Partner 2' },
    ];
  });
};
```

## Mashup Patterns

### Pattern 1: Delegate + Enrich

Local entity references remote data. On READ, fetch local first, then batch-fetch remote to enrich:

```js
this.on('READ', Orders, async (req, next) => {
  const orders = await next(); // local data
  // batch-fetch partners from remote (see example above)
  return orders;
});
```

### Pattern 2: Full Delegation

Projected entity fully delegates to remote. CDS handles query forwarding:

```js
this.on('READ', BusinessPartners, (req) => {
  return bupa.run(req.query);
});
```

### Pattern 3: Action calling remote API

```cds
service MashupService {
  action syncPartner(partnerID : String) returns String;
}
```

```js
this.on('syncPartner', async (req) => {
  const { partnerID } = req.data;
  const bupa = await cds.connect.to('API_BUSINESS_PARTNER');

  const partner = await bupa.run(
    SELECT.one.from('A_BusinessPartner')
      .where({ BusinessPartner: partnerID })
  );

  if (!partner) return req.reject(404, `Partner ${partnerID} not found`);

  // Upsert into local entity
  await UPSERT.into(LocalPartners).entries({
    ID: partner.BusinessPartner,
    name: partner.BusinessPartnerFullName,
    syncedAt: new Date(),
  });

  return `Synced partner ${partnerID}`;
});
```

### Pattern 3: Write-through to remote

```js
this.on('CREATE', BusinessPartners, async (req) => {
  const bupa = await cds.connect.to('API_BUSINESS_PARTNER');
  return bupa.run(req.query);
});
```

## Error Handling for Remote Calls

```js
this.on('READ', BusinessPartners, async (req) => {
  const bupa = await cds.connect.to('API_BUSINESS_PARTNER');
  try {
    return await bupa.run(req.query);
  } catch (err) {
    // Remote service returned an OData error
    if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
      return req.reject(502, 'External service unavailable');
    }
    if (err.status === 401 || err.status === 403) {
      return req.reject(502, 'Authentication failed for external service');
    }
    // Forward the remote error message
    return req.reject(err.status || 500, err.message);
  }
});
```

## OData V2 vs V4

| Aspect | V2 (`odata-v2`) | V4 (`odata`) |
|--------|-----------------|--------------|
| Config kind | `"kind": "odata-v2"` | `"kind": "odata"` |
| Date format | `/Date(...)` | ISO 8601 |
| Key format | `Entity('key')` | `Entity(key)` |
| Batch | `$batch` multipart | JSON batch |
| Common APIs | S/4HANA on-prem, older APIs | S/4HANA Cloud, newer APIs |

CDS handles the protocol differences transparently when you use `cds.connect.to()` + CQL queries. The `kind` setting tells the framework which protocol adapter to use.

## Anti-Patterns

- Exposing the entire imported API without projecting — imports can have hundreds of entities.
- Using raw `fetch`/`axios` to call SAP APIs instead of `cds.connect.to()` — bypasses destination service, auth, error handling, and protocol translation.
- Connecting at module level (`const bupa = cds.connect.to(...)` outside `init()`) — fails because the service isn't ready yet.
- Fetching remote data in a loop instead of batch (N+1 over network is much worse than N+1 over DB).
- Not mocking external services for local dev — forces hybrid setup for every developer.
- Hardcoding remote service URLs instead of using destinations.
- Missing error handling for remote calls — remote services fail differently than local DB.
- Not adding `[development]` / `[production]` profile splits for external service configuration.
