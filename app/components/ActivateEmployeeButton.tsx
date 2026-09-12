"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { canActivateEmployee, isEmployeeTypeEntitled } from "@/lib/billing/ai-workforce-policy";
import { getPlanDefinition } from "@/lib/billing/plan-definitions";
import type { BusinessEntitlements } from "@/lib/billing/entitlements";

type Props = {
  name: string;
  type: string;
  description: string;
  templateId?: string;
  /**
   * Resolved (subscription/trial-aware) entitlements for the signed-in
   * business, from the same getBusinessEntitlements() the server uses —
   * e.g. via GET /api/businesses. This is display-only: whether the button
   * calls the activation endpoint at all is still gated below by
   * canActivateEmployee, the SAME function the server calls, and the
   * server independently re-checks everything regardless of what this
   * component decides to render.
   *
   * Pass `undefined` while entitlements are still loading — the button
   * renders a disabled loading state rather than a clickable "Activate"
   * that could momentarily appear before the real answer is known.
   */
  entitlements?: BusinessEntitlements | null;
  activeEmployeeCount?: number;
  /** Whether this employee type has a real, working chat runtime today. */
  implementation?: "available" | "coming-soon";
};

export default function ActivateEmployeeButton({
  name,
  type,
  description,
  templateId,
  entitlements,
  activeEmployeeCount = 0,
  implementation = "available",
}: Props) {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function activateEmployee() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/ai-employees", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          type,
          description,
          templateId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to activate AI employee.",
        );
      }

      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to activate AI employee.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (implementation === "coming-soon") {
    return (
      <div
        className="mt-4 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-white/35"
        title="This AI employee is not yet available to activate."
      >
        <span className="h-2 w-2 rounded-full bg-white/20" />
        Coming Soon
      </div>
    );
  }

  // Entitlements not loaded yet — never show a clickable "Activate" before
  // we actually know whether this business is entitled to it.
  if (entitlements === undefined || entitlements === null) {
    return (
      <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-white/25">
        Checking availability...
      </div>
    );
  }

  const decision = canActivateEmployee(entitlements, type, activeEmployeeCount);

  if (!decision.allowed) {
    if (decision.code === "ENTERPRISE_CONFIGURATION_REQUIRED") {
      return (
        <div className="mt-4 space-y-2">
          <p className="text-xs leading-5 text-white/40">{decision.message}</p>
          <a
            href="/demo"
            className="inline-flex rounded-xl border border-violet-300/20 bg-violet-300/[0.08] px-4 py-2.5 text-sm font-semibold text-violet-200 transition hover:bg-violet-300/[0.12]"
          >
            Contact SuperKuba →
          </a>
        </div>
      );
    }

    if (decision.code === "EMPLOYEE_NOT_AVAILABLE") {
      // Commercially entitled, but not yet built — never an upgrade
      // prompt, since upgrading plan does nothing here.
      return (
        <div
          className="mt-4 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-white/35"
          title={decision.message}
        >
          <span className="h-2 w-2 rounded-full bg-white/20" />
          Coming Soon
        </div>
      );
    }

    const typeEntitled = isEmployeeTypeEntitled(entitlements, type);
    const limit = entitlements.limits.max_ai_employees;
    const atCapacity = limit !== null && activeEmployeeCount >= limit;

    const messages: string[] = [];
    if (!typeEntitled && decision.requiredPlan) {
      messages.push(`${name} requires the ${getPlanDefinition(decision.requiredPlan).name} plan or higher.`);
    }
    if (atCapacity) {
      messages.push(
        `${entitlements.planName} currently uses ${activeEmployeeCount} of ${limit} AI employee slot${limit === 1 ? "" : "s"}.`,
      );
    }
    if (messages.length === 0) messages.push(decision.message);

    return (
      <div className="mt-4 space-y-2">
        {messages.map((message) => (
          <p key={message} className="text-xs leading-5 text-white/40">
            {message}
          </p>
        ))}
        {decision.requiredPlan && (
          <Link
            href={`/onboarding?resume=plan&plan=${decision.requiredPlan}`}
            className="inline-flex rounded-xl bg-white/90 px-4 py-2.5 text-sm font-bold text-black transition hover:bg-white"
          >
            Upgrade to {getPlanDefinition(decision.requiredPlan).name} →
          </Link>
        )}
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={activateEmployee}
        disabled={loading}
        className="mt-4 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Activating..." : "Activate"}
      </button>

      {error && (
        <p className="mt-2 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
