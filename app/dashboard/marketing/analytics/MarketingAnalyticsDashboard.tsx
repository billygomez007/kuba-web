"use client";

import { useCallback, useEffect, useState } from "react";

type AnalyticsData = {
  summary: {
    campaigns: number;
    attributionEvents: number;
    conversions: number;
    attributedLeads: number;
    attributedCustomers: number;
    attributedDeals: number;
    publishJobs: number;
    connectedAccounts: number;
  };
  currencyTotals: Record<string, number>;
  metricAvailability: {
    persistedMetrics: string[];
    providerMetricsUnavailable: boolean;
    note: string;
  };
  campaigns: Array<{
    campaign: {
      id: string;
      name: string;
      status: string;
      objective: string;
    };
    attributionCount: number;
    conversionCount: number;
    metrics: Array<{
      id: string;
      metric: string;
      value: number;
      currency: string | null;
      capturedAt: string | Date;
    }>;
  }>;
  attributions: Array<{
    id: string;
    campaignName: string | null;
    eventType: string;
    value: number | null;
    currency: string | null;
    occurredAt: string | Date;
  }>;
  metrics: Array<{
    id: string;
    campaignId: string | null;
    metric: string;
    value: number;
    currency: string | null;
    capturedAt: string | Date;
  }>;
  socialAccounts: Array<{
    id: string;
    provider: string;
    displayName: string;
    status: string;
  }>;
};

function number(value: number) {
  return new Intl.NumberFormat().format(value);
}

