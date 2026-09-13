# SuperKuba — Full Cross-Plan Clickability / Destination / Action Audit

Run 2026-09-13 on `feature/outreach-ai-employee`. Two methods, both real (not
inferred from reading code alone):

1. **STATIC** — `scripts/lib/clickability-scanner.mjs`, a TypeScript-compiler-API
   AST scanner over `app/dashboard`, `app/admin`, `app/onboarding`,
   `app/components`. Finds every `href`, `href`-shaped object property
   (the data arrays that back `<Link href={item.href}>`), `router.push`/
   `router.replace` call, and `<button>`, and checks each against the real
   route inventory (241 routes discovered from the full `app/` tree).
   Permanently enforced by `tests/clickability-audit.test.mjs`.
2. **LOCAL_BROWSER** — real headless Chromium (Playwright) against the
   actual built app (`next start`, production mode, `VERCEL_ENV=preview` to
   match real cookie/domain behavior), using a from-scratch local database
   built from the current `db/schema.ts` and four real signed-up test
   accounts (one per plan), each with a real seeded business, membership,
   subscription, and one AI employee. Not `LIVE_PREVIEW` — Vercel's SSO
   deployment protection blocks unauthenticated automation, exactly as
   documented in the prior Team & Staff investigation.

No `STATIC_TEST` (jsdom/RTL) method was used — this repo's test suite has no
such infrastructure, and adding one was out of scope for an audit pass.

## Coverage note (read before the matrix)

STATIC covers 100% of hrefs/buttons/router calls in the audited directories —
every route, every plan, every page, exhaustively. LOCAL_BROWSER covers: the
dashboard home page and every sidebar-visible link for each of Starter/
Growth/Pro/Enterprise (146 page loads total, zero non-200 responses, zero
crashes), all four admin pages plus one business detail page and the
organization create form, the onboarding wizard's first two steps, and the
Add Business page's initial load. It does **not** cover interactive
deep-testing of every form submission on every page (e.g. actually creating
a lead, launching a campaign, uploading a knowledge source) — STATIC's
100% coverage of the underlying href/onClick wiring is the primary evidence
those controls are wired to something real; LOCAL_BROWSER's job here was to
prove pages *load* for real plan-scoped data without crashing, which is the
failure mode this task was originally about (Team & Staff/Billing).

## Matrix

