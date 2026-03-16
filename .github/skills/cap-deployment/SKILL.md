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

## Pre-Deploy Checklist

1. Run `cds build` locally and verify the `gen/` output.
2. Check `srv/gen/` contains the expected `csn.json` and `edmx` files.
3. Verify `db/gen/` contains the expected `.hdbtable` / `.hdbview` files (for HANA).
4. Confirm all required services are listed under `resources` in `mta.yaml`.
5. Verify `xs-security.json` scopes match CDS `@requires` annotations.

## xs-security.json

- Scopes, role-templates, and role-collections must match CDS annotation expectations.
- Check `oauth2-configuration` for correct redirect URIs if using AppRouter.
- Flag `authorities: ["$ACCEPT"]` in production — this grants all scopes.

## Environment Configuration

- `cds.requires` in `package.json` must define `[production]` profile overrides for HANA and XSUAA.
- Local `sqlite` binding should only be active in `development` profile.
- `.env` / `default-env.json` files must be in `.gitignore`.

## HANA Deployment

- Ensure `@sap/hdi-deploy` is in `db/package.json` dependencies.
- Verify `undeploy.json` lists artifacts to be removed on redeployment.
- Flag manual `.hdbtable` files that should be generated from CDS models instead.

## Common Deploy Errors

- **"Service creation failed"**: Check `resources` in `mta.yaml`, verify service plan availability in the subaccount.
- **"HDI deploy failed"**: Run `cds compile --to sql` to check for model errors.
- **"Route already exists"**: Check `routes` in `mta.yaml` for conflicts.
- **"Insufficient scope"**: Verify `xs-security.json` → role template → role collection chain.

## Reference

See the [mta.yaml template](./mta-template.yaml) for a standard CAP project structure.
