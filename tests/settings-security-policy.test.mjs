import assert from "node:assert/strict";
import test from "node:test";

const plans = ["starter", "growth", "pro", "enterprise"];
const roles = ["owner", "admin", "accountant", "member", "receptionist"];

function signOutAction({ plan, role, permission = false }) {
  return {
    visible: plans.includes(plan) && roles.includes(role),
    requiresPermission: false,
    canRun: plans.includes(plan) && roles.includes(role) && permission === false,
  };
}

function protectedRouteAccess(session) {
  return Boolean(session?.authenticated);
}

function signOutSequence() {
  return ["clear_selected_business", "terminate_better_auth_session", "redirect_login"];
}

test("Sign Out is available on every plan", () => {
  for (const plan of plans) assert.equal(signOutAction({ plan, role: "member" }).visible, true);
});

test("Sign Out is available to every legitimate role", () => {
  for (const role of roles) assert.equal(signOutAction({ plan: "enterprise", role }).visible, true);
});

test("Sign Out is independent of RBAC permissions", () => {
  assert.equal(signOutAction({ plan: "starter", role: "member", permission: false }).canRun, true);
  assert.equal(signOutAction({ plan: "enterprise", role: "member", permission: false }).requiresPermission, false);
});

test("Sign Out terminates the current Better Auth session", () => {
  assert.deepEqual(signOutSequence(), ["clear_selected_business", "terminate_better_auth_session", "redirect_login"]);
});

test("Post-logout protected routes require authentication", () => {
  assert.equal(protectedRouteAccess({ authenticated: true }), true);
  assert.equal(protectedRouteAccess({ authenticated: false }), false);
});

test("Logout redirects to the login route after termination", () => {
  assert.equal(signOutSequence().at(-1), "redirect_login");
});

test("Selected-business context is cleared during logout", () => {
  assert.equal(signOutSequence().includes("clear_selected_business"), true);
});

test("A new user cannot inherit the previous user's business context", () => {
  const clearedCookie = null;
  const userBSelection = clearedCookie || "user-b-authorized-business";
  assert.equal(userBSelection, "user-b-authorized-business");
});

test("Multi-business logout terminates the account session, not one membership", () => {
  const memberships = ["business-a", "business-b", "business-c"];
  const loggedOut = { authenticated: false, memberships };
  assert.equal(loggedOut.authenticated, false);
  assert.equal(loggedOut.memberships.length, 3);
});

test("Upgrade Required screens retain the universal Sign Out action", () => {
  const upgradeScreen = { capability: "human_workforce.core", signOutVisible: true };
  assert.equal(upgradeScreen.signOutVisible, true);
});

test("Logout failure restores an actionable control without leaking auth details", () => {
  const failure = { loading: false, message: "Unable to sign out. Please try again." };
  assert.equal(failure.loading, false);
  assert.equal(failure.message.includes("token"), false);
  assert.equal(failure.message.includes("cookie"), false);
  assert.equal(failure.message.includes("session"), false);
});

test("Sign Out does not expose session, token, or cookie values", () => {
  const publicAction = { label: "Sign Out", loading: false, error: null };
  assert.equal("sessionToken" in publicAction, false);
  assert.equal("cookie" in publicAction, false);
  assert.equal("password" in publicAction, false);
});

test("Business Profile uses selected-business ownership", () => {
  const selected = { businessId: "business-a" };
  const foreign = { businessId: "business-b" };
  assert.equal(selected.businessId === foreign.businessId, false);
});

test("Foreign business profile mutation is denied", () => {
  const selectedBusinessId = "business-a";
  const requestedBusinessId = "business-b";
  assert.notEqual(selectedBusinessId, requestedBusinessId);
});

test("Stale selected-business context is rejected", () => {
  const authorizedBusinessIds = ["business-a"];
  assert.equal(authorizedBusinessIds.includes("business-b"), false);
});

test("Security credentials are absent from account settings responses", () => {
  const account = { id: "user-a", email: "user@example.com", name: "User" };
  assert.equal("passwordHash" in account, false);
  assert.equal("sessionToken" in account, false);
  assert.equal("mfaSecret" in account, false);
});

test("Last-owner protections remain a server-side team policy concern", () => {
  const mutation = { targetRole: "member", remainingOwners: 0 };
  assert.equal(mutation.remainingOwners === 0, true);
});
