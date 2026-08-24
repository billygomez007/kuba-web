"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { marketplaceProducts } from "../catalog";

export default function MarketplaceSubscriptionsPage() {
  const [packages, setPackages] = useState<Array<{ id: string; name: string; installed: boolean }>>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const response = await fetch("/api/workforce-packages", { cache: "no-store" });
      const data = await response.json();
      if (!cancelled) setPackages(data.packages || []);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const installed = packages.filter((item) => item.installed).map((item) => {
    const product = marketplaceProducts.find((entry) => entry.id === item.id) ?? marketplaceProducts[0];
    return {
      id: item.id,
      name: product.name,
      status: "Active",
      billing: "Monthly plan",
      renewal: "2026-09-15",
      usage: "84% usage",
      category: product.category,
    };
  });

  const fallback = [
    { id: "dental-receptionist-ai", name: "Dental Receptionist AI", status: "Active", billing: "Monthly plan", renewal: "2026-09-15", usage: "84% usage", category: "AI Employee" },
    { id: "dental-appointment-workflow", name: "Dental Appointment Workflow", status: "Active", billing: "Monthly plan", renewal: "2026-09-18", usage: "71% usage", category: "Automation" },
  ];

  const subscriptions = installed.length > 0 ? installed : fallback;

  return (
    <main className="min-h-screen bg-[#050507] px-4 py-8 text-white sm:px-6 lg:px-8 lg:py-12">
      <div className="mx-auto max-w-[1200px]">
        <header className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-300/70">Marketplace subscriptions</p>
            <h1 className="mt-3 text-4xl font-black tracking-[-0.05em]">Installed products</h1>
          </div>
          <Link href="/dashboard/marketplace" className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-white/70 hover:bg-white/[0.08]">
            Browse catalog
          </Link>
        </header>

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          {subscriptions.map((subscription) => (
            <article key={subscription.id} className="rounded-3xl border border-white/10 bg-white/[0.02] p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-300/70">{subscription.category}</p>
                  <h2 className="mt-2 text-2xl font-black">{subscription.name}</h2>
                </div>
                <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-bold uppercase text-emerald-200">
                  {subscription.status}
                </span>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <InfoRow label="Billing" value={subscription.billing} />
                <InfoRow label="Next renewal" value={subscription.renewal} />
                <InfoRow label="Usage" value={subscription.usage} />
                <InfoRow label="Support" value="Included" />
              </div>

              <div className="mt-6 flex gap-3">
                <Link href={`/dashboard/marketplace/${subscription.id}`} className="flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-center text-sm font-bold text-cyan-200 hover:border-cyan-300/30">
                  Manage
                </Link>
                <Link href="/dashboard/workforce" className="flex-1 rounded-xl bg-cyan-400 px-3 py-2 text-center text-sm font-bold text-black hover:bg-cyan-300">
                  Open workforce
                </Link>
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
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
      <p className="text-[10px] uppercase tracking-[0.2em] text-white/25">{label}</p>
      <p className="mt-2 text-sm font-bold text-white/75">{value}</p>
    </div>
  );
}
