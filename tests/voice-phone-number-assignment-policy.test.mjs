// Static policy checks for Phase 7's phone-number assignment safety
// (app/api/settings/phone-numbers/route.ts). Mirrors
// tests/outreach-campaign-routes-policy.test.mjs's style — these assert
// invariants about route source without executing them through the
// Next.js runtime (which would require mocking a real session, not done
// anywhere else in this codebase either — see that file's own header
// comment). The underlying building blocks each check calls
// (isPhoneNumberAlreadyRegistered, getVoiceProvider, parseVoiceConfig)
// are exercised directly, with a real database, in
// tests/voice-tenant-resolution.test.mjs and
// tests/voice-provider-availability-policy.test.mjs.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const ROUTE_PATH = path.resolve(new URL("../app/api/settings/phone-numbers/route.ts", import.meta.url).pathname);
let source;

test.before(async () => {
  source = await readFile(ROUTE_PATH, "utf8");
});

test("the assignment route checks provider availability before persisting", () => {
  assert.match(source, /providerDefinition\.status !== "available"/);
});

test("the assignment route checks cross-business number uniqueness before persisting", () => {
  assert.match(source, /isPhoneNumberAlreadyRegistered\(/);
  assert.match(source, /already registered to another business/);
});

test("the assignment route requires the employee to be active, not merely existing", () => {
  assert.match(source, /employee\.status !== "active"/);
});

test("the assignment route requires the employee to already have Voice enabled", () => {
  assert.match(source, /voiceConfig\.enabled/);
});

test("the assignment route requires business voice entitlement before assigning an employee", () => {
  assert.match(source, /hasCapability\(.*ai_workforce\.voice/s);
});

test("every check above runs BEFORE the integrations row is inserted, never after", () => {
  const insertIndex = source.indexOf("db.insert(integrations)");
  assert.ok(insertIndex > -1);
  for (const needle of ['providerDefinition.status !== "available"', "isPhoneNumberAlreadyRegistered(", 'employee.status !== "active"', "voiceConfig.enabled", "ai_workforce.voice"]) {
    const index = source.indexOf(needle);
    assert.ok(index > -1 && index < insertIndex, `"${needle}" must appear before the insert, got index ${index} vs insert at ${insertIndex}`);
  }
});

test("the number is normalized before uniqueness-checking and storage (never stored in a format that would let two differently-formatted strings alias the same number)", () => {
  assert.match(source, /normalizePhoneNumber\(/);
});

test("employeeId is never trusted without verifying it belongs to the caller's own business", () => {
  assert.match(source, /eq\(aiEmployees\.businessId, value\.membership\.businessId\)/);
});
