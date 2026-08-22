"use client";

import Link from "next/link";
import SuperKubaAIWorkforceShowcase from "../components/SuperKubaAIWorkforceShowcase";
import SuperKubaAnalyticsShowcase from "../components/SuperKubaAnalyticsShowcase";
import SuperKubaAutomationShowcase from "../components/SuperKubaAutomationShowcase";
import SuperKubaBusinessOperationsShowcase from "../components/SuperKubaBusinessOperationsShowcase";
import SuperKubaCustomerOperationsShowcase from "../components/SuperKubaCustomerOperationsShowcase";
import SuperKubaDashboardShowcase from "../components/SuperKubaDashboardShowcase";
import MarketingHeader from "../components/MarketingHeader";
import BackNavigation from "../components/BackNavigation";
import {
  ArrowRight,
  Bot,
  Phone,
  MessageSquare,
  BrainCircuit,
  Workflow,
  Plug,
} from "lucide-react";


const products = [
  {
    title: "AI Employees",
    icon: Bot,
    description:
      "Deploy intelligent AI employees that communicate with customers, handle tasks, and support your business operations 24/7.",
  },
  {
    title: "AI Voice Agents",
    icon: Phone,
    description:
      "Automate customer calling with human-like multilingual AI voice agents that make and receive calls.",
  },
  {
    title: "AI Communication Platform",
    icon: MessageSquare,
    description:
      "Connect with customers through website chat, WhatsApp, social media, email, and voice from one intelligent platform.",
  },
  {
    title: "AI Workforce Platform",
    icon: BrainCircuit,
    description:
      "Create, train, manage, and scale your AI employees across your organization.",
  },
  {
    title: "Business Automation",
    icon: Workflow,
    description:
      "Automate repetitive workflows and allow your teams to focus on higher-value work.",
  },
  {
    title: "Integrations",
    icon: Plug,
    description:
      "Connect Kuba with the tools and systems your business already uses.",
  },
];


export default function ProductsPage() {

  return (

    <main className="min-h-screen bg-[#060609] text-white">
      <MarketingHeader />
      <div className="mx-auto max-w-7xl px-6 pt-28 lg:px-8">
        <BackNavigation label="Back to SuperKuba" />
      </div>


      <section className="px-6 pb-20 pt-12 lg:px-8">

        <div className="mx-auto max-w-7xl text-center">


          <div className="inline-flex rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-white/70">
            Products
          </div>


          <h1 className="mt-8 text-5xl font-black tracking-tight sm:text-6xl">

            Everything You Need To Build

            <span className="block bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-300 bg-clip-text text-transparent">
              Your AI Workforce.
            </span>

          </h1>


          <p className="mx-auto mt-8 max-w-3xl text-lg leading-8 text-white/55">

            Kuba provides AI-powered products that help businesses
            communicate, automate workflows, increase productivity,
            and operate smarter.

          </p>


        </div>

      </section>

      <SuperKubaDashboardShowcase className="border-b-0" />


      <section className="px-6 pb-28 lg:px-8">

        <div className="mx-auto grid max-w-7xl gap-6 sm:grid-cols-2 lg:grid-cols-3">


          {products.map((product) => {

            const Icon = product.icon;


            return (

              <div
                key={product.title}
                id={product.title === "Integrations" ? "integrations" : undefined}
                className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 transition hover:-translate-y-1 hover:border-white/20"
              >

                <Icon className="h-8 w-8 text-violet-300" />


                <h2 className="mt-6 text-2xl font-bold">
                  {product.title}
                </h2>


                <p className="mt-3 text-white/50">
                  {product.description}
                </p>


                <Link
                  href="/signup"
                  className="mt-6 inline-flex items-center gap-2 text-sm font-bold"
                >
                  Get Started
                  <ArrowRight className="h-4 w-4" />
                </Link>


              </div>

            );

          })}


        </div>

      </section>

      <div id="ai-workforce"><SuperKubaAIWorkforceShowcase className="border-b-0" /></div>

      <div id="customer-operations"><SuperKubaCustomerOperationsShowcase className="border-b-0" /></div>

      <div id="analytics"><SuperKubaAnalyticsShowcase className="border-b-0" /></div>

      <div id="automation"><SuperKubaAutomationShowcase className="border-b-0" /></div>

      <div id="business-operations"><SuperKubaBusinessOperationsShowcase className="border-b-0" /></div>


    </main>

  );

}
