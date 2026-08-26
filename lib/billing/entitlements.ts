import { eq } from "drizzle-orm";
import { db } from "@/db";
import { entitlementOverrides, subscriptions } from "@/db/schema";
import {
  allCapabilities,
  defaultLimitsForPlan,
  getPlanDefinition,
  legacyFeatureCapabilities,
  type BillingFeature,
  type Capability,
  type EntitlementLimits,
  type PlanId,
} from "./plan-definitions";

export * from "./plan-definitions";

export type BusinessEntitlements = { plan: PlanId; planName: string; capabilities: Capability[]; limits: EntitlementLimits; modules: string[] };

export async function getBusinessEntitlements(businessId: string): Promise<BusinessEntitlements> {
  const subscription = await db.select({ plan: subscriptions.plan, status: subscriptions.status, currentPeriodEnd: subscriptions.currentPeriodEnd, trialEnd: subscriptions.trialEnd }).from(subscriptions).where(eq(subscriptions.businessId, businessId)).limit(1);
  const current = subscription[0];
  const now = Date.now();
  // Fail CLOSED on missing/malformed dates — a "trialing"/"past_due"/"canceled"
  // row with no trialEnd/currentPeriodEnd must never be treated as
  // indefinitely usable. Only "active" and admin-managed "enterprise_contract"
  // are usable without a date check, since the provider/admin is the
  // authority on those states directly.
  let usable = false;
  if (current) {
    if (current.status === "active" || current.status === "enterprise_contract") {
      usable = true;
    } else if (current.status === "trialing") {
      usable = current.trialEnd != null && current.trialEnd.getTime() > now;
    } else if (current.status === "past_due" || current.status === "canceled") {
      usable = current.currentPeriodEnd != null && current.currentPeriodEnd.getTime() > now;
    }
  }
  // No subscription row at all, OR a subscription that isn't currently
  // usable, both resolve to Starter — never businesses.plan. That column is
  // set once at creation and never updated by checkout/webhook/admin paths;
  // trusting it here would let a stale or directly-edited value grant free
  // premium access with no subscription evidence behind it whatsoever.
  const plan = current && usable ? getPlanDefinition(current.plan) : getPlanDefinition("starter");
  const overrides = await db.select({ feature: entitlementOverrides.feature, overrideType: entitlementOverrides.overrideType, value: entitlementOverrides.value, startsAt: entitlementOverrides.startsAt, expiresAt: entitlementOverrides.expiresAt }).from(entitlementOverrides).where(eq(entitlementOverrides.businessId, businessId));
  const nowDate = new Date();
  const activeOverrides = overrides.filter((item) => item.startsAt <= nowDate && (!item.expiresAt || item.expiresAt > nowDate));
  const capabilities = new Set<Capability>(plan.capabilities);
  const limits: EntitlementLimits = { ...defaultLimitsForPlan(plan) };
  for (const override of activeOverrides) {
    if (override.overrideType === "grant_feature" && override.value === "true") {
      if (override.feature === "enterprise.full") allCapabilities.forEach((capability) => capabilities.add(capability));
      (legacyFeatureCapabilities[override.feature as BillingFeature] || [override.feature as Capability]).forEach((capability) => capabilities.add(capability));
    }
    if (override.overrideType === "limit") {
      const value = Number(override.value);
      if (!Number.isFinite(value)) continue;
      if (override.feature === "employeeLimit") limits.max_ai_employees = limits.max_ai_employees === null ? null : Math.max(limits.max_ai_employees, value);
      if (override.feature === "automationLimit") limits.max_automations = limits.max_automations === null ? null : Math.max(limits.max_automations, value);
      if (override.feature === "voiceMinutes") limits.includedVoiceMinutes = Math.max(limits.includedVoiceMinutes, value);
      if (override.feature in limits) limits[override.feature as keyof EntitlementLimits] = value;
    }
  }
  return { plan: plan.id, planName: plan.name, capabilities: [...capabilities], limits, modules: [] };
}

export async function getBusinessPlan(businessId: string) {
  const entitlements = await getBusinessEntitlements(businessId);
  const plan = getPlanDefinition(entitlements.plan);
  return { ...plan, employeeLimit: entitlements.limits.max_ai_employees, automationLimit: entitlements.limits.max_automations, includedVoiceMinutes: entitlements.limits.includedVoiceMinutes, features: [...plan.features] };
}
