import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
const root=path.resolve(new URL("..",import.meta.url).pathname); const read=f=>readFile(path.join(root,f),"utf8");
test("CRM events use canonical automation trigger architecture",async()=>{const s=await read("lib/crm/events.ts"); for(const e of ["crm.lead.converted","crm.deal.created","crm.deal.stage_changed","crm.deal.won","crm.deal.lost","crm.deal.reopened"]) assert.match(s,new RegExp(e.replaceAll(".","\\."))); assert.match(s,/runAutomationTrigger/);});
test("Won deals create idempotent operations tasks in the same business",async()=>{const s=await read("lib/crm/events.ts"); assert.match(s,/Onboard customer/); assert.match(s,/eq\(tasks\.businessId, businessId\)/); assert.match(s,/eq\(tasks\.dealId, dealId\)/); assert.match(s,/type, "operations"/);});
test("deal and lead mutations emit CRM events after persistence",async()=>{for(const f of ["app/api/crm/deals/route.ts","app/api/crm/deals/[id]/route.ts","app/api/crm/leads/[id]/convert/route.ts"]) assert.match(await read(f),/emitCrmEvent/);});
test("Automation Builder exposes CRM trigger family",async()=>{const s=await read("app/dashboard/automations/page.tsx"); for(const e of ["crm.lead.converted","crm.deal.created","crm.deal.stage_changed","crm.deal.won","crm.deal.lost","crm.deal.reopened"]) assert.match(s,new RegExp(e.replaceAll(".","\\.")));});
