import type { Metadata } from "next";
import Link from "next/link";
import ProductShowcase from "../components/ui/ProductShowcase";
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


export const metadata: Metadata = {
  title: "Products | SuperKuba",
  description: "AI Workforce, Customer Operations, Business Operations, Automation, Analytics, and Integrations — the products that make up the SuperKuba platform.",
  alternates: { canonical: "/products" },
};

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

      <ProductShowcase
        id="superkuba-dashboard"
        tone="violet"
        eyebrow="Product experience"
        title="See SuperKuba AI in Action"
        description="Experience your AI workforce platform designed to help businesses manage customers, automate operations, and grow from one intelligent command center."
        imageSrc="/images/superkuba-dashboard-mockup.png"
        imageAlt="SuperKuba AI business command center dashboard"
        className="border-b-0"
      />


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

      <ProductShowcase
        id="ai-workforce"
        tone="violet"
        eyebrow="AI Workforce"
        title="Build Your AI Workforce"
        description="Create, manage, and empower AI employees that work 24/7 across sales, customer service, operations, finance, and more."
        imageSrc="/images/superkuba-ai-workforce-mockup.png"
        imageAlt="SuperKuba AI Workforce management workspace"
        className="border-b-0"
      />

      <ProductShowcase
        id="customer-operations"
        tone="cyan"
        eyebrow="Customer Operations"
        title="Intelligent Customer Operations"
        description="Manage customers, conversations, tickets, and AI-powered support from one intelligent customer operations hub."
        imageSrc="/images/superkuba-customer-operations-mockup.png"
        imageAlt="SuperKuba intelligent customer operations hub"
        className="border-b-0"
      />

      <ProductShowcase
        id="analytics"
        tone="cyan"
        eyebrow="Analytics & Intelligence"
        title="AI-Powered Business Intelligence"
        description="Track conversations, leads, appointments, and operational performance from one place, with AI-generated summaries grounded in your real business data."
        imageSrc="/images/superkuba-analytics-mockup.png"
        imageAlt="SuperKuba AI-powered business analytics dashboard"
        className="border-b-0"
      />

      <ProductShowcase
        id="automation"
        tone="cyan"
        eyebrow="Automation Engine"
        title="Intelligent Automation"
        description="Automate repetitive business tasks, workflows, and customer interactions with AI-powered automation that works around the clock."
        imageSrc="/images/superkuba-automation-mockup.png"
        imageAlt="SuperKuba intelligent automation engine dashboard"
        className="border-b-0"
      />

      <ProductShowcase
        id="business-operations"
        tone="violet"
        eyebrow="Business Operations"
        title="Run Your Business Smarter"
        description="Manage finance, tasks, compliance, invoices, and operational workflows from one intelligent business operations hub."
        imageSrc="/images/superkuba-business-operations-mockup.png"
        imageAlt="SuperKuba intelligent business operations hub"
        className="border-b-0"
      />


    </main>

  );

}
