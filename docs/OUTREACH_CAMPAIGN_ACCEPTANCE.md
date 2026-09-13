# Outreach Campaign Engine — Acceptance Record (V1 dashboard)

## Scenario

Post-dashboard acceptance pass for the Outreach Campaign Engine on
`feature/outreach-ai-employee`: push the dashboard commits, get them onto
a Vercel preview deployment, and run real browser acceptance before any
recommendation to integrate into `staging`.

## Environment

- **Repo**: `billygomez007/kuba-web`, branch `feature/outreach-ai-employee`
- **Feature SHA at end of this pass**: `b348890bd08eabec738249eb31717092f4d9c2be`
- **Vercel preview URL for that SHA**: `https://kuba-psdkpe09e-kuba-web.vercel.app`
  (Preview environment, deployment state `success`)
- **This pass's own environment**: a non-interactive CLI agent session —
  no browser or browser-automation tool available, and no credentials for
  a Vercel account session or the staging Turso database. `staging` and
  `main` were not touched.

### A real constraint this pass hit immediately

The preview URL above sits behind **Vercel Deployment Protection (SSO)** —
requesting it without a logged-in Vercel session returns a 302 to
`vercel.com/sso-api`. That means:

- No unauthenticated HTTP client (curl, a script) can reach the rendered
  app on this URL.
- No browser-automation tool available in this session could have logged
  in either — that requires an actual Vercel account session in a real
  browser.

Real interactive browser acceptance (sections below) therefore still
requires **you** (or a future browser-capable agent/session with a logged-in
Vercel session) to open the URL above directly.

## Test account / workspace (what's needed, not created by this pass)

This pass did not create a live test workspace. There is no staging
database access configured in this environment (`../.env.staging.local`
does not exist here), and seeding fixtures into a shared database this
session can't verify the scope of would be an unforced risk for no
verifiable benefit (nothing here could confirm the data actually landed
in whatever environment the Vercel Preview deployment reads from).

Before running the manual checklist below, set up (via normal signup +
the dashboard UI, or the existing `scripts/seed-ai-employees.ts` /
`scripts/bootstrap-super-admin.mjs` patterns) a **development-only**
business with:

- Pro-equivalent plan/entitlement (so `outreach.campaigns` is enabled)
- An active Kuba Outreach AI employee
- An active Kuba Sales AI employee (for handoff visibility checks)
- Several development prospects with saved research (company, ICP fit,
  qualification, evidence) — reuse the existing autonomous-research
  pipeline or manual entry
- Saved development contacts covering every eligibility outcome the
  dashboard must distinguish:
  - one normally **eligible** contact with a valid email
  - one **already enrolled** in the campaign under test
  - one **suppressed** (add via the unsubscribe endpoint or
    `outreach_suppressions` directly)
  - one **do-not-contact** (`outreach_contacts.doNotContact = true`)
  - one with **withdrawn consent** (`consentStatus = "withdrawn"`)
  - one with a **missing/invalid destination** (no email)

Use only clearly fake/safe addresses (e.g. `@example.com`) or
provider-approved test destinations. Never enroll or send to a real
prospect during this acceptance pass.

## What this pass actually verified (no browser required)

| # | Check | Result |
|---|---|---|
| 1 | Push safety (clean tree, correct branch, no unexpected remote advancement, `main`/`staging` unchanged) | **Pass** — verified before and after both pushes this pass |
| 2 | Preview deployment corresponds to the exact pushed SHA | **Pass** — confirmed via GitHub Deployments API (`environment: Preview`, matching SHA) |
| 3 | Deployment actually succeeds | **Failed, then fixed, then Pass** — see Defects below |
| 4 | `npm run lint` | **Pass** — 0 errors, 60 pre-existing warnings (unchanged) |
| 5 | `npx tsc --noEmit` | **Pass** — clean |
| 6 | `npm test` | **Pass** — 1060/1060 (1038 baseline + 22 new) |
| 7 | `npm run build` | **Pass** — clean; all campaign routes present in build output |
| 8 | `git diff --check` (whitespace) | **Pass** |
| 9 | Secret scan on the diff | **Pass** — no literal secrets/keys found |
| 10 | Migration files touched | **None** — no migration risk introduced |
| 11 | Route-level tenant isolation (source policy) | **Pass** — every campaign route requires `requireCampaignAccess`, never trusts a client-supplied `businessId`; extended coverage to the previously-untested `/api/outreach/contacts` route |
| 12 | No fabricated open/click/conversion metrics anywhere in dashboard source | **Pass** |
| 13 | Draft-only mutability enforced in the UI (sequence/recipients editable only when `status === "draft"`) | **Pass** |
| 14 | Per-status lifecycle action mapping (running→pause/stop, paused→resume/stop, scheduled→stop, terminal states→none) | **Pass** |
| 15 | Preview endpoint never touches the send path or writes to the DB | **Pass** — confirmed by source read, not just a test regex |
| 16 | Launch/schedule only fire from an explicit click handler, never a `useEffect` | **Pass** |
| 17 | Client-side recipient eligibility check matches the real backend gate exactly (`doNotContact \|\| consentStatus === "withdrawn"`, suppression, already-enrolled, missing destination) | **Pass** |
| 18 | Sales handoff visibility (lead reference, assigned employee, reason, timestamp) | **Failed, then fixed** — see Defects below |
| 19 | Reply/DNS limitation communicated honestly (no fake "reply tracking active") | **Failed, then fixed** — see Defects below |

## Defects found and fixed this pass

