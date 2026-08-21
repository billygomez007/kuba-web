"use client";

import Link from "next/link";
import {
  MessageSquare,
  Phone,
  Mail,
  Globe,
  Users,
  Send,
  ArrowRight,
} from "lucide-react";

export default function CommunicationPlatformPage() {
  return (
    <main className="min-h-screen bg-[#060609] text-white">

      {/* HERO */}
      <section className="relative overflow-hidden px-6 pb-28 pt-32 lg:px-8">

        <div className="absolute inset-0">
          <div className="absolute left-[-10%] top-[-10%] h-[500px] w-[500px] rounded-full bg-violet-600/20 blur-[150px]" />
          <div className="absolute right-[-10%] top-[10%] h-[500px] w-[500px] rounded-full bg-cyan-400/15 blur-[150px]" />
        </div>


        <div className="relative mx-auto max-w-7xl text-center">

          <div className="inline-flex rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-white/70">
            AI Communication Platform
          </div>


          <h1 className="mt-8 text-5xl font-black tracking-tight sm:text-6xl lg:text-7xl">

            Every Customer Conversation.

            <span className="block bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-300 bg-clip-text text-transparent">
              One Intelligent AI Platform.
            </span>

          </h1>


          <p className="mx-auto mt-8 max-w-3xl text-lg leading-8 text-white/55">

            Kuba connects your business with customers across websites,
            WhatsApp, social media, email, and voice using AI employees
            that respond, engage, and take action 24/7.

          </p>


          <div className="mt-10 flex justify-center gap-4">

            <Link
              href="/signup"
              className="rounded-full bg-white px-7 py-4 font-bold text-black"
            >
              Start Building
              <ArrowRight className="ml-2 inline h-4 w-4" />
            </Link>

          </div>

        </div>

      </section>


      {/* CHANNELS */}

      <section className="border-t border-white/[0.06] px-6 py-24 lg:px-8">

        <div className="mx-auto max-w-7xl">

          <h2 className="text-center text-4xl font-black">
            Connect Everywhere Your Customers Are
          </h2>


          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">


            {[
              {
                icon: Globe,
                title: "Website Chat",
                text: "Convert visitors into conversations and leads.",
              },
              {
                icon: MessageSquare,
                title: "WhatsApp & Messaging",
                text: "Manage customer conversations across messaging channels.",
              },
              {
                icon: Users,
                title: "Social Channels",
                text: "Engage customers through social platforms.",
              },
              {
                icon: Phone,
                title: "Voice Calls",
                text: "Handle incoming and outgoing customer calls.",
              },
              {
                icon: Mail,
                title: "Email",
                text: "Automate customer communication through email.",
              },
              {
                icon: Send,
                title: "Telegram",
                text: "Connect Telegram conversations with AI.",
              },
            ].map((item)=>{

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

        </div>

      </section>


      {/* CTA */}

      <section className="px-6 py-24 text-center">

        <h2 className="text-4xl font-black">
          One AI platform for every customer conversation.
        </h2>

        <p className="mx-auto mt-6 max-w-2xl text-white/50">
          Kuba brings chat, messaging, voice, and automation together
          into one intelligent communication system.
        </p>

      </section>


    </main>
  );
}
