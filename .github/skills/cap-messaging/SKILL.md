---
name: cap-messaging
description: Event-driven patterns and messaging in SAP CAP. Use when working with cds.emit, cds.on, event subscriptions, SAP Event Mesh, message queues, outbox pattern, asynchronous processing, event-driven side-by-side extensions, or reacting to S/4HANA business events.
---

# Messaging & Events

## Context7 — Docs Lookup

Before answering messaging/events questions:

1. Call `context7/query-docs` with `context7CompatibleLibraryID` = `/cap-js/docs` and `topic` = `messaging events` (or more specific: `outbox`, `emit`, `event mesh`).

## Core Concepts

CAP has a built-in event system. Every CDS service is an event emitter. Messaging extends this to external message brokers (SAP Event Mesh, file-based, etc.) for inter-application communication.

Three layers:
1. **In-process events** — `srv.emit()` / `srv.on()` within the same app
2. **Persistent outbox** — events queued in the database, delivered reliably
3. **External messaging** — SAP Event Mesh, message queues for cross-app events

## In-Process Events

### Defining events in CDS

```cds
service OrderService {
  entity Orders : cuid, managed {
    description : String(200);
    status      : String(20);
    totalAmount : Decimal(15,2);
  };

  // Declare events the service can emit
  event OrderCreated {
    orderID     : UUID;
    description : String(200);
    totalAmount : Decimal(15,2);
    createdAt   : Timestamp;
  }

  event OrderCancelled {
    orderID  : UUID;
    reason   : String(500);
  }
}
```

### Emitting events

```js
const cds = require('@sap/cds');

class OrderService extends cds.ApplicationService {

  async init() {
    const { Orders } = this.entities;

    this.after('CREATE', Orders, async (order, req) => {
      // Emit event after successful creation
      await this.emit('OrderCreated', {
        orderID: order.ID,
        description: order.description,
        totalAmount: order.totalAmount,
        createdAt: order.createdAt,
      });
    });

    this.on('cancel', async (req) => {
      const { orderID, reason } = req.data;
      await UPDATE(Orders, orderID).set({ status: 'cancelled' });
      await this.emit('OrderCancelled', { orderID, reason });
    });

    await super.init();
  }
}

module.exports = OrderService;
```

### Subscribing to events (same app)

```js
class NotificationService extends cds.ApplicationService {

  async init() {
    const orderSrv = await cds.connect.to('OrderService');

    orderSrv.on('OrderCreated', async (msg) => {
      const { orderID, totalAmount } = msg.data;
      console.log(`Order ${orderID} created, amount: ${totalAmount}`);
      // Send notification, update dashboard, etc.
    });

    orderSrv.on('OrderCancelled', async (msg) => {
      const { orderID, reason } = msg.data;
      console.log(`Order ${orderID} cancelled: ${reason}`);
    });

    await super.init();
  }
}

module.exports = NotificationService;
```

## Persistent Outbox

The outbox pattern ensures events are delivered reliably by storing them in the database first, then delivering asynchronously. If the app crashes after emit, events aren't lost.

### Enabling outbox

```json
{
  "cds": {
    "requires": {
      "outbox": true
    }
  }
}
```

With outbox enabled, `this.emit()` writes to an outbox table inside the current transaction. A background process picks up pending events and delivers them.

### How it works

1. `this.emit('OrderCreated', data)` → writes to `cds.outbox` table within the current DB transaction.
2. If the transaction commits, events are queued.
3. If the transaction rolls back, events are discarded (no ghost events).
4. A background worker reads the outbox and delivers to subscribers.

### Outbox configuration

```json
{
  "cds": {
    "requires": {
      "outbox": {
        "kind": "persistent-outbox",
        "maxAttempts": 20,
        "chunkSize": 100
      }
    }
  }
}
```

## SAP Event Mesh

For cross-application messaging on BTP.

### Setup

```bash
npm add @sap/xb-msg-amqp-v100
```

### package.json configuration

```json
{
  "cds": {
    "requires": {
      "messaging": {
        "kind": "enterprise-messaging",
        "[development]": {
          "kind": "file-based-messaging"
        },
        "[production]": {
          "kind": "enterprise-messaging",
          "format": "cloudevents",
          "publishPrefix": "sap/app/myapp/",
          "subscribePrefix": "sap/app/"
        }
      }
    }
  }
}
```

### MTA resource for Event Mesh

```yaml
resources:
  - name: my-event-mesh
    type: org.cloudfoundry.managed-service
    parameters:
      service: enterprise-messaging
      service-plan: default
      path: ./event-mesh.json

modules:
  - name: my-srv
    requires:
      - name: my-event-mesh
```

### event-mesh.json (service descriptor)

```json
{
  "emname": "my-app-events",
  "namespace": "sap/app/myapp",
  "version": "1.0.0",
  "options": {
    "management": true,
    "messagingrest": true
  },
  "rules": {
    "topicRules": {
      "publishFilter": ["${namespace}/**"],
      "subscribeFilter": ["${namespace}/**", "sap/s4/**"]
    },
    "queueRules": {
      "publishFilter": ["${namespace}/**"],
      "subscribeFilter": ["${namespace}/**"]
    }
  }
}
```

### Emitting to Event Mesh

```js
class OrderService extends cds.ApplicationService {

  async init() {
    const messaging = await cds.connect.to('messaging');
    const { Orders } = this.entities;

    this.after('CREATE', Orders, async (order) => {
      // This goes to Event Mesh topic: sap/app/myapp/OrderCreated
      await messaging.emit('OrderCreated', {
        orderID: order.ID,
        totalAmount: order.totalAmount,
      });
    });

    await super.init();
  }
}
```

