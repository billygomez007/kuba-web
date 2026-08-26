"use client";

type IntegrationStatusPageProps = {
  title: string;
  description: string;
  providers: string[];
  status: "Coming Soon" | "Platform Billing Only" | "Not Configured";
  notes: string[];
};

export default function IntegrationStatusPage({ title, description, providers, status, notes }: IntegrationStatusPageProps) {
  return (
    <main className="min-h-screen bg-[#050507] px-6 py-10 text-white">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300/70">Integrations</p>
        <h1 className="mt-3 text-3xl font-black">{title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/50">{description}</p>

        <section className="mt-8 rounded-3xl border border-amber-300/20 bg-amber-300/[0.05] p-6 sm:p-8">
          <p className="font-semibold text-amber-200">{status}</p>
          <p className="mt-2 text-sm leading-6 text-amber-100/70">This category has no active provider connection in the current SuperKuba implementation.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {providers.map((provider) => <span key={provider} className="rounded-full border border-amber-200/15 bg-amber-200/[0.05] px-3 py-1.5 text-xs text-amber-100/70">{provider}</span>)}
          </div>
        </section>

        <section className="mt-4 rounded-3xl border border-white/10 bg-white/[0.025] p-6 sm:p-8">
          <h2 className="text-lg font-bold">Current boundaries</h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-white/60">
            {notes.map((note) => <li key={note}>- {note}</li>)}
          </ul>
        </section>

        <p className="mt-6 text-xs uppercase tracking-[0.16em] text-white/30">No connection controls are shown until a real tenant-scoped provider implementation is available.</p>
      </div>
    </main>
  );
}