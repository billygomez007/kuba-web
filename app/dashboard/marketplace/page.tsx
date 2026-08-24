"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { marketplaceProducts } from "./catalog";

const featuredProducts = marketplaceProducts.slice(0, 3);
const skillProducts = marketplaceProducts.filter((product) => product.category === "Skill");
const automationProducts = marketplaceProducts.filter((product) => product.category === "Automation");
const packageProducts = marketplaceProducts.filter((product) => product.category === "Package");
const aiEmployeeProducts = marketplaceProducts.filter((product) => product.category === "AI Employee");

export default function MarketplaceHomePage() {
  const [packageData, setPackageData] = useState<Array<{ id: string; name: string; installed: boolean }>>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/workforce-packages", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load marketplace catalog.");
        if (!cancelled) setPackageData(data.packages || []);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Unable to load marketplace catalog.");
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const installedIds = useMemo(() => new Set(packageData.filter((item) => item.installed).map((item) => item.id)), [packageData]);

  return (
    <main className="min-h-screen bg-[#050507] px-4 py-8 text-white sm:px-6 lg:px-8 lg:py-12">
      <div className="mx-auto max-w-[1500px]">
        <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-300/70">Commercial marketplace</p>
            <h1 className="mt-3 text-4xl font-black tracking-[-0.05em]">AI Workforce Marketplace</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/40">
              Discover, install, and manage AI workforce products across employees, skills, automations, and packaged operating systems.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/dashboard/marketplace/subscriptions" className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-white/70 hover:bg-white/[0.08]">
              Subscriptions
            </Link>
            <Link href="/dashboard/workforce" className="rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-bold text-black hover:bg-cyan-300">
              Workforce center
            </Link>
          </div>
        </header>

        {error && <p className="mt-6 rounded-xl border border-red-400/20 bg-red-500/[0.05] p-3 text-sm text-red-100">{error}</p>}

        <section className="mt-8 grid gap-4 lg:grid-cols-3">
          {featuredProducts.map((product) => (
            <ProductCard key={product.id} product={product} installed={installedIds.has(product.id) || product.category === "AI Employee" && product.name === "Dental Receptionist AI"} />
          ))}
        </section>

        <MarketplaceSection title="Popular Packages" items={packageProducts} installedIds={installedIds} />
        <MarketplaceSection title="Industry Solutions" items={marketplaceProducts.filter((product) => product.category === "Package") } installedIds={installedIds} />
        <MarketplaceSection title="Skills" items={skillProducts} installedIds={installedIds} />
        <MarketplaceSection title="Automations" items={automationProducts} installedIds={installedIds} />
        <MarketplaceSection title="AI Employees" items={aiEmployeeProducts} installedIds={installedIds} />
      </div>
    </main>
  );
}

function ProductCard({ product, installed }: { product: (typeof marketplaceProducts)[number]; installed: boolean }) {
  return (
    <article className="rounded-3xl border border-white/10 bg-white/[0.02] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-300/70">{product.category}</p>
          <h2 className="mt-2 text-2xl font-black">{product.name}</h2>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${installed ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200" : "border-white/10 bg-white/[0.04] text-white/50"}`}>
          {installed ? "Installed" : product.price}
        </span>
      </div>

      <p className="mt-4 text-sm leading-6 text-white/45">{product.description}</p>

      <div className="mt-4 grid gap-2 text-xs text-white/50">
        <p><span className="text-white/30">Industry:</span> {product.industry}</p>
        <p><span className="text-white/30">Provider:</span> {product.provider}</p>
        <p><span className="text-white/30">Price:</span> {product.price}</p>
        <p><span className="text-white/30">Rating:</span> {product.rating}/5</p>
      </div>

      <div className="mt-5 flex gap-3">
        <Link href={`/dashboard/marketplace/${product.id}`} className="flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-center text-sm font-bold text-cyan-200 hover:border-cyan-300/30">
          View
        </Link>
        <Link href={`/dashboard/marketplace/${product.id}`} className="flex-1 rounded-xl bg-cyan-400 px-3 py-2 text-center text-sm font-bold text-black hover:bg-cyan-300">
          Install
        </Link>
      </div>
    </article>
  );
}

function MarketplaceSection({ title, items, installedIds }: { title: string; items: typeof marketplaceProducts; installedIds: Set<string> }) {
  if (!items.length) return null;

  return (
    <section className="mt-10">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-2xl font-black">{title}</h2>
        <span className="text-xs uppercase tracking-[0.2em] text-white/25">{items.length} products</span>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {items.map((product) => (
          <article key={product.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-black">{product.name}</h3>
              <span className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase ${installedIds.has(product.id) ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200" : "border-white/10 bg-white/[0.04] text-white/50"}`}>
                {installedIds.has(product.id) ? "Installed" : product.price}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-white/45">{product.description}</p>
            <div className="mt-4 flex items-center justify-between text-xs text-white/35">
              <span>{product.industry}</span>
              <span>{product.provider}</span>
            </div>
            <div className="mt-5 flex gap-3">
              <Link href={`/dashboard/marketplace/${product.id}`} className="flex-1 rounded-lg border border-white/10 px-3 py-2 text-center text-sm font-bold text-cyan-200 hover:border-cyan-300/30">
                Details
              </Link>
              <Link href={`/dashboard/marketplace/${product.id}`} className="flex-1 rounded-lg bg-cyan-400 px-3 py-2 text-center text-sm font-bold text-black hover:bg-cyan-300">
                Install
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
