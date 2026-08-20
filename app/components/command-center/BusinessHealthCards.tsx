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
          throw new Error(
            "Unable to load command center overview",
          );
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
      title: "Sales Pipeline",
      value:
        overview
          ? overview.salesPipeline.total
          : "...",
      description:
        "Active revenue opportunities",
      icon: "↗",
    },

    {
      title: "Customers",
      value:
        overview
          ? overview.customers
          : "...",
      description:
        "Customers connected to your business",
      icon: "◎",
    },

    {
      title: "AI Workforce",
      value:
        overview
          ? overview.employees
          : "...",
      description:
        "AI employees currently active",
      icon: "✦",
    },

    {
      title: "Conversations",
      value:
        overview
          ? overview.conversations
          : "...",
      description:
        "Customer conversations handled by Kuba",
      icon: "◌",
    },

    {
      title: "Attention Needed",
      value:
        overview
          ? overview.followUps.overdue
          : "...",
      description:
        "Overdue actions requiring attention",
      icon: "◈",
    },
  ];


  return (
    <section className="mt-8">

      <p className="text-xs font-bold uppercase tracking-[0.25em] text-white/30">
        Business Pulse
      </p>

      <h2 className="mt-2 text-2xl font-black">
        Your Business at a Glance
      </h2>


      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

        {cards.map((card) => (
          <div
            key={card.title}
            className="rounded-3xl border border-white/10 bg-white/[0.04] p-5"
          >

            <div className="flex justify-between">

              <span className="text-xl text-cyan-300">
                {card.icon}
              </span>

              <span className="text-xs uppercase text-white/30">
                Live
              </span>

            </div>


            <h3 className="mt-5 text-3xl font-black">
              {card.value}
            </h3>


            <p className="mt-2 text-sm font-semibold">
              {card.title}
            </p>


            <p className="mt-1 text-xs text-white/40">
              {card.description}
            </p>


            {card.title === "Sales Pipeline" &&
              overview && (
                <div className="mt-4 space-y-1 text-xs text-white/50">

                  <p>
                    New:
                    {" "}
                    {overview.salesPipeline.stages.new}
                  </p>

                  <p>
                    Contacted:
                    {" "}
                    {overview.salesPipeline.stages.contacted}
                  </p>

                  <p>
                    Qualified:
                    {" "}
                    {overview.salesPipeline.stages.qualified}
                  </p>

                  <p>
                    Converted:
                    {" "}
                    {overview.salesPipeline.stages.converted}
                  </p>

                </div>
              )}


            {card.title === "Attention Needed" &&
              overview && (
                <div className="mt-4 space-y-1 text-xs text-white/50">

                  <p>
                    Pending:
                    {" "}
                    {overview.followUps.pending}
                  </p>

                  <p>
                    Overdue:
                    {" "}
                    {overview.followUps.overdue}
                  </p>

                  <p>
                    Assigned to Kuba:
                    {" "}
                    {overview.followUps.assignedToKuba}
                  </p>

                </div>
              )}

          </div>
        ))}

      </div>

    </section>
  );
}
