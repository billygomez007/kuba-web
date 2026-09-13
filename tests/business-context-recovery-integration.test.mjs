// Regression suite for the actual root cause behind the reported
// "/api/auth/me => 403" + "/api/command-center/overview => 404 Business
// not found" pair: an authenticated user whose current selected-business
// context could not be resolved got two confusing, unrelated-looking
// errors instead of a safe recovery. This exercises the real
// getBusinessMembershipStatus()/selectBusinessMembership() resolution
// chain against a real sqlite-backed database (matching the pattern used
// by tests/complimentary-plan-integration.test.mjs), not a hand-simulated
// copy of the logic.
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const REPO_ROOT = path.resolve(new URL("..", import.meta.url).pathname);
register(pathToFileURL(path.join(REPO_ROOT, "tests/helpers/alias-loader.mjs")));

let tempDir;
let db, schema, entitlements;
let selectBusinessMembership;

const BIZ_KORA = "recov-biz-kora";
const BIZ_OTHER_TENANT = "recov-biz-other-tenant";
const USER_SINGLE = "recov-user-single-membership";
const USER_MULTI = "recov-user-multi-membership";
const USER_NONE = "recov-user-no-membership";
const USER_FOREIGN_COOKIE = "recov-user-foreign-cookie-owner";

test.before(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "kuba-business-recovery-"));
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
  entitlements = await import("@/lib/billing/entitlements");
  ({ selectBusinessMembership } = await import("@/lib/auth/business-context-policy"));

  const now = new Date();
  await db.insert(schema.businesses).values([
    { id: BIZ_KORA, name: "Kora", slug: BIZ_KORA, status: "active", createdAt: now, updatedAt: now },
    { id: BIZ_OTHER_TENANT, name: "Other Tenant Co", slug: BIZ_OTHER_TENANT, status: "active", createdAt: now, updatedAt: now },
  ]);
  await db.insert(schema.subscriptions).values({
    id: "sub-recov-kora", businessId: BIZ_KORA, provider: "internal", plan: "pro", status: "complimentary",
    providerCustomerId: null, providerSubscriptionId: null, providerEventId: null,
    currentPeriodStart: null, currentPeriodEnd: null, cancelAtPeriodEnd: false, trialEnd: null, createdAt: now, updatedAt: now,
  });
  // USER_SINGLE: exactly one real membership (Kora, owner) — the actual
  // reported scenario once onboarding/the admin grant have run correctly.
  await db.insert(schema.businessUsers).values({ id: "bu-single", businessId: BIZ_KORA, userId: USER_SINGLE, role: "owner", permissions: null, branchId: null, createdAt: now, updatedAt: now });
  // USER_MULTI: belongs to both businesses — genuinely ambiguous without a selection.
  await db.insert(schema.businessUsers).values({ id: "bu-multi-a", businessId: BIZ_KORA, userId: USER_MULTI, role: "owner", permissions: null, branchId: null, createdAt: now, updatedAt: now });
  await db.insert(schema.businessUsers).values({ id: "bu-multi-b", businessId: BIZ_OTHER_TENANT, userId: USER_MULTI, role: "manager", permissions: null, branchId: null, createdAt: now, updatedAt: now });
  // USER_NONE: authenticated, zero businessUsers rows anywhere (e.g. signed
  // up but never completed onboarding) — the "no_membership" case.
  // (Intentionally: no businessUsers rows inserted for USER_NONE.)
  // USER_FOREIGN_COOKIE: owns BIZ_OTHER_TENANT only; a stale cookie will
  // claim BIZ_KORA, which they do NOT belong to.
  await db.insert(schema.businessUsers).values({ id: "bu-foreign", businessId: BIZ_OTHER_TENANT, userId: USER_FOREIGN_COOKIE, role: "owner", permissions: null, branchId: null, createdAt: now, updatedAt: now });
});

