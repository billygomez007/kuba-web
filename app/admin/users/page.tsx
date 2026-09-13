"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type UserRow = { id: string; name: string; email: string; platformRole: string; status: string };

export default function AdminUsersPage() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetch(`/api/admin/users?search=${encodeURIComponent(search)}`, { cache: "no-store" })
        .then(async (response) => {
          const data = await response.json();
          if (response.ok) setRows(data.users || []);
          else setError(data.error || "Unable to load users.");
        })
        .catch(() => setError("Unable to load users."));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [search]);

  return (
    <main className="min-h-screen bg-[#050507] px-4 py-8 text-white sm:px-6 lg:px-10 lg:py-12">
      <div className="mx-auto max-w-[1200px]">
        <Link href="/admin" className="text-xs font-semibold text-white/40 hover:text-cyan-300">← Admin</Link>
        <header className="mt-5">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-300/70">Platform administration</p>
          <h1 className="mt-3 text-4xl font-black">Users</h1>
          <p className="mt-3 text-sm text-white/40">Search accounts and manage platform-wide roles.</p>
        </header>

        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search name or email"
          className="mt-6 w-full max-w-md rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm"
        />

        {error && <p className="mt-5 rounded-xl border border-red-400/20 p-3 text-sm text-red-200">{error}</p>}

        <section className="mt-6 overflow-x-auto rounded-3xl border border-white/10 bg-white/[0.025]">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[10px] uppercase tracking-wider text-white/30">
                <th className="px-5 py-4">Name</th>
                <th>Email</th>
                <th>Platform role</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? rows.map((user) => (
                <tr key={user.id} className="border-b border-white/[0.06] text-white/65 hover:bg-white/[0.03]">
                  <td className="px-5 py-4">
                    <Link href={`/admin/users/${user.id}`} className="font-bold text-white/85 hover:text-cyan-300">{user.name}</Link>
                  </td>
                  <td>{user.email}</td>
                  <td className={user.platformRole === "user" ? "text-white/40" : "uppercase text-cyan-200"}>{user.platformRole}</td>
                  <td>{user.status}</td>
                </tr>
              )) : (
                <tr><td colSpan={4} className="px-5 py-12 text-center text-white/35">No users match this search.</td></tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
