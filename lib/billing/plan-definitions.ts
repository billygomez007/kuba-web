export type PlanId = "starter" | "growth" | "pro" | "enterprise";
export type BillingFeature = "businessBrain" | "websiteChat" | "basicInbox" | "basicAnalytics" | "basicAutomations" | "employeeTesting" | "voice" | "salesBasic" | "salesAdvanced" | "marketingBasic" | "marketingAdvanced" | "advancedAnalytics" | "advancedAutomations" | "customIntegrations" | "orchestration" | "certification" | "monitoring" | "whiteLabel";
export type Capability =
  | "command_center.basic" | "command_center.advanced"
  | "ai_workforce.core" | "ai_workforce.builder" | "ai_workforce.teams" | "ai_workforce.deployment" | "ai_workforce.orchestration" | "ai_workforce.monitoring" | "ai_workforce.performance" | "ai_workforce.voice" | "ai_workforce.simulator" | "ai_workforce.marketplace" | "ai_workforce.collections"
  | "human_workforce.core" | "human_workforce.hr" | "human_workforce.attendance" | "human_workforce.leave" | "human_workforce.payroll" | "human_workforce.teams"
  | "customer_ops.core" | "customer_ops.inbox" | "customer_ops.customers" | "customer_ops.leads" | "customer_ops.conversations" | "customer_ops.followups" | "customer_ops.handoffs" | "customer_ops.appointments" | "customer_ops.tickets" | "customer_ops.ai_assist"
  | "business_ops.core" | "business_ops.tasks" | "business_ops.approvals" | "business_ops.automations" | "business_ops.workflows" | "business_ops.inventory" | "business_ops.documents" | "business_ops.alerts"
  | "intelligence.basic" | "intelligence.advanced" | "intelligence.sales" | "intelligence.customer" | "intelligence.ai_workforce" | "intelligence.human_workforce" | "intelligence.operations" | "intelligence.inventory" | "intelligence.reports"
  | "integrations.core" | "integrations.communication" | "integrations.social" | "integrations.calendar" | "integrations.payments" | "integrations.accounting" | "integrations.crm" | "integrations.external_apps" | "integrations.developer_api"
  | "business_brain.core" | "business_brain.sources" | "business_brain.documents" | "business_brain.memory" | "business_brain.instructions" | "business_brain.management"
  | "admin.team_staff" | "admin.roles_permissions" | "admin.branches" | "admin.billing"
  | "enterprise.organization" | "enterprise.multi_business" | "enterprise.group_command_center" | "enterprise.cross_business_analytics" | "enterprise.advanced_governance";

export type EntitlementLimits = { max_ai_employees: number | null; max_human_users: number | null; max_businesses: number | null; max_branches: number | null; max_knowledge_sources: number | null; max_automations: number | null; max_api_keys: number | null; max_monthly_conversations: number | null; max_storage_mb: number | null; includedVoiceMinutes: number };
export type PlanDefinition = { id: PlanId; name: string; employeeLimit: number | null; automationLimit: number | null; includedVoiceMinutes: number; features: BillingFeature[]; capabilities: Capability[] };

export const allCapabilities: Capability[] = [
  "command_center.basic", "command_center.advanced", "ai_workforce.core", "ai_workforce.builder", "ai_workforce.teams", "ai_workforce.deployment", "ai_workforce.orchestration", "ai_workforce.monitoring", "ai_workforce.performance", "ai_workforce.voice", "ai_workforce.simulator", "ai_workforce.marketplace", "ai_workforce.collections",
  "human_workforce.core", "human_workforce.hr", "human_workforce.attendance", "human_workforce.leave", "human_workforce.payroll", "human_workforce.teams", "customer_ops.core", "customer_ops.inbox", "customer_ops.customers", "customer_ops.leads", "customer_ops.conversations", "customer_ops.followups", "customer_ops.handoffs", "customer_ops.appointments", "customer_ops.tickets", "customer_ops.ai_assist",
  "business_ops.core", "business_ops.tasks", "business_ops.approvals", "business_ops.automations", "business_ops.workflows", "business_ops.inventory", "business_ops.documents", "business_ops.alerts", "intelligence.basic", "intelligence.advanced", "intelligence.sales", "intelligence.customer", "intelligence.ai_workforce", "intelligence.human_workforce", "intelligence.operations", "intelligence.inventory", "intelligence.reports",
  "integrations.core", "integrations.communication", "integrations.social", "integrations.calendar", "integrations.payments", "integrations.accounting", "integrations.crm", "integrations.external_apps", "integrations.developer_api", "business_brain.core", "business_brain.sources", "business_brain.documents", "business_brain.memory", "business_brain.instructions", "business_brain.management", "admin.team_staff", "admin.roles_permissions", "admin.branches", "admin.billing", "enterprise.organization", "enterprise.multi_business", "enterprise.group_command_center", "enterprise.cross_business_analytics", "enterprise.advanced_governance",
];

