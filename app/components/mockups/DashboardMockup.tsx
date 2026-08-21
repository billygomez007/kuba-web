"use client";

import {
  Bot,
  MessageSquare,
  Phone,
  TrendingUp,
  Users,
} from "lucide-react";


export default function DashboardMockup() {

  return (

    <div className="relative mx-auto mt-16 max-w-6xl">

      <div className="absolute inset-0 -z-10 rounded-3xl bg-gradient-to-r from-violet-600/20 via-fuchsia-500/20 to-cyan-400/20 blur-3xl" />


      <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#0b0b12] shadow-2xl">


        {/* Dashboard Header */}

        <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">

          <div>
            <p className="text-sm text-white/50">
              Kuba AI Workforce Platform
            </p>

            <h3 className="mt-1 text-xl font-bold">
              Business Command Center
            </h3>
          </div>


          <div className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-300">

            <span className="h-2 w-2 rounded-full bg-emerald-400" />

            All Systems Active

          </div>

        </div>



        {/* Dashboard Body */}

        <div className="grid gap-6 p-6 lg:grid-cols-3">


          {/* AI Employees */}

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 lg:col-span-2">

            <div className="flex items-center justify-between">

              <h4 className="font-bold">
                AI Employees
              </h4>

              <Bot className="h-5 w-5 text-violet-300" />

            </div>


            <div className="mt-5 grid gap-4 sm:grid-cols-2">


              {[
                ["Receptionist AI", "245 conversations"],
                ["Sales AI", "34 qualified leads"],
                ["Support AI", "98 resolved issues"],
                ["Marketing AI", "Campaign running"],
              ].map(([name, activity]) => (

                <div
                  key={name}
                  className="rounded-xl border border-white/10 bg-black/20 p-4"
                >

                  <div className="flex items-center gap-3">

                    <div className="rounded-lg bg-white/10 p-2">
                      <Bot className="h-4 w-4" />
                    </div>

                    <div>
                      <p className="text-sm font-semibold">
                        {name}
                      </p>

                      <p className="text-xs text-white/40">
                        {activity}
                      </p>
                    </div>

                  </div>

                </div>

              ))}


            </div>


          </div>



          {/* Performance */}

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">

            <h4 className="font-bold">
              Performance
            </h4>


            <div className="mt-5 space-y-5">


              <div className="flex items-center justify-between">
                <span className="text-sm text-white/50">
                  Response Time
                </span>

                <strong>
                  1.2 sec
                </strong>
              </div>


              <div className="flex items-center justify-between">
                <span className="text-sm text-white/50">
                  Customers Served
                </span>

                <strong>
                  2,450
                </strong>
              </div>


              <div className="flex items-center justify-between">
                <span className="text-sm text-white/50">
                  Conversion
                </span>

                <strong className="text-emerald-300">
                  +32%
                </strong>
              </div>


            </div>


          </div>


        </div>



        {/* Communication Bar */}

        <div className="grid gap-4 border-t border-white/10 p-6 sm:grid-cols-4">


          {[
            ["Website", MessageSquare],
            ["WhatsApp", MessageSquare],
            ["Voice", Phone],
            ["Leads", TrendingUp],
          ].map(([label, Icon]) => (

            <div
              key={label as string}
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4"
            >

              <Icon className="h-5 w-5 text-cyan-300" />

              <span className="text-sm text-white/70">
                {label as string}
              </span>

            </div>

          ))}


        </div>


      </div>

    </div>

  );

}
