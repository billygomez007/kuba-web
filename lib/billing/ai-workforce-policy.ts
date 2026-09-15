import { hasCapability } from "./plan-definitions";
import type { BusinessEntitlements, PlanId } from "./entitlements";

/*
 * Central AI Workforce activation/runtime policy.
 *
 * There are THREE independent dimensions, and all three must pass:
 *   A. COMMERCIAL ENTITLEMENT — is this employee type part of the resolved
 *      plan's tier at all?
 *   B. IMPLEMENTATION AVAILABILITY — does this employee type actually have a
 *      working chat runtime + workspace today, independent of which plan
 *      would otherwise be allowed to use it? Two of the approved model's own
 *      named Pro-tier types (Marketing, Appointment) are commercially
 *      assigned to Pro but have no runtime yet — being on the right plan
 *      must never be enough to activate a dead employee.
 *   C. WORKFORCE CAPACITY — how many active AI employees a business may
 *      have (entitlements.limits.max_ai_employees, already resolved
 *      correctly from plan + subscription/trial state + admin overrides).
 *
 * This module is the single source of truth for A and B, used by both the
 * activation route (app/api/ai-employees/route.ts) and every per-employee
 * runtime chat route (receptionist, sales, customer-support, outreach,
 * general-manager). Using the same functions in both places is what
 * guarantees activation and runtime entitlement can never disagree.
 *
 * FAIL-CLOSED BY DESIGN: an employee type this policy does not explicitly
 * recognize is never implicitly allowed on Starter/Growth/Pro, no matter how
 * plausible-looking the type string is. On Enterprise, an unrecognized type
 * is commercially entitled ONLY if explicitly granted via
 * entitlements.modules, and still cannot be activated until it is explicitly
 * represented here as implemented. Being "unknown to the policy" must never
 * itself be a path to availability, even for Enterprise. Every catalog type
 * (see lib/billing/ai-workforce-catalog.ts) is now explicitly modeled below
 * — this fail-closed path exists for any FUTURE type that hasn't been
 * assigned a tier yet, not for anything currently in the catalog.
 */

export type EmployeeActivationCode =
  | "EMPLOYEE_LIMIT_REACHED"
  | "EMPLOYEE_TYPE_NOT_ENTITLED"
  | "EMPLOYEE_NOT_AVAILABLE"
  | "FEATURE_NOT_ENTITLED"
  | "ENTERPRISE_CONFIGURATION_REQUIRED";

export type EmployeeActivationDecision =
  | { allowed: true }
  | {
      allowed: false;
      code: EmployeeActivationCode;
      message: string;
      requiredPlan?: Exclude<PlanId, "enterprise">;
    };

/**
 * Every employee type the approved product model explicitly, commercially
 * tiers, with its minimum commercial plan and whether it actually has a
 * working runtime today. A type simply being at or above its minPlan is
 * dimension A only — dimension B (`implemented`) is checked independently,
 * and BOTH must hold before canActivateEmployee ever allows it.
 *
 * As of the "complete 12-employee AI workforce" pass, EVERY catalog type has
 * been assigned a commercial tier and a real runtime — accountant, finance,
 * hr, operations, and custom (a curated, user-configured tool framework; see
 * mastra/agents/custom.ts) all join the list below at minPlan "pro", the
 * same tier as every other Pro-tier type. There is no longer an
 * Enterprise-only, entitlements.modules-gated employee type — Enterprise's
 * own guarantee ("never fewer AI employees than Pro") means gating a type
 * behind a manual per-Enterprise-account module grant would make it
 * Enterprise-only or slower-to-enable than Pro, which is no longer the
 * approved model. The entitlements.modules path below still exists for a
 * genuinely unmodeled/future type (e.g. a brand-new catalog entry not yet
 * assigned a tier) — it is simply no longer used by any type in this table.
 */
const STANDARD_EMPLOYEE_TYPES: Record<string, { minPlan: Exclude<PlanId, "enterprise">; implemented: boolean }> = {
  "receptionist": { minPlan: "starter", implemented: true },
  "customer-support": { minPlan: "growth", implemented: true },
  "sales": { minPlan: "growth", implemented: true },
  "outreach": { minPlan: "pro", implemented: true },
  "general-manager": { minPlan: "pro", implemented: true },
  "marketing": { minPlan: "pro", implemented: true },
  "appointment": { minPlan: "pro", implemented: true },
  "accountant": { minPlan: "pro", implemented: true },
  "finance": { minPlan: "pro", implemented: true },
  "hr": { minPlan: "pro", implemented: true },
  "operations": { minPlan: "pro", implemented: true },
  "custom": { minPlan: "pro", implemented: true },
};

