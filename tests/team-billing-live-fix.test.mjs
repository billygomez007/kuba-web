// Regression suite for the SECOND live-Preview bug report: after the
// navigation 500 was fixed, "Settings → Team & Staff" and "Settings →
// Billing & Subscription" were both still broken in the real deployed
// browser. Two independent, proven root causes:
//
// 1. TEAM & STAFF: app/api/ai-employees/route.ts exported only POST. The
//    Team & Staff page (and the voice-testing console, the simulator, and
//    campaign creation) already did a plain GET there expecting
//    { employees: [...] } for the CURRENT selected business. With no GET
//    handler, Next.js auto-generates a 405 with a non-JSON body, so every
//    one of those `response.json()` calls threw — surfacing as a generic,
//    unattributed load failure instead of the employees list.
//
// 2. BILLING & SUBSCRIPTION: lib/billing/usage.ts's getBusinessUsage()
//    queried outreach_campaign_recipients/outreach_campaign_sends
//    (migration 0043 — immediately before 0044, already proven missing
//    from at least one environment by the prior navigation-500 fix) with
//    no error handling, and app/api/billing/usage/route.ts had no
//    try/catch around it either. A database behind on 0043 would 500 the
//    Billing page's one and only load-time dependency unconditionally,
//    regardless of the business's real plan/subscription state.
//
// (2) was proven via a real reproduction during this fix's investigation:
// bootstrapping a database from db/schema.ts as it existed immediately
// before the Outreach Campaign Engine commit (efe8b75), i.e. genuinely
// missing those two tables, then calling the real getBusinessUsage()
// against it — it threw exactly `no such table: outreach_campaign_
// recipients`, and the fix below converts that into "not currently
// tracked" metrics instead. Persisting that schema-swap reproduction as a
// per-test CI mechanic would be slow and fragile (see the same tradeoff
// already made in tests/navigation-graceful-degradation.test.mjs), so the
// permanent tests here lock in the fix at the source level plus exercise
// the function's real, already-current-schema behavior against a normal
// bootstrapped database.
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const REPO_ROOT = path.resolve(new URL("..", import.meta.url).pathname);
register(pathToFileURL(path.join(REPO_ROOT, "tests/helpers/alias-loader.mjs")));

// ==================================================
// 1. TEAM & STAFF — the missing GET handler
// ==================================================

test("REGRESSION: /api/ai-employees now exports a GET handler alongside POST (previously POST-only, causing every GET caller's response.json() to throw on the framework's auto-405)", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/api/ai-employees/route.ts"), "utf8");
  assert.match(source, /export async function GET\(\)/);
  assert.match(source, /export async function POST\(/);
});

test("REGRESSION: the new GET handler resolves the CURRENT selected business via requireBusinessMembership — the same resolver its own POST handler already uses — never a hardcoded or legacy resolver", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/api/ai-employees/route.ts"), "utf8");
  const getFn = source.slice(source.indexOf("export async function GET()"), source.indexOf("export async function POST("));
  assert.match(getFn, /requireBusinessMembership\(\)/);
  assert.match(getFn, /eq\(aiEmployees\.businessId, membership\.businessId\)/);
});

test("REGRESSION: the new GET handler 401s an unauthenticated caller and 403s a caller with no current business, before ever querying aiEmployees", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/api/ai-employees/route.ts"), "utf8");
  const getFn = source.slice(source.indexOf("export async function GET()"), source.indexOf("export async function POST("));
  assert.match(getFn, /status: 401/);
  assert.match(getFn, /status: 403/);
  const unauthorizedIndex = getFn.indexOf("status: 401");
  const queryIndex = getFn.indexOf("db\n      .select()");
  assert.ok(unauthorizedIndex > -1 && queryIndex > unauthorizedIndex, "the business query must come after the auth/membership checks, not before");
});

test("every other page that already did a plain GET against /api/ai-employees is fixed by the same change (voice-testing, simulator, campaign creation)", async () => {
  const callers = [
    "app/dashboard/workforce/voice-testing/page.tsx",
    "app/dashboard/workforce/simulator/page.tsx",
    "app/dashboard/outreach/campaigns/new/page.tsx",
  ];
  for (const file of callers) {
    const source = await readFile(path.join(REPO_ROOT, file), "utf8");
    assert.match(source, /fetch\("\/api\/ai-employees"/);
  }
});

// ==================================================
// 2. TEAM & STAFF — diagnostic surfacing (Part 3)
// ==================================================

test("the Team & Staff page attributes a load failure to its exact endpoint, HTTP status and server message, instead of a generic message", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/dashboard/settings/team/page.tsx"), "utf8");
  assert.match(source, /loadFailure\.endpoint/);
  assert.match(source, /loadFailure\.status/);
  assert.match(source, /loadFailure\.message/);
});

test("the Team & Staff page offers a Retry action that re-runs the load, not just a static error message", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/dashboard/settings/team/page.tsx"), "utf8");
  assert.match(source, /onClick=\{\(\) => void loadTeam\(\)\}/);
});

test("a JSON-parse failure on any Team & Staff dependency (e.g. a non-JSON 405 body) is caught per-endpoint and never escapes as an unattributed exception", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/dashboard/settings/team/page.tsx"), "utf8");
  const helper = source.slice(source.indexOf("async function loadEndpoint"), source.indexOf("export default function TeamPage"));
  assert.match(helper, /catch \{/);
  assert.match(helper, /non-JSON response/);
});

