import type { Metadata } from "next";
import { BookOpen, CircleHelp, FileText, Library, Newspaper } from "lucide-react";
import MarketingHeader from "../components/MarketingHeader";
import BackNavigation from "../components/BackNavigation";

export const metadata: Metadata = {
  title: "Resources | SuperKuba",
  description: "Guides, documentation, and help resources for running your business on SuperKuba.",
  alternates: { canonical: "/resources" },
};

const resources = [
  { id: "blog", title: "Blog", icon: Newspaper, description: "Product news, practical AI insights, and ideas for building an intelligent business." },
  { id: "guides", title: "Guides", icon: BookOpen, description: "Step-by-step guidance for introducing AI employees and automation into your operations." },
  { id: "help-center", title: "Help Center", icon: CircleHelp, description: "Answers and support resources for setting up and managing your SuperKuba workspace." },
  { id: "documentation", title: "Documentation", icon: FileText, description: "Technical references for SuperKuba capabilities, integrations, and platform configuration." },
  { id: "ai-resources", title: "AI Resources", icon: Library, description: "Templates and learning resources to help your team work effectively with business AI." },
];

export default function ResourcesPage() {
  return (
    <main className="min-h-screen bg-[#060609] text-white">
      <MarketingHeader />
      <div className="mx-auto max-w-7xl px-6 pt-28 lg:px-8">
        <BackNavigation label="Back to SuperKuba" />
      </div>
      <section className="px-6 pb-20 pt-12 lg:px-8">
        <div className="mx-auto max-w-7xl text-center">
          <div className="inline-flex rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-white/70">Resources</div>
          <h1 className="mt-8 text-5xl font-black tracking-tight sm:text-6xl">Learn, build, and grow with <span className="block bg-gradient-to-r from-violet-400 via-cyan-300 to-blue-400 bg-clip-text text-transparent">SuperKuba.</span></h1>
          <p className="mx-auto mt-8 max-w-3xl text-lg leading-8 text-white/55">Explore practical resources designed to help your business deploy AI employees, automate work, and operate intelligently.</p>
        </div>
      </section>
      <section className="px-6 pb-28 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {resources.map((resource) => {
            const Icon = resource.icon;
            return (
              <article id={resource.id} key={resource.id} className="scroll-mt-28 rounded-3xl border border-white/10 bg-white/[0.04] p-8">
                <Icon className="h-8 w-8 text-cyan-300" />
                <h2 className="mt-6 text-2xl font-bold">{resource.title}</h2>
                <p className="mt-3 leading-7 text-white/50">{resource.description}</p>
                <span className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white/40">Coming soon</span>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
