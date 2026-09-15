// Comprehensive regression matrix for the FINAL, hardened AI Workforce plan
// architecture (lib/billing/ai-workforce-policy.ts).
//
// There are THREE independent dimensions and all three must pass:
//   A. COMMERCIAL ENTITLEMENT — is this employee type part of the resolved
//      plan's tier at all?
//   B. IMPLEMENTATION AVAILABILITY — does this employee type actually have a
//      working runtime today, independent of plan? (Marketing and
//      Appointment are commercially Pro+, but neither is built yet.)
//   C. WORKFORCE CAPACITY — entitlements.limits.max_ai_employees (already
//      correctly resolved from plan + subscription/trial state + admin
//      overrides by lib/billing/entitlements.ts's getBusinessEntitlements).
//
// The policy is FAIL-CLOSED: an employee type it does not explicitly
// recognize is never implicitly allowed on Starter/Growth/Pro, and on
// Enterprise is allowed only with an explicit entitlements.modules grant.
//
// These tests exercise canActivateEmployee/isEmployeeTypeEntitled directly
// against real plan definitions (getPlanDefinition), rather than a full
// HTTP-level integration test of the activation route — the route itself is
// covered structurally by tests/ai-authority-policy.test.mjs and
// tests/receptionist-entitlement-policy.test.mjs, which confirm it actually
// calls this exact policy.
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

// ai-workforce-policy.ts imports its sibling modules without file
// extensions (the repo's normal style, resolved by bundlers automatically);
// this loader teaches plain Node ESM to resolve those the same way.
register(pathToFileURL(new URL("./helpers/alias-loader.mjs", import.meta.url).pathname));

const {
  canActivateEmployee,
  isEmployeeTypeEntitled,
  isEmployeeImplementationAvailable,
  allowedEmployeeTypesForPlan,
  STANDARD_EMPLOYEE_TYPE_LIST,
} = await import("../lib/billing/ai-workforce-policy.ts");
const { getPlanDefinition } = await import("../lib/billing/plan-definitions.ts");

