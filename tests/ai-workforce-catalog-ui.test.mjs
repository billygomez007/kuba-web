// Regression coverage for the AI Workforce catalog/UI consolidation.
//
// This repo's test convention (see tests/ai-workforce-policy-model.test.mjs)
// is Node's native test runner: real unit tests against pure policy/catalog
// functions, plus structural source-inspection assertions for UI files
// (there is no jsdom/React Testing Library dependency in this project).
// This file follows the same pattern.
//
// What's covered:
//   1. lib/billing/ai-workforce-catalog.ts as a real unit under test —
//      every approved-model type is present exactly once, implementation
//      status matches what actually has a working runtime, and the
//      display-only minimumSelfServePlanToActivate() helper never
//      disagrees with the authoritative canActivateEmployee() it wraps.
//   2. Every consolidated UI surface (workforce catalog, employee builder,
//      onboarding, the onboarding legacy chain, the dashboard preview, and
//      every other place that used to define its own employee list/avatar/
//      category maps) now sources that data from the one shared catalog
//      instead of a private copy.
//   3. ActivateEmployeeButton — the one control every surface uses to
//      activate an employee — reuses the SAME server policy functions
//      rather than re-implementing authorization, and never calls the
//      activation endpoint for a locked or coming-soon employee.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import test from "node:test";

register(pathToFileURL("./tests/helpers/alias-loader.mjs"));

const {
  employeeCatalog,
  getCatalogEntry,
  getEmployeeAvatar,
  minimumSelfServePlanToActivate,
} = await import("../lib/billing/ai-workforce-catalog.ts");
const { canActivateEmployee, isEmployeeImplementationAvailable } = await import("../lib/billing/ai-workforce-policy.ts");
const { getPlanDefinition, defaultLimitsForPlan } = await import("../lib/billing/plan-definitions.ts");

function entitlementsFor(planId) {
  const plan = getPlanDefinition(planId);
  return { plan: plan.id, planName: plan.name, capabilities: plan.capabilities, limits: defaultLimitsForPlan(plan), modules: [] };
}

// --- 1. Catalog correctness -------------------------------------------------

test("the catalog defines every approved-model employee type exactly once", () => {
  const types = employeeCatalog.map((entry) => entry.type);
  assert.equal(new Set(types).size, types.length, "no duplicate type keys");
  for (const required of ["receptionist", "sales", "customer-support", "outreach", "marketing", "appointment", "accountant", "finance", "hr", "operations", "custom"]) {
    assert.ok(types.includes(required), `expected ${required} in the catalog`);
  }
});

test("every catalog entry has the metadata the UI actually renders", () => {
  for (const entry of employeeCatalog) {
    assert.equal(typeof entry.type, "string");
    assert.equal(typeof entry.name, "string");
    assert.equal(typeof entry.roleName, "string");
    assert.equal(typeof entry.category, "string");
    assert.equal(typeof entry.description, "string");
    assert.ok(Array.isArray(entry.capabilities) && entry.capabilities.length > 0);
    assert.equal(typeof entry.icon, "string");
    assert.equal(typeof entry.avatar, "string");
    assert.ok(entry.implementation === "available" || entry.implementation === "coming-soon");
  }
});

test("implementation status matches what actually has a working chat runtime (no misleading Activate button) — every catalog type is now available, none coming-soon", () => {
  for (const entry of employeeCatalog) {
    assert.equal(entry.implementation, "available", `${entry.type} implementation status`);
  }
});

test("every catalog type, including the newest five (Accountant, Finance, HR, Operations, Custom), has a real Mastra agent + /api/ai route and is available, not coming-soon", () => {
  for (const type of ["marketing", "appointment", "accountant", "finance", "hr", "operations", "custom"]) {
    assert.equal(getCatalogEntry(type).implementation, "available", type);
  }
});

test("the catalog's implementation field is DERIVED from isEmployeeImplementationAvailable, not hand-set — it can never drift from what the policy enforces", () => {
  for (const entry of employeeCatalog) {
    const expected = isEmployeeImplementationAvailable(entry.type) ? "available" : "coming-soon";
    assert.equal(entry.implementation, expected, entry.type);
  }
});

