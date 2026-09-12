// Static policy checks for the Outreach Campaign Engine's cron endpoint and
// unsubscribe route. Mirrors tests/whatsapp-webhook-policy.test.mjs's style:
// these assert invariants about route source without executing them
// through the Next.js runtime.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const CRON_ROUTE = "app/api/outreach/campaigns/cron/process-sends/route.ts";
const UNSUBSCRIBE_ROUTE = "app/api/outreach/unsubscribe/route.ts";
const RECONCILE_TRIALS_ROUTE = "app/api/billing/cron/reconcile-trials/route.ts";
const VERCEL_CONFIG = "vercel.json";

let cronSource;
let unsubscribeSource;
let reconcileTrialsSource;

test.before(async () => {
  cronSource = await readFile(CRON_ROUTE, "utf8");
  unsubscribeSource = await readFile(UNSUBSCRIBE_ROUTE, "utf8");
  reconcileTrialsSource = await readFile(RECONCILE_TRIALS_ROUTE, "utf8");
});

test("the campaign cron endpoint follows the existing CRON_SECRET Bearer convention, not a weaker one", () => {
  assert.match(cronSource, /process\.env\.CRON_SECRET/);
  assert.match(cronSource, /authHeader !== `Bearer \$\{secret\}`/);
  assert.match(reconcileTrialsSource, /process\.env\.CRON_SECRET/);
  assert.match(reconcileTrialsSource, /authHeader !== `Bearer \$\{secret\}`/);
});

test("an unauthorized cron request is rejected before any campaign/send work happens", () => {
  const authCheckIndex = cronSource.indexOf('return NextResponse.json({ error: "Unauthorized" }');
  const claimIndex = cronSource.indexOf("claimDueSends(");
  assert.ok(authCheckIndex > -1 && claimIndex > -1);
  assert.ok(authCheckIndex < claimIndex);
});

test("the cron endpoint claims a bounded batch and never loops internally", () => {
  assert.match(cronSource, /DEFAULT_CLAIM_BATCH_SIZE/);
  assert.doesNotMatch(cronSource, /while\s*\(\s*true\s*\)/);
  assert.doesNotMatch(cronSource, /for\s*\(\s*;;\s*\)/);
});

test("one send's processing failure cannot abort the rest of the cron batch", () => {
  assert.match(cronSource, /for \(const sendId of claimedSendIds\)/);
  const forIndex = cronSource.indexOf("for (const sendId of claimedSendIds)");
  const tryIndex = cronSource.indexOf("try {", forIndex);
  assert.ok(tryIndex > forIndex, "processing each claimed send must be wrapped in its own try/catch");
});

test("the campaign cron endpoint is registered in vercel.json", async () => {
  const config = JSON.parse(await readFile(VERCEL_CONFIG, "utf8"));
  const entry = config.crons.find((item) => item.path === "/api/outreach/campaigns/cron/process-sends");
  assert.ok(entry, "expected the campaign cron to be registered");
});

test("unsubscribing is authorized solely by the signed token, never a raw recipient id from the query string", () => {
  assert.match(unsubscribeSource, /verifyUnsubscribeToken\(token\)/);
  assert.doesNotMatch(unsubscribeSource, /searchParams\.get\("recipientId"\)/);
  assert.doesNotMatch(unsubscribeSource, /searchParams\.get\("businessId"\)/);
});

test("unsubscribe requires no authentication (a prospect never has a SuperKuba account)", () => {
  assert.doesNotMatch(unsubscribeSource, /auth\.api\.getSession/);
});

test("unsubscribe always records a durable suppression, independent of whether the recipient row lookup succeeds", () => {
  const suppressionIndex = unsubscribeSource.indexOf("addSuppression(");
  const recipientLookupIndex = unsubscribeSource.indexOf("outreachCampaignRecipients.id, payload.recipientId");
  assert.ok(suppressionIndex > -1 && recipientLookupIndex > -1);
  assert.ok(suppressionIndex < recipientLookupIndex, "suppression must be recorded before the best-effort recipient-state update, not depend on it");
});
