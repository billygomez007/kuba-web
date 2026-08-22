"use client";

import Link from "next/link";
import SuperKubaDashboardShowcase from "../components/SuperKubaDashboardShowcase";
import {
  ArrowRight,
  Headphones,
  Rocket,
  Megaphone,
  Users,
  BrainCircuit,
  Settings2,
} from "lucide-react";


const employees = [
  {
    title: "Customer Service AI Employee",
    icon: Headphones,
    description:
      "Handles customer questions, support requests, complaints, and enquiries 24/7.",
  },
  {
    title: "Sales AI Employee",
    icon: Rocket,
    description:
      "Qualifies leads, follows up with prospects, and helps your business increase conversions.",
  },
  {
    title: "Marketing AI Employee",
    icon: Megaphone,
    description:
      "Supports campaigns, customer engagement, content workflows, and marketing activities.",
  },
  {
    title: "HR AI Employee",
    icon: Users,
    description:
      "Supports recruitment, onboarding, employee questions, and internal HR processes.",
  },
  {
    title: "Finance AI Employee",
    icon: BrainCircuit,
    description:
      "Assists with finance workflows, reporting, and business information management.",
  },
  {
    title: "Operations AI Employee",
    icon: Settings2,
    description:
      "Automates repetitive tasks and improves everyday business operations.",
  },
];


export default function AIEmployeesPage() {

  return (

    <main className="min-h-screen bg-[#060609] text-white">


      <section className="px-6 pb-20 pt-32 lg:px-8">

        <div className="mx-auto max-w-7xl text-center">


          <div className="inline-flex rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-white/70">
            AI Employees
          </div>


          <h1 className="mt-8 text-5xl font-black tracking-tight sm:text-6xl">

            Hire Intelligent AI Employees

            <span className="block bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-300 bg-clip-text text-transparent">
              That Work 24/7.
            </span>

          </h1>


          <p className="mx-auto mt-8 max-w-3xl text-lg leading-8 text-white/55">

            Kuba AI employees help businesses automate communication,
            handle tasks, support customers, and improve productivity
            without replacing your team.

          </p>


          <Link
            href="/signup"
            className="mt-10 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 font-bold text-black"
          >
            Create Your AI Workforce
            <ArrowRight className="h-4 w-4" />
          </Link>


        </div>

      </section>

      <SuperKubaDashboardShowcase className="border-b-0" />


      <section className="px-6 pb-28 lg:px-8">

        <div className="mx-auto grid max-w-7xl gap-6 sm:grid-cols-2 lg:grid-cols-3">


          {employees.map((employee)=>{

            const Icon = employee.icon;

            return (

              <div
                key={employee.title}
                className="rounded-3xl border border-white/10 bg-white/[0.04] p-8"
              >

                <Icon className="h-8 w-8 text-violet-300" />

                <h2 className="mt-6 text-2xl font-bold">
                  {employee.title}
                </h2>

                <p className="mt-3 text-white/50">
                  {employee.description}
                </p>

              </div>

            );

          })}


        </div>

      </section>


    </main>

  );

}
