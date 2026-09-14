# SuperKuba — OpenAI Runtime

Written from a full-repository OpenAI integration audit on 2026-09-14, on
`feature/outreach-ai-employee`. This documents what actually exists and
runs today — update it when the architecture changes rather than adding a
second, drifting copy of this information elsewhere.

## Architecture

SuperKuba never calls OpenAI's REST API directly. Every call goes through
the **Vercel AI SDK** (`ai` + `@ai-sdk/openai`), in one of two shapes:

1. **Mastra Agents** (`mastra/agents/*.ts`) — the five customer/business-
   facing AI employees (Receptionist, Sales, Customer Support, General
   Manager, Outreach) plus an internal Outreach Researcher agent. Each is a
   `new Agent({ model, instructions, tools, memory? })` from
   `@mastra/core/agent`. Calling `.generate(prompt, { requestContext })`
   drives the Vercel AI SDK's own agentic tool-calling loop underneath
   Mastra's abstraction.
2. **Direct `generateText()`** (from the `ai` package) — two internal,
   non-agentic, non-customer-facing analysis features: the Executive
   Briefing (`GET /api/command-center/briefing`) and the Command Center
   free-text Q&A (`POST /api/ai/command-center`). No tools, no memory, no
   Mastra — a single prompt in, one JSON/text response out.

**API style**: calling `openai(modelId)` from `@ai-sdk/openai` (the pattern
used everywhere in this codebase) resolves to OpenAI's **Responses API**
under this SDK version (`@ai-sdk/openai@4.0.41` — confirmed from the
package's own type definitions: the bare call signature returns an
`Experimental_BatchLanguageModelV4`, the Responses-API model type). This is
already the current, non-deprecated OpenAI API style — no migration to a
different API style is needed or recommended. The Outreach agent's
`openai.tools.webSearch()` (a provider-hosted tool) specifically requires
the Responses API, which is additional confirmation this is the real,
active code path, not a legacy one.

No raw Chat Completions calls, no deprecated API usage, and no mixed/
inconsistent API styles were found anywhere in the repository.

## Model inventory

Centralized in `lib/ai/model-config.ts` as of this audit (previously eight
separate `openai("gpt-4o")` / `openai("gpt-4o-mini")` literals scattered
across agent and route files — same values, now one source of truth).

| Constant | Value | Env override | Used by |
|---|---|---|---|
| `DEFAULT_CHAT_MODEL_ID` | `gpt-4o` | `AI_DEFAULT_CHAT_MODEL` | Receptionist, Sales, Customer Support, General Manager, Outreach, Outreach Researcher — every conversational agent, real tool-calling, customer-facing |
| `EXECUTIVE_MODEL_ID` | `gpt-4o-mini` | `AI_EXECUTIVE_MODEL` | Executive Briefing, Command Center Q&A — internal, non-customer-facing, structured/short analysis over data the caller already has |
| `REALTIME_MODEL_ID` | `gpt-realtime` | `OPENAI_REALTIME_MODEL` (pre-existing) | OpenAI Realtime voice sessions |
| `REALTIME_VOICE` | `alloy` | `OPENAI_REALTIME_VOICE` (pre-existing) | OpenAI Realtime voice sessions |
| `EMBEDDING_MODEL_ID` | *(unset — not used)* | — | Nothing. Business Brain / knowledge search (`lib/knowledge/search.ts`) is word-based (SQL `LIKE`/token matching over `knowledgeChunks`), not vector/embedding-based. No embedding model is called anywhere in this repository. |

Neither `gpt-4o` nor `gpt-4o-mini` is deprecated; both remain real, callable
OpenAI models. No migration was made or is recommended by default — see
"Model suitability" below for the one nuanced exception.

### Model suitability assessment

- **KEEP AS IS**: `gpt-4o` for every conversational agent — a real,
  currently-supported model appropriate for tool-calling, customer-facing
  conversation. `gpt-4o-mini` for Executive Briefing/Command Center Q&A — a
  cheaper model correctly matched to a short, structured, low-stakes
  summarization task; upgrading it would only add cost with no clear
  product need.
