"use client";

import { useEffect, useState } from "react";

type User = { id: string; name: string; email: string; status: string; platformRole: string; createdAt: string; businesses: { businessId: string; businessName: string; role: string }[] };

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[] | null>(null);
  useEffect(() => { fetch("/api/admin/users", { cache: "no-store" }).then((r) => r.ok ? r.json() : null).then((data) => setUsers(data?.users ?? null)).catch(() => setUsers(null)); }, []);
  return <main className="min-h-screen bg-[#050507] p-8 text-white"><div className="max-w-7xl"><p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-300/70">Super Admin</p><h1 className="mt-3 text-4xl font-black">Platform Users</h1><div className="mt-8 overflow-x-auto rounded-3xl border border-white/10 bg-white/[0.04]"><table className="w-full text-left text-sm"><thead className="border-b border-white/10 text-white/40"><tr><th className="p-4">User</th><th>Platform role</th><th>Businesses</th><th>Status</th><th className="p-4">Created</th></tr></thead><tbody>{users?.map((user) => <tr key={user.id} className="border-b border-white/5"><td className="p-4"><p className="font-medium">{user.name}</p><p className="text-white/40">{user.email}</p></td><td>{user.platformRole}</td><td>{user.businesses.map((business) => `${business.businessName} (${business.role})`).join(", ") || "—"}</td><td>{user.status}</td><td className="p-4">{new Date(user.createdAt).toLocaleDateString()}</td></tr>)}{users?.length === 0 && <tr><td className="p-4 text-white/40" colSpan={5}>No users found.</td></tr>}</tbody></table></div></div></main>;
}
