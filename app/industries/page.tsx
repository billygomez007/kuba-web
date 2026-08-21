"use client";

import Link from "next/link";
import {
  ArrowRight,
  Building2,
  GraduationCap,
  HeartPulse,
  Hotel,
  Plane,
  ShoppingCart,
  Utensils,
  BriefcaseBusiness,
  Landmark,
} from "lucide-react";


const industries = [
  {
    title: "Travel & Tourism",
    icon: Plane,
    description:
      "AI employees that handle travel enquiries, bookings, customer support, and lead follow-ups.",
  },
  {
    title: "Real Estate",
    icon: Building2,
    description:
      "AI assistants that respond to property enquiries, qualify buyers, and schedule viewings.",
  },
  {
    title: "Healthcare",
    icon: HeartPulse,
    description:
      "Improve patient communication, appointment scheduling, and healthcare enquiries.",
  },
  {
    title: "Education",
    icon: GraduationCap,
    description:
      "Support admissions, student communication, and institutional operations.",
  },
  {
    title: "Hospitality",
    icon: Hotel,
    description:
      "Assist guests, manage reservations, and improve customer experiences.",
  },
  {
    title: "Retail & E-commerce",
    icon: ShoppingCart,
    description:
      "AI sales assistants for customer support, product questions, and conversions.",
  },
  {
    title: "Restaurants & Food Services",
    icon: Utensils,
    description:
      "Manage orders, reservations, customer enquiries, and engagement.",
  },
  {
    title: "Financial Services",
    icon: Landmark,
    description:
      "Automate customer communication, onboarding, and service workflows.",
  },
  {
    title: "Professional Services",
    icon: BriefcaseBusiness,
    description:
      "AI assistants for agencies, consultants, and service businesses.",
  },
];


export default function IndustriesPage() {

  return (

    <main className="min-h-screen bg-[#060609] text-white">


      <section className="px-6 pb-20 pt-32 lg:px-8">

        <div className="mx-auto max-w-7xl text-center">


          <div className="inline-flex rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-white/70">
            Industries
          </div>


          <h1 className="mt-8 text-5xl font-black tracking-tight sm:text-6xl">

            AI Solutions Built For

            <span className="block bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-300 bg-clip-text text-transparent">
              Every Industry.
            </span>

          </h1>


          <p className="mx-auto mt-8 max-w-3xl text-lg leading-8 text-white/55">

            Kuba provides intelligent AI employees that help organizations
            automate communication, improve operations, and deliver better
            customer experiences.

          </p>


        </div>

      </section>



      <section className="px-6 pb-28 lg:px-8">

        <div className="mx-auto grid max-w-7xl gap-6 sm:grid-cols-2 lg:grid-cols-3">


          {industries.map((industry)=>{

            const Icon = industry.icon;

            return (

              <div
                key={industry.title}
                className="rounded-3xl border border-white/10 bg-white/[0.04] p-8"
              >

                <Icon className="h-8 w-8 text-violet-300" />

                <h2 className="mt-6 text-2xl font-bold">
                  {industry.title}
                </h2>

                <p className="mt-3 text-white/50">
                  {industry.description}
                </p>


                <Link
                  href="/signup"
                  className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-white"
                >
                  Build with Kuba
                  <ArrowRight className="h-4 w-4" />
                </Link>


              </div>

            );

          })}


        </div>

      </section>


    </main>

  );

}
