# Project Conventions

This is an SAP CAP (Cloud Application Programming model) project using the Node.js runtime.

## Context7 — Doc Lookup

When answering questions about SAP CAP, CDS, `@sap/cds`, OData, SAP Cloud SDK, XSUAA, or any `@sap/*` package, use the Context7 MCP tool to fetch up-to-date docs:

- **CAP**: `context7/query-docs` with `context7CompatibleLibraryID` = `/cap-js/docs`
- **React**: `/reactjs/react.dev`
- **React Router**: `/remix-run/react-router`

Do NOT call `resolve-library-id`. Do NOT answer from memory alone.

## Code Style

- **CDS**: PascalCase entities, camelCase elements. Explicit keys. `managed` aspect on all entities.
- **Handlers**: Class-style with `init()`. Use `req.error()` / `req.reject()` — never raw `throw`.
- **Structure**: One service file per CDS service. Business logic in `srv/lib/`. Handlers stay thin.
- **External services**: Always via `cds.connect.to()`. Never raw `fetch`/`axios` to SAP endpoints.
- **React**: Functional components, TypeScript, explicit prop interfaces. No `any`.

## Security Defaults

- Every non-public service needs `@requires` or `@restrict`.
- No hardcoded credentials anywhere.
- `default-env.json` must be in `.gitignore`.
