# SuperKuba — Current State Audit

Written from a full repository audit on 2026-09-12. This is a living document —
update it as major features land or architecture changes, rather than adding
another dated point-in-time report to the repo root.

## Where this lives

The canonical repo is `billygomez007/kuba-web`. Three local checkouts exist:

- `~/Projects/kuba-web` — branch `staging`. Ahead of `main`. Has newer
  dashboard/design-system work and WhatsApp message-status tracking
  (`7000bea`) that the outreach branch below does not have yet.
- `~/Projects/kuba-web-outreach-ai` — a worktree on `feature/outreach-ai-employee`,
  **13 commits ahead of its own remote** and, as of this audit, with
  substantial uncommitted working-tree changes (AI employee activation UI,
  billing entitlements wiring, a new `lib/billing/ai-workforce-catalog.ts` +
  `ai-workforce-policy.ts` pair with tests). This is the active branch for
  Outreach/WhatsApp/Sales work and where this audit was performed.
- `~/Projects/copilot-worktrees/kuba-web/...` — another worktree, branch
  `billygomez007-website-chat-activation`.

**`staging` and `feature/outreach-ai-employee` have diverged** — each has
commits the other lacks. Reconcile deliberately (rebase or merge) before
either branch goes further, rather than letting them drift further apart.

A separate, unrelated repo `billygomez007/kuba-ai-platform` (Mastra + a
different local `kuba-knowledge.db`) also exists on disk but does not appear
to be part of the current product — the real AI employees are Mastra agents
defined directly inside `kuba-web` (see below). Treat `kuba-ai-platform` as a
historical prototype unless proven otherwise.

## Stack

- **Framework**: Next.js 16 (App Router), React 19, Tailwind 4.
- **Database**: Turso (LibSQL/SQLite-family), via Drizzle ORM.
  `db/schema.ts` (~3,000 lines, ~87 tables) is the one real schema file.
- **Auth**: better-auth (`lib/auth.ts`), with the app's own `users` table
  (not the generic better-auth-scaffolded one — see Known Issues) as its
  user model via `user: { modelName: "users" }`.
- **AI**: Mastra (`@mastra/core`, `@mastra/memory`, `@mastra/libsql`) +
  Vercel AI SDK, OpenAI as the model provider.
- **Email**: Resend. **Billing**: dual-provider, Stripe or Paystack via a
  `BILLING_PROVIDER` switch (`lib/billing/provider.ts`).
- **WhatsApp**: Meta Cloud API (Graph API), direct HTTPS, no SDK.
- **Voice**: OpenAI Realtime API (WebSocket) for AI-side audio, Twilio for
  telephony (inbound/outbound PSTN calls, Media Streams).
- **Testing**: `node --experimental-strip-types --test tests/*.test.mjs` —
  no Jest/Vitest. A `tests/helpers/alias-loader.mjs` registers a Node ESM
  loader so tests can `import` real `@/`-aliased modules directly instead of
  re-implementing logic; older tests instead read route source as text and
  assert on it. Prefer the alias-loader/real-import style going forward.
- **Deploy**: Vercel. One cron job today: `/api/billing/cron/reconcile-trials`
  (daily). No queue/job system (no BullMQ/Inngest/QStash/SQS) exists anywhere
  in the codebase.

## Multi-tenancy model

The tenant unit is a **business** (`businesses` table). Membership is
`businessUsers` (join table: user + business + role). A signed-in user can
belong to multiple businesses; the "currently selected" one is **not** part
of the better-auth session — it's a separate `superkuba_business_id` httpOnly
cookie, set/cleared by `app/api/businesses/select/route.ts`.

There are **four different "resolve current business" implementations**,
consistent within each subsystem but not unified:

1. `lib/auth/tenant.ts` → `getCurrentMembership()`/`requireBusinessMembership()`
   — the main one, reads the cookie, falls back to "exactly one membership"
   if unset. Used by most feature routes (leads, tickets, appointments, ...).
2. `lib/customer-operations-auth.ts` → `getOperationsContext()` — wraps #1
   with permission/entitlement checks, used by customer-ops routes.
3. `lib/auth/permissions.ts` → `getBusinessMembership()` — used by
   billing/admin/conversation-assignment routes. **Does not read the
   selection cookie** — see Known Issues below.
