# SuperKuba Production Deployment Runbook

## Pre-release

1. Confirm owner-approved release commit and clean reviewed diff.
2. Confirm staging Preview is Ready and smoke-tested.
3. Confirm production configuration checklist and backup evidence.
4. Decide whether schema changes exist. Do not deploy application code that requires an unapplied migration.
5. Record the last known-good deployment.

## Deploy

1. Merge or promote only after explicit production approval.
2. Deploy to the configured Production target using the approved Vercel workflow. Never use `--prod` casually or from an unreviewed branch.
3. Do not change production domains or environment variables during an application release.

## Verify

- Health endpoint responds without configuration leakage.
- Homepage, login, dashboard, business selection, Settings, Billing, Integrations, and Sign Out work.
- Authenticated APIs enforce tenant, RBAC, entitlement, and ownership boundaries.
- Webhook signature failures are rejected.
- Error monitoring and provider logs show no new incident.

## Rollback

1. Stop rollout and declare an incident if health, auth, data isolation, billing, or provider callbacks fail.
2. Revert application traffic to the last known-good Vercel deployment when database compatibility permits.
3. Do not roll back database schema by guesswork. Use a reviewed forward fix or restore procedure.
4. Re-run smoke tests and record the incident and decision.
