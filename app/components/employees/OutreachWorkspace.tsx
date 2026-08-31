"use client";

import OutreachEmployeeChat from "../OutreachEmployeeChat";

type Props = {
  employeeId: string;
};

const capabilities = [
  {
    title: "Prospect Research",
    description:
      "Discover and research companies that match your ideal customer profile.",
    status: "Ready",
  },
  {
    title: "Buying Signals",
    description:
      "Look for public signals that may indicate a company has a relevant business need.",
    status: "Ready",
  },
  {
    title: "Qualification",
    description:
      "Evaluate prospect fit using your business, services, target customers, and available evidence.",
    status: "Ready",
  },
  {
    title: "Personalized Outreach",
    description:
      "Prepare relevant outreach messages grounded in confirmed research and business context.",
    status: "Approval controlled",
  },
  {
    title: "Sales Handoff",
    description:
      "Prepare qualified opportunities for transfer to Kuba Sales when sales engagement is appropriate.",
    status: "Ready",
  },
];

export default function OutreachWorkspace({
  employeeId,
}: Props) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section>
        <OutreachEmployeeChat employeeId={employeeId} />
      </section>

      <aside className="space-y-5">
        <section className="rounded-3xl border border-cyan-300/15 bg-cyan-300/[0.035] p-5">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300/70">
            Outreach Intelligence
          </p>

          <h3 className="mt-3 text-lg font-bold text-white">
            Prospecting Command Center
          </h3>

          <p className="mt-3 text-sm leading-6 text-white/45">
            Kuba researches potential customers, identifies relevant
            opportunities, and prepares evidence-based outreach for
            your business.
          </p>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/40">
                Operating Mode
              </p>
              <p className="mt-2 font-bold text-white">
                Research autonomous
              </p>
            </div>

            <span className="rounded-full border border-emerald-300/20 bg-emerald-300/[0.06] px-2.5 py-1 text-[10px] font-bold uppercase text-emerald-300">
              Active
            </span>
          </div>

          <p className="mt-3 text-xs leading-5 text-white/35">
            Research and drafting can run autonomously. External
            outreach remains subject to configured authority and
            approval controls.
          </p>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/40">
            Capabilities
          </p>

          <div className="mt-4 space-y-3">
            {capabilities.map((capability) => (
              <div
                key={capability.title}
                className="rounded-2xl border border-white/[0.07] bg-black/20 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-bold text-white/80">
                    {capability.title}
                  </p>

                  <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider text-cyan-300/70">
                    {capability.status}
                  </span>
                </div>

                <p className="mt-2 text-xs leading-5 text-white/35">
                  {capability.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-violet-300/15 bg-violet-300/[0.035] p-5">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-300/70">
            Research Standard
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {["Confirmed", "Likely inference", "Unknown"].map(
              (label) => (
                <span
                  key={label}
                  className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-1.5 text-[10px] font-semibold text-white/50"
                >
                  {label}
                </span>
              ),
            )}
          </div>

          <p className="mt-3 text-xs leading-5 text-white/35">
            Kuba should distinguish verified facts from reasonable
            inference and information that could not be confirmed.
          </p>
        </section>
      </aside>
    </div>
  );
}