4. `lib/auth/platform-admin.ts` → `isPlatformAdmin()` — deliberately
   cross-tenant, for the platform-admin surface only.

Webhooks (WhatsApp, Twilio, Stripe/Paystack) have no session and correctly
resolve tenant from an external identifier instead (WhatsApp:
`phone_number_id` → `integrations` table lookup, never a payload-supplied
businessId).

## AI employees

Defined as Mastra agents (`mastra/agents/*.ts`) exposed through
`app/api/ai/{outreach,sales,receptionist,customer-support,general-manager}/route.ts`.
Configuration lives in `aiEmployees` + `aiEmployeeSettings` (per-business,
per-employee prompt/personality/escalation/supervision-mode). Deterministic
state changes go through explicit Mastra tools (e.g.
`save-outreach-prospect`, `qualify-outreach-prospect`,
`promote-outreach-prospect-to-sales`), not model-fabricated writes — this
pattern is followed consistently and is a real strength.

## What actually exists per priority area (vs. the product-vision brief)

### Outreach — narrower than "campaigns"

**There is no campaign/bulk-send feature.** No `campaign` table, no
list/segment/batch model, no scheduling, no start/pause/stop, no delivery
tracking, no send tool of any kind attached to the Outreach agent. What
exists is a **single-prospect research pipeline**:
`outreach_prospects` → `outreach_research_evidence` → `outreach_contacts`,
driven by `runOutreachResearchPipeline()`
(`mastra/workflows/outreach-research-pipeline.ts`), invoked synchronously
inside `POST /api/ai/outreach` (`mode: "autonomous_research"`) — there is
nothing to move to a queue yet because there is no bulk-send loop to move.
See `OUTREACH_RESEARCH_PIPELINE_REPORT.md` for the detailed build report.
Tenant scoping and prospect→lead promotion idempotency are solid (real
atomic claim-then-create transaction, tested for concurrent duplicates).

**Update: the Campaign Engine backend now exists** (commits `efe8b75`
through `ac163a6`). Domain model (`outreach_campaigns`,
`outreach_sequence_steps`, `outreach_campaign_recipients`,
`outreach_campaign_sends`, `outreach_suppressions`), centralized campaign/
recipient state machines, a durable DB-backed send worker (atomic
claim/lease, capped retry/backoff), double suppression/consent gates,
email delivery via the existing Resend integration with a deterministic
provider idempotency key, a signed unsubscribe endpoint, and a
Vercel-Cron-driven processing loop are all built, tested, and wired
together end-to-end for the email channel. **Not yet built**: campaign
CRUD/enrollment API routes, the AI-facing enrollment/personalization tool,
inbound reply correlation (see the new production blocker below — Resend
supports inbound email receiving, but wiring it needs a DNS/domain
decision this pass could not make), reuse of the existing Outreach → Sales
handoff tool for campaign-originated replies, and the dashboard (the
backend was deliberately built first, per explicit instruction).

### Outreach → Sales handoff — gated promotion, not live handoff

`promote-outreach-prospect-to-sales.ts` requires: `qualificationStatus =
"qualified"`, `icpFitScore >= 70`, `researchStatus = "researched"`, at least
one evidence record, **and** the Outreach employee's `supervisionMode =
"autonomous"` (default is `"owner_supervised"`, which blocks it). Idempotent
(atomic claim, tested for concurrency) and audit-logged. Only a synthesized
text summary carries into the new lead's `notes` — no message/conversation
history transfers. Outreach does not participate in the generic
department-based conversation router (`lib/communications/router.ts`) at
all — its only path to Sales is this promotion tool. This is a deliberate,
safe design (no accidental autonomous outreach), but is not the "prospect
replies → conversation flips to Sales" flow the product vision describes.

### WhatsApp — solid core, manual-only onboarding

`app/api/integrations/whatsapp/webhook/route.ts`: HMAC-SHA256 signature
verification with `timingSafeEqual`, `hub.challenge` GET verification,
idempotency by `externalMessageId` for both inbound messages and status
callbacks (tested). Tenant resolved strictly via `phone_number_id`, never a
payload businessId. Tokens encrypted at rest (AES-256-CBC via
`lib/encryption.ts` — CBC without a MAC; consider AES-GCM if this is
revisited). **Gap**: connecting a number is manual token paste
(`app/api/integrations/whatsapp/route.ts`), no Embedded Signup/OAuth — real
production-readiness gap for self-serve onboarding at scale, called out
explicitly in the product brief.

### Sales AI — conversational, not yet a full pipeline UI

Agent + tools exist and are wired to `leads`/`salesActivities`/`followUps`.
Not independently deep-audited in this pass — worth its own focused review
before claiming readiness (see Next steps).

### Voice/Realtime — two real adapters, one label bug (now fixed)

OpenAI Realtime (browser/AI-side audio, real WebSocket to `wss://api.openai.com/v1/realtime`)
and Twilio (real PSTN call initiation + Media Streams webhook, HMAC-signed)
are genuinely implemented. Retell/Vapi/SIP were listed as `"available"` in
`lib/voice/providers.ts` with **no actual transport** (every method just
threw "not configured") — a business could save real credentials for one and
get a false "active" badge. **Fixed in this session** (see Changes below).

