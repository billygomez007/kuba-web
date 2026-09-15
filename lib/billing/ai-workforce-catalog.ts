/*
 * Single shared AI employee catalog — presentation metadata only.
 *
 * Before this file, the SAME set of employee types was independently
 * defined in six different places (app/onboarding/page.tsx,
 * app/onboarding/ai-training/page.tsx, app/dashboard/ai-employees/create/
 * page.tsx, app/dashboard/workforce/page.tsx, app/dashboard/employees/[id]/
 * page.tsx, app/dashboard/ai-employees/[id]/page.tsx, and
 * app/components/employees/AIEmployeeAvatar.tsx), each with its own name/
 * description/icon copy and its own subtly different list of types. This
 * module is the one place that copy is written down.
 *
 * This file does NOT decide entitlement. It has no opinion on which plan
 * unlocks which type — that question is answered exclusively by
 * lib/billing/ai-workforce-policy.ts (canActivateEmployee /
 * isEmployeeTypeEntitled / allowedEmployeeTypesForPlan), which this module
 * calls into for the one derived field (`minimumPlanToActivate`) that is
 * genuinely policy-derived. Pages must always re-check the real
 * entitlements object for the signed-in business before rendering a lock
 * state — never assume a cached/derived value is still current. Server-side
 * enforcement in the API routes remains authoritative regardless of what
 * this catalog or the policy-derived helpers below say; nothing here is a
 * security control.
 *
 * `implementation` is a SEPARATE axis from plan entitlement: it records
 * whether the employee type has a real, working chat runtime and workspace
 * today, independent of which plan would otherwise be allowed to activate
 * it. As of the "complete 12-employee AI workforce" pass, every catalog
 * type below has a real runtime (app/api/ai/{type}/route.ts) and is
 * "available" — there is no longer a "coming-soon" type in this catalog.
 * See docs/CURRENT_STATE.md for the full history and reasoning.
 */
import {
  allowedEmployeeTypesForPlan,
  canActivateEmployee,
  isEmployeeImplementationAvailable,
} from "./ai-workforce-policy";
import { defaultLimitsForPlan, getPlanDefinition, planOrder, type PlanId } from "./plan-definitions";
import type { BusinessEntitlements } from "./entitlements";

export type EmployeeImplementationStatus = "available" | "coming-soon";

export type EmployeeCatalogEntry = {
  /** Stable type/key — matches aiEmployees.type and the policy's employeeType strings. */
  type: string;
  /** Suggested default employee name, e.g. "Kuba Receptionist". */
  name: string;
  /** Short role label, e.g. "Receptionist". */
  roleName: string;
  category: string;
  description: string;
  capabilities: string[];
  /** Existing glyph-icon convention used across the workforce catalog cards. */
  icon: string;
  /** Existing /avatars/*.png convention. Falls back to the receptionist avatar if missing. */
  avatar: string;
  templateId: string;
  /** Whether this type has a real, working chat runtime + workspace today. */
  implementation: EmployeeImplementationStatus;
};

type RawCatalogEntry = Omit<EmployeeCatalogEntry, "implementation">;

