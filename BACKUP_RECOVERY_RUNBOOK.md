# SuperKuba Backup and Recovery Runbook

## Current evidence

The repository does not prove a configured backup schedule, retention policy, restore target, or completed restore drill for the deployed Turso database. Treat backup readiness as **BLOCKED** until the database owner supplies provider evidence.

## Recovery procedure

1. Declare the incident and assign an incident owner.
2. Contain writes if continued writes could worsen corruption.
3. Identify the affected environment and verify the database name before any operation. Never use `kuba-staging` for staging; it is production despite its name.
4. Select an approved restore point and restore target through the database provider/operator process.
5. Verify schema, migration ledger, tenant counts, subscription state, and critical resource relationships.
6. Point only the intended environment at the restored target after approval.
7. Run application health and tenant-isolation smoke tests.
8. Restore traffic gradually and monitor errors/provider callbacks.
9. Complete a post-incident review and document data loss, actions, and follow-up.

## Proposed targets

RPO and RTO are not contractual commitments. Product and operations owners should approve targets after Turso backup capabilities, retention, and restore duration are verified.