Separately unresolved: `createOpenAIRealtimeTransport()` keeps its
`Map<callId, WebSocket>` in module-level memory — this will not survive
across separate serverless invocations/instances on Vercel. Fine for a
single always-warm dev/test session; not fine for real production
concurrency. Needs a durable session store or a different hosting model
(a long-running Node process, Vercel Fluid compute with sticky routing, or
similar) before real customers use voice at scale.

### Onboarding / Billing — data-driven, actively being unified

`lib/billing/entitlements.ts` resolves plan + subscription/trial +
per-business `entitlementOverrides` centrally (well-tested: fail-closed
trial/expiry edge cases, tenant isolation, webhook-only state changes).
Work in progress (uncommitted at audit time) is consolidating AI-employee
entitlements into `lib/billing/ai-workforce-catalog.ts` +
`ai-workforce-policy.ts` — this is exactly the "data/config-driven, not
scattered conditionals" direction the product brief asks for; finish and
commit it rather than starting a parallel system.

## Known issues found during this audit

1. **Voice provider availability label bug — fixed.** `retell`/`vapi`/`sip`
   are now `status: "planned"`, the connect route rejects them server-side,
   the settings UI disables them in the picker with "(Coming soon)". Added
   `tests/voice-provider-availability-policy.test.mjs` (5 tests).
2. **Tenant-resolution split, not yet fixed.** `getBusinessMembership()`
   (`lib/auth/permissions.ts`, used by billing/admin/conversation-assignment
   routes) does not read the `superkuba_business_id` cookie the way
   `getCurrentMembership()` does — with no `businessId` argument it requires
   the caller to belong to exactly one business. A user in multiple
   businesses who has explicitly selected business B elsewhere gets a wrong
   403 on billing/admin routes. Worth unifying onto one resolver; deferred
   pending confirmation this is worth the (moderate) blast radius of
   touching billing/admin routes.
3. **Dead/orphaned files that could mislead future auth-schema work**:
   `auth-schema.ts` (repo root) and `db/auth-schema.ts` are byte-identical,
   unused, generic better-auth-scaffold output — the real tables live in
   `db/schema.ts`. `drizzle/schema.ts` + `drizzle/relations.ts` are a stray
   old introspection dump, also unused. Recommend deleting all four once
   confirmed truly unreferenced (a `grep` at audit time found none).
4. **No `.env.example`.** Reconstructed the real variable surface via
   `grep -roh 'process\.env\.[A-Z_]*'` during this audit (see list below);
   worth turning into a committed template.
5. **Migration lineage before `0038` is not reliably replayable** — this is
   already documented and deliberately handled in
   `drizzle/0038_BASELINE_NOTES.md` (a hand-authored baseline snapshot
   reconciling manual schema edits made outside drizzle-kit). That note
   states the `0038` baseline had **not yet been applied to production** as
   of when it was written — this needs to be confirmed (not assumed) before
   any further migration work; requires whoever has production DB access.
   Migrations `0039`–`0041` since then look clean and drizzle-generated.

## Environment variables in use (no `.env.example` exists yet)