function money(value: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${number(value)}`;
  }
}

function date(value: string | Date) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function SummaryCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
        {label}
      </p>
      <p className="mt-3 text-3xl font-black tracking-tight text-white">
        {value}
      </p>
      <p className="mt-2 text-xs leading-5 text-slate-400">{detail}</p>
    </div>
  );
}

export default function MarketingAnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = useCallback(async () => {
    await Promise.resolve();

    setLoading(true);
    setError("");

    try {
      const query = new URLSearchParams();

      if (from) query.set("from", `${from}T00:00:00.000Z`);
      if (to) query.set("to", `${to}T23:59:59.999Z`);

      const suffix = query.toString() ? `?${query.toString()}` : "";
      const response = await fetch(`/api/marketing/analytics${suffix}`, {
        cache: "no-store",
      });

      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error || "Unable to load Marketing analytics.");
      }

      setData(body);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to load Marketing analytics.",
      );
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [load]);

  return (
    <main className="min-h-screen bg-[#07111f] text-white">
      <div className="mx-auto max-w-[1500px] px-4 py-7 sm:px-6 lg:px-8">
        <div className="rounded-[28px] border border-white/10 bg-gradient-to-br from-[#0c1c31] to-[#08131f] p-6 shadow-2xl sm:p-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-300">
                Kuba Marketing
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                Analytics & Attribution
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
                Performance intelligence from persisted Marketing records.
                Missing provider metrics are shown as unavailable rather than
                estimated or fabricated.
              </p>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <label className="text-xs font-semibold text-slate-400">
                From
                <input
                  type="date"
                  value={from}
                  onChange={(event) => setFrom(event.target.value)}
                  className="mt-1 block rounded-xl border border-white/10 bg-[#091727] px-3 py-2 text-sm text-white"
                />
              </label>

              <label className="text-xs font-semibold text-slate-400">
                To
                <input
                  type="date"
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                  className="mt-1 block rounded-xl border border-white/10 bg-[#091727] px-3 py-2 text-sm text-white"
                />
              </label>

              <button
                type="button"
                onClick={() => void load()}
                className="rounded-xl bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-950"
              >
                Refresh
              </button>

              {(from || to) && (
                <button
                  type="button"
                  onClick={() => {
                    setFrom("");
                    setTo("");
                  }}
                  className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-300"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {loading && (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-sm text-slate-400">
            Loading persisted Marketing analytics…
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-400/10 p-5 text-sm text-red-200">
            {error}
          </div>
        )}

        {!loading && !error && data && (
          <>
            <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard
                label="Campaigns"
                value={number(data.summary.campaigns)}
                detail="Persisted campaigns in this workspace."
              />
              <SummaryCard
                label="Conversions"
                value={number(data.summary.conversions)}
                detail="Persisted attribution events marked conversion."
              />
              <SummaryCard
                label="Attributed leads"
                value={number(data.summary.attributedLeads)}
                detail="Distinct persisted lead relationships."
              />
              <SummaryCard
                label="Attributed deals"
                value={number(data.summary.attributedDeals)}
                detail="Distinct persisted CRM deal relationships."
              />
              <SummaryCard
                label="Attribution events"
                value={number(data.summary.attributionEvents)}
                detail="All persisted attribution events in this period."
              />
              <SummaryCard
                label="Attributed customers"
                value={number(data.summary.attributedCustomers)}
                detail="Distinct persisted customer relationships."
              />
              <SummaryCard
                label="Publishing jobs"
                value={number(data.summary.publishJobs)}
                detail="Publishing operations recorded in this period."
              />
              <SummaryCard
                label="Connected accounts"
                value={number(data.summary.connectedAccounts)}
                detail="Persisted Marketing channel connections."
              />
            </section>

            <section className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
              <div className="rounded-[24px] border border-white/10 bg-white/[0.035] p-5 sm:p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold">Campaign performance</h2>
                    <p className="mt-1 text-xs text-slate-400">
                      Attribution and metrics backed by persisted records.
                    </p>
                  </div>
                </div>

                <div className="mt-5 overflow-x-auto">
                  <table className="w-full min-w-[700px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-slate-500">
                        <th className="pb-3 pr-4">Campaign</th>
                        <th className="pb-3 pr-4">Status</th>
                        <th className="pb-3 pr-4">Attributions</th>
                        <th className="pb-3 pr-4">Conversions</th>
                        <th className="pb-3">Persisted metrics</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.campaigns.map((item) => (
                        <tr
                          key={item.campaign.id}
                          className="border-b border-white/[0.06]"
                        >
                          <td className="py-4 pr-4">
                            <p className="font-semibold text-white">
                              {item.campaign.name}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {item.campaign.objective}
                            </p>
                          </td>
                          <td className="py-4 pr-4 text-slate-300">
                            {item.campaign.status}
                          </td>
                          <td className="py-4 pr-4 font-semibold">
                            {number(item.attributionCount)}
                          </td>
                          <td className="py-4 pr-4 font-semibold">
                            {number(item.conversionCount)}
                          </td>
                          <td className="py-4 text-slate-300">
                            {item.metrics.length
                              ? item.metrics
                                  .map(
                                    (metric) =>
                                      `${metric.metric}: ${number(metric.value)}`,
                                  )
                                  .join(" · ")
                              : "No persisted metrics"}
                          </td>
                        </tr>
                      ))}

                      {data.campaigns.length === 0 && (
                        <tr>
                          <td
                            colSpan={5}
                            className="py-10 text-center text-slate-500"
                          >
                            No Marketing campaigns are available.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-6">
                <div className="rounded-[24px] border border-white/10 bg-white/[0.035] p-5 sm:p-6">
                  <h2 className="text-lg font-bold">Attributed value</h2>
                  <p className="mt-1 text-xs text-slate-400">
                    Values remain separated by their persisted currency.
                  </p>

                  <div className="mt-5 space-y-3">
                    {Object.entries(data.currencyTotals).map(
                      ([currency, value]) => (
                        <div
                          key={currency}
                          className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-black/10 px-4 py-3"
                        >
                          <span className="text-sm font-semibold text-slate-300">
                            {currency}
                          </span>
                          <span className="font-bold">
                            {money(value, currency)}
                          </span>
                        </div>
                      ),
                    )}

                    {Object.keys(data.currencyTotals).length === 0 && (
                      <p className="text-sm text-slate-500">
                        No persisted monetary attribution is available.
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/10 bg-white/[0.035] p-5 sm:p-6">
                  <h2 className="text-lg font-bold">Metric availability</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    {data.metricAvailability.note}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {data.metricAvailability.persistedMetrics.map((metric) => (
                      <span
                        key={metric}
                        className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-200"
                      >
                        {metric}
                      </span>
                    ))}

                    {data.metricAvailability.persistedMetrics.length === 0 && (
                      <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs font-semibold text-amber-200">
                        Provider metrics unavailable
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <section className="mt-6 grid gap-6 xl:grid-cols-2">
              <div className="rounded-[24px] border border-white/10 bg-white/[0.035] p-5 sm:p-6">
                <h2 className="text-lg font-bold">Recent attribution</h2>
                <div className="mt-5 space-y-3">
                  {data.attributions.slice(0, 10).map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-white/[0.07] bg-black/10 p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold">
                            {item.campaignName || "Campaign"}
                          </p>
                          <p className="mt-1 text-xs uppercase tracking-wide text-cyan-300">
                            {item.eventType}
                          </p>
                        </div>
                        <div className="text-right">
                          {item.value !== null && item.currency && (
                            <p className="font-bold">
                              {money(item.value, item.currency)}
                            </p>
                          )}
                          <p className="mt-1 text-xs text-slate-500">
                            {date(item.occurredAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}

                  {data.attributions.length === 0 && (
                    <p className="text-sm text-slate-500">
                      No persisted attribution events in this period.
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-[24px] border border-white/10 bg-white/[0.035] p-5 sm:p-6">
                <h2 className="text-lg font-bold">Channel readiness</h2>
                <p className="mt-1 text-xs text-slate-400">
                  Based only on persisted Marketing social-account records.
                </p>

                <div className="mt-5 space-y-3">
                  {data.socialAccounts.map((account) => (
                    <div
                      key={account.id}
                      className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-black/10 px-4 py-3"
                    >
                      <div>
                        <p className="font-semibold">{account.displayName}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {account.provider}
                        </p>
                      </div>
                      <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-slate-300">
                        {account.status}
                      </span>
                    </div>
                  ))}

                  {data.socialAccounts.length === 0 && (
                    <p className="text-sm text-slate-500">
                      No Marketing channel accounts are connected.
                    </p>
                  )}
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
