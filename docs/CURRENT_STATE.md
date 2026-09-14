# SuperKuba — Current State Audit

Written from a full repository audit on 2026-09-12. This is a living document —
update it as major features land or architecture changes, rather than adding
another dated point-in-time report to the repo root.

## 2026-09-14 update — OpenAI production configuration & AI runtime audit

Full inventory and hardening pass over every OpenAI call site — see
`docs/OPENAI_RUNTIME.md` for the complete architecture, model inventory,
per-employee mapping, and production checklist. Headline results:

- **No redesign** — the existing architecture (Vercel AI SDK's Responses
  API via `@ai-sdk/openai`, Mastra Agents for the five employees, direct
  `generateText()` for Executive Briefing/Command Center Q&A) was already
  the current, non-deprecated approach. Confirmed, not changed.
- **Centralized model configuration** (`lib/ai/model-config.ts`): the
  eight scattered `openai("gpt-4o")`/`openai("gpt-4o-mini")` literals
  across 6 Mastra agents + 2 routes now read from one source of truth, with
  optional environment overrides. No model was changed — same values as
  before.
- **New shared hardening** (`lib/ai/provider-error.ts`, `retry.ts`,
  `usage-logging.ts`), applied to all 5 direct AI-employee routes, the
  Website Widget's public AI path, and Executive Briefing/Command Center
  Q&A: safe provider-error classification (missing/invalid key, rate
  limit vs. quota exhaustion, timeout, 5xx — never leaked to the client),
  exactly-one bounded retry for genuinely transient failures only, a
  20-second timeout on the previously-unbounded Executive Briefing call,
  and minimal structured usage logging (businessId/employeeId/model/
  duration/outcome, never prompt or response content).
- **Real gap found and fixed**: `app/api/ai/receptionist/route.ts` was
  logging the AI's full response text to the console on every request —
  now logs only the length.
- **Real gap found, deliberately not fixed in this pass**: the same file
  also logs customer name/email/phone in plaintext at several points —
  flagged in `docs/OPENAI_RUNTIME.md` as a distinct customer-data-logging-
  hygiene item, out of this audit's OpenAI-specific scope.
