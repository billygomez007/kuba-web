"use client";

import {
  Bot,
  CheckCircle,
  MessageSquare,
  Zap,
} from "lucide-react";


export default function EmployeeWorkspaceMockup() {

  return (

    <div className="relative mx-auto mt-20 max-w-6xl">

      <div className="absolute inset-0 -z-10 rounded-full bg-violet-600/20 blur-[120px]" />


      <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#0b0b12] shadow-2xl">


        <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">

          <div>
            <p className="text-xs uppercase tracking-widest text-white/40">
              AI Employee Workspace
            </p>

            <h3 className="mt-2 text-2xl font-bold">
              Receptionist AI
            </h3>
          </div>


          <div className="flex items-center gap-2 rounded-full bg-emerald-400/10 px-4 py-2 text-sm text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Online
          </div>

        </div>



        <div className="grid gap-6 p-6 lg:grid-cols-3">


          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 lg:col-span-2">

            <div className="flex items-center gap-3">

              <MessageSquare className="h-5 w-5 text-cyan-300" />

              <h4 className="font-bold">
                Live Conversation
              </h4>

            </div>


            <div className="mt-6 space-y-4">


              <div className="rounded-xl bg-white/[0.05] p-4 text-sm text-white/70">
                Customer:
                <br />
                "Hello, I want to book an appointment."
              </div>


              <div className="rounded-xl border border-violet-400/20 bg-violet-400/10 p-4 text-sm text-white">
                Receptionist AI:
                <br />
                "I can help with that. What date would you prefer?"
              </div>


            </div>


          </div>



          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">

            <div className="flex items-center gap-3">

              <Bot className="h-5 w-5 text-violet-300" />

              <h4 className="font-bold">
                Tasks
              </h4>

            </div>


            <div className="mt-5 space-y-4">


              {[
                "Customer identified",
                "Appointment created",
                "Sales team notified",
              ].map((task) => (

                <div
                  key={task}
                  className="flex items-center gap-3 text-sm text-white/60"
                >

                  <CheckCircle className="h-4 w-4 text-emerald-400" />

                  {task}

                </div>

              ))}


            </div>


            <div className="mt-6 flex items-center gap-2 rounded-xl bg-white/[0.05] p-3 text-xs text-white/50">

              <Zap className="h-4 w-4 text-yellow-300" />

              Automated workflow completed

            </div>


          </div>


        </div>


      </div>


    </div>

  );

}
