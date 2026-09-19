"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Report = {
  generatedAt: string;
  summary: {
    campaigns: number;
    campaignsWithEvidence: number;
    attributionEvents: number;
    conversions: number;
    attributedLeads: number;
    attributedCustomers: number;
    attributedDeals: number;
    publishingJobs: number;
    connectedAccounts: number;
  };
  attributedValueByCurrency: Record<string, number>;
  campaigns: Array<{
    campaignId: string;
    campaignName: string;
    status: string;
    attributionEvents: number;
    conversions: number;
    persistedMetrics: Array<{
      metric: string;
      value: number;
      capturedAt: string;
    }>;
  }>;
  channels: Array<{
    provider: string;
    displayName: string | null;
    status: string;
  }>;
  metricAvailability: {
    persistedMetrics: string[];
    note: string;
  };
  evidencePolicy: {
    persistedOnly: boolean;
    attributedValueIsRevenue: boolean;
    providerMetricsInferred: boolean;
    note: string;
  };
};

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
        {label}
      </p>
      <p className="mt-3 text-3xl font-black text-cyan-100">{value}</p>
    </div>
  );
}

export default function MarketingExecutiveReport() {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  async function load() {
    setError("");

    const params = new URLSearchParams();

    if (from) params.set("from", from);
    if (to) params.set("to", to);

    const suffix = params.size ? `?${params.toString()}` : "";

    try {
      const response = await fetch(
        `/api/marketing/reports/executive${suffix}`,
        { cache: "no-store" },
      );

      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error || "Unable to load Marketing report.");
      }

      setReport(body);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to load Marketing report.",
      );
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timer);
    // Initial report intentionally loads once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currencyRows = report
    ? Object.entries(report.attributedValueByCurrency)
    : [];

  return (
    <main className="min-h-screen bg-[#05070b] px-5 py-8 text-white sm:px-8 lg:px-10 lg:py-12">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/dashboard/marketing/analytics"
          className="text-xs text-white/40 hover:text-cyan-300"
        >
          ← Marketing Analytics
        </Link>

        <div className="mt-6 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-300/70">
              Marketing Intelligence
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] sm:text-5xl">
              Executive Report
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/45">
              Evidence-backed Marketing performance from persisted SuperKuba
              records. Missing provider statistics are shown as unavailable,
              never estimated.
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-white/45">
              From
              <input
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                className="mt-1 block rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white"
              />
            </label>

            <label className="text-xs text-white/45">
              To
              <input
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                className="mt-1 block rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white"
              />
            </label>

            <button
              type="button"
              onClick={() => void load()}
              className="rounded-xl bg-cyan-300 px-4 py-2 text-sm font-bold text-black"
            >
              Generate report
            </button>
          </div>
        </div>

        {error && (
          <p className="mt-6 rounded-2xl border border-red-400/20 p-4 text-sm text-red-200">
            {error}
          </p>
        )}

        {report && (
          <>
            <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              <MetricCard label="Campaigns" value={report.summary.campaigns} />
              <MetricCard
                label="Campaigns with evidence"
                value={report.summary.campaignsWithEvidence}
              />
              <MetricCard
                label="Attribution events"
                value={report.summary.attributionEvents}
              />
              <MetricCard
                label="Conversions"
                value={report.summary.conversions}
              />
              <MetricCard
                label="Attributed leads"
                value={report.summary.attributedLeads}
              />
              <MetricCard
                label="Attributed customers"
                value={report.summary.attributedCustomers}
              />
              <MetricCard
                label="Attributed deals"
                value={report.summary.attributedDeals}
              />
              <MetricCard
                label="Publishing jobs"
                value={report.summary.publishingJobs}
              />
              <MetricCard
                label="Connected accounts"
                value={report.summary.connectedAccounts}
              />
            </section>

            <section className="mt-7 rounded-3xl border border-cyan-300/15 bg-cyan-300/[0.035] p-6">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">
                Evidence policy
              </p>
              <p className="mt-3 max-w-4xl text-sm leading-6 text-white/55">
                {report.evidencePolicy.note}
              </p>
            </section>

            <div className="mt-7 grid gap-6 lg:grid-cols-2">
              <section className="rounded-3xl border border-white/10 bg-white/[0.02] p-6">
                <h2 className="text-xl font-black">
                  Attributed value by currency
                </h2>
                <p className="mt-2 text-xs leading-5 text-white/35">
                  Attribution values are not accounting revenue and currencies
                  are never combined.
                </p>

                <div className="mt-5 space-y-3">
                  {currencyRows.length ? (
                    currencyRows.map(([currency, value]) => (
                      <div
                        key={currency}
                        className="flex items-center justify-between rounded-2xl border border-white/8 px-4 py-3"
                      >
                        <span className="font-bold">{currency}</span>
                        <span className="text-lg font-black text-cyan-100">
                          {value.toLocaleString()}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-white/35">
                      No persisted monetary attribution in this period.
                    </p>
                  )}
                </div>
              </section>

              <section className="rounded-3xl border border-white/10 bg-white/[0.02] p-6">
                <h2 className="text-xl font-black">Metric availability</h2>
                <p className="mt-2 text-xs leading-5 text-white/35">
                  {report.metricAvailability.note}
                </p>

                <div className="mt-5 flex flex-wrap gap-2">
                  {report.metricAvailability.persistedMetrics.length ? (
                    report.metricAvailability.persistedMetrics.map((metric) => (
                      <span
                        key={metric}
                        className="rounded-full border border-cyan-300/15 bg-cyan-300/[0.05] px-3 py-1 text-xs text-cyan-100"
                      >
                        {metric}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-white/35">
                      No provider/native metric snapshots persisted.
                    </span>
                  )}
                </div>
              </section>
            </div>

            <section className="mt-7 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02]">
              <div className="border-b border-white/10 p-6">
                <h2 className="text-xl font-black">Campaign performance</h2>
                <p className="mt-2 text-xs text-white/35">
                  Only evidence persisted for the selected business and period.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-[10px] uppercase tracking-wider text-white/30">
                    <tr>
                      <th className="px-6 py-4">Campaign</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Attributions</th>
                      <th className="px-6 py-4">Conversions</th>
                      <th className="px-6 py-4">Persisted metrics</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.campaigns.map((campaign) => (
                      <tr
                        key={campaign.campaignId}
                        className="border-t border-white/[0.06]"
                      >
                        <td className="px-6 py-4 font-semibold">
                          {campaign.campaignName}
                        </td>
                        <td className="px-6 py-4 text-white/50">
                          {campaign.status}
                        </td>
                        <td className="px-6 py-4">
                          {campaign.attributionEvents}
                        </td>
                        <td className="px-6 py-4">
                          {campaign.conversions}
                        </td>
                        <td className="px-6 py-4 text-white/50">
                          {campaign.persistedMetrics.length
                            ? campaign.persistedMetrics
                                .map(
                                  (metric) =>
                                    `${metric.metric}: ${metric.value}`,
                                )
                                .join(" · ")
                            : "Unavailable"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <p className="mt-5 text-xs text-white/25">
              Generated {new Date(report.generatedAt).toLocaleString()}
            </p>
          </>
        )}
      </div>
    </main>
  );
}
