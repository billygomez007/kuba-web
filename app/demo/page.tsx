"use client";

import Link from "next/link";
import { ArrowRight, Check, CalendarDays } from "lucide-react";

export default function DemoPage() {
  return (
    <main className="min-h-screen bg-[#060609] px-6 py-20 text-white lg:px-8">

      <div className="mx-auto max-w-6xl">

        <Link
          href="/"
          className="text-sm font-semibold text-white/50 transition hover:text-white"
        >
          ← Back to Kuba
        </Link>

        <div className="mt-16 grid gap-16 lg:grid-cols-2 lg:items-center">

          <div>

            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-white/70">
              <CalendarDays className="h-4 w-4 text-violet-400" />
              Book a Demo
            </div>

            <h1 className="mt-7 text-5xl font-black tracking-tight sm:text-6xl">
              See what Kuba can do for your business.
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-8 text-white/50">
              Talk with our team and discover how AI employees,
              automation, communication, and intelligent workflows
              can work together for your organization.
            </p>

            <div className="mt-8 space-y-4">

              {[
                "See Kuba's AI workforce in action.",
                "Explore the right AI employees for your business.",
                "Discuss integrations and automation opportunities.",
                "Get a personalized deployment plan.",
              ].map((item) => (

                <div
                  key={item}
                  className="flex items-start gap-3 text-sm text-white/70"
                >
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-400/10">
                    <Check className="h-3 w-3 text-emerald-400" />
                  </div>

                  {item}

                </div>

              ))}

            </div>

          </div>


          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl backdrop-blur-xl sm:p-8">

            <h2 className="text-2xl font-bold">
              Request your demo
            </h2>

            <p className="mt-2 text-sm text-white/40">
              Tell us a little about your business.
            </p>

            <form className="mt-8 space-y-5">

              <input
                type="text"
                placeholder="Full name"
                className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-violet-400/50"
              />

              <input
                type="email"
                placeholder="Work email"
                className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-violet-400/50"
              />

              <input
                type="text"
                placeholder="Company"
                className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-violet-400/50"
              />

              <select
                className="w-full rounded-xl border border-white/10 bg-[#0b0b12] px-4 py-3.5 text-sm text-white/60 outline-none focus:border-violet-400/50"
                defaultValue=""
              >
                <option value="" disabled>
                  Company size
                </option>
                <option>1–10 employees</option>
                <option>11–50 employees</option>
                <option>51–200 employees</option>
                <option>201–500 employees</option>
                <option>500+ employees</option>
              </select>

              <textarea
                placeholder="What would you like to automate?"
                rows={4}
                className="w-full resize-none rounded-xl border border-white/10 bg-black/20 px-4 py-3.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-violet-400/50"
              />

              <button
                type="submit"
                className="group flex w-full items-center justify-center gap-2 rounded-xl bg-white px-6 py-4 font-bold text-black transition hover:scale-[1.01] hover:bg-white/90"
              >
                Request Demo
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>

            </form>

          </div>

        </div>

      </div>

    </main>
  );
}
