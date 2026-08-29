import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  aiEmployeeActionApprovals,
  aiEmployeeActionPolicies,
  aiEmployees,
} from "@/db/schema";
import { createAuditLog } from "@/lib/auth/audit";
import { getBusinessEntitlements, hasCapability, type Capability } from "@/lib/billing/entitlements";

/**
 * Canonical, server-enforced AI employee actions. This list is deliberately
 * limited to actions a real Mastra tool actually implements — see
 * AI_AUTHORITY_MATRIX.md. Do not add an action here without a corresponding
 * tool; the prior permissions UI listed several actions ("Issue refunds",
 * "Process payments", "Change settings") that no tool has ever implemented.
 */
export const AI_ACTIONS = [
  "read_business_knowledge",
  "read_customers",
  "create_customer",
  "read_leads",
  "create_lead",
  "update_lead",
  "read_follow_ups",
  "create_follow_up",
  "complete_follow_up",
  "create_sales_activity",
  "read_appointments",
  "create_appointment",
  "update_appointment",
  "read_tickets",
  "create_ticket",
  "escalate_ticket",
  "request_external_message",
] as const;

export type AIAction = (typeof AI_ACTIONS)[number];

export type ActionKind = "read" | "write" | "communication";

export type PolicyDecision = "denied" | "allowed" | "requires_approval";

export const AUTONOMY_LEVELS = ["assistant", "operator", "autonomous"] as const;
export type AutonomyLevel = (typeof AUTONOMY_LEVELS)[number];

export const ACTION_META: Record<AIAction, { kind: ActionKind; label: string; description: string }> = {
  read_business_knowledge: { kind: "read", label: "View business knowledge", description: "Read the business profile, FAQs, and instructions used to answer questions." },
  read_customers: { kind: "read", label: "Look up customers", description: "Find an existing customer by email or phone." },
  create_customer: { kind: "write", label: "Create customers", description: "Add a new customer record." },
  read_leads: { kind: "read", label: "View leads", description: "Read lead lists and sales pipeline." },
  create_lead: { kind: "write", label: "Create leads", description: "Add a new sales lead." },
  update_lead: { kind: "write", label: "Update leads", description: "Change a lead's details or sales stage." },
  read_follow_ups: { kind: "read", label: "View follow-ups", description: "Read pending and scheduled follow-ups." },
  create_follow_up: { kind: "write", label: "Create follow-ups", description: "Schedule a new follow-up for a lead." },
  complete_follow_up: { kind: "write", label: "Complete follow-ups", description: "Mark a follow-up as completed after a real interaction." },
  create_sales_activity: { kind: "write", label: "Log sales activity", description: "Record that a real sales interaction took place." },
  read_appointments: { kind: "read", label: "View appointments", description: "Read scheduled appointments." },
  create_appointment: { kind: "write", label: "Create appointments", description: "Schedule a new appointment." },
  update_appointment: { kind: "write", label: "Reschedule appointments", description: "Change or cancel an existing appointment." },
  read_tickets: { kind: "read", label: "View support tickets", description: "Read support ticket details and status." },
  create_ticket: { kind: "write", label: "Create support tickets", description: "Open a new support ticket." },
  escalate_ticket: { kind: "write", label: "Escalate tickets", description: "Flag a ticket for human attention." },
  request_external_message: { kind: "communication", label: "Send customer messages", description: "Request approval to send a WhatsApp, SMS, or email message to a customer. Always requires human approval." },
};

/**
 * Only the two action groups that already had a real entitlement gate
 * before this change (appointment-tools.ts, ticket-tools.ts, both via
 * requireAiAssist -> customer_ops.ai_assist) keep that gate here. Every
 * other action is intentionally left without a new tool-level entitlement
 * check: inventing one now would silently change real plan gating for
 * existing paid functionality (e.g. lead creation is available below Pro)
 * without a product decision, which is outside this pass's scope.
 */
const ACTION_ENTITLEMENT: Partial<Record<AIAction, Capability>> = {
  read_appointments: "customer_ops.ai_assist",
  create_appointment: "customer_ops.ai_assist",
  update_appointment: "customer_ops.ai_assist",
  read_tickets: "customer_ops.ai_assist",
  create_ticket: "customer_ops.ai_assist",
  escalate_ticket: "customer_ops.ai_assist",
};

