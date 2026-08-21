"use client";

import { useEffect, useState } from "react";

type Overview = { businesses: number; activeUsers: number; activeAiEmployees: number; activeSubscriptions: number };

export default function SuperAdminPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  useEffect(() => { fetch("/api/admin/overview", { cache: "no-store" }).then((response) => response.ok ? response.json() : null).then(setOverview).catch(() => setOverview(null)); }, []);
  const stats = [["Businesses", overview?.businesses], ["Active users", overview?.activeUsers], ["Active AI employees", overview?.activeAiEmployees], ["Active subscriptions", overview?.activeSubscriptions]];
  return <main className="min-h-screen bg-[#050507] p-8 text-white"><div className="max-w-7xl"><p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-300/70">Kuba Platform Administration</p><h1 className="mt-3 text-4xl font-black">Super Admin Command Center</h1><p className="mt-3 max-w-2xl text-white/50">Platform-wide business, user, workforce, billing, security, and system administration.</p><div className="mt-10 grid gap-5 md:grid-cols-4">{stats.map(([label, value]) => <div key={label as string} className="rounded-3xl border border-white/10 bg-white/[0.04] p-6"><p className="text-3xl font-black">{value ?? "—"}</p><p className="mt-3 font-bold">{label}</p></div>)}</div><div className="mt-10 rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-sm text-white/50">Subscription revenue is intentionally unavailable until a payment provider and revenue model are approved.</div></div></main>;
}
