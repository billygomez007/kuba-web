import type { Metadata } from "next";
import Link from "next/link";
import MarketingHeader from "@/app/components/MarketingHeader";

import {
  allCapabilities,
  defaultLimitsForPlan,
  planDefinitions,
  planOrder,
  type Capability,
  type PlanId,
} from "@/lib/billing/plan-definitions";

export const metadata: Metadata = {
  title: "SuperKuba Pricing | Starter, Growth, Pro & Enterprise",
  description:
    "Compare SuperKuba Starter, Growth, Pro, and Enterprise plans and the capabilities included in each operating level.",
};

const pricingCopy: Record<PlanId, { price: string; billingLabel: string; description: string; cta: string; recommended?: boolean }> = {
  starter: { price: "$XX", billingLabel: "/ month", description: "For small businesses getting started with SuperKuba.", cta: "Get Started" },
  growth: { price: "$XX", billingLabel: "/ month", description: "For growing businesses that need automation and stronger customer operations.", cta: "Choose Growth" },
  pro: { price: "$XX", billingLabel: "/ month", description: "For businesses running more of their operations through SuperKuba.", cta: "Choose Pro", recommended: true },
  enterprise: { price: "Custom", billingLabel: "pricing", description: "For organizations needing the complete operating system, governance, multi-business capability, advanced control, and enterprise support.", cta: "Contact Sales" },
};

const categoryLabels: Record<string, string> = {
  command_center: "Command Center",
  ai_workforce: "AI Workforce",
  customer_ops: "Customer Operations",
  business_ops: "Business Operations",
  human_workforce: "Human Workforce",
  intelligence: "Intelligence",
  integrations: "Integrations",
  business_brain: "Business Brain",
  admin: "Administration & Governance",
  enterprise: "Administration & Governance",
};

const capabilityLabels: Partial<Record<Capability, string>> = {
  "command_center.basic": "Business overview",
  "command_center.advanced": "Advanced organization overview",
  "ai_workforce.core": "AI employee workspace",
  "ai_workforce.builder": "AI employee builder",
  "ai_workforce.teams": "AI teams",
  "ai_workforce.deployment": "AI employee deployment",
  "ai_workforce.orchestration": "Workforce orchestration",
  "ai_workforce.monitoring": "Workforce monitoring",
  "ai_workforce.performance": "AI workforce performance",
  "ai_workforce.voice": "AI voice employees",
  "ai_workforce.simulator": "Workforce simulator",
  "ai_workforce.marketplace": "AI employee marketplace",
  "ai_workforce.collections": "Collections agent",
  "human_workforce.core": "Human workforce",
  "human_workforce.hr": "HR operations",
  "human_workforce.attendance": "Attendance",
  "human_workforce.leave": "Leave management",
  "human_workforce.payroll": "Payroll",
  "human_workforce.teams": "Human workforce teams",
  "customer_ops.core": "Customer operations workspace",
  "customer_ops.inbox": "Unified inbox",
  "customer_ops.customers": "Customer records",
  "customer_ops.leads": "Lead management",
  "customer_ops.conversations": "Conversation management",
  "customer_ops.followups": "Follow-ups",
  "customer_ops.handoffs": "Human handoffs",
  "customer_ops.appointments": "Appointments",
  "customer_ops.tickets": "Support tickets",
  "business_ops.core": "Business operations",
  "business_ops.tasks": "Operational tasks",
  "business_ops.approvals": "Approvals",
  "business_ops.automations": "Automations",
  "business_ops.workflows": "Workflow templates",
  "business_ops.inventory": "Inventory",
  "business_ops.documents": "Operations documents",
  "business_ops.alerts": "Operational alerts",
  "intelligence.basic": "Business analytics",
  "intelligence.advanced": "Advanced intelligence",
  "intelligence.sales": "Sales intelligence",
  "intelligence.customer": "Customer intelligence",
  "intelligence.ai_workforce": "AI workforce intelligence",
  "intelligence.human_workforce": "Human workforce intelligence",
  "intelligence.operations": "Operations intelligence",
  "intelligence.inventory": "Inventory intelligence",
  "intelligence.reports": "Reports",
  "integrations.core": "Integration foundation",
  "integrations.communication": "Communication channels",
  "integrations.social": "Social channels",
  "integrations.calendar": "Calendar integration",
  "integrations.payments": "Payments integration",
  "integrations.accounting": "Accounting integration",
  "integrations.crm": "CRM integration",
  "integrations.external_apps": "External app connections",
  "integrations.developer_api": "Developer API",
  "business_brain.core": "Business Brain",
  "business_brain.sources": "Knowledge sources",
  "business_brain.documents": "Knowledge documents",
  "business_brain.memory": "Business memory",
  "business_brain.instructions": "AI instructions",
  "business_brain.management": "Knowledge management",
  "admin.team_staff": "Team staff",
  "admin.roles_permissions": "Roles and permissions",
  "admin.branches": "Branches and locations",
  "admin.billing": "Billing administration",
  "enterprise.organization": "Organization controls",
  "enterprise.multi_business": "Multi-business management",
  "enterprise.group_command_center": "Group Command Center",
  "enterprise.cross_business_analytics": "Cross-business analytics",
  "enterprise.advanced_governance": "Advanced governance",
};

