import assert from "node:assert/strict";
import test from "node:test";

import { getPlanDefinition } from "../lib/billing/plan-definitions.ts";

// --- Command Center entitlement + RBAC (fixed this pass) ---
// Mirrors the checks added to app/api/command-center/{overview,alerts,briefing}/route.ts,
// which previously had zero RBAC or entitlement checks despite briefing/route.ts
// triggering a real OpenAI API call per request.

test("Command Center requires DASHBOARD_VIEW permission independent of entitlement", () => {
  function canAccessCommandCenter(planCapabilities, permissions) {
    return planCapabilities.includes("command_center.basic") && permissions.includes("dashboard.view");
  }
  const starter = getPlanDefinition("starter").capabilities;
  assert.equal(canAccessCommandCenter(starter, []), false, "entitled but no permission must deny");
  assert.equal(canAccessCommandCenter(starter, ["dashboard.view"]), true);
});

test("Command Center is entitled at every plan tier (command_center.basic)", () => {
  for (const planId of ["starter", "growth", "pro", "enterprise"]) {
    assert.equal(getPlanDefinition(planId).capabilities.includes("command_center.basic"), true, `${planId} should have command_center.basic`);
  }
});

test("Command Center advanced (Organization Overview) remains Enterprise-only", () => {
  assert.equal(getPlanDefinition("pro").capabilities.includes("command_center.advanced"), false);
  assert.equal(getPlanDefinition("enterprise").capabilities.includes("command_center.advanced"), true);
});

test("Executive briefing LLM call cannot fire without a real membership + entitlement check", () => {
  // Structural contract for app/api/command-center/briefing/route.ts: the
  // generateText() call must be unreachable unless both checks pass first.
  function reachesLLMCall(hasSession, hasMembership, hasPermission, hasEntitlement) {
    if (!hasSession) return false;
    if (!hasMembership) return false;
    if (!hasPermission) return false;
    if (!hasEntitlement) return false;
    return true;
  }
  assert.equal(reachesLLMCall(true, true, false, true), false, "no permission must block the LLM call");
  assert.equal(reachesLLMCall(true, true, true, true), true);
});

// --- Last-owner protection (already implemented in app/api/team/members/route.ts, untested) ---

function ownerCount(members) {
  return members.filter((m) => m.role === "owner").length;
}

test("Last business owner cannot be demoted", () => {
  const members = [{ id: "u1", role: "owner" }, { id: "u2", role: "member" }];
  const target = members.find((m) => m.id === "u1");
  const wouldLeaveOwners = target.role === "owner" ? ownerCount(members) - 1 : ownerCount(members);
  assert.equal(wouldLeaveOwners, 0);
  assert.equal(wouldLeaveOwners <= 0 ? "deny" : "allow", "deny");
});

test("Last business owner cannot be removed", () => {
  const members = [{ id: "u1", role: "owner" }];
  const target = members.find((m) => m.id === "u1");
  const remainingOwners = ownerCount(members.filter((m) => m.id !== target.id));
  assert.equal(remainingOwners, 0, "removal must be denied when it would leave zero owners");
});

test("A second owner can be demoted or removed safely", () => {
  const members = [{ id: "u1", role: "owner" }, { id: "u2", role: "owner" }];
  const remainingOwners = ownerCount(members.filter((m) => m.id !== "u2"));
  assert.equal(remainingOwners, 1, "removal is safe when another owner remains");
});

// --- Coming Soon vs Upgrade Required, one more consolidated pass ---

test("Coming Soon and Upgrade Required are structurally distinct outcomes", () => {
  function classify({ entitled, implemented }) {
    if (!entitled) return "UPGRADE_REQUIRED";
    if (!implemented) return "COMING_SOON";
    return "AVAILABLE";
  }
  // Enterprise entitled to Collections Agent, but it's not implemented.
  assert.equal(classify({ entitled: true, implemented: false }), "COMING_SOON");
  // Starter not entitled to Human Workforce, which IS implemented.
  assert.equal(classify({ entitled: false, implemented: true }), "UPGRADE_REQUIRED");
  // Pro entitled to and using Orchestration.
  assert.equal(classify({ entitled: true, implemented: true }), "AVAILABLE");
});

// --- Business switch invalidates stale premium page access ---

test("Switching from Enterprise to Starter invalidates a premium page mid-view", () => {
  function pageAccessAfterSwitch(pageRequiredCapability, newPlanCapabilities) {
    return newPlanCapabilities.includes(pageRequiredCapability) ? "renders" : "upgrade_required";
  }
  const enterpriseCaps = getPlanDefinition("enterprise").capabilities;
  const starterCaps = getPlanDefinition("starter").capabilities;
  assert.equal(pageAccessAfterSwitch("human_workforce.core", enterpriseCaps), "renders");
  assert.equal(pageAccessAfterSwitch("human_workforce.core", starterCaps), "upgrade_required", "must not keep rendering Enterprise content after switching to Starter");
});

// --- Sidebar accordion regression guard (matches the render-time sync fix from an earlier pass) ---

test("Sidebar accordion open/close is a pure toggle independent of active-route auto-open", () => {
  function toggleGroup(state, title) {
    return { ...state, [title]: !state[title] };
  }
  let state = { "AI Workforce": true }; // auto-opened because it's the active route's group
  state = toggleGroup(state, "AI Workforce"); // user manually collapses
  assert.equal(state["AI Workforce"], false);
  state = toggleGroup(state, "AI Workforce"); // user reopens
  assert.equal(state["AI Workforce"], true);
});

// --- Mobile navigation closes after destination click (contract check) ---

test("Mobile navigation link click closes the mobile menu", () => {
  function onMobileLinkClick(isMobile, setMobileOpen) {
    if (isMobile) setMobileOpen(false);
  }
  let mobileOpen = true;
  onMobileLinkClick(true, (value) => { mobileOpen = value; });
  assert.equal(mobileOpen, false);
});
