# Production readiness runbook

## Required production configuration

Set server-only values for `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `BETTER_AUTH_URL`, `ENCRYPTION_KEY`, `AUTOMATION_PROCESS_SECRET`, and each enabled integration secret. Do not expose any secret through a `NEXT_PUBLIC_` variable. `ENCRYPTION_KEY` is required when `NODE_ENV=production`.

## Deployment checks

1. Reconcile the Drizzle migration journal before applying pending migrations.
2. Back up the Turso database and verify a restore procedure before each migration.
3. Run `npm test`, `npx tsc --noEmit`, and `npm run build` in a production-like environment.
4. Confirm WhatsApp webhook signature verification and automation-secret configuration after deployment.

## Monitoring signals

Track request latency/error rate, authorization denials, action failures, AI failures and token usage, database latency, webhook signature failures, integration delivery failures, and migration outcomes. Use structured `logServerEvent` entries without request bodies, credentials, or customer content.

## Recovery

Keep a tested database backup/restore procedure, record migration versions with each deployment, and roll back application code independently from data migrations. Do not reset or delete production databases as part of incident response.
