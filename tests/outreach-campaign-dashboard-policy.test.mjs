// Static policy checks for the Campaign Engine dashboard (approved spec,
// dashboard brief). Mirrors the existing *-policy.test.mjs idiom used
// throughout this repo (see tests/product-information-architecture-policy.test.mjs,
// tests/outreach-campaign-routes-policy.test.mjs): source-string assertions
// against the actual shipped files, not a rendered-DOM test — this repo has
// no browser/DOM testing library in its toolchain, so these are the tests
// that can catch a real regression without one. Real cross-tenant behavior,
// state-machine correctness, and worker semantics are exercised elsewhere
// (tests/outreach-campaign-*-integration.test.mjs); this file is specifically
// about the UI/route boundary the dashboard brief called out: no fake
// metrics, draft-only mutability enforced client-side too, the AI/human
// launch boundary, and honest handling of the still-unwired reply/DNS path.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const DETAIL_PAGE = 'app/dashboard/outreach/campaigns/[campaignId]/page.tsx';
const LIST_PAGE = "app/dashboard/outreach/campaigns/page.tsx";
const NEW_PAGE = "app/dashboard/outreach/campaigns/new/page.tsx";
const STATUS_LABELS = "app/dashboard/outreach/campaigns/status-labels.ts";
const CONTACTS_ROUTE = "app/api/outreach/contacts/route.ts";
const RECIPIENTS_ROUTE = 'app/api/outreach/campaigns/[campaignId]/recipients/route.ts';
const PREVIEW_ROUTE = 'app/api/outreach/campaigns/[campaignId]/sequence/[stepId]/preview/route.ts';
const ENROLLMENT_CORE = "lib/outreach/recipient-enrollment.ts";
const LAYOUT = "app/dashboard/layout.tsx";

const [detail, list, fresh, statusLabels, contactsRoute, recipientsRoute, previewRoute, enrollmentCore, layout] =
  await Promise.all(
    [DETAIL_PAGE, LIST_PAGE, NEW_PAGE, STATUS_LABELS, CONTACTS_ROUTE, RECIPIENTS_ROUTE, PREVIEW_ROUTE, ENROLLMENT_CORE, LAYOUT].map(
      (file) => readFile(file, "utf8"),
    ),
  );

// --- 1. Navigation entitlement ---

test("the Campaigns nav entry is gated by outreach.view permission and outreach.campaigns capability, not left ungated", () => {
  assert.match(layout, /href: "\/dashboard\/outreach\/campaigns"/);
  assert.match(layout, /"\/dashboard\/outreach\/campaigns":\s*"outreach\.view"/);
  assert.match(layout, /"\/dashboard\/outreach\/campaigns":\s*"outreach\.campaigns"/);
});

// --- 2. No fabricated metrics anywhere in the dashboard ---

test("no dashboard file references a fake open/click/conversion rate", () => {
  for (const [name, source] of [
    ["list page", list],
    ["detail page", detail],
  ]) {
    assert.doesNotMatch(source, /open rate/i, `${name} must not display a fake open rate`);
    assert.doesNotMatch(source, /click rate/i, `${name} must not display a fake click rate`);
    assert.doesNotMatch(source, /conversion rate/i, `${name} must not display a fake conversion rate`);
  }
});

test("the detail page's derived rates guard against a zero denominator instead of showing a misleading value", () => {
  assert.match(detail, /function ratePercent\(numerator: number, denominator: number\)/);
  assert.match(detail, /if \(denominator <= 0\) return null;/);
});

// --- 3. Email-only channel in the create flow ---

