"use client";

import Link from "next/link";
import {
  ArrowRight,
  Phone,
  Languages,
  Workflow,
  Mic,
} from "lucide-react";

export default function VoiceAgentsPage() {
  return (
    <main className="min-h-screen bg-[#060609] text-white">

      <section className="relative overflow-hidden px-6 pb-28 pt-32 lg:px-8">

        <div className="absolute inset-0">
          <div className="absolute left-[-10%] top-[-10%] h-[500px] w-[500px] rounded-full bg-violet-600/20 blur-[150px]" />
          <div className="absolute right-[-10%] top-[10%] h-[500px] w-[500px] rounded-full bg-cyan-400/15 blur-[150px]" />
        </div>

        <div className="relative mx-auto grid max-w-7xl gap-16 lg:grid-cols-2 lg:items-center">

          <div>

            <div className="inline-flex rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-white/70">
              AI Voice Agents
            </div>

            <h1 className="mt-8 text-5xl font-black tracking-tight sm:text-6xl">
              Transform Customer Calling With
              <span className="block bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-300 bg-clip-text text-transparent">
                Human-Like AI Voice
              </span>
            </h1>

            <p className="mt-8 max-w-xl text-lg leading-8 text-white/55">
              Automate customer calling with human-like, multilingual AI voice agents that listen, understand, respond, and take action for your business 24/7.
            </p>

            <div className="mt-10 flex gap-4">

              <Link
                href="/signup"
                className="rounded-full bg-white px-7 py-4 font-bold text-black"
              >
                Request Demo
              </Link>

              <Link
                href="/"
                className="rounded-full border border-white/10 px-7 py-4 font-semibold text-white/70"
              >
                Explore Kuba
              </Link>

            </div>

          </div>


          <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-8 backdrop-blur-xl">

            <div className="flex items-center gap-3">

              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/20">
                <Mic className="text-violet-300" />
              </div>

              <div>
                <h3 className="font-bold">
                  Kuba Voice Command Center
                </h3>

                <p className="text-sm text-white/40">
                  AI conversation in progress
                </p>
              </div>

            </div>


            <div className="mt-8 space-y-4">

              {[
                "Incoming customer call received",
                "AI Receptionist understands request",
                "Sales AI qualifies customer",
                "Appointment automatically scheduled",
              ].map((item) => (

                <div
                  key={item}
                  className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/60"
                >
                  {item}
                </div>

              ))}

            </div>

          </div>

        </div>

      </section>


      <section className="border-t border-white/[0.06] px-6 py-24 lg:px-8">

        <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-3">

          {[
            {
              icon: Phone,
              title: "Inbound & Outbound Calls",
              text: "Answer customer calls and make business calls automatically.",
            },
            {
              icon: Languages,
              title: "Multilingual Voice",
              text: "Communicate naturally with customers across languages.",
            },
            {
              icon: Workflow,
              title: "Smart Call Automation",
              text: "Connect conversations with workflows and business systems.",
            },
          ].map((item) => {

            const Icon = item.icon;

            return (
              <div
                key={item.title}
                className="rounded-3xl border border-white/10 bg-white/[0.03] p-7"
              >

                <Icon className="text-violet-300" />

                <h3 className="mt-5 text-xl font-bold">
                  {item.title}
                </h3>

                <p className="mt-3 text-white/50">
                  {item.text}
                </p>

              </div>
            );

          })}

        </div>

      </section>


      <section className="px-6 py-24 text-center">

        <h2 className="text-4xl font-black">
          Your AI employees can now talk.
        </h2>

        <p className="mx-auto mt-6 max-w-2xl text-white/50">
          Kuba combines voice, chat, automation and intelligence to help businesses communicate and operate better.
        </p>

      </section>


    </main>
  );
}
