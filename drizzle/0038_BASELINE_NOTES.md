# 0038_current_live_baseline

## What this is

A migration-lineage/metadata normalization, not a schema change. `db/schema.ts`'s
snapshot metadata (`drizzle/meta/*.json`) stopped being generated at
`0030_regular_barracuda`, even though seven more migrations (`0031`–`0037`) were
written and already applied to the live database. Without a snapshot covering
`0031`–`0037`, `drizzle-kit generate` cannot tell those tables apart from new
ones and proposes recreating them.

`0038_current_live_baseline.sql` is a no-op (`SELECT 1;`). `meta/0038_snapshot.json`
is a real Drizzle-native snapshot generated from the current `db/schema.ts`
(87 application tables — everything `db/schema.ts` exports, and nothing else:
no `__drizzle_migrations`, no `legacy_ai_employee_teams_pre_0001`, no `mastra_*`
tables), with `prevId` pointed at `0030_regular_barracuda`'s snapshot id so it
continues the real lineage rather than starting a new one.

## What was validated (disposable clones only — see task report for full detail)

- A local clone was built from the live database's exact `sqlite_master` DDL
  (not by replaying migration files, which have known gaps) plus the real
  `__drizzle_migrations` ledger content (11 rows, hashes and timestamps only —
  no application data was copied; row counts were reproduced with synthetic
  placeholder rows).
- Applying this baseline through `drizzle-orm`'s real migrator against that
  clone: zero schema changes, zero data changes, exactly one new ledger row.
- `drizzle-kit generate` immediately after: "No schema changes, nothing to
  migrate."
- A synthetic test-table change on a temporary schema copy: generate produced
  only that one table's `CREATE TABLE`, nothing else. Discarded, never
  committed.
- Running the baseline migration a second time: fully idempotent, zero
  further changes.

## Why applying it is safe

`drizzle-orm`'s sqlite/libsql migrator only compares each migration's journal
`when` timestamp against the single most recent `created_at` already in
`__drizzle_migrations` — it does not check every migration's hash
individually. The real production ledger's latest `created_at`
(`1787616000000`) is already later than every `0031`–`0037` journal `when`
value, so the migrator treats all of `0000`–`0037` as already applied and
would attempt only `0038` (`when: 1787700000000`). This was proven on a
disposable clone seeded with the real ledger content, not assumed.

## Not yet done

This baseline has **not** been applied to the production database and
`__drizzle_migrations` there has **not** been touched. See the task report
for the recommended production rollout (a normal `drizzle-kit migrate` /
`migrate()` run is expected to work without any manual ledger surgery, but
that step still needs its own explicit approval before it runs anywhere near
production).

## Clean database bootstrap

The historical `0000`–`0037` chain is not a reproducible empty-database
bootstrap: `0008` references customer columns that `0006` never created.
Do not rewrite those applied historical migrations or use `drizzle-kit push`.

For a new local database, export the authoritative current schema and seed the
`0038_current_live_baseline` ledger row with:

```bash
CLEAN_BOOTSTRAP_DATABASE_URL=file:/tmp/kuba-clean.db \
  node scripts/bootstrap-clean-database.mjs
```

The helper accepts only `file:` URLs, creates no application data, and refuses
to run against Turso. Future schema changes should be generated normally after
this baseline and applied with the generated migration files. The permanent
reproducibility check is:

```bash
node --test tests/migration-reproducibility.test.mjs
```

Remote staging or production migrations require a separately approved,
read-only-verified target and must never use `kuba-staging` accidentally.