1. **Deployment failure (Vercel Hobby cron-frequency limit).**
   `vercel.json`'s `*/5 * * * *` schedule for the campaign send worker
   exceeds the Hobby plan's once-per-day cron limit; Vercel rejects the
   entire deployment when any cron expression exceeds the plan's allowed
   frequency (confirmed via Vercel's own cron docs — the failed commit
   status's target URL redirected straight to that page). **Fix**:
   `vercel.json`'s entry is now a once-daily safety-net fallback;
   `.github/workflows/campaign-send-cron.yml` is the real 5-minute
   trigger, calling the same `CRON_SECRET`-protected endpoint over HTTP.
   Commit `75c2201`.
2. **Incomplete Sales handoff visibility.** The recipient table showed a
   "Handed off" status badge with no Sales lead reference, assigned
   employee, or reason, contradicting the approved brief. **Fix**: the
   recipients API route now joins `leads`/`aiEmployees` (business-scoped)
   and returns a safe, fixed-allowlist reason label; the recipient table
   renders timestamp, reason, assigned employee, and a link to the Sales
   board. Commit `b348890`.
3. **No reply/DNS-limitation messaging.** Nothing told a user why replies
   or hand-offs might never appear. **Fix**: added an honest static notice
   to the Recipients section — never a fabricated "reply tracking active"
   indicator. Commit `b348890`.

22 new automated tests were added
(`tests/outreach-campaign-dashboard-policy.test.mjs`) to lock in items
11-19 above so they can't silently regress.

## Known blockers (unchanged by this pass, not solvable by this pass)

- Live inbound reply correlation: blocked on a DNS/inbound-email-receiving
  decision (production/business decision, explicitly not touched this
  pass per instruction).
- Production Turso migration state: must be verified read-only by an
  operator with real production DB access before any production
  migration — not touched this pass.
- Per-business verified sending identity for campaign email: still one
  platform-wide `EMAIL_FROM`.
- `.github/workflows/campaign-send-cron.yml` needs `CRON_SECRET` and
  `PRODUCTION_APP_URL` configured in this repo's Actions secrets/variables
  once merged — it does nothing until then (scheduled workflows only run
  from the default branch).

## Deferred (intentionally, not overlooked)

- WhatsApp campaign channel (explicitly out of scope for V1).
- A dedicated Sales-lead detail page/deep link (today: a general link to
  `/dashboard/sales` — no per-lead route exists yet anywhere in the app,
  not just in the Campaign Engine, so adding one was out of scope for this
  pass).
- Full WCAG certification (spot-checked via source only: form fields use
  the shared `FormField`/`Dialog` components, which already carry labels
  and focus handling elsewhere in this codebase — not independently
  re-verified in a screen reader this pass).

## Manual acceptance checklist (run this in a real, logged-in browser)

Open `https://kuba-psdkpe09e-kuba-web.vercel.app` in a browser where
you're already logged into the Vercel account that owns this project (the
SSO wall will pass through automatically). Then, using the development
workspace described above:

1. **List page** (`/dashboard/outreach/campaigns`): loads with no console
   errors; nav highlights correctly; empty state (if no campaigns yet)
   matches the copy in the page source; all 7 status badges render
   distinctly; metrics match what you enrolled; mobile width (~400px)
   doesn't break the layout.
2. **Create flow** (`/new`): name/description/employee picker work;
   WhatsApp is visibly disabled, not just hidden; submit redirects to the
   new campaign's detail page; a user from a second test business cannot
   assign a campaign to the first business's employee (try via devtools
   network tab, not just the picker).
3. **Recipient enrollment**: open the dialog, confirm each of the six
   fixture contacts shows the *correct* eligibility label and is
   selectable only if eligible; submit; confirm the enrolled contact
   appears in the recipient table and the others don't silently vanish
   from view.
4. **Sequence builder**: add two steps, edit one, reorder them, remove
   one, refresh the page — confirm the persisted order/content survived
   the refresh (not just the in-memory state).
5. **Preview**: open preview on a step with an enrolled recipient; confirm
   From/To/Subject/body match what the sequence step actually contains;
   confirm no network request to Resend fires (check the Network tab);
   confirm nothing shows up in `outreach_campaign_sends` afterward.
6. **Launch**: with ≥1 step and ≥1 eligible recipient, confirm the button
   is enabled only then; launch; confirm campaign flips to `running` and a
   send row is created; click launch/refresh rapidly to confirm no
   duplicate send job appears.
7. **Pause/resume**: pause a running campaign; confirm no new sends claim
   after that instant; resume; confirm no duplicate sends were created
   across the pause/resume boundary.
8. **Stop**: confirm it's terminal, confirm history/metrics remain visible
   afterward, confirm clicking Stop again is harmless.
9. **Suppression**: unsubscribe a recipient via the real unsubscribe link
   (check the email preview footer for the URL shape); confirm that
   recipient is excluded from any further scheduled sends; call the same
   unsubscribe URL twice and confirm the second call is a harmless no-op.
10. **Tenant isolation**: as a user in test business B, try to open test
    business A's campaign by its literal URL/ID; confirm a 403/404, not a
    data leak — check the Network tab response body, not just what
    renders.
11. **Console/network**: throughout, watch for hydration warnings, repeated
    unintended polling, or 401/403 loops.

Record the outcome of each item back into this file (or a copy) before
recommending staging integration.

## Recommendation

**NOT READY FOR STAGING INTEGRATION — real browser acceptance still
required.**

Everything checkable without a browser (build, deploy, lint, typecheck,
1060 automated tests, source-level policy review across tenant isolation,
mutability, the AI/launch boundary, and the two real defects this pass
found and fixed) is green. The one remaining gate — a human actually
clicking through the flows above in the deployed app — has not happened
yet and is explicitly called out rather than assumed.