/**
 * Communication can never be set to "allowed", by anyone, at any autonomy
 * level. This is a hard floor, not a default — see AGENTS/report section on
 * "external communication authority". Enforced here, not just in prompt
 * text, so a stored policy row can't accidentally (or intentionally)
 * bypass it.
 */
const COMMUNICATION_FLOOR: PolicyDecision = "requires_approval";

export function defaultPolicyForAutonomy(level: AutonomyLevel): Record<AIAction, PolicyDecision> {
  const policy = {} as Record<AIAction, PolicyDecision>;
  for (const action of AI_ACTIONS) {
    const kind = ACTION_META[action].kind;
    if (kind === "read") {
      policy[action] = "allowed";
    } else if (kind === "communication") {
      policy[action] = COMMUNICATION_FLOOR;
    } else {
      // write: Assistant Mode is fully supervised (every write queued for
      // approval); Operator and Autonomous both allow direct CRM writes,
      // matching what every existing AI employee already does today — this
      // pass makes that behavior real and denyable, it does not newly
      // restrict it, since there is nothing today that distinguishes
      // Operator from Autonomous at the tool level.
      policy[action] = level === "assistant" ? "requires_approval" : "allowed";
    }
  }
  return policy;
}

/**
 * aiEmployees.supervisionMode's schema default is "owner_supervised", a
 * fourth value that predates and is not one of the three levels this
 * feature (and the existing permissions UI/API) recognize. Any employee
 * that has never had autonomy explicitly saved carries that value. Mapping
 * it to "operator" preserves today's real behavior (CRM writes execute,
 * communication requires approval) rather than either silently unlocking
 * "autonomous" or silently locking every existing employee down to
 * "assistant" and breaking their current CRM-write functionality.
 */
export function normalizeAutonomyLevel(raw: string | null | undefined): AutonomyLevel {
  if (raw === "assistant" || raw === "operator" || raw === "autonomous") return raw;
  return "operator";
}

type StoredPolicy = Partial<Record<AIAction, PolicyDecision>>;

function resolveDecision(action: AIAction, storedPolicy: StoredPolicy, autonomyLevel: AutonomyLevel): PolicyDecision {
  if (ACTION_META[action].kind === "communication") return COMMUNICATION_FLOOR;
  const stored = storedPolicy[action];
  if (stored === "denied" || stored === "allowed" || stored === "requires_approval") return stored;
  return defaultPolicyForAutonomy(autonomyLevel)[action];
}

export type StoredActionPolicy = { autonomyLevel: AutonomyLevel; policy: StoredPolicy };

/**
 * Loads an employee's structured policy row, lazily provisioning a
 * conservative, legacy-safe default (see normalizeAutonomyLevel) the first
 * time an employee is checked. This is the "legacy migration" strategy:
 * no bulk backfill script touches existing rows, and no employee is ever
 * silently granted more authority than it already had.
 */
export async function getOrCreateActionPolicy(businessId: string, employeeId: string): Promise<StoredActionPolicy> {
  const existing = await db
    .select({ autonomyLevel: aiEmployeeActionPolicies.autonomyLevel, policy: aiEmployeeActionPolicies.policy })
    .from(aiEmployeeActionPolicies)
    .where(eq(aiEmployeeActionPolicies.employeeId, employeeId))
    .limit(1);

  if (existing[0]) {
    const autonomyLevel = normalizeAutonomyLevel(existing[0].autonomyLevel);
    let policy: StoredPolicy = {};
    try {
      policy = JSON.parse(existing[0].policy) as StoredPolicy;
    } catch {
      policy = {};
    }
    return { autonomyLevel, policy };
  }

  const autonomyLevel: AutonomyLevel = "operator";
  const policy = defaultPolicyForAutonomy(autonomyLevel);
  const now = new Date();
  await db.insert(aiEmployeeActionPolicies).values({
    id: crypto.randomUUID(),
    businessId,
    employeeId,
    autonomyLevel,
    policy: JSON.stringify(policy),
    createdAt: now,
    updatedAt: now,
  });
  return { autonomyLevel, policy };
}

export type AuthorityDecision =
  | { ok: true; businessId: string; employeeId: string }
  | { ok: false; reason: "denied"; businessId: string; employeeId: string; message: string }
  | { ok: false; reason: "requires_approval"; businessId: string; employeeId: string; message: string };

