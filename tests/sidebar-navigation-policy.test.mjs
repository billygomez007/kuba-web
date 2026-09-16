// Regression tests for the canonical sidebar/navigation policy: the
// operational sidebar shows ONLY features that are both plan-entitled and
// genuinely implemented today. "Coming Soon"/"Planned" placeholders were
// removed entirely (not just their badge) from app/dashboard/layout.tsx —
// see that file's own comments for the audit that drove each removal.
//
// This test extracts the REAL navigationGroups/navigationPermissions/
// navigationCapabilities literals out of the actual source file (via a
// scoped, trusted eval of this repo's own plain object/array literals — no
// external input involved) and cross-checks them against the real plan
// capability matrix from lib/billing/plan-definitions.ts, rather than
// hand-duplicating the data (which could silently drift from the real
// file, the way tests/entitlements-policy.test.mjs's simplified
// projectSidebar helper already does for its own narrower purpose).
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { getPlanDefinition } from "../lib/billing/plan-definitions.ts";

const LAYOUT_PATH = "app/dashboard/layout.tsx";
const layoutSource = await readFile(LAYOUT_PATH, "utf8");

function extractLiteral(source, startMarker, closeLine) {
  const start = source.indexOf(startMarker);
  assert.ok(start > -1, `expected to find "${startMarker}" in ${LAYOUT_PATH}`);
  const assignIndex = source.indexOf("=", start) + 1;
  const end = source.indexOf(`\n${closeLine}\n`, assignIndex);
  assert.ok(end > -1, `expected to find a closing "${closeLine}" after "${startMarker}"`);
  // end points at the "\n" just before closeLine — include closeLine's
  // closing bracket/brace itself (end + 1 + closeLine.length - 1 = the
  // index right after the bracket) but not its trailing semicolon.
  const sliceEnd = end + 1 + (closeLine.length - 1);
  return new Function(`return (${source.slice(assignIndex, sliceEnd)})`)();
}

const navigationGroups = extractLiteral(layoutSource, "const navigationGroups: NavigationGroup[]", "];");
const navigationCapabilities = extractLiteral(layoutSource, "const navigationCapabilities: Record<string, string>", "};");

// Simulates canShowItem for a full-access ("owner") user — permission is
// never the differentiator being tested here (RBAC is covered elsewhere);
// this isolates exactly what changes per plan: entitlement.
function visibleLabelsForPlan(planId) {
  const plan = getPlanDefinition(planId);
  const capabilities = new Set(plan.capabilities);
  const visibleGroups = [];
  for (const group of navigationGroups) {
    const items = group.items.filter((item) => {
      const capability = navigationCapabilities[item.href];
      return !capability || capabilities.has(capability);
    });
    if (items.length > 0) visibleGroups.push({ title: group.title, labels: items.map((item) => item.label) });
  }
  return visibleGroups;
}

function allLabels(planId) {
  return visibleLabelsForPlan(planId).flatMap((group) => group.labels);
}

function groupTitles(planId) {
  return visibleLabelsForPlan(planId).map((group) => group.title);
}

// --- 1. No "Coming Soon"/"Planned" placeholders anywhere, structurally ---

test("navigationGroups contains no item with a status field at all (the type no longer allows one)", () => {
  const hasStatus = navigationGroups.some((group) => group.items.some((item) => "status" in item));
  assert.equal(hasStatus, false);
});

test("no literal 'Coming Soon' or 'Planned' string appears anywhere in the dashboard layout source", () => {
  assert.doesNotMatch(layoutSource, /Coming Soon/);
  assert.doesNotMatch(layoutSource, /"Planned"/);
});

test("every navigation item has a real href — none are dead placeholder rows", () => {
  for (const group of navigationGroups) {
    for (const item of group.items) {
      assert.equal(typeof item.href, "string", `${group.title} > ${item.label} must have a real href`);
      assert.ok(item.href.startsWith("/dashboard"), `${item.label}'s href must be a real dashboard route`);
    }
  }
});

