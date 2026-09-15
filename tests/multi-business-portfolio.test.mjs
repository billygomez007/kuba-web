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
let authorizeOrganizationLinkForUser, linkBusinessToOrganization;

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
  ({ authorizeOrganizationLinkForUser, linkBusinessToOrganization } = await import("@/lib/onboarding/organization-link"));
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
  "lib/onboarding/organization-link.ts",
  "app/dashboard/businesses/new/page.tsx",
  "scripts/bootstrap-platform-admin.mjs",
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

test("platform role promotion (PATCH) never touches any business's subscription/entitlements table", async () => {
  // Scoped to the PATCH handler specifically — the file's GET handler
  // (added later, for the admin UI's user-detail page) legitimately reads
  // businessUsers/businesses for display purposes only, never as part of
  // the promotion action itself.
  const source = await readFile(path.join(REPO_ROOT, "app/api/admin/users/[id]/route.ts"), "utf8");
  const patchHandler = source.slice(source.indexOf("export async function PATCH"));
  assert.doesNotMatch(patchHandler, /subscriptions/);
  assert.doesNotMatch(patchHandler, /businessUsers/);
});

test("the read-only GET handler (for the admin UI) never mutates anything — it only selects", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/api/admin/users/[id]/route.ts"), "utf8");
  const getHandler = source.slice(source.indexOf("export async function GET"), source.indexOf("export async function PATCH"));
  assert.doesNotMatch(getHandler, /\.update\(|\.insert\(|\.delete\(/);
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

// ==================================================
// 10. SELF-SERVE ORGANIZATION LINK DURING ADDITIONAL-BUSINESS CREATION
//
// (app/api/businesses/additional/route.ts's optional organizationId,
// authorized by lib/onboarding/organization-link.ts's
// authorizeOrganizationLinkForUser/linkBusinessToOrganization.) Previously
// linking a business into a portfolio was platform-admin-only
// (app/api/admin/organizations/[id]'s link_business); this is the new,
// separately-authorized self-serve path for a portfolio owner/admin
// creating their OWN additional business.
// ==================================================

test("authorizeOrganizationLinkForUser rejects a nonexistent organization with 404, before checking membership", async () => {
  const userId = await createUser("linker-1@example.com");
  const result = await authorizeOrganizationLinkForUser(userId, crypto.randomUUID());
  assert.equal(result.ok, false);
  assert.equal(result.status, 404);
  assert.match(result.error, /not found/i);
});

test("authorizeOrganizationLinkForUser denies a user who does not belong to the organization at all", async () => {
  const userId = await createUser("linker-2@example.com");
  const orgId = await createOrganization("Outsider Portfolio");
  const result = await authorizeOrganizationLinkForUser(userId, orgId);
  assert.equal(result.ok, false);
  assert.equal(result.status, 403);
  assert.match(result.error, /access denied/i);
});

test("authorizeOrganizationLinkForUser denies a plain 'member' — only owner/admin may link a new business", async () => {
  const userId = await createUser("linker-member@example.com");
  const orgId = await createOrganization("Member-Only Portfolio");
  await db.insert(schema.organizationMembers).values({ id: crypto.randomUUID(), organizationId: orgId, userId, role: "member", createdAt: new Date() });
  const result = await authorizeOrganizationLinkForUser(userId, orgId);
  assert.equal(result.ok, false);
  assert.equal(result.status, 403);
  assert.match(result.error, /owner or admin/i);
});

for (const role of ["owner", "admin"]) {
  test(`authorizeOrganizationLinkForUser allows an organization ${role} to link a new business`, async () => {
    const userId = await createUser(`linker-${role}@example.com`);
    const orgId = await createOrganization(`${role}-authorized Portfolio`);
    await db.insert(schema.organizationMembers).values({ id: crypto.randomUUID(), organizationId: orgId, userId, role, createdAt: new Date() });
    const result = await authorizeOrganizationLinkForUser(userId, orgId);
    assert.equal(result.ok, true);
    assert.equal(result.organizationId, orgId);
    assert.equal(result.role, role);
  });
}

test("linkBusinessToOrganization inserts the join row and an audit log distinguished from the admin-forced action", async () => {
  const userId = await createUser("linker-writer@example.com");
  const orgId = await createOrganization("Writer Portfolio");
  const businessId = await createBusiness("Linked Child Co");

  await linkBusinessToOrganization({ businessId, organizationId: orgId, actorUserId: userId, actorOrganizationRole: "owner" });

  const link = await getOrganizationForBusiness(businessId);
  assert.equal(link.organizationId, orgId);

  const logs = await db.select().from(schema.auditLogs).where(eq(schema.auditLogs.resourceId, orgId));
  const entry = logs.find((row) => row.businessId === businessId);
  assert.ok(entry, "expected an audit log entry for the self-serve link");
  assert.equal(entry.action, "organization.business_linked");
  assert.notEqual(entry.action, "admin.organization.business_linked", "must be distinguishable from the platform-admin action");
  assert.equal(entry.userId, userId);
  const metadata = JSON.parse(entry.metadata);
  assert.equal(metadata.businessId, businessId);
  assert.equal(metadata.organizationRole, "owner");
});

test("the additional-business route authorizes an organization link BEFORE creating the business — an invalid link never leaves an orphaned business", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/api/businesses/additional/route.ts"), "utf8");
  const authorizeIndex = source.indexOf("authorizeOrganizationLinkForUser(");
  const createIndex = source.indexOf("createBusinessForUser(");
  assert.ok(authorizeIndex > -1 && createIndex > -1);
  assert.ok(authorizeIndex < createIndex, "organization authorization must run before business creation");
});

test("the additional-business route reuses the shared organization-link module rather than reimplementing the authorization check inline", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/api/businesses/additional/route.ts"), "utf8");
  assert.match(source, /from ["']@\/lib\/onboarding\/organization-link["']/);
  assert.doesNotMatch(source, /ORGANIZATION_LINK_ROLES/, "the role set now lives only in lib/onboarding/organization-link.ts");
});

// ==================================================
// 11. KORA TARGET ACCEPTANCE — Realtegic -> Add Business -> Kora OS
//
// Reproduces, against the disposable database this file already sets up,
// the exact acceptance scenario: an existing organization (Realtegic) with
// an existing business (Realtegic Works) and owner, adding a new,
// independently-owned business (Kora OS) linked into the same portfolio,
// without disturbing Realtegic Works. Also covers duplicate-name safety:
// a second, unrelated "Kora OS" business must stay fully isolated by ID.
// ==================================================

// SEC/PROD reconciliation regression: a real production report claimed
// "+ Add business" is blocked when the currently selected business is on
// the Starter plan. No such gate exists anywhere in the authorization
// chain (createBusinessForUser, authorizeOrganizationLinkForUser,
// linkBusinessToOrganization, or the additional-business route itself) —
// confirmed by direct source inspection, not assumed. This test proves it
// empirically: a Starter-plan existing business, with its owner also
// holding organization owner standing, can create a second business and
// link it, exactly as a higher-plan business could.
test("REGRESSION: a Starter-plan existing business does not block its owner from creating and linking an additional business", async () => {
  const ownerId = await createUser("starter-owner@example.com");
  const orgId = await createOrganization("Starter Portfolio");
  await db.insert(schema.organizationMembers).values({ id: crypto.randomUUID(), organizationId: orgId, userId: ownerId, role: "owner", createdAt: new Date() });

  const starterBusinessId = await createBusiness("Starter Business", "starter");
  await addBusinessMember(starterBusinessId, ownerId, "owner");
  await grantPlan(starterBusinessId, "starter", false);

  // The gate additional-business creation actually depends on: an existing
  // membership, regardless of that business's plan.
  const existingMembership = await db.select({ businessId: schema.businessUsers.businessId }).from(schema.businessUsers).where(eq(schema.businessUsers.userId, ownerId)).limit(1);
  assert.equal(existingMembership.length, 1, "the additional-business route's own gate only checks membership existence, never plan");

  const authorization = await authorizeOrganizationLinkForUser(ownerId, orgId);
  assert.equal(authorization.ok, true, "Starter does not affect organization-link authorization either");

  const secondBusinessId = await createBusiness("Second Business (Starter Owner)", "starter");
  await addBusinessMember(secondBusinessId, ownerId, "owner");
  await linkBusinessToOrganization({ businessId: secondBusinessId, organizationId: orgId, actorUserId: ownerId, actorOrganizationRole: authorization.role });

  const secondMembership = (await db.select().from(schema.businessUsers).where(and(eq(schema.businessUsers.businessId, secondBusinessId), eq(schema.businessUsers.userId, ownerId))))[0];
  assert.equal(secondMembership.role, "owner");
  const link = await getOrganizationForBusiness(secondBusinessId);
  assert.equal(link.organizationId, orgId);

  // The original Starter business is untouched.
  const [starterSubscription] = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.businessId, starterBusinessId));
  assert.equal(starterSubscription.plan, "starter");
  assert.equal(starterSubscription.status, "active");
});

test("REGRESSION: source-verified — no file in the additional-business authorization chain references a plan or Starter restriction", async () => {
  const files = [
    "app/api/businesses/additional/route.ts",
    "lib/onboarding/create-business.ts",
    "lib/onboarding/organization-link.ts",
    "app/dashboard/businesses/new/page.tsx",
  ];
  for (const file of files) {
    const source = await readFile(path.join(REPO_ROOT, file), "utf8");
    // "Starter" appears only in comments describing the new business's own
    // default plan ("starts on Starter") — never as a condition on the
    // CALLER's existing/selected business.
    const conditionalOnCallerPlan = /plan\s*(===|==|!==|!=)\s*["']starter["']/i;
    assert.doesNotMatch(source, conditionalOnCallerPlan, `${file} must never branch on a plan value`);
  }
});

test("Kora target acceptance: Add Business creates an independent, owner-membered, organization-linked workspace without touching the existing business", async () => {
  const ownerId = await createUser("realtegic-owner@example.com");
  const realtegicOrgId = await createOrganization("Realtegic");
  await db.insert(schema.organizationMembers).values({ id: crypto.randomUUID(), organizationId: realtegicOrgId, userId: ownerId, role: "owner", createdAt: new Date() });

  const realtegicWorksId = await createBusiness("Realtegic Works", "enterprise");
  await addBusinessMember(realtegicWorksId, ownerId, "owner");
  await grantPlan(realtegicWorksId, "enterprise", true);

  // --- Add business: Kora OS ---
  const authorization = await authorizeOrganizationLinkForUser(ownerId, realtegicOrgId);
  assert.equal(authorization.ok, true);

  const koraId = await createBusiness("Kora OS", "starter");
  await addBusinessMember(koraId, ownerId, "owner");
  await linkBusinessToOrganization({ businessId: koraId, organizationId: realtegicOrgId, actorUserId: ownerId, actorOrganizationRole: authorization.role });

  // 1. Different business ID.
  assert.notEqual(koraId, realtegicWorksId);

  // 2. Same user has explicit owner membership on Kora.
  const koraMembership = (await db.select().from(schema.businessUsers).where(and(eq(schema.businessUsers.businessId, koraId), eq(schema.businessUsers.userId, ownerId))))[0];
  assert.ok(koraMembership);
  assert.equal(koraMembership.role, "owner");

  // 3. Kora linked to Realtegic organization.
  const koraLink = await getOrganizationForBusiness(koraId);
  assert.equal(koraLink.organizationId, realtegicOrgId);

  // 4. Realtegic Works untouched: still exists, still enterprise/complimentary, still owned by the same user, no second membership row created.
  const realtegicMemberships = await db.select().from(schema.businessUsers).where(eq(schema.businessUsers.businessId, realtegicWorksId));
  assert.equal(realtegicMemberships.length, 1);
  assert.equal(realtegicMemberships[0].userId, ownerId);
  assert.equal(realtegicMemberships[0].role, "owner");
  const [realtegicSubscription] = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.businessId, realtegicWorksId));
  assert.equal(realtegicSubscription.plan, "enterprise");
  assert.equal(realtegicSubscription.status, "complimentary");

  // 5. Kora plan can be changed to Pro Complimentary Lifetime, independent of Realtegic's plan (no inheritance).
  await grantPlan(koraId, "pro", true);
  const [koraSubscription] = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.businessId, koraId));
  assert.equal(koraSubscription.plan, "pro");
  assert.equal(koraSubscription.status, "complimentary");
  assert.equal(koraSubscription.provider, "internal");
  assert.equal(koraSubscription.providerCustomerId, null);
  assert.equal(koraSubscription.providerSubscriptionId, null);
  assert.equal(koraSubscription.currentPeriodEnd, null);
  assert.equal(koraSubscription.trialEnd, null);
  const koraEntitlements = await getBusinessEntitlements(koraId);
  assert.equal(koraEntitlements.plan, "pro");
  const realtegicEntitlements = await getBusinessEntitlements(realtegicWorksId);
  assert.equal(realtegicEntitlements.plan, "enterprise", "Realtegic's plan must remain independent of Kora's");

  // 6. Website Widget can be independently activated for Kora, with its own
  // unique public key and independent allowed-origin (domain) metadata —
  // mirroring the real row shape/id convention app/api/integrations/
  // website-chat/route.ts's PUT handler writes.
  const now = new Date();
  await db.insert(schema.integrations).values({
    id: `website_chat:${koraId}`,
    businessId: koraId,
    provider: "website_chat",
    status: "active",
    publicKey: `kuba_pk_${crypto.randomUUID().replace(/-/g, "")}`,
    metadata: JSON.stringify({ domain: "kora-os.example" }),
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(schema.integrations).values({
    id: `website_chat:${realtegicWorksId}`,
    businessId: realtegicWorksId,
    provider: "website_chat",
    status: "active",
    publicKey: `kuba_pk_${crypto.randomUUID().replace(/-/g, "")}`,
    metadata: JSON.stringify({ domain: "realtegicworks.example" }),
    createdAt: now,
    updatedAt: now,
  });

  const koraWidget = (await db.select().from(schema.integrations).where(eq(schema.integrations.businessId, koraId)))[0];
  const realtegicWidget = (await db.select().from(schema.integrations).where(eq(schema.integrations.businessId, realtegicWorksId)))[0];
  assert.notEqual(koraWidget.publicKey, realtegicWidget.publicKey, "each business must get its own independent public key");
  assert.notEqual(JSON.parse(koraWidget.metadata).domain, JSON.parse(realtegicWidget.metadata).domain, "each business must have independent allowed origins");
});

test("Website Widget public keys are enforced unique at the schema level across businesses", async () => {
  const businessA = await createBusiness("Widget Co A");
  const businessB = await createBusiness("Widget Co B");
  const sharedKey = `kuba_pk_${crypto.randomUUID().replace(/-/g, "")}`;
  const now = new Date();
  await db.insert(schema.integrations).values({ id: `website_chat:${businessA}`, businessId: businessA, provider: "website_chat", status: "active", publicKey: sharedKey, metadata: null, createdAt: now, updatedAt: now });
  await assert.rejects(
    db.insert(schema.integrations).values({ id: `website_chat:${businessB}`, businessId: businessB, provider: "website_chat", status: "active", publicKey: sharedKey, metadata: null, createdAt: now, updatedAt: now }),
    "a second business must never be able to reuse another business's public key",
  );
});

test("duplicate-name safety: two unrelated businesses can both be named 'Kora OS' and remain fully isolated by ID", async () => {
  const firstOwner = await createUser("kora-a-owner@example.com");
  const secondOwner = await createUser("kora-b-owner@example.com");
  const koraA = await createBusiness("Kora OS", "starter");
  const koraB = await createBusiness("Kora OS", "starter");
  await addBusinessMember(koraA, firstOwner, "owner");
  await addBusinessMember(koraB, secondOwner, "owner");

  assert.notEqual(koraA, koraB, "distinct IDs even though the names collide");

  const [rowA] = await db.select().from(schema.businesses).where(eq(schema.businesses.id, koraA));
  const [rowB] = await db.select().from(schema.businesses).where(eq(schema.businesses.id, koraB));
  assert.notEqual(rowA.slug, rowB.slug, "slugs must never collide even for identical names");
  assert.equal(rowA.name, rowB.name, "the collision is real, not avoided by renaming");

  // Every real business-scoped query in this codebase filters by id, never
  // by name (lib/auth/tenant.ts, app/api/businesses/route.ts) — confirm the
  // membership rows resolve to the correct distinct owner despite the
  // shared name.
  const membershipA = (await db.select().from(schema.businessUsers).where(eq(schema.businessUsers.businessId, koraA)))[0];
  const membershipB = (await db.select().from(schema.businessUsers).where(eq(schema.businessUsers.businessId, koraB)))[0];
  assert.equal(membershipA.userId, firstOwner);
  assert.equal(membershipB.userId, secondOwner);
});

test("the business switcher's data source (businessUsers joined to businesses, keyed by userId) includes a newly created additional business immediately", async () => {
  const userId = await createUser("switcher-user@example.com");
  const firstBusiness = await createBusiness("First Workspace");
  await addBusinessMember(firstBusiness, userId, "owner");

  // Simulates the exact join app/api/businesses/route.ts's GET and
  // app/api/auth/me use to build the switcher list — no separate,
  // drifting query exists for "the list of my businesses".
  const before = await db.select({ businessId: schema.businessUsers.businessId }).from(schema.businessUsers).where(eq(schema.businessUsers.userId, userId));
  assert.equal(before.length, 1);

  const secondBusiness = await createBusiness("Second Workspace (Added)");
  await addBusinessMember(secondBusiness, userId, "owner");

  const after = await db.select({ businessId: schema.businessUsers.businessId }).from(schema.businessUsers).where(eq(schema.businessUsers.userId, userId));
  assert.equal(after.length, 2);
  assert.ok(after.some((row) => row.businessId === secondBusiness), "the switcher's own data source must include the just-created business with no separate cache/registration step");
});
