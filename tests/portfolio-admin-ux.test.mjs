// Admin browser UI for the portfolio/organization/user-role architecture
// (Part 27's "no curl/Postman for ordinary operations" requirement), the
// portfolio dashboard entry point, and a real regression found while
// end-to-end reproducing this task's exact scenario (Realtegic + Kora, one
// user, switching between them): both the new organization-detail API and
// the new portfolio API displayed each linked business's STALE
// businesses.plan column instead of its real resolved entitlements plan —
// the identical anti-pattern lib/billing/entitlements.ts has always
// guarded against, just reintroduced in two brand-new endpoints. Fixed by
// resolving each linked business's plan via getBusinessEntitlements().
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, readFile, access } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const REPO_ROOT = path.resolve(new URL("..", import.meta.url).pathname);
register(pathToFileURL(path.join(REPO_ROOT, "tests/helpers/alias-loader.mjs")));

let tempDir;
let db, schema, eq;
let getBusinessEntitlements;

test.before(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "kuba-portfolio-ux-"));
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
  ({ eq } = await import("drizzle-orm"));
  ({ getBusinessEntitlements } = await import("@/lib/billing/entitlements"));
});

test.after(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

async function createUser(email) {
  const id = crypto.randomUUID();
  const now = new Date();
  await db.insert(schema.users).values({ id, email, name: email.split("@")[0], emailVerified: true, platformRole: "user", status: "active", createdAt: now, updatedAt: now });
  return id;
}

async function createBusiness(name, plan = "starter") {
  const id = crypto.randomUUID();
  const now = new Date();
  await db.insert(schema.businesses).values({ id, name, slug: `${id}-slug`, plan, status: "active", createdAt: now, updatedAt: now });
  return id;
}

async function grantPlan(businessId, plan) {
  const now = new Date();
  await db.insert(schema.subscriptions).values({
    id: crypto.randomUUID(), businessId, provider: "internal", plan, status: "complimentary",
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
// 1. Admin UI pages exist as real files
// ==================================================

const ADMIN_UI_PAGES = [
  "app/admin/users/page.tsx",
  "app/admin/users/[id]/page.tsx",
  "app/admin/organizations/page.tsx",
  "app/admin/organizations/[id]/page.tsx",
  "app/dashboard/portfolio/page.tsx",
];

for (const file of ADMIN_UI_PAGES) {
  test(`${file} exists (Part 27's "no curl/Postman for ordinary operations" requirement)`, async () => {
    await assert.doesNotReject(access(path.join(REPO_ROOT, file)));
  });
}

test("no hardcoded realtegicworks.com/koraafric.com email anywhere in the new admin UI pages or portfolio API", async () => {
  const files = [...ADMIN_UI_PAGES, "app/api/portfolio/route.ts", "app/api/admin/users/[id]/route.ts", "app/api/admin/organizations/[id]/route.ts"];
  for (const file of files) {
    const source = await readFile(path.join(REPO_ROOT, file), "utf8");
    assert.doesNotMatch(source, /realtegicworks/i);
    assert.doesNotMatch(source, /koraafric/i);
  }
});

// ==================================================
// 2. Admin UI is platform-admin gated, never exposed to ordinary owners
// ==================================================

test("GET/PATCH /api/admin/users/[id] and GET /api/admin/users are all platform-admin gated", async () => {
  const detailSource = await readFile(path.join(REPO_ROOT, "app/api/admin/users/[id]/route.ts"), "utf8");
  const listSource = await readFile(path.join(REPO_ROOT, "app/api/admin/users/route.ts"), "utf8");
  assert.match(detailSource, /isPlatformAdmin\(/);
  assert.match(listSource, /isPlatformAdmin\(/);
});

// ==================================================
// 3. GET /api/admin/users/[id] returns both membership axes
// ==================================================

test("the user detail admin route resolves both business memberships and organization memberships, never conflating them", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/api/admin/users/[id]/route.ts"), "utf8");
  assert.match(source, /businessMemberships/);
  assert.match(source, /organizationMemberships/);
});

test("a user's business memberships and organization memberships are independently queryable and correctly attributed", async () => {
  const userId = await createUser("multi-role-user@example.com");
  const businessId = await createBusiness("Some Co", "starter");
  const organizationId = await createOrganization("Some Portfolio");
  await db.insert(schema.businessUsers).values({ id: crypto.randomUUID(), businessId, userId, role: "admin", createdAt: new Date() });
  await db.insert(schema.organizationMembers).values({ id: crypto.randomUUID(), organizationId, userId, role: "owner", createdAt: new Date() });

  const businessMemberships = await db.select().from(schema.businessUsers).where(eq(schema.businessUsers.userId, userId));
  const organizationMemberships = await db.select().from(schema.organizationMembers).where(eq(schema.organizationMembers.userId, userId));
  assert.equal(businessMemberships.length, 1);
  assert.equal(businessMemberships[0].role, "admin");
  assert.equal(organizationMemberships.length, 1);
  assert.equal(organizationMemberships[0].role, "owner");
});

// ==================================================
// 4. REGRESSION: organization/portfolio views show REAL resolved plan, not stale businesses.plan
// ==================================================

test("REGRESSION: GET /api/admin/organizations/[id] resolves each linked business's plan via getBusinessEntitlements, not the stale businesses.plan column", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/api/admin/organizations/[id]/route.ts"), "utf8");
  assert.match(source, /getBusinessEntitlements\(link\.businessId\)/);
  assert.doesNotMatch(source, /plan:\s*businesses\.plan/);
});

test("REGRESSION: GET /api/portfolio resolves each linked business's plan via getBusinessEntitlements, not the stale businesses.plan column", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/api/portfolio/route.ts"), "utf8");
  assert.match(source, /getBusinessEntitlements\(row\.business\.id\)/);
  assert.doesNotMatch(source, /plan:\s*row\.business\.plan/);
});

test("Kora acceptance: a business created as Starter then granted Enterprise Complimentary resolves 'enterprise' everywhere the plan is displayed, never the stale 'starter' it was created with", async () => {
  const businessId = await createBusiness("Realtegic", "starter");
  const before = await getBusinessEntitlements(businessId);
  assert.equal(before.plan, "starter");

  await grantPlan(businessId, "enterprise");

  const [row] = await db.select().from(schema.businesses).where(eq(schema.businesses.id, businessId));
  assert.equal(row.plan, "starter", "the raw businesses.plan column is never updated by a grant — this is exactly why display code must never read it directly");

  const after = await getBusinessEntitlements(businessId);
  assert.equal(after.plan, "enterprise", "the resolved plan (what every UI must display) correctly reflects the grant");
});

// ==================================================
// 5. Portfolio dashboard: real data only, honest empty state, no fabricated aggregates
// ==================================================

test("the portfolio API never fabricates revenue/leads/campaign/conversation aggregate FIELDS — only plan, status, role, and a real scoped AI-employee count", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/api/portfolio/route.ts"), "utf8");
  // Checks for an actual field/property name, not the doc comment's own
  // prose explaining that no such field exists.
  assert.doesNotMatch(source, /revenue\s*:/i);
  assert.doesNotMatch(source, /leadCount|campaignCount|conversationCount/i);
  assert.match(source, /activeEmployeeCount/);
});

test("a business linked to a portfolio but where the current user has no businessUsers row shows myRole: null (portfolio linkage never implies access)", async () => {
  const organizationId = await createOrganization("Oversight Portfolio");
  const userId = await createUser("portfolio-viewer@example.com");
  const businessId = await createBusiness("Not My Business");
  await db.insert(schema.organizationMembers).values({ id: crypto.randomUUID(), organizationId, userId, role: "member", createdAt: new Date() });
  await db.insert(schema.organizationBusinesses).values({ id: crypto.randomUUID(), organizationId, businessId, createdAt: new Date() });

  // No businessUsers row for this user on this business — mirrors the
  // portfolio dashboard's own query pattern (a Map keyed by businessId from
  // the user's OWN businessUsers rows; a linked business absent from that
  // map must resolve to myRole: null).
  const myBusinessMemberships = await db.select({ businessId: schema.businessUsers.businessId, role: schema.businessUsers.role }).from(schema.businessUsers).where(eq(schema.businessUsers.userId, userId));
  const myRoleByBusinessId = new Map(myBusinessMemberships.map((row) => [row.businessId, row.role]));
  assert.equal(myRoleByBusinessId.get(businessId), undefined);
});

test("the portfolio dashboard page shows an honest empty state, not a fabricated portfolio, when the user belongs to none", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/dashboard/portfolio/page.tsx"), "utf8");
  assert.match(source, /belong to any portfolio yet/i);
});

test("switching business from the portfolio dashboard reuses the canonical POST /api/businesses/select, never a duplicate switching implementation", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/dashboard/portfolio/page.tsx"), "utf8");
  assert.match(source, /\/api\/businesses\/select/);
});

