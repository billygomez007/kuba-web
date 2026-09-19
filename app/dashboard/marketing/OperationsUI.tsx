"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import Card from "@/app/components/ui/Card";
import Button from "@/app/components/ui/Button";
import ErrorState from "@/app/components/ui/ErrorState";
import LoadingState from "@/app/components/ui/LoadingState";

export type JsonData<T> = T extends Date ? string : T extends readonly (infer U)[] ? JsonData<U>[] : T extends object ? { [K in keyof T]: JsonData<T[K]> } : T;

export function useMarketingData<T>(url: string) {
  const [result, setResult] = useState<{ data?: T; error?: string }>({});
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch(url, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Unable to load Marketing records.");
        if (!controller.signal.aborted) setResult({ data: body });
      })
      .catch(cause => {
        if (!controller.signal.aborted) setResult({ error: cause instanceof Error ? cause.message : "Unable to load Marketing records." });
      });
    return () => controller.abort();
  }, [url, revision]);
  function reload() { setResult({}); setRevision(value => value + 1); }
  return { ...result, reload };
}

const links = [
  ["Overview", "/dashboard/marketing"],
  ["Approval Center", "/dashboard/marketing/approvals"],
  ["Publishing", "/dashboard/marketing/publishing"],
  ["Calendar", "/dashboard/marketing/calendar"],
  ["Channel Readiness", "/dashboard/marketing/social"],
] as const;

export function OperationsShell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <main className="min-h-screen bg-surface-page px-4 py-8 text-text-primary sm:px-6 lg:px-10">
    <div className="mx-auto max-w-6xl space-y-6">
      <header><p className="text-xs font-bold uppercase tracking-widest text-text-muted">Kuba Marketing</p><h1 className="mt-3 text-3xl font-black">{title}</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-text-tertiary">{description}</p></header>
      <nav aria-label="Marketing operations" className="flex flex-wrap gap-2">{links.map(([label, href]) => <Button key={href} href={href} variant="secondary" size="sm">{label}</Button>)}</nav>
      {children}
    </div>
  </main>;
}

export function DataState({ error, loading, reload }: { error?: string; loading: boolean; reload: () => void }) {
  return error ? <ErrorState message={error} onRetry={reload} /> : loading ? <LoadingState message="Loading Marketing records…" /> : null;
}
export function Empty({ children }: { children: ReactNode }) { return <Card><p className="text-sm text-text-tertiary">{children}</p></Card>; }
export function dateLabel(value: string | null) { return value ? new Date(value).toLocaleString() : "Not recorded"; }
export function ResourceLink({ href, children }: { href: string; children: ReactNode }) { return <Link href={href} className="font-semibold text-accent underline underline-offset-4 focus-visible:outline focus-visible:outline-2">{children}</Link>; }
export const fieldClass = "mt-2 block w-full rounded-control border border-border-default bg-surface-page p-3 text-sm text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent";