function entitlementsFor(planId, overrides = {}) {
  const plan = getPlanDefinition(planId);
  return {
    plan: plan.id,
    planName: plan.name,
    capabilities: plan.capabilities,
    limits: {
      max_ai_employees: plan.employeeLimit,
      max_human_users: null,
      max_businesses: plan.id === "enterprise" ? null : 1,
      max_branches: null,
      max_knowledge_sources: null,
      max_automations: plan.automationLimit,
      max_api_keys: null,
      max_monthly_conversations: null,
      max_storage_mb: null,
      includedVoiceMinutes: plan.includedVoiceMinutes,
    },
    modules: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// STARTER — Receptionist PASS; everything else, including unknown, FAIL
// ---------------------------------------------------------------------------

test("STARTER: Receptionist activation PASS", () => {
  const decision = canActivateEmployee(entitlementsFor("starter"), "receptionist", 0);
  assert.deepEqual(decision, { allowed: true });
});

test("STARTER: second employee activation FAILS with EMPLOYEE_LIMIT_REACHED", () => {
  const decision = canActivateEmployee(entitlementsFor("starter"), "receptionist", 1);
  assert.equal(decision.allowed, false);
  assert.equal(decision.code, "EMPLOYEE_LIMIT_REACHED");
});

for (const type of ["sales", "customer-support", "outreach", "general-manager", "marketing", "appointment", "custom", "some-unknown-type"]) {
  test(`STARTER: ${type} activation FAILS, even with a free slot`, () => {
    const decision = canActivateEmployee(entitlementsFor("starter"), type, 0);
    assert.equal(decision.allowed, false);
    assert.equal(decision.code, "EMPLOYEE_TYPE_NOT_ENTITLED");
  });
}

// ---------------------------------------------------------------------------
// GROWTH — Receptionist/Support/Sales PASS; Outreach/GM/Marketing/
// Appointment/Custom/unknown all FAIL
// ---------------------------------------------------------------------------

for (const type of ["receptionist", "customer-support", "sales"]) {
  test(`GROWTH: ${type} PASS`, () => {
    const decision = canActivateEmployee(entitlementsFor("growth"), type, 0);
    assert.deepEqual(decision, { allowed: true });
  });
}

test("GROWTH: fourth employee FAILS with EMPLOYEE_LIMIT_REACHED", () => {
  const decision = canActivateEmployee(entitlementsFor("growth"), "receptionist", 3);
  assert.equal(decision.allowed, false);
  assert.equal(decision.code, "EMPLOYEE_LIMIT_REACHED");
});

test("GROWTH: Outreach FAILS with EMPLOYEE_TYPE_NOT_ENTITLED (requiredPlan pro), even with a free slot", () => {
  const decision = canActivateEmployee(entitlementsFor("growth"), "outreach", 1);
  assert.equal(decision.allowed, false);
  assert.equal(decision.code, "EMPLOYEE_TYPE_NOT_ENTITLED");
  assert.equal(decision.requiredPlan, "pro");
});

test("GROWTH: General Manager FAILS with EMPLOYEE_TYPE_NOT_ENTITLED (requiredPlan pro) — it is Pro+Enterprise only", () => {
  const decision = canActivateEmployee(entitlementsFor("growth"), "general-manager", 1);
  assert.equal(decision.allowed, false);
  assert.equal(decision.code, "EMPLOYEE_TYPE_NOT_ENTITLED");
  assert.equal(decision.requiredPlan, "pro");
});

test("GROWTH: Marketing and Appointment FAIL with EMPLOYEE_TYPE_NOT_ENTITLED (requiredPlan pro) — Growth doesn't even reach the coming-soon question yet", () => {
  for (const type of ["marketing", "appointment"]) {
    const decision = canActivateEmployee(entitlementsFor("growth"), type, 1);
    assert.equal(decision.allowed, false);
    assert.equal(decision.code, "EMPLOYEE_TYPE_NOT_ENTITLED");
    assert.equal(decision.requiredPlan, "pro");
  }
});

for (const type of ["custom", "some-unknown-type"]) {
  test(`GROWTH: ${type} FAILS`, () => {
    const decision = canActivateEmployee(entitlementsFor("growth"), type, 1);
    assert.equal(decision.allowed, false);
    assert.equal(decision.code, "EMPLOYEE_TYPE_NOT_ENTITLED");
  });
}

// ---------------------------------------------------------------------------
// PRO — Receptionist/Support/Sales/Outreach/General Manager PASS; every
// other standard type (Marketing, Appointment, Accountant, Finance, HR,
// Operations, Custom) is now commercially included AND genuinely built, so
// all twelve catalog types pass on Pro; only a truly unmodeled type FAILS;
// 11th employee hits the limit
// ---------------------------------------------------------------------------

for (const type of ["receptionist", "customer-support", "sales", "outreach", "general-manager"]) {
  test(`PRO: ${type} PASS`, () => {
    const decision = canActivateEmployee(entitlementsFor("pro"), type, 0);
    assert.deepEqual(decision, { allowed: true });
  });
}

for (const type of ["marketing", "appointment", "accountant", "finance", "hr", "operations", "custom"]) {
  test(`PRO: ${type} is commercially entitled and genuinely built — activation is allowed`, () => {
    // Commercial entitlement (dimension A) genuinely holds on Pro...
    assert.ok(allowedEmployeeTypesForPlan(entitlementsFor("pro")).includes(type));
    // ...and now a real Mastra agent + /api/ai route exist, so activation succeeds too.
    const decision = canActivateEmployee(entitlementsFor("pro"), type, 0);
    assert.deepEqual(decision, { allowed: true });
  });
}

test("PRO: a truly unmodeled type FAILS — never assigned a commercial tier, so it is not merely coming-soon, it is not entitled at all", () => {
  const decision = canActivateEmployee(entitlementsFor("pro"), "some-unknown-type", 0);
  assert.equal(decision.allowed, false);
  assert.equal(decision.code, "EMPLOYEE_TYPE_NOT_ENTITLED");
});

test("PRO: up to 15 employees allowed (room for the complete 12-type catalog plus headroom), the 16th FAILS with EMPLOYEE_LIMIT_REACHED", () => {
  const allowedAtFourteen = canActivateEmployee(entitlementsFor("pro"), "receptionist", 14);
  assert.deepEqual(allowedAtFourteen, { allowed: true });

  const deniedAtFifteen = canActivateEmployee(entitlementsFor("pro"), "receptionist", 15);
  assert.equal(deniedAtFifteen.allowed, false);
  assert.equal(deniedAtFifteen.code, "EMPLOYEE_LIMIT_REACHED");
});

// ---------------------------------------------------------------------------
// ENTERPRISE
// ---------------------------------------------------------------------------

test("ENTERPRISE: every standard employee type — the complete 12-type catalog — is available with no arbitrary Starter/Growth/Pro restriction, and Enterprise never has fewer working employees than Pro", () => {
  for (const type of STANDARD_EMPLOYEE_TYPE_LIST) {
    assert.ok(isEmployeeImplementationAvailable(type), `expected ${type} to be implemented`);
    const decision = canActivateEmployee(entitlementsFor("enterprise"), type, 0);
    assert.deepEqual(decision, { allowed: true }, `expected ${type} to be allowed on Enterprise`);
  }
});

test("ENTERPRISE: configurable employee limit is respected, not a hard-coded tier cap", () => {
  const configuredLimit5 = entitlementsFor("enterprise", {
    limits: { ...entitlementsFor("enterprise").limits, max_ai_employees: 5 },
  });
  const allowedAtFour = canActivateEmployee(configuredLimit5, "receptionist", 4);
  assert.deepEqual(allowedAtFour, { allowed: true });

  const deniedAtFive = canActivateEmployee(configuredLimit5, "receptionist", 5);
  assert.equal(deniedAtFive.allowed, false);
  assert.equal(deniedAtFive.code, "EMPLOYEE_LIMIT_REACHED");
});

test("ENTERPRISE: default (unconfigured) employee limit is unlimited, never an arbitrary number", () => {
  const decision = canActivateEmployee(entitlementsFor("enterprise"), "receptionist", 500);
  assert.deepEqual(decision, { allowed: true });
});

test("ENTERPRISE: an unrecognized type not yet granted fails with ENTERPRISE_CONFIGURATION_REQUIRED — unknown to the policy never implies availability", () => {
  const decision = canActivateEmployee(entitlementsFor("enterprise"), "bespoke-legal-employee", 0);
  assert.equal(decision.allowed, false);
  assert.equal(decision.code, "ENTERPRISE_CONFIGURATION_REQUIRED");
});

test("ENTERPRISE: an explicit grant never makes an unknown employee implementation-ready", () => {
  const withCustomModule = entitlementsFor("enterprise", { modules: ["bespoke-legal-employee"] });
  assert.equal(isEmployeeTypeEntitled(withCustomModule, "bespoke-legal-employee"), true);
  const decision = canActivateEmployee(withCustomModule, "bespoke-legal-employee", 0);
  assert.equal(decision.allowed, false);
  assert.equal(decision.code, "EMPLOYEE_NOT_AVAILABLE");
});

// ---------------------------------------------------------------------------
// Accountant, Finance, HR, Operations, Custom: formerly legacy/unassigned
// catalog types, now standard Pro+ types with a real runtime, exactly like
// Marketing and Appointment before them — fail below Pro, pass at Pro and
// Enterprise, and are commercially entitled without any Enterprise module
// grant (the entitlements.modules path is reserved for a truly future/
// unmodeled type, not for anything currently in the catalog).
// ---------------------------------------------------------------------------

for (const type of ["accountant", "finance", "hr", "operations", "custom"]) {
  test(`${type}: minPlan is pro — fails on Starter/Growth, passes on Pro and Enterprise with no module grant required`, () => {
    for (const planId of ["starter", "growth"]) {
      const decision = canActivateEmployee(entitlementsFor(planId), type, 0);
      assert.equal(decision.allowed, false, `${type} on ${planId}`);
      assert.equal(decision.code, "EMPLOYEE_TYPE_NOT_ENTITLED");
      assert.equal(decision.requiredPlan, "pro");
    }
    for (const planId of ["pro", "enterprise"]) {
      const decision = canActivateEmployee(entitlementsFor(planId), type, 0);
      assert.deepEqual(decision, { allowed: true }, `${type} on ${planId}`);
    }
  });
}

// ---------------------------------------------------------------------------
// Cross-cutting: deactivation cannot be used to bypass type restrictions
// ---------------------------------------------------------------------------

test("changing/deactivating an employee cannot be used to bypass type restrictions: the policy is re-evaluated on every activation attempt, including reactivation, using the CURRENT employee count and CURRENT plan — not the type of whatever was previously active", () => {
  // A Starter business that had 1 active Receptionist, deactivates it, and
  // attempts to activate Sales instead: the count check now sees 0 active
  // employees (a free slot), but the type check still independently denies
  // Sales on Starter. Both dimensions are evaluated fresh every time.
  const afterDeactivating = canActivateEmployee(entitlementsFor("starter"), "sales", 0);
  assert.equal(afterDeactivating.allowed, false);
  assert.equal(afterDeactivating.code, "EMPLOYEE_TYPE_NOT_ENTITLED");
});

// ---------------------------------------------------------------------------
// Activation/runtime consistency
// ---------------------------------------------------------------------------

test("activation/runtime consistency: isEmployeeTypeEntitled (dimension A, used by runtime routes) never says yes when canActivateEmployee's combined type+availability check says no for a type reason, for every plan and every standard type", () => {
  for (const planId of ["starter", "growth", "pro", "enterprise"]) {
    for (const type of STANDARD_EMPLOYEE_TYPE_LIST) {
      const entitlements = entitlementsFor(planId);
      const commerciallyEntitled = isEmployeeTypeEntitled(entitlements, type);
      const decision = canActivateEmployee(entitlements, type, 0);
      if (decision.allowed) {
        assert.equal(commerciallyEntitled, true, `plan=${planId} type=${type}: allowed but isEmployeeTypeEntitled said false`);
      }
      if (!decision.allowed && decision.code === "EMPLOYEE_TYPE_NOT_ENTITLED") {
        assert.equal(commerciallyEntitled, false, `plan=${planId} type=${type}: EMPLOYEE_TYPE_NOT_ENTITLED but isEmployeeTypeEntitled said true`);
      }
      // EMPLOYEE_NOT_AVAILABLE is commercially entitled but not built —
      // isEmployeeTypeEntitled (commercial-only) must say true there.
      if (!decision.allowed && decision.code === "EMPLOYEE_NOT_AVAILABLE") {
        assert.equal(commerciallyEntitled, true, `plan=${planId} type=${type}: EMPLOYEE_NOT_AVAILABLE but isEmployeeTypeEntitled said false — commercial entitlement and implementation availability must not be conflated`);
      }
    }
  }
});

test("every implemented runtime chat route uses isEmployeeTypeEntitled with the matching type string, including General Manager", async () => {
  const routeToType = {
    "app/api/ai/receptionist/route.ts": "receptionist",
    "app/api/ai/sales/route.ts": "sales",
    "app/api/ai/customer-support/route.ts": "customer-support",
    "app/api/ai/outreach/route.ts": "outreach",
    "app/api/ai/general-manager/route.ts": "general-manager",
    "app/api/ai/marketing/route.ts": "marketing",
    "app/api/ai/appointment/route.ts": "appointment",
    "app/api/ai/accountant/route.ts": "accountant",
    "app/api/ai/finance/route.ts": "finance",
    "app/api/ai/hr/route.ts": "hr",
    "app/api/ai/operations/route.ts": "operations",
    "app/api/ai/custom/route.ts": "custom",
  };

  for (const [file, type] of Object.entries(routeToType)) {
    const source = await readFile(file, "utf8");
    assert.match(
      source,
      new RegExp(`isEmployeeTypeEntitled\\(\\s*await getBusinessEntitlements\\([^)]*\\),\\s*"${type}"`),
      `${file} should gate on isEmployeeTypeEntitled(..., "${type}")`,
    );
  }
});

test("there is no runtime route for a genuinely unmodeled employee type", () => {
  assert.equal(existsSync("app/api/ai/some-unknown-type/route.ts"), false, "expected no runtime route to exist for an unmodeled type");
});

test("every standard employee type (all 12 catalog types) now has a real runtime route, matching its implemented: true policy status", () => {
  for (const type of STANDARD_EMPLOYEE_TYPE_LIST) {
    assert.equal(existsSync(`app/api/ai/${type}/route.ts`), true, `expected a real runtime route for ${type}`);
  }
});

test("generic runtime endpoints fail closed through the central commercial-entitlement and implementation-availability checks", async () => {
  for (const file of [
    "app/api/workforce/simulator/route.ts",
    "app/api/voice/calls/route.ts",
    "app/api/integrations/website-chat/route.ts",
    "app/api/integrations/whatsapp/webhook/route.ts",
  ]) {
    const source = await readFile(file, "utf8");
    assert.match(source, /isEmployeeTypeEntitled\(/, `${file} must enforce commercial employee-type entitlement`);
    assert.match(source, /isEmployeeImplementationAvailable\(/, `${file} must reject nonexistent\/coming-soon runtimes`);
  }
});

test("the activation route uses the same canActivateEmployee policy for both new activation and reactivation of a previously deactivated employee", async () => {
  const source = await readFile("app/api/ai-employees/route.ts", "utf8");
  const activationCheckIndex = source.indexOf("canActivateEmployee(");
  const existingEmployeeCheckIndex = source.indexOf("check_existing_employee");
  assert.ok(activationCheckIndex !== -1, "expected canActivateEmployee to be called");
  assert.ok(
    activationCheckIndex < existingEmployeeCheckIndex,
    "the policy check must run before the create-vs-reactivate branch, so reactivation is gated identically to fresh activation",
  );
});

test("direct API activation cannot bypass entitlement: canActivateEmployee still denies a genuinely unmodeled type regardless of the count check outcome", () => {
  const decision = canActivateEmployee(entitlementsFor("enterprise"), "some-unknown-type", 0);
  assert.equal(decision.allowed, false);
});

test("every Pro+ standard employee type activation succeeds given an empty slot on a plan that commercially includes it — count passing AND implementation both now hold", () => {
  for (const type of ["marketing", "appointment", "accountant", "finance", "hr", "operations", "custom"]) {
    const decision = canActivateEmployee(entitlementsFor("pro"), type, 0);
    assert.deepEqual(decision, { allowed: true });
  }
});

// ---------------------------------------------------------------------------
// Higher-value tool/action entitlements remain enforced independently
// ---------------------------------------------------------------------------

test("appointment and ticket tools remain independently gated on customer_ops.ai_assist regardless of basic-conversation entitlement — unrelated to the future Appointment AI employee type", async () => {
  // The direct hasCapability(entitlements, "customer_ops.ai_assist") call
  // this test used to check for was centralized into the structured AI
  // authority system (lib/ai/authority.ts's checkAIEmployeeAuthority +
  // ACTION_ENTITLEMENT map) — every appointment/ticket action still
  // requires customer_ops.ai_assist, just enforced in one place instead of
  // duplicated per tool file.
  const appointmentSource = await readFile("mastra/tools/appointment-tools.ts", "utf8");
  const ticketSource = await readFile("mastra/tools/ticket-tools.ts", "utf8");
  const authoritySource = await readFile("lib/ai/authority.ts", "utf8");

  assert.match(appointmentSource, /checkAIEmployeeAuthority\(\{[^}]*action: "read_appointments"/);
  assert.match(appointmentSource, /checkAIEmployeeAuthority\(\{[^}]*action: "create_appointment"/);
  assert.match(appointmentSource, /checkAIEmployeeAuthority\(\{[^}]*action: "update_appointment"/);
  assert.match(ticketSource, /checkAIEmployeeAuthority\(\{[^}]*action: "read_tickets"/);
  assert.match(ticketSource, /checkAIEmployeeAuthority\(\{[^}]*action: "create_ticket"/);
  assert.match(ticketSource, /checkAIEmployeeAuthority\(\{[^}]*action: "escalate_ticket"/);

  for (const action of ["read_appointments", "create_appointment", "update_appointment", "read_tickets", "create_ticket", "escalate_ticket"]) {
    assert.match(
      authoritySource,
      new RegExp(`${action}:\\s*"customer_ops\\.ai_assist"`),
      `${action} must still require customer_ops.ai_assist in the central ACTION_ENTITLEMENT map`,
    );
  }
});

test("Outreach's approval, autonomy, and persistence-truth safety mechanisms are untouched by the fail-closed rewrite", async () => {
  const promoteSource = await readFile("mastra/tools/promote-outreach-prospect-to-sales.ts", "utf8");
  assert.match(promoteSource, /PROMOTION_REQUIRES_AUTONOMY/);

  const outreachRouteSource = await readFile("app/api/ai/outreach/route.ts", "utf8");
  assert.match(outreachRouteSource, /enforcePersistenceTruth/);
  assert.match(outreachRouteSource, /runOutreachResearchPipeline/);
});

test("tenant isolation unchanged: every entitlement check in the runtime routes is scoped to the server-resolved business, never a client-supplied id", async () => {
  for (const file of [
    "app/api/ai/receptionist/route.ts",
    "app/api/ai/sales/route.ts",
    "app/api/ai/customer-support/route.ts",
    "app/api/ai/outreach/route.ts",
    "app/api/ai/general-manager/route.ts",
    "app/api/ai/marketing/route.ts",
    "app/api/ai/appointment/route.ts",
    "app/api/ai/accountant/route.ts",
    "app/api/ai/finance/route.ts",
    "app/api/ai/hr/route.ts",
    "app/api/ai/operations/route.ts",
    "app/api/ai/custom/route.ts",
  ]) {
    const source = await readFile(file, "utf8");
    assert.match(source, /getBusinessEntitlements\(business\.id\)/);
    assert.doesNotMatch(source, /getBusinessEntitlements\(body\./);
  }
});

// ---------------------------------------------------------------------------
// allowedEmployeeTypesForPlan is COMMERCIAL entitlement only (dimension A) —
// it intentionally lists every Pro-tier type on Pro, including Custom,
// because they really are all commercially included now; canActivateEmployee
// is what layers implementation availability on top (and confirms it holds
// too, since every one of them is genuinely built).
// ---------------------------------------------------------------------------

test("allowedEmployeeTypesForPlan reflects commercial entitlement only, per the final approved model — Pro and Enterprise both include the complete 12-type catalog", () => {
  assert.deepEqual([...allowedEmployeeTypesForPlan(entitlementsFor("starter"))], ["receptionist"]);
  assert.deepEqual(
    [...allowedEmployeeTypesForPlan(entitlementsFor("growth"))],
    ["receptionist", "customer-support", "sales"],
  );
  const proAllowed = [...allowedEmployeeTypesForPlan(entitlementsFor("pro"))];
  const enterpriseAllowed = [...allowedEmployeeTypesForPlan(entitlementsFor("enterprise"))];
  for (const type of STANDARD_EMPLOYEE_TYPE_LIST) {
    assert.ok(proAllowed.includes(type), `expected ${type} to be commercially included on Pro`);
    assert.ok(enterpriseAllowed.includes(type), `expected ${type} to be commercially included on Enterprise`);
  }
});
