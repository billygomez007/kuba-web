# Voice Runtime

Canonical reference for SuperKuba's voice/telephony architecture: Plivo
and Twilio call control, the OpenAI Realtime AI runtime, number/employee
routing, webhook security, call lifecycle, and — most importantly — the
one real infrastructure gap that blocks a live end-to-end AI phone call
today.

**Status distinction used throughout**: **CODE READY** means the
implementation exists, is tested, and will work correctly once the
listed provider/infrastructure dependency is satisfied. **PROVIDER NOT
CONFIGURED** means no code changes are needed, only Plivo dashboard +
Vercel env var setup. **GATEWAY NOT BUILT** means a genuinely new piece
of infrastructure — outside this Next.js app — is required; no amount
of configuration fixes this.

## Bottom line

Outbound call *initiation* and inbound call *routing/webhooks* are CODE
READY for both Plivo and Twilio. **The actual bidirectional AI audio
conversation is GATEWAY NOT BUILT** — this Vercel-deployed Next.js app
has no way to hold a persistent WebSocket audio stream open, and no
dedicated always-on service exists yet to do it instead. A phone call to
a correctly configured number today will ring, resolve the correct
business/employee, and receive an honest spoken message that the call
cannot be completed yet — not a real AI conversation, and not silence.

## Provider

**Plivo** and **Twilio** are both supported behind one shared
`VoiceTransport` interface (`lib/voice/providers.ts`). Neither has an
installed SDK — both talk to their REST APIs via raw `fetch`, matching
this codebase's existing convention (Resend, WhatsApp) of not depending
on a provider SDK. **OpenAI Realtime** (`lib/voice/adapters/
openai-realtime.ts`) is the AI voice runtime both call-control providers
are meant to bridge to.

The exact Plivo webhook payload field names, the V2 signature scheme,
and the `<Stream>` XML verb's attributes below were implemented from
Plivo's documented behavior but **could not be verified against an
installed SDK or a live Plivo account in this environment** — the same
honest caveat this codebase already applies to Resend's inbound email
payload shape (see `docs/EMAIL_RUNTIME.md`, "Provider"). Confirm against
Plivo's current dashboard/docs before depending on any of this for a
real call.

## Credential model