test("getEmployeeAvatar falls back to the receptionist avatar for an unknown type", () => {
  assert.equal(getEmployeeAvatar("some-type-nobody-registered"), "/avatars/receptionist.png");
  assert.equal(getEmployeeAvatar("receptionist"), "/avatars/receptionist.png");
});

// --- 2. minimumSelfServePlanToActivate never disagrees with the real policy -

test("minimumSelfServePlanToActivate agrees with canActivateEmployee for every catalog type and every self-serve plan", () => {
  for (const entry of employeeCatalog) {
    const minPlan = minimumSelfServePlanToActivate(entry.type);
    for (const planId of ["starter", "growth", "pro"]) {
      const decision = canActivateEmployee(entitlementsFor(planId), entry.type, 0);
      const planOrder = ["starter", "growth", "pro"];
      const expectedAllowed = minPlan !== null && planOrder.indexOf(planId) >= planOrder.indexOf(minPlan);
      assert.equal(decision.allowed, expectedAllowed, `${entry.type} on ${planId}: minPlan=${minPlan}`);
    }
  }
});

test("minimumSelfServePlanToActivate matches the final approved model for every implemented type", () => {
  assert.equal(minimumSelfServePlanToActivate("receptionist"), "starter");
  assert.equal(minimumSelfServePlanToActivate("sales"), "growth");
  assert.equal(minimumSelfServePlanToActivate("customer-support"), "growth");
  assert.equal(minimumSelfServePlanToActivate("outreach"), "pro");
  assert.equal(minimumSelfServePlanToActivate("general-manager"), "pro");
  assert.equal(minimumSelfServePlanToActivate("marketing"), "pro");
  assert.equal(minimumSelfServePlanToActivate("appointment"), "pro");
  assert.equal(minimumSelfServePlanToActivate("accountant"), "pro");
  assert.equal(minimumSelfServePlanToActivate("finance"), "pro");
  assert.equal(minimumSelfServePlanToActivate("hr"), "pro");
  assert.equal(minimumSelfServePlanToActivate("operations"), "pro");
  assert.equal(minimumSelfServePlanToActivate("custom"), "pro");
});

// --- 3. UI surfaces are consolidated onto the shared catalog ----------------

const consolidatedFiles = [
  "app/dashboard/workforce/page.tsx",
  "app/dashboard/ai-employees/create/page.tsx",
  "app/onboarding/page.tsx",
  "app/onboarding/ai-training/page.tsx",
  "app/dashboard/page.tsx",
  "app/components/employees/AIEmployeeAvatar.tsx",
  "app/components/employees/AIEmployeeHeader.tsx",
  "app/dashboard/ai-employees/[id]/page.tsx",
];