const starterCapabilities: Capability[] = ["command_center.basic", "ai_workforce.core", "customer_ops.core", "customer_ops.inbox", "customer_ops.customers", "customer_ops.leads", "customer_ops.followups", "integrations.core", "integrations.communication", "business_brain.core", "business_brain.sources", "admin.team_staff", "admin.billing"];
const growthCapabilities: Capability[] = [...starterCapabilities, "ai_workforce.builder", "ai_workforce.teams", "ai_workforce.deployment", "ai_workforce.monitoring", "customer_ops.conversations", "customer_ops.handoffs", "customer_ops.appointments", "customer_ops.tickets", "business_ops.core", "business_ops.tasks", "business_ops.approvals", "business_ops.automations", "intelligence.basic", "business_brain.documents", "business_brain.memory", "business_brain.instructions"];
const proCapabilities: Capability[] = [...growthCapabilities, "customer_ops.ai_assist", "ai_workforce.orchestration", "ai_workforce.performance", "ai_workforce.voice", "ai_workforce.simulator", "ai_workforce.marketplace", "human_workforce.core", "human_workforce.hr", "human_workforce.attendance", "human_workforce.leave", "human_workforce.payroll", "human_workforce.teams", "business_ops.workflows", "business_ops.documents", "business_ops.alerts", "intelligence.advanced", "intelligence.sales", "intelligence.customer", "intelligence.ai_workforce", "intelligence.human_workforce", "intelligence.operations", "intelligence.reports", "integrations.social", "integrations.calendar", "integrations.payments", "integrations.accounting", "integrations.crm", "integrations.external_apps", "integrations.developer_api", "business_brain.management"];

const common: BillingFeature[] = ["businessBrain", "websiteChat", "basicInbox", "basicAnalytics", "basicAutomations", "employeeTesting"];
export const planDefinitions: PlanDefinition[] = [
  { id: "starter", name: "Starter", employeeLimit: 1, automationLimit: 5, includedVoiceMinutes: 0, features: [...common], capabilities: starterCapabilities },
  { id: "growth", name: "Growth", employeeLimit: 3, automationLimit: 20, includedVoiceMinutes: 0, features: [...common, "salesBasic", "marketingBasic"], capabilities: growthCapabilities },
  { id: "pro", name: "Pro", employeeLimit: 10, automationLimit: 100, includedVoiceMinutes: 500, features: [...common, "voice", "salesBasic", "salesAdvanced", "marketingBasic", "marketingAdvanced", "advancedAnalytics", "advancedAutomations", "customIntegrations", "orchestration", "certification", "monitoring"], capabilities: proCapabilities },
  { id: "enterprise", name: "Enterprise", employeeLimit: null, automationLimit: null, includedVoiceMinutes: 5000, features: [...common, "voice", "salesBasic", "salesAdvanced", "marketingBasic", "marketingAdvanced", "advancedAnalytics", "advancedAutomations", "customIntegrations", "orchestration", "certification", "monitoring", "whiteLabel"], capabilities: allCapabilities },
];

export function normalizePlan(value: string | null | undefined): PlanId { return value === "growth" || value === "pro" || value === "enterprise" ? value : "starter"; }
export function getPlanDefinition(plan: string | null | undefined) { return planDefinitions.find((item) => item.id === normalizePlan(plan)) || planDefinitions[0]; }

export const legacyFeatureCapabilities: Record<BillingFeature, Capability[]> = {
  businessBrain: ["business_brain.core"], websiteChat: ["integrations.communication"], basicInbox: ["customer_ops.inbox"], basicAnalytics: ["intelligence.basic"], basicAutomations: ["business_ops.automations"], employeeTesting: ["ai_workforce.core"], voice: ["ai_workforce.voice"], salesBasic: ["customer_ops.leads"], salesAdvanced: ["intelligence.sales"], marketingBasic: ["business_ops.core"], marketingAdvanced: ["intelligence.advanced"], advancedAnalytics: ["intelligence.advanced"], advancedAutomations: ["business_ops.workflows"], customIntegrations: ["integrations.developer_api"], orchestration: ["ai_workforce.orchestration"], certification: ["ai_workforce.monitoring"], monitoring: ["ai_workforce.monitoring"], whiteLabel: ["enterprise.advanced_governance"],
};

export function defaultLimitsForPlan(plan: PlanDefinition): EntitlementLimits {
  return {
    max_ai_employees: plan.employeeLimit,
    max_human_users: null,
    max_businesses: plan.id === "enterprise" ? null : 1,
    max_branches: plan.id === "starter" ? 1 : plan.id === "growth" ? 3 : null,
    max_knowledge_sources: plan.id === "starter" ? 10 : null,
    max_automations: plan.automationLimit,
    max_api_keys: plan.id === "enterprise" ? null : 0,
    max_monthly_conversations: null,
    max_storage_mb: null,
    includedVoiceMinutes: plan.includedVoiceMinutes,
  };
}

export function canUseFeature(plan: PlanDefinition, feature: BillingFeature) { return plan.features.includes(feature); }
export function getPlanLimits(plan: PlanDefinition) { return { employeeLimit: plan.employeeLimit, automationLimit: plan.automationLimit, includedVoiceMinutes: plan.includedVoiceMinutes }; }
export function employeeLimitMessage(plan: PlanDefinition) { return `You've reached the AI employee limit on ${plan.name}.`; }
export function hasCapability(entitlements: { capabilities: Capability[] }, capability: Capability) { return entitlements.capabilities.includes(capability); }

/**
 * Single source of truth for "which plan first unlocks this capability" — derived
 * from planDefinitions rather than hand-maintained, so it can't drift the way the
 * old capabilityRequiredPlans map in app/dashboard/layout.tsx did.
 */
export const planOrder: PlanId[] = ["starter", "growth", "pro", "enterprise"];

export function minimumPlanForCapability(capability: Capability): PlanId | null {
  for (const planId of planOrder) {
    const plan = planDefinitions.find((item) => item.id === planId);
    if (plan?.capabilities.includes(capability)) return planId;
  }
  return null;
}

export const capabilityMinimumPlan: Record<string, PlanId> = Object.fromEntries(
  allCapabilities
    .map((capability) => [capability, minimumPlanForCapability(capability)])
    .filter((entry): entry is [Capability, PlanId] => entry[1] !== null),
);