/** Every employee type the approved product model explicitly tiers. */
export const STANDARD_EMPLOYEE_TYPE_LIST: readonly string[] = Object.keys(STANDARD_EMPLOYEE_TYPES);

const PLAN_ORDER: readonly Exclude<PlanId, "enterprise">[] = ["starter", "growth", "pro"];

function normalizeType(type: string): string {
  return type.trim().toLowerCase();
}

function planRank(plan: PlanId): number {
  return plan === "enterprise" ? PLAN_ORDER.length : PLAN_ORDER.indexOf(plan as Exclude<PlanId, "enterprise">);
}

/**
 * The set of employee types this plan is COMMERCIALLY entitled to (dimension
 * A only — a type can appear here and still be implementation-unavailable,
 * e.g. Marketing on Pro). For Enterprise, always includes every standard
 * type plus whatever custom/unmodeled types have been explicitly granted via
 * entitlement overrides (entitlements.modules) — an Enterprise account is
 * never capped at an arbitrary Starter/Growth/Pro type list, and a granted
 * type never becomes available merely because the policy doesn't recognize
 * it.
 */
export function allowedEmployeeTypesForPlan(
  entitlements: Pick<BusinessEntitlements, "plan" | "modules">,
): readonly string[] {
  const rank = planRank(entitlements.plan);
  const standardAllowed = Object.entries(STANDARD_EMPLOYEE_TYPES)
    .filter(([, def]) => rank >= planRank(def.minPlan))
    .map(([type]) => type);

  if (entitlements.plan === "enterprise") {
    return [...new Set([...standardAllowed, ...(entitlements.modules ?? [])])];
  }

  return standardAllowed;
}

/**
 * Dimension A only: is this plan commercially entitled to this employee
 * type at all? This deliberately ignores implementation availability — a
 * commercially-included-but-not-yet-built type (Marketing on Pro) is still
 * "entitled" in this sense; canActivateEmployee is what combines this with
 * dimension B to decide whether activation is actually allowed. Runtime
 * chat routes only exist for implemented types, so this is the correct,
 * sufficient check for them.
 */
export function isEmployeeTypeEntitled(
  entitlements: Pick<BusinessEntitlements, "plan" | "modules">,
  employeeType: string,
): boolean {
  const type = normalizeType(employeeType);
  const standard = STANDARD_EMPLOYEE_TYPES[type];

  if (standard) {
    return planRank(entitlements.plan) >= planRank(standard.minPlan);
  }

  // Unmodeled/custom/legacy type: fail closed on every self-serve plan.
  // Only Enterprise can ever use one, and only with an explicit grant.
  if (entitlements.plan === "enterprise") {
    return (entitlements.modules ?? []).includes(type);
  }

  return false;
}

/**
 * Dimension B only: does this employee type have a real, working chat
 * runtime + workspace today, independent of plan? Pure and catalog-facing —
 * lib/billing/ai-workforce-catalog.ts derives its `implementation` field
 * from this so the UI can never drift from what the policy enforces.
 * Unmodeled/custom/legacy types (including a future Enterprise-configured
 * custom employee) are not represented here, so they remain unavailable
 * even when an Enterprise module grant establishes commercial entitlement.
 * A future runtime must be explicitly modeled here before activation can
 * pass.
 */
export function isEmployeeImplementationAvailable(employeeType: string): boolean {
  const type = normalizeType(employeeType);
  return STANDARD_EMPLOYEE_TYPES[type]?.implemented ?? false;
}

/**
 * The full activation decision: feature gate, then capacity, then
 * commercial entitlement, then implementation availability. All dimensions
 * must independently pass — a free slot never implies an entitled type, an
 * entitled type never implies it's built yet, and vice versa.
 */
