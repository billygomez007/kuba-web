# Staging Migration Repair Gate

## Captured production evidence

- Manifest: `production-schema-manifest.json`
- Capture time: `2026-08-21T06:50:35.952Z`
- SHA-256: `680ad76260a09519314cd3c22674301068654e4bda56413f5aa888aeef2b4c1c`
- Application revision: `1183e33c1ae1cd73a774f2581bab9e1e9fd0ecad`
- Repair branch: `chore/drizzle-migration-repair-staging`
- Production Drizzle ledger entries: `0`

The manifest is schema-only. It records DDL, columns, indexes, foreign keys,
row counts, and the migration ledger. It does not contain row data, credentials,
tokens, or connection URLs.

## Blocking condition

The application environment exposes a database connection token, but no Turso
organization/API credential. A database connection token cannot safely create a
provider-native snapshot or a Turso database branch. Therefore:

- no provider-native backup has been created;
- no staging clone has been created;
- no migration baseline has been generated or applied;
- no production database has been modified.

Do not substitute a logical schema export or a fresh empty database for the
required provider-native production backup and clone.

## Required staging provision inputs

An operator with Turso platform authority must provide either:

1. a verified provider-native snapshot/restore identifier and staging database
   URL/token, or
2. a short-lived Turso organization API token plus organization, source database,
   and target group identifiers.

The target must be a new, isolated staging database. It must be created from the
verified production snapshot, preferably with Turso point-in-time recovery or a
database branch at the recorded timestamp. The staging token must be separate
from the production token and stored outside Git.

## Required preflight evidence before baseline work

1. Provider backup/branch identifier and capture timestamp.
2. Staging database identifier, URL, and separately scoped token.
3. A staging manifest produced with the same exporter.
4. Matching table list, DDL, indexes, foreign keys, and row counts between the
   production manifest and staging manifest.
5. Confirmation that the staging environment is not used by production traffic.

## Data-mapping decisions required before any destructive operation

| Area | Verified state | Safe staging strategy |
| --- | --- | --- |
| `ai_employee_teams` | Live table has legacy team-entity columns (`business_id`, `name`, `description`) and zero rows. The canonical schema expects an employee/team join table. | On staging, verify zero rows again. Preserve the legacy table by rename/copy only after a reviewed migration. Create canonical `business_teams` and the join table separately. Do not drop the table in the initial alignment migration. |
| `business_teams` / `business_team_members` | Absent. | Add only after confirming no replacement legacy tables or application dependencies exist. |
| `conversation_routing` | Absent. | Add in its own additive migration with the canonical indexes. |
| Billing (`plans`, `subscriptions`, `usage_records`) | Absent. | Add only as an additive post-baseline migration; do not seed or alter business plan data without an approved data policy. |
| `platform_audit_logs` | Absent. | Add as an additive post-baseline migration. |
| `tickets` / `ticket_messages` | Absent. | Add together in an additive migration after route-level smoke tests confirm the current application expects them. |

## Baseline design constraints

- Keep `db/schema.ts` as the only application and Drizzle schema source.
- Leave `drizzle/` and `drizzle/meta/` unchanged as immutable legacy evidence.
- Use a separate migration output directory and a staging-only Drizzle config.
- Validate the baseline-marker behavior on staging before relying on it. The
  baseline must be recorded by Drizzle itself; do not manually insert rows into
  `__drizzle_migrations`.
- The baseline represents the verified current staging schema only. Missing
  canonical objects must be introduced through clean forward migrations.
