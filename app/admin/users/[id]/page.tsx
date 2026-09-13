"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Detail = {
  user: { id: string; name: string; email: string; platformRole: string; status: string; createdAt: string };
  businessMemberships: { businessId: string; businessName: string; role: string; plan: string }[];
  organizationMemberships: { organizationId: string; organizationName: string; role: string }[];
};

const PLATFORM_ROLES = ["user", "platform_admin", "super_admin", "system_operator"];

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reason, setReason] = useState("");
  const [platformRole, setPlatformRole] = useState("user");

  async function load() {
    const response = await fetch(`/api/admin/users/${id}`, { cache: "no-store" });
    const result = await response.json();
    if (response.ok) {
      setData(result);
      setPlatformRole(result.user.platformRole);
    } else {
      setError(result.error || "Unable to load user.");
    }
  }

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [id]);

  async function changeRole() {
    if (!reason.trim()) { setMessage("A reason is required."); return; }
    const response = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platformRole, reason }),
    });
    const result = await response.json();
    if (response.ok) {
      setMessage(`Platform role set to ${platformRole}.`);
      setReason("");
      await load();
    } else {
      setMessage(result.error || "Unable to change platform role.");
    }
  }

  if (!data) return <main className="flex min-h-screen items-center justify-center bg-[#050507] px-6 text-sm text-white/40">{error || "Loading user..."}</main>;

  return (
    <main className="min-h-screen bg-[#050507] px-4 py-8 text-white sm:px-6 lg:px-10 lg:py-12">
      <div className="mx-auto max-w-[1000px]">
        <Link href="/admin/users" className="text-xs font-semibold text-white/40 hover:text-cyan-300">← Users</Link>
        <header className="mt-5">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-300/70">Platform administration</p>
          <h1 className="mt-3 text-4xl font-black">{data.user.name}</h1>
          <p className="mt-2 text-sm text-white/40">{data.user.email} · {data.user.status} · joined {new Date(data.user.createdAt).toLocaleDateString()}</p>
        </header>

        {message && <p className="mt-5 rounded-xl border border-cyan-300/20 p-3 text-sm text-cyan-200">{message}</p>}

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-6">
            <h2 className="text-xl font-black">Platform role</h2>
            <p className="mt-2 text-sm text-white/40">Current: <span className="font-bold text-cyan-200">{data.user.platformRole}</span></p>
            <p className="mt-1 text-xs text-white/30">
              Platform role controls SuperKuba administration access only — it never changes any business&apos;s subscription plan or entitlements.
            </p>
            <select
              value={platformRole}
              onChange={(event) => setPlatformRole(event.target.value)}
              className="mt-4 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm"
            >
              {PLATFORM_ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
            </select>
            <input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Reason for this change (required, audited)"
              className="mt-3 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm"
            />
            <button
              type="button"
              onClick={() => void changeRole()}
              className="mt-3 w-full rounded-xl border border-cyan-300/20 bg-cyan-300/[0.06] px-4 py-3 text-sm font-semibold text-cyan-200"
            >
              Set platform role
            </button>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-6">
            <h2 className="text-xl font-black">Business memberships</h2>
            <div className="mt-4 space-y-2">
              {data.businessMemberships.length ? data.businessMemberships.map((membership) => (
                <div key={membership.businessId} className="flex items-center justify-between rounded-xl bg-black/20 p-3 text-sm">
                  <Link href={`/admin/businesses/${membership.businessId}`} className="font-semibold text-white/85 hover:text-cyan-300">{membership.businessName}</Link>
                  <span className="text-white/40">{membership.role} · {membership.plan}</span>
                </div>
              )) : <p className="rounded-xl border border-dashed border-white/10 p-4 text-center text-sm text-white/35">No business memberships.</p>}
            </div>

            <h2 className="mt-6 text-xl font-black">Portfolio memberships</h2>
            <div className="mt-4 space-y-2">
              {data.organizationMemberships.length ? data.organizationMemberships.map((membership) => (
                <div key={membership.organizationId} className="flex items-center justify-between rounded-xl bg-black/20 p-3 text-sm">
                  <Link href={`/admin/organizations/${membership.organizationId}`} className="font-semibold text-white/85 hover:text-cyan-300">{membership.organizationName}</Link>
                  <span className="text-white/40">{membership.role}</span>
                </div>
              )) : <p className="rounded-xl border border-dashed border-white/10 p-4 text-center text-sm text-white/35">No portfolio memberships.</p>}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