- **RECOMMENDED LATER (not required)**: newer model families exist in the
  installed SDK's own type definitions (gpt-4.1/gpt-5.x). None of the
  current models are deprecated or unsupported, so this is not a required
  fix — only worth an explicit, deliberate product decision later (e.g. if
  gpt-4o is ever deprecated by OpenAI, or a specific quality/cost problem
  is observed in production).
- **REQUIRED FIX**: none. No unsupported/deprecated model, no realtime-
  model incompatibility, and no clear cost/performance mismatch was found.

## Environment variables

| Variable | Required? | Purpose |
|---|---|---|
| `OPENAI_API_KEY` | **Required** wherever any AI feature runs | Read implicitly by `@ai-sdk/openai`'s default `openai()` factory from `process.env.OPENAI_API_KEY` — never passed explicitly in code, never logged, never exposed to `NEXT_PUBLIC_*`. |
| `OPENAI_REALTIME_MODEL` | Optional | Overrides the Realtime voice model (default `gpt-realtime`). |
| `OPENAI_REALTIME_VOICE` | Optional | Overrides the Realtime voice (default `alloy`). |
| `AI_DEFAULT_CHAT_MODEL` | Optional (new, this pass) | Overrides `DEFAULT_CHAT_MODEL_ID` without a code change. |
| `AI_EXECUTIVE_MODEL` | Optional (new, this pass) | Overrides `EXECUTIVE_MODEL_ID` without a code change. |

### Environment readiness (verified via `vercel env ls` — metadata only, no
values printed or retrieved)

