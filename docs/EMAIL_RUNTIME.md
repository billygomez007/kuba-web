# Email Runtime

Canonical reference for SuperKuba's email architecture: outbound sending,
inbound receiving, reply correlation, campaign integration, Sales handoff,
and what a platform operator must configure before inbound email is live.

**Status distinction used throughout this document**: **CODE READY** means
the implementation exists, is tested, and will work correctly the moment
the provider/DNS configuration below is completed. **PROVIDER/DNS NOT
CONFIGURED** means no code changes are needed — only the manual setup in
"Production activation checklist" below. As of this writing, outbound
email is live; inbound email is CODE READY but PROVIDER/DNS NOT
CONFIGURED in every environment (local/preview/staging/production).

## Provider

**Resend** (`resend` npm package, `lib/email/resend.ts`) is the sole email
provider — outbound and inbound both. No SMTP, no Microsoft 365/Graph.
One lazy singleton client (`getResend()`) is reused by every outbound call
site (auth emails, welcome email, contact-sales, campaign engine) — never
instantiated per call.

The Resend webhook payload shape used by the inbound handler (event
field names like `data.email_id`, `data.from`, `data.to`, `data.headers`)
is **not verifiable from the installed SDK** — the `resend` npm package
ships only the outbound send API's types, not webhook event types. The
handler was written defensively for this reason: every inbound field is
read optionally via small `asString`/`asStringArray` helpers
(`app/api/integrations/email/webhook/route.ts`), and a missing/malformed
field degrades honestly (ignored, or a safe fallback) rather than
throwing. **Verify the exact payload shape against Resend's current
webhook documentation before assuming any field name here is exhaustive
or permanently correct** — Resend can add fields to their payloads over
time, which this handler tolerates by construction (unknown fields are
simply not read), but cannot invent shapes we haven't confirmed.

## Outbound flow

```
caller (auth hook / welcome email / contact-sales / campaign send-worker)
  -> getResend() (lib/email/resend.ts) — one shared client
  -> resend.emails.send({ from: EMAIL_FROM, to, subject, html, text, replyTo? }, { idempotencyKey })
  -> provider message id (response.data.id) stored as messages.externalMessageId
     or outreachCampaignSends.externalMessageId
```

- **Sender identity**: every business sends from the single, shared,
  already-verified `EMAIL_FROM` address. See "Per-business sender
  identity" below — this is a deliberate, documented limitation, not an
  oversight.
- **Idempotency**: campaign sends pass Resend's `idempotencyKey` set to
  the send row's own id, so a crash-and-retry of the same logical send
  never dispatches twice (`lib/outreach/email-channel.ts`).
- **Reply-To**: campaign sends carry a signed, per-recipient Reply-To
  address (see "Reply token model") **only when inbound email is
  configured** (`RESEND_INBOUND_DOMAIN` set) — `buildCampaignReplyTo()`
  returns `undefined` otherwise, so outbound email never advertises a
  reply address that goes nowhere (`lib/outreach/email-channel.ts`).
- **Failure handling**: `sendCampaignEmail()` classifies provider errors
  into `provider_5xx` (retryable) vs `provider_rejected_permanent`
  (terminal), bridged into the send-worker's own bounded-retry taxonomy
  by `lib/email/error-classification.ts`. Invalid addresses, suppressed
  recipients, and permanent bounces are never retried.

## Inbound flow

```
external sender
  -> reply+<token>@<RESEND_INBOUND_DOMAIN>          (campaign/thread reply)
     OR <business-slug>@<RESEND_INBOUND_DOMAIN>      (general business alias)
  -> Resend receives mail on the configured domain
  -> Resend POSTs "email.received" to POST /api/integrations/email/webhook
  -> Svix signature verified over the RAW body (before any JSON parsing)
  -> correlateInboundEmail() resolves tenant + thread deterministically
  -> conversation created/reused, inbound message persisted
  -> for a campaign reply: markRecipientReplied() halts the sequence
  -> conversation appears in the existing unified Inbox
```

