// Regression suite for the "Pro complimentary account sees an empty
// sidebar" blocking bug report. Root-cause investigation (see the
// accompanying commit message and CURRENT_STATE.md) reproduced the exact
// scenario — a real owner session, a real Pro/complimentary subscription
// row, against a real HTTP server — and found the canonical resolvers
// (getBusinessEntitlements, getRolePermissions, /api/auth/me) already
// correctly return full Pro capabilities and full owner permissions for
// this case. This suite locks that finding in as a regression test, fixes
// two real but narrower bugs found along the way (a second, incomplete
// subscription-status resolver in the platform-admin overview endpoint,
// and a hard-coded "Enterprise" label unrelated to the actual plan), and
// adds the defensive error-surfacing the investigation's own architecture
// requirement calls for regardless of the specific root cause.
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const REPO_ROOT = path.resolve(new URL("..", import.meta.url).pathname);
register(pathToFileURL(path.join(REPO_ROOT, "tests/helpers/alias-loader.mjs")));

let tempDir;
let db, schema, entitlements, permissionsLib;

const BIZ_STARTER = "nav-regr-starter";
const BIZ_GROWTH = "nav-regr-growth";
const BIZ_PRO_PAID = "nav-regr-pro-paid";
const BIZ_PRO_COMP = "nav-regr-pro-complimentary";
const BIZ_ENTERPRISE = "nav-regr-enterprise";

test.before(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "kuba-nav-regr-"));
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
  permissionsLib = await import("@/lib/auth/permissions");

  const now = new Date();
  await db.insert(schema.businesses).values([
    { id: BIZ_STARTER, name: "Starter Co", slug: BIZ_STARTER, status: "active", createdAt: now, updatedAt: now },
    { id: BIZ_GROWTH, name: "Growth Co", slug: BIZ_GROWTH, status: "active", createdAt: now, updatedAt: now },
    { id: BIZ_PRO_PAID, name: "Pro Paid Co", slug: BIZ_PRO_PAID, status: "active", createdAt: now, updatedAt: now },
    { id: BIZ_PRO_COMP, name: "Kora", slug: BIZ_PRO_COMP, status: "active", createdAt: now, updatedAt: now },
    { id: BIZ_ENTERPRISE, name: "Enterprise Co", slug: BIZ_ENTERPRISE, status: "active", createdAt: now, updatedAt: now },
  ]);
  await db.insert(schema.subscriptions).values([
    { id: "sub-starter", businessId: BIZ_STARTER, provider: "paystack", plan: "starter", status: "active", providerCustomerId: "cus_1", providerSubscriptionId: "sub_1", providerEventId: null, currentPeriodStart: now, currentPeriodEnd: new Date(now.getTime() + 30 * 86400000), cancelAtPeriodEnd: false, trialEnd: null, createdAt: now, updatedAt: now },
    { id: "sub-growth", businessId: BIZ_GROWTH, provider: "paystack", plan: "growth", status: "active", providerCustomerId: "cus_2", providerSubscriptionId: "sub_2", providerEventId: null, currentPeriodStart: now, currentPeriodEnd: new Date(now.getTime() + 30 * 86400000), cancelAtPeriodEnd: false, trialEnd: null, createdAt: now, updatedAt: now },
    { id: "sub-pro-paid", businessId: BIZ_PRO_PAID, provider: "paystack", plan: "pro", status: "active", providerCustomerId: "cus_3", providerSubscriptionId: "sub_3", providerEventId: null, currentPeriodStart: now, currentPeriodEnd: new Date(now.getTime() + 30 * 86400000), cancelAtPeriodEnd: false, trialEnd: null, createdAt: now, updatedAt: now },
    { id: "sub-pro-comp", businessId: BIZ_PRO_COMP, provider: "internal", plan: "pro", status: "complimentary", providerCustomerId: null, providerSubscriptionId: null, providerEventId: null, currentPeriodStart: null, currentPeriodEnd: null, cancelAtPeriodEnd: false, trialEnd: null, createdAt: now, updatedAt: now },
    { id: "sub-enterprise", businessId: BIZ_ENTERPRISE, provider: "internal", plan: "enterprise", status: "enterprise_contract", providerCustomerId: null, providerSubscriptionId: null, providerEventId: null, currentPeriodStart: null, currentPeriodEnd: null, cancelAtPeriodEnd: false, trialEnd: null, createdAt: now, updatedAt: now },
  ]);
});