| Environment | `OPENAI_API_KEY` | Notes |
|---|---|---|
| Local development | Present (`.env.development.local`, developer's own file, not committed) | This is **why** `next start` (production-mode) local testing in the prior stability-audit task showed Executive Briefing degrading — `.env.development.local` is a dev-only file Next.js does not load in production mode. Not a real gap; a local test-methodology artifact. |
| Preview (all branches, including this one) | **Present** — type `Config` | Confirmed present for the general "Preview" scope, which covers this branch's own preview deployments and the `staging` branch (no branch-specific override exists for this variable, so the general Preview value applies). |
| Production | **Present** — type `Secret` | Confirmed present. |

**No Vercel configuration change is required.** Both Preview and Production
already have a real `OPENAI_API_KEY` configured.

**One minor, optional recommendation** (not a blocker, not fixed by this
pass — changing an existing env var's type requires re-entering its real
value, which this pass correctly never has access to): the Preview
`OPENAI_API_KEY` is stored as Vercel type `Config` while the Production one
is type `Secret`. Both are stored securely either way; for consistency the
account owner may want to convert the Preview one to `Secret` via the
Vercel dashboard at their convenience.

**Live smoke test finding** (see "Production checklist" below): the key
actually present in this session's local `.env.development.local` reached
OpenAI successfully but returned `insufficient_quota` ("You have no
credits remaining") — a real, external, account-level condition, not a
configuration or code problem. This says nothing about the Preview/
Production keys' own quota, which this pass has no way to check without
making a real call against them (explicitly out of scope — no live calls
against Preview/Production were made).

## Credentials never reach the browser

Verified two ways:

1. **Static, whole-app guard** (`tests/client-bundle-no-openai-key-exposure.test.mjs`):
   walks the real import graph of every `"use client"` file anywhere under
   `app/` and confirms none can transitively reach `@ai-sdk/openai`,
   `process.env.OPENAI_API_KEY`, or `process.env.OPENAI_REALTIME_*`. A
   positive control (checking the walker actually flags the known OpenAI-
   touching files) proves this isn't a trivially-passing check.
2. **No `NEXT_PUBLIC_*` variable name contains OPENAI anywhere in the
   repo**, and the public widget script (`public/kuba/chat.js`, served
   as-is to every website visitor) contains no reference to OpenAI or any
   API key string.

Every Mastra agent file and every `generateText()` call site is imported
only from server-side files (`app/api/**/route.ts`, `lib/automations/
engine.ts`, `lib/communications/ai-agent-registry.ts`) — confirmed by
direct grep of every importer, not just the client-bundle walker.

## AI employee architecture

All five implemented employee types share one authorization pattern:

1. The API route (`app/api/ai/{receptionist,sales,customer-support,
   general-manager,outreach}/route.ts`) resolves the **currently selected**
   business via `getCurrentMembership()` (the canonical, cookie-aware
   resolver) and the specific active `aiEmployees` row for that business.
2. The route constructs a Mastra `RequestContext` with exactly two values —
   `businessId` and `employeeId` — both resolved server-side from
   authenticated/tenant-verified state, **never** from the model's own
   output or the request body's free-text fields.
3. Every tool (`mastra/tools/*.ts`) reads `businessId`/`employeeId`
   exclusively via `requireBusinessId(requestContext)` /
   `requireEmployeeId(requestContext)` (`mastra/tools/business-context.ts`)
   — the tool's own Zod input schema has **no `businessId` field at all**,
   so there is no parameter for a prompt-injected message to even attempt
   to override.
4. Every tool that reads or writes real data calls
   `checkAIEmployeeAuthority({ businessId, employeeId, action })`
   (`lib/ai/authority.ts`) before doing anything. This single decision
   engine checks, in order: the employee genuinely belongs to `businessId`
   (tenant ownership — an employee ID from another business is denied, not
   silently rescoped), the employee is `active`, the business is entitled
   to the action's capability (where one applies), and the employee's own
   stored autonomy policy (`assistant`/`operator`/`autonomous`) for that
   specific action (`denied` / `allowed` / `requires_approval`). Every
   denial, approval request, and allowed write/communication is
   audit-logged (`createAuditLog`); routine allowed reads are not, to avoid
   flooding the log.
5. **External communication (WhatsApp/SMS/email) can never be `allowed`**,
   at any autonomy level, for any employee — `COMMUNICATION_FLOOR =
   "requires_approval"` is a hard floor enforced in code
   (`lib/ai/authority.ts`), not just prompt text. The corresponding tools
   (`sales-external-action.ts`) only ever file a pending approval row; they
   contain no code path that can send a message directly.

This architecture (already in place before this audit, not built by it) is
covered by 42 existing, passing tests in `tests/ai-employee-authority.test.mjs`,
including the exact multi-business-isolation property this audit's Phase 24
asked for: *"an employee that belongs to a different business is denied,
not silently scoped to the wrong tenant"* and *"requestContext, not tool
input, decides which business a write lands in — the tool schema has no
businessId field."*

### Per-employee summary

| Employee | Model | Tools | Write capability | Notes |
|---|---|---|---|---|
| **Receptionist** | `gpt-4o` | getBusinessKnowledge, findCustomer, createCustomer, createLead, getAppointments, createAppointment, updateAppointment | Yes, policy-gated | Primary path for Website Widget visitors. Instructions explicitly require calling `getBusinessKnowledge` before any business-specific answer and forbid inventing information. |
| **Sales** | `gpt-4o` | getLeads, createLead, updateLead, createFollowUp, getFollowUps, completeFollowUp, createSalesActivity, salesPipelineSummary, prioritizeLeads, getFollowUpContext, getTodaySalesPlan, getBusinessKnowledge, salesWorkPlan, salesExternalAction, createAppointment | Yes, policy-gated | `salesExternalAction` only ever files an approval request (see hard communication floor above) — no direct send path exists. Has its own Mastra `Memory` (LibSQL-backed), threaded per `(user, business)`. |
| **Customer Support** | `gpt-4o` | getBusinessKnowledge, findCustomer, createCustomer, getSupportTickets, createSupportTicket, requestTicketEscalation | Yes, policy-gated | Escalation is a tool call (`requestTicketEscalation`), not the model unilaterally claiming a human was contacted. |
| **General Manager** | `gpt-4o` | getBusinessKnowledge **only** | **Read-only** | No write tool exists at all — satisfies "no unrestricted super-tool" directly. Can recommend actions in text; cannot execute any of them. |
| **Outreach** | `gpt-4o` | getBusinessKnowledge, saveOutreachProspect/Evidence/Contact, getOutreachProspects, qualifyOutreachProspect, promoteOutreachProspectToSales, createCampaignDraft, addResearchedContactsToCampaign, proposeSequenceStep, summarizeCampaign, inspectCampaignPerformance, `openai.tools.webSearch()`, safeOutreachWebFetchTool | Yes, policy-gated | No send/dispatch tool exists — `createCampaignDraft` only ever creates a draft. Real sending is a separate, deterministic, DB-backed send-worker system entirely outside the model's control (see `docs/CURRENT_STATE.md`'s Campaign Engine section) — the model cannot make an external send happen just by generating text. |
| **Outreach Researcher** (internal, autonomous-research mode only) | `gpt-4o` | getBusinessKnowledge, safeOutreachWebFetchTool, `openai.tools.webSearch()` | No | Runs inside `runOutreachResearchPipeline()`, which has its own real cost/token/tool-call structured logging already (`mastra/workflows/outreach-research-pipeline.ts`) — the one place in this codebase with usage observability *before* this audit. |

### Memory

Sales, Customer Support, General Manager, and Outreach each configure a
Mastra `memory: { resource: session.user.id, thread: "<feature>-<business
or employee id>" }` — i.e. conversation memory is scoped to the
**authenticated staff member using the tool**, per business/employee
thread, not to an anonymous website visitor. The Receptionist (used by the
public Website Widget) does not configure `memory` at all — each visitor
turn is a fresh `.generate()` call with the conversation history passed
explicitly in the prompt from the `messages` table (already business-
scoped there). No new memory architecture was built or changed by this
pass.

## Executive Briefing

`GET /api/command-center/briefing` — a `generateText()` call (not a Mastra
agent) using `EXECUTIVE_MODEL_ID` (`gpt-4o-mini`). Prompt input is **counts
only** (`employees.length`, `sales.length`, `customerList.length`,
`followUpList.length`) — no raw customer/lead content is sent to OpenAI for
this feature. No caching exists (every dashboard load that reaches this
route triggers a fresh generation) — acceptable given the light model and
low request volume, but worth revisiting if usage volume grows (see
Deferred recommendations).

**Hardened by this pass**:
- Uses the centralized `executiveModel()` instead of an inline literal.
- Wrapped in `withAIUsageLogging` (structured `kuba_ai_usage` log line —
  businessId, model, duration, outcome, error category).
- Wrapped in `withBoundedRetry` — exactly one retry, only for genuinely
  transient categories (`timeout`, `provider_error`).
- A 20-second `AbortSignal.timeout` bounds worst-case latency (previously
  unbounded — a hung request could have run indefinitely).
- The catch block now returns `classifyAIProviderError(error)` as a `code`
  field and a matching safe message, instead of one hardcoded generic
  string for every failure type — still never exposes raw provider detail.

**Why the "missing key" degradation was seen before**: this was a **local
test-environment artifact**, not a real gap — see "Environment readiness"
above. Real Preview/Production both have `OPENAI_API_KEY` configured.

## Business Brain / knowledge grounding

`lib/knowledge/search.ts`'s `searchKnowledge(businessId, query, limit,
employeeId?)` is word/token-based (SQL query over `knowledgeChunks`/
`knowledgeSources`, filtered by `canUseKnowledgeSource`), **not** an OpenAI
embeddings call. Every call site passes `businessId` resolved from trusted
server-side state (the integration's own resolved business for Website
Widget, `getCurrentMembership()` for authenticated routes) — never a
model- or request-supplied value. No embedding model, no vector store, and
no cross-business leakage path were found. (Phase 15 of this audit: no
embeddings are used anywhere in this codebase.)

## Realtime / voice

`lib/voice/adapters/openai-realtime.ts` opens a **server-to-OpenAI**
WebSocket (`wss://api.openai.com/v1/realtime`), authenticating via the
`openai-insecure-api-key.<key>` WebSocket subprotocol — OpenAI's documented
mechanism for a *server* (not a browser) to authenticate a realtime
WebSocket without custom headers (which the browser `WebSocket` API
doesn't support). This function is only ever invoked from server API
routes (`app/api/voice/calls/route.ts`, `app/api/ai-employees/[id]/voice/
route.ts`, `app/api/settings/voice-providers/route.ts`) — confirmed via
grep and the client-bundle graph walker. **No browser code anywhere in
this app opens a WebSocket to OpenAI directly, and no ephemeral or
permanent OpenAI credential is ever sent to a browser.**

Real telephony (Twilio Media Streams) and this Realtime adapter are wired
together for phone-based voice calls. The dashboard's own "Voice Testing"
/ Simulator pages are **text-only** simulations (`POST /api/workforce/
simulator` with a `voiceMode: true` flag) — no real audio capture, no
`getUserMedia`, no browser WebSocket. **State: the OpenAI Realtime
transport itself is implemented and configured (given `OPENAI_API_KEY`);
telephony connection was explicitly out of scope for this pass and remains
untouched.**

Already-documented, unrelated-to-this-pass limitation (from the prior
stability audit, unchanged): the transport keeps active sessions in
in-process `Map<callId, WebSocket>` memory, which will not survive across
separate serverless invocations — fine for a single warm instance, not yet
production-grade for real concurrent call volume.

## Website Widget AI path

Full path: public visitor → tenant public key → (new, prior task) server-
side domain validation → resolved business/integration → active
Receptionist lookup (404 "Kuba Receptionist is not active" if none,
never silently pretending readiness) → `searchKnowledge(business.id, ...)`
→ `selectedAgent.generate()` with `RequestContext([businessId, employeeId])`
→ response persisted to `messages`/`conversations` (business-scoped) →
JSON response to the visitor.

**Hardened by this pass**: the generate call is now wrapped in
`withAIUsageLogging`, and the outer catch block's `failureType` now
prefers `classifyAIProviderError(error)` over the pre-existing
`classifyWebsiteChatError` (a database-error-pattern classifier) when the
failure is genuinely an AI-provider issue — previously any OpenAI failure
(missing key, rate limit, quota) fell into the same generic
`"database_or_provider_error"` bucket as an actual database error. The
visitor-facing response was already safe before this change (`"error":
"Unable to respond."`, no raw provider detail) and remains exactly as safe
now — this only improves the *internal* `failureType` precision.

## Timeouts, retries, and rate-limit/quota handling

New in this pass, `lib/ai/`:

- **`provider-error.ts`** — `classifyAIProviderError(error)` maps any
  caught error to one of `missing_api_key | invalid_api_key | rate_limited
  | insufficient_quota | timeout | provider_error | unknown`, using the AI
  SDK's own `LoadAPIKeyError`/`APICallError` classes (`statusCode`,
  `responseBody`) — a 429 is further split into `rate_limited` vs.
  `insufficient_quota` by inspecting the response body's error code, since
  OpenAI uses the same HTTP status for both. `safeAIErrorMessage(category)`
  returns a customer-safe message with no provider name or status code.
