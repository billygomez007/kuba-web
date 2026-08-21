# Enterprise launch checklist

## Security and access

- [ ] `BETTER_AUTH_SECRET`, `ENCRYPTION_KEY`, database credentials, automation secret, and integration credentials are configured as server-only production secrets.
- [ ] Every customer-facing business workflow uses an explicit active business context.
- [ ] Super Admin accounts are restricted, reviewed, and tested independently of business roles.
- [ ] AI actions require server-side permission, tenant ownership, approval policy, and audit logging.
- [ ] Webhook signatures and idempotency behavior are verified for every enabled integration.

## Database and recovery

- [ ] Reconcile duplicate/unregistered Drizzle migrations and snapshot history before deployment.
- [ ] Back up the production database and verify a restore drill.
- [ ] Apply migrations in staging before production; never reset production data.
- [ ] Verify indexes and tenant filters for high-volume customer, conversation, message, ticket, and task queries.

## Testing and deployment

- [ ] `npm test` and `npx tsc --noEmit` pass in CI.
- [ ] A production build passes in an unrestricted CI/deployment environment.
- [ ] Add API integration tests for authentication, tenant isolation, privileged mutations, and webhooks.
- [ ] Confirm rollback procedure for code separately from database migration recovery.

## Monitoring and operations

- [ ] Ingest structured application logs without tokens, request bodies, or customer content.
- [ ] Alert on request errors, authentication/authorization failures, action failures, AI failures, database latency, and integration delivery failures.
- [ ] Establish owners and escalation paths for security incidents, backups, and provider outages.
- [ ] Set usage/cost thresholds for AI calls before broad customer rollout.

## Billing and scale

- [ ] Approve plan, entitlement, subscription-change, and suspension policies before enabling payments.
- [ ] Instrument pagination, rate limiting, queueing/background processing, and cache strategy before high-volume use.
- [ ] Load-test conversation, messaging, webhook, and AI workloads using representative tenant isolation scenarios.
