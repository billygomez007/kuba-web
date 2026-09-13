"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type OrganizationRow = { id: string; name: string; memberCount: number; businessCount: number; ownerName: string | null; ownerEmail: string | null; createdAt: string };

export default function AdminOrganizationsPage() {
  const [rows, setRows] = useState<OrganizationRow[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [reason, setReason] = useState("");

  async function load() {
    const response = await fetch("/api/admin/organizations", { cache: "no-store" });
    const data = await response.json();
    if (response.ok) setRows(data.organizations || []);
    else setError(data.error || "Unable to load portfolios.");
  }

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, []);

  async function createOrganization() {
    if (!name.trim() || !reason.trim()) { setMessage("A portfolio name and reason are both required."); return; }
    const response = await fetch("/api/admin/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, ownerEmail, reason }),
    });
    const data = await response.json();
    if (response.ok) {
      setMessage(`Portfolio "${name}" created.`);
      setName(""); setOwnerEmail(""); setReason("");
      await load();
    } else {
      setMessage(data.error || "Unable to create portfolio.");
    }
  }

  return (
    <main className="min-h-screen bg-[#050507] px-4 py-8 text-white sm:px-6 lg:px-10 lg:py-12">
      <div className="mx-auto max-w-[1200px]">
        <Link href="/admin" className="text-xs font-semibold text-white/40 hover:text-cyan-300">← Admin</Link>
        <header className="mt-5">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-300/70">Platform administration</p>
          <h1 className="mt-3 text-4xl font-black">Portfolios</h1>
          <p className="mt-3 text-sm text-white/40">A portfolio groups multiple businesses under one owning organization (e.g. Realtegic). Linking a business here is discovery/oversight metadata only — it never grants access to that business&apos;s data by itself.</p>
        </header>

        {message && <p className="mt-5 rounded-xl border border-cyan-300/20 p-3 text-sm text-cyan-200">{message}</p>}
        {error && <p className="mt-5 rounded-xl border border-red-400/20 p-3 text-sm text-red-200">{error}</p>}

        <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.025] p-6">
          <h2 className="text-lg font-black">Create portfolio</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Portfolio name (e.g. Realtegic)" className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm" />
            <input value={ownerEmail} onChange={(event) => setOwnerEmail(event.target.value)} placeholder="Owner email (optional)" className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm" />
            <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason (required, audited)" className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm" />
          </div>
          <button type="button" onClick={() => void createOrganization()} className="mt-3 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.06] px-4 py-3 text-sm font-semibold text-cyan-200">Create portfolio</button>
        </section>

        <section className="mt-6 overflow-x-auto rounded-3xl border border-white/10 bg-white/[0.025]">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[10px] uppercase tracking-wider text-white/30">
                <th className="px-5 py-4">Portfolio</th>
                <th>Owner</th>
                <th>Members</th>
                <th>Businesses</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? rows.map((org) => (
                <tr key={org.id} className="border-b border-white/[0.06] text-white/65 hover:bg-white/[0.03]">
                  <td className="px-5 py-4">
                    <Link href={`/admin/organizations/${org.id}`} className="font-bold text-white/85 hover:text-cyan-300">{org.name}</Link>
                  </td>
                  <td>{org.ownerName ? `${org.ownerName} (${org.ownerEmail})` : <span className="text-white/30">No owner set</span>}</td>
                  <td>{org.memberCount}</td>
                  <td>{org.businessCount}</td>
                  <td className="text-white/35">{new Date(org.createdAt).toLocaleDateString()}</td>
                </tr>
              )) : (
                <tr><td colSpan={5} className="px-5 py-12 text-center text-white/35">No portfolios yet.</td></tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