test("previously-known stub/placeholder items are gone entirely, not merely hidden", () => {
  const removedLabelsByHref = [
    "/dashboard/business-operations/inventory", // static "Coming Soon" page
    "/dashboard/business-operations/documents", // two static links, no real feature of its own
    "/dashboard/intelligence/inventory", // static "Coming Soon" page
    "/dashboard/intelligence/reports", // static "Coming Soon" page
    "/dashboard/integrations/meta", // decorative button, no real functionality
  ];
  const allHrefs = navigationGroups.flatMap((group) => group.items.map((item) => item.href));
  for (const href of removedLabelsByHref) {
    assert.equal(allHrefs.includes(href), false, `${href} must not appear in navigationGroups`);
  }
  const removedLabels = ["Organization Overview", "Branch Overview", "Collections Agent", "Skills", "Calendar", "Payments", "Accounting", "External Apps", "API / Developer Integrations", "Organization / Business Group", "Branches & Locations", "Roles & Permissions", "Invitations", "Security", "Social Channels"];
  const allLabelsEverywhere = navigationGroups.flatMap((group) => group.items.map((item) => item.label));
  for (const label of removedLabels) {
    assert.equal(allLabelsEverywhere.includes(label), false, `"${label}" must not appear anywhere in navigationGroups`);
  }
});

// --- 2. Empty-group removal ---

test("renderNavigationGroup still drops a group with zero visible items (empty-group removal remains in place)", () => {
  assert.match(layoutSource, /const items = group\.items\.filter\(canShowItem\);\s*\n\s*if \(items\.length === 0\) return null;/);
});

test("Starter's Human Workforce and Business Operations groups are entirely empty and therefore absent (every item in them requires Growth+/Pro+)", () => {
  const titles = groupTitles("starter");
  assert.equal(titles.includes("Human Workforce"), false);
  assert.equal(titles.includes("Business Operations"), false);
});

test("Growth's Human Workforce group is entirely empty and therefore absent (every item requires Pro+)", () => {
  const titles = groupTitles("growth");
  assert.equal(titles.includes("Human Workforce"), false);
  assert.equal(titles.includes("Business Operations"), true, "Growth does have real Business Operations items (Tasks, Approvals, Automations, Operations Overview)");
});

test("Pro and Enterprise both show every group (nothing is empty for them)", () => {
  for (const planId of ["pro", "enterprise"]) {
    const titles = groupTitles(planId);
    for (const expected of ["Command Center", "AI Workforce", "Human Workforce", "Customer Operations", "Business Operations", "Intelligence", "Integrations", "Business Brain", "Settings"]) {
      assert.ok(titles.includes(expected), `${planId} should show the ${expected} group`);
    }
  }
});

// --- 3. STARTER ---

test("STARTER: no Sales/Leads, Support, Outreach, Campaigns, Voice, or Human Workforce operational surfaces", () => {
  const labels = allLabels("starter");
  for (const forbidden of ["Leads", "Support / Tickets", "Outreach Campaigns", "Voice", "Workforce Overview", "Employees", "HR", "Payroll", "Operational Teams", "Orchestration", "AI Workforce Performance", "Simulator", "Marketplace"]) {
    assert.equal(labels.includes(forbidden), false, `Starter must not show "${forbidden}"`);
  }
});

test("STARTER: no Coming Soon/Planned placeholders survive (redundant with the structural check above, asserted per-plan too)", () => {
  assert.equal(allLabels("starter").some((label) => ["Calendar", "Payments", "Accounting", "CRM", "Skills", "Collections Agent"].includes(label)), false);
});

test("STARTER: working core features remain visible", () => {
  const labels = allLabels("starter");
  for (const expected of ["Business Overview", "AI Employees", "Inbox", "Customers", "Conversations", "Follow-ups", "Appointments", "Analytics", "Communication Channels", "Business Knowledge", "Knowledge Sources", "Business Profile", "Team Staff", "Billing & Subscription", "Preferences"]) {
    assert.ok(labels.includes(expected), `Starter should show "${expected}"`);
  }
});

// --- 4. GROWTH ---

