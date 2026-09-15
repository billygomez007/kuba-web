// AI employee deactivation/reactivation (app/api/ai-employees/[id]/route.ts)
// — previously a genuine, documented gap (docs/CURRENT_STATE.md: "no UI
// control and no API route exist anywhere ... to set an AI employee back
// to inactive"). This exercises the real status-mutation logic and the
// runtime-visibility consequence it depends on, against a real disposable
// local database. The route itself is a next/headers-backed handler and
// can't be invoked directly outside a real request (this repo's
// established pattern for that class of route) — so the tenant-isolation
// and auth-wiring guarantees are proven via a combination of a real DB
// exercise of the exact query the route runs, plus static source
// assertions proving the route actually gates on them in order.
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const REPO_ROOT = path.resolve(new URL("..", import.meta.url).pathname);
register(pathToFileURL(path.join(REPO_ROOT, "tests/helpers/alias-loader.mjs")));

let tempDir;
let db, schema, eq, and;

test.before(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "kuba-ai-deactivation-"));
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
  ({ eq, and } = await import("drizzle-orm"));
});

test.after(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

async function createBusiness(name) {
  const id = crypto.randomUUID();
  const now = new Date();
  await db.insert(schema.businesses).values({ id, name, slug: `${id}-slug`, plan: "pro", status: "active", createdAt: now, updatedAt: now });
  return id;
}

async function createEmployee(businessId, type, status = "active") {
  const id = crypto.randomUUID();
  const now = new Date();
  await db.insert(schema.aiEmployees).values({
    id, businessId, type, name: `${type} employee`, status,
    supervisionMode: "owner_supervised", createdAt: now, updatedAt: now,
  });
  return id;
}

// Replicates exactly the query+update sequence app/api/ai-employees/[id]/route.ts
// runs, so the underlying invariant is proven against the real schema/DB,
// independent of the next/headers wrapper around it.
async function deactivateOrReactivate(employeeId, callerBusinessId, action) {
  const existing = (
    await db.select({ id: schema.aiEmployees.id, businessId: schema.aiEmployees.businessId, status: schema.aiEmployees.status })
      .from(schema.aiEmployees).where(eq(schema.aiEmployees.id, employeeId)).limit(1)
  )[0];

  if (!existing || existing.businessId !== callerBusinessId) {
    return { ok: false, status: 404 };
  }

  const nextStatus = action === "deactivate" ? "inactive" : "active";
  if (existing.status === nextStatus) {
    return { ok: true, unchanged: true, status: nextStatus };
  }

  await db.update(schema.aiEmployees).set({ status: nextStatus, updatedAt: new Date() })
    .where(and(eq(schema.aiEmployees.id, employeeId), eq(schema.aiEmployees.businessId, callerBusinessId)));

  return { ok: true, unchanged: false, status: nextStatus };
}

test("deactivating an active employee sets status to inactive", async () => {
  const businessId = await createBusiness("Deactivation Co");
  const employeeId = await createEmployee(businessId, "sales", "active");

  const result = await deactivateOrReactivate(employeeId, businessId, "deactivate");
  assert.equal(result.ok, true);
  assert.equal(result.status, "inactive");

  const [row] = await db.select().from(schema.aiEmployees).where(eq(schema.aiEmployees.id, employeeId));
  assert.equal(row.status, "inactive");
});

test("reactivating restores status to active without creating a new row", async () => {
  const businessId = await createBusiness("Reactivation Co");
  const employeeId = await createEmployee(businessId, "receptionist", "inactive");

  const result = await deactivateOrReactivate(employeeId, businessId, "reactivate");
  assert.equal(result.status, "active");

  const rows = await db.select().from(schema.aiEmployees).where(eq(schema.aiEmployees.businessId, businessId));
  assert.equal(rows.length, 1, "reactivation must update the existing row, never insert a duplicate");
  assert.equal(rows[0].id, employeeId);
});

test("deactivation preserves the employee row and its historical activity — never a delete", async () => {
  const businessId = await createBusiness("History Preserved Co");
  const employeeId = await createEmployee(businessId, "customer-support", "active");
  await db.insert(schema.aiEmployeeActivities).values({
    id: crypto.randomUUID(), businessId, employeeId, type: "conversation", title: "Handled a ticket",
    status: "completed", createdAt: new Date(),
  });

  await deactivateOrReactivate(employeeId, businessId, "deactivate");

  const [employeeRow] = await db.select().from(schema.aiEmployees).where(eq(schema.aiEmployees.id, employeeId));
  assert.ok(employeeRow, "the employee row itself must still exist");
  const activities = await db.select().from(schema.aiEmployeeActivities).where(eq(schema.aiEmployeeActivities.employeeId, employeeId));
  assert.equal(activities.length, 1, "historical activity must be untouched");
});

test("a repeated deactivate call is a safe no-op, not an error", async () => {
  const businessId = await createBusiness("Idempotent Co");
  const employeeId = await createEmployee(businessId, "outreach", "inactive");

  const result = await deactivateOrReactivate(employeeId, businessId, "deactivate");
  assert.equal(result.unchanged, true);
  assert.equal(result.status, "inactive");
});

test("TENANT ISOLATION: a business can never deactivate another business's employee, even with the correct employee ID", async () => {
  const businessA = await createBusiness("Tenant A");
  const businessB = await createBusiness("Tenant B");
  const employeeOfA = await createEmployee(businessA, "general-manager", "active");

  const result = await deactivateOrReactivate(employeeOfA, businessB, "deactivate");
  assert.equal(result.ok, false);
  assert.equal(result.status, 404);

  const [row] = await db.select().from(schema.aiEmployees).where(eq(schema.aiEmployees.id, employeeOfA));
  assert.equal(row.status, "active", "business B's failed attempt must never mutate business A's employee");
});

test("REGRESSION: a deactivated employee is no longer resolved as 'active' by the runtime status filter every chat route uses", async () => {
  const businessId = await createBusiness("Runtime Visibility Co");
  const employeeId = await createEmployee(businessId, "sales", "active");
  await deactivateOrReactivate(employeeId, businessId, "deactivate");

  // Mirrors the exact WHERE clause app/api/ai/sales/route.ts (and every
  // sibling runtime route) uses to resolve which employee to invoke.
  const resolvable = await db.select().from(schema.aiEmployees)
    .where(and(eq(schema.aiEmployees.id, employeeId), eq(schema.aiEmployees.status, "active")));
  assert.equal(resolvable.length, 0, "a deactivated employee must not be resolvable by the runtime's active-status filter");
});

test("REGRESSION: the deactivation route requires business membership, verifies tenant ownership before mutating, and audits the change", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/api/ai-employees/[id]/route.ts"), "utf8");
  assert.match(source, /requireBusinessMembership\(\)/);
  assert.match(source, /hasPermission\(\s*membership\.role,\s*membership\.permissions,\s*PERMISSIONS\.WORKFORCE_MANAGE\s*\)/);

  const businessCheckIndex = source.indexOf("existing.businessId !== membership.businessId");
  const updateIndex = source.indexOf(".update(aiEmployees)");
  assert.ok(businessCheckIndex > -1 && updateIndex > -1);
  assert.ok(businessCheckIndex < updateIndex, "tenant ownership must be verified before any mutation");

  assert.match(source, /from ["']@\/lib\/auth\/audit["']/);
  assert.match(source, /createAuditLog/);
  assert.match(source, /"ai_employee\.deactivated"/);
  assert.match(source, /"ai_employee\.reactivated"/);
});
