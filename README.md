# Kuba AI

Kuba AI is a multi-tenant business platform with AI employees, customer operations, integrations, and internal platform administration.

## Local development

1. Install dependencies: `npm install`.
2. Configure local server-side environment variables in `.env.local`.
3. Start the app: `npm run dev`.

Required service configuration depends on enabled features. Core development requires `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `BETTER_AUTH_URL`, and `BETTER_AUTH_SECRET`. Production also requires `ENCRYPTION_KEY` and `AUTOMATION_PROCESS_SECRET`; WhatsApp requires its documented credentials.

Never commit environment files or expose secrets via `NEXT_PUBLIC_` variables.

## Validation

```bash
npm test
npx tsc --noEmit
npm run build
```

`npm test` runs the dependency-free security foundation tests. The production build should be run in CI or a deployment-like environment; it may not run in restricted sandboxes that block Turbopack's internal compiler process.

## Architecture

- `app/` — App Router pages and route handlers
- `db/` — Drizzle connection and authoritative schema
- `drizzle/` — migration history (do not rewrite or reset)
- `lib/auth/` — authentication, authorization, tenant context, and audit helpers
- `lib/ai/`, `mastra/` — AI orchestration, tools, and safety boundaries
- `lib/api/`, `lib/observability/` — validation, rate-limit inventory, and structured logging
- `tests/` — critical security-foundation tests
- `docs/` — production runbooks and launch checklists

## Security conventions

Business-scoped server code must use `requireBusinessContext()` or `requirePermission()` and must not accept a client-supplied business ID as proof of access. Platform administration requires `requireSuperAdmin()`. AI-generated requests must pass authorization, validation, approval policy, and audit logging before execution.

## Database and deployment safety

Review [production-readiness.md](docs/production-readiness.md) and [enterprise-launch-checklist.md](docs/enterprise-launch-checklist.md) before production deployment. Reconcile the Drizzle migration journal before applying the outstanding additive migrations.