export function canActivateEmployee(
  entitlements: BusinessEntitlements,
  employeeType: string,
  currentActiveEmployeeCount: number,
): EmployeeActivationDecision {
  if (!hasCapability(entitlements, "ai_workforce.core")) {
    return {
      allowed: false,
      code: "FEATURE_NOT_ENTITLED",
      message: "AI Workforce requires a higher plan.",
      requiredPlan: "starter",
    };
  }

  const limit = entitlements.limits.max_ai_employees;
  if (limit !== null && currentActiveEmployeeCount >= limit) {
    return {
      allowed: false,
      code: "EMPLOYEE_LIMIT_REACHED",
      message: `You've reached the AI employee limit on ${entitlements.planName}.`,
    };
  }

  const type = normalizeType(employeeType);
  const standard = STANDARD_EMPLOYEE_TYPES[type];

  if (standard) {
    if (planRank(entitlements.plan) < planRank(standard.minPlan)) {
      return {
        allowed: false,
        code: "EMPLOYEE_TYPE_NOT_ENTITLED",
        message: `${employeeType} requires the ${standard.minPlan === "growth" ? "Growth" : "Pro"} plan or higher.`,
        requiredPlan: standard.minPlan,
      };
    }

    if (!standard.implemented) {
      // Commercially entitled, but not yet built — this is NOT a plan
      // problem, so it must never carry an upgrade prompt.
      return {
        allowed: false,
        code: "EMPLOYEE_NOT_AVAILABLE",
        message: `${employeeType} is coming soon and isn't available to activate yet.`,
      };
    }

    return { allowed: true };
  }

  // Unmodeled/custom/legacy type.
  if (entitlements.plan === "enterprise") {
    if ((entitlements.modules ?? []).includes(type)) {
      return {
        allowed: false,
        code: "EMPLOYEE_NOT_AVAILABLE",
        message: `${employeeType} is configured for this Enterprise account but isn't available to activate yet.`,
      };
    }
    return {
      allowed: false,
      code: "ENTERPRISE_CONFIGURATION_REQUIRED",
      message: `${employeeType} is not yet configured for this Enterprise account. Contact SuperKuba to enable it.`,
    };
  }

  return {
    allowed: false,
    code: "EMPLOYEE_TYPE_NOT_ENTITLED",
    message: `${employeeType} is not available on ${entitlements.planName}.`,
  };
}

export type EmployeeAccessState = {
  /** Can the business discover this type at all (catalog listing)? Always
   * true — the AI Workforce catalog is a deliberate upgrade-discovery
   * surface (approved model), never hidden per plan. */
  visible: true;
  /** Dimension A: does the CURRENT plan commercially include this type? */
  entitled: boolean;
  /** Dimension B: does this type have a real runtime today, regardless of plan? */
  implemented: boolean;
  /** Dimension C: given entitled + implemented both hold, is there a free
   * active-employee slot right now? Always true when not entitled or not
   * implemented — those dimensions already block activation on their own,
   * so a slot count doesn't add information in that case. */
  usageAvailable: boolean;
  /** The plan this type would first require, for upgrade copy — undefined
   * when already entitled, or when only an Enterprise module grant (never
   * a plan upgrade) could unlock it. */
  requiredPlan?: Exclude<PlanId, "enterprise">;
};

/**
 * The three-question decomposition the approved model asks for everywhere
 * (visible / entitled / usage available) applied to one concrete, already-
 * implemented resource: AI employee activation slots. This is a pure named
 * view over canActivateEmployee's decision — it introduces no new policy,
 * so it can never disagree with the real activation route.
 *
 * There is deliberately no general cross-resource "usage available" helper
 * (campaign sends, voice minutes, conversations) yet — active-employee slots
 * are the only resource this codebase actually meters and enforces a limit
 * on today. Extending this to other resources requires real metering
 * infrastructure that does not exist yet, not just a wider type.
 */
export function getEmployeeAccessState(
  entitlements: BusinessEntitlements,
  employeeType: string,
  currentActiveEmployeeCount: number,
): EmployeeAccessState {
  const entitled = isEmployeeTypeEntitled(entitlements, employeeType);
  const implemented = isEmployeeImplementationAvailable(employeeType);
  const decision = canActivateEmployee(entitlements, employeeType, currentActiveEmployeeCount);
  const usageAvailable = decision.allowed || decision.code !== "EMPLOYEE_LIMIT_REACHED";
  const type = normalizeType(employeeType);
  const requiredPlan = entitled ? undefined : STANDARD_EMPLOYEE_TYPES[type]?.minPlan;

  return { visible: true, entitled, implemented, usageAvailable, requiredPlan };
}
