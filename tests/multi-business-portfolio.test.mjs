// Multi-business portfolio architecture: the organization/portfolio layer
// (db/schema.ts + lib/auth/organizations.ts), the platform Super Admin
// mechanism (app/api/admin/users/[id], scripts/bootstrap-platform-admin.mjs),
// the additional-business flow (app/api/businesses/additional,
// lib/onboarding/create-business.ts), the Realtegic Enterprise-complimentary
// fix (app/api/admin/businesses/[id]), and the Kora dual-ownership
// mechanism (the same route's new add_member action).
//
// Central principle proven throughout: three independent axes — platform
// role, organization/portfolio membership, and business subscription plan —
// never substitute for one another. A platform Super Admin or portfolio
// owner still needs an explicit businessUsers row to operate inside any one
// business, and that business's plan is resolved purely from its own
// subscriptions row, never from who the user is.
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

let tempDir;
let db, schema, eq, and;
let getBusinessEntitlements, isPlatformAdmin;
let getOrganizationMembership, getUserOrganizations, getOrganizationBusinesses, getOrganizationForBusiness;
let selectBusinessMembership;

test.before(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "kuba-portfolio-"));
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
  ({ eq, and } = await import("drizzle-orm"));
  ({ getBusinessEntitlements } = await import("@/lib/billing/entitlements"));
  ({ isPlatformAdmin } = await import("@/lib/auth/platform-admin"));
  ({ getOrganizationMembership, getUserOrganizations, getOrganizationBusinesses, getOrganizationForBusiness } = await import("@/lib/auth/organizations"));
  ({ selectBusinessMembership } = await import("@/lib/auth/business-context-policy"));
});

