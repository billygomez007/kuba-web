import { eq } from "drizzle-orm";
import { db } from "@/db";
import { businesses, entitlementOverrides, subscriptions } from "@/db/schema";

export type PlanId = "starter" | "growth" | "pro" | "enterprise";
export type BillingFeature = "businessBrain" | "websiteChat" | "basicInbox" | "basicAnalytics" | "basicAutomations" | "employeeTesting" | "voice" | "salesBasic" | "salesAdvanced" | "marketingBasic" | "marketingAdvanced" | "advancedAnalytics" | "advancedAutomations" | "customIntegrations" | "orchestration" | "certification" | "monitoring" | "whiteLabel";
export type PlanDefinition = { id: PlanId; name: string; employeeLimit: number | null; automationLimit: number | null; includedVoiceMinutes: number; features: BillingFeature[] };

const common: BillingFeature[] = ["businessBrain", "websiteChat", "basicInbox", "basicAnalytics", "basicAutomations", "employeeTesting"];
export const planDefinitions: PlanDefinition[] = [
  { id: "starter", name: "Starter", employeeLimit: 1, automationLimit: 5, includedVoiceMinutes: 0, features: [...common] },
  { id: "growth", name: "Growth", employeeLimit: 3, automationLimit: 20, includedVoiceMinutes: 0, features: [...common, "salesBasic", "marketingBasic"] },
  { id: "pro", name: "Pro", employeeLimit: 10, automationLimit: 100, includedVoiceMinutes: 500, features: [...common, "voice", "salesBasic", "salesAdvanced", "marketingBasic", "marketingAdvanced", "advancedAnalytics", "advancedAutomations", "customIntegrations", "orchestration", "certification", "monitoring"] },
  { id: "enterprise", name: "Enterprise", employeeLimit: null, automationLimit: null, includedVoiceMinutes: 5000, features: [...common, "voice", "salesBasic", "salesAdvanced", "marketingBasic", "marketingAdvanced", "advancedAnalytics", "advancedAutomations", "customIntegrations", "orchestration", "certification", "monitoring", "whiteLabel"] },
];

export function normalizePlan(value: string | null | undefined): PlanId { return value === "growth" || value === "pro" || value === "enterprise" ? value : "starter"; }
export function getPlanDefinition(plan: string | null | undefined) { return planDefinitions.find((item) => item.id === normalizePlan(plan)) || planDefinitions[0]; }
export async function getBusinessPlan(businessId: string) {
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
  const effective = { ...plan, features: [...plan.features] };
  for (const override of activeOverrides) {
    if (override.overrideType === "grant_feature" && override.value === "true" && !effective.features.includes(override.feature as BillingFeature)) effective.features.push(override.feature as BillingFeature);
    if (override.overrideType === "limit") {
      const value = Number(override.value);
      if (!Number.isFinite(value)) continue;
      if (override.feature === "employeeLimit") effective.employeeLimit = effective.employeeLimit === null ? null : Math.max(effective.employeeLimit, value);
      if (override.feature === "automationLimit") effective.automationLimit = effective.automationLimit === null ? null : Math.max(effective.automationLimit, value);
      if (override.feature === "voiceMinutes") effective.includedVoiceMinutes = Math.max(effective.includedVoiceMinutes, value);
    }
  }
  return effective;
}
export function canUseFeature(plan: PlanDefinition, feature: BillingFeature) { return plan.features.includes(feature); }
export function getPlanLimits(plan: PlanDefinition) { return { employeeLimit: plan.employeeLimit, automationLimit: plan.automationLimit, includedVoiceMinutes: plan.includedVoiceMinutes }; }
export function employeeLimitMessage(plan: PlanDefinition) { return `You've reached the AI employee limit on ${plan.name}.`; }
