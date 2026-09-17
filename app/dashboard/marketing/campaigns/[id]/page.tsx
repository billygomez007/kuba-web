"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Campaign = { id: string; name: string; description: string | null; objective: string; status: string; approvalStatus: string; channel?: string };

export default function MarketingCampaignDetail({ params }: { params: Promise<{ id: string }> }) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { let cancelled = false; params.then(({ id }) => fetch(`/api/marketing/campaigns/${id}`, { cache: "no-store" }).then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error || "Unable to load campaign."); if (!cancelled) setCampaign(body.campaign); }).catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "Unable to load campaign."); })); return () => { cancelled = true; }; }, [params]);
  return <main className="min-h-screen bg-surface-page px-4 py-8 text-white sm:px-6 lg:px-10 lg:py-12"><div className="mx-auto max-w-[1100px]"><Link href="/dashboard/marketing/campaigns" className="text-sm font-semibold text-cyan-300">← Campaigns</Link>{error ? <div className="mt-8 rounded-card border border-border-default bg-surface-card p-6 text-danger">{error}</div> : !campaign ? <div className="mt-8 rounded-card border border-border-default bg-surface-card p-6 text-text-tertiary">Loading campaign…</div> : <><header className="mt-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-300/70">Native campaign</p><h1 className="mt-3 text-4xl font-black tracking-[-0.04em]">{campaign.name}</h1><p className="mt-3 text-sm text-text-tertiary">{campaign.description || "No description provided."}</p></div><span className="rounded-full border border-border-default px-3 py-1 text-xs font-bold uppercase tracking-wide">{campaign.status}</span></header><div className="mt-8 grid gap-4 sm:grid-cols-3"><Card label="Objective" value={campaign.objective} /><Card label="Approval" value={campaign.approvalStatus} /><Card label="External execution" value="Not connected" /></div><section className="mt-8 rounded-card border border-border-default bg-surface-card p-6"><h2 className="text-lg font-bold">Campaign workspace</h2><p className="mt-3 text-sm leading-6 text-text-tertiary">Channels, content variants, approvals, scheduling, publishing jobs, attribution, and native analytics are tenant-scoped. Provider publication remains unavailable until a real adapter is connected.</p></section></>}</div></main>;
}

function Card({ label, value }: { label: string; value: string }) { return <div className="rounded-card border border-border-default bg-surface-card p-5"><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-text-muted">{label}</p><p className="mt-2 text-lg font-bold capitalize">{value.replaceAll("_", " ")}</p></div>; }