**Platform-managed, not per-business** (`lib/voice/providers.ts`'s
`credentialModel` field): `PLIVO_AUTH_ID`/`PLIVO_AUTH_TOKEN`, `TWILIO_
ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`, and `OPENAI_API_KEY` are all read from
server-side environment variables only — no business ever pastes a
secret for any of these three. This was already true of the actual
call-placing code before this pass, but the Settings UI previously
implied otherwise for Twilio (a business could "save" Twilio credentials
via `/api/settings/voice-providers`, see them show "Connected," while
the real call-placing adapter silently ignored what they saved and used
the platform's own env vars regardless) — fixed by adding the
`credentialModel` field and having the UI/route be honest about it for
all three platform-managed providers.

No `NEXT_PUBLIC_PLIVO_*` variable exists anywhere in this repo (checked
by `tests/plivo-credential-safety.test.mjs`, which also asserts no
client ("use client") file ever references `PLIVO_AUTH_ID`/`PLIVO_AUTH_
TOKEN` or imports the Plivo adapter/signature module).

## Multi-tenant number → business → employee resolution

A phone number **deterministically** resolves to exactly one business
and (optionally) one AI employee via `lib/voice/tenant.ts`'s
`resolveVoiceIntegrationByPhoneNumber(provider, number)` — the voice
equivalent of `lib/channels/whatsapp.ts`'s
`resolveWhatsAppIntegrationByPhoneNumberId`. It queries `integrations`
for a row with `provider = <plivo|twilio>`, `externalPhoneNumberId =
<normalized number>`, `status = "active"`, and `metadata.kind =
"voice_phone"` — never a client-, webhook-, or query-string-supplied
businessId/employeeId. `isPhoneNumberAlreadyRegistered()` in the same
file enforces that a number can never be claimed by two businesses at
once (Phase 7), checked server-side in `POST /api/settings/
phone-numbers` before any row is written.

For a call **SuperKuba itself initiates** (outbound), tenant is instead
recovered from the conversation row created under the original
authenticated, entitlement-checked dashboard request — never re-derived
from the webhook payload. The `employeeId`/`conversationId` query
parameters embedded in the Plivo `answer_url`/`hangup_url` are safe to
trust specifically *because* Plivo's request signature covers the full
URL including that query string — a third party cannot forge a request
against a different id pair without a valid signature for that exact
URL, which requires the platform's own `PLIVO_AUTH_TOKEN`.

## Phone number data model

No new table — numbers are rows in the existing `integrations` table
(`provider`, `externalPhoneNumberId`, `status`, `metadata` JSON:
`{ kind: "voice_phone", employeeId }`), the same pattern already used
for email/WhatsApp integration rows. No schema migration was needed for
this pass.

## Number assignment safety (Phase 7)

`POST /api/settings/phone-numbers` enforces, server-side, in this order,
all before any row is written:
1. The provider exists and is `status: "available"` (a real transport).
2. The number is not already registered to a different business
   (`isPhoneNumberAlreadyRegistered`).
3. If an employee is being assigned: it belongs to the caller's own
   business, is `status: "active"`, already has Voice `enabled` under
   its own Voice settings (`parseVoiceConfig`), and the business holds
   the `ai_workforce.voice` capability.

## Plivo number inventory (Phase 6)

`GET /api/settings/phone-numbers/plivo/available` calls Plivo's real
"list numbers" API (`lib/voice/adapters/plivo.ts`'s `listPlivoNumbers()`)
so an admin picks from numbers the platform's Plivo account genuinely
owns — never a fabricated/typed-blind number for Plivo specifically.
Throws (surfaced as a clear "Plivo is not configured" error, not an
empty list) when `PLIVO_AUTH_ID`/`PLIVO_AUTH_TOKEN` aren't set.

## Inbound call flow

```
caller
  -> dials a business's Plivo number
  -> Plivo POSTs to /api/voice/plivo/answer (answer_url)
  -> Svix-style V2 signature verified over the exact request URL (Phase 9)
  -> tenant resolved from the dialed ("To") number (cold call) or from
     the pre-created conversation (SuperKuba-initiated outbound call)
  -> unmatched number: honest "not configured" <Speak>+<Hangup/>, no
     business data touched
  -> matched: event forwarded to POST /api/voice/calls (VOICE_WEBHOOK_
     SECRET-gated), which creates/reuses the conversation + persists a
     message, exactly like the existing Twilio path
  -> XML response returned to Plivo: <Stream> to the configured media
     gateway if VOICE_GATEWAY_URL is set (see "Media bridge"
     below), otherwise an honest spoken "can't complete this call" +
     hangup — NEVER a <Stream> pointed at a URL that doesn't work
  -> call ends -> Plivo POSTs to /api/voice/plivo/status (hangup_url)
  -> signature verified again; tenant resolved the same way
  -> HangupCauseName classified into completed vs. a safe failure
     category (lib/voice/failure-classification.ts) — a call is never
     called "completed" merely because Plivo accepted the API request
     (Phase 18) or because duration happened to be reported as 0 with an
     unrecognized cause
  -> forwarded to /api/voice/calls, which updates the conversation's
     voice state/duration and persists the final message
```

Identical shape for Twilio (`app/api/voice/twilio/{answer,status}/
route.ts`), which predates this pass; its `answer` route's TwiML
already pointed at a `<Stream>` URL with the same "no backing gateway"
limitation.

## Webhook authentication (Phase 9)

- **Plivo**: `lib/voice/plivo-signature.ts` — HMAC-SHA256 over the exact
  request URL concatenated with a nonce Plivo also sends
  (`X-Plivo-Signature-V2`/`X-Plivo-Signature-V2-Nonce` headers), keyed
  by `PLIVO_AUTH_TOKEN`, compared with `crypto.timingSafeEqual`. Fails
  closed (rejects, `403`) on any missing header, wrong token, or tampered
  URL/query-string — verified by `tests/plivo-signature.test.mjs`,
  including a query-string-tampering case (an attacker who
  intercepts/replays a genuine URL but changes `employeeId` in the query
  string is rejected, since the signature covers the full URL).
- **Twilio**: `lib/voice/twilio-signature.ts` (pre-existing) — HMAC-SHA1
  over the URL + sorted POST params, keyed by `TWILIO_AUTH_TOKEN`.
- Both verify the signature **before** parsing the payload for business
  logic and before any database write.

## Call-control / XML (Phase 10)

`lib/voice/plivo-xml.ts` generates exactly two possible Plivo XML
responses, isolated from the route so it's unit-testable without an HTTP
request:
- `buildStreamResponse(url)` — `<Response><Stream bidirectional="true"
  audioTrack="both" contentType="audio/x-l16;rate=8000">wss://...
  </Stream></Response>`, used only when `VOICE_GATEWAY_URL` is
  configured (true in zero environments today).
- `buildUnavailableResponse(message)` — `<Response><Speak>...</Speak>
  <Hangup/></Response>`, the honest default. No XML verb here was
  invented — both are real, documented Plivo call-control elements — but
  the `<Stream>` element's exact attribute set could not be verified
  against a live call in this environment (see "Provider" above).

## Media bridge — now built (a separate repo), not deployed

**Update**: the dedicated Voice Gateway this section used to describe as
future work is now built — `billygomez007/superkuba-voice-gateway`
(prepared locally at this time; not yet pushed to GitHub or deployed).
This Next.js app still cannot hold a persistent, bidirectional WebSocket
audio connection itself — that has not changed, and is still confirmed
directly from this repo's own deployment configuration (`vercel.json`
has no `functions`/`maxDuration` override; no custom server or WebSocket
server implementation exists anywhere in this codebase). What changed is
that the separate service which *can* now exists, is tested end-to-end
against mocked Plivo/OpenAI/kuba-web boundaries, and is container-ready.

```
Plivo <Stream> (bidirectional audio, µ-law over WebSocket)
   ↕
SuperKuba Voice Gateway (separate repo/service — see its docs/VOICE_GATEWAY.md)
   ↕
OpenAI Realtime (wss://api.openai.com/v1/realtime)

Voice Gateway → kuba-web: app/api/internal/voice/{session-context,call-events,tool-call}
  (shared-secret + signed-session-token authenticated, never public)
```

**What this app (kuba-web) now provides for the gateway, added this
pass**:
- `lib/voice/gateway-session.ts` — signs the short-lived session-
  bootstrap token (`createVoiceSessionToken`) minted in
  `app/api/voice/plivo/answer/route.ts` once business/employee are
  resolved, and independently re-verifies it (`verifyVoiceSessionToken`)
  when the gateway calls back in — defense in depth; the gateway already
  verified the same token once to accept the WebSocket, but kuba-web
  never trusts the gateway's word for whose session it is.
- `app/api/internal/voice/session-context/route.ts` — returns the
  business name, tenant-scoped system instructions (assembled from the
  employee's real settings via `getBaseRoleInstructions`, never leaking
  the VoiceConfig JSON blob appended to the same stored field), and a
  deliberately minimal tool allowlist (`lib/voice/voice-tools.ts` —
  currently just `get_business_knowledge`).
- `app/api/internal/voice/call-events/route.ts` — delegates to the exact
  same `persistEvent` (now extracted to `lib/voice/persist-event.ts`)
  the Plivo/Twilio webhook routes already use, so there is one
  persistence/idempotency path regardless of which surface reports an
  event.
- `app/api/internal/voice/tool-call/route.ts` — the only place a
  gateway-forwarded tool call can execute anything, gated by the exact
  same `checkAIEmployeeAuthority()` every other AI tool call in this
  codebase uses (including its `requires_approval` outcome — a voice
  conversation bypasses nothing).
- `lib/voice/plivo-xml.ts`'s `buildAnswerResponse()` now takes the
  signed session token and (for a real destination) the caller's
  phone number, and embeds the phone number via Plivo's own
  `<Parameter>` mechanism rather than the WebSocket URL/query string.

**What still hasn't happened**: the gateway service has not been pushed
to a remote repository, has not been deployed anywhere, and no real
Plivo/OpenAI credentials have touched it. `VOICE_GATEWAY_URL` is unset
in every kuba-web environment today, so `buildAnswerResponse()` still
returns the honest fallback message — nothing about a real call's
behavior changes until an operator deploys the gateway and sets that
variable.

## Audio format (Phase 13)

`lib/voice/adapters/openai-realtime.ts` configures OpenAI Realtime
sessions for `g711_ulaw` input/output — the same codec Plivo (and
Twilio) natively stream. `lib/voice/plivo-xml.ts`'s `buildStreamResponse`
now requests `audio/x-mulaw;rate=8000` from Plivo (reconciled from an
earlier version of this file, which requested L16 PCM and would have
needed a real transcoder) — matching this exactly, so the gateway's own
`src/audio-codec.ts` is pass-through by design rather than a real
transcoder. This reconciliation is implemented from Plivo's documented
behavior, not verified against a live account — confirm it before going
live (see the gateway's own `docs/VOICE_GATEWAY.md` for the same
caveat, stated once rather than duplicated at length here).

## Business Brain grounding

**Update**: the raw audio path now has Business Brain access too, not
just the text-relay path. The Voice Gateway's `session.update` includes
a `tools` array built from kuba-web's `/api/internal/voice/session-
context` response (`lib/voice/voice-tools.ts`) — `get_business_knowledge`,
wrapping the exact same Mastra tool
(`mastra/tools/get-business-knowledge.ts`) the text-relay path's agents
already use, unmodified, plus (new) `request_handoff` for
Receptionist/Sales/Customer Support/Appointment employees — see
"Orchestration on voice calls" below. Both paths therefore share one
tenant-scoped grounding mechanism, not two.

## Orchestration on voice calls (connects to commit 46de021's text-channel orchestration)

**New**: `request_handoff` is now a voice-allowlisted tool
(`lib/voice/voice-tools.ts`), available only to Receptionist, Sales,
Customer Support, and Appointment voice employees — the same four the
canonical channel policy (`lib/communications/channel-policy.ts`) marks
voice-eligible. It reuses the EXACT SAME resolution/persistence core the
text-channel handoff tool uses (`lib/communications/handoff.ts`'s
`performAiHandoff`/`performHumanEscalation`) — no parallel voice-specific
handoff logic exists. The model supplies only `{intent, reason}`; the
`conversationId` it acts on comes from the session token's own claims
(see below), never from the model or the gateway.

**`VoiceSessionClaims` gained an optional `conversationId` field** this
pass (`lib/voice/gateway-session.ts`, mirrored for type parity in the
gateway's own `src/session-token.ts` — the gateway does not read or act on
it itself, it only ever forwards the raw token string back to kuba-web
unchanged). `app/api/voice/plivo/answer/route.ts`'s previously
fire-and-forget call to `/api/voice/calls` is now awaited so it can
capture the real `conversations.id` `persistEvent` resolves/creates and
include it when minting the session token. An outbound call already had
its conversation id from the query string and uses that directly. A
token minted before a conversation could be resolved simply omits the
field — `request_handoff` then fails honestly ("no trackable
conversation") rather than guessing one.

**AI-role transfer within the same call**: since there is no live
provider-level call transfer implemented (see "Human handoff" below —
unchanged, still gateway-transfer-not-built), a "Receptionist → Sales"
voice handoff does not move the caller to a different phone leg or
gateway session. It reassigns `conversationRouting`/`conversations` to
the new employee (exactly like the text-channel handoff), and the SAME
live OpenAI Realtime session continues — the model's own next turn is
expected to acknowledge the change in role via its own reasoning using
the updated `session-context` the gateway can re-fetch, since this pass
does not force a mid-call `session.update` re-configuration. Concretely:
today's behavior is "the record of who owns this conversation changes
correctly and immediately," not "the AI's voice/personality mid-call
changes." Making the live Realtime session itself re-configure
instructions/voice mid-call (a `session.update` from the gateway,
triggered by the tool result) is a distinct, un-built future enhancement
— documented here as a known gap, not silently assumed to work.

**`request_handoff`'s `requires_approval` outcome now files a real
approval** (`app/api/internal/voice/tool-call/route.ts`) — previously
(and still, for any other tool this codebase gates the same way) a
voice tool call blocked by `requires_approval` returned an honest refusal
message but never called `fileActionApproval()`, so no record existed for
a human to later act on. Fixed generically in the internal route (not
special-cased to this one tool), matching every text-channel tool's own
convention.

The **text-relay** voice path (`app/api/voice/calls/route.ts`'s `"turn"`
action — speech-to-text happens client-side today in Voice Testing,
server-side in a future real integration) calls the real Mastra agent
(`agent.generate()`) directly, which has a richer tool set than the
gateway's deliberately minimal allowlist. Widening the raw-audio path's
allowlist to match is a distinct future decision requiring a safety
review per additional tool, not something this pass defaults to.

## AI tool safety (Phase 25)

Every Mastra tool independently re-verifies business/employee/permission/
plan/autonomy from its own `RequestContext` — a voice conversation
grants no additional trust. This was already true before this pass and
is unchanged by it. **New this pass**: `app/api/internal/voice/
tool-call/route.ts` is the only place a gateway-forwarded Realtime tool
call can reach that machinery — it re-checks the caller is the gateway
(shared secret), re-verifies the session token, confirms the requested
tool is in the allowlist for this employee's type, and only then calls
`checkAIEmployeeAuthority()` before executing. The Voice Gateway itself
holds zero authority — it forwards whatever kuba-web decides, unmodified,
back to OpenAI as the tool's output, including a `requires_approval`
refusal.

## Sales / Support call architecture (Phases 15-16)

Outbound calling for Sales/Support flows through the exact same `POST
/api/voice/calls` `"outbound"` action Receptionist uses — no
per-employee-type call path. It already required (pre-existing):
authenticated session + `workforce.manage` permission, the target
employee belongs to the caller's business and has Voice `enabled` with
`callDirection` allowing outbound, and the business plan includes
`"voice"`. This pass added the one missing check: the employee's own
configured `maxDailyCalls` limit (see "Rate/cost safety" below) — the
model cannot bypass any of this; the AI employee agents never call
`transport.startCall` directly, only a human-triggered, permission-
checked dashboard action does.

## Call state machine (Phase 18)

States a call's underlying `conversations` row can hold via `lib/voice/
session-manager.ts`'s `updateVoiceSession`: `ringing`, `connecting`,
`active`, `waiting`, `transferred`, `completed`, `failed`. Plivo hangup
causes are classified into completed-vs-failed by `lib/voice/
failure-classification.ts`'s `classifyPlivoHangup` — a call is never
"completed" merely because the provider accepted the API request; a
zero-duration call with an unrecognized hangup cause is `UNKNOWN`
failure, not silently "completed."

## Idempotency (Phase 37)

`persistEvent` (`app/api/voice/calls/route.ts`) dedupes on `providerCallId
:eventType`, not `providerCallId` alone (a call's ringing and completed
events legitimately share one `providerCallId` and must both be
recorded; only a *redelivery of the same* event is a duplicate) — **a
real gap found and fixed this pass**, verified by
`tests/voice-plivo-webhook-integration.test.mjs`'s redelivery test. The
conversation upsert itself was already idempotent (insert-if-absent,
update-if-present, keyed by `externalConversationId`).

**A second, related bug found and fixed this pass**: an outbound call's
conversation row was created with a *placeholder* `externalConversationId`
(`pending-<uuid>`) that was never reconciled to the provider's real call
id — meaning the later status webhook's lookup-by-`externalConversationId`
never matched, silently creating a **second, orphaned conversation** for
every single outbound call, for both Twilio and Plivo. Fixed by
reconciling immediately after `transport.startCall()` returns.

**Plivo-specific nuance**: Plivo's outbound Call API returns a
`request_uuid` synchronously, not the definitive `CallUUID` used in
later callbacks (unlike Twilio, whose Call API returns the definitive
SID immediately) — `lib/voice/adapters/plivo.ts`'s `startCall` returns
`request_uuid` as a provisional id, and `app/api/voice/plivo/answer/
route.ts` reconciles it to the real `CallUUID` the moment that first
callback arrives.

## A pre-existing Twilio bug fixed alongside this work

`app/api/voice/twilio/status/route.ts` previously read `form.get(
"BusinessId")`/`form.get("EmployeeId")` as if Twilio would forward
those as custom form fields — **Twilio never does this** without
explicit `<Parameter>`/custom-parameter configuration this codebase
never sets, so that status callback's tenant resolution was silently
broken (every real Twilio status event would 400/404 or resolve
nothing). Fixed to use the same `resolveVoiceIntegrationByPhoneNumber`/
conversation-recovery pattern Plivo's equivalent route uses.

## Failure classification (Phase 28)

`lib/voice/failure-classification.ts` — a fixed vocabulary (`PLIVO_AUTH_
ERROR`, `NUMBER_NOT_CONFIGURED`, `INVALID_DESTINATION`, `CALL_REJECTED`,
`BUSY`, `NO_ANSWER`, `PROVIDER_ERROR`, `OPENAI_ERROR`, `STREAM_ERROR`,
`TIMEOUT`, `UNKNOWN`). `safeVoiceFailureMessage()` returns only a fixed,
safe string per category — never a raw Plivo/Twilio/OpenAI error
message or response body. Stored in `messages.metadata` (the same
generic JSON column the email pipeline already uses), never in a
customer-visible surface as raw text.

## Retries (Phase 29)

No automatic redial exists anywhere in this codebase — outbound calling
is exclusively a single, human-triggered dashboard action. Provider
webhook retries are handled by the idempotency fix above, not by
application-level retry logic.

## Rate / cost safety (Phase 39)

**Found and fixed a real gap**: each employee's `maxDailyCalls` (Voice
settings) was stored but never enforced anywhere. `lib/voice/
rate-limits.ts`'s `countTodaysOutboundCalls()` now gates the outbound
action — a technical safety limit, not a new commercial quota (no plan/
billing logic was touched). `maxCallDurationMinutes` remains
**unenforced** — there is no live call session to cut off mid-stream
until the media gateway exists; documented here as deferred, not
silently assumed to work. No concurrent-call limit exists; not added
this pass (would need call-in-progress tracking this codebase doesn't
have yet for voice).

## Recording (Phase 22)

**Not implemented, and deliberately left off.** No code path requests
or stores a Plivo recording. `conversations.voiceRecordingUrl` exists in
the schema (pre-existing) but nothing writes it. Recording has real
legal/privacy/consent implications specific to each jurisdiction —
correctly deferred as a future, explicitly-configured, consent-gated
feature, not built speculatively here.

## Human handoff (Phase 26)

The existing escalation mechanism (`handoffs` table, `conversations.
status = "escalated"`, already wired into `app/api/workforce/
live-calls/route.ts`'s "transfer"/"end" actions) is the real, working
escalation state — unchanged by this pass. A live mid-call Plivo
`<Dial>`-based transfer to a human phone line was **not built**: it
depends on the same media-bridge gateway (Phase 42) to have a live call
leg to transfer in the first place. No fake "Transfer" button exists;
the existing dashboard action updates state honestly without claiming
to move real audio.

## Transcription (Phase 21)

Not implemented for raw audio calls (no transcription source exists
without the gateway). The text-relay path's `persistTurn` already stores
both sides of a text-based voice turn as ordinary `messages` rows,
business/call/customer-scoped like every other message — this is real,
tested, pre-existing behavior, not new. No code path logs a full
transcript to the server console.

## Conversations/Inbox integration (Phase 20)

No second/disconnected call database — voice calls are `conversations`
rows (`integrationId: "voice-runtime"`) with dedicated voice columns
(`voiceProvider`, `voiceDirection`, `voiceStartedAt/ConnectedAt/EndedAt`,
`voiceDurationSeconds`, `voiceBillableMinutes`), and call events are
ordinary `messages` rows (`messageType: "voice"`). `app/api/workforce/
live-calls/route.ts` and the Inbox both already read this generically —
confirmed provider-agnostic (no Twilio/Plivo-specific branching), so
Plivo calls surface there automatically with no UI change required.

## Customer matching (Phase 23)

Inbound calls normalize the caller's number (`lib/voice/phone.ts`'s
`normalizePhoneNumber` — the same best-effort E.164-shaping approach
already used for outreach suppression matching) and look up an existing
`customers` row by `(businessId, phone)` before creating a new one —
pre-existing, unchanged behavior, now also exercised by Plivo's flow.

## Environment variables

| Variable | Classification | Purpose |
|---|---|---|
| `PLIVO_AUTH_ID` | PLIVO_REQUIRED | Plivo REST API authentication (platform-wide) |
| `PLIVO_AUTH_TOKEN` | PLIVO_REQUIRED | Plivo REST API auth + webhook signature verification key |
| `PLIVO_VOICE_NUMBER` | PLIVO_REQUIRED (for outbound) | The `from` number used when placing outbound Plivo calls |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_VOICE_NUMBER` | CORE (pre-existing) | Twilio's equivalent |
| `OPENAI_API_KEY` | CORE_REQUIRED | OpenAI Realtime session auth |
| `OPENAI_REALTIME_MODEL` / `OPENAI_REALTIME_VOICE` | OPTIONAL | Realtime model/voice override (pre-existing) |
| `VOICE_CREDENTIALS_KEY` | CORE_REQUIRED | AES-256-GCM key encrypting any business-managed provider secret (pre-existing) |
| `VOICE_WEBHOOK_SECRET` | CORE_REQUIRED | Shared secret gating the internal `/api/voice/calls` endpoint |
| `PUBLIC_APP_URL` | CORE_REQUIRED | Base URL used to build Plivo/Twilio callback URLs |
| `VOICE_GATEWAY_URL` | OPTIONAL (unset in every environment today) | The dedicated media-gateway's base URL (kuba-web converts to wss:// itself) — see "Media bridge" |
| `VOICE_GATEWAY_SESSION_SECRET` | REQUIRED once the gateway is deployed | Signs the short-lived session-bootstrap token; must exactly match the gateway's copy |
| `VOICE_GATEWAY_INTERNAL_SECRET` | REQUIRED once the gateway is deployed | Authenticates the gateway's calls into `/api/internal/voice/*`; must exactly match the gateway's copy |

No values were printed or read for reporting purposes by this pass.

## Production activation checklist (manual, owner-performed)

Nothing below has been done by this code change; nothing here makes
real calls happen.

1. In the **Plivo dashboard**, find your **Auth ID** and **Auth Token**
   under Account → API/Auth credentials.
2. Under **Phone Numbers**, confirm your existing purchased number's
   **capabilities** include Voice (click the number to check).
3. Create a **Plivo Application** (Voice → Applications → Add New
   Application):
   - **Answer URL**: `https://<your-production-domain>/api/voice/plivo/answer`
   - **Answer Method**: `POST`
   - **Hangup URL**: `https://<your-production-domain>/api/voice/plivo/status`
   - **Hangup Method**: `POST`
   - Leave any "Fallback"/recording options at their defaults unless you
     have a specific reason to change them (recording stays off by
     default — see "Recording" above).
4. Under **Phone Numbers**, assign your existing number to that
   Application.
5. In Vercel, set `PLIVO_AUTH_ID`, `PLIVO_AUTH_TOKEN`, `PLIVO_VOICE_
   NUMBER` (your Plivo number, E.164), and confirm `VOICE_WEBHOOK_
   SECRET`/`PUBLIC_APP_URL` are already set. **A redeploy is required**
   for new env vars to take effect.
6. In SuperKuba, under Phone Numbers, assign that number to a
   Receptionist/Sales/Support AI employee that already has Voice enabled
   under its own Voice settings.
7. **Separately**, deploy the Voice Gateway (`billygomez007/
   superkuba-voice-gateway` — prepared locally, not yet pushed/deployed;
   see its own `docs/VOICE_GATEWAY.md`) somewhere that supports long-
   lived WebSockets, then set `VOICE_GATEWAY_URL` (the gateway's public
   HTTPS URL), `VOICE_GATEWAY_SESSION_SECRET`, and `VOICE_GATEWAY_
   INTERNAL_SECRET` in Vercel — the two secrets must exactly match the
   values set on the gateway itself. Redeploy kuba-web again after
   setting these.
8. **Until step 7 is done**, a call will ring, connect, hear an honest
   "can't complete this call" message, and hang up. This is expected,
   not a bug — completing steps 1-6 alone (without a deployed gateway)
   is a deliberately safe intermediate state to verify Plivo routing
   works before any AI audio is involved.

Country/number choice is entirely provider-driven — nothing in this
codebase assumes a Ghanaian number; an existing US or other
international Plivo number works identically (Phase 45).

## Safe acceptance steps (no live gateway required)

1. Complete steps 1-6 above.
2. Call the configured number from a real phone.
3. Confirm: the call rings, is answered, you hear the honest "unable to
   complete this call" message, and it hangs up cleanly (not silence,
   not an error tone, not an indefinite ring).