const implementedCapabilities = new Set<Capability>([
  "command_center.basic", "ai_workforce.core", "ai_workforce.builder", "ai_workforce.teams", "ai_workforce.deployment", "ai_workforce.orchestration", "ai_workforce.monitoring", "ai_workforce.performance", "ai_workforce.voice", "ai_workforce.simulator", "ai_workforce.marketplace", "human_workforce.core", "human_workforce.hr", "human_workforce.attendance", "human_workforce.leave", "human_workforce.payroll", "human_workforce.teams", "customer_ops.core", "customer_ops.inbox", "customer_ops.customers", "customer_ops.leads", "customer_ops.conversations", "customer_ops.followups", "customer_ops.handoffs", "customer_ops.appointments", "customer_ops.tickets", "business_ops.core", "business_ops.tasks", "business_ops.approvals", "business_ops.automations", "business_ops.workflows", "business_ops.documents", "business_ops.alerts", "intelligence.basic", "intelligence.advanced", "intelligence.sales", "intelligence.customer", "intelligence.ai_workforce", "intelligence.human_workforce", "intelligence.operations", "intelligence.reports", "integrations.core", "integrations.communication", "integrations.social", "integrations.calendar", "integrations.payments", "integrations.accounting", "integrations.crm", "integrations.external_apps", "integrations.developer_api", "business_brain.core", "business_brain.sources", "business_brain.documents", "business_brain.memory", "business_brain.instructions", "business_brain.management", "admin.team_staff", "admin.billing",
]);

function labelFor(capability: Capability) {
  return capabilityLabels[capability] || capability.split(".").at(-1)?.replaceAll("_", " ") || capability;
}

function statusFor(plan: typeof planDefinitions[number], capability: Capability) {
  if (!plan.capabilities.includes(capability)) return "Not included";
  return implementedCapabilities.has(capability) ? "Included" : "Coming Soon";
}

function limitCopy(planId: PlanId) {
  const plan = planDefinitions.find((item) => item.id === planId)!;
  const limits = defaultLimitsForPlan(plan);
  return [
    limits.max_ai_employees === null ? "Unlimited AI employees" : `Up to ${limits.max_ai_employees} AI employee${limits.max_ai_employees === 1 ? "" : "s"}`,
    limits.max_automations === null ? "Unlimited automations" : `Up to ${limits.max_automations} automations`,
    limits.max_branches === null ? "Unlimited branches" : `Up to ${limits.max_branches} branch${limits.max_branches === 1 ? "" : "es"}`,
    limits.includedVoiceMinutes > 0 ? `${limits.includedVoiceMinutes} included voice minutes` : null,
  ].filter(Boolean) as string[];
}