The webhook (`app/api/integrations/email/webhook/route.ts`) is one
canonical endpoint handling both inbound mail (`email.received`) and
outbound delivery-status events (`email.sent`, `email.delivered`,
`email.delivery_delayed`, `email.bounced`, `email.complained`) — never
two competing paths. Any other event type (including ones not listed
here, e.g. a possible future `email.failed`/`email.opened`/
`email.clicked`) is acknowledged with `200 { received: true }` without
special handling, so an unrecognized event can never crash the handler
or cause Resend to retry forever. **Verify against Resend's current
webhook event catalog before enabling any additional event types in the
Resend dashboard** — do not assume this list is complete.

### Webhook security

- **Signature verification**: `lib/email/webhook-signature.ts` implements
  Svix's HMAC-SHA256 scheme by hand (matching this codebase's existing
  convention of not depending on a provider SDK for webhook verification
  — see `lib/channels/whatsapp.ts`'s `verifyMetaSignature`), verified over
  the raw request body before any JSON parsing, using
  `crypto.timingSafeEqual`.
- **Replay protection**: the `svix-timestamp` header must be within 5
  minutes of the current time, or the request is rejected — a captured
  webhook payload cannot be replayed indefinitely.
- **Secret rotation**: `svix-signature` may carry multiple
  space-separated `v1,<sig>` values; any one matching is accepted.
- **Idempotency**: inbound mail is deduplicated by the provider's own
  event id (`messages.externalMessageId`) — a webhook retry is detected
  and acknowledged as `{ duplicate: true }` without inserting a second
  message. Delivery-status events are naturally idempotent (suppression
  inserts are upsert-like via a unique index; message status updates are
  plain overwrites).

## Business-safe addressing (tenant resolution)

Tenant identification is **never** derived from recipient display name,
subject text, sender email, or a client-supplied `businessId`. Two
server-verified mechanisms only, checked in order
(`lib/email/inbound-correlation.ts`):

1. **Signed reply token** (primary) — `reply+<token>@<inbound-domain>`.
   The token (`lib/email/reply-token.ts`) is an HMAC-SHA256-signed,
   base64url payload carrying `businessId` + `conversationId` (+
   `campaignId`/`recipientId`/`sendId` for campaign sends), signed with
   the existing `BETTER_AUTH_SECRET` (no new secret introduced). A
   verified token resolves `MATCHED_CAMPAIGN` (has campaign context) or
   `MATCHED_THREAD` (does not). An unverifiable or tampered token is
   silently ignored (falls through to the next mechanism), never
   trusted partially.
2. **Per-business inbound alias** (fallback, for cold inbound mail with
   no prior SuperKuba-sent email to reply to) —
   `<business-slug>@<inbound-domain>`, stored as
   `integrations.externalAccountId` (`provider = "email"`) when a
   business activates Email in Settings. The alias is derived from the
   business's own `slug` column (`unique`, immutable — no route mutates
   it after creation), never from a mutable display name, so it is
   stable and cannot collide across tenants. Resolves `MATCHED_CONTACT`
   (an existing conversation with this sender already exists) or
   `NEW_CONVERSATION` (first contact).
3. **Neither matches**: `UNMATCHED_REVIEW_REQUIRED` — see below.

## Reply token model

See `lib/email/reply-token.ts`. Stateless, HMAC-signed, embedded as the
local part of the Reply-To address on every outbound campaign email
(`reply+<token>@<domain>`). Verification fails closed (returns `null`,
never throws) for any malformed input, since an inbound email's
recipient address is attacker-controlled. There is no expiry on the
token itself — a reply token remains valid for as long as the
conversation could reasonably still receive a reply, matching normal
email-thread semantics; the *conversation* it resolves to is what's
authoritative, not a time window on the token.

## Campaign reply correlation

Full chain, covered end-to-end by
`tests/email-inbound-webhook-integration.test.mjs`:

