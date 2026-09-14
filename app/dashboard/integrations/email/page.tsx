"use client";

import { useEffect, useState } from "react";

type EmailStatus = "NOT_CONFIGURED" | "CONFIGURED" | "ACTIVE" | "ERROR" | "LOADING";

type EmailIntegrationState = {
  status: EmailStatus;
  sending: { configured: boolean; from: string | null };
  inbound: { platformReady: boolean; domain: string | null; alias: string | null };
};

const STATUS_LABEL: Record<EmailStatus, string> = {
  LOADING: "Loading…",
  NOT_CONFIGURED: "Not configured",
  CONFIGURED: "Configured — inbound pending",
  ACTIVE: "Active",
  ERROR: "Not available",
};

const STATUS_COLOR: Record<EmailStatus, string> = {
  LOADING: "bg-white/10 text-white/60",
  NOT_CONFIGURED: "bg-white/10 text-white/60",
  CONFIGURED: "bg-amber-400/15 text-amber-300",
  ACTIVE: "bg-emerald-400/15 text-emerald-300",
  ERROR: "bg-red-400/15 text-red-300",
};

export default function EmailIntegrationPage() {
  const [state, setState] = useState<EmailIntegrationState>({
    status: "LOADING",
    sending: { configured: false, from: null },
    inbound: { platformReady: false, domain: null, alias: null },
  });
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function fetchEmailStatus() {
    const response = await fetch("/api/integrations/email");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to load email integration status.");
    return { status: data.status as EmailStatus, sending: data.sending, inbound: data.inbound };
  }

  useEffect(() => {
    async function load() {
      try {
        setState(await fetchEmailStatus());
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load email integration status.");
      }
    }

    void load();
  }, []);

  async function activate() {
    setActivating(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/integrations/email", { method: "PUT" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to activate the email integration.");
      setSuccess("Email integration activated.");
      setState(await fetchEmailStatus());
    } catch (activateError) {
      setError(activateError instanceof Error ? activateError.message : "Unable to activate the email integration.");
    } finally {
      setActivating(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#050507] px-6 py-10 text-white">
      <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/[0.04] p-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300/80">Communication channels</p>
            <h1 className="mt-2 text-3xl font-black">Email</h1>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${STATUS_COLOR[state.status]}`}>
            {STATUS_LABEL[state.status]}
          </span>
        </div>

        <p className="mt-3 text-white/50">
          Send campaign, transactional, and outreach email, and receive
          replies back into your Inbox.
        </p>

        {state.status === "ERROR" && (
          <div className="mt-8 rounded-2xl border border-red-400/20 bg-red-400/[0.05] p-5">
            <p className="text-sm text-red-200">
              Email sending is not configured in this environment yet.
              This is a platform-level setup step, not something a
              business can fix from this page.
            </p>
          </div>
        )}

        <div className="mt-8 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
          <h2 className="text-lg font-semibold">Sending</h2>
          <p className="mt-2 text-sm text-white/50">
            Every business currently sends from SuperKuba&apos;s shared,
            verified sending address. A dedicated sending domain per
            business is not available yet.
          </p>
          <div className="mt-4 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm">
            <span className="text-white/40">From: </span>
            <span className="text-white/85">{state.sending.from || "Not configured"}</span>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
          <h2 className="text-lg font-semibold">Inbound replies</h2>
          {state.inbound.platformReady ? (
            <>
              <p className="mt-2 text-sm text-white/50">
                Replies sent to your workspace&apos;s inbound address
                appear directly in your Inbox.
              </p>
              <div className="mt-4 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm">
                <span className="text-white/40">Inbound alias: </span>
                <span className="text-white/85">{state.inbound.alias || "Activate to generate"}</span>
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm text-amber-200/80">
              Inbound email receiving is not yet configured for this
              SuperKuba environment (no receiving domain has been set
              up). Campaign emails still send normally; replies cannot be
              received until this is configured. This is a platform-level
              setup step, not something a business can configure here.
            </p>
          )}
        </div>

        {state.status === "NOT_CONFIGURED" && state.sending.configured && (
          <button
            type="button"
            onClick={activate}
            disabled={activating}
            className="mt-6 rounded-xl bg-white px-6 py-3 font-bold text-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            {activating ? "Activating…" : "Activate Email"}
          </button>
        )}

        {error ? (
          <p className="mt-5 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200" role="alert">
            {error}
          </p>
        ) : null}

        {success ? (
          <p className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200" role="status">
            {success}
          </p>
        ) : null}
      </div>
    </main>
  );
}
