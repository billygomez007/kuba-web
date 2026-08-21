"use client";

import Link from "next/link";
import {
  Users,
  MessageSquare,
  Ticket,
  Clock,
  TrendingUp,
  Bot,
  CheckCircle,
} from "lucide-react";


export default function CustomerOperationsPage() {


  const modules = [
    {
      title: "Customers",
      description: "Manage customer profiles and relationships.",
      href: "/dashboard/customers",
      icon: Users,
    },
    {
      title: "Messaging",
      description: "Manage conversations across all channels.",
      href: "/dashboard/messaging",
      icon: MessageSquare,
    },
    {
      title: "Tickets",
      description: "Track customer issues with AI-powered support.",
      href: "/dashboard/tickets",
      icon: Ticket,
    },
  ];


  const activities = [
    {
      customer: "Sarah Mensah",
      action: "Asked about pricing",
      agent: "Sales AI",
      time: "2 minutes ago",
    },
    {
      customer: "ABC Properties",
      action: "Support issue resolved",
      agent: "Support AI",
      time: "10 minutes ago",
    },
    {
      customer: "Kwame Trading",
      action: "New ticket created",
      agent: "Receptionist AI",
      time: "18 minutes ago",
    },
  ];


  return (

    <main className="p-8">


      <h1 className="text-4xl font-black">
        Customer Operations
      </h1>

      <p className="mt-3 text-white/50">
        Manage customers, conversations, tickets and AI-powered support.
      </p>



      {/* MODULE CARDS */}

      <div className="mt-10 grid gap-5 md:grid-cols-3">

        {modules.map((item) => {

          const Icon = item.icon;

          return (

            <Link
              key={item.title}
              href={item.href}
              className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 transition hover:-translate-y-1 hover:border-white/20"
            >

              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
                <Icon className="h-6 w-6 text-cyan-300" />
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



      {/* OPERATIONS OVERVIEW */}

      <div className="mt-10 grid gap-5 md:grid-cols-4">


        {[
          ["12,450", "Customers"],
          ["326", "Active Conversations"],
          ["42", "Open Tickets"],
          ["1.8 sec", "Response Time"],
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

            <Clock className="h-5 w-5 text-cyan-300" />

            <h2 className="text-xl font-bold">
              Recent Activity
            </h2>

          </div>


          <div className="mt-6 space-y-5">

            {activities.map((item) => (

              <div
                key={item.customer}
                className="rounded-2xl border border-white/10 bg-black/20 p-4"
              >

                <p className="font-semibold">
                  {item.customer}
                </p>

                <p className="mt-1 text-sm text-white/50">
                  {item.action}
                </p>

                <div className="mt-3 flex justify-between text-xs text-white/40">

                  <span>
                    {item.agent}
                  </span>

                  <span>
                    {item.time}
                  </span>

                </div>

              </div>

            ))}

          </div>

        </div>




        {/* AI ASSISTANT */}

        <div className="rounded-3xl border border-violet-400/20 bg-violet-400/[0.05] p-6">


          <div className="flex items-center gap-3">

            <Bot className="h-5 w-5 text-violet-300" />

            <h2 className="text-xl font-bold">
              AI Customer Assistant
            </h2>

          </div>


          <p className="mt-5 text-white/60">
            Kuba AI detected opportunities and recommended actions.
          </p>


          <div className="mt-6 space-y-4">


            {[
              "Follow up with 8 customers",
              "Escalate 3 priority tickets",
              "Schedule 5 customer callbacks",
            ].map((item) => (

              <div
                key={item}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-3 text-sm"
              >

                <CheckCircle className="h-4 w-4 text-emerald-400" />

                {item}

              </div>

            ))}


          </div>


        </div>



      </div>



    </main>

  );
}
