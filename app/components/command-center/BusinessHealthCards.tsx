"use client";

import { useEffect, useState } from "react";

type Overview = {
  employees: number;
  customers: number;
  conversations: number;
  salesPipeline: {
    total: number;
    stages: {
      new: number;
      contacted: number;
      qualified: number;
      converted: number;
    };
  };
  followUps: {
    total: number;
    overdue: number;
    assignedToKuba: number;
    pending: number;
  };
};


export default function BusinessHealthCards() {

  const [overview, setOverview] =
    useState<Overview | null>(null);


  useEffect(() => {

    async function loadOverview() {

      try {

        const response = await fetch(
          "/api/command-center/overview",
          {
            cache: "no-store",
          },
        );


        if (!response.ok) {
          throw new Error("Unable to load overview");
        }


        const data = await response.json();

        setOverview(data);


      } catch (error) {

        console.error(
          "Business overview error:",
          error,
        );

      }

    }


    loadOverview();

  }, []);



  const cards = [

    {
      title: "Revenue Pipeline",
      value: overview
        ? overview.salesPipeline.total
        : "...",
      description:
        "Active opportunities driving future revenue.",
      insight:
        overview
          ? `${overview.salesPipeline.stages.qualified} qualified opportunities`
          : "Analyzing sales activity",
      icon: "↗",
    },


    {
      title: "Customers",
      value: overview
        ? overview.customers
        : "...",
      description:
        "Customers connected with your business.",
      insight:
        "Customer relationships monitored by Kuba AI",
      icon: "◎",
    },


    {
      title: "AI Workforce",
      value: overview
        ? overview.employees
        : "...",
      description:
        "AI employees currently active.",
      insight:
        "Digital workers operating across departments",
      icon: "✦",
    },


    {
      title: "Customer Activity",
      value: overview
        ? overview.conversations
        : "...",
      description:
        "Conversations handled by Kuba.",
      insight:
        "Real-time customer interactions",
      icon: "◌",
    },


    {
      title: "Attention Required",
      value: overview
        ? overview.followUps.overdue
        : "...",
      description:
        "Actions requiring executive attention.",
      insight:
        overview
          ? `${overview.followUps.pending} pending actions`
          : "Checking priorities",
      icon: "⚠",
    },

  ];



  return (
    <section>

      <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-300/70">
        Business Intelligence Hub
      </p>

      <h2 className="mt-3 text-3xl font-black tracking-[-0.03em]">
        Your Company At A Glance
      </h2>

      <p className="mt-4 max-w-2xl text-sm leading-6 text-white/40">
        Real-time metrics from your AI workforce and business operations. 
        Kuba continuously monitors performance and highlights what needs immediate attention.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">

        {cards.map((card, index) => {
          const accentColors = [
            "from-cyan-500/20 to-blue-500/10",
            "from-violet-500/20 to-purple-500/10",
            "from-emerald-500/20 to-green-500/10",
            "from-fuchsia-500/20 to-pink-500/10",
            "from-orange-500/20 to-red-500/10",
          ];

          return (
            <div
              key={card.title}
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.02] p-6 transition duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-gradient-to-br hover:from-white/[0.06] hover:to-white/[0.03]"
            >
              {/* Background Accent */}
              <div className={`absolute inset-0 bg-gradient-to-br ${accentColors[index % 5]} opacity-0 transition group-hover:opacity-100`} />

              <div className="relative z-10">
                <div className="flex items-center justify-between">
                  <span className="text-2xl">
                    {card.icon}
                  </span>

                  <span className="flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                    <span className="h-1 w-1 animate-pulse rounded-full bg-emerald-400" />
                    Live
                  </span>
                </div>

                <p className="mt-5 text-2xl font-black text-white">
                  {card.value}
                </p>

                <h3 className="mt-2 text-sm font-bold text-white/90">
                  {card.title}
                </h3>

                <p className="mt-1 text-xs leading-5 text-white/50">
                  {card.description}
                </p>

                <div className="mt-4 rounded-lg border border-white/[0.06] bg-white/[0.03] p-2.5">
                  <p className="text-xs font-medium text-white/60">
                    {card.insight}
                  </p>
                </div>
              </div>
            </div>
          );
        })}

      </div>

    </section>
  );
}
