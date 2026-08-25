import { eq } from "drizzle-orm";
import { db } from "@/db";
import { businesses, entitlementOverrides, subscriptions } from "@/db/schema";
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
  const [businessRow, subscription] = await Promise.all([
    db.select({ plan: businesses.plan }).from(businesses).where(eq(businesses.id, businessId)).limit(1),
    db.select({ plan: subscriptions.plan, status: subscriptions.status, currentPeriodEnd: subscriptions.currentPeriodEnd, trialEnd: subscriptions.trialEnd }).from(subscriptions).where(eq(subscriptions.businessId, businessId)).limit(1),
  ]);
  const fallback = getPlanDefinition(businessRow[0]?.plan);
  const current = subscription[0];
  const now = Date.now();
  const withinPeriod = !current?.currentPeriodEnd || current.currentPeriodEnd.getTime() > now;
  const inTrial = current?.status === "trialing" && (!current.trialEnd || current.trialEnd.getTime() > now);
  const usable = Boolean(current && ["active", "trialing", "past_due", "canceled", "enterprise_contract"].includes(current.status) && (withinPeriod || inTrial));
  const plan = usable && current ? getPlanDefinition(current.plan) : fallback;
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