```
campaign send (process-send.ts)
  -> buildCampaignReplyTo() signs a token carrying businessId/campaignId/recipientId/sendId
  -> Resend sends with that Reply-To
  -> prospect replies
  -> inbound webhook: reply token verified -> MATCHED_CAMPAIGN
  -> conversation `email-campaign-<recipientId>` created/reused (deterministic id,
     see conversationIdForCampaignRecipient — same conversation on every reply
     from the same recipient, no extra lookup table needed)
  -> inbound message persisted
  -> markRecipientReplied() — halts the sequence: recipient -> "replied",
     any pending scheduled send for this recipient is cancelled
  -> conversation visible in Inbox immediately (Inbox is channel-agnostic;
     no Inbox-side change was needed)
```

Tenant isolation is enforced by construction: a reply token signed for
business A can never resolve to business B, even if the same sender has
also emailed business B's own alias (tested explicitly).

## General (non-campaign) inbound email

```
known business alias + unknown sender
  -> normalizeEmailAddress(sender) (lowercase + trim)
  -> find existing conversation for (businessId, integrationId, customerEmail)
  -> found: MATCHED_CONTACT, reuse conversation
  -> not found: NEW_CONVERSATION — find-or-create customer row, then conversation
  -> inbound message persisted, assigned to an active "receptionist" AI employee if one exists
```

A second email from the same sender to the same alias reuses the
existing customer/conversation — no duplicate contact is created per
email (tested explicitly).

## Unmatched inbound email

`UNMATCHED_REVIEW_REQUIRED` — an email addressed to neither a valid
reply token nor any business's known alias. **Nothing is persisted under
any business.** The webhook acknowledges the provider delivery (`200`,
so Resend does not retry) and logs only safe metadata (the normalized
recipient address list, timestamp, classification) for manual
operational review — never a guessed tenant, never the message body.
This is deliberate: an email that cannot be deterministically attributed
must not silently attach to the wrong (or an arbitrary) business.

## Threading

`Message-ID`, `In-Reply-To`, and `References` headers are read
defensively from the inbound payload (`readHeader()` in the webhook
route, tolerant of either an array-of-`{name,value}` or a flat object
header shape, since the exact shape is not verifiable from the installed
SDK — see "Provider" above) and stored verbatim in the persisted
message's `metadata` JSON column, alongside the correlation
classification, quoted-content-trimmed flag, and source format. They are
**not** currently used as an independent correlation signal — the signed
reply-token and business-alias mechanisms above are authoritative and
sufficient for every case tested so far. Subject text is never used as
an authoritative threading signal on its own. Using the raw email
headers as a *secondary* correlation signal (e.g., matching
`In-Reply-To` against a stored outbound `Message-ID` when no reply token
is present, for mail clients that strip Reply-To manipulation) is
possible future work, not implemented — the token/alias mechanisms
already cover every case that can be tested without a live inbound
domain.

## Inbox integration

Inbound email conversations/messages surface in the existing unified
Inbox (`app/dashboard/inbox/page.tsx`, `app/api/inbox/workspace/route.ts`)
automatically — the Inbox is channel-agnostic (resolves channel by
joining `integrations.provider` through `conversation.integrationId`);
no email-specific Inbox code was needed for messages/conversations to
appear. What *was* added: a `salesHandoff` field per conversation
(campaign-reply conversations only) surfacing eligibility/handed-off
state, and a "Hand off to Sales" card in the conversation detail panel.
There is no separate, disconnected "Email Inbox."

## Sales handoff

Two distinct steps, never combined (`lib/outreach/campaign-reply-handoff.ts`):

1. **`markRecipientReplied`** — automatic, fires on every campaign reply
   from the inbound webhook. Halts the sequence (cancels pending
   scheduled sends). Idempotent (a duplicate webhook delivery is a safe
   no-op).
2. **`handleCampaignReplyHandoff`** — **deliberately manual**, triggered
   only by `POST /api/outreach/campaigns/[campaignId]/recipients/[recipientId]/handoff`
   (surfaced as "Hand off to Sales" in the Inbox). A reply is not
   automatically judged "Sales-worthy" by any code or AI — a
   "not interested"/"unsubscribe" reply must never silently become a
   lead. See "Automatic handoff policy" below.

