"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type SetupData = { business?: { name?: string }; employees?: Array<{ id: string; status: string }>; };

export default function SetupChecklist() {
  const [data, setData] = useState<SetupData | null>(null);
  useEffect(() => { const timer = window.setTimeout(() => { void fetch("/api/businesses", { cache: "no-store" }).then((response) => response.json()).then(setData).catch(() => undefined); }, 0); return () => window.clearTimeout(timer); }, []);
  if (!data) return null;
  const hasEmployee = Boolean(data.employees?.length);
  const items = [
    ["Business profile", true, "/dashboard/settings/profile"],
    ["Create AI employee", hasEmployee, "/dashboard/ai-employees/create"],
    ["Add knowledge", hasEmployee, "/dashboard/business-brain"],
    ["Connect WhatsApp", false, "/dashboard/integrations/whatsapp"],
    ["Enable voice", false, hasEmployee ? `/dashboard/ai-employees/${data.employees?.[0]?.id}/voice` : "/dashboard/workforce/voice-testing"],
    ["Deploy employee", false, "/dashboard/workforce/deployment"],
  ] as const;
  return <section className="mt-6 rounded-3xl border border-cyan-300/15 bg-cyan-300/[0.035] p-6 sm:p-8"><div className="flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-300/70">Setup checklist</p><h2 className="mt-2 text-2xl font-black">Complete your SuperKuba setup</h2></div><Link href="/onboarding" className="text-sm font-semibold text-cyan-300">Open onboarding →</Link></div><div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{items.map(([label, complete, href]) => <Link key={label} href={href} className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-black/20 p-3 text-sm text-white/65 hover:border-cyan-300/25"><span className={complete ? "text-emerald-300" : "text-white/25"}>{complete ? "✓" : "○"}</span>{label}<span className="ml-auto text-xs text-white/25">{complete ? "Done" : "Open"}</span></Link>)}</div></section>;
}
