# SuperKuba AI Employee Authority Matrix

Canonical, machine-checkable reference for what every AI-employee tool can do and how it is enforced. Every row here corresponds to an entry in `AI_ACTIONS` in `lib/ai/authority.ts` — that file, not this document, is authoritative if they ever diverge; this document should be regenerated/updated whenever a tool or action changes.

Every tool call passes through `checkAIEmployeeAuthority()` (`lib/ai/authority.ts`), which checks, in order: (1) the employee belongs to the business in `RequestContext` (tenant check), (2) the employee's `status` is `active`, (3) any entitlement the action requires, (4) the employee's stored per-action policy (`ai_employee_action_policies`, one row per employee — lazily created with conservative defaults on first check). A denial or an approval requirement is audited (`auditLogs`, action prefix `ai.authority.*`); an allowed write/communication action is also audited by the tool itself.

## Autonomy levels

| Level | Reads | Writes | Communication |
|---|---|---|---|
| **Assistant** | Allowed | Requires approval | Requires approval |
| **Operator** (legacy default) | Allowed | Allowed | Requires approval |
| **Autonomous** | Allowed | Allowed | Requires approval |

Communication can never be set to "Allowed" at any level, by anyone — it is a hard floor in code (`COMMUNICATION_FLOOR` in `lib/ai/authority.ts`), not just a default. An owner can still override any individual write action's decision (Off / Allowed / Needs approval) per employee via **Dashboard → AI Employees → [employee] → Permissions**.

Legacy employees (schema default `supervisionMode: "owner_supervised"`, a fourth value that predates and is outside the three real levels) are treated as **Operator** the first time they're checked — this preserves today's real behavior rather than either silently unlocking Autonomous or silently locking every existing employee down to Assistant.

## Tool authority matrix

| Action | Tool(s) | Agent(s) | Kind | Entitlement | Approval architecture |
|---|---|---|---|---|---|
| `read_business_knowledge` | `getBusinessKnowledgeTool` | Sales, Receptionist, Customer Support, General Manager | Read | None | n/a |
| `read_customers` | `findCustomerTool` | Receptionist, Customer Support | Read | None | n/a |
| `create_customer` | `createCustomerTool` | Receptionist, Customer Support | Write | None | Generic (`ai_employee_action_approvals`) |
| `read_leads` | `getLeadsTool`, `getTodaySalesPlanTool`, `prioritizeLeadsTool`, `salesPipelineSummaryTool` | Sales | Read | None | n/a |
| `create_lead` | `createLeadTool` | Sales, Receptionist | Write | None | Generic |
| `update_lead` | `updateLeadTool` | Sales | Write | None | Generic |
| `read_follow_ups` | `getFollowUpsTool`, `getFollowUpContextTool`, `salesWorkPlanTool` | Sales | Read | None | n/a |
| `create_follow_up` | `createFollowUpTool` | Sales | Write | None | Generic |
| `complete_follow_up` | `completeFollowUpTool` | Sales | Write | None | Generic |
| `create_sales_activity` | `createSalesActivityTool` | Sales | Write | None | Generic |
| `read_appointments` | `getAppointmentsTool` | Receptionist, Sales | Read | `customer_ops.ai_assist` | n/a |
| `create_appointment` | `createAppointmentTool` | Receptionist, Sales | Write | `customer_ops.ai_assist` | Generic |
| `update_appointment` | `updateAppointmentTool` | Receptionist | Write | `customer_ops.ai_assist` | Generic |
| `read_tickets` | `getTicketsTool` | Customer Support | Read | `customer_ops.ai_assist` | n/a |
| `create_ticket` | `createSupportTicketTool` | Customer Support | Write | `customer_ops.ai_assist` | Generic |
| `escalate_ticket` | `requestTicketEscalationTool` | Customer Support | Write | `customer_ops.ai_assist` | Generic |
| `request_external_message` | `salesExternalActionTool` | Sales | Communication | None | Messaging (`action_approvals`, unchanged from Phase 1) — **always** requires approval |

"Generic" approval architecture: a pending row in `ai_employee_action_approvals` (action + JSON payload), decided via `POST /api/ai-action-approvals/[id]` (approve/reject), executed via `POST /api/ai-action-approvals/[id]/execute`, which dispatches to the exact same `performX()` function the tool would have called directly had the action been allowed (see the `EXECUTORS` map in that route) — there is no separate, divergent replay implementation.

"Messaging" approval architecture is the pre-existing Phase 1 system (`action_approvals` table, `POST /api/action-approvals/[id]` decide, `POST /api/action-approvals/[id]/execute` send) — untouched by this change except that `salesExternalActionTool` now runs the same tenant/status/entitlement checks as every other tool before filing its request, and correctly attributes the request to the real `employeeId` instead of `null`.

## Deliberately not modeled

The prior permissions UI listed 13 capabilities; only 5 correspond to a real tool (`Create leads`, `Qualify leads` → `update_lead`, `Schedule meetings` → `create_appointment`, `Send messages` → `request_external_message`, and a partial match for `Assign follow-ups` → `create_follow_up`). The other 8 — **Update customer records, Send proposals, Issue refunds, Apply discounts, Process payments, Update information, Modify workflows, Change settings** — have no corresponding tool anywhere in `mastra/tools/` or `lib/ai/tools/` and have been removed from the UI rather than left as fictional toggles. If any of these become real product features, add the action here and to `AI_ACTIONS` first, with a real tool behind it, before exposing it to customers.

## Known limitations (see final report for detail)

- No tool-level entitlement check was added beyond the two action groups (`appointments`, `tickets`) that already had one — extending `customer_ops.ai_assist` (or a new capability) to CRM writes would change real plan gating and needs a product decision, not a guess.
- `read_appointments`/`create_appointment`/etc. entitlement is checked per-call; it is not cached, so a plan downgrade takes effect on the very next tool call.
- General Manager has no write or communication tools today, so its authority surface is read-only by construction, not by policy.