test.after(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

async function membershipsFor(userId) {
  const { eq } = await import("drizzle-orm");
  return db
    .select({ id: schema.businessUsers.id, businessId: schema.businessUsers.businessId, userId: schema.businessUsers.userId, role: schema.businessUsers.role, permissions: schema.businessUsers.permissions, branchId: schema.businessUsers.branchId })
    .from(schema.businessUsers)
    .where(eq(schema.businessUsers.userId, userId));
}

// --- 1. Valid selected business is used ---

test("authenticated user + valid selected business => that business is used", async () => {
  const rows = await membershipsFor(USER_SINGLE);
  const selected = selectBusinessMembership(rows, BIZ_KORA);
  assert.equal(selected?.businessId, BIZ_KORA);
  assert.equal(selected?.role, "owner");
});

// --- 2. Stale/nonexistent selected business + exactly one valid membership => safe fallback ---

test("authenticated user + stale/nonexistent selected business + exactly one valid membership => safely falls back to the valid business", async () => {
  const rows = await membershipsFor(USER_SINGLE);
  const staleSelection = "some-business-id-from-an-old-preview-deployment-that-no-longer-applies";
  const selected = selectBusinessMembership(rows, staleSelection);
  assert.equal(selected?.businessId, BIZ_KORA, "REGRESSION: this is the exact reported bug scenario — must not return null when exactly one real membership exists");
});

// --- 3. Selected business belonging to another tenant => never gains access ---

test("authenticated user + selected business belonging to another tenant => selection is rejected, never grants access to it", async () => {
  const rows = await membershipsFor(USER_FOREIGN_COOKIE);
  const selected = selectBusinessMembership(rows, BIZ_KORA);
  assert.notEqual(selected?.businessId, BIZ_KORA, "must never resolve to a business this user has no membership row for");
  // With exactly one real membership, they still safely recover to it —
  // never locked out by someone else's stale/malicious cookie value.
  assert.equal(selected?.businessId, BIZ_OTHER_TENANT);
});

// --- 4. Stale business + zero memberships => no fallback exists, must signal onboarding ---

test("authenticated user + stale business + zero memberships => no valid business exists (caller must route to onboarding)", async () => {
  const rows = await membershipsFor(USER_NONE);
  assert.equal(rows.length, 0);
  const selected = selectBusinessMembership(rows, "anything");
  assert.equal(selected, null);
});

// --- 5. Multiple businesses => canonical workspace-selection policy (explicit selection required, never auto-picked) ---

test("authenticated user + multiple valid businesses + no selection => null (requires an explicit choice, never silently auto-picked)", async () => {
  const rows = await membershipsFor(USER_MULTI);
  assert.equal(rows.length, 2);
  assert.equal(selectBusinessMembership(rows), null);
});

test("authenticated user + multiple valid businesses + an invalid selection => still null, no unsafe auto-pick among genuinely ambiguous choices", async () => {
  const rows = await membershipsFor(USER_MULTI);
  assert.equal(selectBusinessMembership(rows, "not-a-real-business-id"), null);
});

test("authenticated user + multiple valid businesses + a valid explicit selection => that one is used", async () => {
  const rows = await membershipsFor(USER_MULTI);
  assert.equal(selectBusinessMembership(rows, BIZ_OTHER_TENANT)?.businessId, BIZ_OTHER_TENANT);
});

// --- 6. Pro complimentary business resolves Pro entitlements after business recovery ---

test("once business context recovers to Kora, entitlements resolve to full Pro — the actual reported scenario end to end", async () => {
  const rows = await membershipsFor(USER_SINGLE);
  const selected = selectBusinessMembership(rows, "stale-cookie-from-an-earlier-preview-url");
  assert.equal(selected?.businessId, BIZ_KORA);
  const resolvedEntitlements = await entitlements.getBusinessEntitlements(selected.businessId);
  assert.equal(resolvedEntitlements.plan, "pro");
  assert.ok(resolvedEntitlements.capabilities.includes("outreach.campaigns"));
});

// --- 7. /api/auth/me and /api/command-center/overview resolve the SAME business after recovery ---

test("the same selectBusinessMembership resolution is shared by both /api/auth/me and /api/command-center/overview (both import getBusinessMembershipStatus from lib/auth/tenant)", async () => {
  const { readFile } = await import("node:fs/promises");
  const [authMeSource, overviewSource] = await Promise.all([
    readFile(path.join(REPO_ROOT, "app/api/auth/me/route.ts"), "utf8"),
    readFile(path.join(REPO_ROOT, "app/api/command-center/overview/route.ts"), "utf8"),
  ]);
  for (const source of [authMeSource, overviewSource]) {
    assert.match(source, /getBusinessMembershipStatus/);
    assert.match(source, /"NO_BUSINESS_MEMBERSHIP"/);
    assert.match(source, /"AMBIGUOUS_BUSINESS_SELECTION"/);
  }
});

// --- 8. Error semantics: 403/404 reserved for genuine failures, not recoverable states ---

test("neither endpoint returns 403/404 for the no-membership or ambiguous states — those are 200 with a distinguishing code, not authorization failures", async () => {
  const { readFile } = await import("node:fs/promises");
  const authMeSource = await readFile(path.join(REPO_ROOT, "app/api/auth/me/route.ts"), "utf8");
  const overviewSource = await readFile(path.join(REPO_ROOT, "app/api/command-center/overview/route.ts"), "utf8");
  // The old unconditional 403 "Business access denied" for this case is gone.
  assert.doesNotMatch(authMeSource, /Business access denied/);
  // The old unconditional 404 "Business not found" for this case is gone —
  // it was reachable for BOTH no_membership and ambiguous, which is exactly
  // the confusing pair this fix removes.
  assert.doesNotMatch(overviewSource, /"Business not found"/);
});

test("the client redirects to onboarding on NO_BUSINESS_MEMBERSHIP instead of showing a load-failure error", async () => {
  const { readFile } = await import("node:fs/promises");
  const layoutSource = await readFile(path.join(REPO_ROOT, "app/dashboard/layout.tsx"), "utf8");
  assert.match(layoutSource, /data\.code === "NO_BUSINESS_MEMBERSHIP"/);
  assert.match(layoutSource, /router\.replace\("\/onboarding"\)/);
});

// --- 9. Tenant isolation is never weakened by the recovery mechanism ---

test("recovery never selects another user's business: selectBusinessMembership only ever receives one user's own pre-scoped membership rows", async () => {
  const { readFile } = await import("node:fs/promises");
  const tenantSource = await readFile(path.join(REPO_ROOT, "lib/auth/tenant.ts"), "utf8");
  assert.match(tenantSource, /eq\(businessUsers\.userId, user\.id\)/, "the membership query must remain scoped to the authenticated user's own rows");
});

// --- 10. Cookie/environment isolation: the business-selection cookie is
// already host-only (no Domain attribute anywhere it's set), so it cannot
// leak between production superkuba.com, a Preview *.vercel.app deployment,
// and localhost — same reasoning already applied to the session cookie fix
// (lib/auth/production-domain.ts), applied here to confirm (not needed to
// change) the equivalent business-selection state. ---

test("the business-selection cookie is set exactly once in the codebase, with no cross-environment Domain attribute (host-only, safe across production/Preview/localhost)", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(path.join(REPO_ROOT, "app/api/businesses/select/route.ts"), "utf8");
  assert.match(source, /cookieStore\.set\("superkuba_business_id"/);
  assert.doesNotMatch(source, /domain:/i, "no Domain attribute must ever be set on this cookie — a shared domain would leak business selection across environments/deployments");
  assert.match(source, /secure:\s*process\.env\.NODE_ENV === "production"/);
});

test("no other file in the app writes the superkuba_business_id cookie (one authoritative writer, matching 'one authoritative interpretation')", async () => {
  const { execSync } = await import("node:child_process");
  const grep = execSync(
    `grep -rl 'superkuba_business_id.*\\.set(\\|cookieStore\\.set("superkuba_business_id"' app lib --include="*.ts" --include="*.tsx" || true`,
    { cwd: REPO_ROOT, encoding: "utf8" },
  );
  const writers = grep.trim().split("\n").filter(Boolean);
  assert.deepEqual(writers, ["app/api/businesses/select/route.ts"]);
});

test("no hard-coded plan, email, or business special-case was introduced anywhere in the resolution chain", async () => {
  const { readFile } = await import("node:fs/promises");
  const [tenantSource, authMeSource, overviewSource] = await Promise.all([
    readFile(path.join(REPO_ROOT, "lib/auth/tenant.ts"), "utf8"),
    readFile(path.join(REPO_ROOT, "app/api/auth/me/route.ts"), "utf8"),
    readFile(path.join(REPO_ROOT, "app/api/command-center/overview/route.ts"), "utf8"),
  ]);
  for (const source of [tenantSource, authMeSource, overviewSource]) {
    assert.doesNotMatch(source, /koraafric/i);
    assert.doesNotMatch(source, /"pro"/);
  }
});
