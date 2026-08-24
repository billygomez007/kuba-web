"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const initialInstallations = [
  { id: "dental-receptionist-ai", name: "Dental Receptionist AI", status: "Active", date: "2026-08-21", updated: "2026-08-23", employee: "Dental Front Desk AI" },
  { id: "dental-appointment-workflow", name: "Dental Appointment Workflow", status: "Configured", date: "2026-08-18", updated: "2026-08-22", employee: "Appointment Coordinator AI" },
  { id: "lead-qualification-skill", name: "Lead Qualification Skill", status: "Testing", date: "2026-08-15", updated: "2026-08-23", employee: "Sales AI" },
];

export default function MarketplaceInstallationsPage() {
  const [items, setItems] = useState<typeof initialInstallations>(initialInstallations);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/workforce-packages", { cache: "no-store" });
        const data = await response.json();
        if (!cancelled) setItems((data.packages || []).filter((item: { installed: boolean }) => item.installed).map((item: { id: string; name: string }) => ({
          id: item.id,
          name: item.name,
          status: "Active",
          date: "2026-08-20",
          updated: "2026-08-23",
          employee: item.name,
        })) || initialInstallations);
      } catch {
        if (!cancelled) setItems(initialInstallations);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, []);

  return (
    <main className="min-h-screen bg-[#050507] px-4 py-8 text-white sm:px-6 lg:px-8 lg:py-12">
      <div className="mx-auto max-w-[1200px]">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-300/70">Marketplace lifecycle</p>
            <h1 className="mt-3 text-4xl font-black tracking-[-0.05em]">Installation history</h1>
          </div>
          <Link href="/dashboard/marketplace" className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-white/70 hover:bg-white/[0.08]">
            Browse marketplace
          </Link>
        </header>

        <div className="mt-8 grid gap-4">
          {items.map((item) => (
            <article key={item.id} className="rounded-3xl border border-white/10 bg-white/[0.02] p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-violet-300/70">{item.status}</p>
                  <h2 className="mt-2 text-2xl font-black">{item.name}</h2>
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${item.status === "Active" ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200" : item.status === "Configured" ? "border-cyan-400/20 bg-cyan-400/10 text-cyan-200" : item.status === "Testing" ? "border-amber-400/20 bg-amber-400/10 text-amber-200" : "border-white/10 bg-white/[0.04] text-white/50"}`}>
                  {item.status}
                </span>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <InfoRow label="Installation date" value={item.date} />
                <InfoRow label="Last update" value={item.updated} />
                <InfoRow label="Assigned employee" value={item.employee} />
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-[10px] uppercase tracking-[0.2em] text-white/25">{label}</p>
      <p className="mt-2 text-sm font-bold text-white/75">{value}</p>
    </div>
  );
}