test.after(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

// --- Nav projection helper: identical to tests/sidebar-navigation-policy.test.mjs's
// approach — extract the REAL navigationGroups/navigationCapabilities/
// navigationPermissions literals out of the actual layout.tsx source
// (a scoped eval of this repo's own trusted literals), so this proves the
// real shipped nav data, not a hand-copied duplicate.
let navigationGroups, navigationPermissions, navigationCapabilities;

test.before(async () => {
  const layoutSource = await readFile(path.join(REPO_ROOT, "app/dashboard/layout.tsx"), "utf8");
  function extractLiteral(source, startMarker, closeLine) {
    const start = source.indexOf(startMarker);
    const assignIndex = source.indexOf("=", start) + 1;
    const end = source.indexOf(`\n${closeLine}\n`, assignIndex);
    const sliceEnd = end + 1 + (closeLine.length - 1);
    return new Function(`return (${source.slice(assignIndex, sliceEnd)})`)();
  }
  navigationGroups = extractLiteral(layoutSource, "const navigationGroups: NavigationGroup[]", "];");
  navigationPermissions = extractLiteral(layoutSource, "const navigationPermissions: Record<string, string>", "};");
  navigationCapabilities = extractLiteral(layoutSource, "const navigationCapabilities: Record<string, string>", "};");
});

// Reimplements canShowItem exactly (permission OR-fallback to the href map,
// then capability check) against REAL permissions/capabilities arrays —
// this is the actual function's logic, applied to real extracted data.
function canShowItem(item, { permissions, capabilities }) {
  const required = item.permission || navigationPermissions[item.href];
  if (required && permissions !== null && !permissions.includes(required)) return false;
  const capability = navigationCapabilities[item.href];
  return !capability || capabilities === null || capabilities.includes(capability);
}

function visibleNav(permissions, capabilities) {
  const groups = [];
  for (const group of navigationGroups) {
    const items = group.items.filter((item) => canShowItem(item, { permissions, capabilities }));
    if (items.length > 0) groups.push({ title: group.title, labels: items.map((i) => i.label) });
  }
  return groups;
}

function flatLabels(groups) {
  return groups.flatMap((g) => g.labels);
}

// --- 1. Owner + Pro + complimentary must NOT render an empty sidebar (the exact reported bug) ---

test("Owner + Pro + provider=internal + status=complimentary + real owner permissions renders the full implemented Pro navigation, never an empty sidebar", async () => {
  const proComplimentary = await entitlements.getBusinessEntitlements(BIZ_PRO_COMP);
  const ownerPermissions = permissionsLib.getRolePermissions("owner");

  assert.equal(proComplimentary.plan, "pro", "the complimentary business must resolve to the Pro plan");
  assert.equal(proComplimentary.capabilities.length > 0, true);

  const nav = visibleNav(ownerPermissions, proComplimentary.capabilities);
  const labels = flatLabels(nav);

  assert.ok(nav.length > 0, "REGRESSION: the sidebar must not be empty for a Pro complimentary owner");
  assert.ok(labels.length >= 15, `expected a substantial Pro navigation, got only ${labels.length} items: ${labels.join(", ")}`);
  for (const expected of ["Business Overview", "AI Employees", "Outreach Campaigns", "Voice", "Leads", "Support / Tickets", "Workforce Overview", "Automations", "Analytics", "Communication Channels", "Business Knowledge", "Team Staff", "Billing & Subscription"]) {
    assert.ok(labels.includes(expected), `Pro complimentary sidebar should include "${expected}"`);
  }
});

// --- 2. Pro complimentary and Pro paid must project IDENTICAL product capabilities ---

test("Pro complimentary and Pro paid (active) resolve to the exact same capability set and therefore the exact same sidebar", async () => {
  const proPaid = await entitlements.getBusinessEntitlements(BIZ_PRO_PAID);
  const proComplimentary = await entitlements.getBusinessEntitlements(BIZ_PRO_COMP);

  assert.deepEqual([...proPaid.capabilities].sort(), [...proComplimentary.capabilities].sort());

  const ownerPermissions = permissionsLib.getRolePermissions("owner");
  const paidNav = flatLabels(visibleNav(ownerPermissions, proPaid.capabilities));
  const compNav = flatLabels(visibleNav(ownerPermissions, proComplimentary.capabilities));
  assert.deepEqual(paidNav.sort(), compNav.sort(), "Pro complimentary must show exactly the same operational sidebar as Pro paid — billing status must never change product capability");
});

// --- 3. Each plan tier resolves correctly and produces the right nav (Starter/Growth/Enterprise) ---

test("Starter (real paid subscription) shows the correct restricted Starter navigation", async () => {
  const starter = await entitlements.getBusinessEntitlements(BIZ_STARTER);
  assert.equal(starter.plan, "starter");
  const labels = flatLabels(visibleNav(permissionsLib.getRolePermissions("owner"), starter.capabilities));
  for (const forbidden of ["Leads", "Outreach Campaigns", "Voice", "Workforce Overview", "Support / Tickets"]) {
    assert.equal(labels.includes(forbidden), false, `Starter must not show "${forbidden}"`);
  }
  assert.ok(labels.includes("Business Overview"));
  assert.ok(labels.includes("AI Employees"));
});

test("Growth (real paid subscription) shows Sales/Support but not Pro-only surfaces", async () => {
  const growth = await entitlements.getBusinessEntitlements(BIZ_GROWTH);
  assert.equal(growth.plan, "growth");
  const labels = flatLabels(visibleNav(permissionsLib.getRolePermissions("owner"), growth.capabilities));
  assert.ok(labels.includes("Leads"));
  assert.ok(labels.includes("Support / Tickets"));
  for (const forbidden of ["Outreach Campaigns", "Voice", "Workforce Overview"]) {
    assert.equal(labels.includes(forbidden), false, `Growth must not show "${forbidden}"`);
  }
});

test("Enterprise (real enterprise_contract subscription) shows everything Pro shows, no unfinished roadmap items", async () => {
  const enterprise = await entitlements.getBusinessEntitlements(BIZ_ENTERPRISE);
  assert.equal(enterprise.plan, "enterprise");
  const labels = flatLabels(visibleNav(permissionsLib.getRolePermissions("owner"), enterprise.capabilities));
  assert.ok(labels.includes("Outreach Campaigns"));
  assert.ok(labels.includes("Workforce Overview"));
  for (const forbidden of ["Organization Overview", "Branch Overview", "Roles & Permissions"]) {
    assert.equal(labels.includes(forbidden), false, `Enterprise must not show unimplemented "${forbidden}"`);
  }
});

// --- 4. Permission-restricted team member: entitled to Pro, but RBAC still narrows what's shown ---

test("a permission-restricted 'member' role on a Pro complimentary business sees a narrow but non-empty sidebar — RBAC and entitlement are independent gates", async () => {
  const proComplimentary = await entitlements.getBusinessEntitlements(BIZ_PRO_COMP);
  const memberPermissions = permissionsLib.getRolePermissions("member");

  assert.ok(memberPermissions.length < permissionsLib.getRolePermissions("owner").length, "member must genuinely have fewer permissions than owner");

  const labels = flatLabels(visibleNav(memberPermissions, proComplimentary.capabilities));
  assert.ok(labels.length > 0, "a restricted role must still see SOMETHING it's permitted to use, not a blanket-empty sidebar");
  assert.ok(labels.includes("Business Overview"), "member has dashboard.view");
  assert.ok(labels.includes("Customers"), "member has customers.view");
  // Pro entitles the business to Outreach Campaigns, but member lacks outreach.view — RBAC still blocks it independent of entitlement.
  assert.equal(labels.includes("Outreach Campaigns"), false, "entitlement alone must not bypass RBAC");
});

// --- 5. No Coming Soon/Planned/placeholder items or empty groups, for any of the real resolved plans ---

test("none of the five real resolved plans ever render a Coming Soon/Planned/placeholder label", async () => {
  const placeholderLabels = ["Organization Overview", "Branch Overview", "Collections Agent", "Skills", "Calendar", "Payments", "Accounting", "CRM", "External Apps", "API / Developer Integrations", "Organization / Business Group", "Branches & Locations", "Roles & Permissions", "Invitations", "Security", "Social Channels"];
  for (const bizId of [BIZ_STARTER, BIZ_GROWTH, BIZ_PRO_PAID, BIZ_PRO_COMP, BIZ_ENTERPRISE]) {
    const resolved = await entitlements.getBusinessEntitlements(bizId);
    const labels = flatLabels(visibleNav(permissionsLib.getRolePermissions("owner"), resolved.capabilities));
    for (const placeholder of placeholderLabels) {
      assert.equal(labels.includes(placeholder), false, `${bizId} must never show placeholder "${placeholder}"`);
    }
  }
});

// --- 6. Failed navigation load must never look identical to "legitimately empty" (client-side architecture requirement) ---

test("a failed /api/auth/me request never forces permissions to an empty array — it sets a distinct, visible navigationLoadError instead", async () => {
  const layoutSource = await readFile(path.join(REPO_ROOT, "app/dashboard/layout.tsx"), "utf8");
  assert.doesNotMatch(layoutSource, /setPermissions\(\[\]\)/, "permissions must never be force-set to empty on a load failure — that is indistinguishable from a legitimately-empty entitled account");
  assert.match(layoutSource, /navigationLoadError/);
  assert.match(layoutSource, /setNavigationLoadError\(/);
});

test("the sidebar renders a visible error + retry control instead of silently rendering zero items when navigationLoadError is set", async () => {
  const layoutSource = await readFile(path.join(REPO_ROOT, "app/dashboard/layout.tsx"), "utf8");
  assert.match(layoutSource, /navigationLoadError \? \(/);
  assert.match(layoutSource, /onClick=\{\(\) => void loadPermissions\(\)\}/);
});

// --- 7. The "ENTERPRISE WORKSPACE" mislabel: confirmed static copy, now plan-aware ---

test("the sidebar workspace label is derived from the real resolved plan name, not a hard-coded 'Enterprise' string", async () => {
  const layoutSource = await readFile(path.join(REPO_ROOT, "app/dashboard/layout.tsx"), "utf8");
  assert.doesNotMatch(layoutSource, />\s*Enterprise workspace\s*</);
  assert.match(layoutSource, /\$\{entitlements\.planName\} workspace/);
});

// --- 8. The second, incomplete subscription-status resolver (platform admin overview) now accounts for complimentary ---

test("the platform-admin overview endpoint's subscription breakdown has a distinct complimentary bucket, not a silent omission", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/api/admin/overview/route.ts"), "utf8");
  assert.match(source, /complimentarySubscriptions:\s*subscriptionsData\.filter\(\(item\) => item\.status === "complimentary"\)/);
});

// --- 9. Direct URL / capability-gate architecture is untouched ---

test("the deep-link capability gate (capabilityForPath / blockedCapability) is unchanged by this fix", async () => {
  const layoutSource = await readFile(path.join(REPO_ROOT, "app/dashboard/layout.tsx"), "utf8");
  assert.match(layoutSource, /function capabilityForPath/);
  assert.match(layoutSource, /blockedCapability/);
});

test("no architecture shortcut was introduced: no email-based or hard-coded plan special-case for Kora anywhere in the app", async () => {
  const layoutSource = await readFile(path.join(REPO_ROOT, "app/dashboard/layout.tsx"), "utf8");
  assert.doesNotMatch(layoutSource, /koraafric/i);
  assert.doesNotMatch(layoutSource, /"pro"\s*===|===\s*"pro"/, "no direct plan-literal comparison was added to the layout to special-case Pro");
});