test("GROWTH: Sales/Leads and Support are visible", () => {
  const labels = allLabels("growth");
  assert.ok(labels.includes("Leads"));
  assert.ok(labels.includes("Support / Tickets"));
});

test("GROWTH: Outreach Campaigns, General Manager/Human Workforce surfaces, and Pro-only AI Workforce items are hidden", () => {
  const labels = allLabels("growth");
  for (const forbidden of ["Outreach Campaigns", "Voice", "Orchestration", "AI Workforce Performance", "Simulator", "Marketplace", "Workforce Overview", "Employees", "HR", "Payroll", "Operational Teams"]) {
    assert.equal(labels.includes(forbidden), false, `Growth must not show "${forbidden}"`);
  }
});

test("GROWTH: future placeholders remain hidden", () => {
  assert.equal(allLabels("growth").some((label) => ["Calendar", "Payments", "Accounting", "Skills"].includes(label)), false);
});

// --- 5. PRO ---

test("PRO: Sales, Support, Outreach Campaigns, and General Manager's Human Workforce surface are all visible", () => {
  const labels = allLabels("pro");
  assert.ok(labels.includes("Leads"));
  assert.ok(labels.includes("Support / Tickets"));
  assert.ok(labels.includes("Outreach Campaigns"));
  assert.ok(labels.includes("Workforce Overview"), "Human Workforce group's operational surface is Pro-entitled and implemented");
});

test("PRO: Voice is visible (both Pro-entitled via ai_workforce.voice and a genuinely implemented settings page)", () => {
  assert.ok(allLabels("pro").includes("Voice"));
});

test("PRO: future placeholders remain hidden even though Pro is commercially broad", () => {
  assert.equal(allLabels("pro").some((label) => ["Skills", "Collections Agent", "Calendar", "Payments", "Accounting", "External Apps", "API / Developer Integrations"].includes(label)), false);
});


test("PRO exposes the native CRM route with the canonical CRM permission and entitlement", () => {
  const crm = navigationGroups.flatMap((group) => group.items).find((item) => item.label === "CRM");
  assert.deepEqual(crm, { label: "CRM", href: "/dashboard/crm", icon: "◎", permission: "crm.view" });
  assert.equal(navigationCapabilities["/dashboard/crm"], "integrations.crm");
  assert.ok(allLabels("pro").includes("CRM"));
  assert.equal(allLabels("growth").includes("CRM"), false);
});

// --- 6. ENTERPRISE ---

test("ENTERPRISE: shows everything Pro shows (every currently-implemented capability Enterprise carries already has an operational surface at Pro)", () => {
  const proLabels = new Set(allLabels("pro"));
  const enterpriseLabels = new Set(allLabels("enterprise"));
  for (const label of proLabels) {
    assert.ok(enterpriseLabels.has(label), `Enterprise should include everything Pro has: missing "${label}"`);
  }
});

test("ENTERPRISE: unfinished Enterprise-tier roadmap features (multi-business, roles & permissions, branches, organization controls) are not exposed as dead sidebar links", () => {
  const labels = allLabels("enterprise");
  for (const forbidden of ["Organization Overview", "Branch Overview", "Organization / Business Group", "Branches & Locations", "Roles & Permissions"]) {
    assert.equal(labels.includes(forbidden), false, `Enterprise must not show unimplemented "${forbidden}"`);
  }
});

// --- 7. General: permission/entitlement/direct-URL checks untouched ---

test("canShowItem still checks both permission and capability, and now only ever looks them up by href (no more label-keyed fallback)", () => {
  assert.match(layoutSource, /const required = item\.permission \|\| navigationPermissions\[item\.href\];/);
  assert.match(layoutSource, /const capability = navigationCapabilities\[item\.href\];/);
  assert.doesNotMatch(layoutSource, /navigationItemCapabilities/, "the label-keyed capability map is dead now that every item has an href, and has been removed");
});

test("the deep-link capability gate (capabilityForPath / blockedCapability) is untouched by this change", () => {
  assert.match(layoutSource, /function capabilityForPath/);
  assert.match(layoutSource, /blockedCapability/);
});