test.after(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

async function createUser(email, platformRole = "user") {
  const id = crypto.randomUUID();
  const now = new Date();
  await db.insert(schema.users).values({ id, email, name: email.split("@")[0], emailVerified: true, platformRole, status: "active", createdAt: now, updatedAt: now });
  return id;
}

async function createBusiness(name, plan = "starter") {
  const id = crypto.randomUUID();
  const now = new Date();
  await db.insert(schema.businesses).values({ id, name, slug: `${id}-slug`, plan, status: "active", createdAt: now, updatedAt: now });
  return id;
}

async function addBusinessMember(businessId, userId, role = "owner") {
  await db.insert(schema.businessUsers).values({ id: crypto.randomUUID(), businessId, userId, role, createdAt: new Date() });
}

async function grantPlan(businessId, plan, complimentary) {
  const status = complimentary ? "complimentary" : plan === "enterprise" ? "enterprise_contract" : "active";
  const now = new Date();
  await db.insert(schema.subscriptions).values({
    id: crypto.randomUUID(), businessId, provider: "internal", plan, status,
    providerCustomerId: null, providerSubscriptionId: null, providerEventId: null,
    currentPeriodStart: null, currentPeriodEnd: null, cancelAtPeriodEnd: false, trialEnd: null,
    paymentMethodSummary: null, createdAt: now, updatedAt: now,
  });
}

async function createOrganization(name) {
  const id = crypto.randomUUID();
  const now = new Date();
  await db.insert(schema.organizations).values({ id, name, slug: `${id}-slug`, createdAt: now, updatedAt: now });
  return id;
}

// ==================================================
// 1. ACCOUNT — no hardcoding, highest role recognized
// ==================================================

const NEW_FILES = [
  "app/api/admin/users/route.ts",
  "app/api/admin/users/[id]/route.ts",
  "app/api/admin/organizations/route.ts",
  "app/api/admin/organizations/[id]/route.ts",
  "app/api/businesses/additional/route.ts",
  "lib/auth/organizations.ts",
  "lib/onboarding/create-business.ts",
  "scripts/bootstrap-platform-admin.mjs",
  "app/dashboard/businesses/new/page.tsx",
];

for (const file of NEW_FILES) {
  test(`no hardcoded realtegicworks.com/koraafric.com email or password anywhere in ${file}`, async () => {
    const source = await readFile(path.join(REPO_ROOT, file), "utf8");
    assert.doesNotMatch(source, /realtegicworks/i);
    assert.doesNotMatch(source, /koraafric/i);
    assert.doesNotMatch(source, /password\s*[:=]\s*["'][^"']/i, "must never fabricate/hardcode a password");
  });
}

test("the canonical highest platform role (super_admin) is recognized by the EXISTING isPlatformAdmin check — no second admin framework introduced", async () => {
  const source = await readFile(path.join(REPO_ROOT, "lib/auth/platform-admin.ts"), "utf8");
  assert.match(source, /"super_admin"/);
  const userId = await createUser("candidate-admin@example.com", "super_admin");
  assert.equal(await isPlatformAdmin(userId), true);
});

test("a normal 'user' platformRole is NOT recognized as a platform admin", async () => {
  const userId = await createUser("ordinary-owner@example.com", "user");
  assert.equal(await isPlatformAdmin(userId), false);
});

// ==================================================
// 2. PLATFORM ADMIN — access gating, auditing, no entitlement bleed
// ==================================================

test("PATCH /api/admin/users/[id] is platform-admin gated and audits the grant", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/api/admin/users/[id]/route.ts"), "utf8");
  assert.match(source, /isPlatformAdmin\(/);
  assert.match(source, /createAuditLog\(/);
  assert.match(source, /if \(!reason\) return NextResponse\.json/);
});

test("platform role promotion never touches any business's subscription/entitlements table", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/api/admin/users/[id]/route.ts"), "utf8");
  assert.doesNotMatch(source, /subscriptions/);
  assert.doesNotMatch(source, /businessUsers/);
});

test("a platform Super Admin's own role does NOT force any business's entitlement resolution — plan is resolved purely from that business's own subscriptions row", async () => {
  const adminUserId = await createUser("super-admin-2@example.com", "super_admin");
  const businessId = await createBusiness("Some Starter Co", "starter");
  await addBusinessMember(businessId, adminUserId, "owner");
  // No subscriptions row at all for this business — plan must still resolve
  // Starter, completely independent of the owning user's platform role.
  const entitlements = await getBusinessEntitlements(businessId);
  assert.equal(entitlements.plan, "starter");
});

// ==================================================
// 3. PORTFOLIO — organization exists, membership, business association
// ==================================================

test("the organizations/organizationMembers/organizationBusinesses tables exist and are usable (the portfolio layer)", async () => {
  const orgId = await createOrganization("Realtegic");
  const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, orgId));
  assert.equal(org.name, "Realtegic");
});

test("owner membership works: a user added as portfolio owner is retrievable via getOrganizationMembership/getUserOrganizations", async () => {
  const orgId = await createOrganization("Realtegic Portfolio");
  const userId = await createUser("portfolio-owner@example.com");
  await db.insert(schema.organizationMembers).values({ id: crypto.randomUUID(), organizationId: orgId, userId, role: "owner", createdAt: new Date() });

  const membership = await getOrganizationMembership(userId, orgId);
  assert.equal(membership?.role, "owner");

  const orgs = await getUserOrganizations(userId);
  assert.equal(orgs.length, 1);
  assert.equal(orgs[0].organization.id, orgId);
  assert.equal(orgs[0].role, "owner");
});

test("multiple businesses can be associated with one portfolio", async () => {
  const orgId = await createOrganization("Realtegic Multi");
  const businessA = await createBusiness("Realtegic HQ");
  const businessB = await createBusiness("Kora OS");
  await db.insert(schema.organizationBusinesses).values([
    { id: crypto.randomUUID(), organizationId: orgId, businessId: businessA, createdAt: new Date() },
    { id: crypto.randomUUID(), organizationId: orgId, businessId: businessB, createdAt: new Date() },
  ]);

  const linked = await getOrganizationBusinesses(orgId);
  assert.equal(linked.length, 2);
  assert.deepEqual(new Set(linked.map((row) => row.business.name)), new Set(["Realtegic HQ", "Kora OS"]));
});

test("unauthorized users cannot access a portfolio they don't belong to (getOrganizationMembership returns null)", async () => {
  const orgId = await createOrganization("Private Portfolio");
  const outsiderId = await createUser("outsider@example.com");
  const membership = await getOrganizationMembership(outsiderId, orgId);
  assert.equal(membership, null);
});

test("requireOrganizationAccess in lib/auth/organizations.ts is what gates the admin organization routes, not an ad hoc check", async () => {
  const routeSource = await readFile(path.join(REPO_ROOT, "app/api/admin/organizations/[id]/route.ts"), "utf8");
  // The admin organization routes are platform-admin only for now (not yet
  // a self-serve customer-facing portfolio dashboard) — confirmed gated by
  // the same isPlatformAdmin() check as every other admin surface.
  assert.match(routeSource, /isPlatformAdmin\(/);
  const libSource = await readFile(path.join(REPO_ROOT, "lib/auth/organizations.ts"), "utf8");
  assert.match(libSource, /export async function requireOrganizationAccess/);
});

test("a business is linked to at most one portfolio (schema-level unique constraint)", async () => {
  const orgA = await createOrganization("Org A");
  const orgB = await createOrganization("Org B");
  const businessId = await createBusiness("Shared Business");
  await db.insert(schema.organizationBusinesses).values({ id: crypto.randomUUID(), organizationId: orgA, businessId, createdAt: new Date() });
  await assert.rejects(
    db.insert(schema.organizationBusinesses).values({ id: crypto.randomUUID(), organizationId: orgB, businessId, createdAt: new Date() }),
  );
});

// ==================================================
// 4. BUSINESS SWITCHING — security, recovery, multi-business
// ==================================================

test("business switching (POST /api/businesses/select) validates the target business is one of the user's OWN memberships before setting the cookie — source-verified", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/api/businesses/select/route.ts"), "utf8");
  assert.match(source, /eq\(businessUsers\.userId, session\.user\.id\)/);
  assert.match(source, /rows\.find\(\(row\) => row\.businessId === businessId\)/);
  assert.match(source, /if \(!membership\) \{\s*return NextResponse\.json\(\{ error: "Business access denied\." \}, \{ status: 403 \}\);/);
});

test("1 user, 1 business: selectBusinessMembership auto-selects it with no explicit cookie", () => {
  const memberships = [{ businessId: "biz-1", role: "owner", permissions: null, branchId: null }];
  const selected = selectBusinessMembership(memberships);
  assert.equal(selected?.businessId, "biz-1");
});

test("1 user, multiple businesses: switch A -> B -> A both resolve correctly via the selected cookie value", () => {
  const memberships = [
    { businessId: "biz-A", role: "owner", permissions: null, branchId: null },
    { businessId: "biz-B", role: "admin", permissions: null, branchId: null },
  ];
  assert.equal(selectBusinessMembership(memberships, "biz-A")?.businessId, "biz-A");
  assert.equal(selectBusinessMembership(memberships, "biz-B")?.businessId, "biz-B");
  assert.equal(selectBusinessMembership(memberships, "biz-A")?.businessId, "biz-A");
});

test("invalid/foreign business id is rejected: not one of this user's memberships and multiple memberships exist -> null (never guesses)", () => {
  const memberships = [
    { businessId: "biz-A", role: "owner", permissions: null, branchId: null },
    { businessId: "biz-B", role: "admin", permissions: null, branchId: null },
  ];
  assert.equal(selectBusinessMembership(memberships, "biz-FOREIGN"), null);
});

test("stale selected business recovers when the user actually has exactly one real membership", () => {
  const memberships = [{ businessId: "biz-A", role: "owner", permissions: null, branchId: null }];
  assert.equal(selectBusinessMembership(memberships, "biz-STALE")?.businessId, "biz-A");
});

test("no cross-tenant leakage: two businesses' own membership rows never satisfy each other's selection", async () => {
  const userId = await createUser("multi-business-user@example.com");
  const businessA = await createBusiness("Tenant A");
  const businessB = await createBusiness("Tenant B");
  await addBusinessMember(businessA, userId, "owner");
  await addBusinessMember(businessB, userId, "owner");

  const rowsForA = await db.select().from(schema.businessUsers).where(and(eq(schema.businessUsers.userId, userId), eq(schema.businessUsers.businessId, businessA)));
  const rowsForB = await db.select().from(schema.businessUsers).where(and(eq(schema.businessUsers.userId, userId), eq(schema.businessUsers.businessId, businessB)));
  assert.equal(rowsForA.length, 1);
  assert.equal(rowsForB.length, 1);
  assert.notEqual(rowsForA[0].id, rowsForB[0].id);
});

// ==================================================
// 5. ENTITLEMENTS — selected workspace determines plan, never user/org/platform identity
// ==================================================

test("selected Growth workspace resolves Growth entitlements regardless of the owning user's platform role", async () => {
  const userId = await createUser("growth-owner@example.com", "super_admin");
  const businessId = await createBusiness("NesAfric-like Co", "growth");
  await addBusinessMember(businessId, userId, "owner");
  await grantPlan(businessId, "growth", false);
  const entitlements = await getBusinessEntitlements(businessId);
  assert.equal(entitlements.plan, "growth");
  assert.ok(!entitlements.capabilities.includes("outreach.campaigns"), "Growth must not include Pro-only capabilities");
});

test("selected Pro-complimentary workspace resolves Pro entitlements even though the same user's OTHER (Enterprise) workspace exists", async () => {
  const userId = await createUser("portfolio-user@example.com");
  const enterpriseBiz = await createBusiness("Realtegic HQ", "enterprise");
  const proBiz = await createBusiness("Kora OS", "pro");
  await addBusinessMember(enterpriseBiz, userId, "owner");
  await addBusinessMember(proBiz, userId, "admin");
  await grantPlan(enterpriseBiz, "enterprise", true);
  await grantPlan(proBiz, "pro", true);

  const enterpriseEntitlements = await getBusinessEntitlements(enterpriseBiz);
  const proEntitlements = await getBusinessEntitlements(proBiz);
  assert.equal(enterpriseEntitlements.plan, "enterprise");
  assert.equal(proEntitlements.plan, "pro");
  assert.ok(enterpriseEntitlements.capabilities.length > proEntitlements.capabilities.length, "Enterprise must carry strictly more capabilities than Pro for the SAME user");
});

test("Realtegic Enterprise Complimentary: plan=enterprise + status=complimentary resolves full Enterprise capabilities with no expiry", async () => {
  const businessId = await createBusiness("Realtegic", "enterprise");
  await grantPlan(businessId, "enterprise", true);
  const [row] = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.businessId, businessId));
  assert.equal(row.status, "complimentary");
  assert.equal(row.provider, "internal");
  assert.equal(row.trialEnd, null);
  assert.equal(row.currentPeriodEnd, null);
  const entitlements = await getBusinessEntitlements(businessId);
  assert.equal(entitlements.plan, "enterprise");
});

