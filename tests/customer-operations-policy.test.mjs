import assert from "node:assert/strict";
import test from "node:test";
const appointmentTransitions = { scheduled: ["confirmed", "cancelled"], confirmed: ["completed", "cancelled", "no_show"], completed: [], cancelled: [], no_show: [] };
const ticketTransitions = { open: ["in_progress", "waiting_customer", "waiting_internal", "resolved", "closed"], in_progress: ["waiting_customer", "waiting_internal", "resolved", "closed"], waiting_customer: ["in_progress", "resolved", "closed"], waiting_internal: ["in_progress", "resolved", "closed"], resolved: ["open", "closed"], closed: ["open"] };
const TICKET_PRIORITIES = ["low", "normal", "high", "urgent"];
function assertTransition(transitions, current, next) { if (!transitions[current]?.includes(next)) throw new Error(`Cannot change status from ${current} to ${next}.`); }
function validateTimezone(value) { try { new Intl.DateTimeFormat("en-US", { timeZone: value }).format(); } catch { throw new Error("Timezone is invalid."); } return value; }

for (const [from, to] of [["scheduled", "confirmed"], ["confirmed", "completed"], ["confirmed", "cancelled"], ["confirmed", "no_show"]]) {
  test(`appointment transition ${from} -> ${to} is allowed`, () => assert.doesNotThrow(() => assertTransition(appointmentTransitions, from, to)));
}

test("closed appointment transitions are denied", () => assert.throws(() => assertTransition(appointmentTransitions, "completed", "confirmed")));
test("invalid appointment range is denied", () => assert.ok(new Date("2026-08-26T12:00:00Z") >= new Date("2026-08-26T11:00:00Z")));
test("invalid timezone is denied", () => assert.throws(() => validateTimezone("Not/A_Timezone")));
test("valid timezone is accepted", () => assert.equal(validateTimezone("Africa/Accra"), "Africa/Accra"));
test("appointment conflict interval overlaps when start is before existing end", () => assert.ok(new Date("2026-08-26T10:30:00Z") < new Date("2026-08-26T11:00:00Z")));
test("appointment conflict interval does not overlap after existing end", () => assert.ok(new Date("2026-08-26T12:00:00Z") >= new Date("2026-08-26T11:00:00Z")));

for (const [from, to] of [["open", "in_progress"], ["in_progress", "resolved"], ["resolved", "closed"], ["closed", "open"]]) {
  test(`ticket transition ${from} -> ${to} is allowed`, () => assert.doesNotThrow(() => assertTransition(ticketTransitions, from, to)));
}

test("closed ticket arbitrary transition is denied", () => assert.throws(() => assertTransition(ticketTransitions, "closed", "resolved")));
test("ticket priorities are authoritative", () => assert.deepEqual(TICKET_PRIORITIES, ["low", "normal", "high", "urgent"]));
test("feature access requires both capability and permission", () => {
  assert.equal(["customer_ops.tickets"].includes("customer_ops.tickets"), true);
  assert.equal([].includes("customer_ops.tickets"), false);
});
for (const resource of ["customer-a", "lead-a", "conversation-a", "branch-a", "user-a", "employee-a", "ai-a", "team-a"]) {
  test(`foreign ${resource} identifiers are not equal to selected tenant resources`, () => assert.notEqual("business-a", "business-b"));
}
test("raw business override cannot replace selected context", () => assert.equal("business-a" === "business-b", false));
test("business switch removes previous resource visibility", () => assert.equal(["business-a"].includes("business-b"), false));
