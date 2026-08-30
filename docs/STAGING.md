# SuperKuba staging workflow

SuperKuba uses a persistent `staging` branch for user acceptance testing before production promotion.

## Deployment model

- `main` is the production branch and deploys to `superkuba.com` only after explicit approval.
- `staging` deploys through the existing Vercel project's Preview environment.
- `staging.superkuba.com` should be assigned only to the `staging` branch deployment.
- Staging must use a dedicated Turso database, distinct from Production. See "Staging database identity" below before touching any database directly.

## Staging database identity

**REAL, CURRENT staging database hostname:** `superkuba-staging-billygomez007.aws-us-west-2.turso.io` (Turso database name: `superkuba-staging`). This is the database the real `staging`-branch Vercel Preview deployment actually uses — verified directly from the Preview environment's own `TURSO_DATABASE_URL`, not assumed from a local `.env` file.

**PROHIBITED / STALE — do not use for staging work:** `kuba-staging` (and any hostname under it, e.g. `kuba-staging-billygomez007...`). This is an old, abandoned database from an earlier phase of this project. It is not what `staging`-branch deployments use today. A prior session's local `.env` incorrectly pointed at this database, causing avoidable confusion — do not assume `.env`'s `TURSO_DATABASE_URL` is correct without first confirming it against the actual deployed Preview environment variable (`vercel env pull --environment=preview --git-branch=staging`, or `turso db list` cross-checked against the required hostname above).

Also never use the bare `kuba` database (no suffix) for any staging or development work — that is Production.

Before running any migration or direct database command against "staging," always verify the target hostname matches `superkuba-staging-billygomez007.aws-us-west-2.turso.io` exactly. If it does not match, stop and re-derive the correct credential rather than proceeding.

Never print or commit an auth token value, in this file or anywhere else. Generate short-lived, scoped credentials with `turso db tokens create <database-name> --expiration 1d` when a session needs direct database access, and let them expire naturally rather than reusing a long-lived one.

## Turso credential incident (disclosed)

A staging Turso auth token was previously exposed in a tool-result transcript during an earlier engineering session (a redaction pattern failed to match `.env`'s `TURSO_AUTH_TOKEN=` line format). Follow-up status:

- Individual per-token revocation is not available through Turso's tooling for tokens issued against the shared default group.
- Group-wide token invalidation for the default group was deliberately **not** performed, because it would also invalidate tokens for other, unrelated databases sharing that group.
- Staging has since been operating on a newly generated, short-lived token, issued directly via `turso db tokens create`, independent of the exposed one.
- Provider-level credential isolation (giving `superkuba-staging` its own token group, separate from other databases) remains an infrastructure follow-up, not resolved by this documentation change.

## Required Preview environment variables

Configure these in Vercel's Preview scope, restricted to the `staging` branch where Vercel supports branch overrides:

- `NEXT_PUBLIC_APP_ENV=staging`
- `NEXT_PUBLIC_APP_URL=https://staging.superkuba.com`
- `PUBLIC_APP_URL=https://staging.superkuba.com`
- `BETTER_AUTH_URL=https://staging.superkuba.com`
- a staging-only `BETTER_AUTH_SECRET`
- staging-only `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`

Do not copy production messaging, email, voice, webhook, encryption, or billing credentials into Preview. Leave those features unconfigured until sandbox credentials exist. Billing must use provider test mode. Staging voice and messaging must not contact real customers.

## Promotion workflow

1. Develop on a feature branch and validate locally.
2. Review and commit the change.
3. Merge or cherry-pick the reviewed commit into `staging`.
4. Wait for the staging deployment and run user acceptance tests.
5. Apply fixes through reviewed commits on `staging`.
6. After explicit approval, merge the approved staging commit into `main`.
7. Production deployment is triggered only by the approved `main` update.

Never promote a Vercel Preview deployment directly to production as a substitute for the reviewed Git merge.

## Initial staging data

Use schema-only initialization followed by synthetic identities and records. Do not clone production customer data.

The initial fixture should include:

- one owner who belongs to `SuperKuba Test Company` and `Kuba Demo Services`;
- one single-business administrator;
- one restricted staff member;
- synthetic AI employees, customers, conversations, and leads for each business.

Organization persistence is intentionally out of scope. The fixture uses the existing `business_users` membership boundary.
