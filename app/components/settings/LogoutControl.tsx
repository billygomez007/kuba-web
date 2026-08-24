"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function LogoutControl() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function logout() {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error(result.error.message || "Unable to log out.");
      router.replace("/login");
      router.refresh();
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : "Unable to log out.");
      setLoading(false);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 shadow-2xl">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-lg font-semibold">Account</h2>
          <p className="mt-1 text-sm text-white/45">Sign out of your SuperKuba account on this device.</p>
        </div>
        <button type="button" onClick={() => void logout()} disabled={loading} className="rounded-xl border border-white/15 bg-white/[0.06] px-5 py-3 text-sm font-semibold text-white/75 transition hover:bg-white/[0.1] disabled:cursor-wait disabled:opacity-50">
          {loading ? "Logging out..." : "Log Out"}
        </button>
      </div>
      {error && <p className="mt-4 rounded-xl border border-red-400/20 bg-red-400/[0.05] p-3 text-sm text-red-200">{error}</p>}
    </section>
  );
}
