"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type PhoneNumber = { id: string; status: string };
type Provider = { id: string; status: string };

export default function VoiceOverviewClient({ businessName }: { businessName: string }) {
  const [numbers, setNumbers] = useState<PhoneNumber[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/settings/phone-numbers", { cache: "no-store" }).then((response) => response.ok ? response.json() : { numbers: [] }),
      fetch("/api/settings/voice-providers", { cache: "no-store" }).then((response) => response.ok ? response.json() : { connections: [] }),
    ]).then(([numberData, providerData]) => {
      if (!cancelled) {
        setNumbers(Array.isArray(numberData.numbers) ? numberData.numbers : []);
        setProviders(Array.isArray(providerData.connections) ? providerData.connections : []);
        setLoaded(true);
      }
    }).catch(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  const configured = numbers.some((item) => ["active", "available"].includes(item.status)) || providers.some((item) => item.status === "active");
  const cards = [
    { title: "Phone numbers", description: "Buy, assign, and manage the numbers this business uses for Voice.", href: "/dashboard/settings/phone-numbers", action: "Manage numbers" },
    { title: "AI Employee Voice Configuration", description: "Configure Voice capability, routing, permissions, and handoff for each employee.", href: "/dashboard/ai-employees", action: "Open AI Workforce" },
    { title: "Voice Integration", description: "Review the provider connection and tenant-scoped Voice transport settings.", href: "/dashboard/integrations/voice", action: "Open integration" },
    { title: "Voice Testing", description: "Use the existing simulation tools to validate employee behavior safely.", href: "/dashboard/workforce/voice-testing", action: "Run a test" },
    { title: "Live Calls", description: "Monitor active Voice conversations and existing handoff operations.", href: "/dashboard/workforce/live-calls", action: "View live calls" },
    { title: "Call history", description: "Review Voice conversations in the shared customer operations history.", href: "/dashboard/conversations", action: "Open conversations" },
  ];

  return (
    <main className="min-h-screen bg-[#07070A] px-4 py-8 text-white sm:px-6 lg:px-10 lg:py-12">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div><p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-300/70">{businessName} · communication</p><h1 className="mt-3 text-4xl font-black tracking-[-0.04em]">Voice</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-white/45">One place to prepare, configure, test, and monitor Voice for this business.</p></div>
          <span className={`rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${configured ? "border-emerald-300/25 bg-emerald-300/[0.08] text-emerald-200" : "border-amber-300/20 bg-amber-300/[0.06] text-amber-200"}`}>{loaded ? configured ? "Ready" : "Setup required" : "Checking readiness"}</span>
        </header>
        <section className="mt-8 rounded-3xl border border-cyan-300/15 bg-cyan-300/[0.04] p-6 sm:p-8"><p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-300/70">Voice readiness</p><h2 className="mt-2 text-2xl font-black">{configured ? "Voice is configured for this business" : "Connect Voice for this business"}</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-white/45">{configured ? "An active Voice provider or phone number is available. Employee settings and provider transport still control which calls can run." : "No active provider or usable phone number is recorded yet. Configure those existing resources before expecting live calls."}</p></section>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{cards.map((card) => <article key={card.href} className="flex flex-col rounded-3xl border border-white/10 bg-white/[0.025] p-6"><p className="text-xs font-bold uppercase tracking-[0.2em] text-white/35">Voice</p><h2 className="mt-3 text-xl font-black">{card.title}</h2><p className="mt-3 flex-1 text-sm leading-6 text-white/45">{card.description}</p><Link href={card.href} className="mt-6 inline-flex w-fit rounded-xl border border-cyan-300/20 bg-cyan-300/[0.06] px-4 py-2.5 text-sm font-semibold text-cyan-200 hover:bg-cyan-300/[0.12]">{card.action} →</Link></article>)}</div>
      </div>
    </main>
  );
}
