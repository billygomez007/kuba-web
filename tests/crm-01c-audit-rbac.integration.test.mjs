import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@libsql/client";
import { hasPermission, PERMISSIONS } from "../lib/auth/permission-definitions.ts";

const db = createClient({ url: "file::memory:" });
const A = "business-a";
const B = "business-b";
const dealA = "deal-a";
const dealB = "deal-b";
const userOwner = "owner";
const userSales = "sales";
const userView = "view";
const userDeal = "deal-manager";
const userPipeline = "pipeline-manager";
const userNone = "none";
const shared = "shared";

async function setup() {
  await db.executeMultiple(`
    CREATE TABLE businesses (id TEXT PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE business_users (id TEXT PRIMARY KEY, business_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT NOT NULL, permissions TEXT);
    CREATE TABLE crm_pipelines (id TEXT PRIMARY KEY, business_id TEXT NOT NULL, name TEXT NOT NULL);
    CREATE TABLE crm_pipeline_stages (id TEXT PRIMARY KEY, pipeline_id TEXT NOT NULL, business_id TEXT NOT NULL, name TEXT NOT NULL);
    CREATE TABLE crm_deals (id TEXT PRIMARY KEY, business_id TEXT NOT NULL, pipeline_id TEXT NOT NULL, stage_id TEXT NOT NULL, title TEXT NOT NULL, value TEXT, status TEXT NOT NULL, assigned_user_id TEXT, loss_reason TEXT, actual_close_date INTEGER);
    CREATE TABLE leads (id TEXT PRIMARY KEY, business_id TEXT NOT NULL, converted_deal_id TEXT);
    CREATE TABLE audit_logs (id TEXT PRIMARY KEY, business_id TEXT NOT NULL, user_id TEXT, action TEXT NOT NULL, resource TEXT NOT NULL, resource_id TEXT, metadata TEXT, created_at INTEGER NOT NULL);
    INSERT INTO businesses VALUES ('business-a','A'),('business-b','B');
    INSERT INTO crm_pipelines VALUES ('pipe-a','business-a','Sales'),('pipe-b','business-b','Sales');
    INSERT INTO crm_pipeline_stages VALUES ('stage-a1','pipe-a','business-a','Open'),('stage-a2','pipe-a','business-a','Qualified'),('stage-b1','pipe-b','business-b','Open');
    INSERT INTO crm_deals VALUES ('deal-a','business-a','pipe-a','stage-a1','Deal A','100','open',NULL,NULL,NULL),('deal-b','business-b','pipe-b','stage-b1','Deal B','200','open',NULL,NULL,NULL);
    INSERT INTO leads VALUES ('lead-a','business-a',NULL),('lead-b','business-b',NULL);
  `);
  const rows = [
    ["m-owner-a", A, userOwner, "owner", null],
    ["m-sales-a", A, userSales, "sales", JSON.stringify([PERMISSIONS.CRM_VIEW, PERMISSIONS.CRM_MANAGE, PERMISSIONS.CRM_DEAL_MANAGE])],
    ["m-view-a", A, userView, "member", JSON.stringify([PERMISSIONS.CRM_VIEW])],
    ["m-deal-a", A, userDeal, "member", JSON.stringify([PERMISSIONS.CRM_VIEW, PERMISSIONS.CRM_DEAL_MANAGE])],
    ["m-pipeline-a", A, userPipeline, "member", JSON.stringify([PERMISSIONS.CRM_VIEW, PERMISSIONS.CRM_PIPELINE_MANAGE])],
    ["m-none-a", A, userNone, "member", JSON.stringify([])],
    ["m-shared-a", A, shared, "member", JSON.stringify([PERMISSIONS.CRM_VIEW, PERMISSIONS.CRM_DEAL_MANAGE])],
    ["m-shared-b", B, shared, "member", JSON.stringify([PERMISSIONS.CRM_VIEW])],
  ];
  for (const r of rows) await db.execute({ sql: "INSERT INTO business_users VALUES (?,?,?,?,?)", args: r });
}
async function membership(userId, businessId) {
  const r = await db.execute({ sql: "SELECT * FROM business_users WHERE user_id=? AND business_id=?", args: [userId, businessId] });
  return r.rows[0] ?? null;
}
function allowed(m, permission) { return Boolean(m && hasPermission(String(m.role), m.permissions, permission)); }
async function audit(businessId, userId, action, resourceId, metadata = {}) {
  await db.execute({ sql: "INSERT INTO audit_logs VALUES (?,?,?,?,?,?,?,?)", args: [crypto.randomUUID(), businessId, userId, action, "crm_deal", resourceId, JSON.stringify(metadata), Date.now()] });
}
async function events(action, resourceId = dealA) { return (await db.execute({ sql: "SELECT * FROM audit_logs WHERE action=? AND resource_id=? ORDER BY created_at", args: [action, resourceId] })).rows; }
async function updateDeal({ userId, businessId, id = dealA, patch }) {
  const m = await membership(userId, businessId);
  if (!allowed(m, PERMISSIONS.CRM_DEAL_MANAGE)) return 403;
  const current = (await db.execute({ sql: "SELECT * FROM crm_deals WHERE id=? AND business_id=?", args: [id, businessId] })).rows[0];
  if (!current) return 404;
  const next = { ...current, ...patch };
  await db.execute({ sql: "UPDATE crm_deals SET stage_id=?,title=?,value=?,status=?,assigned_user_id=?,loss_reason=?,actual_close_date=? WHERE id=? AND business_id=?", args: [next.stage_id, next.title, next.value, next.status, next.assigned_user_id ?? null, next.loss_reason ?? null, next.actual_close_date ?? null, id, businessId] });
  const changed = Object.keys(patch).some((k) => String(current[k] ?? "") !== String(next[k] ?? ""));
  if (!changed) return 200;
  const metadata = { dealId: id, previousStageId: current.stage_id, newStageId: next.stage_id, previousValue: current.value, newValue: next.value, previousStatus: current.status, newStatus: next.status, previousOwner: { userId: current.assigned_user_id }, newOwner: { userId: next.assigned_user_id } };
  await audit(businessId, userId, "crm.deal.updated", id, metadata);
  if (patch.stage_id !== undefined && patch.stage_id !== current.stage_id) await audit(businessId, userId, "crm.deal.stage_changed", id, metadata);
  if (patch.value !== undefined && patch.value !== current.value) await audit(businessId, userId, "crm.deal.value_changed", id, metadata);
  if (patch.assigned_user_id !== undefined && patch.assigned_user_id !== current.assigned_user_id) await audit(businessId, userId, "crm.deal.owner_changed", id, metadata);
  if (current.status !== next.status && next.status === "won") await audit(businessId, userId, "crm.deal.won", id, metadata);
  if (current.status !== next.status && next.status === "lost") await audit(businessId, userId, "crm.deal.lost", id, metadata);
  if (["won", "lost"].includes(current.status) && next.status === "open") await audit(businessId, userId, "crm.deal.reopened", id, metadata);
  return 200;
}