### Subscribing to external events (e.g., S/4HANA Business Events)

```js
class SyncService extends cds.ApplicationService {

  async init() {
    const messaging = await cds.connect.to('messaging');

    // Subscribe to S/4HANA BusinessPartner change event
    messaging.on('sap/s4/beh/businesspartner/v1/BusinessPartner/Changed/v1', async (msg) => {
      const { BusinessPartner } = msg.data;
      console.log(`BusinessPartner ${BusinessPartner} changed in S/4HANA`);
      // Trigger sync logic
      await this.syncPartner(BusinessPartner);
    });

    await super.init();
  }

  async syncPartner(partnerID) {
    const bupa = await cds.connect.to('API_BUSINESS_PARTNER');
    const partner = await bupa.run(
      SELECT.one.from('A_BusinessPartner')
        .where({ BusinessPartner: partnerID })
    );
    if (partner) {
      await UPSERT.into('LocalPartners').entries({
        ID: partner.BusinessPartner,
        name: partner.BusinessPartnerFullName,
        syncedAt: new Date(),
      });
    }
  }
}
```

## File-Based Messaging (Local Dev)

For local development without Event Mesh:

```json
{
  "cds": {
    "requires": {
      "messaging": {
        "[development]": {
          "kind": "file-based-messaging"
        }
      }
    }
  }
}
```

This writes events to `~/.cds-messaging/` as files. Useful for testing emit/subscribe without a broker.

## CloudEvents Format

When `"format": "cloudevents"` is set, messages follow the CloudEvents spec:

```json
{
  "specversion": "1.0",
  "type": "sap.app.myapp.OrderCreated",
  "source": "/default/sap.app.myapp/1",
  "id": "a1b2c3d4-...",
  "time": "2026-03-16T10:30:00Z",
  "data": {
    "orderID": "...",
    "totalAmount": 150.00
  }
}
```

## Topic Naming

### Convention for custom events

```
<namespace>/<service>/<event>

Example:
sap/app/myapp/OrderService/OrderCreated
```

### S/4HANA Business Events pattern

```
sap/s4/beh/<object>/v1/<Object>/<Action>/v1

Examples:
sap/s4/beh/businesspartner/v1/BusinessPartner/Changed/v1
sap/s4/beh/salesorder/v1/SalesOrder/Created/v1
sap/s4/beh/purchaseorder/v1/PurchaseOrder/Released/v1
```

## Common Patterns

### Pattern 1: React to S/4HANA event, sync local data

S/4HANA emits event → Event Mesh → your CAP app subscribes → calls S/4HANA API to fetch updated data → upserts into local DB.

### Pattern 2: Local event triggers notification

Local `after` handler emits event → Notification service subscribes → sends email/Teams message.

### Pattern 3: Outbox + Event Mesh for reliable cross-app communication

```json
{
  "cds": {
    "requires": {
      "outbox": true,
      "messaging": {
        "kind": "enterprise-messaging"
      }
    }
  }
}
```

`this.emit()` → outbox table (transactional) → background delivery to Event Mesh → other apps subscribe.

### Pattern 4: One-to-many fanout

Single event triggers multiple handlers in different services:

```js
// In ServiceA
messaging.on('OrderCreated', async (msg) => { /* update inventory */ });

// In ServiceB (different app or same app)
messaging.on('OrderCreated', async (msg) => { /* send confirmation email */ });

// In ServiceC
messaging.on('OrderCreated', async (msg) => { /* update analytics */ });
```

## Error Handling in Event Handlers

```js
messaging.on('OrderCreated', async (msg) => {
  try {
    await processOrder(msg.data);
  } catch (err) {
    // Log the error — don't throw from event handlers
    // Throwing causes the message to be redelivered (retry loop)
    console.error('Failed to process OrderCreated:', err);

    // If you want retry, throw the error
    // If you want to skip, catch and log
  }
});
```

### Idempotency

Event handlers MUST be idempotent — the same event may be delivered more than once:

```js
messaging.on('OrderCreated', async (msg) => {
  const { orderID } = msg.data;

  // Check if already processed
  const existing = await SELECT.one.from(ProcessedEvents).where({ eventID: msg.id });
  if (existing) return; // already handled

  // Process
  await processOrder(msg.data);

  // Mark as processed
  await INSERT.into(ProcessedEvents).entries({ eventID: msg.id, processedAt: new Date() });
});
```

## Debugging Messaging

| Problem | Fix |
|---------|-----|
| Event not received | Check topic names match exactly (case-sensitive). Check `subscribePrefix` config. |
| Event Mesh connection failed | Verify service binding. Check `default-env.json` or `cds bind` setup. |
| Events lost after app crash | Enable persistent outbox. |
| Duplicate event processing | Implement idempotency checks in handlers. |
| File-based messaging not working | Check `~/.cds-messaging/` directory exists and is writable. |
| Topic filter mismatch | Verify `publishFilter` and `subscribeFilter` in `event-mesh.json`. |

## Anti-Patterns

- Emitting events without the outbox — events are lost if the transaction succeeds but the app crashes before delivery.
- Throwing errors in event handlers without understanding the retry behavior — can cause infinite retry loops.
- Non-idempotent event handlers — messages can be delivered more than once.
- Hardcoding S/4HANA event topic names instead of using constants — typos silently break subscriptions.
- Using `messaging.emit()` inside `before` handlers — the event fires even if the transaction rolls back (without outbox).
- Not splitting `[development]` / `[production]` messaging config — file-based for local, Event Mesh for prod.
- Subscribing to broad topic wildcards without filtering — noisy and wasteful.
- Missing `event-mesh.json` descriptor in MTA build — service creation fails.
