"use client";

import { useEffect, useState } from "react";

type Business = { id: string; name: string; slug: string; plan: string; status: string; createdAt: string };
type BusinessResponse = { stats: { total: number; active: number; trial: number; suspended: number }; businesses: Business[] };

export default function AdminBusinessesPage() {
  const [data, setData] = useState<BusinessResponse | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const load = () => fetch("/api/admin/businesses", { cache: "no-store" }).then((r) => r.ok ? r.json() : null).then(setData).catch(() => setData(null));
  useEffect(() => { load(); }, []);
  async function updateStatus(business: Business) { setUpdatingId(business.id); await fetch(`/api/admin/businesses/${business.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: business.status === "suspended" ? "active" : "suspended" }) }); setUpdatingId(null); load(); }
  const stats = data?.stats;
  return <main className="min-h-screen bg-[#050507] p-8 text-white"><div className="max-w-7xl"><p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-300/70">Super Admin</p><h1 className="mt-3 text-4xl font-black">Business Management</h1><div className="mt-8 grid gap-4 md:grid-cols-4">{[["Total", stats?.total], ["Active", stats?.active], ["Trial", stats?.trial], ["Suspended", stats?.suspended]].map(([label, value]) => <div key={label as string} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5"><p className="text-2xl font-black">{value ?? "—"}</p><p className="text-sm text-white/40">{label} businesses</p></div>)}</div><div className="mt-8 overflow-x-auto rounded-3xl border border-white/10 bg-white/[0.04]"><table className="w-full text-left text-sm"><thead className="border-b border-white/10 text-white/40"><tr><th className="p-4">Business</th><th>Plan</th><th>Status</th><th>Created</th><th className="p-4">Control</th></tr></thead><tbody>{data?.businesses.map((business) => <tr key={business.id} className="border-b border-white/5"><td className="p-4 font-medium">{business.name}</td><td>{business.plan}</td><td>{business.status}</td><td>{new Date(business.createdAt).toLocaleDateString()}</td><td className="p-4"><button disabled={updatingId === business.id} onClick={() => updateStatus(business)} className="rounded-lg border border-white/15 px-3 py-1.5 disabled:opacity-50">{business.status === "suspended" ? "Reactivate" : "Suspend"}</button></td></tr>)}{data?.businesses.length === 0 && <tr><td className="p-4 text-white/40" colSpan={5}>No businesses found.</td></tr>}</tbody></table></div></div></main>;
}