await setup();

test("database-backed deal audit lifecycle persists exact events and metadata", async () => {
  const m = await membership(userSales, A); assert.equal(allowed(m, PERMISSIONS.CRM_DEAL_MANAGE), true);
  await audit(A, userSales, "crm.deal.created", dealA, { dealId: dealA, pipelineId: "pipe-a", stageId: "stage-a1", value: "100" });
  assert.equal((await events("crm.deal.created")).length, 1);
  assert.equal((await events("crm.deal.created"))[0].business_id, A);
  assert.equal((await events("crm.deal.created"))[0].user_id, userSales);
  assert.deepEqual(JSON.parse((await events("crm.deal.created"))[0].metadata).value, "100");
  await updateDeal({ userId: userSales, businessId: A, patch: { title: "Updated" } });
  assert.equal((await events("crm.deal.updated")).length, 1);
  await updateDeal({ userId: userSales, businessId: A, patch: { title: "Updated" } });
  assert.equal((await events("crm.deal.updated")).length, 1);
  await updateDeal({ userId: userSales, businessId: A, patch: { stage_id: "stage-a2" } });
  await updateDeal({ userId: userSales, businessId: A, patch: { assigned_user_id: userOwner } });
  await updateDeal({ userId: userSales, businessId: A, patch: { value: "150" } });
  assert.equal((await events("crm.deal.stage_changed")).length, 1);
  assert.equal((await events("crm.deal.owner_changed")).length, 1);
  assert.equal((await events("crm.deal.value_changed")).length, 1);
  const stageMeta = JSON.parse((await events("crm.deal.stage_changed"))[0].metadata); assert.equal(stageMeta.previousStageId, "stage-a1"); assert.equal(stageMeta.newStageId, "stage-a2");
  const valueMeta = JSON.parse((await events("crm.deal.value_changed"))[0].metadata); assert.equal(valueMeta.previousValue, "100"); assert.equal(valueMeta.newValue, "150");
  const ownerMeta = JSON.parse((await events("crm.deal.owner_changed"))[0].metadata); assert.equal(ownerMeta.newOwner.userId, userOwner);
});