- **Environment configuration confirmed, metadata-only** (`vercel env
  ls` — no values printed or retrieved): `OPENAI_API_KEY` is genuinely
  present for both Preview and Production. **No Vercel configuration
  change was needed.** The Executive-Briefing-degrades-gracefully
  behavior observed in the prior stability-audit session was a **local
  test-environment artifact** (`next start` production mode doesn't load
  the developer's own `.env.development.local`), not a real gap in the
  deployed environments.
- **Live smoke test performed** (Phase 30, optional — only because a
  valid non-production key was already present locally): reached OpenAI
  successfully but that specific local key's account has zero credits
  (`insufficient_quota`, a real external/account-level condition, not a
  code or configuration problem). All 6 tested call sites (Receptionist,
  Sales, Customer Support, General Manager, Outreach, Executive Briefing)
  degraded safely with correctly-classified server-side logs and safe,
  generic client-facing messages — this also caught one real consistency
  gap (Outreach was initially missing the new usage-logging wrapper,
  found via this live test and fixed to match its siblings).
- **Statically verified, whole-app**: no `"use client"` file anywhere in
  `app/` can transitively reach `@ai-sdk/openai`, `OPENAI_API_KEY`, or
  `OPENAI_REALTIME_*` — new test with a positive control proving the
  check isn't trivially passing (`tests/client-bundle-no-openai-key-exposure.test.mjs`).
- **Re-confirmed, not rebuilt**: the pre-existing tenant/authority
  architecture (`lib/ai/authority.ts`, `mastra/tools/business-context.ts`)
  already enforces exactly what this audit asked for — businessId/
  employeeId come only from a server-pinned, model-unwritable
  `RequestContext` (tool schemas have no `businessId` field at all), every
  write tool checks tenant ownership + active status + entitlement +
  autonomy policy before running, and external communication has a hard
  `requires_approval` floor no stored policy can bypass. Covered by 42
  pre-existing, still-passing tests.
- **No embeddings are used anywhere** in this codebase — Business Brain/
  knowledge search is word/token-based, not vector-based.
- **Realtime confirmed safe**: the OpenAI Realtime WebSocket is opened
  server-to-OpenAI only (never from a browser); no dashboard page performs
  real audio capture today (voice testing/simulator pages are text-only
  simulations) — telephony connection remains untouched, per this pass's
  explicit scope.

Baseline after this pass: 1454/1454 tests passing (24 new), lint clean (0
errors, 61 pre-existing warnings), typecheck clean, production build
clean.

## 2026-09-13 update — live bug fixes, platform provisioning, full clickability audit

Verified in this session, on `feature/outreach-ai-employee`:

- **Team & Staff and Billing & Subscription live crashes fixed.** Team &
  Staff's client bundle was transitively importing the database module
  (`lib/auth/permissions.ts` → `@/db`), which threw `LibsqlError: URL_INVALID`
  the instant the browser evaluated the bundle (server-only env var, unset
  client-side) — reproduced with a headless browser, not guessed. Split into
  `lib/auth/permission-definitions.ts` (pure, no DB import) +
  `lib/auth/permissions.ts` (DB-touching functions only). Billing's earlier
  "Unable to load billing" was proven to already be fixed by the time this
  session started; see `tests/staging-schema-drift-live-repro.test.mjs` and
  `tests/client-bundle-no-database-import.test.mjs`.
- **Migrations 0042/0043/0044 applied to the non-production staging Turso
  database** (`superkuba-staging-*`). 0042's two tables existed on the real
  schema but were never recorded in the ledger (likely an earlier
  `drizzle-kit push`); reconciled the ledger for 0042, then applied 0043/0044
  for real via `drizzle-orm/libsql/migrator` directly (`drizzle-kit migrate`
  itself fails silently against this database — no error text, exit code 1;
  use the ORM migrator, matching `scripts/reconcile-staging-migration-ledger.mjs`'s
  own documented reasoning for avoiding the CLI).
- **Super Admin bootstrapped**: `info@realtegicworks.com` → `platformRole:
  super_admin` on the staging database, via the canonical
  `scripts/bootstrap-platform-admin.mjs` (zero admins existed). The older
  `scripts/bootstrap-super-admin.mjs` is now a deprecated shim delegating to
  it — it previously had no guard against promoting a second admin outside
  the audited flow and wrote `updated_at` in the wrong unit.
- **Realtegic Enterprise-complimentary grant, Realtegic portfolio creation,
  and Kora OS linkage/dual-ownership were NOT executed by Claude** — these
  are real business/billing data writes to the shared staging database and
  were blocked by the session's own safety controls ("Modify Shared
  Resources"). Per the account holder, these were completed manually via the
  real `/admin/businesses/[id]` and `/admin/organizations` UI (now that
  `info@realtegicworks.com` has `super_admin` access) — Claude has not
  independently re-verified this state on the database.
- **Full clickability/destination audit** across Starter/Growth/Pro/Enterprise
  and the admin surfaces — see `docs/acceptance/FULL_CLICK_AUDIT.md` for the
  complete matrix, findings, and fixes (Help was a dead `/help` link with no
  route at all; two dead hrefs on the admin home page and the Command Center
  hub; two integration pages with a fully inert "Connect" button and no
  backend; one orphaned fake-chat component deleted; `isBusinessRole()` was
  silently rejecting "admin" and "member" — two of the six roles the Team &
  Staff page itself offers — for every real caller, including team
  invitations). A static TypeScript-AST-based scanner
  (`scripts/lib/clickability-scanner.mjs`) now runs as a permanent regression
  test (`tests/clickability-audit.test.mjs`) across
  `app/dashboard`, `app/admin`, `app/onboarding`, `app/components`.
- **Known non-blocking issue found, not yet root-caused**: a minified React
  hydration warning (error #418) reproducibly occurs on
  `/dashboard/settings`, `/dashboard/settings/profile`,
  `/dashboard/settings/ai`, and the `/dashboard/human-workforce/[section]`
  sub-pages. Does not crash the page (React's automatic hydration recovery
  renders the correct content) and was not root-caused within this session's
  scope — needs a `next dev` (non-Turbopack-HMR-interfered) investigation
  with the full non-minified error. Tracked as a follow-up, not fixed here.
  **Update (2026-09-13, internal stability pass)**: a full follow-up
  investigation (real login flow, `next dev` and `next start`, fresh browser
  contexts, warm/cold caches, all 4 named routes plus every other
  `human-workforce/[section]` value) could not reproduce this warning even
  once, and a complete source audit of every component in these routes'
  render trees found no code that violates React's hydration-safety rules.
  As a validating control, the same audit method DID find (and this pass
  fixed) two genuine latent hydration-risk patterns elsewhere
  (`useState(() => Date.now())` in `/dashboard/tasks` and
  `/dashboard/follow-ups`) — proving the method works when a real instance
  exists. See `docs/acceptance/PRODUCTION_READINESS.md` for the full
  methodology. Left as `OWNER_PREVIEW_REQUIRED`, not claimed fixed, since
  nothing reproducible was found to fix; may be specific to real Vercel Edge
  infrastructure or the original test session's own flagged cookie issue.

## 2026-09-13 update — internal stability / production-readiness pass

A systematic stability audit across hydration, runtime errors, form
persistence, AI employee lifecycle, plan transitions, multi-business
isolation, Super Admin auditability, and responsive/browser-history
behavior — full matrix in `docs/acceptance/PRODUCTION_READINESS.md`.
Headline results:

- **Two real (if not currently visible) hydration-risk defects fixed**:
  `app/dashboard/tasks/page.tsx` and `app/dashboard/follow-ups/page.tsx`
  both seeded a `Date.now()`-based `useState` lazy initializer, evaluated
  during the render pass itself. Not currently a visible bug (the arrays
  they filter start empty, populated later via a client effect) but a
  latent risk fixed defensively: initial value is now a deterministic `0`,
  the real value is set client-side only, after mount.
- **Zero uncaught runtime errors and zero hydration warnings** across a
  live browser sweep of all 84 static `/dashboard/*` routes, run once per
  plan tier (Starter, Growth, Pro, Enterprise — 336 page loads total).
  Every entitlement-gated page shows an honest "requires a higher plan"
  message, never a crash or a fabricated empty state.
- **Form persistence verified for real** (save → reload → same value):
  Business Profile, Preferences, AI Settings, Team invitations, AI Employee
  activation, Website Widget configuration.
- **Plan transitions verified for real**: a live Growth → Pro → Growth
  subscription change correctly updated the sidebar workspace label,
  Billing page, and Analytics entitlement gate on reload each time,
  including correctly re-enforcing the gate on downgrade (never stuck
  open).
- **Genuine gap found and honestly documented, not built**: AI employee
  deactivation/reactivation does not exist anywhere in the codebase (no UI
  control, no API route writes `aiEmployees.status` back to inactive).
  Confirmed there is no fake/dead "Deactivate" button claiming otherwise —
  this is a real missing capability, left as a follow-up per this pass's
  explicit instruction not to build new major product modules.
- **Duplicate-submission safety confirmed**: a rapid double-click on "Send
  Invitation" produced exactly one invitation, not two.
- **Multi-business isolation, business-selection edge cases, Super Admin
  auditability, and tenant/plan-gate security boundaries** were re-verified
  against the existing (already extensive) test suite rather than
  re-derived from scratch — all still pass.

Baseline after this pass: 1428/1428 tests passing, lint clean (0 errors, 61
pre-existing warnings), typecheck clean, production build clean.

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

**Update: the Campaign Engine is feature-complete end-to-end, including
the dashboard** (commits `efe8b75` through `b348890`). Domain model,
centralized campaign/recipient state machines, a durable DB-backed send
worker (atomic claim/lease, capped retry/backoff), double
suppression/consent gates, email delivery via the existing Resend
integration with a deterministic provider idempotency key, a signed
unsubscribe endpoint, a full CRUD/enrollment/lifecycle service layer with
centralized editability rules, thin authenticated API routes
(`/api/outreach/campaigns/**`), deterministic AI tools for the Outreach
employee to prepare (not execute) campaigns, a shared Sales handoff core
that both autonomous-research qualification and campaign-reply engagement
converge into, and a dashboard (list/create/detail-monitoring, integrated
into the existing "AI Workforce" nav group and design system) for all of
it.

**Acceptance pass (this session, commits `75c2201`/`b348890`)**: pushed to
a Vercel preview deployment and worked the fixes that surfaced from that —
see "Acceptance pass findings" below for the two real defects fixed
(cron-frequency deploy failure; incomplete Sales-handoff visibility) and
what remains **NOT YET DONE**: real interactive browser click-testing.
The preview deployment is reachable and builds clean, but sits behind
Vercel's own Deployment Protection (SSO) — accessible only via a
logged-in Vercel account session, which this environment does not have
and no browser-automation tool is available in this session either. See
`docs/OUTREACH_CAMPAIGN_ACCEPTANCE.md` for the full record and the manual
checklist a human (or a future browser-capable agent/session) still needs
to run before this branch can be called `READY FOR STAGING INTEGRATION`.
Live inbound reply correlation also remains unbuilt: the deterministic
destination (`lib/outreach/campaign-reply-handoff.ts`) exists and is
tested, but nothing calls it yet — blocked on the DNS/inbound-receiving
decision (production blocker #2 below), which is intentionally deferred,
not forgotten.

### Campaign Engine acceptance pass — two real defects found and fixed

With no browser tool available in this session, acceptance work was
diligence at the source/route/deployment level, not click-testing. Two
genuine defects turned up this way (both fixed, both covered by new or
existing automated tests — see `docs/OUTREACH_CAMPAIGN_ACCEPTANCE.md`):

1. **The Vercel deployment failed outright.** `vercel.json`'s cron entry
   for the send worker (`*/5 * * * *`) exceeds the Hobby plan's
   once-per-day cron limit, and Vercel rejects the whole deployment when
   any cron expression exceeds the plan's allowed frequency — confirmed
   via Vercel's own cron usage/pricing docs. Fixed properly, not worked
   around: `vercel.json`'s entry is now a once-daily safety-net fallback,
   and `.github/workflows/campaign-send-cron.yml` is the real 5-minute
   trigger, calling the same `CRON_SECRET`-protected endpoint over HTTP.
   Inert until merged to the default branch (GitHub only evaluates
   scheduled workflows there) and requires two values in the repo's
   Actions secrets/variables to do anything once merged — see the
   workflow file's own header comment.
2. **Sales handoff visibility was incomplete.** The recipient table
   showed a "Handed off" badge but no Sales lead reference, assigned
   employee, or reason — the approved dashboard brief explicitly required
   all of those. Fixed by joining `leads`/`aiEmployees` (business-scoped)
   into the recipients route and rendering a safe, fixed-allowlist reason
   label. Also added an honest static notice explaining that reply/hand-off
   detection requires inbound email receiving to be configured — the
   dashboard never claims reply tracking is active.

22 new dashboard/route-boundary tests were added
(`tests/outreach-campaign-dashboard-policy.test.mjs`) covering nav
entitlement, fabricated-metric prevention, the email-only channel,
eligibility-check completeness against the real backend gate, draft-only
mutability, exact per-status action mapping, preview non-sending, the
launch/AI boundary, and the new (previously zero-coverage)
`/api/outreach/contacts` route's tenant scoping.

**Still required before staging integration**: real interactive browser
acceptance. The Vercel preview deployment for this branch builds and
deploys successfully but sits behind Vercel's Deployment Protection (SSO)
— see `docs/OUTREACH_CAMPAIGN_ACCEPTANCE.md` for the preview URL and the
manual checklist.

### Canonical plan/pricing architecture — approved matrix now live (2026-09)

A 4-tier Starter/Growth/Pro/Enterprise commercial model already existed and
was mature (centralized capability system, AI Workforce entitlement policy,
navigation gating, pricing page — all already driven from
`lib/billing/plan-definitions.ts`). This pass audited it against a newly
approved commercial matrix and closed the real gaps found, rather than
rebuilding anything:

- **Capability reassignment** (`lib/billing/plan-definitions.ts`):
  `customer_ops.conversations`, `customer_ops.appointments`, and
  `intelligence.basic` moved from Growth-and-up into Starter (Starter is
  "your first AI employee" and needs a usable Receptionist from day one —
  conversations, appointments, and basic analytics are core to that, not an
  upsell). `customer_ops.leads` moved the other direction, from Starter into
  Growth-and-up (Starter has no Sales AI employee at all under the approved
  model, so it has no Leads/Sales page either). `customer_ops.tickets`
  (Support) is unaffected — still Growth+.
- **Real working prices and positioning** (`lib/billing/pricing-presentation.ts`):
  replaced `"$XX"` placeholders with the approved GHS 699 / GHS 1,999 /
  GHS 4,999 / Custom prices and the approved taglines ("Your first AI
  employee" → "Your AI operating infrastructure"). Every surface (public
  `/pricing`, the dashboard billing plan-comparison page, the billing
  settings page) now reads from this one `pricingCopy` object — the billing
  plan-comparison page previously had its OWN hand-written positioning copy
  and deliberately withheld price ("No price is displayed until configured
  by billing"), which was the one real pricing-duplication bug found.
- **`getEmployeeAccessState()`** (new, in `ai-workforce-policy.ts`): a pure
  named decomposition of the existing `canActivateEmployee` decision into
  `{ visible, entitled, implemented, usageAvailable, requiredPlan }` — the
  exact vocabulary requested for answering "is this visible/entitled/usage-
  available" from one place. Introduces no new policy; active-employee
  slots remain the only resource this codebase actually meters today (no
  campaign-send/voice-minute/conversation quota enforcement exists yet —
  that would need real metering infrastructure, not just a wider type).
- **Richer upgrade CTA for Campaign Engine** (`app/dashboard/layout.tsx`):
  the generic "Upgrade required" deep-link screen now special-cases
  `outreach.campaigns`, pulling Kuba Outreach's own name/description/
  capability list from the existing `ai-workforce-catalog.ts` (no invented
  copy) instead of a generic capability-name label.
- **Employee entitlement matrix, Campaign Engine entitlement, deep-link
  protection, downgrade-preserves-data behavior**: all already correctly
  implemented and already exhaustively tested (see
  `tests/ai-workforce-policy-model.test.mjs`,
  `tests/customer-operations-integration.test.mjs`) — confirmed, not
  rebuilt. Deep-link protection is client-side pathname-driven
  (`capabilityForPath` in `layout.tsx`, re-evaluated on every route change)
  and is explicitly NOT the security boundary — every API route re-checks
  entitlement server-side regardless of what the layout renders.
- **Deliberately not added**: granular `sales.basic`/`sales.pipeline`/etc.
  capability keys (section 12 of the brief) — no code-level distinction
  between "basic" and "advanced" Sales exists today to gate differently;
  the existing `customer_ops.leads` + `sales` employee-type entitlement
  already correctly differentiates Starter (none) from Growth+ (the full
  existing Sales feature set). A Growth-tier Voice add-on was also not
  added — the current billing architecture has no clean partial-add-on
  hook, so Voice remains Pro+ only rather than inventing one.

32 new/updated tests (`tests/canonical-plan-catalog-policy.test.mjs` plus
updates to five existing suites whose assertions encoded the prior
capability placement). 1076/1076 passing, lint clean, typecheck clean,
build clean.

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

## Baseline quality gate (`feature/outreach-ai-employee`, Campaign Engine
+ dashboard + acceptance-pass fixes, commit `b348890`)

- `npm test`: **1060/1060 passing** (1038 pre-acceptance-pass baseline +
  22 new dashboard/route-boundary policy tests)
- `npm run lint`: **0 errors**, 60 pre-existing warnings (unused vars,
  `<img>` vs `next/image`) — none introduced by this work
- `npx tsc --noEmit`: **clean**
- `npm run build`: **clean** (Next.js 16, webpack build)
- Vercel deployment for `b348890`: **success** (Preview environment;
  behind Vercel Deployment Protection/SSO — see
  `docs/OUTREACH_CAMPAIGN_ACCEPTANCE.md` for the URL)

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
8. The campaign send worker's real 5-minute cadence in production depends
   on `.github/workflows/campaign-send-cron.yml`, which needs `CRON_SECRET`
   and `PRODUCTION_APP_URL` configured in this repo's Actions
   secrets/variables after merge (Vercel's own cron can only run this
   worker once/day on the current plan tier — see the acceptance-pass
   section above).

`staging` and `feature/outreach-ai-employee` are reconciled as of `b1a31ff`.
`feature/outreach-ai-employee` is pushed to origin through `b348890`
(local and remote confirmed matching). **Not yet merged into `staging` or
`main` — do not merge until real browser acceptance (see
`docs/OUTREACH_CAMPAIGN_ACCEPTANCE.md`) has actually been run.**

## Next recommended milestones

1. **Real interactive browser acceptance of the Campaign Engine
   dashboard** — the actual blocker to staging integration right now. See
   `docs/OUTREACH_CAMPAIGN_ACCEPTANCE.md` for the preview URL (behind
   Vercel SSO — needs a logged-in Vercel session to open) and the exact
   manual checklist.
2. Decide and configure inbound email receiving (Resend supports it) so
   `lib/outreach/campaign-reply-handoff.ts` — already built and tested —
   can actually be triggered by a real reply.
3. Per-business verified sending identity for campaign email (today: one
   platform-wide `EMAIL_FROM`).
4. Independently audit Sales AI's conversation/CRM sync depth (not covered
   in this pass) before calling it production-ready.
5. Once merged to the default branch, add `CRON_SECRET` (secret) and
   `PRODUCTION_APP_URL` (variable) to this repo's GitHub Actions
   configuration so `.github/workflows/campaign-send-cron.yml` actually
   drives the 5-minute send-worker tick in production.
