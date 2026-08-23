"use client";

import { useEffect, useState } from "react";

type Lead = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  service: string | null;
  source: string | null;
  stage: string;
  assignedEmployeeId: string | null;
  createdAt: string;
};

type SalesData = {
  leads: Lead[];
  followUps: unknown[];
  activities: unknown[];
};

export default function SalesPage() {
  const [data, setData] = useState<SalesData>({
    leads: [],
    followUps: [],
    activities: [],
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadSales() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/leads");

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Unable to load sales data.",
        );
      }

      setData({
        leads: result.leads || [],
        followUps: result.followUps || [],
        activities: result.activities || [],
      });
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to load sales data.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSales();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  return (
    <main className="min-h-screen bg-[#050507] px-6 py-10 text-white lg:ml-[250px]">
      <div className="mx-auto max-w-7xl">

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300/60">
              Sales
            </p>

            <h1 className="mt-2 text-3xl font-black">
              Sales Workspace
            </h1>

            <p className="mt-2 text-sm text-white/35">
              Manage leads, follow-ups, and sales activity.
            </p>
          </div>

          <button
            type="button"
            onClick={loadSales}
            className="rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-semibold hover:bg-white/[0.08]"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="mt-10 rounded-3xl border border-white/10 bg-white/[0.02] p-10 text-center text-sm text-white/35">
            Loading sales workspace...
          </div>
        ) : error ? (
          <div className="mt-10 rounded-3xl border border-red-400/20 bg-red-400/[0.05] p-10 text-center">
            <p className="text-sm font-semibold text-red-300">
              {error}
            </p>
          </div>
        ) : (
          <>
            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              <StatCard
                label="Total Leads"
                value={data.leads.length}
              />

              <StatCard
                label="Follow-ups"
                value={data.followUps.length}
              />

              <StatCard
                label="Activities"
                value={data.activities.length}
              />
            </div>

            <section className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02]">
              <div className="border-b border-white/10 px-6 py-5">
                <h2 className="text-lg font-bold">
                  Leads
                </h2>

                <p className="mt-1 text-xs text-white/30">
                  Leads currently associated with your business.
                </p>
              </div>

              {data.leads.length === 0 ? (
                <div className="p-10 text-center text-sm text-white/30">
                  No leads yet.
                </div>
              ) : (
                <div className="divide-y divide-white/10">
                  {data.leads.map((lead) => (
                    <div
                      key={lead.id}
                      className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-bold">
                          {lead.name || "Unnamed lead"}
                        </p>

                        <p className="mt-1 text-xs text-white/30">
                          {lead.email || lead.phone || "No contact details"}
                        </p>

                        <p className="mt-2 text-xs text-white/25">
                          {lead.service || "No service specified"}
                          {" · "}
                          {lead.source || "Unknown source"}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white/45">
                          {lead.stage}
                        </span>

                        <span
                          className={`rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider ${
                            lead.assignedEmployeeId
                              ? "border-cyan-400/20 bg-cyan-400/[0.05] text-cyan-300"
                              : "border-white/10 bg-white/[0.03] text-white/30"
                          }`}
                        >
                          {lead.assignedEmployeeId
                            ? "Assigned"
                            : "Unassigned"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/25">
        {label}
      </p>

      <p className="mt-3 text-3xl font-black">
        {value}
      </p>
    </div>
  );
}
