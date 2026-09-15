"use client";

import { useEffect, useState } from "react";

type PhoneNumber = { id: string; number: string | null; provider: string; status: string; metadata: string | null };
type Employee = { id: string; name: string; type: string; status: string };
type PlatformStatus = Record<string, "connected" | "not_configured">;
type VoiceConfig = { enabled: boolean; callDirection: "inbound" | "outbound" | "both" };

function assignedEmployeeId(metadata: string | null): string {
  try { return JSON.parse(metadata || "{}").employeeId || ""; } catch { return ""; }
}

const providerLabel: Record<string, string> = { twilio: "Twilio", plivo: "Plivo", sip: "SIP", retell: "Retell", vapi: "Vapi" };

export default function VoiceIntegrationPage() {
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [platformStatus, setPlatformStatus] = useState<PlatformStatus>({});
  const [voiceConfigs, setVoiceConfigs] = useState<Record<string, VoiceConfig>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadVoiceState = async () => {
      try {
        const [numbersRes, providersRes, employeesRes] = await Promise.all([
          fetch("/api/settings/phone-numbers", { cache: "no-store" }),
          fetch("/api/settings/voice-providers", { cache: "no-store" }),
          fetch("/api/ai-employees", { cache: "no-store" }),
        ]);
        const numbersData = numbersRes.ok ? await numbersRes.json() : { numbers: [] };
        const providersData = providersRes.ok ? await providersRes.json() : { platformStatus: {} };
        const employeesData = employeesRes.ok ? await employeesRes.json() : { employees: [] };
        setPhoneNumbers(numbersData.numbers || []);
        setPlatformStatus(providersData.platformStatus || {});
        setEmployees(employeesData.employees || []);

        const employeeIds = Array.from(new Set((numbersData.numbers || []).map((item: PhoneNumber) => assignedEmployeeId(item.metadata)).filter(Boolean)));
        const configs = await Promise.all(employeeIds.map(async (id) => {
          const response = await fetch(`/api/ai-employees/${id}/voice`, { cache: "no-store" });
          if (!response.ok) return [id, null] as const;
          const data = await response.json();
          return [id, data.config as VoiceConfig] as const;
        }));
        setVoiceConfigs(Object.fromEntries(configs.filter(([, config]) => config)));
      } catch (err) {
        console.error("Failed to load voice configuration:", err);
      } finally {
        setLoading(false);
      }
    };
    void loadVoiceState();
  }, []);

  const employeeById = new Map(employees.map((item) => [item.id, item]));
  const realtimeReady = platformStatus["openai-realtime"] === "connected";

  return (
    <main className="min-h-screen bg-[#050507] px-6 py-10 text-white">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300/80">Communication channels</p>
            <h1 className="mt-2 text-4xl font-black">Voice</h1>
          </div>
        </div>

        <p className="mt-3 text-white/50">
          Voice is tenant-scoped. Inbound/outbound calls are authenticated via signed provider webhook signatures; no provider secrets are exposed in the dashboard.
        </p>

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.04] p-8">
          <h2 className="text-2xl font-bold">Realtime AI runtime</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
              <p className="text-xs uppercase tracking-wide text-white/40">OpenAI Realtime</p>
              <p className="mt-2 text-lg font-bold">{realtimeReady ? "Configured" : "Not configured"}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
              <p className="text-xs uppercase tracking-wide text-white/40">Configured numbers</p>
              <p className="mt-2 text-lg font-bold">{phoneNumbers.length}</p>
            </div>
          </div>
          {!loading && !realtimeReady && (
            <div className="mt-6 rounded-2xl border border-amber-300/20 bg-amber-300/[0.05] p-4 text-sm text-amber-200">
              The OpenAI Realtime runtime is not configured for this platform environment. Voice cannot connect calls to an AI employee until it is.
            </div>
          )}
          <a href="/dashboard/settings/phone-numbers" className="mt-6 inline-block rounded-xl bg-white px-8 py-4 font-bold text-black">Manage phone numbers</a>
        </div>

        {!loading && phoneNumbers.length > 0 && (
          <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.04] p-8">
            <h2 className="text-2xl font-bold">Configured numbers</h2>
            <div className="mt-6 space-y-3">
              {phoneNumbers.map((item) => {
                const employee = employeeById.get(assignedEmployeeId(item.metadata));
                const config = voiceConfigs[assignedEmployeeId(item.metadata)];
                const providerReady = platformStatus[item.provider] === "connected";
                const inboundReady = Boolean(employee && config?.enabled && (config.callDirection === "inbound" || config.callDirection === "both") && providerReady && realtimeReady);
                const outboundReady = Boolean(employee && config?.enabled && (config.callDirection === "outbound" || config.callDirection === "both") && providerReady && realtimeReady);
                return (
                  <div key={item.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-mono font-bold">{item.number || "Unknown number"}</p>
                      <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase text-white/60">{providerLabel[item.provider] || item.provider}</span>
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-white/50 sm:grid-cols-4">
                      <p>AI employee: <span className="text-white/80">{employee ? `${employee.name} (${employee.type})` : "None assigned"}</span></p>
                      <p>Inbound: <span className={inboundReady ? "text-emerald-300" : "text-white/40"}>{inboundReady ? "Ready" : "Not ready"}</span></p>
                      <p>Outbound: <span className={outboundReady ? "text-emerald-300" : "text-white/40"}>{outboundReady ? "Ready" : "Not ready"}</span></p>
                      <p>Provider: <span className={providerReady ? "text-emerald-300" : "text-white/40"}>{providerReady ? "Configured" : "Not configured"}</span></p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {!loading && phoneNumbers.length === 0 && (
          <div className="mt-8 rounded-2xl border border-amber-300/20 bg-amber-300/[0.05] p-4 text-sm text-amber-200">
            No phone numbers configured yet. Add one under Phone Numbers.
          </div>
        )}
      </div>
    </main>
  );
}
