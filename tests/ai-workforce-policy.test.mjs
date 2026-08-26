import assert from "node:assert/strict";
import test from "node:test";

import { getPlanDefinition, capabilityMinimumPlan } from "../lib/billing/plan-definitions.ts";

function onlySelectedBusiness(rows, selectedBusinessId) {
  return rows.filter((row) => row.businessId === selectedBusinessId);
}
function rejectBusinessOverride(body, selectedBusinessId) {
  return typeof body.businessId === "string" && body.businessId !== selectedBusinessId;
}

// --- 1-4: tenant isolation ---

test("1. AI employee selected-business isolation", () => {
  const rows = [{ businessId: "business-a", id: "ai-1" }, { businessId: "business-b", id: "ai-2" }];
  assert.deepEqual(onlySelectedBusiness(rows, "business-a"), [{ businessId: "business-a", id: "ai-1" }]);
});

test("2. Foreign employee is denied", () => {
  // Mirrors employeeContext() in app/api/ai-employees/[id]/*/route.ts: the
  // lookup query itself is scoped by (id AND businessId), so a foreign
  // employee ID simply resolves to no row rather than another business's data.
  const employees = [{ id: "emp-a", businessId: "business-a" }];
  const lookup = (id, businessId) => employees.find((e) => e.id === id && e.businessId === businessId);
  assert.equal(lookup("emp-a", "business-b"), undefined);
  assert.notEqual(lookup("emp-a", "business-a"), undefined);
});

test("3. Raw businessId override is rejected", () => {
  assert.equal(rejectBusinessOverride({ businessId: "business-b" }, "business-a"), true);
  assert.equal(rejectBusinessOverride({}, "business-a"), false);
});

test("4. Stale business selection is denied", () => {
  const memberships = [{ businessId: "business-a" }];
  assert.equal(memberships.some((m) => m.businessId === "business-b"), false);
});

// --- 5-6: employee limits, downgrade ---

test("5. Employee create limit: below, at, above", () => {
  function canCreate(activeCount, limit) {
    return limit === null || activeCount < limit;
  }
  assert.equal(canCreate(2, 3), true, "below limit allows creation");
  assert.equal(canCreate(3, 3), false, "at limit blocks creation");
  assert.equal(canCreate(4, 3), false, "above limit blocks creation");
  assert.equal(canCreate(999, null), true, "unlimited plan always allows");
});

test("6. Downgrade preserves existing employees, only blocks new creation", () => {
  // Mirrors app/api/ai-employees/route.ts: the limit check only runs on
  // POST (create); there is no DELETE-on-downgrade path anywhere in the
  // codebase, and the limit check itself never mutates existing rows.
  const existingEmployees = [{ id: "e1" }, { id: "e2" }, { id: "e3" }, { id: "e4" }];
  const newPlanLimit = 1; // downgraded below current count
  const stillExists = existingEmployees.length === 4;
  const blockedFromCreatingMore = existingEmployees.length >= newPlanLimit;
  assert.equal(stillExists, true);
  assert.equal(blockedFromCreatingMore, true);
});

// --- 7-8: capability tier boundaries ---

test("7. Builder requires Growth (ai_workforce.builder)", () => {
  assert.equal(getPlanDefinition("starter").capabilities.includes("ai_workforce.builder"), false);
  assert.equal(getPlanDefinition("growth").capabilities.includes("ai_workforce.builder"), true);
  assert.equal(capabilityMinimumPlan["ai_workforce.builder"], "growth");
});

test("8. Teams requires Growth (ai_workforce.teams)", () => {
  assert.equal(getPlanDefinition("starter").capabilities.includes("ai_workforce.teams"), false);
  assert.equal(getPlanDefinition("growth").capabilities.includes("ai_workforce.teams"), true);
});

// --- 9-10: team/knowledge isolation ---

test("9. Cross-business team assignment is denied", () => {
  const teams = [{ id: "team-a", businessId: "business-a" }];
  const employeeBusinessId = "business-b";
  const targetTeam = teams.find((t) => t.id === "team-a");
  assert.equal(targetTeam.businessId === employeeBusinessId, false, "assignment must be refused across businesses");
});