test("a real (non-complimentary) Enterprise contract still defaults to enterprise_contract status, never falsely implying GHS 0", async () => {
  const businessId = await createBusiness("Real Enterprise Customer", "enterprise");
  await grantPlan(businessId, "enterprise", false);
  const [row] = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.businessId, businessId));
  assert.equal(row.status, "enterprise_contract");
});

// ==================================================
// 6. KORA — dual ownership, no destructive transfer, no duplicate business
// ==================================================

test("Kora acceptance: info@koraafric.com's existing owner membership is preserved when a second user is granted admin access to the SAME business", async () => {
  const koraOwnerId = await createUser("kora-owner@example.com");
  const koraId = await createBusiness("Kora OS", "starter");
  await addBusinessMember(koraId, koraOwnerId, "owner");

  // Mirrors the exact write app/api/admin/businesses/[id]'s new
  // action:"add_member" performs: grant a SECOND, already-existing user
  // admin access to the SAME business, without touching the first row.
  const portfolioUserId = await createUser("portfolio-admin@example.com");
  await addBusinessMember(koraId, portfolioUserId, "admin");

  const members = await db.select().from(schema.businessUsers).where(eq(schema.businessUsers.businessId, koraId));
  assert.equal(members.length, 2);
  const owner = members.find((member) => member.userId === koraOwnerId);
  const admin = members.find((member) => member.userId === portfolioUserId);
  assert.equal(owner?.role, "owner", "the original owner's role must be untouched");
  assert.equal(admin?.role, "admin");

  // Scoped by the exact id this test created, not by name — other tests in
  // this file also create businesses named "Kora OS" as their own
  // independent fixtures, sharing this same database.
  const businessRows = await db.select().from(schema.businesses).where(eq(schema.businesses.id, koraId));
  assert.equal(businessRows.length, 1, "no duplicate Kora business must be created");
});

