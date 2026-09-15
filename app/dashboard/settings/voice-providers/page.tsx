"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Provider = { id: string; name: string; status: "available" | "planned"; credentialModel: "platform" | "business" };
type Connection = { id: string; provider: string; status: string; externalAccountId: string | null; displayName: string | null };
type PlatformStatus = Record<string, "connected" | "not_configured">;

export default function VoiceProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [platformStatus, setPlatformStatus] = useState<PlatformStatus>({});
  const [provider, setProvider] = useState("");
  const [accountId, setAccountId] = useState("");
  const [secret, setSecret] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const response = await fetch("/api/settings/voice-providers", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) setError(data.error || "Unable to load providers.");
    else {
      setProviders(data.providers || []);
      setConnections(data.connections || []);
      setPlatformStatus(data.platformStatus || {});
    }
  }
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, []);

  async function connect() {
    setError(""); setMessage("");
    const response = await fetch("/api/settings/voice-providers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider, accountId, secret }) });
    const data = await response.json();
    if (!response.ok) setError(data.error || "Unable to connect provider.");
    else { setMessage("Provider connected. The secret is encrypted and cannot be viewed again."); setSecret(""); void load(); }
  }

  const platformProviders = providers.filter((item) => item.credentialModel === "platform");
  const businessProviders = providers.filter((item) => item.credentialModel === "business");

  return (
    <main className="min-h-screen bg-[#07070A] px-4 py-8 text-white sm:px-6 lg:px-8 lg:py-12">
      <div className="mx-auto max-w-6xl">
        <Link href="/dashboard/settings" className="text-xs font-semibold text-white/40 hover:text-cyan-300">← Settings</Link>
        <h1 className="mt-5 text-4xl font-black">Voice providers</h1>
        <p className="mt-3 text-sm text-white/40">Connect phone infrastructure without exposing provider secrets to the browser.</p>
        {message && <p className="mt-5 rounded-xl border border-emerald-400/20 p-3 text-sm text-emerald-200">{message}</p>}
        {error && <p className="mt-5 rounded-xl border border-red-400/20 p-3 text-sm text-red-200">{error}</p>}

        <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.025] p-6">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300/70">Platform-managed providers</p>
          <p className="mt-2 text-sm text-white/40">These providers are configured once by the SuperKuba platform operator, not by individual businesses — there is no account/secret to paste here. Your business is assigned a number and AI employee under these providers in Phone Numbers.</p>
          <div className="mt-5 space-y-3">
            {platformProviders.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-2xl border border-white/[0.08] bg-black/20 p-4">
                <div>
                  <p className="font-semibold">{item.name}</p>
                  <p className="mt-1 text-xs text-white/35">{item.status !== "available" ? "Not yet available" : platformStatus[item.id] === "connected" ? "Configured on this platform" : "Not configured on this platform yet"}</p>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs ${item.status === "available" && platformStatus[item.id] === "connected" ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200" : "border-white/10 bg-white/[0.04] text-white/50"}`}>
                  {item.status !== "available" ? "Coming soon" : platformStatus[item.id] === "connected" ? "Connected" : "Not configured"}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-6">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300/70">Connect your own provider</p>
            <p className="mt-2 text-xs text-white/35">For providers your business connects with its own account (not platform-managed).</p>
            <div className="mt-5 space-y-4">
              <label className="block text-sm font-semibold text-white/70">Provider
                <select value={provider} onChange={(event) => setProvider(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#111116] px-4 py-3 text-sm font-normal text-white/70">
                  <option value="">Select provider</option>
                  {businessProviders.map((item) => <option key={item.id} value={item.id} disabled={item.status !== "available"}>{item.name}{item.status !== "available" ? " (Coming soon)" : ""}</option>)}
                </select>
              </label>
              <label className="block text-sm font-semibold text-white/70">Account identifier<input value={accountId} onChange={(event) => setAccountId(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-normal" /></label>
              <label className="block text-sm font-semibold text-white/70">API key or secret<input type="password" value={secret} onChange={(event) => setSecret(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-normal" /></label>
              <button type="button" onClick={() => void connect()} disabled={!provider} className="w-full rounded-xl bg-cyan-400 px-4 py-3 text-sm font-bold text-black disabled:cursor-not-allowed disabled:opacity-50">Connect provider</button>
            </div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-6">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300/70">Connections</p>
            <div className="mt-5 space-y-3">
              {connections.length ? connections.map((item) => <div key={item.id} className="flex items-center justify-between rounded-2xl border border-white/[0.08] bg-black/20 p-4"><div><p className="font-semibold">{item.displayName || item.provider}</p><p className="mt-1 text-xs text-white/35">Account {item.externalAccountId || "Not supplied"}</p></div><span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-200">{item.status}</span></div>) : <p className="text-sm text-white/35">No business-managed voice providers connected.</p>}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
