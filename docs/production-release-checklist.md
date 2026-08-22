# SuperKuba Production Release Checklist

Status: **Not ready for deployment**

Candidate branch: `release/superkuba-production-candidate`

## Included candidate scope

- SuperKuba marketing homepage, navigation, product pages, industries, solutions, and resources.
- Branding assets and product showcase mockups.
- Signup, onboarding, invitation, and dashboard empty-state improvements.
- Better Auth production URL, preview-origin, and rate-limit configuration.
- Welcome email templates, Resend integration, and rate-limited welcome-email endpoint.
- Website chat and existing dashboard presentation updates.

These changes are isolated from the active feature worktree and contain no database schema or migration changes.

## Excluded from this candidate

- HR, attendance, leave, payroll, HR automation, and HR AI changes.
- Universal Inbox, channel adapters, intent routing, response orchestration, and controlled AI tools.
- Business Brain, AI performance, workforce builder, and executive intelligence changes.
- Unverified Blob storage knowledge-upload changes.
- Modified schema, migration journals, new migrations, and staging repair work.
- Backup files, screenshots, local database files, debug logs, environment files, and generated artifacts.

## Release gates

- [x] Resolve all ESLint errors. Current candidate result: 0 errors and 61 warnings; no lint rules were disabled.
- [ ] Review and triage the 61 remaining ESLint warnings before launch.
- [x] TypeScript check passes on the candidate.
- [x] Production webpack build passes on the candidate.
- [ ] Add and run a maintained test suite. The project intentionally has no tracked tests or `test` script; TypeScript and production-build validation are available instead. No fake tests were added.
- [x] Candidate contains no database, environment, debug, screenshot, or local database files.
- [x] Open Graph route builds and returns a branded `1200x630` PNG locally.
- [ ] Review Vercel project settings and production environment values without exposing secrets.
- [ ] Complete the migration plan and obtain explicit approval before running any migration.
- [ ] Perform authenticated smoke tests in a production-like environment.

## Application flow review

- [ ] Marketing homepage, footer, logo, and responsive navigation.
- [ ] Pricing section at `/#pricing` (there is no dedicated `/pricing` route).
- [ ] Products, solutions, industries, and resources pages and footer links.
- [ ] Signup, login, password reset, invitation, and onboarding flows.
- [ ] Authenticated dashboard, AI workforce, employee creation, employee settings, and activity/monitoring views.
- [ ] Public demo environment and mobile layouts.
- [ ] Email template rendering and authenticated welcome-email delivery.
- [ ] Open Graph image preview in Facebook, LinkedIn, and WhatsApp validators.

## Launch checklist

### Code quality

- [x] TypeScript passes.
- [x] Production build passes.
- [x] ESLint has zero errors.
- [ ] Review and resolve non-blocking lint warnings.
- [ ] Confirm no debug code, backups, local artifacts, or development-only files are tracked.

### Environment and security

- [ ] Verify all production variables in Vercel without exposing values.
- [ ] Confirm `ENCRYPTION_KEY` is set in production; the development fallback in `lib/encryption.ts` must never be used in production.
- [ ] Confirm Better Auth trusted origins and secure cookies on the production domain.
- [ ] Verify rate limits, webhook secrets, automation secret, and authorization behavior.

### Database readiness

- [ ] Confirm production schema and journal against the selected lineage.
- [ ] Review destructive historical migrations and data-preservation behavior.
- [ ] Prepare backup, forward migration, verification, and rollback procedures.
- [ ] Apply migrations only as a separately approved operation.

### Payments and email

- [ ] Verify payment provider configuration, webhook signing, subscription state, and failed-payment behavior if payments are enabled.
- [ ] Verify Resend configuration, sender domain, reply-to address, welcome email, and failure handling.

### AI and integrations

- [ ] Verify OpenAI configuration and production model access.
- [ ] Verify AI workforce creation, employee settings, activity monitoring, and authorization boundaries.
- [ ] Verify WhatsApp credentials, webhook verification, message delivery, and error handling.
- [ ] Verify Vercel Blob configuration and private knowledge-document access policy.

### UX and legal pages

- [ ] Test mobile responsiveness across homepage, auth, onboarding, dashboard, and demo routes.
- [ ] Verify security, privacy, terms, and data-protection pages and their footer links.

## Migration plan

1. Snapshot and verify the production database through the approved Turso procedure.
2. Compare the production schema and migration journal with the selected migration lineage.
3. Review the historical destructive column drops in `drizzle/0008_lonely_wendell_vaughn.sql`.
4. Resolve the ordinary versus canonical journal divergence before selecting migrations.
5. Generate a reviewed forward-only migration plan with rollback/data-preservation checks.
6. Apply migrations separately from the application deployment, with an operator present.

No migration is authorized by this checklist, and no migration was run while preparing the candidate.

## Production configuration checklist

Verify presence and valid production values in Vercel for:

- `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`
- `OPENAI_API_KEY`
- `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`
- `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`
- `ENCRYPTION_KEY`
- WhatsApp access, business, graph-version, phone-number, and verify-token settings
- `AUTOMATION_PROCESS_SECRET`
- Vercel Blob storage configuration required by any enabled upload path

Never commit or print these values. A local redacted env file is not proof of Vercel readiness.

## Final smoke tests

- [ ] Homepage and branding assets
- [ ] Open Graph image and metadata
- [ ] Login, signup, invitation, and authenticated dashboard redirect
- [ ] AI workforce and employee profile pages
- [ ] Monitoring dashboard
- [ ] Public demo environment
- [ ] Mobile layouts at supported breakpoints
