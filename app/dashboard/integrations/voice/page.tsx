"use client";

import { useEffect, useState } from "react";

type PhoneNumber = {
  id: string;
  number: string | null;
  provider: string;
  status: string;
};

type VoiceProviderConnection = {
  id: string;
  provider: string;
  status: string;
  displayName: string | null;
};

export default function VoiceIntegrationPage() {
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [providers, setProviders] = useState<VoiceProviderConnection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadVoiceState = async () => {
      try {
        const [numbersRes, providersRes] = await Promise.all([
          fetch("/api/settings/phone-numbers", { cache: "no-store" }),
          fetch("/api/settings/voice-providers", { cache: "no-store" }),
        ]);

        if (numbersRes.ok) {
          const numbersData = await numbersRes.json();
          setPhoneNumbers(numbersData.numbers || []);
        }

        if (providersRes.ok) {
          const providersData = await providersRes.json();
          setProviders(providersData.connections || []);
        }
      } catch (err) {
        console.error("Failed to load voice configuration:", err);
      } finally {
        setLoading(false);
      }
    };

    void loadVoiceState();
  }, []);

  const configured = phoneNumbers.some((item) => item.status === "active" || item.status === "available") || providers.some((item) => item.status === "active");
  const statusLabel = configured ? "Configured" : "Not Configured";

  return (
    <main className="min-h-screen bg-[#050507] px-6 py-10 text-white">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300/80">Communication channels</p>
            <h1 className="mt-2 text-4xl font-black">Voice</h1>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${configured ? "bg-emerald-500/15 text-emerald-200" : "bg-white/10 text-white/70"}`}>
            {statusLabel}
          </span>
        </div>

        <p className="mt-3 text-white/50">
          Voice is tenant-scoped and uses signed Twilio webhook callbacks. No provider secrets are exposed in the dashboard.
        </p>

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.04] p-8">
          <h2 className="text-2xl font-bold">Twilio / Voice status</h2>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
              <p className="text-xs uppercase tracking-wide text-white/40">Status</p>
              <p className="mt-2 text-lg font-bold">{statusLabel}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
              <p className="text-xs uppercase tracking-wide text-white/40">Configured numbers</p>
              <p className="mt-2 text-lg font-bold">{phoneNumbers.length}</p>
            </div>
          </div>

          {!loading && !configured && (
            <div className="mt-6 rounded-2xl border border-amber-300/20 bg-amber-300/[0.05] p-4 text-sm text-amber-200">
              Voice is not configured for this staging business yet. No real outbound calls are initiated from this environment.
            </div>
          )}

          <a href="/dashboard/settings/phone-numbers" className="mt-6 inline-block rounded-xl bg-white px-8 py-4 font-bold text-black">
            Manage phone numbers
          </a>
        </div>

        {!loading && phoneNumbers.length > 0 && (
          <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.04] p-8">
            <h2 className="text-2xl font-bold">Configured numbers</h2>
            <div className="mt-6 space-y-3">
              {phoneNumbers.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div>
                    <p className="font-mono font-bold">{item.number || "Unknown number"}</p>
                    <p className="mt-1 text-sm text-white/50">{item.provider}</p>
                  </div>
                  <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold uppercase text-emerald-200">{item.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
