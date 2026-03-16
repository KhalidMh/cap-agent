---
name: cap-deployment
description: Deployment of SAP CAP applications to SAP BTP. Use when working with mta.yaml, cf deploy, HANA HDI, xs-security.json, MTA build, Cloud Foundry deployment, or preparing a CAP project for production.
---

# Deployment

## MTA Build & Deploy

- For `cf deploy`, check that `mta.yaml` modules and resources are consistent with `package.json`.
- Validate that `hdi-deploy` configuration matches CDS model artifacts.
- Ensure `xs-security.json` is referenced in `mta.yaml` before deploying auth-dependent services.
- Check `build-parameters` in `mta.yaml` use the correct builder (`npm`, `custom`, `hdb`).

### Build & Deploy Commands

```bash
# Build the MTA archive
mbt build

# Deploy to Cloud Foundry
cf deploy mta_archives/my-cap-app_1.0.0.mtar

# Build and deploy in one step
mbt build && cf deploy mta_archives/*.mtar

# Deploy with specific CF org/space
cf target -o myorg -s myspace && cf deploy mta_archives/*.mtar
```

## Pre-Deploy Checklist

1. Run `cds build --production` locally and verify the `gen/` output.
2. Check `gen/srv/` contains the expected `csn.json` and `edmx` files.
3. Verify `gen/db/` contains the expected `.hdbtable` / `.hdbview` files (for HANA).
4. Confirm all required services are listed under `resources` in `mta.yaml`.
5. Verify `xs-security.json` scopes match CDS `@requires` annotations.
6. Ensure `.env`, `default-env.json`, and `db.sqlite` are in `.gitignore`.
7. Check `package.json` has `[production]` profile overrides for HANA and XSUAA.

## package.json Production Config

```json
{
  "cds": {
    "requires": {
      "db": {
        "kind": "sql",
        "[production]": {
          "kind": "hana-cloud"
        }
      },
      "auth": {
        "[development]": {
          "kind": "mocked"
        },
        "[production]": {
          "kind": "xsuaa"
        }
      }
    },
    "build": {
      "target": "gen",
      "tasks": [
        { "for": "hana", "src": "db" },
        { "for": "nodejs", "src": "srv" }
      ]
    }
  }
}
```

## xs-security.json

- Scopes, role-templates, and role-collections must match CDS annotation expectations.
- Check `oauth2-configuration` for correct redirect URIs if using AppRouter.
- Flag `authorities: ["$ACCEPT"]` in production — this grants all scopes.

## AppRouter Configuration

```json
// xs-app.json
{
  "welcomeFile": "/index.html",
  "authenticationMethod": "route",
  "routes": [
    {
      "source": "^/odata/v4/(.*)$",
      "target": "/odata/v4/$1",
      "destination": "srv-api",
      "authenticationType": "xsuaa"
    },
    {
      "source": "^(.*)$",
      "target": "$1",
      "localDir": "resources",
      "authenticationType": "xsuaa"
    }
  ]
}
```

## Environment Configuration

- `cds.requires` in `package.json` must define `[production]` profile overrides for HANA and XSUAA.
- Local `sqlite` binding should only be active in `development` profile.
- `.env` / `default-env.json` files must be in `.gitignore`.

## HANA Deployment

- Ensure `@sap/hdi-deploy` is in `db/package.json` dependencies.
- Verify `undeploy.json` lists artifacts to be removed on redeployment.
- Flag manual `.hdbtable` files that should be generated from CDS models instead.

## Common Deploy Errors

- **"Service creation failed"**: Check `resources` in `mta.yaml`, verify service plan availability in the subaccount. Run `cf marketplace` to check available plans.
- **"HDI deploy failed"**: Run `cds compile --to sql` to check for model errors. Check `undeploy.json`.
- **"Route already exists"**: Check `routes` in `mta.yaml` for conflicts. Use unique route prefixes.
- **"Insufficient scope"**: Verify `xs-security.json` → role template → role collection chain.
- **"Out of memory during build"**: Increase memory in `mta.yaml` build parameters or use `NODE_OPTIONS=--max-old-space-size=4096`.

## Reference

See the [mta.yaml template](./mta-template.yaml) for a standard CAP project structure.
