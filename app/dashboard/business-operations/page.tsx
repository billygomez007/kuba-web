"use client";

import Link from "next/link";
import {
  CheckCircle,
  FileText,
  Receipt,
  Calculator,
  ListTodo,
  Bot,
  TrendingUp,
  AlertCircle,
} from "lucide-react";


export default function BusinessOperationsPage() {


  const modules = [
    {
      title: "Tasks",
      description: "Manage business activities and AI-generated tasks.",
      href: "/dashboard/tasks",
      icon: ListTodo,
    },
    {
      title: "Finance",
      description: "Manage financial operations and business records.",
      href: "/dashboard/finance",
      icon: TrendingUp,
    },
    {
      title: "Tax",
      description: "Manage tax reporting and compliance.",
      href: "/dashboard/tax",
      icon: Calculator,
    },
    {
      title: "Invoices",
      description: "Create and manage business invoices.",
      href: "/dashboard/invoices",
      icon: Receipt,
    },
  ];


  const activities = [
    {
      title: "Invoice generated",
      detail: "Invoice #1042 created for ABC Ltd.",
      time: "5 minutes ago",
    },
    {
      title: "Tax document reviewed",
      detail: "VAT records checked by Finance AI.",
      time: "25 minutes ago",
    },
    {
      title: "Task completed",
      detail: "Customer follow-up completed.",
      time: "1 hour ago",
    },
  ];


  return (

    <main className="p-8">


      <h1 className="text-4xl font-black">
        Business Operations
      </h1>

      <p className="mt-3 text-white/50">
        Manage finance, tax, tasks and operational workflows.
      </p>



      {/* MODULE CARDS */}

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




      {/* BUSINESS METRICS */}

      <div className="mt-10 grid gap-5 md:grid-cols-4">


        {[
          ["128", "Tasks Today"],
          ["94%", "Completion Rate"],
          ["GHS 245K", "Revenue"],
          ["24", "AI Automations"],
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


        {/* ACTIVITY */}

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">


          <div className="flex items-center gap-3">

            <FileText className="h-5 w-5 text-cyan-300" />

            <h2 className="text-xl font-bold">
              Recent Operations
            </h2>

          </div>


          <div className="mt-6 space-y-4">


            {activities.map((item) => (

              <div
                key={item.title}
                className="rounded-2xl border border-white/10 bg-black/20 p-4"
              >

                <p className="font-semibold">
                  {item.title}
                </p>

                <p className="mt-1 text-sm text-white/50">
                  {item.detail}
                </p>

                <p className="mt-3 text-xs text-white/40">
                  {item.time}
                </p>

              </div>

            ))}


          </div>


        </div>




        {/* AI ASSISTANT */}

        <div className="rounded-3xl border border-cyan-400/20 bg-cyan-400/[0.05] p-6">


          <div className="flex items-center gap-3">

            <Bot className="h-5 w-5 text-cyan-300" />

            <h2 className="text-xl font-bold">
              AI Operations Assistant
            </h2>

          </div>


          <p className="mt-5 text-white/60">
            Kuba AI is monitoring your business operations.
          </p>


          <div className="mt-6 space-y-4">


            {[
              "3 invoices require review",
              "VAT deadline approaching in 14 days",
              "8 pending business approvals",
            ].map((item) => (

              <div
                key={item}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-3 text-sm"
              >

                <AlertCircle className="h-4 w-4 text-yellow-300" />

                {item}

              </div>

            ))}


          </div>


        </div>


      </div>


    </main>

  );
}
