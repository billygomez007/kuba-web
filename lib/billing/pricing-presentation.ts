/**
 * Shared, canonical pricing PRESENTATION layer — used by both the public
 * /pricing page and the onboarding plan-selection step, so the concise
 * "Everything in X, plus" feature lists are defined exactly once. This is
 * presentation metadata only (labels, copy, tier grouping); the actual
 * entitlement matrix stays solely in lib/billing/plan-definitions.ts.
 *
 * Prices are placeholders ("$XX") until real commercial pricing is approved
 * — never invent a number here.
 */
import { defaultLimitsForPlan, planDefinitions, planOrder, type Capability, type PlanId } from "./plan-definitions";

export const pricingCopy: Record<PlanId, { price: string; billingLabel: string; tagline: string; positioning: string; cta: string; recommended?: boolean }> = {
  starter: { price: "$XX", billingLabel: "/ month", tagline: "Run Your Business", positioning: "For entrepreneurs and small businesses that need the essential tools to manage customers and everyday work.", cta: "Start 14-Day Free Trial" },
  growth: { price: "$XX", billingLabel: "/ month", tagline: "Automate Your Business", positioning: "For growing businesses that need automation and stronger customer operations.", cta: "Start 14-Day Free Trial" },
  pro: { price: "$XX", billingLabel: "/ month", tagline: "Operate With AI", positioning: "For businesses running more of their operations through SuperKuba.", cta: "Start 14-Day Free Trial", recommended: true },
  enterprise: { price: "Custom", billingLabel: "pricing", tagline: "Complete Business Operating System", positioning: "For organizations needing the complete operating system, governance, multi-business capability, advanced control, and enterprise support.", cta: "Contact Sales" },
};

const cardPresentation: Partial<Record<Capability, { label: string; tier: PlanId }>> = {
  "command_center.basic": { label: "Basic Command Center", tier: "starter" },
  "ai_workforce.core": { label: "Basic AI Employees", tier: "starter" },
  "customer_ops.inbox": { label: "Unified Inbox", tier: "starter" },
  "integrations.communication": { label: "Website Live Chat", tier: "starter" },
  "customer_ops.customers": { label: "Customer Management", tier: "starter" },
  "customer_ops.leads": { label: "Lead Management", tier: "starter" },
  "business_ops.tasks": { label: "Tasks", tier: "starter" },
  "admin.team_staff": { label: "Team Access", tier: "starter" },
  "intelligence.basic": { label: "Basic Reporting", tier: "starter" },
  "ai_workforce.builder": { label: "AI Employee Builder", tier: "growth" },
  "customer_ops.conversations": { label: "Conversation Management", tier: "growth" },
  "customer_ops.appointments": { label: "Appointments", tier: "growth" },
  "customer_ops.tickets": { label: "Support Tickets", tier: "growth" },
  "business_ops.core": { label: "Business Operations", tier: "growth" },
  "business_ops.automations": { label: "Automations", tier: "growth" },
  "business_ops.approvals": { label: "Approvals", tier: "growth" },
  "business_brain.documents": { label: "Knowledge Documents", tier: "growth" },
  "business_brain.memory": { label: "Customer Memory", tier: "growth" },
  "ai_workforce.teams": { label: "AI Teams", tier: "growth" },
  "customer_ops.ai_assist": { label: "AI-assisted Appointments & Tickets", tier: "pro" },
  "ai_workforce.orchestration": { label: "AI Orchestration", tier: "pro" },
  "ai_workforce.voice": { label: "AI Voice", tier: "pro" },
  "ai_workforce.monitoring": { label: "AI Monitoring & Performance", tier: "growth" },
  "human_workforce.core": { label: "Human Workforce", tier: "pro" },
  "human_workforce.hr": { label: "HR Operations", tier: "pro" },
  "human_workforce.payroll": { label: "Payroll", tier: "pro" },
  "business_ops.workflows": { label: "Advanced Business Operations", tier: "pro" },
  "intelligence.advanced": { label: "Advanced Analytics", tier: "pro" },
  "integrations.external_apps": { label: "Advanced Integrations", tier: "pro" },
  "enterprise.multi_business": { label: "Multiple Businesses", tier: "enterprise" },
  "enterprise.organization": { label: "Organization & Business Group", tier: "enterprise" },
  "enterprise.group_command_center": { label: "Group Command Center", tier: "enterprise" },
  "enterprise.cross_business_analytics": { label: "Cross-Business Management", tier: "enterprise" },
  "enterprise.advanced_governance": { label: "Advanced Security & Governance", tier: "enterprise" },
  "admin.roles_permissions": { label: "Enterprise Roles & Permissions", tier: "enterprise" },
  "integrations.developer_api": { label: "Developer API & API Keys", tier: "enterprise" },
  "ai_workforce.collections": { label: "Collections Agent", tier: "enterprise" },
};

const cardFeatureOrder = Object.entries(cardPresentation) as Array<[Capability, { label: string; tier: PlanId }]>;

export function cardFeatures(plan: typeof planDefinitions[number]) {
  const planIndex = planOrder.indexOf(plan.id);
  const previousPlan = planDefinitions[planIndex - 1];
  return cardFeatureOrder
    .filter(([capability, presentation]) => plan.capabilities.includes(capability) && presentation.tier === plan.id && (!previousPlan || !previousPlan.capabilities.includes(capability)))
    .map(([, presentation]) => presentation);
}

export function limitCopy(planId: PlanId) {
  const plan = planDefinitions.find((item) => item.id === planId)!;
  const limits = defaultLimitsForPlan(plan);
  return [
    limits.max_ai_employees === null ? "Unlimited AI employees" : `Up to ${limits.max_ai_employees} AI employee${limits.max_ai_employees === 1 ? "" : "s"}`,
    limits.max_automations === null ? "Unlimited automations" : `Up to ${limits.max_automations} automations`,
    limits.max_branches === null ? "Unlimited branches" : `Up to ${limits.max_branches} branch${limits.max_branches === 1 ? "" : "es"}`,
    limits.includedVoiceMinutes > 0 ? `${limits.includedVoiceMinutes} included voice minutes` : null,
  ].filter(Boolean) as string[];
}
