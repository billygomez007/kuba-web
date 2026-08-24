"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type NumberItem = { id: string; number: string | null; provider: string; status: string; metadata: string | null };

export default function PhoneNumbersPage() {
  const [numbers, setNumbers] = useState<NumberItem[]>([]);
  const [number, setNumber] = useState("");
  const [provider, setProvider] = useState("twilio");
  const [error, setError] = useState("");
  async function load() { const response = await fetch("/api/settings/phone-numbers", { cache: "no-store" }); const data = await response.json(); if (!response.ok) setError(data.error || "Unable to load phone numbers."); else setNumbers(data.numbers || []); }
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, []);
  async function add() { const response = await fetch("/api/settings/phone-numbers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ number, provider }) }); const data = await response.json(); if (!response.ok) setError(data.error || "Unable to add number."); else { setNumber(""); void load(); } }
  return <main className="min-h-screen bg-[#07070A] px-4 py-8 text-white sm:px-6 lg:px-8 lg:py-12"><div className="mx-auto max-w-6xl"><Link href="/dashboard/settings" className="text-xs font-semibold text-white/40 hover:text-cyan-300">← Settings</Link><h1 className="mt-5 text-4xl font-black">Phone numbers</h1><p className="mt-3 text-sm text-white/40">Manage numbers that can be assigned to existing AI employees from their Voice Deployment Center.</p>{error && <p className="mt-5 rounded-xl border border-red-400/20 p-3 text-sm text-red-200">{error}</p>}<section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.025] p-6"><div className="flex flex-col gap-3 sm:flex-row"><input value={number} onChange={(event) => setNumber(event.target.value)} placeholder="+233..." className="flex-1 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm" /><select value={provider} onChange={(event) => setProvider(event.target.value)} className="rounded-xl border border-white/10 bg-[#111116] px-4 py-3 text-sm"><option value="twilio">Twilio</option><option value="sip">SIP</option><option value="retell">Retell</option><option value="vapi">Vapi</option></select><button type="button" onClick={() => void add()} className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-bold text-black">Add number</button></div><div className="mt-6 space-y-3">{numbers.length ? numbers.map((item) => <div key={item.id} className="flex items-center justify-between rounded-2xl border border-white/[0.08] bg-black/20 p-4"><div><p className="font-semibold">{item.number || "Unknown number"}</p><p className="mt-1 text-xs text-white/35">{item.provider}</p></div><span className="rounded-full border border-cyan-300/20 bg-cyan-300/[0.07] px-3 py-1 text-xs text-cyan-200">{item.status}</span></div>) : <p className="text-sm text-white/35">No phone numbers added.</p>}</div></section></div></main>;
}
