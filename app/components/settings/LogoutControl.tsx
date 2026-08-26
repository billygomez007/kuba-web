"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function LogoutControl({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function logout() {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const clearContext = await fetch("/api/businesses/select", {
        method: "DELETE",
        cache: "no-store",
      });
      if (!clearContext.ok) throw new Error("Unable to clear business context. Please try again.");
      const result = await authClient.signOut();
      if (result.error) throw new Error("Unable to sign out. Please try again.");
      router.replace("/login");
      router.refresh();
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : "Unable to sign out. Please try again.");
      setLoading(false);
    }
  }

  return (
    <section className={compact ? "mt-3 border-t border-white/[0.07] pt-3" : "mt-6 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 shadow-2xl"}>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          {!compact && <h2 className="text-lg font-semibold">Account</h2>}
          <p className={compact ? "text-xs text-white/45" : "mt-1 text-sm text-white/45"}>Sign out of your SuperKuba account on this device.</p>
        </div>
        <button type="button" onClick={() => void logout()} disabled={loading} className="rounded-xl border border-rose-300/20 bg-rose-300/[0.06] px-4 py-2 text-xs font-semibold text-rose-100 transition hover:bg-rose-300/[0.12] disabled:cursor-wait disabled:opacity-50">
          {loading ? "Signing out..." : "Sign Out"}
        </button>
      </div>
      {error && <p className="mt-3 rounded-xl border border-red-400/20 bg-red-400/[0.05] p-3 text-xs text-red-200">{error}</p>}
    </section>
  );
}
