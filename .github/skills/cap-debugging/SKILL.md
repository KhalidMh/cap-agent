---
name: cap-debugging
description: Debugging and troubleshooting SAP CAP projects. Use when diagnosing errors, runtime issues, configuration problems, database issues, failed deployments, or when the user reports something is not working.
---

# Debugging & Troubleshooting

## First Steps

When the user reports an error:

1. Read the relevant CDS model and service handler files in the workspace.
2. Check `package.json` for `@sap/cds` version and `cds` configuration section.
3. Check `.cdsrc.json` and `default-env.json` for misconfiguration.
4. Run appropriate diagnostic commands.

## Diagnostic Commands

| Command | Purpose |
|---------|---------|
| `cds env` | Inspect effective configuration |
| `cds compile --to sql` | Validate models produce valid SQL |
| `cds compile --to edmx` | Validate OData metadata |
| `cds compile --to csn` | Inspect the resolved CSN |
| `DEBUG=cds* cds watch` | Verbose CDS runtime logging |
| `cds version` | Check installed CDS versions |
| `cds env get requires` | Inspect service bindings |
| `cds env get folders` | Check project folder layout |
| `cds compile srv/ --to edmx-v4` | Validate specific service metadata |

## Common Issues

### Model Errors

- **"Entity not found"**: Check `using` imports in `.cds` files, verify service exposure with `cds compile --to edmx`. Most common cause: missing `using` statement or wrong namespace.
- **"Duplicate definition"**: Two files define the same entity/service. Check all `.cds` files loaded via `cds env get roots`.
- **"Association target not found"**: The target entity isn't imported or doesn't exist. Check spelling (PascalCase) and `using` imports.

### Runtime Errors

- **Handler not firing**: Verify handler registration matches entity/event names exactly (case-sensitive). Check that handler file name matches the CDS service name. Verify `await super.init()` is called.
- **"Not authorized"**: Check `@requires`/`@restrict` annotations, verify `xs-security.json` roles, check `default-env.json` for XSUAA binding. For local dev, check mock user config in `package.json` > `cds.requires.auth`.
- **"Cannot find module"**: Check `package.json` dependencies, run `npm install`. If it's a CDS model import, check `cds.requires` paths.
- **OData $expand fails**: Check associations/compositions in CDS model, verify navigation property names match the element names in CDS.

### Database Errors

- **"SQLITE_ERROR"**: Run `cds deploy --to sqlite` to recreate the local database. If schema changed, delete `db.sqlite` first.
- **"HDI deploy failed"**: Run `cds compile --to sql` to check for model errors. Check `undeploy.json` for stale artifacts.
- **Type mismatch after schema change**: Delete and recreate SQLite DB: `rm db.sqlite && cds deploy --to sqlite`.

### Remote Service Errors

- **Destination not found**: Check `cds.requires` config, verify destination exists in BTP cockpit, check `default-env.json` for local bindings.
- **401/403 from remote service**: Check destination authentication type, verify technical user credentials, check OAuth token exchange config.
- **Timeout on remote calls**: Check destination timeout settings. Consider using `cds.spawn()` for long-running operations.

## Hybrid Testing

- Use `cds bind` with `--to` flags to bind to remote services while running locally.
- `cds watch --profile hybrid` for mixed local/remote testing.
- Ensure `default-env.json` is in `.gitignore` — it contains secrets.
- Use `cds bind --exec -- cds watch` for one-shot hybrid runs.

## Logging

```js
// Structured logging
const LOG = cds.log('my-service');

// Use appropriate log levels
LOG.info('Processing order', { orderID });
LOG.warn('Deprecated API used', { endpoint });
LOG.error('Failed to fetch partner', { partnerID, error: err.message });

// Enable specific loggers via environment
// DEBUG=my-service cds watch
```

## Debugging Strategy

When an error message is unclear:

1. Run `cds version` — check if CDS version is outdated.
2. Run `cds compile --to sql` — surface model-level errors.
3. Enable `DEBUG=cds*` to get runtime-level details.
4. Check `package.json` → `cds.requires` for binding mismatches.
5. Check for version conflicts: `npm ls @sap/cds`.
6. If still stuck, ask the user for the full error log and `cds env` output.