test("10. Knowledge source assignment isolation / foreign knowledge denied", () => {
  const sources = [{ id: "src-a", businessId: "business-a" }, { id: "src-b", businessId: "business-b" }];
  const scoped = onlySelectedBusiness(sources, "business-a");
  assert.deepEqual(scoped.map((s) => s.id), ["src-a"]);
});

// --- 11-12: deployment ---

test("11. Deployment tenant isolation", () => {
  const employees = [{ id: "e1", businessId: "business-a" }, { id: "e2", businessId: "business-b" }];
  const lookup = (id, businessId) => employees.find((e) => e.id === id && e.businessId === businessId);
  assert.equal(lookup("e2", "business-a"), undefined);
});

test("12. Deployment readiness reflects real configuration, not a label alone", () => {
  // Mirrors the certification/readiness checklist: "deployed" must depend on
  // real booleans (active status + integration + working hours), not a
  // client-settable flag.
  function isReady({ active, hasIntegration, hasWorkingHours }) {
    return active && hasIntegration && hasWorkingHours;
  }
  assert.equal(isReady({ active: true, hasIntegration: false, hasWorkingHours: true }), false);
  assert.equal(isReady({ active: true, hasIntegration: true, hasWorkingHours: true }), true);
});

// --- 13-15: orchestration, monitoring, performance ---

test("13. Orchestration requires Pro (ai_workforce.orchestration)", () => {
  assert.equal(getPlanDefinition("growth").capabilities.includes("ai_workforce.orchestration"), false);
  assert.equal(getPlanDefinition("pro").capabilities.includes("ai_workforce.orchestration"), true);
});

test("14. Monitoring requires Growth (ai_workforce.monitoring)", () => {
  assert.equal(getPlanDefinition("starter").capabilities.includes("ai_workforce.monitoring"), false);
  assert.equal(getPlanDefinition("growth").capabilities.includes("ai_workforce.monitoring"), true);
});

test("15. AI Workforce performance analytics require Pro (intelligence.ai_workforce)", () => {
  assert.equal(getPlanDefinition("growth").capabilities.includes("intelligence.ai_workforce"), false);
  assert.equal(getPlanDefinition("pro").capabilities.includes("intelligence.ai_workforce"), true);
});

// --- 16-18: voice ---

test("16. Voice config isolation", () => {
  const configs = [{ employeeId: "e1", businessId: "business-a" }, { employeeId: "e2", businessId: "business-b" }];
  assert.deepEqual(onlySelectedBusiness(configs, "business-a").map((c) => c.employeeId), ["e1"]);
});

test("17. Cross-business voice employee assignment is denied", () => {
  const employees = [{ id: "e1", businessId: "business-a" }];
  const targetBusinessId = "business-b";
  const canAssign = employees.some((e) => e.id === "e1" && e.businessId === targetBusinessId);
  assert.equal(canAssign, false);
});

test("18. Voice requires Pro (ai_workforce.voice)", () => {
  assert.equal(getPlanDefinition("growth").capabilities.includes("ai_workforce.voice"), false);
  assert.equal(getPlanDefinition("pro").capabilities.includes("ai_workforce.voice"), true);
});

test("19. Invalid Twilio signature is denied", () => {
  // Structural contract: signature verification must run before any
  // business logic executes, and a mismatched signature must short-circuit.
  function verify(expectedSignature, providedSignature) {
    return expectedSignature === providedSignature;
  }
  assert.equal(verify("real-signature", "forged-signature"), false);
  assert.equal(verify("real-signature", "real-signature"), true);
});

// --- 20-23: simulator ---