```
# Database
TURSO_DATABASE_URL, TURSO_AUTH_TOKEN

# Auth
BETTER_AUTH_URL, NEXT_PUBLIC_APP_URL / PUBLIC_APP_URL,
VERCEL_ENV, VERCEL_URL, VERCEL_BRANCH_URL

# AI
OPENAI_API_KEY, OPENAI_REALTIME_MODEL, OPENAI_REALTIME_VOICE

# Email
RESEND_API_KEY, EMAIL_FROM, EMAIL_REPLY_TO, SALES_CONTACT_EMAIL

# Billing
BILLING_PROVIDER, SUPERKUBA_BILLING_CURRENCY,
STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, PAYSTACK_SECRET_KEY

# WhatsApp / Meta
WHATSAPP_ACCESS_TOKEN, WHATSAPP_APP_SECRET, WHATSAPP_GRAPH_API_VERSION,
WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_VERIFY_TOKEN

# Voice / Twilio
TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VOICE_NUMBER,
VOICE_CREDENTIALS_KEY, VOICE_WEBHOOK_SECRET

# Ops
AUTOMATION_PROCESS_SECRET, CRON_SECRET, ENCRYPTION_KEY,
NEXT_PUBLIC_APP_ENV, NODE_ENV
```

## Baseline quality gate (`feature/outreach-ai-employee`, post staging
reconciliation, commit `b1a31ff`)

- `npm test`: **955/955 passing** (up from 834 pre-reconciliation)
- `npm run lint`: **0 errors**, 60 pre-existing warnings (unused vars,
  `<img>` vs `next/image`) — none introduced by this work
- `npx tsc --noEmit`: **clean**
- `npm run build`: **clean** (Next.js 16, webpack build)

## Production blockers (in rough priority order)

1. **BLOCKED** — Production Turso schema/migration state must be verified
   read-only before the next production database deployment. Do not assume
   `0038`–`0042` are applied to production merely because they exist
   locally; do not reset, replay migrations against, or otherwise touch
   production until an operator confirms real Turso access.
2. Campaign reply correlation needs a decision on inbound email receiving.
   Resend (already the platform's email provider) supports inbound email
   receiving (a "Receiving" DNS record + webhook events), which would
   avoid a second external provider — but configuring a receiving
   domain/subdomain is a real DNS/production change outside what this pass
   can do autonomously. Until decided and configured, campaign replies
   cannot be correlated back to a send/recipient/prospect and the existing
   Outreach → Sales handoff tool cannot be triggered from a campaign reply.
3. Every campaign email currently sends from one platform-wide `EMAIL_FROM`
   address — no per-business verified sending identity yet (see
   `lib/outreach/email-channel.ts`).
4. Decide whether WhatsApp Embedded Signup/OAuth for self-serve onboarding
   (today: manual token paste only) ships before or alongside the Outreach
   Campaign Engine.
5. Voice: durable session state for OpenAI Realtime calls across serverless
   instances, before relying on it for real concurrent traffic — explicitly
   deprioritized until the campaign foundation is stable.
6. No `.env.example` — onboarding a new environment currently relies on
   grepping the codebase.
7. Unify the four tenant-resolution helpers, at least fixing the
   `getBusinessMembership()` cookie gap (#2 in Known Issues).

`staging` and `feature/outreach-ai-employee` are reconciled as of `b1a31ff`
(staging merged forward into this branch, not rebased). Not yet pushed.

## Next recommended milestones

1. Outreach Campaign Engine: audiences, campaigns, sequencing, scheduling,
   sending, pause/resume/stop, delivery tracking, replies, suppression/
   opt-out, retries, metrics, and handoff — built as a layer on top of the
   existing Outreach Intelligence pipeline (research → qualify → promote),
   not a replacement for it.
2. Durable, DB-backed job execution (Vercel Cron polling a jobs table with
   atomic claiming/lease semantics) for campaign sends — no new queue
   infrastructure (Redis/Kafka/Temporal) without evidence it's needed.
3. Email-first channel rollout for campaigns; WhatsApp campaign sending
   only once the existing webhook/delivery-status paths have stayed green
   through the reconciliation (validated at merge time — see the
   `tests/whatsapp-integration.test.mjs` / `whatsapp-webhook-policy.test.mjs`
   suites).
4. Independently audit Sales AI's conversation/CRM sync depth (not covered
   in this pass) before calling it production-ready.
