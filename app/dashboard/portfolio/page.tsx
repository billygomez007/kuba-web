"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type PortfolioBusiness = { id: string; name: string; plan: string; status: string; myRole: string | null; activeEmployeeCount: number };
type Portfolio = { organization: { id: string; name: string }; myOrganizationRole: string; businessCount: number; businesses: PortfolioBusiness[] };

/**
 * Portfolio Mode — distinct from Workspace Mode (the normal /dashboard,
 * always scoped to exactly one selected business). This page shows
 * authorized cross-business oversight for every portfolio the current user
 * belongs to: real, scoped summary data only (business list, each
 * business's own plan, the user's own role in it if any, and a real active-
 * employee count) — never aggregated revenue/leads/campaigns/conversation
 * totals, which would require metering infrastructure this task does not
 * add. A business appearing here is discovery/oversight metadata; entering
 * it still requires the user's own explicit business membership, which is
 * why some rows show no "Switch" action.
 */
export default function PortfolioDashboardPage() {
  const router = useRouter();
  const [portfolios, setPortfolios] = useState<Portfolio[] | null>(null);
  const [error, setError] = useState("");
  const [switching, setSwitching] = useState("");

  useEffect(() => {
    void fetch("/api/portfolio", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (response.ok) setPortfolios(data.portfolios || []);
        else setError(data.error || "Unable to load your portfolio.");
      })
      .catch(() => setError("Unable to load your portfolio."));
  }, []);

  async function switchTo(businessId: string) {
    setSwitching(businessId);
    try {
      const response = await fetch("/api/businesses/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId }),
      });
      if (response.ok) {
        router.push("/dashboard");
        router.refresh();
      }
    } finally {
      setSwitching("");
    }
  }

  if (!portfolios) return <main className="flex min-h-screen items-center justify-center bg-[#050507] px-6 text-sm text-white/40">{error || "Loading portfolio..."}</main>;

  return (
    <main className="min-h-screen bg-[#050507] px-4 py-10 text-white sm:px-6">
      <div className="mx-auto max-w-4xl">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-300/70">Portfolio mode</p>
        <h1 className="mt-3 text-3xl font-black">All businesses</h1>
        <p className="mt-2 text-sm text-white/40">Authorized cross-business oversight. Selecting a business switches you into its own isolated workspace.</p>

        {error && <p className="mt-5 rounded-xl border border-red-400/20 p-3 text-sm text-red-200">{error}</p>}

        {portfolios.length === 0 && (
          <p className="mt-8 rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-white/35">
            You don&apos;t belong to any portfolio yet. A platform administrator can add you to one from /admin/organizations.
          </p>
        )}

        {portfolios.map(({ organization, myOrganizationRole, businessCount, businesses }) => (
          <section key={organization.id} className="mt-8 rounded-3xl border border-white/10 bg-white/[0.025] p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-2xl font-black">{organization.name} Portfolio</h2>
                <p className="mt-1 text-sm text-white/40">Your role: {myOrganizationRole} · {businessCount} linked business{businessCount === 1 ? "" : "es"}</p>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              {businesses.length ? businesses.map((business) => (
                <div key={business.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-black/20 p-4 text-sm">
                  <div>
                    <p className="font-bold text-white/85">{business.name}</p>
                    <p className="mt-1 text-xs text-white/40 uppercase">{business.plan} · {business.status} · {business.activeEmployeeCount} active AI employee{business.activeEmployeeCount === 1 ? "" : "s"}</p>
                  </div>
                  {business.myRole ? (
                    <button
                      type="button"
                      disabled={switching === business.id}
                      onClick={() => void switchTo(business.id)}
                      className="rounded-lg border border-cyan-300/20 px-3 py-1.5 text-xs font-semibold text-cyan-200 disabled:opacity-50"
                    >
                      {switching === business.id ? "Switching…" : `Switch (${business.myRole})`}
                    </button>
                  ) : (
                    <span className="text-xs text-white/30">Not a direct member</span>
                  )}
                </div>
              )) : <p className="rounded-xl border border-dashed border-white/10 p-4 text-center text-sm text-white/35">No businesses linked to this portfolio yet.</p>}
            </div>
          </section>
        ))}

        <Link href="/dashboard" className="mt-8 inline-flex text-sm font-semibold text-cyan-300/70 hover:text-cyan-300">← Back to workspace</Link>
      </div>
    </main>
  );
}