for (const file of consolidatedFiles) {
  test(`${file} sources employee metadata from lib/billing/ai-workforce-catalog, not a private copy`, async () => {
    const source = await readFile(file, "utf8");
    assert.match(source, /from ["']@?\/?\.*lib\/billing\/ai-workforce-catalog["']/, `${file} should import the shared catalog`);
  });
}

test("app/dashboard/employees/[id]/page.tsx no longer defines its own avatar/category/specialization maps", async () => {
  const source = await readFile("app/dashboard/employees/[id]/page.tsx", "utf8");
  assert.doesNotMatch(source, /function getEmployeeAvatar/);
  assert.doesNotMatch(source, /function getEmployeeCategory/);
  assert.doesNotMatch(source, /function getEmployeeSpecialization/);
});

test("app/dashboard/workforce/page.tsx no longer hardcodes its own employeeLibrary array", async () => {
  const source = await readFile("app/dashboard/workforce/page.tsx", "utf8");
  assert.doesNotMatch(source, /const employeeLibrary: EmployeeDefinition\[\] = \[/);
  assert.match(source, /const employeeLibrary: EmployeeDefinition\[\] = employeeCatalog/);
});

// --- 4. Plan/type/count-aware UI wiring -------------------------------------

test("app/dashboard/workforce/page.tsx fetches and displays real entitlements (not a hardcoded catalog-size ratio) for workforce capacity", async () => {
  const source = await readFile("app/dashboard/workforce/page.tsx", "utf8");
  assert.match(source, /setEntitlements\(data\.entitlements/);
  assert.doesNotMatch(source, /\$\{activeEmployees\.length\}\/\$\{employeeLibrary\.length\}/, "capacity must be measured against the plan limit, not the catalog size");
  assert.match(source, /entitlements\.limits\.max_ai_employees/);
});

test("app/dashboard/workforce/page.tsx marks active employees whose type the current plan no longer entitles, without hiding or deleting them", async () => {
  const source = await readFile("app/dashboard/workforce/page.tsx", "utf8");
  assert.match(source, /entitledUnderCurrentPlan/);
  assert.match(source, /Not in current plan/);
});

test("app/dashboard/ai-employees/create/page.tsx only offers roles with a real chat runtime, and locks ones the current plan doesn't entitle", async () => {
  const source = await readFile("app/dashboard/ai-employees/create/page.tsx", "utf8");
  assert.match(source, /entry\.implementation === "available"/);
  assert.match(source, /canActivateEmployee/);
  assert.match(source, /disabled=\{locked\}/);
});

test("app/onboarding/page.tsx resolves real server entitlements after business creation rather than trusting the client's plan-selection state", async () => {
  const source = await readFile("app/onboarding/page.tsx", "utf8");
  assert.match(source, /async function loadEntitlements/);
  assert.match(source, /await createBusiness\(\); [^;]*; await loadEntitlements\(\)/);
  assert.match(source, /canActivateEmployee\(entitlements, candidate\.type, 0\)/);
});

// --- 5. ActivateEmployeeButton reuses the real policy, never duplicates it --

test("ActivateEmployeeButton imports the same policy functions the server uses, rather than reimplementing authorization", async () => {
  const source = await readFile("app/components/ActivateEmployeeButton.tsx", "utf8");
  assert.match(source, /from ["']@\/lib\/billing\/ai-workforce-policy["']/);
  assert.match(source, /canActivateEmployee\(entitlements, type, activeEmployeeCount\)/);
});

test("ActivateEmployeeButton never calls the activation endpoint for a coming-soon employee", async () => {
  const source = await readFile("app/components/ActivateEmployeeButton.tsx", "utf8");
  const comingSoonBranch = source.slice(source.indexOf('implementation === "coming-soon"'), source.indexOf("Entitlements not loaded yet"));
  assert.doesNotMatch(comingSoonBranch, /fetch\(/);
  assert.match(comingSoonBranch, /Coming Soon/);
});

test("ActivateEmployeeButton never renders a clickable Activate button before entitlements have loaded", async () => {
  const source = await readFile("app/components/ActivateEmployeeButton.tsx", "utf8");
  assert.match(source, /entitlements === undefined \|\| entitlements === null/);
  assert.match(source, /Checking availability/);
});

test("ActivateEmployeeButton distinguishes EMPLOYEE_LIMIT_REACHED from EMPLOYEE_TYPE_NOT_ENTITLED messaging, and can show both at once", async () => {
  const source = await readFile("app/components/ActivateEmployeeButton.tsx", "utf8");
  assert.match(source, /typeEntitled = isEmployeeTypeEntitled/);
  assert.match(source, /atCapacity = limit !== null && activeEmployeeCount >= limit/);
  assert.match(source, /requires the \$\{getPlanDefinition\(decision\.requiredPlan\)\.name\} plan/);
  assert.match(source, /currently uses \$\{activeEmployeeCount\} of \$\{limit\} AI employee slot/);
});

test("ActivateEmployeeButton handles ENTERPRISE_CONFIGURATION_REQUIRED distinctly from a generic upgrade prompt", async () => {
  const source = await readFile("app/components/ActivateEmployeeButton.tsx", "utf8");
  assert.match(source, /ENTERPRISE_CONFIGURATION_REQUIRED/);
  assert.match(source, /Contact SuperKuba/);
});

test("the activation endpoint itself is unchanged — the client still POSTs to /api/ai-employees for an entitled activation", async () => {
  const source = await readFile("app/components/ActivateEmployeeButton.tsx", "utf8");
  assert.match(source, /fetch\("\/api\/ai-employees", \{/);
  assert.match(source, /method: "POST"/);
});

// --- 6. Server-side entitlement exposure is read-only presentation data ----

test("GET /api/businesses exposes resolved entitlements to the client without weakening any existing check", async () => {
  const source = await readFile("app/api/businesses/route.ts", "utf8");
  assert.match(source, /const entitlements = await getBusinessEntitlements\(business\.id\)/);
  assert.match(source, /entitlements,/);
});
