// Real-implementation-path tests for lib/voice/rate-limits.ts — the
// technical (not commercial) daily-call safety limit enforced by
// app/api/voice/calls/route.ts's "outbound" action.
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const REPO_ROOT = path.resolve(new URL("..", import.meta.url).pathname);
register(pathToFileURL(path.join(REPO_ROOT, "tests/helpers/alias-loader.mjs")));

let db, schema, rateLimits;
let tempDir;
const BIZ = "biz-voice-rate-limits";
const EMPLOYEE = "emp-outbound-1";
const OTHER_EMPLOYEE = "emp-outbound-2";

function id(label) {
  return `${label}-${Math.random().toString(36).slice(2, 10)}`;
}

async function seedCallStartedActivity(businessId, employeeId, createdAt) {
  await db.insert(schema.aiEmployeeActivities).values({
    id: id("activity"),
    businessId,
    employeeId,
    type: "voice_call.started",
    title: "Voice call started",
    description: "test",
    status: "completed",
    createdAt,
  });
}

test.before(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "kuba-voice-rate-limits-"));
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
  rateLimits = await import("@/lib/voice/rate-limits");

  const now = new Date();
  await db.insert(schema.businesses).values({ id: BIZ, name: "Rate Limit Biz", slug: BIZ, status: "active", createdAt: now, updatedAt: now });
});

test.after(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

test("counts zero for an employee with no call activity today", async () => {
  assert.equal(await rateLimits.countTodaysOutboundCalls(BIZ, EMPLOYEE), 0);
});

test("counts today's voice_call.started activities for this employee", async () => {
  const now = new Date();
  await seedCallStartedActivity(BIZ, EMPLOYEE, now);
  await seedCallStartedActivity(BIZ, EMPLOYEE, now);
  assert.equal(await rateLimits.countTodaysOutboundCalls(BIZ, EMPLOYEE), 2);
});

test("never counts a different employee's calls", async () => {
  await seedCallStartedActivity(BIZ, OTHER_EMPLOYEE, new Date());
  const employeeCount = await rateLimits.countTodaysOutboundCalls(BIZ, EMPLOYEE);
  const otherCount = await rateLimits.countTodaysOutboundCalls(BIZ, OTHER_EMPLOYEE);
  assert.equal(employeeCount, 2, "the first employee's count must be unaffected by the other employee's activity");
  assert.equal(otherCount, 1);
});

test("never counts a call from a prior day", async () => {
  const employeeId = id("emp-yesterday");
  const yesterday = new Date(Date.now() - 25 * 60 * 60_000);
  await seedCallStartedActivity(BIZ, employeeId, yesterday);
  assert.equal(await rateLimits.countTodaysOutboundCalls(BIZ, employeeId), 0);
});

test("never counts a non-call-started activity type", async () => {
  const employeeId = id("emp-other-activity");
  await db.insert(schema.aiEmployeeActivities).values({ id: id("activity"), businessId: BIZ, employeeId, type: "voice_call.completed", title: "x", description: "x", status: "completed", createdAt: new Date() });
  assert.equal(await rateLimits.countTodaysOutboundCalls(BIZ, employeeId), 0);
});
