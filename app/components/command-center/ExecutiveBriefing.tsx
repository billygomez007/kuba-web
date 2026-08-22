"use client";

import { useEffect, useState } from "react";

type Briefing = {
  headline: string;
  summary: string;
  metrics: {
    employees: number;
    sales: number;
    customers: number;
    followUps: number;
  };
  priorities: string[];
};


export default function ExecutiveBriefing() {

  const [briefing, setBriefing] =
    useState<Briefing | null>(null);


  useEffect(() => {

    async function loadBriefing() {

      try {

        const response =
          await fetch(
            "/api/command-center/briefing",
            {
              cache: "no-store",
            },
          );


        if (!response.ok) {
          throw new Error(
            "Unable to load briefing",
          );
        }


        const data =
          await response.json();


        setBriefing(data);


      } catch (error) {

        console.error(
          "Briefing error:",
          error,
        );

      }

    }


    loadBriefing();

  }, []);


  return (

    <section className="mt-8 rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-500/[0.08] via-white/[0.04] to-violet-500/[0.08] p-6">

      <div className="flex items-center justify-between">

        <div>
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-300/70">
            Kuba Executive Briefing
          </p>

          <h2 className="mt-3 text-2xl font-black">
            Your business intelligence update
          </h2>
        </div>


        <div className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5">

          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />

          <span className="text-xs font-bold text-emerald-300">
            Live Analysis
          </span>

        </div>

      </div>


      <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-6">

        <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/30">
          Kuba&apos;s Assessment
        </p>


        <p className="mt-4 whitespace-pre-line text-sm leading-8 text-white/75">
          {briefing?.headline ||
            "Kuba is analyzing your business activity."}
          
          {"\n\n"}

          {briefing?.summary ||
            "Business intelligence is being prepared."}
        </p>

      </div>


      <div className="mt-5 flex flex-col gap-3 sm:flex-row">

        <button
          className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-black transition hover:bg-white/90"
        >
          Review Priorities
        </button>


        <button
          className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-bold text-white/70 transition hover:bg-white/[0.08]"
        >
          Ask Kuba
        </button>

      </div>


      {briefing?.metrics && (
        <div className="mt-5 grid gap-3 sm:grid-cols-4">

          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <p className="text-xs text-white/40">AI Employees</p>
            <p className="mt-2 text-2xl font-black">
              {briefing.metrics.employees}
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <p className="text-xs text-white/40">Sales</p>
            <p className="mt-2 text-2xl font-black">
              {briefing.metrics.sales}
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <p className="text-xs text-white/40">Customers</p>
            <p className="mt-2 text-2xl font-black">
              {briefing.metrics.customers}
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <p className="text-xs text-white/40">Follow-ups</p>
            <p className="mt-2 text-2xl font-black">
              {briefing.metrics.followUps}
            </p>
          </div>

        </div>
      )}


      {briefing?.priorities && briefing.priorities.length > 0 && (
        <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-5">

          <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/30">
            Kuba recommends
          </p>

          <ul className="mt-4 space-y-2 text-sm text-white/70">
            {briefing?.priorities?.map((item, index) => (
              <li key={index}>
                {index + 1}. {item}
              </li>
            ))}
          </ul>

        </div>
      )}


    </section>

  );

}