- **`retry.ts`** — `withBoundedRetry(fn)` retries **at most once**, and
  only for `timeout`/`provider_error` (genuinely transient) — never for
  `missing_api_key`/`invalid_api_key`/`rate_limited`/`insufficient_quota`,
  since retrying those spends a second call on a guaranteed-identical
  failure. No exponential backoff machinery — one short fixed delay.
- **`usage-logging.ts`** — `withAIUsageLogging(entry, fn)` times the call,
  logs one structured `kuba_ai_usage` JSON line (feature, businessId,
  employeeId, model, durationMs, outcome, errorCategory on failure) on
  success or failure, and re-throws the original error unchanged so
  route-specific handling is unaffected.

Applied to all five direct AI employee routes, the Website Widget's public
POST handler, and Executive Briefing/Command Center Q&A — every OpenAI
call site in the application now has consistent timeout/retry/
classification/logging behavior. (The Outreach Researcher's autonomous-
research pipeline already had its own equivalent structured logging with
real per-run cost estimation, built before this pass — left as-is, not
duplicated.)

**Live-validated, not just unit-tested**: this session ran a real smoke
test against a locally-available non-production OpenAI key
(`.env.development.local`). The key reached OpenAI successfully but the
associated account had zero credits (`insufficient_quota` — a real,
external, account-level condition). Every one of the 6 tested call sites
(Receptionist via Website Widget, Sales, Customer Support, General
Manager, Outreach, Executive Briefing) failed safely: the client received
only a safe, generic message; the server console recorded the correct
`errorCategory` via the new structured `kuba_ai_usage` log line in every
case; and Executive Briefing's new bounded retry visibly fired (~40s total
= two ~20s timeout attempts), then failed cleanly rather than hanging
indefinitely — the exact behavior this pass added `AbortSignal.timeout`
and `withBoundedRetry` to guarantee. See `docs/CURRENT_STATE.md` for the
dated record of this run.

