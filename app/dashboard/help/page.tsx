import Link from "next/link";

type HelpLink = { label: string; description: string; href: string; external?: boolean };
type HelpSection = { title: string; links: HelpLink[] };

// Every href below is a route confirmed to exist in this repo (or a real
// contact channel already used elsewhere in the app — sales@superkuba.com
// on the Enterprise plan card, /demo's real Contact Sales form) — no
// invented documentation links, no fabricated contact addresses. There is
// currently no separate support inbox or bug tracker in this product, so
// "Report a problem" intentionally uses the same real channel as general
// contact rather than pretending a second one exists.
const SECTIONS: HelpSection[] = [
  {
    title: "Getting started",
    links: [
      { label: "Complete your business profile", description: "Industry, country, and the details your AI employees use to represent you.", href: "/dashboard/settings/profile" },
      { label: "Train your Business Brain", description: "The knowledge your AI workforce draws on to answer real questions correctly.", href: "/dashboard/business-brain" },
      { label: "Create an AI employee", description: "Deploy a Receptionist, Sales, Support, or Outreach employee.", href: "/dashboard/ai-employees/create" },
      { label: "Connect a channel", description: "WhatsApp, Email, Website Chat, or Voice — where your AI workforce actually talks to customers.", href: "/dashboard/integrations" },
    ],
  },
  {
    title: "AI Workforce",
    links: [
      { label: "AI Employees", description: "View, configure, and test every AI employee in this workspace.", href: "/dashboard/ai-employees" },
      { label: "Outreach Campaigns", description: "Build and run outbound sequences with your Outreach AI employee.", href: "/dashboard/outreach/campaigns" },
      { label: "AI Teams", description: "Group AI employees around a department or shared conversation queue.", href: "/dashboard/workforce/team" },
      { label: "AI Workforce Performance", description: "How your AI employees are actually performing.", href: "/dashboard/ai-performance" },
    ],
  },
  {
    title: "Account & workspace",
    links: [
      { label: "Team & Staff", description: "Manage staff accounts, roles, and access.", href: "/dashboard/settings/team" },
      { label: "Add a business", description: "Create another workspace under your account.", href: "/dashboard/businesses/new" },
      { label: "Portfolio", description: "Oversight across every business your account is linked to.", href: "/dashboard/portfolio" },
      { label: "Billing & Subscription", description: "Current plan, usage, and subscription state.", href: "/dashboard/billing" },
      { label: "Plans", description: "Compare what's included at each plan level.", href: "/dashboard/billing/plans" },
    ],
  },
  {
    title: "Connections",
    links: [
      { label: "WhatsApp", description: "Connect a WhatsApp Business number.", href: "/dashboard/integrations/whatsapp" },
      { label: "Email", description: "Connect an email channel for your AI workforce.", href: "/dashboard/integrations/email" },
      { label: "Website Chat", description: "Add a chat widget to your own website.", href: "/dashboard/integrations/website-chat" },
      { label: "Voice", description: "Voice provider setup for phone-based AI employees.", href: "/dashboard/settings/voice-providers" },
      { label: "All integrations", description: "Every connection surface in one place.", href: "/dashboard/integrations" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Contact SuperKuba", description: "Reach the SuperKuba team — sales, account, or a problem you've run into.", href: "/demo" },
      { label: "Email us directly", description: "sales@superkuba.com", href: "mailto:sales@superkuba.com", external: true },
    ],
  },
];

export default function HelpPage() {
  return (
    <main className="min-h-screen bg-[#050507] px-4 py-8 text-white sm:px-6 lg:px-8 lg:py-12">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-300/70">Help</p>
        <h1 className="mt-3 text-4xl font-black">Help &amp; Support</h1>
        <p className="mt-3 text-sm text-white/40">Quick links to the parts of SuperKuba you&apos;ll use most, and how to reach us.</p>

        <div className="mt-10 space-y-10">
          {SECTIONS.map((section) => (
            <section key={section.title}>
              <h2 className="text-lg font-black">{section.title}</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {section.links.map((link) =>
                  link.external ? (
                    <a
                      key={link.label}
                      href={link.href}
                      className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 transition hover:border-cyan-300/30 hover:bg-white/[0.04]"
                    >
                      <p className="font-semibold text-white/85">{link.label}</p>
                      <p className="mt-1 text-sm text-white/40">{link.description}</p>
                    </a>
                  ) : (
                    <Link
                      key={link.label}
                      href={link.href}
                      className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 transition hover:border-cyan-300/30 hover:bg-white/[0.04]"
                    >
                      <p className="font-semibold text-white/85">{link.label}</p>
                      <p className="mt-1 text-sm text-white/40">{link.description}</p>
                    </Link>
                  ),
                )}
              </div>
            </section>
          ))}
        </div>

        <Link href="/dashboard" className="mt-10 inline-flex text-sm font-semibold text-cyan-300/70 hover:text-cyan-300">
          ← Back to workspace
        </Link>
      </div>
    </main>
  );
}