async function auditDecision(params: {
  businessId: string;
  employeeId: string;
  action: AIAction;
  outcome: "denied" | "requires_approval" | "allowed";
  code: string;
  approvalId?: string;
}) {
  // Reads that were simply allowed are not audited — that would flood the
  // log with routine lookups. Every denial, every approval request, and
  // every allowed WRITE/COMMUNICATION is audited (see report section 15).
  if (params.outcome === "allowed" && ACTION_META[params.action].kind === "read") return;
  await createAuditLog({
    businessId: params.businessId,
    userId: null,
    action: `ai.authority.${params.outcome}`,
    resource: "ai_employee_action",
    resourceId: params.employeeId,
    description: `${params.action} — ${params.outcome} (${params.code})`,
    metadata: { action: params.action, employeeId: params.employeeId, approvalId: params.approvalId ?? null },
  });
}

/**
 * The single decision engine every Mastra tool must call before doing
 * anything. Considers, in order: tenant ownership, employee active status,
 * entitlement (where one already existed), and the employee's structured
 * action policy. Does not itself file an approval request — callers do
 * that (see fileActionApproval) so that the one existing communication
 * approval flow (actionApprovals / app/api/action-approvals) and the new
 * generic one (aiEmployeeActionApprovals / app/api/ai-action-approvals)
 * each stay single-path or their own domain.
 */
export async function checkAIEmployeeAuthority({
  businessId,
  employeeId,
  action,
}: {
  businessId: string;
  employeeId: string;
  action: AIAction;
}): Promise<AuthorityDecision> {
  const employeeRow = await db
    .select({ id: aiEmployees.id, status: aiEmployees.status })
    .from(aiEmployees)
    .where(and(eq(aiEmployees.id, employeeId), eq(aiEmployees.businessId, businessId)))
    .limit(1);
  const employee = employeeRow[0];

  if (!employee) {
    await auditDecision({ businessId, employeeId, action, outcome: "denied", code: "employee_not_found" });
    return { ok: false, reason: "denied", businessId, employeeId, message: "This AI employee does not belong to the current business." };
  }

  if (employee.status !== "active") {
    await auditDecision({ businessId, employeeId, action, outcome: "denied", code: "employee_inactive" });
    return { ok: false, reason: "denied", businessId, employeeId, message: "This AI employee is not active." };
  }

  const requiredCapability = ACTION_ENTITLEMENT[action];
  if (requiredCapability) {
    const entitlements = await getBusinessEntitlements(businessId);
    if (!hasCapability(entitlements, requiredCapability)) {
      await auditDecision({ businessId, employeeId, action, outcome: "denied", code: "not_entitled" });
      return { ok: false, reason: "denied", businessId, employeeId, message: "This action requires the Pro plan or higher." };
    }
  }

  const { autonomyLevel, policy } = await getOrCreateActionPolicy(businessId, employeeId);
  const decision = resolveDecision(action, policy, autonomyLevel);

  if (decision === "denied") {
    await auditDecision({ businessId, employeeId, action, outcome: "denied", code: "policy_denied" });
    return { ok: false, reason: "denied", businessId, employeeId, message: "This AI employee is not permitted to perform this action." };
  }

  if (decision === "requires_approval") {
    await auditDecision({ businessId, employeeId, action, outcome: "requires_approval", code: "policy_requires_approval" });
    return { ok: false, reason: "requires_approval", businessId, employeeId, message: "This action requires human approval." };
  }

  await auditDecision({ businessId, employeeId, action, outcome: "allowed", code: "policy_allowed" });
  return { ok: true, businessId, employeeId };
}

/**
 * Files a generic pending approval for a WRITE action the policy marked
 * requires_approval. Communication (request_external_message) never calls
 * this — it uses the existing actionApprovals/salesExternalAction flow
 * instead, which this function intentionally does not touch.
 */
export async function fileActionApproval({
  businessId,
  employeeId,
  action,
  payload,
}: {
  businessId: string;
  employeeId: string;
  action: AIAction;
  payload: Record<string, unknown>;
}): Promise<string> {
  const id = crypto.randomUUID();
  const now = new Date();
  await db.insert(aiEmployeeActionApprovals).values({
    id,
    businessId,
    employeeId,
    action,
    payload: JSON.stringify(payload),
    status: "pending",
    createdAt: now,
    updatedAt: now,
  });
  return id;
}
