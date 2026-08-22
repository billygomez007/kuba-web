"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import BackNavigation from "../../components/BackNavigation";

const employees = [
  {
    name: "Kuba Receptionist",
    type: "receptionist",
    category: "Customer Experience",
    avatar: "/avatars/receptionist.png",
    recommended: true,
    description: "Handles customers, inquiries, bookings, and lead capture.",
  },
  {
    name: "Kuba Sales",
    type: "sales",
    category: "Revenue",
    avatar: "/avatars/sales.png",
    recommended: true,
    description: "Manages leads, follow-ups, and sales intelligence.",
  },
  {
    name: "Kuba Customer Support",
    type: "customer-support",
    category: "Customer Experience",
    avatar: "/avatars/customer-support.png",
    recommended: false,
    description: "Answers customer questions and resolves support requests.",
  },
  {
    name: "Kuba Accountant",
    type: "accountant",
    category: "Finance",
    avatar: "/avatars/accountant.png",
    recommended: false,
    description: "Handles finance workflows and reports.",
  },
  {
    name: "Kuba Finance",
    type: "finance",
    category: "Finance",
    avatar: "/avatars/finance.png",
    recommended: false,
    description: "Supports financial planning and business analysis.",
  },
  {
    name: "Kuba Marketing",
    type: "marketing",
    category: "Growth",
    avatar: "/avatars/marketing.png",
    recommended: false,
    description: "Creates campaigns, content, and customer engagement strategies.",
  },
  {
    name: "Kuba HR",
    type: "hr",
    category: "People",
    avatar: "/avatars/hr.png",
    recommended: false,
    description: "Supports recruitment and people operations.",
  },
  {
    name: "Kuba Operations",
    type: "operations",
    category: "Operations",
    avatar: "/avatars/operations.png",
    recommended: false,
    description: "Manages business processes and workflows.",
  },
  {
    name: "Kuba Appointment",
    type: "appointment",
    category: "Operations",
    avatar: "/avatars/appointment.png",
    recommended: false,
    description: "Schedules appointments and manages bookings.",
  },
];

export default function AITrainingPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([
    "receptionist",
    "sales",
  ]);
  const [loading, setLoading] = useState(false);

  function toggle(type: string) {
    setSelected((current) =>
      current.includes(type)
        ? current.filter((item) => item !== type)
        : [...current, type],
    );
  }

  async function activate() {
    setLoading(true);

    for (const type of selected) {
      const employee = employees.find(
        (item) => item.type === type,
      );

      if (!employee) continue;

      await fetch("/api/ai-employees", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(employee),
      });
    }

    router.push("/dashboard");
  }

  return (
    <main className="min-h-screen bg-[#050507] px-6 py-10 text-white">
      <div className="mx-auto max-w-4xl">
        <BackNavigation className="mb-8" label="Back" />

        <h1 className="text-center text-4xl font-black">
          Choose Your AI Workforce
        </h1>

        <div className="mt-10 grid gap-5 md:grid-cols-2">

          {employees.map((employee) => (
            <button
              key={employee.type}
              onClick={() => toggle(employee.type)}
              className={`rounded-3xl border p-6 text-left transition ${
                selected.includes(employee.type)
                  ? "border-cyan-400 bg-cyan-400/10"
                  : "border-white/10 bg-white/[0.04] hover:border-white/20"
              }`}
            >

              <div className="flex items-center justify-between">

                <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white/40">
                  {employee.category}
                </span>

                {employee.recommended && (
                  <span className="rounded-full border border-yellow-400/20 bg-yellow-400/10 px-3 py-1 text-[10px] font-bold text-yellow-300">
                    ⭐ Recommended
                  </span>
                )}

              </div>


              <div className="mt-6 flex justify-center">

                <div className="relative kuba-avatar-float">

                  <div className="kuba-avatar-glow absolute inset-0 rounded-full bg-cyan-400/25 blur-2xl" />

                  <div className="relative overflow-hidden rounded-full border border-white/10 bg-white/[0.03] p-1 shadow-2xl">

                    <img
                      src={employee.avatar}
                      alt={employee.name}
                      className="h-28 w-28 rounded-full object-cover transition duration-300 hover:scale-105"
                    />

                  </div>

                  <span className="absolute bottom-1 right-1 h-4 w-4 rounded-full border-2 border-[#050507] bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />

                </div>

              </div>


              <h2 className="mt-6 text-xl font-bold text-center">
                {employee.name}
              </h2>

              <p className="mt-2 text-sm leading-6 text-white/50">
                {employee.description}
              </p>

              {selected.includes(employee.type) && (
                <div className="mt-5 text-xs font-bold uppercase tracking-wider text-cyan-300">
                  ✓ Selected
                </div>
              )}

            </button>
          ))}

        </div>

        <button
          onClick={activate}
          disabled={loading}
          className="mx-auto mt-10 block rounded-xl bg-white px-10 py-4 font-bold text-black"
        >
          {loading ? "Activating..." : "Activate Kuba Workforce"}
        </button>

      </div>
    </main>
  );
}