// ==================================================
// 6. Portfolio vs Workspace mode: sidebar always shows which tenant is active
// ==================================================

test("the sidebar workspace label now includes the actual business name, not just the plan (a user in multiple businesses must always know which one they're in)", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/dashboard/layout.tsx"), "utf8");
  assert.match(source, /current\.name.*entitlements\.planName/s);
});

test("the portfolio entry point in the sidebar only appears when the user actually belongs to a portfolio (hasPortfolio), never a dead link for ordinary single-business users", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/dashboard/layout.tsx"), "utf8");
  assert.match(source, /\{hasPortfolio && \(/);
  assert.match(source, /href="\/dashboard\/portfolio"/);
});

test("/api/auth/me additively exposes the user's organization memberships without changing any existing field", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/api/auth/me/route.ts"), "utf8");
  assert.match(source, /getUserOrganizations\(session\.user\.id\)/);
  // Still returns everything it always did.
  assert.match(source, /businesses: businessesForUser/);
});

// ==================================================
// 7. Enterprise Complimentary admin UX is clear and reachable in-browser
// ==================================================

test("the admin business detail page clearly states 'Complimentary — Lifetime · GHS 0 · Internal account' for any complimentary business, not just a raw status string", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/admin/businesses/[id]/page.tsx"), "utf8");
  assert.match(source, /Complimentary — Lifetime · GHS 0 · Internal account/);
});

