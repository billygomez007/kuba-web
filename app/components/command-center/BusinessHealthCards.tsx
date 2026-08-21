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

    <section className="mt-8">

      <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-300/60">
        Executive Business Pulse
      </p>


      <h2 className="mt-2 text-3xl font-black">
        Your Company At A Glance
      </h2>


      <p className="mt-3 max-w-2xl text-sm text-white/40">
        Kuba AI continuously monitors your business performance
        and highlights what needs your attention.
      </p>



      <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-5">


        {cards.map((card) => (

          <div
            key={card.title}
            className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 transition hover:border-cyan-400/30"
          >


            <div className="flex items-center justify-between">

              <span className="text-xl text-cyan-300">
                {card.icon}
              </span>


              <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-emerald-400">

                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />

                Live

              </span>

            </div>



            <p className="mt-6 text-3xl font-black">
              {card.value}
            </p>



            <h3 className="mt-2 font-bold">
              {card.title}
            </h3>



            <p className="mt-2 text-xs leading-5 text-white/40">
              {card.description}
            </p>



            <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-3">

              <p className="text-xs text-white/60">
                {card.insight}
              </p>

            </div>



          </div>

        ))}


      </div>

    </section>

  );
}
