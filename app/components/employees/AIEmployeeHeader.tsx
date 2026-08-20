"use client";

type Props = {
  name: string;
  type: string;
  status: string;
  description?: string | null;
};

const avatars: Record<string, string> = {
  receptionist: "/avatars/receptionist.png",
  sales: "/avatars/sales.png",
  "customer-support": "/avatars/customer-support.png",
  accountant: "/avatars/accountant.png",
  finance: "/avatars/finance.png",
  marketing: "/avatars/marketing.png",
  hr: "/avatars/hr.png",
  operations: "/avatars/operations.png",
  appointment: "/avatars/appointment.png",
};

const categories: Record<string, string> = {
  receptionist: "Customer Experience",
  sales: "Revenue",
  "customer-support": "Customer Experience",
  accountant: "Finance",
  finance: "Finance",
  marketing: "Growth",
  hr: "People",
  operations: "Operations",
  appointment: "Operations",
};

export default function AIEmployeeHeader({
  name,
  type,
  status,
  description,
}: Props) {
  const avatar =
    avatars[type] || "/avatars/receptionist.png";

  const category =
    categories[type] || "AI Workforce";

  return (
    <section className="rounded-3xl border border-white/[0.08] bg-white/[0.035] p-8 shadow-2xl backdrop-blur-xl">

      <div className="flex flex-col gap-7 sm:flex-row sm:items-center">

        <div className="relative flex-shrink-0">

          <div className="kuba-avatar-glow absolute inset-0 rounded-full bg-cyan-400/25 blur-2xl" />

          <div className="relative kuba-avatar-float overflow-hidden rounded-full border border-white/10 bg-white/[0.03] p-1 shadow-2xl">

            <img
              src={avatar}
              alt={name}
              className="h-28 w-28 rounded-full object-cover"
            />

            <span className="absolute bottom-2 right-2 h-4 w-4 rounded-full border-2 border-[#07070A] bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />

          </div>

        </div>


        <div className="min-w-0">

          <div className="flex flex-wrap items-center gap-3">

            <h1 className="text-3xl font-black">
              {name}
            </h1>

            <span className="rounded-full border border-emerald-400/15 bg-emerald-400/[0.06] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
              {status}
            </span>

          </div>


          <p className="mt-2 text-sm font-semibold uppercase tracking-wider text-cyan-300/60">
            {category}
          </p>


          <div className="mt-5 max-w-2xl rounded-2xl border border-white/10 bg-white/[0.025] p-4">

            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/25">
              Specializes in
            </p>

            <p className="mt-2 text-sm leading-6 text-white/55">
              {description ||
                "Helping your business get work done."}
            </p>

          </div>

        </div>

      </div>

    </section>
  );
}
