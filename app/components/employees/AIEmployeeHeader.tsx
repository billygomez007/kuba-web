"use client";

import { useState } from "react";
import { getCatalogEntry, getEmployeeAvatar } from "@/lib/billing/ai-workforce-catalog";

type Props = {
  employeeId: string;
  name: string;
  type: string;
  status: string;
  description?: string | null;
  /** True if this employee's type isn't included in the business's current plan. */
  notEntitledUnderCurrentPlan?: boolean;
  /** Owner/admin — the same WORKFORCE_MANAGE gate the settings page and activation API enforce server-side. */
  canManage?: boolean;
};

export default function AIEmployeeHeader({
  employeeId,
  name,
  type,
  status: initialStatus,
  description,
  notEntitledUnderCurrentPlan = false,
  canManage = false,
}: Props) {
  const [status, setStatus] = useState(initialStatus);
  const [pending, setPending] = useState(false);
  const [statusError, setStatusError] = useState("");
  const avatar = getEmployeeAvatar(type);
  const category = getCatalogEntry(type)?.category || "AI Workforce";
  const isActive = status === "active";

  async function toggleStatus() {
    setPending(true);
    setStatusError("");
    try {
      const response = await fetch(`/api/ai-employees/${employeeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: isActive ? "deactivate" : "reactivate" }),
      });
      const data = await response.json();
      if (!response.ok) {
        setStatusError(data.error || "Unable to update this employee.");
        return;
      }
      setStatus(data.employee.status);
    } catch {
      setStatusError("Unable to update this employee. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

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

            <span
              className={
                isActive
                  ? "rounded-full border border-emerald-400/15 bg-emerald-400/[0.06] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300"
                  : "rounded-full border border-white/15 bg-white/[0.04] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white/45"
              }
            >
              {status}
            </span>

            {canManage && (
              <button
                type="button"
                onClick={() => void toggleStatus()}
                disabled={pending}
                className={
                  isActive
                    ? "rounded-full border border-amber-400/20 bg-amber-400/[0.06] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-300 transition hover:bg-amber-400/[0.12] disabled:opacity-50"
                    : "rounded-full border border-cyan-400/20 bg-cyan-400/[0.06] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-cyan-300 transition hover:bg-cyan-400/[0.12] disabled:opacity-50"
                }
              >
                {pending ? "Working…" : isActive ? "Deactivate" : "Reactivate"}
              </button>
            )}

            {notEntitledUnderCurrentPlan && (
              <span
                className="rounded-full border border-amber-400/20 bg-amber-400/[0.08] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-300"
                title="This employee type isn't included in your current plan. It keeps working, but you'll need to upgrade to activate another one like it."
              >
                Not in current plan
              </span>
            )}

          </div>

          {statusError && (
            <p className="mt-2 text-xs text-rose-300" role="alert">
              {statusError}
            </p>
          )}

          {!isActive && (
            <p className="mt-2 text-xs text-white/40">
              Inactive — no longer takes new conversations or actions. Conversation history and settings are preserved; reactivate to resume.
            </p>
          )}

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
