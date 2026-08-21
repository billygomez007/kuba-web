"use client";

import Link from "next/link";
import {
  Headphones,
  Phone,
  Rocket,
  Megaphone,
  Calculator,
  Users,
  ArrowRight,
} from "lucide-react";


const employees = [
  {
    name: "Receptionist AI",
    href: "/ai-employees",
    icon: Headphones,
    description:
      "Answers enquiries, manages conversations, and helps customers instantly.",
    activity: "245 conversations handled today",
  },
  {
    name: "Sales AI",
    href: "/ai-employees",
    icon: Rocket,
    description:
      "Captures leads, qualifies prospects, and supports your sales team.",
    activity: "34 qualified leads generated",
  },
  {
    name: "Support AI",
    href: "/ai-employees",
    icon: Phone,
    description:
      "Provides customer support and resolves routine questions 24/7.",
    activity: "98 issues resolved",
  },
  {
    name: "Marketing AI",
    href: "/ai-employees",
    icon: Megaphone,
    description:
      "Creates campaigns, content, and customer engagement workflows.",
    activity: "12 campaigns optimized",
  },
  {
    name: "Accountant AI",
    href: "/ai-employees",
    icon: Calculator,
    description:
      "Supports financial workflows and routine accounting operations.",
    activity: "Finance tasks automated",
  },
  {
    name: "HR AI",
    href: "/ai-employees",
    icon: Users,
    description:
      "Supports recruitment, onboarding, and employee services.",
    activity: "HR requests managed",
  },
];


export default function EmployeeShowcase() {

  return (

    <section className="relative px-6 py-28 lg:px-8">

      <div className="mx-auto max-w-7xl">


        <div className="mx-auto max-w-3xl text-center">

          <p className="text-sm font-bold uppercase tracking-[0.25em] text-violet-400">
            AI Workforce
          </p>

          <h2 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl">
            Meet Your AI Employees.
          </h2>

          <p className="mt-6 text-lg text-white/50">
            Deploy intelligent AI workers that communicate with customers,
            automate tasks, and help your business grow.
          </p>

        </div>


        <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">

          {employees.map((employee) => {

            const Icon = employee.icon;

            return (

              <Link
                key={employee.name}
                href={employee.href}
                className="group rounded-3xl border border-white/10 bg-white/[0.04] p-7 transition hover:-translate-y-2 hover:border-white/20"
              >

                <div className="flex items-center justify-between">

                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
                    <Icon className="h-6 w-6 text-violet-300" />
                  </div>

                  <span className="flex items-center gap-2 text-xs text-emerald-400">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    Online
                  </span>

                </div>


                <h3 className="mt-6 text-xl font-bold">
                  {employee.name}
                </h3>


                <p className="mt-3 text-sm leading-6 text-white/50">
                  {employee.description}
                </p>


                <div className="mt-6 rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-white/40">
                  {employee.activity}
                </div>


                <div className="mt-5 flex items-center gap-2 text-sm font-semibold text-white/70">
                  Explore employee
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </div>


              </Link>

            );

          })}

        </div>


      </div>

    </section>

  );

}
