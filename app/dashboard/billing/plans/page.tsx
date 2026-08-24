"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Plan = { id: string; name: string; employeeLimit: number | null; automationLimit: number | null; includedVoiceMinutes: number; features: string[] };
export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]); const [current, setCurrent] = useState(""); const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      void fetch("/api/billing/usage")
        .then((response) => response.json())
        .then((data) => {
          if (!active) return;
          setCurrent(data.plan?.id || "");
        })
        .catch(() => {
          if (!active) return;
          setMessage("Unable to load current billing plan.");
        });

      void fetch("/api/billing/plans")
        .then((response) => response.json())
        .then((data) => {
          if (!active) return;
          setPlans(data.plans || []);
        })
        .catch(() => {
          if (!active) return;
          setMessage("Unable to load available plans.");
        });
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, []);
  async function requestUpgrade(plan: string) { if (plan === "enterprise") { setMessage("Enterprise upgrades require a sales conversation."); return; } const response = await fetch("/api/billing/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan }) }); const data = await response.json(); if (response.ok && data.url) window.location.assign(data.url); else setMessage(data.error || "Unable to start checkout."); }
  return <main className="min-h-screen bg-[#050507] px-4 py-8 text-white sm:px-6 lg:px-8 lg:py-12"><div className="mx-auto max-w-7xl"><Link href="/dashboard/billing" className="text-xs font-semibold text-white/40 hover:text-cyan-300">← Billing</Link><h1 className="mt-5 text-4xl font-black">Choose your plan</h1><p className="mt-3 max-w-2xl text-sm text-white/40">Compare entitlements now. Payments will be connected later.</p>{message && <p className="mt-5 rounded-xl border border-cyan-300/20 p-3 text-sm text-cyan-200">{message}</p>}<div className="mt-8 grid gap-4 lg:grid-cols-4">{plans.map((plan) => <article key={plan.id} className={`rounded-3xl border p-6 ${plan.id === current ? "border-cyan-300/40 bg-cyan-300/[0.06]" : "border-white/10 bg-white/[0.025]"}`}><p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300/70">{plan.name}</p><p className="mt-5 text-3xl font-black">{plan.employeeLimit == null ? "Custom" : plan.employeeLimit} <span className="text-sm font-normal text-white/35">employees</span></p><p className="mt-2 text-sm text-white/45">{plan.includedVoiceMinutes ? `${plan.includedVoiceMinutes} voice minutes` : "Voice add-on"}</p><div className="mt-6 space-y-2">{plan.features.slice(0, 8).map((feature) => <p key={feature} className="text-sm text-white/60">✓ {feature}</p>)}</div><button type="button" disabled={plan.id === current} onClick={() => void requestUpgrade(plan.id)} className="mt-7 w-full rounded-xl bg-cyan-400 px-4 py-3 text-sm font-bold text-black disabled:bg-white/10 disabled:text-white/45">{plan.id === current ? "Current plan" : plan.id === "enterprise" ? "Contact sales" : "Upgrade"}</button></article>)}</div></div></main>;
}
