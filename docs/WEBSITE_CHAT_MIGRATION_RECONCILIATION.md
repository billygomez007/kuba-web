# Website Chat migration execution reconciliation

## Scope and evidence boundary

This is the release plan for Website Chat based on production main
`320144ec4a4d042b2e11a50e3d9d14a4996f5ac9` and provider candidate
`c002a6aeb23d29efa32c497c2a937ed278a0e7ae`, with the strict-origin correction
added on top. It does not release the action-policy, outreach-campaign, or
organization features. No migration, ledger change, or production data change
was performed by this reconciliation.

Git SQL and application dependencies were rechecked on 2026-09-14. Production
evidence comes from the earlier read-only audit of `superkuba-production` on
that date. The two dedicated production read-only environment variables were
absent during this follow-up, so no fresh schema or ledger query was possible.
Current production state is therefore an outstanding execution prerequisite.
In particular, the earlier audit did not inspect the three outreach consent
columns. Do not interpret a local test result as a fresh production audit.

## Already-applied production history

These hashes were recorded in the production ledger but their migration files
are absent from the reviewed production main/provider journal:

| Migration | Timestamp | SHA-256 |
| --- | --- | --- |
| `0039_appointments_tickets` | `1787713690223` | `d61b902f857786983c9aaaa68f34c9c1864e43f33b885060f8eeb7b7ff5c57f1` |
| `0039_keen_catseye` | `1787745488338` | `002c30b209e01c9137be06d8eb653f7907ac55b6120f6915cceff99aa74b2585` |
| `0040_outreach_prospect_intelligence` | `1788040870407` | `da742425bc8ae92ed5f94ee4f25fe1b810dce286807aa60266bbef9872876a94` |
| `0041_whatsapp_webhook_health_and_message_status` | `1788117804308` | `862678f2d3e2abf98db17fd415ea3bc9cf7af015537ccfc6c19003ed486a24e5` |

Do not replay these entries or rewrite their historical hashes/timestamps.

## Release decisions

| Migration | Decision for this provider release | Execute before 0045? | Ledger reconciliation now? |
| --- | --- | --- | --- |
| `0040_whatsapp_message_status` | SUPERSEDED / DO NOT REPLAY | No | No |
| `0041_integration_webhook_health` | SUPERSEDED / DO NOT REPLAY | No | No |
| `0042_silky_steve_rogers` | Duplicate historical alias; FEATURE-BRANCH ONLY / EXCLUDED | No | No |
| `0042_cuddly_starhawk` | Canonical historical reference for the identical 0042 SQL; FEATURE-BRANCH ONLY / EXCLUDED | No | No |
| `0043_outreach_campaign_engine` | FEATURE-BRANCH ONLY / EXCLUDED | No | No |
| `0044_steep_human_torch` | FEATURE-BRANCH ONLY / EXCLUDED | No | No |
| `0045_superkuba_widget_origins` | Sole proposed executable migration, after fresh read-only preflight and separate authorization | N/A | Normal migration recording only when actually applied |

No excluded objects are referenced by the provider release's application,
library, Mastra, or schema code. The provider migration has no dependency on
them: it only requires the existing `integrations` table. Exclusion is specific
to this release, not a claim that the other features never need their schema.

### Split 0040 / 0041

The exact statement set of the two split migrations equals the already-applied
combined migration, with statement order being the only difference:

- `messages.status`: nullable text, no default.
- `messages.status_updated_at`: nullable integer, no default.
- `integrations.last_webhook_at`: nullable integer, no default.

The earlier production column inspection confirmed all three names and types.
Replaying the split files would attempt duplicate column additions. They need
neither execution nor fabricated ledger entries. Reconfirm their definitions
in the fresh preflight; stop if an expected effect is missing or differs.

### Both 0042 identities

The files are byte-identical. SHA-256:
`58dd881f1948498383605b3d15dbfbc9ff1f6b432f720e2c249663b48d8010bd`.

`0042_silky_steve_rogers` is in staging at timestamp `1788040883526`.
`0042_cuddly_starhawk` is in the outreach feature branch at `1789247952683`.
Use the latter as the canonical historical implementation reference because
it belongs to that feature's maintained migration chain and its timestamp is
after the reviewed production cutoff. Do not execute both identities.

Objects introduced:

- Tables: `ai_employee_action_approvals`, `ai_employee_action_policies`.
- Unique index: `ai_employee_action_policies_employee_id_unique`.

The earlier production table inventory contained neither table, so the index
could not be present either. The SQL hash was absent from the ledger. There is
no evidence warranting a ledger-only reconciliation: that would falsely claim
absent schema existed. Current existence must still be checked before any
future release of this feature. No provider data or schema dependency requires
0042 now.

