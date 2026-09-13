"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ONBOARDING_INDUSTRIES, ONBOARDING_BUSINESS_SIZES, ONBOARDING_GOALS } from "@/lib/onboarding/registry";

/**
 * "+ Add business" — for an authenticated user who already owns at least
 * one business (a portfolio owner, or anyone starting an independent
 * second workspace) to create another one. Distinct from /onboarding,
 * which is only for a brand-new user's FIRST business — this page posts to
 * POST /api/businesses/additional instead, sharing the exact same
 * validation/creation logic (lib/onboarding/create-business.ts) so a
 * second business is created no differently than a first one, and is
 * never automatically granted anything above Starter.
 */
export default function AddBusinessPage() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState("");
  const [website, setWebsite] = useState("");
  const [industry, setIndustry] = useState<string>(ONBOARDING_INDUSTRIES[0]);
  const [businessSize, setBusinessSize] = useState<string>(ONBOARDING_BUSINESS_SIZES[0]);
  const [goals, setGoals] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function toggleGoal(goal: string) {
    setGoals((current) => (current.includes(goal) ? current.filter((item) => item !== goal) : [...current, goal]));
  }

  async function submit() {
    setError("");
    if (!businessName.trim()) {
      setError("Business name is required.");
      return;
    }
    if (goals.length === 0) {
      setError("Select at least one goal.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/businesses/additional", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessName, website, industry, businessSize, goals }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Unable to create business.");
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("Unable to create business. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#050507] px-4 py-10 text-white sm:px-6">
      <div className="mx-auto max-w-xl">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-300/70">Portfolio</p>
        <h1 className="mt-3 text-3xl font-black">Add a business</h1>
        <p className="mt-2 text-sm text-white/40">Create another independent workspace. It starts on Starter — plan changes happen separately.</p>

        <div className="mt-8 space-y-5 rounded-3xl border border-white/10 bg-white/[0.025] p-6">
          <label className="block">
            <span className="text-sm font-semibold text-white/70">Business name</span>
            <input value={businessName} onChange={(event) => setBusinessName(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-cyan-300/40" />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-white/70">Website (optional)</span>
            <input value={website} onChange={(event) => setWebsite(event.target.value)} placeholder="example.com" className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-cyan-300/40" />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-white/70">Industry</span>
            <select value={industry} onChange={(event) => setIndustry(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-cyan-300/40">
              {ONBOARDING_INDUSTRIES.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-white/70">Business size</span>
            <select value={businessSize} onChange={(event) => setBusinessSize(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-cyan-300/40">
              {ONBOARDING_BUSINESS_SIZES.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>

          <div>
            <span className="text-sm font-semibold text-white/70">Goals</span>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {ONBOARDING_GOALS.map((goal) => (
                <label key={goal} className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm">
                  <input type="checkbox" checked={goals.includes(goal)} onChange={() => toggleGoal(goal)} />
                  {goal}
                </label>
              ))}
            </div>
          </div>

          {error && <p className="rounded-xl border border-red-400/20 bg-red-400/[0.05] p-3 text-sm text-red-200">{error}</p>}

          <button type="button" disabled={loading} onClick={() => void submit()} className="w-full rounded-xl bg-cyan-400 px-4 py-3 text-sm font-bold text-black disabled:opacity-50">
            {loading ? "Creating…" : "Create business"}
          </button>
        </div>
      </div>
    </main>
  );
}