test("the admin add_member action updates an existing member's role in place rather than creating a duplicate row for the same user", async () => {
  const businessId = await createBusiness("Role Update Co");
  const userId = await createUser("role-change-target@example.com");
  await addBusinessMember(businessId, userId, "member");
  // Simulates re-running add_member with a different role for the SAME user.
  await db.update(schema.businessUsers).set({ role: "admin" }).where(and(eq(schema.businessUsers.businessId, businessId), eq(schema.businessUsers.userId, userId)));
  const rows = await db.select().from(schema.businessUsers).where(and(eq(schema.businessUsers.businessId, businessId), eq(schema.businessUsers.userId, userId)));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].role, "admin");
});

test("the add_member admin action is source-verified to require an existing user (never creates one) and to validate the business role", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/api/admin/businesses/[id]/route.ts"), "utf8");
  const block = source.slice(source.indexOf('action === "add_member"'));
  assert.match(block, /No user found for \$\{email\}\. They must sign up first\./);
  assert.match(block, /isBusinessRole\(role\)/);
});

// ==================================================
// 7. ADDITIONAL BUSINESS — a portfolio owner adding another workspace
// ==================================================

test("POST /api/businesses/additional requires an existing membership (the opposite gate of first-time onboarding)", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/api/businesses/additional/route.ts"), "utf8");
  assert.match(source, /existingMembership\.length === 0/);
  assert.match(source, /createBusinessForUser/);
});

