# Context7 — Mandatory

You MUST use Context7 MCP tools before answering any question about SAP CAP, CDS, `@sap/cds`, OData, SAP Cloud SDK, XSUAA, or any `@sap/*` package.

Steps:
1. Call `context7/query-docs` with `context7CompatibleLibraryID` set to `/cap-js/docs` and a `topic` matching the user's question.
2. Only then write your response, grounded in the fetched docs.

Do NOT skip this. Do NOT answer from memory alone. Do NOT ask the user to say "use context7".
Do NOT call `resolve-library-id` — the library ID is always `/cap-js/docs`.

If Context7 returns no results, state that explicitly and proceed with your best knowledge.