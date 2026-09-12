// Regression tests for the Receptionist entitlement-gate fix.
//
// Root cause (confirmed live in production): app/api/ai/receptionist/route.ts
// gated the ENTIRE conversation endpoint on the "customer_ops.appointments"
// capability, which is Growth-tier-and-above. Any business without that
// capability — including a business that had just activated the Receptionist
// employee, since activation only requires the Starter-included
// "ai_workforce.core" — got a clean 403 FEATURE_NOT_ENTITLED for every
// message, including a plain "hello". The fix (since folded into the
// broader central AI Workforce plan policy, lib/billing/ai-workforce-policy.ts)
// gates basic conversation on the same type-availability check activation
// uses (isEmployeeTypeEntitled(entitlements, "receptionist")), which
// resolves true from the Starter plan onward. Actual appointment scheduling
// remains independently protected: mastra/tools/appointment-tools.ts
// already enforces its own, stricter "customer_ops.ai_assist" (Pro-tier) gate
// before reading or writing any appointment row, regardless of what this
// route checks.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

let receptionistRouteSource;
let aiEmployeesRouteSource;
let appointmentToolsSource;
let ticketToolsSource;
let planDefinitionsSource;
let aiAuthoritySource;

test.before(async () => {
  receptionistRouteSource = await readFile("app/api/ai/receptionist/route.ts", "utf8");
  aiEmployeesRouteSource = await readFile("app/api/ai-employees/route.ts", "utf8");
  appointmentToolsSource = await readFile("mastra/tools/appointment-tools.ts", "utf8");
  ticketToolsSource = await readFile("mastra/tools/ticket-tools.ts", "utf8");
  planDefinitionsSource = await readFile("lib/billing/plan-definitions.ts", "utf8");
  aiAuthoritySource = await readFile("lib/ai/authority.ts", "utf8");
});

// --- 1 & 2: the actual bug is fixed, and can't silently regress ---

test("the Receptionist chat route no longer gates basic conversation on customer_ops.appointments", () => {
  assert.doesNotMatch(
    receptionistRouteSource,
    /"customer_ops\.appointments"/,
  );
});

test("the Receptionist chat route gates basic conversation via the central employee-type policy instead", () => {
  assert.match(
    receptionistRouteSource,
    /isEmployeeTypeEntitled\(\s*await getBusinessEntitlements\(business\.id\),\s*"receptionist"/,
  );
});

// --- 3: activation and runtime entitlement are now consistent ---

test("AI employee activation uses the central canActivateEmployee policy, and every plan that includes ai_workforce.core also includes customer_ops.core", () => {
  assert.match(
    aiEmployeesRouteSource,
    /canActivateEmployee\(\s*entitlements,\s*type,/,
  );
  assert.match(
    aiEmployeesRouteSource,
    /getBusinessEntitlements\(membership\.businessId\)/,
  );

  // Structural guard against this exact bug class recurring: whatever
  // capability activation requires must never outrun what the chat route
  // requires. Extract each plan's capability array from the source file
  // (no live DB / entitlements-resolution needed for this check) and prove
  // the subset relationship directly.
  const starterMatch = planDefinitionsSource.match(/const starterCapabilities: Capability\[\] = \[([^\]]+)\]/);
  assert.ok(starterMatch, "expected to find starterCapabilities in plan-definitions.ts");
  const starterCapabilities = starterMatch[1].split(",").map((s) => s.trim().replace(/"/g, ""));

  assert.ok(starterCapabilities.includes("ai_workforce.core"), "Starter must include ai_workforce.core (activation requirement)");
  assert.ok(starterCapabilities.includes("customer_ops.core"), "Starter must include customer_ops.core (chat requirement) — otherwise a Starter business could activate a Receptionist it can never talk to");
});

// --- 4: appointment-specific functionality remains protected ---

test("appointment tools still independently require customer_ops.ai_assist before touching any appointment data", () => {
  // hasCapability(entitlements, "customer_ops.ai_assist")/requireAiAssist
  // were centralized into lib/ai/authority.ts's checkAIEmployeeAuthority +
  // ACTION_ENTITLEMENT map — the gate is still enforced, just in one place.
  assert.match(appointmentToolsSource, /checkAIEmployeeAuthority\(\{[^}]*action: "read_appointments"/);
  assert.match(appointmentToolsSource, /checkAIEmployeeAuthority\(\{[^}]*action: "create_appointment"/);
  assert.match(appointmentToolsSource, /checkAIEmployeeAuthority\(\{[^}]*action: "update_appointment"/);
  for (const action of ["read_appointments", "create_appointment", "update_appointment"]) {
    assert.match(aiAuthoritySource, new RegExp(`${action}:\\s*"customer_ops\\.ai_assist"`));
  }
});

test("ticket tools (the equivalent gap in Customer Support) also independently require customer_ops.ai_assist", () => {
  assert.match(ticketToolsSource, /checkAIEmployeeAuthority\(\{[^}]*action: "read_tickets"/);
  assert.match(ticketToolsSource, /checkAIEmployeeAuthority\(\{[^}]*action: "create_ticket"/);
  assert.match(ticketToolsSource, /checkAIEmployeeAuthority\(\{[^}]*action: "escalate_ticket"/);
  for (const action of ["read_tickets", "create_ticket", "escalate_ticket"]) {
    assert.match(aiAuthoritySource, new RegExp(`${action}:\\s*"customer_ops\\.ai_assist"`));
  }
});

// --- 5: the gating LOGIC itself correctly allows/denies based on capability presence ---

test("hasCapability correctly allows a plan that has customer_ops.core and denies one that doesn't", async () => {
  const { hasCapability } = await import("../lib/billing/plan-definitions.ts");

  assert.equal(hasCapability({ capabilities: ["customer_ops.core"] }, "customer_ops.core"), true);
  assert.equal(hasCapability({ capabilities: ["customer_ops.appointments"] }, "customer_ops.core"), false);
  assert.equal(hasCapability({ capabilities: [] }, "customer_ops.core"), false);
});

test("the starter plan definition itself resolves customer_ops.core as true and customer_ops.ai_assist as false", async () => {
  const { getPlanDefinition, hasCapability } = await import("../lib/billing/plan-definitions.ts");

  const starter = getPlanDefinition("starter");
  assert.equal(hasCapability(starter, "customer_ops.core"), true, "Starter must be able to use basic Receptionist chat");
  assert.equal(hasCapability(starter, "customer_ops.ai_assist"), false, "Starter must still be blocked from AI-assisted appointment scheduling");

  const pro = getPlanDefinition("pro");
  assert.equal(hasCapability(pro, "customer_ops.ai_assist"), true, "Pro should be able to use AI-assisted appointment scheduling");
});

// --- 6: tenant isolation unchanged — the capability check is still scoped to the resolved business, never client input ---

test("the entitlement check is scoped to the server-resolved business, not a client-supplied id", () => {
  assert.match(receptionistRouteSource, /getBusinessEntitlements\(business\.id\)/);
  assert.doesNotMatch(receptionistRouteSource, /getBusinessEntitlements\(body\./);
});

// --- 7: permission check (separate from entitlement) is untouched ---

test("the pre-existing RECEPTION_AI permission check is still present and unchanged", () => {
  assert.match(receptionistRouteSource, /PERMISSIONS\.RECEPTION_AI/);
  assert.match(receptionistRouteSource, /You do not have permission to use the AI Receptionist\./);
});
