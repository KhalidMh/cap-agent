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

## Common Issues

- **"Entity not found"**: Check `using` imports in `.cds` files, verify service exposure with `cds compile --to edmx`.
- **"Not authorized"**: Check `@requires`/`@restrict` annotations, verify `xs-security.json` roles, check `default-env.json` for XSUAA binding.
- **"SQLITE_ERROR"**: Run `cds deploy --to sqlite` to recreate the local database.
- **Handler not firing**: Verify handler registration matches entity/event names exactly (case-sensitive).
- **Remote service errors**: Check destination binding, verify with `cds bind --exec -- cds watch`.
- **"Cannot find module"**: Check `package.json` dependencies, run `npm install`.
- **OData $expand fails**: Check associations/compositions in CDS model, verify navigation property names.

## Hybrid Testing

- Use `cds bind` with `--to` flags to bind to remote services while running locally.
- `cds watch --profile hybrid` for mixed local/remote testing.
- Ensure `default-env.json` is in `.gitignore` — it contains secrets.

## Debugging Strategy

When an error message is unclear:

1. Run the diagnostic command most likely to surface the issue.
2. Check the CDS compile output for model-level errors.
3. Enable `DEBUG=cds*` to get runtime-level details.
4. Check `package.json` → `cds.requires` for binding mismatches.
5. If still stuck, ask the user for the full error log.
