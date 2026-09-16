import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
const root = path.resolve(new URL("..", import.meta.url).pathname);
const read = (file) => readFile(path.join(root, file), "utf8");
test("Customer 360 API is permission and tenant scoped with bounded timeline queries", async () => { const s = await read("app/api/crm/customers/[id]/route.ts"); assert.match(s, /getCurrentMembership/); assert.match(s, /PERMISSIONS\.CRM_VIEW/); assert.match(s, /eq\(customers\.businessId, membership\.businessId\)/); assert.match(s, /LIMIT_MAX = 100/); assert.match(s, /pagination/); });
test("Customer 360 API projects normalized timeline categories and filters", async () => { const s = await read("app/api/crm/customers/[id]/route.ts"); for (const token of ["conversation_started", "inbound_message", "outbound_message", "handoff", "lead_created", "deal_updated", "appointment_", "task_created", "task_completed", "categoryFor", "filter === \"all\""]) assert.match(s, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))); });
test("Customer 360 UI exposes summary, needs-attention, sections, and server-side filters", async () => { const s = await read("app/dashboard/crm/customers/[id]/page.tsx"); for (const token of ["Open deals", "Active leads", "Needs attention", "Conversations", "Sales", "Tasks", "Appointments", "AI Activity", "filter=${filter}", "/dashboard/crm/deals/"]) assert.match(s, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))); });
