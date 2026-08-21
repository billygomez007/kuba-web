# Drizzle Migration Repair Evidence

This directory holds non-sensitive evidence and runbooks for the staging-only
Drizzle migration repair. It does not contain production credentials or table
data.

The existing `drizzle/` history is legacy evidence and must remain unchanged.
The migration repair must not begin until the production backup and the staging
clone have been verified.

## Capture command

Run from the repository root with the intended database credentials loaded:

```bash
npx tsx scripts/export-migration-manifest.ts \
  docs/migration-repair/production-schema-manifest.json
```

The manifest contains only schema DDL, columns, indexes, foreign keys, row
counts, the Drizzle migration ledger, and non-secret application version data.