4. In `/dashboard/integrations/voice`, confirm the number shows the
   correct provider, assigned employee, and "Not ready" for
   inbound/outbound until `VOICE_GATEWAY_URL` exists.
5. Do **not** attempt a real end-to-end AI conversation test until the
   media gateway exists — there is nothing on the other end of the
   `<Stream>` yet.

## Production readiness audit (2026-09-15)

Confirmed directly against the production Vercel project (`kuba-web`,
env-var NAMES only, no values read or printed): `OPENAI_API_KEY` is
already set. **None** of the following exist in production yet:
`PLIVO_AUTH_ID`, `PLIVO_AUTH_TOKEN`, `PLIVO_VOICE_NUMBER`,
`VOICE_CREDENTIALS_KEY`, `VOICE_WEBHOOK_SECRET`, `VOICE_GATEWAY_URL`,
`VOICE_GATEWAY_SESSION_SECRET`, `VOICE_GATEWAY_INTERNAL_SECRET`. Voice is
therefore completely inactive in production today, exactly as this
document's "Bottom line" already stated — this audit found no
discrepancy between the documentation and the deployed reality.

Attempted to deploy `billygomez007/kuba-voice-gateway` (prepared locally,
now pushed to GitHub) to Railway as part of this pass. **Blocked**: no
Railway CLI authentication is available in this environment (`railway
whoami` → `Unauthorized`), no `RAILWAY_TOKEN` is configured, and no
GitHub Actions Railway-deploy workflow or repo secret exists for either
repository. Deploying requires the owner to either run `railway login`
interactively and hand over project access, or provide a project-scoped
`RAILWAY_TOKEN`, or perform the Railway deployment themselves using this
document and the gateway's own `docs/VOICE_GATEWAY.md`.

