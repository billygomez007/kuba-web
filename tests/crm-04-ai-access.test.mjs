import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
const root = path.resolve(new URL("..", import.meta.url).pathname); const read = (f) => readFile(path.join(root, f), "utf8");
test("canonical CRM AI policy is role-scoped", async () => { const s = await read("lib/ai/crm-tool-policy.ts"); for (const t of ["receptionist", "customer-support", "outreach", "operations", "general-manager", "appointment", "marketing", "accountant", "finance", "hr", "custom", "CRM_TOOL_POLICY"]) assert.match(s, new RegExp(t)); assert.match(s, /case "hr": case "custom": return \{\}/); });
test("non-sales agents receive only approved CRM read tools", async () => { for (const [f, typ] of [["receptionist.ts","receptionist"],["customer-support.ts","customer-support"],["outreach.ts","outreach"],["operations.ts","operations"],["general-manager.ts","general-manager"],["appointment.ts","appointment"],["marketing.ts","marketing"],["accountant.ts","accountant"],["finance.ts","finance"]]) { const s = await read(`mastra/agents/${f}`); assert.match(s, new RegExp(`crmToolsForEmployeeType\\(\"${typ}\"\\)`)); } });
test("CRM tools remain tenant-context-only and writes use centralized authority", async () => { const s = await read("mastra/tools/crm-tools.ts"); assert.doesNotMatch(s, /businessId:\s*z\./); assert.match(s, /requireBusinessId/); assert.match(s, /checkAIEmployeeAuthority/); });
test("HR and Custom receive no automatic CRM access while Sales remains explicit", async () => { const s = await read("lib/ai/crm-tool-policy.ts"); assert.match(s, /case "hr": case "custom": return \{\}/); assert.match(s, /case "sales": return reads/); });
