"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type NumberItem = { id: string; number: string | null; provider: string; status: string; metadata: string | null };
type Provider = { id: string; name: string; status: "available" | "planned" };
type Employee = { id: string; name: string; type: string; status: string };
type PlivoNumber = { number: string; region: string | null; voiceEnabled: boolean };

function assignedEmployeeId(metadata: string | null): string {
  try { return JSON.parse(metadata || "{}").employeeId || ""; } catch { return ""; }
}

export default function PhoneNumbersPage() {
  const [numbers, setNumbers] = useState<NumberItem[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [plivoNumbers, setPlivoNumbers] = useState<PlivoNumber[]>([]);
  const [plivoError, setPlivoError] = useState("");
  const [number, setNumber] = useState("");
  const [provider, setProvider] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const [numbersRes, providersRes, employeesRes] = await Promise.all([
      fetch("/api/settings/phone-numbers", { cache: "no-store" }),
      fetch("/api/settings/voice-providers", { cache: "no-store" }),
      fetch("/api/ai-employees", { cache: "no-store" }),
    ]);
    const numbersData = await numbersRes.json();
    const providersData = await providersRes.json();
    const employeesData = await employeesRes.json();
    if (!numbersRes.ok) setError(numbersData.error || "Unable to load phone numbers.");
    else setNumbers(numbersData.numbers || []);
    setProviders((providersData.providers || []).filter((item: Provider) => item.status === "available"));
    setEmployees(employeesData.employees || []);
  }
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, []);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setPlivoNumbers([]); setPlivoError("");
      if (provider !== "plivo") return;
      void (async () => {
        const response = await fetch("/api/settings/phone-numbers/plivo/available", { cache: "no-store" });
        const data = await response.json();
        if (cancelled) return;
        if (!response.ok) setPlivoError(data.error || "Unable to read Plivo phone numbers.");
        else setPlivoNumbers(data.numbers || []);
      })();
    }, 0);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [provider]);

  async function add() {
    const response = await fetch("/api/settings/phone-numbers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ number, provider, employeeId }) });
    const data = await response.json();
    if (!response.ok) setError(data.error || "Unable to add number.");
    else { setNumber(""); setEmployeeId(""); void load(); }
  }

  const employeeById = new Map(employees.map((item) => [item.id, item]));

  return (
    <main className="min-h-screen bg-[#07070A] px-4 py-8 text-white sm:px-6 lg:px-8 lg:py-12">
      <div className="mx-auto max-w-6xl">
        <Link href="/dashboard/settings" className="text-xs font-semibold text-white/40 hover:text-cyan-300">← Settings</Link>
        <h1 className="mt-5 text-4xl font-black">Phone numbers</h1>
        <p className="mt-3 text-sm text-white/40">Assign a real phone number to an AI employee. A number can belong to only one business, and the employee must already have Voice enabled under their Voice settings.</p>
        {error && <p className="mt-5 rounded-xl border border-red-400/20 p-3 text-sm text-red-200">{error}</p>}

        <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.025] p-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <select value={provider} onChange={(event) => { setProvider(event.target.value); setNumber(""); }} className="rounded-xl border border-white/10 bg-[#111116] px-4 py-3 text-sm">
              <option value="">Select provider</option>
              {providers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            {provider === "plivo" ? (
              <select value={number} onChange={(event) => setNumber(event.target.value)} className="rounded-xl border border-white/10 bg-[#111116] px-4 py-3 text-sm">
                <option value="">{plivoError ? "Plivo not configured" : plivoNumbers.length ? "Select a Plivo number" : "Loading Plivo numbers..."}</option>
                {plivoNumbers.map((item) => <option key={item.number} value={item.number} disabled={!item.voiceEnabled}>{item.number}{item.region ? ` (${item.region})` : ""}{!item.voiceEnabled ? " — voice not enabled" : ""}</option>)}
              </select>
            ) : (
              <input value={number} onChange={(event) => setNumber(event.target.value)} placeholder="+233..." className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm" />
            )}
            <select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} className="rounded-xl border border-white/10 bg-[#111116] px-4 py-3 text-sm">
              <option value="">No employee yet</option>
              {employees.filter((item) => item.status === "active").map((item) => <option key={item.id} value={item.id}>{item.name} ({item.type})</option>)}
            </select>
            <button type="button" onClick={() => void add()} disabled={!number || !provider} className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-bold text-black disabled:cursor-not-allowed disabled:opacity-50">Add number</button>
          </div>
          {provider === "plivo" && plivoError && <p className="mt-3 text-xs text-amber-300/80">{plivoError}</p>}
          <div className="mt-6 space-y-3">
            {numbers.length ? numbers.map((item) => {
              const employee = employeeById.get(assignedEmployeeId(item.metadata));
              return (
                <div key={item.id} className="flex items-center justify-between rounded-2xl border border-white/[0.08] bg-black/20 p-4">
                  <div>
                    <p className="font-semibold">{item.number || "Unknown number"}</p>
                    <p className="mt-1 text-xs text-white/35">{item.provider} · {employee ? `${employee.name} (${employee.type})` : "No employee assigned"}</p>
                  </div>
                  <span className="rounded-full border border-cyan-300/20 bg-cyan-300/[0.07] px-3 py-1 text-xs text-cyan-200">{item.status}</span>
                </div>
              );
            }) : <p className="text-sm text-white/35">No phone numbers added.</p>}
          </div>
        </section>
      </div>
    </main>
  );
}