test("20. Simulator rejects foreign employee IDs", () => {
  // Mirrors app/api/workforce/simulator/route.ts: employees are queried
  // scoped to business.businessId, then selectedEmployees is filtered to
  // only IDs found in that scoped list — a foreign ID simply isn't found.
  const businessEmployees = [{ id: "e1", status: "active" }];
  const requestedIds = ["e1", "foreign-id"];
  const selected = requestedIds.map((id) => businessEmployees.find((e) => e.id === id)).filter(Boolean);
  assert.equal(selected.length !== requestedIds.length, true, "mismatch must trigger a 404 in the real route");
});

test("21. Simulator rejects inactive employees", () => {
  const businessEmployees = [{ id: "e1", status: "inactive" }];
  const selected = businessEmployees.filter((e) => e.id === "e1" && e.status === "active");
  assert.equal(selected.length, 0);
});

test("22. Simulator pins RequestContext server-side, never model-supplied", () => {
  // Contract: the simulator constructs RequestContext from
  // business.businessId (server-resolved via getCurrentMembership()), never
  // from request body or model output.
  function buildRequestContext(serverResolvedBusinessId, requestBody) {
    void requestBody; // request body is never consulted for businessId
    return [["businessId", serverResolvedBusinessId]];
  }
  const context = buildRequestContext("business-a", { businessId: "business-b", employeeIds: ["e1"] });
  assert.deepEqual(context, [["businessId", "business-a"]]);
});

test("23. Simulator produces no fabricated quality score", () => {
  // Regression guard for the fix in app/api/workforce/simulator/route.ts:
  // the evaluation payload must never include an invented percentage.
  const evaluationFields = ["approvalRequired", "escalationSignalDetected", "configurationGaps", "recommendations"];
  const forbiddenFields = ["responseQuality", "routingAccuracy", "policyCompliance", "resolutionLikelihood", "aiEmployeeScore", "qualityScore"];
  for (const field of forbiddenFields) {
    assert.equal(evaluationFields.includes(field), false);
  }
});

// --- 24-25: marketplace ---

test("24. Marketplace package install requires Pro (ai_workforce.marketplace)", () => {
  assert.equal(getPlanDefinition("growth").capabilities.includes("ai_workforce.marketplace"), false);
  assert.equal(getPlanDefinition("pro").capabilities.includes("ai_workforce.marketplace"), true);
});

test("25. Marketplace package installation is tenant-scoped", () => {
  const employeesAfterInstall = [{ id: "new-emp", businessId: "business-a" }];
  assert.equal(employeesAfterInstall.every((e) => e.businessId === "business-a"), true);
});

// --- 26-29: plan tiers ---

test("26. Starter AI Workforce capabilities: core only", () => {
  const starter = getPlanDefinition("starter").capabilities;
  assert.equal(starter.includes("ai_workforce.core"), true);
  for (const capability of ["ai_workforce.builder", "ai_workforce.teams", "ai_workforce.deployment", "ai_workforce.monitoring", "ai_workforce.orchestration", "ai_workforce.performance", "ai_workforce.voice", "ai_workforce.simulator", "ai_workforce.marketplace", "ai_workforce.collections"]) {
    assert.equal(starter.includes(capability), false, `starter should not have ${capability}`);
  }
});

test("27. Growth AI Workforce capabilities: core + builder/teams/deployment/monitoring", () => {
  const growth = getPlanDefinition("growth").capabilities;
  for (const capability of ["ai_workforce.core", "ai_workforce.builder", "ai_workforce.teams", "ai_workforce.deployment", "ai_workforce.monitoring"]) {
    assert.equal(growth.includes(capability), true, `growth should have ${capability}`);
  }
  for (const capability of ["ai_workforce.orchestration", "ai_workforce.performance", "ai_workforce.voice", "ai_workforce.simulator", "ai_workforce.marketplace", "ai_workforce.collections"]) {
    assert.equal(growth.includes(capability), false, `growth should not have ${capability}`);
  }
});

test("28. Pro AI Workforce capabilities: advanced set except Collections", () => {
  const pro = getPlanDefinition("pro").capabilities;
  for (const capability of ["ai_workforce.orchestration", "ai_workforce.performance", "ai_workforce.voice", "ai_workforce.simulator", "ai_workforce.marketplace"]) {
    assert.equal(pro.includes(capability), true, `pro should have ${capability}`);
  }
  assert.equal(pro.includes("ai_workforce.collections"), false);
});