test("only /api/team/members is a hard dependency for Team & Staff — every other endpoint degrades to an empty/default state rather than blocking the page", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/dashboard/settings/team/page.tsx"), "utf8");
  const loadFn = source.slice(source.indexOf("async function loadTeam"), source.indexOf("useEffect(() => {"));
  assert.match(loadFn, /if \(!membersResult\.ok\) \{/);
  assert.match(loadFn, /teamsResult\.ok \? teamsResult\.data\?\.teams \|\| \[\] : \[\]/);
});

// ==================================================
// 3. BILLING & SUBSCRIPTION — schema-drift graceful degradation
// ==================================================

test("REGRESSION (proven via a real missing-table reproduction during this fix's investigation — see the file header): getBusinessUsage wraps its queries in a try/catch, never letting a schema-drift exception (e.g. migration 0043's outreach_campaign_* tables missing) escape unhandled", async () => {
  const source = await readFile(path.join(REPO_ROOT, "lib/billing/usage.ts"), "utf8");
  const fn = source.slice(source.indexOf("export async function getBusinessUsage"));
  assert.match(fn, /try \{/);
  assert.match(fn, /catch \(usageError\)/);
  assert.match(fn, /console\.error\(/);
});

test("REGRESSION: the getBusinessUsage fallback path returns the exact same field shape as the success path (every metric present as { used, limit, state }), so the Billing page never sees an unexpected shape", async () => {
  const source = await readFile(path.join(REPO_ROOT, "lib/billing/usage.ts"), "utf8");
  const fn = source.slice(source.indexOf("export async function getBusinessUsage"));
  const catchBlock = fn.slice(fn.indexOf("catch (usageError)"));
  for (const field of ["employees", "conversations", "messages", "automations", "automationRuns", "voiceMinutes", "voiceCalls", "knowledgeSources", "integrations", "modelTokens", "campaignRecipients", "campaignSends"]) {
    assert.match(catchBlock, new RegExp(`${field}:`), `fallback usage object is missing the "${field}" field the success path always returns`);
  }
});

test("REGRESSION: /api/billing/usage now has a top-level try/catch (previously unguarded — any unexpected exception produced a framework HTML error page instead of the route's own JSON error shape)", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/api/billing/usage/route.ts"), "utf8");
  assert.match(source, /export async function GET\(\) \{\s*\n\s*try \{/);
  assert.match(source, /catch \(error\) \{\s*\n\s*console\.error\("Load billing usage error:"/);
});

test("REGRESSION: /api/billing/subscription's POST now has a top-level try/catch for the same defense-in-depth reason", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/api/billing/subscription/route.ts"), "utf8");
  assert.match(source, /export async function POST\(request: Request\) \{\s*\n\s*try \{/);
  assert.match(source, /catch \(error\) \{\s*\n\s*console\.error\("Billing subscription cancellation error:"/);
});

// ==================================================
// 4. Real DB-backed null/empty-state audit (Part 10)
// ==================================================

let tempDir;
let db, schema;
let getBusinessUsage;
let getPlanDefinition;

test.before(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "kuba-team-billing-live-fix-"));
  const databasePath = path.join(tempDir, "database.db");
  execFileSync("node", [path.join(REPO_ROOT, "scripts/bootstrap-clean-database.mjs")], {
    cwd: REPO_ROOT,
    env: { ...process.env, CLEAN_BOOTSTRAP_DATABASE_URL: `file:${databasePath}`, CLEAN_BOOTSTRAP_KEEP: "1" },
    stdio: "pipe",
  });
  process.env.TURSO_DATABASE_URL = `file:${databasePath}`;
  process.env.TURSO_AUTH_TOKEN = "";

  ({ db } = await import("@/db"));
  schema = await import("@/db/schema");
  ({ getBusinessUsage } = await import("@/lib/billing/usage"));
  ({ getPlanDefinition } = await import("@/lib/billing/plan-definitions"));
});

test.after(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

async function createBusiness(name, plan = "starter") {
  const id = crypto.randomUUID();
  const now = new Date();
  await db.insert(schema.businesses).values({ id, name, slug: `${id}-slug`, plan, status: "active", createdAt: now, updatedAt: now });
  return id;
}

test("a Starter business with no subscription row at all still computes real usage cleanly on a fully-migrated database — the account's actual reported state", async () => {
  const businessId = await createBusiness("Usage No Subscription Co", "starter");
  const plan = getPlanDefinition("starter");
  const usage = await getBusinessUsage(businessId, plan);
  assert.equal(usage.employees.used, 0);
  assert.equal(usage.employees.limit, 1);
  assert.equal(usage.conversations.used, 0);
  assert.equal(usage.campaignRecipients.used, 0);
});

test("a business with an active AI employee is reflected in usage without error (the fix only changes the FAILURE path, not the success path)", async () => {
  const businessId = await createBusiness("Usage Active Employee Co", "starter");
  const now = new Date();
  await db.insert(schema.aiEmployees).values({ id: crypto.randomUUID(), businessId, branchId: null, templateId: null, name: "Kuba Sales", type: "sales", description: null, supervisionMode: "owner_supervised", supervisorUserId: crypto.randomUUID(), status: "active", mastraAgentId: null, createdAt: now, updatedAt: now });
  const usage = await getBusinessUsage(businessId, getPlanDefinition("starter"));
  assert.equal(usage.employees.used, 1);
});