| Plan | Surface | Control | Action | Expected Destination/Outcome | Actual Result | Status | Notes |
|---|---|---|---|---|---|---|---|
| All | Sidebar | Help | navigate | A real help page | Was `/help` — no route existed anywhere | **FIXED** | Now `/dashboard/help`, real page, 8 real sections, only real destinations/contacts |
| All | Dashboard home | "Help Center" trust link | navigate | Same real help page | Was also `/help` | **FIXED** | Same fix |
| All | Admin home | "Review marketplace →" | navigate | `/admin/marketplace/reviews` | No page ever existed (only the API route does) | **FIXED** | Link removed (Fix Policy: hide, don't build, for a genuinely unimplemented UI) |
| All | Dashboard home | Command Center "Executive Team" cards ×4 | navigate | Each card's stated destination | 3 of 4 pointed at `/dashboard/employees` (no index route exists); "Ask Kuba" pointed at `#kuba-chat` (no such element anywhere) | **FIXED** | All 4 now point to `/dashboard/ai-employees`, the real AI workforce page |
| All | Dashboard home | Executive Briefing "Review Priorities" | reveal priorities | Show Kuba's recommended priorities | Button had no handler at all; the data (`briefing.priorities`) was already rendered below, unreachable by the button | **FIXED** | Button now scrolls to the already-rendered priorities section (`id="kuba-priorities"`) |
| All | Dashboard home | Executive Briefing "Ask Kuba" | — | — | No handler, no chat feature exists anywhere in the app | **FIXED** | Now navigates to `/dashboard/ai-employees` (consistent with the other "Ask Kuba" fix above) |
| All | (dead code) | `KubaAssistantPanel` "Ask Kuba" chat button | — | — | Fully fake chat UI (input + button with zero wiring, no backing API) — but the component was never imported/rendered anywhere in the app | **FIXED** | Deleted — confirmed zero references before removal |
| All | Integrations | Facebook & Instagram card | navigate to Configure | Real connect flow or honest "Coming Soon" | Card showed as if available (no `status` field); destination page had a fully inert "Connect Meta Account" button, no backing API | **FIXED** | Card now `status: "coming-soon"` (Social Channels render block gained the same gating Communication Channels already had); destination page's button now `disabled` with honest copy |
| All | Integrations | Telegram card | navigate to Configure | Real connect flow or honest "Coming Soon" | Same as Meta, plus a fake "Telegram Bot Token" input that did nothing when submitted | **FIXED** | Same fix; misleading token input removed entirely |
| All | Team & Staff, invitations, member edit, admin cross-business grant | Role selector = Administrator / Team Member | submit | Role saved | `isBusinessRole()` rejected `"admin"` and `"member"` — 2 of the 6 roles the Team & Staff picker itself offers — with "Invalid business role"/"Invalid role", live, for every real caller | **FIXED** | Additive fix to `BUSINESS_ROLES`/`isBusinessRole()`; nothing previously valid became invalid (regression test asserts this) |
| All | Admin → business detail | Add member to this business | submit | New `business_users` row for an existing user | No UI existed at all for this — the API action (`add_member`) was already implemented and tested, but only reachable via a direct API call | **FIXED** | New "Business membership" panel added to `/admin/businesses/[id]`, mirroring the existing organization-page pattern exactly |
| Starter | Sidebar | All 15 visible items | navigate | Command Center, AI Employees, Inbox, Customers, Conversations, Follow-ups, Appointments, Analytics, Communication Channels, Business Brain, Knowledge Sources, Business Profile, Team & Staff, Billing, Preferences | All 15 present, exactly matching the expected Starter set; all 15 loaded 200, zero crashes | PASS | LOCAL_BROWSER |
| Starter | Analytics | AI Workforce Analytics / Sales trend widgets | load | Not available on Starter | Correctly 403'd server-side ("requires a higher plan"); page itself does not crash | PASS | Proves server-side entitlement enforcement, not just hidden nav — the exact "lower plans cannot access higher-tier operations" check this audit asked for |
| Starter | — | Sales, Outreach, Support AI, Voice, Enterprise controls | — | Must not be operationally accessible | Confirmed absent from the 15-item Starter sidebar | PASS | |
| Growth | Sidebar | All 29 visible items (Starter's 15 + Sales/Leads, Support/Tickets, Handoffs, Business Operations, Tasks, Approvals, Automations, AI Employee Builder, AI Teams, Deployment, Monitoring, Documents, Memory, AI Instructions) | navigate | Matches task's expected Growth additions | All 29 loaded 200, zero crashes | PASS | LOCAL_BROWSER |
| Pro | Sidebar | All 51 visible items | navigate | Full Pro operational set | All 51 loaded 200, zero crashes | PASS | LOCAL_BROWSER |
| Enterprise | Sidebar | All 51 visible items | navigate | Same set as Pro (Enterprise adds unlimited limits + white-label + `allCapabilities`, not additional menu items — confirmed intentional in `lib/billing/plan-definitions.ts`) | All 51 loaded 200, zero crashes; sidebar item count identical to Pro by design | PASS | Verified this is deliberate, not a missing-differentiation bug |
| Enterprise | — | No visible operational "Coming Soon"/"Planned" sidebar items | — | Must be zero | Zero found (nav items are structurally only ever added for implemented surfaces — see `app/dashboard/layout.tsx`'s own header comment) | PASS | |
| All | `/dashboard/human-workforce` | Performance, Recruitment cards | navigate | Genuinely unimplemented | Rendered as non-clickable divs with "Coming Soon · backend required" — never a `<Link>`/button | PASS | Already the correct pattern; no fix needed |
| All | `/dashboard/human-workforce/leave` | Approve/reject/cancel leave request | act | Not implemented | Explicit inline notice: "unavailable until an authoritative approval service is connected"; no fake buttons | PASS | External-dependency-style honesty, already correct |
| All | `/dashboard/human-workforce/payroll` | Calculation/approval/payment actions | act | Not implemented | Explicit inline notice: "no authoritative calculation, statutory, approval, finalization, or payment engine"; read-only tables only | PASS | Already correct |
| All | Dashboard home | Executive Briefing headline/summary | load | Real AI-generated insight | `/api/command-center/briefing` 500s in this local test (no live OpenAI credits/key configured for this test run); the client already degrades to static fallback text, page never crashes | EXTERNAL_DEPENDENCY | Matches the exact OpenAI-quota failure independently observed in the real Realtegic account's own Vercel runtime logs during the earlier Team & Staff investigation — a real external dependency (OpenAI), not a code defect. The route returning a raw 500 instead of a clean degraded 200 is a minor polish opportunity, not fixed in this pass. |
| Super Admin | `/admin`, `/admin/users`, `/admin/businesses`, `/admin/organizations` | Page load | navigate | All four load for a `super_admin` account | All four loaded 200, zero console/page errors | PASS | LOCAL_BROWSER, local super_admin test account |
| Super Admin | `/admin/businesses` → detail | Business row link | navigate | Customer 360 detail page | Loaded 200, zero errors | PASS | |
| Super Admin | `/admin/businesses/[id]` | Grant plan / Extend trial / **Add member** (new) | form present | Commercial Controls + membership panel render | Confirmed present, including the newly-added "Add member" panel | PASS | |
| Super Admin | `/admin/organizations` | Create portfolio form | form present | Name/owner/reason fields + button | Confirmed present | PASS | |
| Onboarding | `/onboarding` | Step 1 → Step 2 via Continue | advance | Step counter advances, real content renders | "STEP 1 OF 11" → "STEP 2 OF 11" (Business information form) after clicking Continue with no input required for step 1 | PASS | Verified the first transition only — see Coverage note above for why the remaining 9 steps were not each interactively driven in this pass; STATIC scan already covers 100% of onboarding's hrefs/buttons with zero findings |
| Add Business | `/dashboard/businesses/new` | Page load | navigate | Real form | Loaded 200, zero console/page errors | PASS | |
| All | Every audited surface | Every `<button>` | click | Real onClick, `type="submit"` inside a `<form>`, or `disabled` | Zero inert buttons found after the scanner correctly excluded `<form>`-default-submit buttons (a real false-positive class, fixed in the scanner itself before landing) | PASS | |
| All | Every audited surface | Every `href`/router-call | navigate | Resolves to a real route | Zero broken destinations remaining (4 found and fixed — see FIXED rows above) | PASS | |
| All | `/dashboard/settings`, `/dashboard/settings/profile`, `/dashboard/settings/ai`, `/dashboard/human-workforce/[section]` (employees/hr/payroll/teams) | Page load | render | Clean hydration | Minified React error #418 (hydration mismatch) reproduces consistently (settings pages: 3/3 plan tiers tested); page does not crash, content renders correctly after React's automatic recovery | **KNOWN ISSUE, not fixed** | Root cause not conclusively identified within this pass — attempted with `next dev` but Turbopack's HMR websocket defeats Playwright's `networkidle` wait, and the dev-mode cookie differs from the production-mode cookie captured for this test run. Does not crash, not on the explicit zero-tolerance list. Documented in `docs/CURRENT_STATE.md` as a follow-up. |

## Route inventory

241 routes discovered from `app/` (dashboard + admin + onboaring + top-level
public/account pages). Full machine-readable list is regenerated on every
test run by `scripts/lib/clickability-scanner.mjs`'s `buildRouteSet()` — not
duplicated here as a static list, since it would drift the moment a route is
added or removed. Run `node -e "import('./scripts/lib/clickability-scanner.mjs').then(m=>console.log(m.buildRouteSet(process.cwd(), ['']).length))"` for the current count.

## Integrations classification

| Integration | Classification |
|---|---|
| WhatsApp | CONNECTED/AVAILABLE — real backing API (`/api/integrations/whatsapp`) |
| Email | AVAILABLE — real backing API (`/api/integrations/email`) |
| Website Chat | AVAILABLE — real backing API (`/api/integrations/website-chat`) |
| SMS | NOT_IMPLEMENTED — already correctly marked `coming-soon` before this audit |
| Voice | REQUIRES_EXTERNAL_SETUP — already correctly marked `coming-soon`; real provider setup lives at `/dashboard/settings/voice-providers` |
| Facebook & Instagram (Meta) | NOT_IMPLEMENTED — was misclassified as available; **fixed this pass** |
| Telegram | NOT_IMPLEMENTED — was misclassified as available; **fixed this pass** |
| Calendar, Accounting, CRM, Developer, External Apps | NOT_IMPLEMENTED — already correctly marked "Coming Soon" under "Remaining Integrations" |

## Summary counts

- Total pages audited (STATIC route inventory scope): 241 routes discovered; 4 dashboard/admin/onboarding/components directories fully AST-scanned.
- Total clickable findings (STATIC): 337 (href, href-data, router-call, button).
- LOCAL_BROWSER page loads: 146 sidebar-driven loads (Starter 15 + Growth 29 + Pro 51 + Enterprise 51) + dashboard home ×4 + admin ×4 + business detail ×1 + onboarding ×2 + Add Business ×1 = 158 real browser page loads, 0 non-200, 0 crashes.
- PASS: majority of matrix rows (see table).
- FIXED: 9 distinct defects (Help ×2 call sites, admin marketplace link, Command Center hub ×4 cards, Executive Briefing ×2 buttons, Meta/Telegram ×2 integration cards + pages, isBusinessRole, admin add-member UI). One additional dead component deleted.
- EXTERNAL_DEPENDENCY: 1 (OpenAI-backed Executive Briefing headline/summary — degrades gracefully already).
- HIDDEN_NOT_IMPLEMENTED (already correct before this audit, verified not regressed): Performance/Recruitment cards, Leave approval actions, Payroll calculation actions, SMS/Voice/Calendar/Accounting/CRM/Developer/External-Apps integrations.
- Remaining unexplained FAIL: **0**.
- Known non-blocking issue (not a FAIL, not fixed, documented): React hydration warning #418 on 4 distinct route shapes.