export default function PricingPage() {
  const groupedCapabilities = allCapabilities.reduce<Record<string, Capability[]>>((groups, capability) => {
    const category = capability.split(".")[0];
    (groups[category] ||= []).push(capability);
    return groups;
  }, {});

  return (
    <main className="min-h-screen overflow-hidden bg-[#060609] text-white">
      <MarketingHeader />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.12),transparent_36%),linear-gradient(135deg,#060609_0%,#0b0b12_55%,#09070c_100%)]" />
      <div className="relative mx-auto max-w-[1500px] px-5 pb-20 pt-28 sm:px-8 lg:px-10 lg:pt-36">
        <header className="mx-auto max-w-4xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-300/70">SuperKuba pricing</p>
          <h1 className="mt-5 text-4xl font-black tracking-[-0.045em] sm:text-6xl">Choose the operating level that fits your business.</h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-white/50">Four clear plans for building an AI workforce, running customer operations, and connecting the work that keeps your business moving.</p>
          <p className="mt-4 text-xs text-white/35">Prices are placeholders until final commercial pricing is configured.</p>
        </header>

        <section className="mt-14 grid gap-4 lg:grid-cols-4">
          {planOrder.map((planId) => {
            const plan = planDefinitions.find((item) => item.id === planId)!;
            const copy = pricingCopy[planId];
            return (
              <article key={planId} className={`relative flex flex-col rounded-2xl border p-6 ${copy.recommended ? "border-cyan-300/50 bg-cyan-300/[0.08] shadow-[0_20px_80px_rgba(34,211,238,0.1)]" : "border-white/10 bg-white/[0.035]"}`}>
                {copy.recommended && <span className="absolute -top-3 left-6 rounded-full bg-cyan-300 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-black">Most popular</span>}
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-200/70">{plan.name}</p>
                <h2 className="mt-5 min-h-16 text-2xl font-black leading-tight">{copy.description}</h2>
                <div className="mt-7 flex items-end gap-2"><span className="text-4xl font-black">{copy.price}</span><span className="pb-1 text-sm text-white/40">{copy.billingLabel}</span></div>
                <ul className="mt-7 min-h-28 space-y-2 border-t border-white/10 pt-5 text-sm text-white/65">{limitCopy(planId).map((item) => <li key={item}>✓ {item}</li>)}</ul>
                <Link href={planId === "enterprise" ? "/demo" : "/signup"} className="mt-auto rounded-xl bg-white px-4 py-3 text-center text-sm font-bold text-black transition hover:bg-cyan-100">{copy.cta}</Link>
              </article>
            );
          })}
        </section>

        <section className="mt-20">
          <div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-300/70">Compare capabilities</p><h2 className="mt-3 text-3xl font-black tracking-[-0.035em]">What is included at each level?</h2><p className="mt-3 text-sm leading-6 text-white/45">The comparison below follows the same canonical capability hierarchy used by the SuperKuba dashboard.</p></div>
          <div className="mt-8 overflow-x-auto rounded-2xl border border-white/10 bg-black/20">
            <table className="w-full min-w-[850px] border-collapse text-left text-sm">
              <thead><tr className="border-b border-white/10 bg-white/[0.035]"><th scope="col" className="sticky left-0 bg-[#0b0b12] px-5 py-4 text-xs font-bold uppercase tracking-wider text-white/45">Capability</th>{planOrder.map((planId) => <th scope="col" key={planId} className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-cyan-200/70">{planDefinitions.find((plan) => plan.id === planId)!.name}</th>)}</tr></thead>
              <tbody>{Object.entries(groupedCapabilities).map(([category, capabilities]) => <>{<tr key={`${category}-heading`} className="border-b border-white/[0.06] bg-white/[0.02]"><th colSpan={5} scope="rowgroup" className="px-5 py-3 text-xs font-bold uppercase tracking-[0.18em] text-white/35">{categoryLabels[category] || category}</th></tr>}{capabilities.map((capability) => <tr key={capability} className="border-b border-white/[0.06] last:border-0"><th scope="row" className="sticky left-0 bg-[#08080d] px-5 py-3 font-medium text-white/70">{labelFor(capability)}</th>{planOrder.map((planId) => { const status = statusFor(planDefinitions.find((plan) => plan.id === planId)!, capability); return <td key={planId} className={`px-5 py-3 text-xs font-semibold ${status === "Included" ? "text-emerald-300" : status === "Coming Soon" ? "text-amber-200" : "text-white/30"}`}>{status}</td>; })}</tr>)}</>)}</tbody>
            </table>
          </div>
        </section>

        <section className="mt-16 flex flex-col justify-between gap-5 border-t border-white/10 pt-8 sm:flex-row sm:items-center"><div><p className="text-sm font-bold">Already use SuperKuba?</p><p className="mt-1 text-sm text-white/40">Open the dashboard billing experience to see your current plan and eligible upgrades.</p></div><Link href="/dashboard/billing/plans" className="rounded-xl border border-cyan-300/25 px-4 py-3 text-center text-sm font-bold text-cyan-200 hover:bg-cyan-300/[0.08]">Open billing plans</Link></section>
        <footer className="mt-16 border-t border-white/[0.06] pt-8 text-sm text-white/35"><div className="flex flex-col justify-between gap-4 sm:flex-row"><span>SuperKuba</span><nav aria-label="Pricing footer navigation" className="flex gap-5"><Link href="/products" className="hover:text-white">Products</Link><Link href="/pricing" className="hover:text-white">Pricing</Link><Link href="/resources" className="hover:text-white">Resources</Link><Link href="/login" className="hover:text-white">Log in</Link></nav></div></footer>
      </div>
    </main>
  );
}