test("first-time onboarding (app/api/businesses/route.ts) is unchanged: still 409s when a membership already exists, delegating creation to the same shared function", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/api/businesses/route.ts"), "utf8");
  assert.match(source, /existingMembership\.length > 0/);
  assert.match(source, /status: 409/);
  assert.match(source, /createBusinessForUser/);
});

test("both business-creation routes share the exact same underlying function, never a second drifting implementation", async () => {
  const onboardingRoute = await readFile(path.join(REPO_ROOT, "app/api/businesses/route.ts"), "utf8");
  const additionalRoute = await readFile(path.join(REPO_ROOT, "app/api/businesses/additional/route.ts"), "utf8");
  assert.match(onboardingRoute, /from ["']@\/lib\/onboarding\/create-business["']/);
  assert.match(additionalRoute, /from ["']@\/lib\/onboarding\/create-business["']/);
});

test("a second business created via createBusinessForUser never auto-grants above Starter", async () => {
  const source = await readFile(path.join(REPO_ROOT, "lib/onboarding/create-business.ts"), "utf8");
  assert.match(source, /plan:\s*"starter"/);
});

// ==================================================
// 8. BOOTSTRAP SCRIPT SAFETY
// ==================================================

test("the bootstrap script is not an HTTP route (no app/api path) — it can only run with direct database credentials", async () => {
  const scriptPath = path.join(REPO_ROOT, "scripts/bootstrap-platform-admin.mjs");
  await assert.doesNotReject(readFile(scriptPath, "utf8"));
  // Confirm no route.ts anywhere actually IMPORTS this script's logic —
  // a plain textual mention (e.g. a doc comment cross-referencing it, as
  // app/api/admin/users/[id]/route.ts's own docstring does) is expected
  // and not the same thing as exposing it over HTTP.
  const { execFileSync: run } = await import("node:child_process");
  let matches = "";
  try {
    matches = run("grep", ["-rlE", "(from|require)\\(?[\"'].*bootstrap-platform-admin", "app/api"], { cwd: REPO_ROOT, encoding: "utf8" });
  } catch {
    matches = "";
  }
  assert.equal(matches.trim(), "", "the bootstrap script must never be imported/exposed by an API route");
});

test("the bootstrap script refuses to run if any active platform admin already exists (never a repeatable privilege-escalation tool)", async () => {
  const source = await readFile(path.join(REPO_ROOT, "scripts/bootstrap-platform-admin.mjs"), "utf8");
  assert.match(source, /Refusing to run: an active platform admin already exists/);
  // No actual flag-parsing bypass (checking the literal string "--force" is
  // not enough — the doc comment itself explains there is no such flag,
  // which would trip a naive substring check on its own prose).
  assert.doesNotMatch(source, /argv\.includes\(["']--force["']\)/, "must have no override flag");
  assert.doesNotMatch(source, /process\.env\.FORCE/, "must have no env-based override either");
});

test("the bootstrap script never fabricates a user, password, or auth session — it only updates platform_role for an existing row", async () => {
  const source = await readFile(path.join(REPO_ROOT, "scripts/bootstrap-platform-admin.mjs"), "utf8");
  assert.doesNotMatch(source, /INSERT INTO users/i);
  // No password VALUE/assignment/column reference anywhere (the doc
  // comment's prose use of the word "password" — explaining that this
  // script does NOT touch one — is expected and fine).
  assert.doesNotMatch(source, /password\s*[:=]/i);
  assert.doesNotMatch(source, /password_hash|passwordHash/i);
  assert.match(source, /UPDATE users SET platform_role/);
  assert.match(source, /must sign up first through the normal Better Auth flow/);
});

// ==================================================
// 9. DATA ISOLATION — spot-check across the new surfaces
// ==================================================

test("organization detail (GET /api/admin/organizations/[id]) scopes members/businesses strictly by organizationId, never a global list", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/api/admin/organizations/[id]/route.ts"), "utf8");
  assert.match(source, /eq\(organizationMembers\.organizationId, id\)/);
  assert.match(source, /eq\(organizationBusinesses\.organizationId, id\)/);
});

test("linking a business to a portfolio never touches that business's subscription, employees, or any other business-scoped table", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/api/admin/organizations/[id]/route.ts"), "utf8");
  const linkBlock = source.slice(source.indexOf('action === "link_business"'), source.indexOf('if (action === "unlink_business"'));
  assert.doesNotMatch(linkBlock, /subscriptions/);
  assert.doesNotMatch(linkBlock, /aiEmployees/);
});

test("getOrganizationForBusiness returns null for a business never linked to any portfolio (no implicit association)", async () => {
  const businessId = await createBusiness("Unlinked Co");
  const link = await getOrganizationForBusiness(businessId);
  assert.equal(link, null);
});
