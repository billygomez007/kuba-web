"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type BillingSnapshot = {
  plan: { name: string };
  subscription: { status: string; trialEnd: string | null; cancelAtPeriodEnd: boolean } | null;
};

function daysRemaining(trialEnd: string) {
  const ms = new Date(trialEnd).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

export default function TrialBanner() {
  const [data, setData] = useState<BillingSnapshot | null>(null);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      void fetch("/api/billing/usage", { cache: "no-store" })
        .then((response) => (response.ok ? response.json() : null))
        .then((result) => { if (active && result) setData(result); })
        .catch(() => {});
    }, 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, []);

  const subscription = data?.subscription;
  if (!subscription) return null;

  // Disappears entirely once the subscription is a normal paid/active state
  // with nothing noteworthy to say (Phase 13: "not intrusive").
  if (subscription.status === "active" && !subscription.cancelAtPeriodEnd) return null;

  if (subscription.status === "trialing" && subscription.trialEnd) {
    const remaining = daysRemaining(subscription.trialEnd);
    const endDate = new Date(subscription.trialEnd).toLocaleDateString(undefined, { month: "long", day: "numeric" });
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cyan-300/20 bg-cyan-300/[0.06] px-4 py-2 text-xs text-cyan-100 sm:px-6">
        <span>{data.plan.name} trial · {remaining} day{remaining === 1 ? "" : "s"} remaining {subscription.cancelAtPeriodEnd ? "(will not convert to paid)" : `· ends ${endDate}`}</span>
        <Link href="/dashboard/billing" className="font-semibold underline underline-offset-2 hover:text-white">Manage billing</Link>
      </div>
    );
  }

  if (subscription.status === "past_due") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-400/25 bg-amber-400/[0.08] px-4 py-2 text-xs text-amber-200 sm:px-6">
        <span>Payment required — your last charge for {data.plan.name} did not succeed.</span>
        <Link href="/dashboard/billing" className="font-semibold underline underline-offset-2 hover:text-white">Update payment method</Link>
      </div>
    );
  }

  if (subscription.cancelAtPeriodEnd) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-white/[0.04] px-4 py-2 text-xs text-white/60 sm:px-6">
        <span>{data.plan.name} subscription is set to end and will not renew.</span>
        <Link href="/dashboard/billing" className="font-semibold underline underline-offset-2 hover:text-white">Manage billing</Link>
      </div>
    );
  }

  if (subscription.status === "canceled") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-white/[0.04] px-4 py-2 text-xs text-white/60 sm:px-6">
        <span>Your subscription has ended.</span>
        <Link href="/dashboard/billing/plans" className="font-semibold underline underline-offset-2 hover:text-white">Choose a plan</Link>
      </div>
    );
  }

  return null;
}
