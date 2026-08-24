"use client";

import { useEffect, useState } from "react";
import AIActivitySummary from "./AIActivitySummary";
import AIEmployeeCard from "./AIEmployeeCard";

type Employee = {
  id: string;
  name: string;
  type: string;
  status: string;
};

type Activity = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  createdAt: string | number | Date;
};

type WorkforceData = {
  totalEmployees: number;
  activeEmployees: number;
  conversationsToday: number;
  tasksCompletedToday: number;
  pendingApprovals: number;
  employees: Employee[];
  activities: Activity[];
};

export default function AIWorkforceOverview() {
  const [data, setData] = useState<WorkforceData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadWorkforce() {
      try {
        const response = await fetch("/api/command-center/overview", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Unable to load AI workforce.");
        }

        const result = (await response.json()) as {
          workforce?: WorkforceData;
        };

        if (!cancelled) {
          setData(result.workforce ?? null);
        }
      } catch {
        if (!cancelled) {
          setError(true);
        }
      }
    }

    void loadWorkforce();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-6 sm:p-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-300/70">
            AI Workforce
          </p>
          <h2 className="mt-3 text-2xl font-black tracking-[-0.03em]">
            Your digital team at work
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/40">
            Live visibility into the employees, conversations, and work powering your business today.
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-bold text-emerald-300">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
          Live data
        </span>
      </div>

      {error ? (
        <div className="mt-6 rounded-2xl border border-red-400/15 bg-red-400/[0.05] p-5 text-sm text-red-200">
          AI workforce data is temporarily unavailable.
        </div>
      ) : (
        <>
          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["Total employees", data?.totalEmployees ?? "..."],
              ["Active employees", data?.activeEmployees ?? "..."],
              ["Conversations today", data?.conversationsToday ?? "..."],
              ["Tasks completed", data?.tasksCompletedToday ?? "..."],
              ["Pending approvals", data?.pendingApprovals ?? "..."],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/[0.07] bg-black/20 p-4">
                <p className="text-xs leading-5 text-white/35">{label}</p>
                <p className="mt-2 text-2xl font-black text-white">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-7 grid gap-7 xl:grid-cols-[1.1fr_0.9fr]">
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-bold text-white/80">AI employees</h3>
                <span className="text-xs text-white/30">{data?.activeEmployees ?? "..."} active</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {data?.employees.length ? (
                  data.employees.map((employee) => (
                    <AIEmployeeCard key={employee.id} employee={employee} />
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 p-5 text-sm text-white/35 sm:col-span-2">
                    Activate an AI employee to start building your digital team.
                  </div>
                )}
              </div>
            </div>
            <div>
              <h3 className="mb-3 text-sm font-bold text-white/80">Recent activity</h3>
              <AIActivitySummary activities={data?.activities ?? []} />
            </div>
          </div>
        </>
      )}
    </section>
  );
}
