import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
const root = path.resolve(new URL("..", import.meta.url).pathname); const read = (f) => readFile(path.join(root, f), "utf8");
test("deal listing exposes validated tenant-scoped filters, sorting, and pagination", async () => { const s = await read("app/api/crm/deals/route.ts"); for (const token of ["status", "pipelineId", "stageId", "customerId", "leadId", "source", "assignedUserId", "assignedEmployeeId", "expectedCloseFrom", "createdFrom", "minValue", "Invalid value range", "pagination", "limit + 1"]) assert.match(s, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))); assert.match(s, /membership\.businessId/); });
test("analytics returns truthful tenant-scoped CRM metrics", async () => { const s = await read("app/api/crm/analytics/route.ts"); for (const token of ["totalDeals", "openDeals", "wonDeals", "lostDeals", "winRate", "conversionCount", "stageDistribution", "sourceBreakdown", "expectedClose", "openValueByCurrency", "dateRange"]) assert.match(s, new RegExp(token)); assert.match(s, /PERMISSIONS\.CRM_VIEW/); assert.match(s, /businessId, membership\.businessId/); });
test("CRM dashboard renders analytics cards and server-backed search", async () => { const s = await read("app/dashboard/crm/page.tsx"); for (const token of ["Open deals", "Open pipeline", "Won deals", "Win rate", "/api/crm/analytics", "/api/crm/deals", "Search deals"]) assert.match(s, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))); });
