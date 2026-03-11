---
name: cap-security
description: Security practices for SAP CAP. Use when working with authorization, authentication, @requires/@restrict annotations, xs-security.json, XSUAA, roles, scopes, or reviewing code for security vulnerabilities.
---

# Security

## CDS Authorization

- Every service exposing sensitive data must use `@requires` or `@restrict` annotations.
- Use `@requires: 'authenticated-user'` as the minimum for non-public services.
- Use `@restrict` with `grant` and `where` clauses for row-level authorization.
- Prefer role-based annotations over programmatic checks in handlers.

## xs-security.json

- Roles in `xs-security.json` must match the roles used in CDS `@requires` / `@restrict`.
- Scopes follow the pattern: `$XSAPPNAME.<scope-name>`.
- Role collections must map to role templates — flag any mismatch.
- Flag `authorities: ["$ACCEPT"]` in production — this grants all scopes.

## Handler-Level Security

- Flag any handler accessing `req.user` without verifying authentication scope.
- Never trust client-provided data for authorization decisions — validate server-side.
- Use `req.user.is('<role>')` for programmatic role checks when annotations are not enough.
- Never log or expose `req.user.token` or JWT content in error messages or responses.

## Remote Service Calls

- Must go through `cds.connect.to()` or SAP Cloud SDK — never raw `fetch`/`axios`.
- Destination credentials come from BTP Destination Service, not hardcoded.
- Flag any hardcoded credentials, API keys, or tokens in source code.

## Data Protection

- Annotate personally identifiable fields with `@PersonalData` annotations.
- Use `@PersonalData.IsPotentiallySensitive` for sensitive fields.
- Ensure audit logging is enabled for entities with personal data.

## Checklist

When reviewing for security, check for:

1. Missing `@requires` on service-level or entity-level.
2. Hardcoded credentials or tokens anywhere in the codebase.
3. `req.user` access without scope verification.
4. Raw HTTP calls to SAP endpoints bypassing destination service.
5. `$ACCEPT` authority in production `xs-security.json`.
6. Personal data fields missing `@PersonalData` annotations.