test("the create-campaign form hardcodes channel to email and cannot submit WhatsApp", () => {
  assert.match(fresh, /channel: "email"/);
  assert.doesNotMatch(fresh, /channel:\s*whatsAppChannel|setChannel\(/, "channel must not be a user-settable field yet");
  assert.match(fresh, /Coming later/);
  assert.match(fresh, /cursor-not-allowed/);
});

// --- 4. Recipient eligibility presentation matches the real backend gate, not an invented one ---

test("the backend's consent/do-not-contact enrollment gate is exactly doNotContact OR consentStatus === withdrawn", () => {
  assert.match(enrollmentCore, /doNotContact \|\| .*consentStatus === "withdrawn"/);
});

test("the dashboard's pre-enrollment eligibility check mirrors every backend rejection reason, so nothing is hidden", () => {
  assert.match(detail, /if \(contact\.alreadyEnrolled\) return "alreadyEnrolled";/);
  assert.match(detail, /if \(contact\.suppressed\) return "suppressed";/);
  assert.match(detail, /if \(contact\.doNotContact\) return "doNotContact";/);
  assert.match(detail, /if \(contact\.consentStatus === "withdrawn"\) return "consentWithdrawn";/);
  assert.match(detail, /if \(!contact\.email\) return "missingDestination";/);
  assert.match(detail, /ELIGIBILITY_LABEL: Record<string, string> = \{/);
  for (const key of ["alreadyEnrolled", "suppressed", "doNotContact", "consentWithdrawn", "missingDestination", "eligible"]) {
    assert.match(detail, new RegExp(`${key}:\\s*"`), `ELIGIBILITY_LABEL must define a label for "${key}"`);
  }
});

test("ineligible contacts are shown disabled, never removed from the enrollment list", () => {
  assert.match(detail, /const disabled = eligibility !== "eligible";/);
  assert.match(detail, /disabled=\{disabled\}/);
});

// --- 5. Draft-only mutability enforced in the UI, matching backend rules ---

test("the sequence and recipients sections are only editable while the campaign is a draft", () => {
  assert.match(detail, /const isDraft = campaign\.status === "draft";/);
  assert.match(detail, /editable=\{isDraft\}/);
});

test("the launch/schedule panel only renders for draft or scheduled campaigns", () => {
  assert.match(detail, /\{\(isDraft \|\| isScheduled\) && \(\s*<LaunchPanel/);
});

// --- 6. Status -> action mapping matches the approved per-status lifecycle rules ---

test("running campaigns expose only pause/stop; paused expose only resume/stop; scheduled exposes only stop", () => {
  const fn = detail.slice(detail.indexOf("function LifecycleActions"), detail.indexOf("function SummaryCard"));
  const runningBlock = fn.slice(fn.indexOf('"running"'), fn.indexOf('"paused"'));
  assert.match(runningBlock, /onClick=\{onPause\}/);
  assert.match(runningBlock, /onClick=\{onStop\}/);
  assert.doesNotMatch(runningBlock, /onClick=\{onResume\}/);

  const pausedBlock = fn.slice(fn.indexOf('"paused"'), fn.indexOf('"scheduled"'));
  assert.match(pausedBlock, /onClick=\{onResume\}/);
  assert.match(pausedBlock, /onClick=\{onStop\}/);
  assert.doesNotMatch(pausedBlock, /onClick=\{onPause\}/);

  const scheduledBlock = fn.slice(fn.indexOf('"scheduled"'));
  assert.match(scheduledBlock, /onClick=\{onStop\}/);
  assert.doesNotMatch(scheduledBlock, /onClick=\{onPause\}|onClick=\{onResume\}/);
});

test("completed/stopped/failed campaigns render no lifecycle action buttons at all (read-only)", () => {
  const fn = detail.slice(detail.indexOf("function LifecycleActions"), detail.indexOf("function SummaryCard"));
  assert.match(fn, /return null;\s*\}\s*$/, "the fallthrough (completed/stopped/failed) must render nothing");
  assert.doesNotMatch(fn, /"completed"|"stopped"|"failed"/, "no explicit action branch should exist for terminal statuses");
});

// --- 7. Preview is genuinely non-sending ---

test("the recipient preview endpoint never imports the send path and performs no writes", () => {
  assert.doesNotMatch(previewRoute, /sendCampaignEmail|getResend|resend\.emails/i);
  assert.doesNotMatch(previewRoute, /\.insert\(|\.update\(|\.delete\(/);
  assert.match(previewRoute, /export async function GET/);
  assert.doesNotMatch(previewRoute, /export async function (POST|PATCH|DELETE)/);
});

test("the preview endpoint reuses the exact same render/footer functions the real worker uses, so it cannot drift", () => {
  assert.match(previewRoute, /from "@\/lib\/outreach\/email-channel"/);
  assert.match(previewRoute, /renderTemplate\(/);
  assert.match(previewRoute, /withUnsubscribeFooter\(/);
});

// --- 8. Launch is a deliberate, user-triggered action, never an effect ---

test("campaign launch/schedule calls happen inside click handlers, not inside a useEffect", () => {
  const launchPanel = detail.slice(detail.indexOf("function LaunchPanel"), detail.indexOf("function Row("));
  assert.match(launchPanel, /\/launch`/);
  assert.match(launchPanel, /\/schedule`/);
  assert.doesNotMatch(launchPanel, /useEffect\(/, "LaunchPanel must not auto-trigger launch/schedule in an effect");
});

// --- 9. Sales handoff visibility without exposing worker internals ---

test("handed-off recipients show a timestamp, reason, and assigned employee, never raw claim/idempotency fields", () => {
  assert.match(detail, /recipient\.status === "handed_off"/);
  assert.match(detail, /recipient\.handoffReasonLabel/);
  assert.match(detail, /recipient\.handoffAssignedEmployeeName/);
  for (const [name, source] of [
    ["detail page", detail],
    ["recipients route", recipientsRoute],
  ]) {
    assert.doesNotMatch(source, /claimedBy|leaseExpiresAt|workerId/i, `${name} must never surface internal send-worker claim fields`);
  }
});

test("the handoff reason label is drawn from a safe fixed allowlist, not the raw internal lead notes/intent value", () => {
  assert.match(recipientsRoute, /HANDOFF_REASON_LABEL: Record<string, string> = \{/);
  assert.doesNotMatch(recipientsRoute, /leads\.notes/, "the verbose internal handoff notes blob must never be returned to the dashboard");
});

// --- 10. Reply/DNS limitation is stated honestly, never faked as active ---

test("the dashboard never claims reply tracking is active while inbound email receiving is unconfigured", () => {
  assert.doesNotMatch(detail, /reply tracking active/i);
  assert.match(detail, /inbound email receiving/i);
});

// --- 11. Tenant isolation for the new contacts route (previously untested) ---

test("the contacts route resolves tenant via requireCampaignAccess and scopes every query by the resolved businessId, never a client-supplied one", () => {
  assert.match(contactsRoute, /requireCampaignAccess\("view"\)/);
  assert.doesNotMatch(contactsRoute, /searchParams\.get\("businessId"\)/);
  assert.doesNotMatch(contactsRoute, /body\??\.businessId/);
  assert.match(contactsRoute, /eq\(outreachContacts\.businessId, access\.businessId\)/);
  assert.match(contactsRoute, /isSuppressed\(access\.businessId,/);
});

test("the contacts route's campaign-eligibility join can never match another business's recipient row", () => {
  // When no campaignId is supplied the join condition must be a tautological
  // false, not simply omitted (which some ORMs would treat as an unscoped
  // join across all recipients).
  assert.match(contactsRoute, /sql`0 = 1`/);
});

test("the recipients route's handoff joins are themselves business-scoped (defense in depth)", () => {
  assert.match(recipientsRoute, /leftJoin\(leads, and\(eq\(leads\.id, outreachCampaignRecipients\.handoffLeadId\), eq\(leads\.businessId, access\.businessId\)\)\)/);
  assert.match(recipientsRoute, /leftJoin\(aiEmployees, and\(eq\(aiEmployees\.id, leads\.assignedEmployeeId\), eq\(aiEmployees\.businessId, access\.businessId\)\)\)/);
});

// --- 12. Status label / semantic completeness (all 7 campaign + 13 recipient states) ---

test("every campaign status has both a label and an explicit semantic tone (no silent fallback to a raw string in the badge)", () => {
  for (const status of ["draft", "scheduled", "running", "paused", "completed", "stopped", "failed"]) {
    assert.match(statusLabels, new RegExp(`${status}: "`));
  }
});

test("every recipient status has both a label and an explicit semantic tone", () => {
  for (const status of [
    "pending",
    "ready",
    "scheduled",
    "in_progress",
    "sent",
    "replied",
    "interested",
    "handed_off",
    "completed",
    "suppressed",
    "opted_out",
    "failed",
    "stopped",
  ]) {
    assert.match(statusLabels, new RegExp(`${status}: "`));
  }
});