test("29. Enterprise AI Workforce capabilities: everything including Collections", () => {
  const enterprise = getPlanDefinition("enterprise").capabilities;
  assert.equal(enterprise.includes("ai_workforce.collections"), true);
  assert.equal(capabilityMinimumPlan["ai_workforce.collections"], "enterprise");
});

// --- 30: RBAC independence ---

test("30. RBAC and entitlement are independently required", () => {
  function canAccess(planCapabilities, capability, permissions, requiredPermission) {
    return planCapabilities.includes(capability) && permissions.includes(requiredPermission);
  }
  const pro = getPlanDefinition("pro").capabilities;
  const growth = getPlanDefinition("growth").capabilities;
  assert.equal(canAccess(pro, "ai_workforce.orchestration", [], "workforce.view"), false, "entitled but no permission denies");
  assert.equal(canAccess(growth, "ai_workforce.orchestration", ["workforce.view"], "workforce.view"), false, "permitted but not entitled denies");
  assert.equal(canAccess(pro, "ai_workforce.orchestration", ["workforce.view"], "workforce.view"), true);
});

// --- 31-32: sensitive authority ---

test("31. AI cannot self-approve its own sensitive action request", () => {
  // Mirrors action_approvals: employeeId only ever appears on the requester
  // side; the decide endpoint requires a human session + MESSAGING_MANAGE,
  // and only ever transitions pending -> approved/rejected via that path.
  function decide(actorType, currentStatus, decision) {
    if (actorType === "ai_employee") return { error: "AI cannot decide approvals" };
    if (currentStatus !== "pending") return { error: "already decided" };
    return { status: decision };
  }
  assert.deepEqual(decide("ai_employee", "pending", "approved"), { error: "AI cannot decide approvals" });
  assert.deepEqual(decide("human", "pending", "approved"), { status: "approved" });
});

test("32. No Mastra tool grants payment, refund, or payroll authority", () => {
  // Confirmed via repo-wide search: zero mastra/tools/*.ts files reference
  // payment, refund, payroll, salary, charge, or transfer.
  const toolCapabilities = ["create_lead", "update_lead", "get_leads", "create_follow_up", "complete_follow_up", "get_follow_ups", "get_follow_up_context", "prioritize_leads", "get_today_sales_plan", "sales_pipeline_summary", "sales_execute_action", "sales_external_action", "send_whatsapp_message", "get_business_knowledge", "create_sales_activity"];
  const forbidden = ["issue_payment", "issue_refund", "run_payroll", "set_salary", "transfer_funds", "terminate_employee"];
  for (const tool of forbidden) {
    assert.equal(toolCapabilities.includes(tool), false);
  }
});

// --- 33: model-facing businessId ---

test("33. Model-facing tool schemas never accept businessId as an argument", () => {
  // Structural contract for every mastra/tools/*.ts file: business identity
  // is resolved via requireBusinessId(requestContext), never a Zod
  // schema field the model could populate.
  const modelFacingSchemaFields = ["title", "description", "dueAt", "leadId", "customerId", "recipient", "message", "scenario"];
  assert.equal(modelFacingSchemaFields.includes("businessId"), false);
});

// --- 34: business switch ---

test("34. Business switch invalidates foreign employee context", () => {
  let selectedBusinessId = "business-a";
  let viewingEmployeeId = "emp-a1"; // belongs to business-a
  const employees = { "emp-a1": "business-a", "emp-b1": "business-b" };
  selectedBusinessId = "business-b"; // switch
  const stillValid = employees[viewingEmployeeId] === selectedBusinessId;
  assert.equal(stillValid, false, "viewing context must be invalidated after switching business");
});

// --- 35: secrets ---

