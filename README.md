# CAP Agent for GitHub Copilot

A custom GitHub Copilot agent and skill set for SAP CAP (Cloud Application Programming model) Node.js development in VS Code.

## What This Is

A `.github/agents/` and `.github/skills/` setup that turns GitHub Copilot into a CAP-aware development assistant. It uses [Context7](https://context7.com) MCP to pull up-to-date CAP documentation before answering, so responses are grounded in real docs instead of stale training data.

The agent covers the full CAP development lifecycle: CDS modeling, service handlers, testing, security, performance, debugging, deployment, databases (SQLite, PostgreSQL, HANA), remote service integration, messaging, Fiori Elements annotations, React frontends, and code review.

## Requirements

- VS Code with GitHub Copilot (agent mode)
- VS Code 1.108+ (for agent skills support)
- A [Context7](https://context7.com) API key

## Setup

1. Copy the `.github/` folder and `.vscode/mcp.json` into the root of your CAP project.

2. Set the Context7 API key as an environment variable:

```bash
export CONTEXT7_API_KEY=your-key-here
```

3. Open your CAP project in VS Code. The agent appears in the Copilot chat as **CAP Dev**.

## Structure

```
.github/
├── agents/
│   └── cap.agent.md              # Agent definition (tools, instructions, skill table)
├── copilot-instructions.md       # Global project conventions (applies to all Copilot interactions)
└── skills/
    ├── cds-modeling/              # Entity definitions, types, aspects, associations, compositions
    ├── cap-service-handlers/      # Event handlers, CRUD hooks, actions, functions, error handling
    ├── cap-testing/               # Unit tests, cds.test, mock users, test setup
    ├── cap-security/              # Authorization, XSUAA, roles, scopes, data protection
    ├── cap-performance/           # Query optimization, N+1 prevention, pagination, bulk ops
    ├── cap-debugging/             # Error diagnosis, diagnostic commands, configuration issues
    ├── cap-deployment/            # MTA build, CF deploy, HANA HDI, xs-security, production readiness
    ├── cap-code-review/           # Self-contained code review checklist with patterns and fixes
    ├── cap-fiori-elements/        # @UI annotations, List Report, Object Page, value helps, draft
    ├── cap-react-frontend/        # React components, hooks, routing, OData consumption, TypeScript
    ├── cap-db-sqlite/             # @cap-js/sqlite, local dev, schema evolution, limitations
    ├── cap-db-postgres/           # @cap-js/postgres, connection pooling, native features, BTP deploy
    ├── cap-db-hana/               # @cap-js/hana, HDI containers, calculation views, hybrid dev
    ├── cap-remote-services/       # cds import, destinations, mashups, mocking, S/4HANA integration
    └── cap-messaging/             # Events, Event Mesh, outbox, emit/subscribe, S/4HANA events

.vscode/
└── mcp.json                      # Context7 MCP server configuration
```

## How It Works

**Agent** (`cap.agent.md`): Defines the Copilot agent persona, available tools, and a skill routing table. When you use the CAP Dev agent in chat, it follows these instructions. The agent always queries Context7 for up-to-date CAP docs before answering.

**Skills** (`.github/skills/*/SKILL.md`): Each skill is a folder containing a `SKILL.md` with frontmatter (`name`, `description`) and a body of conventions, patterns, code examples, and anti-patterns. Copilot auto-matches skills to your question based on the `description` field.

**Copilot Instructions** (`copilot-instructions.md`): Applies globally to all Copilot interactions in the workspace (not just the agent). Contains project-level code style conventions and security defaults.

**Context7 MCP** (`.vscode/mcp.json`): Configures the Context7 MCP server so the agent can fetch live documentation from `cap.cloud.sap/docs` during conversations.

## Skills Overview

| Skill | What It Covers |
|-------|----------------|
| `cds-modeling` | PascalCase/camelCase conventions, `cuid`, `managed`, associations vs compositions, enums, many-to-many, annotations |
| `cap-service-handlers` | Class-style handlers with `init()`, `req.error()`/`req.reject()`, actions, external service calls, error handling |
| `cap-testing` | `cds.test()` bootstrap, authenticated requests with mock users, action tests, OData query tests, test fixtures |
| `cap-security` | `@requires`/`@restrict`, `xs-security.json`, row-level auth, `@PersonalData`, mock auth for local dev |
| `cap-performance` | Unbounded query detection, N+1 batch fix, pagination, bulk inserts, `@cds.search`, expand depth |
| `cap-debugging` | Diagnostic commands (`cds env`, `cds compile`), common errors, hybrid testing, structured logging |
| `cap-deployment` | MTA config, `cds build --production`, AppRouter, HANA HDI, `xs-security.json`, production profiles |
| `cap-code-review` | Self-contained review checklist covering security, performance, modeling, handlers, remote services, messaging, DB, deployment, testing |
| `cap-fiori-elements` | `@UI.HeaderInfo`, `@UI.LineItem`, `@UI.FieldGroup`, `@UI.Facets`, value helps, draft handling, side effects |
| `cap-react-frontend` | TypeScript components, custom hooks, OData client, Vite proxy, routing, error boundaries |
| `cap-db-sqlite` | Setup, in-memory config, CSV data loading, schema evolution, SQLite limitations |
| `cap-db-postgres` | Docker setup, connection pooling, native features (JSONB, window functions), BTP `postgresql-db` service |
| `cap-db-hana` | HDI containers, `cds build --production`, `@cds.persistence.exists`, calculation views, `undeploy.json` |
| `cap-remote-services` | `cds import`, projections, `cds.connect.to()`, destinations, 3 mocking approaches, mashup patterns, OData V2/V4 |
| `cap-messaging` | In-process events, persistent outbox, Event Mesh setup, S/4HANA Business Events, CloudEvents, idempotency |

## Customization

**Add a skill**: Create a folder under `.github/skills/` with a `SKILL.md` file. The frontmatter `name` must match the directory name (lowercase, hyphens). Write a `description` that tells Copilot when to use it. Add the skill to the table in `cap.agent.md`.

**Modify a skill**: Edit the `SKILL.md` body. Add code examples, anti-patterns, or conventions specific to your project.

**Add bundled assets**: Drop template files, scripts, or reference docs alongside `SKILL.md` in the same folder. The agent can reference them. See `cap-deployment/mta-template.yaml` and `cap-service-handlers/handler-template.js` for examples.

**Change the model**: Add `model: gpt-4o` (or another model) to the agent frontmatter.

## License

MIT