### 0043 campaign engine

Timestamp: `1789249138998`. SHA-256:
`c063897b8e18f3e6bca715ee553f22411a85a1992175e91f823147f2f2d25607`.

Objects introduced:

- Tables: `outreach_campaign_recipients`, `outreach_campaign_sends`,
  `outreach_campaigns`, `outreach_sequence_steps`, `outreach_suppressions`.
- Indexes: `outreach_campaign_recipients_campaign_contact_unique`,
  `outreach_campaign_recipients_business_campaign_idx`,
  `outreach_campaign_recipients_next_send_idx`,
  `outreach_campaign_sends_recipient_step_unique`,
  `outreach_campaign_sends_status_scheduled_idx`,
  `outreach_campaign_sends_business_campaign_idx`,
  `outreach_campaign_sends_external_message_idx`,
  `outreach_campaigns_business_status_idx`,
  `outreach_campaigns_business_employee_idx`,
  `outreach_sequence_steps_campaign_step_unique`,
  `outreach_sequence_steps_business_campaign_idx`,
  `outreach_suppressions_business_channel_identity_unique`.
- Columns on existing `outreach_contacts`: `consent_status` (text, NOT NULL,
  default `'unknown'`), `consent_source` (nullable text),
  `consent_captured_at` (nullable integer).

The five tables and their indexes were absent from the earlier production
table inventory; the migration hash was absent from the ledger. The consent
columns were not inspected and must not be claimed present or absent.
The migration requires `outreach_contacts` for its column additions, but the
provider has no dependency on this campaign feature or these consent fields.
Exclude it from this release; do not mark it applied or partially replay it.

### 0044 organizations

Timestamp: `1789303451620`. SHA-256:
`2f038b14c31487834f6484a3a1cc76bac829d4207ec8c0c0641f7fefe40d3916`.

Objects introduced:

- Tables: `organization_businesses`, `organization_members`, `organizations`.
- Indexes: `organization_businesses_business_id_unique`,
  `organization_businesses_org_id_idx`, `organization_members_org_user_unique`,
  `organization_members_user_id_idx`, `organizations_slug_unique`.

These tables and indexes were absent from the earlier inventory, and the hash
was absent from the ledger. They belong to the unreleased organization code
on the outreach branch. Website Chat continues using `businesses` and
`business_users`; no organization dependency exists in this release. Exclude
0044, with no execution or ledger reconciliation now.

## Exact execution plan and timestamp handling

1. Independently review the strict-origin code and this release boundary.
2. Restore dedicated read-only inspection access and confirm database identity.
   Re-read the full migration ledger and all objects/columns listed above.
   Compare definitions as well as names if any supposedly absent effects exist.
   Confirm the three superseded columns have the reviewed definitions and
   `integrations.allowed_origins` is still absent. Stop on unexpected drift.
3. Confirm no newly included provider dependency requires an excluded migration.
   Recompute the effective pending set against the actual latest production
   timestamp. It must be exactly the unchanged widget-origin SQL, not merely
   a filename whose prefix looks correct. Re-review if the cutoff has advanced.
4. Under separate production authorization, apply only
   `0045_superkuba_widget_origins` through the reviewed migration mechanism.
   Do not apply any legacy split, 0042 variant, 0043, or 0044 file in this release.
5. Read back the column and normal migration ledger entry. Configure verified
   production origins separately before any provider deployment.

0045 remains nullable text with no default or backfill. Its SQL SHA-256 is
`7c0694aae092bf8427a4eef01499a77498dc91ce6c2977a1a2bb23ddd0bd56b9`,
its journal timestamp is `1789341443148`, and its snapshot bytes are unchanged.

Drizzle's timestamp skip behavior is unchanged. There are no required older
migrations for this provider release, so the release plan intentionally
excludes them rather than pretending they have run. After 0045, deploying an
excluded feature is blocked until that feature gets a separately reviewed
migration chain based on then-current production schema, using new unique
identities and timestamps later than the actual ledger maximum for missing
effects. Do not merge an old journal and expect 0042/0043/0044 to execute, and
do not move or fabricate production ledger timestamps. This future-feature
gate prevents required work from being silently skipped; numbering alone does
not enforce it across branches.

`tests/website-chat-migration.test.mjs` checks the provider's sole pending
migration against the historical cutoff, its SQL hash, the excluded tags,
and unchanged snapshot lineage. It is an offline regression guard, not a
production execution approval.

**Current execution decision: NOT APPROVED.** Fresh production metadata and
independent review remain required. No production authorization is implied by
this document or by passing tests.