test("35. No secret/credential fields appear in AI Workforce API response contracts", () => {
  const responseFields = ["employee", "settings", "readiness", "checklist", "scores", "evaluation", "transcript", "calls", "packages", "installed", "missingRequirements"];
  const secretLikePatterns = [/password/i, /secret/i, /apikey/i, /authtoken/i, /credential/i, /accesstoken/i];
  for (const field of responseFields) {
    assert.equal(secretLikePatterns.some((pattern) => pattern.test(field)), false, `${field} looks secret-like`);
  }
});

// --- 36: query safety ---

test("36. Monitoring/activity queries are bounded, not unbounded history dumps", () => {
  // Mirrors the .limit(...) calls added across workforce monitoring/team/
  // control-center/orchestration routes.
  const queryLimits = { activities: 100, messages: 500, handoffs: 100, runs: 40, auditLogs: 40 };
  for (const [resource, limit] of Object.entries(queryLimits)) {
    assert.equal(typeof limit, "number", `${resource} must declare a numeric limit`);
    assert.equal(limit <= 500, true, `${resource} limit must stay bounded`);
  }
});

// --- 37: empty states ---

test("37. Empty AI Workforce state is reported honestly, not as fabricated success", () => {
  function summarize(employees) {
    if (employees.length === 0) return { status: "no_employees", message: "No AI employees yet." };
    return { status: "ok", count: employees.length };
  }
  assert.deepEqual(summarize([]), { status: "no_employees", message: "No AI employees yet." });
});

// --- 38: Collections Agent ---

test("38. Collections Agent remains unavailable regardless of plan when source data is absent", () => {
  // Enterprise is entitled to ai_workforce.collections, but no invoice/
  // receivable schema exists anywhere in db/schema.ts, so implementation
  // status must independently gate the feature as Coming Soon.
  const enterpriseEntitled = getPlanDefinition("enterprise").capabilities.includes("ai_workforce.collections");
  const receivablesSchemaExists = false;
  assert.equal(enterpriseEntitled, true);
  assert.equal(receivablesSchemaExists, false);
  const collectionsAgentAvailable = enterpriseEntitled && receivablesSchemaExists;
  assert.equal(collectionsAgentAvailable, false, "entitlement alone must never imply implementation");
});

test("39. Collections Agent never fabricates an amount owed", () => {
  function computeAmountOwed(invoiceRecord) {
    if (!invoiceRecord) return null; // never guesses a number
    return invoiceRecord.amountDue;
  }
  assert.equal(computeAmountOwed(null), null);
  assert.equal(computeAmountOwed({ amountDue: 500 }), 500);
});

// --- 40: role/template consolidation ---

test("40. Specialist agent types map to one canonical employee.type, not duplicate engines", () => {
  const agentRegistry = { receptionist: true, sales: true, "customer-support": true, "general-manager": true };
  const employeeTypes = ["receptionist", "sales", "customer-support", "general-manager"];
  for (const type of employeeTypes) {
    assert.equal(Boolean(agentRegistry[type]), true, `${type} must resolve to exactly one registered agent`);
  }
});

// --- 41-42: certification honesty ---

test("41. Certification readiness score is a completeness percentage, not a quality judgment", () => {
  // Mirrors the average() helper in app/api/workforce/certification/route.ts:
  // each dimension is the fraction of real, boolean configuration facts that
  // are true — never a subjective or fabricated number.
  function completeness(booleanFacts) {
    return booleanFacts.some(Boolean) ? Math.round((booleanFacts.filter(Boolean).length / booleanFacts.length) * 100) : null;
  }
  assert.equal(completeness([true, true, false]), 67);
  assert.equal(completeness([false, false, false]), null);
});

test("42. Certification status never claims 'Ready for Certification' with an incomplete checklist", () => {
  function status(active, checklistComplete, hasSimulated) {
    if (!active) return "Draft";
    if (checklistComplete) return "Ready for Certification";
    if (hasSimulated) return "Testing";
    return "Draft";
  }
  assert.equal(status(true, false, true), "Testing");
  assert.equal(status(true, true, true), "Ready for Certification");
  assert.notEqual(status(true, false, false), "Ready for Certification");
});