The manual handoff route requires **both**:
- `outreach.manage` (via `requireCampaignAccess("manage")`, the same
  tenant-resolution pattern every other route under
  `app/api/outreach/campaigns/**` uses — enforced by a static policy test,
  `tests/outreach-campaign-routes-policy.test.mjs`)
- `sales.manage` (matching `app/api/leads/[id]/route.ts`'s convention for
  every other lead-mutating route — creating a lead is a distinct
  authority from managing an Outreach campaign)

The reply text used as handoff evidence (`getLatestReplySummary`) is
always read from the actual persisted inbound message for that
recipient's conversation — **never** accepted from the request body, so
the stored handoff reason always reflects what the customer actually
sent, not client-supplied text.

Handoff converges into the single deterministic Sales-promotion core
(`lib/outreach/sales-handoff.ts`, `promoteProspectToSales`) that
autonomous-research qualification also uses — never a parallel
lead-creation path. Idempotent by an atomic
`UPDATE ... WHERE promoted_lead_id IS NULL` claim: whichever trigger
reaches a given prospect first wins, and every subsequent call (repeated
clicks included) is told the prospect is already promoted rather than
creating a second lead. The created lead's `notes` field records the
company, trigger type, campaign id, recipient id, reply summary, and
recommended next action — the full source/reason/evidence trail Phase 8
requires, all in one place.

## Automatic handoff policy

**There is no automatic reply-to-Sales promotion, by design.** The
architecture does not currently contain a deterministic
engagement/qualification signal safe enough to auto-promote every
campaign reply (a bare "unsubscribe" reply is a reply, but obviously not
Sales-worthy). The manual "Hand off to Sales" workflow above is
**canonical for this release** — a human reviews the reply in Inbox and
explicitly triggers the handoff.

This is intentionally documented as **future work, not pretended to
exist**: an AI employee (e.g. the assigned receptionist/outreach
employee) could summarize or suggest classification of a reply, but any
actual external/business state transition (creating a lead, marking a
prospect qualified) must remain server-authorized and auditable — never
a model output alone. If a deterministic auto-handoff policy is designed
later (e.g., explicit keyword-based suppression-reply detection feeding
a policy check), it should still call the exact same
`handleCampaignReplyHandoff`/`promoteProspectToSales` core, not a new
path.

## Suppression, bounces, complaints

- **Suppression is checked server-side, at send time, twice** per send
  (`lib/outreach/process-send.ts`): once before rendering, once
  immediately before the provider call (a recipient can unsubscribe or
  bounce in the gap between the two checks). This is enforced in the
  send worker itself, not only surfaced in UI.
- **Bounce/complaint**: `email.bounced` and `email.complained` webhook
  events call `addSuppression()` (idempotent — unique-indexed on
  `businessId + channel + normalizedIdentity`, a duplicate webhook
  delivery is a safe no-op) and update the stored message's `status`
  honestly (a message is only ever marked "delivered" on an actual
  `email.delivered` event, never merely because the send API call was
  accepted).
- **Permanent failures are never retried** — `error-classification.ts`
  classifies invalid-address/permanent-rejection failures as terminal,
  distinct from retryable `rate_limit`/`5xx`/timeout failures.