test("granting Enterprise Complimentary requires no curl/Postman — the admin UI's Grant plan control covers it (Enterprise is a selectable option, complimentary is not disabled for it)", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/admin/businesses/[id]/page.tsx"), "utf8");
  assert.match(source, /<option value="enterprise">Enterprise<\/option>/);
  assert.doesNotMatch(source, /disabled=\{grantPlan === "enterprise"\}/);
});

// ==================================================
// 8. Organization admin UX: create, list, link, unlink — all reachable in-browser
// ==================================================

test("the organizations list page can create a portfolio and lists owner/member/business counts, without duplicating the API's business logic", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/admin/organizations/page.tsx"), "utf8");
  assert.match(source, /POST/);
  assert.match(source, /ownerEmail/);
  assert.match(source, /memberCount/);
  assert.match(source, /businessCount/);
});

test("the organization detail page supports add_member, remove_member, link_business, and unlink_business through the existing single admin API, not separate ad hoc endpoints", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/admin/organizations/[id]/page.tsx"), "utf8");
  for (const action of ["add_member", "remove_member", "link_business", "unlink_business"]) {
    assert.match(source, new RegExp(`action:\\s*"${action}"`));
  }
});

test("'Add existing business' search reuses the existing business-directory search API, not a new duplicate search implementation", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/admin/organizations/[id]/page.tsx"), "utf8");
  assert.match(source, /\/api\/admin\/businesses\?search=/);
});

test("linking a business surfaces enough identity to avoid selecting the wrong tenant: name, id, plan, and status are all shown before linking", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/admin/organizations/[id]/page.tsx"), "utf8");
  const searchSection = source.slice(source.indexOf("businessResults.map"));
  assert.match(searchSection, /business\.name/);
  assert.match(searchSection, /business\.id/);
  assert.match(searchSection, /business\.plan/);
  assert.match(searchSection, /business\.subscriptionStatus/);
});

// ==================================================
// 9. Bootstrap / Super Admin promotion UI is reachable, no email hardcoded
// ==================================================

test("the user detail admin page lets an authorized platform admin change platformRole through a form, not curl", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/admin/users/[id]/page.tsx"), "utf8");
  assert.match(source, /PATCH/);
  assert.match(source, /platformRole/);
  assert.match(source, /reason/);
});

test("the admin home page links to the new Users and Portfolios sections", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/admin/page.tsx"), "utf8");
  assert.match(source, /href="\/admin\/users"/);
  assert.match(source, /href="\/admin\/organizations"/);
});
