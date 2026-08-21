"use client";

import Link from "next/link";
import {
  Bot,
  BrainCircuit,
  GraduationCap,
  Sparkles,
  TrendingUp,
  Users,
  CheckCircle,
  Activity,
} from "lucide-react";


export default function AIWorkforcePage() {


  const modules = [
    {
      title: "AI Employees",
      description: "Create, manage and monitor your AI workers.",
      href: "/dashboard/workforce",
      icon: Bot,
    },
    {
      title: "Skills Marketplace",
      description: "Discover and assign new capabilities to AI employees.",
      href: "/dashboard/skills",
      icon: Sparkles,
    },
    {
      title: "Knowledge",
      description: "Connect business knowledge and information sources.",
      href: "/dashboard/knowledge",
      icon: BrainCircuit,
    },
    {
      title: "Training",
      description: "Improve AI employee performance and behaviour.",
      href: "/dashboard/training",
      icon: GraduationCap,
    },
  ];


  const employees = [
    {
      name: "Receptionist AI",
      status: "Handling customer enquiries",
      activity: "342 conversations today",
    },
    {
      name: "Sales AI",
      status: "Qualifying leads",
      activity: "86 opportunities created",
    },
    {
      name: "Support AI",
      status: "Resolving customer issues",
      activity: "94% resolution rate",
    },
    {
      name: "Finance AI",
      status: "Reviewing invoices",
      activity: "12 tasks pending",
    },
  ];


  const insights = [
    "Train Receptionist AI with new customer FAQs",
    "Add WhatsApp skill to Sales AI",
    "Review 5 unresolved conversations",
  ];


  return (

    <main className="p-8">


      <h1 className="text-4xl font-black">
        AI Workforce
      </h1>


      <p className="mt-3 text-white/50">
        Build, train and manage intelligent AI employees that work for your business.
      </p>



      {/* MODULES */}

      <div className="mt-10 grid gap-5 md:grid-cols-4">

        {modules.map((item) => {

          const Icon = item.icon;

          return (

            <Link
              key={item.title}
              href={item.href}
              className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 transition hover:-translate-y-1 hover:border-white/20"
            >

              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
                <Icon className="h-6 w-6 text-violet-300" />
              </div>


              <h2 className="mt-5 text-xl font-bold">
                {item.title}
              </h2>


              <p className="mt-3 text-sm text-white/50">
                {item.description}
              </p>


            </Link>

          );

        })}

      </div>




      {/* WORKFORCE STATS */}

      <div className="mt-10 grid gap-5 md:grid-cols-4">

        {[
          ["12", "AI Employees Active"],
          ["8,420", "Tasks Completed"],
          ["3,240", "Customer Conversations"],
          ["96%", "Performance Score"],
        ].map(([value,label]) => (

          <div
            key={label}
            className="rounded-3xl border border-white/10 bg-white/[0.04] p-6"
          >

            <p className="text-3xl font-black">
              {value}
            </p>

            <p className="mt-2 text-sm text-white/50">
              {label}
            </p>

          </div>

        ))}

      </div>





      {/* LOWER WORKSPACE */}

      <div className="mt-10 grid gap-6 lg:grid-cols-2">


        {/* ACTIVE EMPLOYEES */}

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">


          <div className="flex items-center gap-3">

            <Users className="h-5 w-5 text-cyan-300" />

            <h2 className="text-xl font-bold">
              Active AI Employees
            </h2>

          </div>


          <div className="mt-6 space-y-4">


            {employees.map((employee) => (

              <div
                key={employee.name}
                className="rounded-2xl border border-white/10 bg-black/20 p-4"
              >

                <div className="flex items-center justify-between">

                  <p className="font-bold">
                    {employee.name}
                  </p>

                  <span className="h-2 w-2 rounded-full bg-emerald-400" />

                </div>


                <p className="mt-2 text-sm text-white/50">
                  {employee.status}
                </p>


                <p className="mt-2 text-xs text-white/40">
                  {employee.activity}
                </p>


              </div>

            ))}


          </div>


        </div>





        {/* AI INSIGHTS */}

        <div className="rounded-3xl border border-violet-400/20 bg-violet-400/[0.05] p-6">


          <div className="flex items-center gap-3">

            <Activity className="h-5 w-5 text-violet-300" />

            <h2 className="text-xl font-bold">
              Kuba AI Insights
            </h2>

          </div>


          <p className="mt-5 text-white/60">
            AI recommendations to improve your workforce.
          </p>


          <div className="mt-6 space-y-4">

            {insights.map((item) => (

              <div
                key={item}
                className="flex gap-3 rounded-xl border border-white/10 bg-black/20 p-4 text-sm"
              >

                <CheckCircle className="h-4 w-4 text-emerald-400 mt-0.5" />

                {item}

              </div>

            ))}


          </div>



          <div className="mt-8 rounded-2xl border border-white/10 bg-black/20 p-5">

            <div className="flex items-center gap-2">

              <TrendingUp className="h-5 w-5 text-cyan-300" />

              <span className="font-bold">
                Workforce Growth
              </span>

            </div>


            <p className="mt-3 text-sm text-white/50">
              Your AI workforce efficiency increased by 18% this month.
            </p>


          </div>


        </div>



      </div>


    </main>

  );
}