- **Unsubscribe**: link-based only (a signed, non-guessable token in
  every campaign email's footer, `lib/outreach/unsubscribe-token.ts`).
  **Reply-text unsubscribe detection (e.g. a customer replying
  "unsubscribe" instead of clicking the link) is not implemented** —
  documented here as a known gap, not silently assumed to work.

## HTML / text safety

`lib/email/sanitize.ts` — no HTML sanitization library exists in this
codebase (no `sanitize-html`/DOMPurify); raw HTML is **never** stored or
rendered. Inbound content is reduced to plain, safe text: the
provider-supplied plain-text part is preferred when present; HTML is
only parsed as a fallback, via a strip-tags-and-decode-entities
extraction (`htmlToSafeText`) that removes `<script>`/`<style>` blocks
entirely before stripping remaining tags. This makes tracking pixels and
remote-image loading a non-issue by construction — plain-text extraction
never fetches or embeds any remote resource. Quoted-reply content (`On
... wrote:`, `>`-quote blocks, Outlook `-----Original Message-----`) is
trimmed conservatively — only at the first recognized marker, and never
if that would leave an empty message. Malicious-link *detection*
(phishing/malware scanning) is explicitly out of scope. All regexes used
are bounded/non-catastrophic (no nested unbounded quantifiers); malformed
input degrades to a safe fallback rather than throwing.

## Attachments

**Not supported.** The inbound webhook does not read, persist, or
reference any attachment data from the provider payload — an inbound
email with an attachment is still processed normally for its text/HTML
body, but the attachment itself is silently discarded (not counted, not
named, not exposed in Inbox). This is a deliberate scope limit, not a
bug: implementing attachment handling correctly requires tenant-scoped
storage, a file size/type policy, and authenticated access, none of
which exist yet for any channel in this codebase. Deferred to a future
milestone.

## Per-business sender identity

**Every business sends from the same shared, verified `EMAIL_FROM`
address for this release.** This is a documented, honest limitation —
the Email Integration UI (`/dashboard/integrations/email`) states this
plainly rather than pretending each business has its own sender
identity, and no UI anywhere lets a business type an arbitrary From
address. `sendCampaignEmail()`'s `fromOverride` parameter exists so a
future per-business identity can be added without changing every call
site, but it is not wired to any user input today.

Replies still route correctly per-business regardless — the shared
sending identity only affects the *From* address; the signed Reply-To
and per-business inbound alias are what make inbound routing
tenant-safe, and neither depends on per-business sending domains.

**Future milestone (not this release)**: custom verified sending domains
per business (e.g. via Resend's domain verification API), so a business
can send as `hello@theirbrand.com`. This requires its own DNS/product
design pass and is out of scope here.

## Per-business inbound alias

Deterministic: `<business-slug>@<RESEND_INBOUND_DOMAIN>`, generated and
stored (`integrations.externalAccountId`) only when a business activates
Email in Settings (`PUT /api/integrations/email`) **and** the platform's
inbound domain is ready. `businesses.slug` is `unique` and immutable
(no route in the codebase mutates it after creation), so the alias
cannot collide across tenants and cannot resolve another business's
mail.

## Migration

`drizzle/0045_add_message_metadata.sql` — additive only:
`ALTER TABLE messages ADD metadata text;`. No existing column altered or
dropped, no data migration needed (existing rows get `NULL`, read as
absent metadata). Verified against `origin/main` and
`origin/feature/outreach-ai-employee` (both behind this branch, neither
has an `0045`) — no numbering collision. `origin/staging` has its own,
differently-numbered migration lineage that diverged earlier and is out
of scope to reconcile here. Verified on a fresh clean-bootstrap database
(`scripts/bootstrap-clean-database.mjs`) — the `messages` table gets the
`metadata` column with no errors.

## Environment variables

| Variable | Classification | Purpose |
|---|---|---|
| `RESEND_API_KEY` | REQUIRED_FOR_OUTBOUND | Resend API authentication for sending |
| `EMAIL_FROM` | REQUIRED_FOR_OUTBOUND | Shared sending identity (see "Per-business sender identity") |
| `EMAIL_REPLY_TO` | OPTIONAL | Fallback Reply-To for welcome email / contact-sales when no signed campaign Reply-To applies |
| `SALES_CONTACT_EMAIL` | OPTIONAL | Falls back to `EMAIL_REPLY_TO` for the public contact-sales form |
| `RESEND_INBOUND_DOMAIN` | REQUIRED_FOR_INBOUND | Sole readiness signal that a receiving domain has been configured in Resend; gates signed Reply-To and per-business aliases |
| `RESEND_WEBHOOK_SECRET` | REQUIRED_FOR_INBOUND | Svix signing secret for webhook verification — inbound is not "ready" without both this and the domain |
| `BETTER_AUTH_SECRET` | REQUIRED (reused) | Also signs reply tokens — not a new/separate secret |

No `.env.example` exists in this repo (pre-existing gap, not introduced
by this work). Values were never read or printed by this pass.

## DNS / provider requirements

**No DNS was changed. No Resend configuration was changed.** The
codebase never invents a domain, MX target, or DNS record value — every
value is read from an environment variable the platform operator sets
*after* configuring a receiving domain directly in the Resend dashboard.
See "Production activation checklist" below for the exact manual steps —
this document does not fabricate specific DNS record values, since only
Resend's own dashboard generates the real ones for the domain actually
chosen.

## Production activation checklist (manual, operator-performed)

Nothing below has been done by this code change. This is what a human
operator must do before inbound email goes live in any environment.

1. **Choose a receiving subdomain.** Recommended: `reply.superkuba.com`
   (or your production domain's equivalent) — a dedicated subdomain
   keeps inbound-receiving DNS records isolated from your primary
   domain's existing mail (SPF/DKIM for transactional/campaign sending)
   and from web DNS records, so there's no risk of conflicting with
   `EMAIL_FROM`'s own sending domain setup.
2. In the **Resend dashboard**, open **Domains**, and add/configure that
   subdomain as a **receiving domain** (Resend's inbound-email feature).
3. Resend will generate the exact DNS records required (typically an MX
   record, possibly TXT records) — **use the values Resend actually
   generates for your domain**, never values written in this document,
   since they are account/domain-specific.
4. Add those exact records to your DNS provider for that subdomain.
5. In the Resend dashboard, configure a **webhook** pointing at:
   ```
   https://<your-production-domain>/api/integrations/email/webhook
   ```
   Do not point it at a Preview deployment URL — Preview URLs are not
   stable and are not the permanent webhook target.
6. Enable these webhook events in Resend: `email.received`, `email.sent`,
   `email.delivered`, `email.delivery_delayed`, `email.bounced`,
   `email.complained`. (Confirm this list against Resend's current event
   catalog — see "Provider" above; unrecognized events are handled
   safely either way.)
7. Copy the **webhook signing secret** Resend shows when you create the
   webhook (starts with `whsec_`).
8. In Vercel, set these environment variables:
   - `RESEND_INBOUND_DOMAIN` = the subdomain from step 1
   - `RESEND_WEBHOOK_SECRET` = the secret from step 7
9. Set them for the environment(s) you're activating (Preview and/or
   Production — decide per your own rollout policy; they are
   independent per Vercel environment).
10. **A redeploy is required** for new environment variables to take
    effect (Vercel does not hot-reload env vars into running functions).
11. Back in Resend's dashboard, confirm the receiving domain shows
    **Verified** (Resend validates its own DNS records independently —
    this codebase never re-implements that check).
12. Once verified, activate Email for a test business
    (`/dashboard/integrations/email` → "Activate Email") and confirm the
    page shows an inbound alias and **ACTIVE** status.

## Browser acceptance steps (after the checklist above is complete)

1. Open `/dashboard/integrations/email` for a test business — confirm
   status is **ACTIVE**, an inbound alias is shown, and the "Inbound
   replies" card no longer shows the "not yet configured" warning.
2. Send one real test email to that business's shown inbound alias from
   an external mailbox you control.
3. Confirm it appears in `/dashboard/inbox` as a new conversation within
   a minute or two.
4. Launch (or use an existing) test campaign with exactly one test
   recipient you control; confirm the received email's Reply-To is a
   `reply+...@<your-inbound-domain>` address.
5. Reply to that campaign email from the external mailbox.
6. Confirm: the reply appears in the *same* Inbox conversation as the
   original campaign thread (not a new one), the recipient's campaign
   status moves to "replied," and any further scheduled sequence step
   for that recipient is cancelled.
7. Click "Hand off to Sales" on that conversation; confirm a lead
   appears with the campaign/reply reference in its notes, and that
   clicking the button again does not create a second lead.

## Known limitations (deferred, not overlooked)

- Per-business verified sending domains (shared `EMAIL_FROM` for now).
- Reply-text unsubscribe detection (link-based only).
- Attachments (silently discarded, not persisted).
- Message-ID/In-Reply-To/References used for storage/display only, not
  as an independent correlation signal.
- Automatic Sales-handoff policy (manual trigger is canonical for this
  release).
- No malicious-link/phishing detection on inbound content.