What WAS verified in this pass, without needing Railway or Plivo access:
the gateway's own `npm test`/lint/typecheck all pass; a real
`docker build .` succeeds; a container built from that image starts
correctly, and both `/health` and `/ready` respond correctly from outside
the container (verified with throwaway, non-production placeholder
secrets — never real credentials). A real bug was found and fixed in the
process: `package.json`'s `start` script (`node dist/index.js`) never
matched TypeScript's actual `rootDir`-preserving output path
(`dist/src/index.js`) — invisible until now because the Dockerfile
already flattened `dist/src` into `./dist` for the runtime image,
masking it. Fixed; `npm run build && npm start` now works as documented.

## Known limitations (deferred, not overlooked)

- The media bridge is now built (see "Media bridge") but **not deployed
  anywhere** — this is the actual remaining blocker to any live AI phone
  conversation. See "Production readiness audit" above for exactly what
  blocks deployment and what was verified without it.
- `maxCallDurationMinutes` (per-employee, in Voice settings) is stored
  but not enforced by kuba-web; the gateway enforces its own separate,
  fixed technical safety ceiling (`VOICE_GATEWAY_MAX_CALL_DURATION_MS`,
  default 30 min) — the two are not currently reconciled into one limit.
- No concurrent-call limit.
- Recording (off by default, deferred pending consent/legal policy).
- Live mid-call transfer to a human phone line (deferred — the gateway
  exists now, but this specific feature was not built this pass).
- The raw-audio path's Business Brain access is a deliberately minimal
  allowlist (currently just `get_business_knowledge`) — narrower than
  the text-relay path's full tool set; widening it is future work
  requiring a safety review per tool.
- Plivo's exact inbound webhook payload shape, V2 signature scheme,
  Audio Streaming protocol event names, and `<Stream>` XML attributes
  were implemented from documentation, not verified against a live
  account — confirm before full production reliance (see the gateway's
  own `docs/VOICE_GATEWAY.md` for the same caveat on its side).
- The Voice Gateway's own Docker build could not be verified in this
  environment (Docker CLI present, daemon not running) — confirm
  `docker build .` succeeds in the gateway repo before deploying.
