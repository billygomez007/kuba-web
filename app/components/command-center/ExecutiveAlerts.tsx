"use client";

import { useEffect, useState } from "react";

type Alert = {
  level: string;
  title: string;
  description: string;
  icon: string;
};


export default function ExecutiveAlerts() {

  const [alerts, setAlerts] =
    useState<Alert[]>([]);


  useEffect(() => {

    async function loadAlerts() {

      try {

        const response =
          await fetch(
            "/api/command-center/alerts",
            {
              cache: "no-store",
            },
          );


        if (!response.ok) {
          throw new Error(
            "Unable to load alerts",
          );
        }


        const data =
          await response.json();


        setAlerts(
          data.alerts ?? [],
        );


      } catch(error) {

        console.error(
          "Alerts error:",
          error,
        );

      }

    }


    loadAlerts();

  }, []);


  return (

    <section className="mt-10">

      <p className="text-xs font-bold uppercase tracking-[0.25em] text-white/30">
        Executive Intelligence
      </p>


      <h2 className="mt-2 text-2xl font-black">
        Attention Required
      </h2>


      <p className="mt-2 text-sm text-white/40">
        Kuba monitors your business and highlights important actions.
      </p>


      <div className="mt-6 space-y-4">

        {alerts.length === 0 ? (

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 text-sm text-white/40">
            Kuba has no urgent issues to report right now.
          </div>

        ) : (

          alerts.map((alert) => (

            <div
              key={alert.title}
              className="flex gap-4 rounded-3xl border border-white/10 bg-white/[0.04] p-5"
            >

              <div className="text-xl">
                {alert.icon}
              </div>


              <div>

                <p className="text-sm font-bold">
                  {alert.level}
                </p>


                <h3 className="mt-1 font-semibold">
                  {alert.title}
                </h3>


                <p className="mt-1 text-sm text-white/40">
                  {alert.description}
                </p>

              </div>


            </div>

          ))

        )}

      </div>

    </section>

  );

}
