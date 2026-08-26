"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { planOrder, type Capability, type PlanId } from "@/lib/billing/plan-definitions";

type Plan = { id: PlanId; name: string; employeeLimit: number | null; automationLimit: number | null; includedVoiceMinutes: number; capabilities: Capability[] };
type BillingData = { plan: { id: PlanId; name: string }; provider: string; subscription: { status: string; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean } | null };

const categoryNames: Record<string, string> = { command_center: "Command Center", ai_workforce: "AI Workforce", customer_ops: "Customer Operations", business_ops: "Business Operations", human_workforce: "Human Workforce", intelligence: "Intelligence", integrations: "Integrations", business_brain: "Business Brain", admin: "Administration", enterprise: "Enterprise Governance" };
const planDescriptions: Record<PlanId, string> = { starter: "Simple tools for solo operators and small businesses.", growth: "More automation and customer operations for growing teams.", pro: "Advanced AI workforce and single-business operations.", enterprise: "Complete SuperKuba governance for complex organizations." };

function categoriesFor(plan: Plan) {
  return [...new Set(plan.capabilities.map((capability) => categoryNames[capability.split(".")[0]] || "Platform capabilities"))];
}

export default function PlansExperience() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [billing, setBilling] = useState<BillingData | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/billing/plans", { cache: "no-store" }).then((response) => response.json()),
      fetch("/api/billing/usage", { cache: "no-store" }).then((response) => response.json()),
    ]).then(([planData, billingData]) => {
      if (!active) return;
      setPlans(planData.plans || []);
      if (billingData.plan) setBilling(billingData);
    }).catch(() => {
      if (active) setMessage("Unable to load plans. Please try again.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  async function requestUpgrade(planId: PlanId) {
    setMessage("");
    if (planId === "enterprise") {
      setMessage("Enterprise access requires a sales conversation. This request does not change your plan.");
      return;
    }
    const response = await fetch("/api/billing/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan: planId }) });
    const data = await response.json();
    if (response.ok && data.url) window.location.assign(data.url);
    else setMessage(data.error || "Unable to start checkout.");
  }

  if (loading) return <State message="Loading plans..." />;

  return <main className="min-h-screen bg-[#050507] px-4 py-8 text-white sm:px-6 lg:px-8 lg:py-12"><div className="mx-auto max-w-7xl"><Link href="/dashboard/billing" className="text-xs font-semibold text-white/40 hover:text-cyan-300">← Billing</Link><header className="mt-5 max-w-3xl"><p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-300/70">Subscription plans</p><h1 className="mt-3 text-4xl font-black">Choose the right operating level</h1><p className="mt-3 text-sm leading-6 text-white/45">Compare the workspace capabilities included in each SuperKuba plan. Pricing is shown only when an authoritative billing price is configured.</p></header>{message && <p className="mt-6 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.05] p-4 text-sm text-cyan-100">{message}</p>}<div className="mt-8 grid gap-4 xl:grid-cols-4">{plans.map((plan) => { const current = billing?.plan.id === plan.id; const lowerThanCurrent = billing && planOrder.indexOf(plan.id) < planOrder.indexOf(billing.plan.id); const enterprise = plan.id === "enterprise"; return <article key={plan.id} className={`flex flex-col rounded-3xl border p-6 ${current ? "border-cyan-300/45 bg-cyan-300/[0.07]" : "border-white/10 bg-white/[0.025]"}`}><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300/70">{plan.name}</p><h2 className="mt-3 text-2xl font-black">{planDescriptions[plan.id]}</h2></div>{current && <span className="shrink-0 rounded-full border border-emerald-300/25 bg-emerald-300/[0.08] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-200">Current</span>}</div><p className="mt-6 text-sm font-semibold text-white/70">{enterprise ? "Custom plan" : "Provider pricing"}</p><p className="mt-1 text-xs text-white/40">No price is displayed until configured by billing.</p><div className="mt-6 space-y-2 border-t border-white/10 pt-5 text-sm text-white/65"><p>{plan.employeeLimit === null ? "Unlimited" : plan.employeeLimit} AI employee{plan.employeeLimit === 1 ? "" : "s"}</p><p>{plan.automationLimit === null ? "Unlimited" : plan.automationLimit} automations</p><p>{plan.includedVoiceMinutes ? `${plan.includedVoiceMinutes} included voice minutes` : "Voice not included"}</p></div><div className="mt-6 flex-1 border-t border-white/10 pt-5"><p className="text-xs font-bold uppercase tracking-[0.16em] text-white/35">Capability areas</p><div className="mt-3 flex flex-wrap gap-2">{categoriesFor(plan).map((category) => <span key={category} className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-white/60">{category}</span>)}</div></div>{enterprise ? <a href="mailto:sales@superkuba.com?subject=SuperKuba%20Enterprise%20request" className="mt-7 block rounded-xl border border-cyan-300/25 bg-cyan-300/[0.08] px-4 py-3 text-center text-sm font-bold text-cyan-100 hover:bg-cyan-300/[0.14]">Contact Sales</a> : <button type="button" disabled={current || Boolean(lowerThanCurrent)} onClick={() => void requestUpgrade(plan.id)} className="mt-7 w-full rounded-xl bg-cyan-400 px-4 py-3 text-sm font-bold text-black disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40">{current ? "Current plan" : lowerThanCurrent ? "Downgrade via provider" : "Upgrade"}</button>}</article>; })}</div></div></main>;
}

function State({ message }: { message: string }) { return <main className="flex min-h-screen items-center justify-center bg-[#050507] px-6 text-sm text-white/50">{message}</main>; }