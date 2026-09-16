import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
const root=path.resolve(new URL("..",import.meta.url).pathname); const read=f=>readFile(path.join(root,f),"utf8");
test("CRM acceptance architecture has one canonical chain and automation engine",async()=>{const [customer,engine,events]=await Promise.all([read("app/api/crm/customers/[id]/route.ts"),read("lib/automations/engine.ts"),read("lib/crm/events.ts")]); assert.match(customer,/crmDeals/); assert.match(customer,/tasks/); assert.match(customer,/appointments/); assert.match(customer,/conversations/); assert.match(engine,/runAutomationTrigger/); assert.match(events,/createWonOperationsHandoff/);});
test("CRM acceptance migration review is additive and ordered",async()=>{const a=await read("drizzle/0049_native_crm_pipelines_deals.sql"); const b=await read("drizzle/0050_native_crm_linkages.sql"); assert.match(a,/CREATE TABLE crm_pipelines/); assert.match(a,/CREATE TABLE crm_pipeline_stages/); assert.match(a,/CREATE TABLE crm_deals/); assert.match(b,/ALTER TABLE tasks ADD deal_id/); assert.match(b,/ALTER TABLE appointments ADD deal_id/); assert.doesNotMatch(b,/DROP TABLE|DROP COLUMN/i);});
test("CRM acceptance security keeps business and permission checks server-side",async()=>{for(const f of ["app/api/crm/deals/route.ts","app/api/crm/analytics/route.ts","app/api/crm/customers/[id]/route.ts"]) {const s=await read(f); assert.match(s,/getCurrentMembership/); assert.match(s,/membership\.businessId/); assert.match(s,/CRM_VIEW/);}});
