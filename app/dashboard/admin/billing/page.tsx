"use client";

import { useEffect, useState } from "react";

type BillingData = { plans: { id: string; code: string; name: string; status: string }[]; subscriptions: { id: string; businessName: string; status: string; planName: string; currentPeriodEndsAt: string | null }[] };

export default function AdminBillingPage() {
  const [data, setData] = useState<BillingData | null>(null);
  useEffect(() => { fetch("/api/admin/billing", { cache: "no-store" }).then((r) => r.ok ? r.json() : null).then(setData).catch(() => setData(null)); }, []);
  return <main className="min-h-screen bg-[#050507] p-8 text-white"><div className="max-w-7xl"><p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-300/70">Super Admin</p><h1 className="mt-3 text-4xl font-black">Billing Foundation</h1><p className="mt-3 text-white/50">Read-only plan and subscription data. Changes require a future controlled billing workflow.</p><div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.04] p-6"><h2 className="font-bold">Plan catalog</h2><p className="mt-3 text-sm text-white/50">{data?.plans.map((plan) => `${plan.name} (${plan.code})`).join(" · ") || "No plans configured."}</p></div><div className="mt-6 overflow-x-auto rounded-3xl border border-white/10 bg-white/[0.04]"><table className="w-full text-left text-sm"><thead className="border-b border-white/10 text-white/40"><tr><th className="p-4">Business</th><th>Plan</th><th>Status</th><th className="p-4">Renews</th></tr></thead><tbody>{data?.subscriptions.map((subscription) => <tr key={subscription.id} className="border-b border-white/5"><td className="p-4">{subscription.businessName}</td><td>{subscription.planName}</td><td>{subscription.status}</td><td className="p-4">{subscription.currentPeriodEndsAt ? new Date(subscription.currentPeriodEndsAt).toLocaleDateString() : "—"}</td></tr>)}{data?.subscriptions.length === 0 && <tr><td className="p-4 text-white/40" colSpan={4}>No subscriptions recorded.</td></tr>}</tbody></table></div></div></main>;
}