## Usage/cost observability

Minimal, structured, console-only (no new database table, no billing UI) —
matching the instruction not to build a large observability system. Every
`kuba_ai_usage` log line carries `feature`, `businessId`, `employeeId`,
`model`, `durationMs`, `outcome`, and `errorCategory` on failure. Never
includes prompt text, message content, or the model's response text.

The Outreach Researcher's pre-existing, separate structured logging
(`kuba_outreach_research_run`) additionally estimates a real dollar cost
from provider-reported token counts — left as its own, more detailed
system since it already existed and already did more than the minimal bar
this pass targets for the other five call sites.

**Also found and fixed** (Phase 21/20 — "never log full sensitive
prompts/responses"): `app/api/ai/receptionist/route.ts` previously logged
the AI's **full response text** to the console on every request
(`console.log("KUBA RECEPTIONIST AI RESPONSE GENERATED", { textLength,
text: result.text })`). Fixed to log only the length. **Separately
observed, not fixed in this pass** (out of this audit's OpenAI-specific
scope — it's about customer PII, not AI/provider configuration): the same
file logs extracted customer name/email/phone in plaintext at several
points (e.g. "EXTRACTED CUSTOMER INFORMATION", "NEW LEAD CREATED"). Real,
worth cleaning up, but a customer-data-logging-hygiene pass across that
file's many call sites is a distinct piece of work from this OpenAI
runtime audit — flagged here rather than silently left out or silently
rewritten.

## Prompt/instruction safety

Every agent's `instructions` string explicitly frames tool results as
authoritative over the model's own claims (the "SERVER-ENFORCED AUTHORITY"
preamble present in Receptionist/Sales/Customer Support/General Manager),
explicitly forbids inventing business information, customer records,
prices, or completed actions, and explicitly instructs the model to
distinguish CONFIRMED/INFERRED/UNKNOWN information (Outreach) and to treat
externally-retrieved web content as untrusted data that cannot override
platform instructions (Outreach's web-search/fetch tools). No system
prompt is ever echoed back to the user in any response path reviewed. No
mechanism was found that would let ordinary customer/visitor message
content silently override an agent's own instructions — the authority
system (see above) is the actual enforcement boundary regardless of what
the model is told or persuaded to claim in its own text.

## Production readiness checklist

- [x] OpenAI credentials are server-only (statically verified, whole-app).
- [x] Model choices are explicit and centralized (`lib/ai/model-config.ts`).
- [x] Every implemented AI employee resolves and uses the correct,
      currently-selected business context.
- [x] Business Brain remains tenant-scoped (word-based search, businessId
      always server-resolved).
- [x] State-changing tools are server-authorized (`checkAIEmployeeAuthority`,
      tenant ownership + active status + entitlement + autonomy policy).
- [x] Provider errors degrade safely everywhere (no raw provider detail to
      customers; safe categories; existing catches were already safe, now
      also classified).
- [x] Website Widget resolves and uses the correct business's AI employee.
- [x] Realtime never exposes a permanent (or ephemeral) API credential to
      a browser.
- [x] Plan/entitlement gates are enforced server-side inside the authority
      check, not just in the UI.
- [x] No cross-business AI data leakage path found (RequestContext +
      tenant-ownership check on every tool).
- [x] `OPENAI_API_KEY` confirmed present (metadata-only check) in Preview
      and Production.
- [ ] **Owner action, not this pass**: confirm the Preview/Production
      OpenAI account(s) actually have available quota/credits (this pass
      could only verify variable *presence*, and its own live smoke test
      used a different, local-only key that turned out to have none).
- [ ] **Deferred, not required**: convert the Preview `OPENAI_API_KEY`
      from Vercel type `Config` to `Secret` for consistency with
      Production (cosmetic; both are stored securely today).
- [ ] **Deferred, not required**: Executive Briefing has no caching —
      revisit if request volume grows enough for it to matter.
- [ ] **Deferred, not required**: clean up customer-PII console logging in
      `app/api/ai/receptionist/route.ts` (a data-logging-hygiene item, not
      an OpenAI-configuration item).
