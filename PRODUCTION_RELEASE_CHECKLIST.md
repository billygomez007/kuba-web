# SuperKuba Production Release Checklist

## Required sign-offs

- [ ] Product owner approves scope and unresolved commercial decisions.
- [ ] Security owner reviews open P1/P2 risks.
- [ ] Data owner verifies the intended database and restore point.
- [ ] Operations owner confirms monitoring, support, and rollback readiness.

## Before release

- [ ] Confirm branch, commit, and reviewed diff.
- [ ] Run `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`, and `git diff --check`.
- [ ] Confirm no schema/migration change is bundled without separate approval.
- [ ] Verify Preview deployment is Ready and staging smoke tests pass.
- [ ] Verify production environment values without printing secrets.
- [ ] Verify Better Auth origin, secure cookies, session invalidation, and sign-out.
- [ ] Verify provider webhook secrets/signatures and staging-safe provider mode.
- [ ] Verify backup/restore evidence and rollback owner.

## Release gates

- [ ] No unresolved P0/P1 security or data-integrity issue.
- [ ] Tenant isolation, RBAC, entitlements, and foreign-resource denial pass.
- [ ] Billing cannot grant access before provider confirmation.
- [ ] AI authority and approval boundaries pass negative tests.
- [ ] Critical email links use the intended environment origin.
- [ ] Accessibility/mobile/browser checks are complete or explicitly accepted as blocked.
- [ ] Legal/privacy surfaces are approved or explicitly deferred by owner.

## Deployment

1. Deploy the reviewed commit through the approved Production Vercel target only after owner approval.
2. Run post-deploy health, login, dashboard, billing, webhook, and logout smoke tests.
3. Monitor errors, provider callbacks, latency, and database health.
4. Record the deployment, approvers, results, and rollback decision.

Never run production deployment, migration, billing, or provider actions from an unreviewed staging worktree.
