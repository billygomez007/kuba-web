"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Detail = {
  organization: { id: string; name: string; slug: string; createdAt: string };
  members: { id: string; userId: string; role: string; name: string; email: string }[];
  businesses: { id: string; businessId: string; name: string; plan: string; status: string }[];
};

type BusinessSearchResult = { id: string; name: string; plan: string; subscriptionStatus: string };

export default function AdminOrganizationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reason, setReason] = useState("");

  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState("member");

  const [businessSearch, setBusinessSearch] = useState("");
  const [businessResults, setBusinessResults] = useState<BusinessSearchResult[]>([]);

  async function load() {
    const response = await fetch(`/api/admin/organizations/${id}`, { cache: "no-store" });
    const result = await response.json();
    if (response.ok) setData(result);
    else setError(result.error || "Unable to load portfolio.");
  }

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [id]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!businessSearch.trim()) { setBusinessResults([]); return; }
      void fetch(`/api/admin/businesses?search=${encodeURIComponent(businessSearch)}`, { cache: "no-store" })
        .then((response) => response.json())
        .then((result) => setBusinessResults(result.businesses || []))
        .catch(() => setBusinessResults([]));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [businessSearch]);

  async function act(body: Record<string, unknown>, successMessage: string) {
    if (!reason.trim()) { setMessage("A reason is required."); return; }
    const response = await fetch(`/api/admin/organizations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, reason }),
    });
    const result = await response.json();
    if (response.ok) {
      setMessage(successMessage);
      setReason("");
      await load();
    } else {
      setMessage(result.error || "Unable to complete this action.");
    }
  }

  if (!data) return <main className="flex min-h-screen items-center justify-center bg-[#050507] px-6 text-sm text-white/40">{error || "Loading portfolio..."}</main>;

  const linkedBusinessIds = new Set(data.businesses.map((business) => business.businessId));

  return (
    <main className="min-h-screen bg-[#050507] px-4 py-8 text-white sm:px-6 lg:px-10 lg:py-12">
      <div className="mx-auto max-w-[1100px]">
        <Link href="/admin/organizations" className="text-xs font-semibold text-white/40 hover:text-cyan-300">← Portfolios</Link>
        <header className="mt-5">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-300/70">Portfolio</p>
          <h1 className="mt-3 text-4xl font-black">{data.organization.name}</h1>
          <p className="mt-2 text-sm text-white/40">Created {new Date(data.organization.createdAt).toLocaleDateString()}</p>
        </header>

        {message && <p className="mt-5 rounded-xl border border-cyan-300/20 p-3 text-sm text-cyan-200">{message}</p>}

        <input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Reason for the next action below (required, audited)"
          className="mt-6 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm"
        />

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-6">
            <h2 className="text-xl font-black">Members</h2>
            <div className="mt-4 space-y-2">
              {data.members.length ? data.members.map((member) => (
                <div key={member.id} className="flex items-center justify-between rounded-xl bg-black/20 p-3 text-sm">
                  <div>
                    <Link href={`/admin/users/${member.userId}`} className="font-semibold text-white/85 hover:text-cyan-300">{member.name}</Link>
                    <span className="ml-2 text-xs text-white/35">{member.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-white/40">{member.role}</span>
                    <button type="button" onClick={() => void act({ action: "remove_member", userId: member.userId }, "Member removed.")} className="text-xs text-rose-300 hover:text-rose-200">Remove</button>
                  </div>
                </div>
              )) : <p className="rounded-xl border border-dashed border-white/10 p-4 text-center text-sm text-white/35">No members yet.</p>}
            </div>

            <div className="mt-4 flex gap-2">
              <input value={memberEmail} onChange={(event) => setMemberEmail(event.target.value)} placeholder="Email of an existing user" className="flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm" />
              <select value={memberRole} onChange={(event) => setMemberRole(event.target.value)} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm">
                <option value="owner">owner</option>
                <option value="admin">admin</option>
                <option value="member">member</option>
              </select>
            </div>
            <button
              type="button"
              onClick={() => void act({ action: "add_member", email: memberEmail, role: memberRole }, `${memberEmail} added as ${memberRole}.`)}
              className="mt-2 w-full rounded-xl border border-cyan-300/20 bg-cyan-300/[0.06] px-4 py-3 text-sm font-semibold text-cyan-200"
            >
              Add member
            </button>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-6">
            <h2 className="text-xl font-black">Linked businesses</h2>
            <div className="mt-4 space-y-2">
              {data.businesses.length ? data.businesses.map((business) => (
                <div key={business.id} className="flex items-center justify-between rounded-xl bg-black/20 p-3 text-sm">
                  <Link href={`/admin/businesses/${business.businessId}`} className="font-semibold text-white/85 hover:text-cyan-300">{business.name}</Link>
                  <div className="flex items-center gap-2">
                    <span className="uppercase text-cyan-200">{business.plan}</span>
                    <button type="button" onClick={() => void act({ action: "unlink_business", businessId: business.businessId }, "Business unlinked.")} className="text-xs text-rose-300 hover:text-rose-200">Unlink</button>
                  </div>
                </div>
              )) : <p className="rounded-xl border border-dashed border-white/10 p-4 text-center text-sm text-white/35">No businesses linked yet.</p>}
            </div>

            <h3 className="mt-6 text-sm font-bold uppercase tracking-wide text-white/40">Add existing business</h3>
            <input
              value={businessSearch}
              onChange={(event) => setBusinessSearch(event.target.value)}
              placeholder="Search business name, ID, country, industry"
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm"
            />
            <div className="mt-2 space-y-2">
              {businessResults.map((business) => (
                <div key={business.id} className="flex items-center justify-between rounded-xl bg-black/20 p-3 text-sm">
                  <div>
                    <p className="font-semibold text-white/85">{business.name}</p>
                    <p className="text-xs text-white/30">{business.id} · {business.plan} · {business.subscriptionStatus}</p>
                  </div>
                  {linkedBusinessIds.has(business.id) ? (
                    <span className="text-xs text-white/30">Already linked</span>
                  ) : (
                    <button type="button" onClick={() => void act({ action: "link_business", businessId: business.id }, `${business.name} linked.`)} className="rounded-lg border border-cyan-300/20 px-3 py-1.5 text-xs font-semibold text-cyan-200">Link</button>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