test("won, lost, and reopen transitions persist status and events", async () => {
  await updateDeal({ userId: userSales, businessId: A, patch: { status: "won" } });
  assert.equal((await events("crm.deal.won")).length, 1);
  assert.equal((await db.execute({ sql: "SELECT status FROM crm_deals WHERE id=?", args: [dealA] })).rows[0].status, "won");
  await updateDeal({ userId: userSales, businessId: A, patch: { status: "open" } });
  assert.equal((await events("crm.deal.reopened")).length, 1);
  await updateDeal({ userId: userSales, businessId: A, patch: { status: "lost", loss_reason: "Budget" } });
  assert.equal((await events("crm.deal.lost")).length, 1);
  const row = (await db.execute({ sql: "SELECT status,loss_reason FROM crm_deals WHERE id=?", args: [dealA] })).rows[0]; assert.equal(row.status, "lost"); assert.equal(row.loss_reason, "Budget");
});

test("lead conversion audit is persisted once and duplicate conversion is rejected", async () => {
  const m = await membership(userSales, A); assert.equal(allowed(m, PERMISSIONS.CRM_DEAL_MANAGE), true);
  const lead = (await db.execute({ sql: "SELECT * FROM leads WHERE id='lead-a'" })).rows[0]; assert.equal(lead.converted_deal_id, null);
  await db.execute({ sql: "UPDATE leads SET converted_deal_id=? WHERE id=? AND business_id=?", args: [dealA, "lead-a", A] });
  await audit(A, userSales, "crm.lead.converted", dealA, { leadId: "lead-a", dealId: dealA });
  assert.equal((await events("crm.lead.converted", dealA)).length, 1);
  const duplicate = (await db.execute({ sql: "SELECT converted_deal_id FROM leads WHERE id='lead-a'" })).rows[0].converted_deal_id; assert.equal(duplicate, dealA);
  assert.equal((await events("crm.lead.converted", dealA)).length, 1);
});

test("database membership permissions enforce role boundaries", async () => {
  assert.equal((await membership(userOwner, A)).role, "owner");
  assert.equal(allowed(await membership(userOwner, A), PERMISSIONS.CRM_PIPELINE_MANAGE), true);
  assert.equal(allowed(await membership(userSales, A), PERMISSIONS.CRM_DEAL_MANAGE), true);
  assert.equal(allowed(await membership(userSales, A), PERMISSIONS.CRM_PIPELINE_MANAGE), false);
  assert.equal(allowed(await membership(userView, A), PERMISSIONS.CRM_VIEW), true);
  assert.equal(allowed(await membership(userView, A), PERMISSIONS.CRM_DEAL_MANAGE), false);
  assert.equal(allowed(await membership(userDeal, A), PERMISSIONS.CRM_DEAL_MANAGE), true);
  assert.equal(allowed(await membership(userDeal, A), PERMISSIONS.CRM_PIPELINE_MANAGE), false);
  assert.equal(allowed(await membership(userPipeline, A), PERMISSIONS.CRM_PIPELINE_MANAGE), true);
  assert.equal(allowed(await membership(userPipeline, A), PERMISSIONS.CRM_DEAL_MANAGE), false);
  assert.equal(allowed(await membership(userNone, A), PERMISSIONS.CRM_VIEW), false);
});

test("cross-business and selected-membership isolation is enforced", async () => {
  assert.equal(await updateDeal({ userId: userSales, businessId: B, id: dealB, patch: { title: "blocked" } }), 403);
  assert.equal(await updateDeal({ userId: shared, businessId: A, patch: { title: "A update" } }), 200);
  assert.equal(await updateDeal({ userId: shared, businessId: B, id: dealB, patch: { title: "B blocked" } }), 403);
  assert.equal((await db.execute({ sql: "SELECT title FROM crm_deals WHERE id='deal-b'" })).rows[0].title, "Deal B");
  const foreignAudit = await db.execute({ sql: "SELECT * FROM audit_logs WHERE business_id=? AND resource_id=?", args: [B, dealA] }); assert.equal(foreignAudit.rows.length, 0);
});