// implementation status is computed below from
// isEmployeeImplementationAvailable() — the SAME dimension-B fact
// canActivateEmployee enforces server-side — rather than hand-set per
// entry, so this catalog can never drift from what the policy actually
// allows to run.
const rawEmployeeCatalog: RawCatalogEntry[] = [
  {
    type: "receptionist",
    name: "Kuba Receptionist",
    roleName: "Receptionist",
    category: "Customer Experience",
    description: "Welcomes customers, answers enquiries, captures leads, and routes requests.",
    capabilities: ["Answer enquiries", "Capture leads", "Schedule appointments", "Escalate conversations"],
    icon: "✦",
    avatar: "/avatars/receptionist.png",
    templateId: "kuba-receptionist",
  },
  {
    type: "sales",
    name: "Kuba Sales",
    roleName: "Sales Representative",
    category: "Revenue",
    description: "Finds prospects, qualifies leads, follows up with customers, and keeps revenue moving.",
    capabilities: ["Qualify leads", "Follow up customers", "Update pipeline", "Surface opportunities"],
    icon: "↗",
    avatar: "/avatars/sales.png",
    templateId: "kuba-sales",
  },
  {
    type: "customer-support",
    name: "Kuba Customer Support",
    roleName: "Customer Support",
    category: "Customer Experience",
    description: "Resolves customer questions and service issues, and tracks customer context.",
    capabilities: ["Answer support questions", "Resolve common issues", "Track customer context", "Escalate complex requests"],
    icon: "◌",
    avatar: "/avatars/customer-support.png",
    templateId: "kuba-customer-support",
  },
  {
    type: "outreach",
    name: "Kuba Outreach",
    roleName: "Outreach",
    category: "Revenue",
    description: "Researches prospects, identifies buying signals, prepares personalized outreach, and hands qualified opportunities to Sales.",
    capabilities: ["Research prospects", "Identify buying signals", "Prepare outreach", "Hand off to Sales"],
    icon: "⌁",
    // No dedicated outreach avatar asset exists yet; falls back to the
    // receptionist avatar, matching this catalog's own getEmployeeAvatar
    // fallback and the pre-existing behavior of every avatar map this file
    // replaces (none of them had an outreach entry either).
    avatar: "/avatars/receptionist.png",
    templateId: "kuba-outreach",
  },
  {
    type: "marketing",
    name: "Kuba Marketing",
    roleName: "Marketing Assistant",
    category: "Marketing",
    description: "Plans campaigns, creates content, and supports customer engagement.",
    capabilities: ["Plan campaigns", "Create content", "Engage customers", "Track opportunities"],
    icon: "✺",
    avatar: "/avatars/marketing.png",
    templateId: "kuba-marketing",
  },
  {
    type: "appointment",
    name: "Kuba Appointment",
    roleName: "Appointment Coordinator",
    category: "Operations",
    description: "Books, reschedules, and cancels appointments, checking for conflicts before confirming a time.",
    capabilities: ["Schedule appointments", "Reschedule or cancel", "Check for conflicts", "Review upcoming bookings"],
    icon: "◈",
    avatar: "/avatars/appointment.png",
    templateId: "kuba-appointment",
  },
  {
    type: "general-manager",
    name: "Kuba General Manager",
    roleName: "General Manager",
    category: "Executive",
    description: "Oversees business operations, coordinates AI employees, monitors performance, and identifies bottlenecks.",
    capabilities: ["Monitor business operations", "Coordinate AI employees", "Identify bottlenecks", "Recommend next actions"],
    icon: "◈",
    avatar: "/brand/kuba-general-manager-avatar.png",
    templateId: "general-manager",
  },
  {
    type: "accountant",
    name: "Kuba Accountant",
    roleName: "Accountant",
    category: "Finance",
    description: "Explains payroll records, prepares accounting tasks for human review, and flags anomalies — not a licensed accountant or tax adviser.",
    capabilities: ["Summarize payroll records", "Flag anomalies", "Create accounting tasks", "Prepare information for accountants"],
    icon: "◎",
    avatar: "/avatars/accountant.png",
    templateId: "kuba-accountant",
  },
  {
    type: "finance",
    name: "Kuba Finance",
    roleName: "Finance Analyst",
    category: "Finance",
    description: "Analyzes real financial data and supports planning, budgeting, and forecasting — clearly labels every estimate as an estimate.",
    capabilities: ["Financial performance summaries", "Scenario & forecast support", "Budget follow-up tasks", "Escalate exceptions"],
    icon: "◍",
    avatar: "/avatars/finance.png",
    templateId: "kuba-finance",
  },
  {
    type: "hr",
    name: "Kuba HR",
    roleName: "HR Assistant",
    category: "People",
    description: "Supports HR operations — headcount and leave visibility, onboarding checklists, and policy questions — never a hiring, firing, or compensation decision.",
    capabilities: ["Headcount & leave overview", "Onboarding checklists", "Policy Q&A", "Create HR tasks"],
    icon: "◉",
    avatar: "/avatars/hr.png",
    templateId: "kuba-hr",
  },
  {
    type: "operations",
    name: "Kuba Operations",
    roleName: "Operations Coordinator",
    category: "Operations",
    description: "Coordinates day-to-day operations — tasks, appointments, and workflow status — and flags what needs attention.",
    capabilities: ["Operations overview", "Identify overdue work", "Create operational tasks", "Coordinate handoffs"],
    icon: "⌁",
    avatar: "/avatars/operations.png",
    templateId: "kuba-operations",
  },
  {
    type: "custom",
    name: "Custom Employee",
    roleName: "Custom Employee",
    category: "Custom",
    description: "A custom AI employee built around a specific business role, with tools you choose from a curated, safe catalog.",
    capabilities: ["Define objective & instructions", "Choose allowed tools", "Set autonomy & approvals", "Connect business knowledge"],
    icon: "◇",
    avatar: "/avatars/receptionist.png",
    templateId: "custom",
  },
];

export const employeeCatalog: EmployeeCatalogEntry[] = rawEmployeeCatalog.map((entry) => ({
  ...entry,
  implementation: isEmployeeImplementationAvailable(entry.type) ? "available" : "coming-soon",
}));

export function getCatalogEntry(type: string): EmployeeCatalogEntry | undefined {
  return employeeCatalog.find((entry) => entry.type === type);
}

export function getEmployeeAvatar(type: string): string {
  return getCatalogEntry(type)?.avatar || "/avatars/receptionist.png";
}

/*
 * Synthetic, override-free entitlements for a plan, used only to answer
 * "which plan first allows this type" for display copy (e.g. "Upgrade to
 * Growth"). This is never used to make an actual activation decision for a
 * real business — real decisions always go through canActivateEmployee with
 * that business's own getBusinessEntitlements() result, which accounts for
 * subscription/trial state and any Enterprise overrides this synthetic
 * object deliberately omits.
 */
function syntheticEntitlementsForPlan(planId: Exclude<PlanId, "enterprise">): BusinessEntitlements {
  const plan = getPlanDefinition(planId);
  return {
    plan: plan.id,
    planName: plan.name,
    capabilities: plan.capabilities,
    limits: defaultLimitsForPlan(plan),
    modules: [],
  };
}

/**
 * The first self-serve plan (Starter/Growth/Pro) that would allow
 * activating this type with an empty slot, purely for "Upgrade to X" copy.
 * Returns null if no self-serve plan allows it (Enterprise-configuration-only,
 * or not yet implemented) — callers should not render a specific plan claim
 * in that case.
 */
export function minimumSelfServePlanToActivate(type: string): PlanId | null {
  for (const planId of planOrder) {
    if (planId === "enterprise") continue;
    const decision = canActivateEmployee(syntheticEntitlementsForPlan(planId), type, 0);
    if (decision.allowed) return planId;
  }
  return null;
}

export { allowedEmployeeTypesForPlan };
