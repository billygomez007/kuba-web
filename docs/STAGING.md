# SuperKuba staging workflow

SuperKuba uses a persistent `staging` branch for user acceptance testing before production promotion.

## Deployment model

- `main` is the production branch and deploys to `superkuba.com` only after explicit approval.
- `staging` deploys through the existing Vercel project's Preview environment.
- `staging.superkuba.com` should be assigned only to the `staging` branch deployment.
- Staging must use a dedicated Turso database whose identity is distinct from the live `kuba-staging` database.

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
